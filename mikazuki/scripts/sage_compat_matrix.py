from __future__ import annotations

import argparse
import itertools
import json
import os
import queue
import re
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable

import toml


def _setup_repo_paths() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    stable_root = repo_root / "scripts" / "stable"
    for path in (repo_root, stable_root):
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)
    return repo_root


REPO_ROOT = _setup_repo_paths()

from mikazuki.utils.runtime_dependencies import (  # noqa: E402
    BUILTIN_LR_SCHEDULERS,
    CUSTOM_SCHEDULER_PREFIX,
    analyze_training_runtime_dependencies,
)


DEFAULT_OUTPUT_ROOT = REPO_ROOT / "tmp" / "selftests" / "sage-matrix"
DEFAULT_TRAIN_DATA = REPO_ROOT / "sucai" / "6_lulu"
DEFAULT_SDXL_MODEL = REPO_ROOT / "models" / "silentEraFurrymixNAIXL_v10.safetensors"
DEFAULT_ANIMA_MODEL = REPO_ROOT / "models" / "diffusion_models" / "anima-preview2.safetensors"
DEFAULT_ANIMA_QWEN3 = REPO_ROOT / "models" / "text_encoders" / "qwen_3_06b_base.safetensors"
DEFAULT_ANIMA_VAE = REPO_ROOT / "models" / "vae" / "qwen_image_vae.safetensors"

DEFAULT_SDXL_OPTIMIZERS = [
    "AdamW",
    "AdamW8bit",
    "PagedAdamW8bit",
    "RAdamScheduleFree",
    "Lion",
    "Lion8bit",
    "PagedLion8bit",
    "SGDNesterov",
    "SGDNesterov8bit",
    "DAdaptation",
    "DAdaptAdam",
    "DAdaptAdaGrad",
    "DAdaptAdanIP",
    "DAdaptLion",
    "DAdaptSGD",
    "AdaFactor",
    "Prodigy",
    "prodigyplus.ProdigyPlusScheduleFree",
    "pytorch_optimizer.CAME",
    "bitsandbytes.optim.AdEMAMix8bit",
    "bitsandbytes.optim.PagedAdEMAMix8bit",
]

STARTUP_SUCCESS_MARKERS = (
    "running training / 学習開始",
    "epoch 1/1",
)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value).strip())
    slug = slug.replace(".", "_")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug.strip("-_") or "case"


def _tail_text(text: str, max_lines: int = 60) -> str:
    return "\n".join(text.splitlines()[-max_lines:])


def _dedupe_keep_order(values: list[str]) -> list[str]:
    result: list[str] = []
    seen = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


def _parse_shared_schema_optimizers() -> list[str]:
    schema_path = REPO_ROOT / "mikazuki" / "schema" / "shared.ts"
    try:
        text = schema_path.read_text(encoding="utf-8")
    except OSError:
        return list(DEFAULT_SDXL_OPTIMIZERS)

    marker = 'optimizer_type: Schema.union(['
    start = text.find(marker)
    if start < 0:
        return list(DEFAULT_SDXL_OPTIMIZERS)

    end_marker = ']).default("AdamW8bit")'
    end = text.find(end_marker, start)
    if end < 0:
        return list(DEFAULT_SDXL_OPTIMIZERS)

    block = text[start : end + len(end_marker)]
    optimizers = re.findall(r'"([^"]+)"', block)
    return _dedupe_keep_order(optimizers) or list(DEFAULT_SDXL_OPTIMIZERS)


def _resolve_requested_optimizers(requested: list[str]) -> list[str]:
    if not requested:
        return _parse_shared_schema_optimizers()

    expanded: list[str] = []
    for item in requested:
        normalized = str(item).strip()
        if normalized.lower() in {"all", "auto", "schema"}:
            expanded.extend(_parse_shared_schema_optimizers())
        else:
            expanded.append(normalized)

    expanded = _dedupe_keep_order(expanded)
    return expanded or _parse_shared_schema_optimizers()


def _resolve_requested_schedulers(requested: list[str]) -> list[str]:
    if not requested:
        return ["constant"]

    expanded: list[str] = []
    for item in requested:
        normalized = str(item).strip()
        if normalized.lower() in {"builtin", "builtins", "all"}:
            expanded.extend(sorted(BUILTIN_LR_SCHEDULERS))
        else:
            expanded.append(normalized)
    return _dedupe_keep_order(expanded) or ["constant"]


def _recommended_optimizer_settings(optimizer_type: str) -> dict[str, object]:
    lower_name = optimizer_type.strip().lower()
    config: dict[str, object] = {
        "learning_rate": 1e-4,
        "unet_lr": 1e-4,
        "text_encoder_lr": 1e-5,
        "optimizer_args": [],
    }

    if lower_name in {"sgdnesterov", "sgdnesterov8bit"}:
        config["learning_rate"] = 1e-2
        config["unet_lr"] = 1e-2
        config["text_encoder_lr"] = 1e-2
    if lower_name == "adafactor":
        config["learning_rate"] = 1e-3
        config["unet_lr"] = 1e-3
        config["text_encoder_lr"] = 1e-3
    elif lower_name.startswith("dadapt") or lower_name == "prodigy" or "prodigyplus" in lower_name:
        config["learning_rate"] = 1.0
        config["unet_lr"] = 1.0
        config["text_encoder_lr"] = 1.0

    if lower_name == "prodigy":
        config["optimizer_args"] = [
            "decouple=True",
            "weight_decay=0.01",
            "use_bias_correction=True",
            "d_coef=2.0",
        ]

    return config


def _apply_scheduler_fields(config: dict[str, object], scheduler_name: str) -> None:
    normalized = str(scheduler_name).strip()
    if not normalized:
        raise ValueError("Scheduler name cannot be empty.")

    config["lr_scheduler_args"] = []
    config["lr_warmup_steps"] = 0

    custom_name = normalized
    if normalized.startswith(CUSTOM_SCHEDULER_PREFIX):
        custom_name = normalized[len(CUSTOM_SCHEDULER_PREFIX) :]

    if custom_name in BUILTIN_LR_SCHEDULERS:
        config["lr_scheduler"] = custom_name
        config.pop("lr_scheduler_type", None)
        return

    if "." not in custom_name:
        raise ValueError(
            f"Unsupported scheduler name: {scheduler_name}. "
            f"Use a builtin scheduler ({', '.join(sorted(BUILTIN_LR_SCHEDULERS))}) or a full class path."
        )

    config["lr_scheduler"] = "constant"
    config["lr_scheduler_type"] = custom_name


def _json_dump(path: Path, payload: dict[str, object]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _print_progress(message: str) -> None:
    print(message, flush=True)


def _to_jsonable(value):
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    return value


def _find_saved_model(output_dir: Path, output_name: str) -> Path | None:
    exact = output_dir / f"{output_name}.safetensors"
    if exact.exists():
        return exact

    candidates = sorted(output_dir.glob(f"{output_name}*.safetensors"), key=lambda path: path.stat().st_mtime)
    if candidates:
        return candidates[-1]

    candidates = sorted(output_dir.glob("*.safetensors"), key=lambda path: path.stat().st_mtime)
    if candidates:
        return candidates[-1]

    return None


def _count_matching_lora_up_weights(model_path: Path, tokens: tuple[str, ...]) -> dict[str, object]:
    from safetensors import safe_open

    total = 0
    zero_count = 0
    nonzero_count = 0
    zero_examples: list[str] = []
    nonzero_examples: list[str] = []
    metadata: dict[str, str] = {}
    token_summary = {
        token: {
            "total": 0,
            "zero_count": 0,
            "nonzero_count": 0,
            "zero_examples": [],
            "nonzero_examples": [],
        }
        for token in tokens
    }

    with safe_open(str(model_path), framework="pt", device="cpu") as handle:
        metadata = dict(handle.metadata() or {})
        for name in handle.keys():
            if not name.endswith("lora_up.weight"):
                continue
            matched_tokens = [token for token in tokens if token in name]
            if not matched_tokens:
                continue

            total += 1
            tensor = handle.get_tensor(name)
            is_zero = bool((tensor == 0).all().item())
            if is_zero:
                zero_count += 1
                if len(zero_examples) < 16:
                    zero_examples.append(name)
            else:
                nonzero_count += 1
                if len(nonzero_examples) < 16:
                    nonzero_examples.append(name)

            for token in matched_tokens:
                token_record = token_summary[token]
                token_record["total"] += 1
                if is_zero:
                    token_record["zero_count"] += 1
                    if len(token_record["zero_examples"]) < 8:
                        token_record["zero_examples"].append(name)
                else:
                    token_record["nonzero_count"] += 1
                    if len(token_record["nonzero_examples"]) < 8:
                        token_record["nonzero_examples"].append(name)

    return {
        "total_matching_lora_up": total,
        "zero_count": zero_count,
        "nonzero_count": nonzero_count,
        "zero_examples": zero_examples,
        "nonzero_examples": nonzero_examples,
        "token_summary": token_summary,
        "metadata": metadata,
    }


def _validate_sdxl_model(model_path: Path) -> dict[str, object]:
    tokens = ("to_q", "to_k", "to_v")
    summary = _count_matching_lora_up_weights(model_path, tokens)
    token_summary = summary["token_summary"]
    missing_tokens = [token for token in tokens if token_summary[token]["total"] <= 0]
    dead_tokens = [token for token in tokens if token_summary[token]["nonzero_count"] <= 0]
    success = bool(summary["total_matching_lora_up"] > 0 and not missing_tokens and not dead_tokens)
    return {
        "success": success,
        "summary": summary,
        "warnings": [] if summary["zero_count"] == 0 else [f"{summary['zero_count']} attention LoRA-up tensors are still zero after the smoke run."],
        "error": ""
        if success
        else (
            f"SDXL validation failed. Missing tokens: {missing_tokens}. Dead tokens with zero nonzero tensors: {dead_tokens}."
        ),
    }


def _validate_anima_model(model_path: Path) -> dict[str, object]:
    tokens = ("q_proj", "k_proj", "v_proj")
    summary = _count_matching_lora_up_weights(model_path, tokens)
    metadata = summary.get("metadata", {})
    metadata_attn_mode = str(metadata.get("ss_attn_mode", "") or "").strip().lower()
    token_summary = summary["token_summary"]
    missing_tokens = [token for token in tokens if token_summary[token]["total"] <= 0]
    dead_tokens = [token for token in tokens if token_summary[token]["nonzero_count"] <= 0]
    success = bool(summary["total_matching_lora_up"] > 0 and not missing_tokens and not dead_tokens)
    if metadata_attn_mode:
        success = success and metadata_attn_mode == "sageattn"

    error = ""
    if not success:
        if summary["total_matching_lora_up"] <= 0 or missing_tokens:
            error = f"Anima export did not contain the expected q_proj/k_proj/v_proj coverage. Missing tokens: {missing_tokens}."
        elif dead_tokens:
            error = f"Anima validation found dead attention branches: {dead_tokens}."
        else:
            error = f"Anima metadata recorded attn_mode={metadata_attn_mode!r}, expected 'sageattn'."

    return {
        "success": success,
        "summary": summary,
        "warnings": [] if summary["zero_count"] == 0 else [f"{summary['zero_count']} attention LoRA-up tensors are still zero after the smoke run."],
        "error": error,
    }


@dataclass(frozen=True)
class FamilySpec:
    family: str
    trainer_file: Path
    required_assets: tuple[Path, ...]
    build_config: Callable[[Path, str, str, str, int, int, str, str], dict[str, object]]
    validate_model: Callable[[Path], dict[str, object]]


def _build_sdxl_config(
    case_dir: Path,
    output_name: str,
    optimizer_type: str,
    scheduler_name: str,
    steps: int,
    seed: int,
    attn_backend: str,
    save_precision: str,
) -> dict[str, object]:
    optimizer_settings = _recommended_optimizer_settings(optimizer_type)
    output_dir = case_dir / "artifacts"
    logging_dir = case_dir / "logs"
    normalized_backend = str(attn_backend).strip().lower() or "sageattn"
    if normalized_backend not in {"sageattn", "sdpa"}:
        raise ValueError(f"Unsupported SDXL attention backend: {attn_backend}")

    config: dict[str, object] = {
        "model_train_type": "sdxl-lora",
        "pretrained_model_name_or_path": str(DEFAULT_SDXL_MODEL),
        "train_data_dir": str(DEFAULT_TRAIN_DATA),
        "prior_loss_weight": 1,
        "resolution": "1024,1024",
        "enable_bucket": True,
        "min_bucket_reso": 256,
        "max_bucket_reso": 1536,
        "bucket_reso_steps": 64,
        "bucket_no_upscale": True,
        "output_name": output_name,
        "output_dir": str(output_dir),
        "save_model_as": "safetensors",
        "save_precision": save_precision,
        "save_every_n_steps": steps,
        "save_state": False,
        "save_state_on_train_end": False,
        "max_train_steps": steps,
        "train_batch_size": 1,
        "gradient_checkpointing": True,
        "gradient_accumulation_steps": 1,
        "network_train_unet_only": True,
        "network_train_text_encoder_only": False,
        "enable_mixed_resolution_training": False,
        "learning_rate": optimizer_settings["learning_rate"],
        "unet_lr": optimizer_settings["unet_lr"],
        "text_encoder_lr": optimizer_settings["text_encoder_lr"],
        "optimizer_type": optimizer_type,
        "optimizer_args": optimizer_settings["optimizer_args"],
        "network_module": "lycoris.kohya",
        "network_dim": 16,
        "network_alpha": 1,
        "dim_from_weights": False,
        "dora_wd": False,
        "randomly_choice_prompt": False,
        "sample_every_n_epochs": 0,
        "sample_at_first": False,
        "log_with": "tensorboard",
        "log_prefix": output_name,
        "log_tracker_name": "sage-matrix",
        "logging_dir": str(logging_dir),
        "validation_split": 0.0,
        "caption_extension": ".txt",
        "shuffle_caption": True,
        "keep_tokens": 1,
        "max_token_length": 255,
        "noise_offset_random_strength": False,
        "ip_noise_gamma_random_strength": False,
        "seed": seed,
        "masked_loss": False,
        "alpha_mask": False,
        "ema_enabled": False,
        "safeguard_enabled": False,
        "no_metadata": False,
        "skip_until_initial_step": False,
        "mixed_precision": "bf16",
        "torch_compile": False,
        "dynamo_backend": "inductor",
        "opt_channels_last": False,
        "xformers": False,
        "sdpa": normalized_backend == "sdpa",
        "lowram": False,
        "cache_latents": True,
        "cache_latents_to_disk": True,
        "cache_text_encoder_outputs": False,
        "cache_text_encoder_outputs_to_disk": False,
        "persistent_data_loader_workers": True,
        "cpu_offload_checkpointing": False,
        "sageattn": normalized_backend == "sageattn",
        "cooldown_poll_seconds": 15,
        "enable_distributed_training": False,
        "num_machines": 1,
        "machine_rank": 0,
        "main_process_port": 29500,
        "sync_config_from_main": True,
        "sync_config_keys_from_main": "*",
        "sync_missing_assets_from_main": True,
        "sync_asset_keys": "pretrained_model_name_or_path,train_data_dir,reg_data_dir,vae,resume",
        "sync_main_toml": "./config/autosave/distributed-main-latest.toml",
        "sync_ssh_port": 22,
        "sync_use_password_auth": False,
        "clear_dataset_npz_before_train": False,
        "network_args": ["conv_dim=16", "conv_alpha=1", "dropout=0.1", "algo=locon"],
    }
    _apply_scheduler_fields(config, scheduler_name)
    return config


def _build_anima_config(
    case_dir: Path,
    output_name: str,
    optimizer_type: str,
    scheduler_name: str,
    steps: int,
    seed: int,
    attn_backend: str,
    save_precision: str,
) -> dict[str, object]:
    optimizer_settings = _recommended_optimizer_settings(optimizer_type)
    output_dir = case_dir / "artifacts"
    logging_dir = case_dir / "logs"
    normalized_backend = str(attn_backend).strip().lower() or "sageattn"
    if normalized_backend not in {"sageattn", "sdpa"}:
        raise ValueError(f"Unsupported Anima attention backend: {attn_backend}")

    config: dict[str, object] = {
        "model_train_type": "anima-lora",
        "pretrained_model_name_or_path": str(DEFAULT_ANIMA_MODEL),
        "vae": str(DEFAULT_ANIMA_VAE),
        "qwen3": str(DEFAULT_ANIMA_QWEN3),
        "train_data_dir": str(DEFAULT_TRAIN_DATA),
        "qwen3_max_token_length": 512,
        "t5_max_token_length": 512,
        "timestep_sampling": "shift",
        "discrete_flow_shift": 3.0,
        "weighting_scheme": "uniform",
        "split_attn": False,
        "resolution": "1024,1024",
        "enable_bucket": True,
        "min_bucket_reso": 256,
        "max_bucket_reso": 2048,
        "bucket_reso_steps": 64,
        "bucket_no_upscale": True,
        "output_name": output_name,
        "output_dir": str(output_dir),
        "save_model_as": "safetensors",
        "save_precision": save_precision,
        "save_every_n_steps": steps,
        "save_state": False,
        "save_state_on_train_end": False,
        "max_train_steps": steps,
        "train_batch_size": 1,
        "gradient_checkpointing": True,
        "gradient_accumulation_steps": 1,
        "network_train_unet_only": True,
        "network_train_text_encoder_only": False,
        "learning_rate": optimizer_settings["learning_rate"],
        "unet_lr": optimizer_settings["unet_lr"],
        "text_encoder_lr": optimizer_settings["text_encoder_lr"],
        "lr_scheduler": "constant",
        "optimizer_type": optimizer_type,
        "optimizer_args": optimizer_settings["optimizer_args"],
        "lora_type": "lora",
        "network_module": "networks.lora_anima",
        "network_dim": 16,
        "network_alpha": 16,
        "network_dropout": 0.1,
        "dim_from_weights": False,
        "scale_weight_norms": 0,
        "train_norm": False,
        "network_args_custom": [],
        "enable_base_weight": False,
        "enable_preview": False,
        "log_with": "tensorboard",
        "log_prefix": output_name,
        "log_tracker_name": "sage-matrix",
        "logging_dir": str(logging_dir),
        "validation_split": 0.0,
        "caption_extension": ".txt",
        "shuffle_caption": False,
        "keep_tokens": 0,
        "caption_tag_dropout_rate": 0.0,
        "prefer_json_caption": False,
        "seed": seed,
        "masked_loss": False,
        "alpha_mask": False,
        "ema_enabled": False,
        "safeguard_enabled": False,
        "no_metadata": False,
        "skip_until_initial_step": False,
        "mixed_precision": "bf16",
        "torch_compile": False,
        "dynamo_backend": "inductor",
        "opt_channels_last": False,
        "lowram": False,
        "cache_latents": True,
        "cache_latents_to_disk": True,
        "cache_text_encoder_outputs": True,
        "cache_text_encoder_outputs_to_disk": True,
        "persistent_data_loader_workers": True,
        "cpu_offload_checkpointing": False,
        "attn_mode": "sageattn" if normalized_backend == "sageattn" else "torch",
        "enable_distributed_training": False,
        "num_machines": 1,
        "machine_rank": 0,
        "main_process_port": 29500,
        "sync_config_from_main": True,
        "sync_config_keys_from_main": "*",
        "sync_missing_assets_from_main": True,
        "sync_asset_keys": "pretrained_model_name_or_path,train_data_dir,reg_data_dir,vae,resume,qwen3,llm_adapter_path,t5_tokenizer_path",
        "sync_main_toml": "./config/autosave/distributed-main-latest.toml",
        "sync_ssh_port": 22,
        "sync_use_password_auth": False,
        "clear_dataset_npz_before_train": False,
    }
    _apply_scheduler_fields(config, scheduler_name)
    return config


FAMILY_SPECS: dict[str, FamilySpec] = {
    "sdxl": FamilySpec(
        family="sdxl",
        trainer_file=REPO_ROOT / "scripts" / "stable" / "sdxl_train_network.py",
        required_assets=(DEFAULT_SDXL_MODEL, DEFAULT_TRAIN_DATA),
        build_config=_build_sdxl_config,
        validate_model=_validate_sdxl_model,
    ),
    "anima": FamilySpec(
        family="anima",
        trainer_file=REPO_ROOT / "scripts" / "stable" / "anima_train_network.py",
        required_assets=(DEFAULT_ANIMA_MODEL, DEFAULT_ANIMA_QWEN3, DEFAULT_ANIMA_VAE, DEFAULT_TRAIN_DATA),
        build_config=_build_anima_config,
        validate_model=_validate_anima_model,
    ),
}


@dataclass(frozen=True)
class CaseDefinition:
    case_index: int
    family: str
    optimizer: str
    scheduler: str
    seed: int

    @property
    def case_id(self) -> str:
        return f"{self.family}__{_slugify(self.optimizer)}__{_slugify(self.scheduler)}__{self.case_index:03d}"


def _run_training(python_exe: str, trainer_file: Path, config_path: Path, timeout_seconds: int) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO_ROOT)
    cmd = [
        python_exe,
        "-m",
        "accelerate.commands.launch",
        "--num_cpu_threads_per_process",
        "1",
        "--quiet",
        str(REPO_ROOT / "mikazuki" / "script_runner.py"),
        str(trainer_file),
        "--config_file",
        str(config_path),
    ]
    return subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
        timeout=timeout_seconds,
    )


def _build_training_command(python_exe: str, trainer_file: Path, config_path: Path) -> tuple[list[str], dict[str, str]]:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(REPO_ROOT)
    cmd = [
        python_exe,
        "-m",
        "accelerate.commands.launch",
        "--num_cpu_threads_per_process",
        "1",
        "--quiet",
        str(REPO_ROOT / "mikazuki" / "script_runner.py"),
        str(trainer_file),
        "--config_file",
        str(config_path),
    ]
    return cmd, env


def _reader_thread(stream, output_queue: "queue.Queue[str]") -> None:
    try:
        for line in iter(stream.readline, ""):
            output_queue.put(line)
    finally:
        try:
            stream.close()
        except Exception:
            pass


def _drain_queue(output_queue: "queue.Queue[str]", target: list[str]) -> None:
    while True:
        try:
            target.append(output_queue.get_nowait())
        except queue.Empty:
            break


def _kill_process_tree(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return

    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            capture_output=True,
            text=True,
            check=False,
        )
    else:
        process.terminate()


def _run_training_until_start(
    python_exe: str,
    trainer_file: Path,
    config_path: Path,
    timeout_seconds: int,
) -> dict[str, object]:
    cmd, env = _build_training_command(python_exe, trainer_file, config_path)
    process = subprocess.Popen(
        cmd,
        cwd=REPO_ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=1,
    )

    stdout_queue: "queue.Queue[str]" = queue.Queue()
    stderr_queue: "queue.Queue[str]" = queue.Queue()
    stdout_chunks: list[str] = []
    stderr_chunks: list[str] = []

    stdout_thread = threading.Thread(target=_reader_thread, args=(process.stdout, stdout_queue), daemon=True)
    stderr_thread = threading.Thread(target=_reader_thread, args=(process.stderr, stderr_queue), daemon=True)
    stdout_thread.start()
    stderr_thread.start()

    matched_marker = ""
    timed_out = False
    error = ""
    started_at = time.time()

    try:
        while True:
            _drain_queue(stdout_queue, stdout_chunks)
            _drain_queue(stderr_queue, stderr_chunks)

            stdout_text = "".join(stdout_chunks)
            stderr_text = "".join(stderr_chunks)
            for marker in STARTUP_SUCCESS_MARKERS:
                if marker in stdout_text or marker in stderr_text:
                    matched_marker = marker
                    break

            if matched_marker:
                break

            returncode = process.poll()
            if returncode is not None:
                break

            if time.time() - started_at >= timeout_seconds:
                timed_out = True
                error = f"Startup probe timed out after {timeout_seconds}s before reaching training start."
                break

            time.sleep(0.2)
    finally:
        if matched_marker or timed_out:
            _kill_process_tree(process)

        try:
            process.wait(timeout=30)
        except Exception:
            _kill_process_tree(process)
            try:
                process.wait(timeout=10)
            except Exception:
                pass

        stdout_thread.join(timeout=2)
        stderr_thread.join(timeout=2)
        _drain_queue(stdout_queue, stdout_chunks)
        _drain_queue(stderr_queue, stderr_chunks)

    if not matched_marker and not timed_out and process.returncode not in (0, None):
        error = "Training subprocess exited before startup marker."

    return {
        "matched_marker": matched_marker,
        "timed_out": timed_out,
        "returncode": process.returncode,
        "duration_seconds": round(time.time() - started_at, 3),
        "stdout": "".join(stdout_chunks),
        "stderr": "".join(stderr_chunks),
        "error": error,
    }


def _ensure_assets(spec: FamilySpec) -> list[str]:
    return [str(path) for path in spec.required_assets if not path.exists()]


def _run_case(
    spec: FamilySpec,
    case: CaseDefinition,
    run_root: Path,
    python_exe: str,
    steps: int,
    timeout_seconds: int,
    attn_backend: str,
    save_precision: str,
    validation_level: str,
) -> dict[str, object]:
    case_dir = run_root / "cases" / case.case_id
    case_dir.mkdir(parents=True, exist_ok=True)

    output_name = case.case_id
    result: dict[str, object] = {
        "case_id": case.case_id,
        "case_index": case.case_index,
        "family": case.family,
        "optimizer": case.optimizer,
        "scheduler": case.scheduler,
        "attn_backend": attn_backend,
        "save_precision": save_precision,
        "validation_level": validation_level,
        "seed": case.seed,
        "status": "failed",
        "success": False,
        "skipped": False,
        "skip_reason": "",
        "case_dir": str(case_dir),
        "config_path": "",
        "model_path": "",
        "train_returncode": None,
        "duration_seconds": None,
        "train_stdout_tail": "",
        "train_stderr_tail": "",
        "dependency_check": {},
        "validation": {},
        "startup_probe": {},
        "error": "",
    }

    config = spec.build_config(case_dir, output_name, case.optimizer, case.scheduler, steps, case.seed, attn_backend, save_precision)
    config_path = case_dir / "config.toml"
    config_path.write_text(toml.dumps(config), encoding="utf-8")
    result["config_path"] = str(config_path)

    missing_assets = _ensure_assets(spec)
    if missing_assets:
        result["status"] = "skipped"
        result["skipped"] = True
        result["skip_reason"] = f"Required assets are missing: {missing_assets}"
        result["error"] = result["skip_reason"]
        _json_dump(case_dir / "result.json", _to_jsonable(result))
        return result

    dependency_check = analyze_training_runtime_dependencies(config)
    result["dependency_check"] = dependency_check
    if not dependency_check.get("ready", False):
        result["status"] = "skipped"
        result["skipped"] = True
        missing_packages = [
            {
                "module_name": record.get("module_name"),
                "required_for": record.get("required_for"),
                "reason": record.get("reason"),
            }
            for record in dependency_check.get("missing", [])
        ]
        result["skip_reason"] = f"Runtime dependency check failed: {missing_packages}"
        result["error"] = result["skip_reason"]
        _json_dump(case_dir / "result.json", _to_jsonable(result))
        return result

    if validation_level == "startup":
        probe = _run_training_until_start(python_exe, spec.trainer_file, config_path, timeout_seconds)
        result["startup_probe"] = {
            "matched_marker": probe["matched_marker"],
            "timed_out": probe["timed_out"],
            "returncode": probe["returncode"],
        }
        result["duration_seconds"] = probe["duration_seconds"]
        result["train_returncode"] = probe["returncode"]
        result["train_stdout_tail"] = _tail_text(str(probe["stdout"]))
        result["train_stderr_tail"] = _tail_text(str(probe["stderr"]))
        (case_dir / "stdout.log").write_text(str(probe["stdout"]), encoding="utf-8")
        (case_dir / "stderr.log").write_text(str(probe["stderr"]), encoding="utf-8")

        if probe["matched_marker"]:
            result["validation"] = {
                "success": True,
                "mode": "startup",
                "marker": probe["matched_marker"],
                "message": "Startup marker reached; training process was intentionally stopped early.",
            }
            result["success"] = True
            result["status"] = "passed"
        else:
            result["error"] = str(probe["error"] or "Startup probe did not reach the training start marker.")
        _json_dump(case_dir / "result.json", _to_jsonable(result))
        return result

    started_at = time.time()
    try:
        completed = _run_training(python_exe, spec.trainer_file, config_path, timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        result["duration_seconds"] = round(time.time() - started_at, 3)
        result["error"] = f"Training timed out after {timeout_seconds}s."
        result["train_stdout_tail"] = _tail_text(exc.stdout or "")
        result["train_stderr_tail"] = _tail_text(exc.stderr or "")
        _json_dump(case_dir / "result.json", _to_jsonable(result))
        return result
    except Exception as exc:
        result["duration_seconds"] = round(time.time() - started_at, 3)
        result["error"] = str(exc)
        _json_dump(case_dir / "result.json", _to_jsonable(result))
        return result

    result["duration_seconds"] = round(time.time() - started_at, 3)
    result["train_returncode"] = completed.returncode
    result["train_stdout_tail"] = _tail_text(completed.stdout)
    result["train_stderr_tail"] = _tail_text(completed.stderr)
    (case_dir / "stdout.log").write_text(completed.stdout, encoding="utf-8")
    (case_dir / "stderr.log").write_text(completed.stderr, encoding="utf-8")

    if completed.returncode != 0:
        result["error"] = "Training subprocess failed."
        _json_dump(case_dir / "result.json", _to_jsonable(result))
        return result

    output_dir = case_dir / "artifacts"
    model_path = _find_saved_model(output_dir, output_name)
    if model_path is None:
        result["error"] = f"Expected output model was not created in {output_dir}"
        _json_dump(case_dir / "result.json", _to_jsonable(result))
        return result

    result["model_path"] = str(model_path)
    validation = spec.validate_model(model_path)
    result["validation"] = validation
    result["success"] = bool(validation.get("success", False))
    result["status"] = "passed" if result["success"] else "failed"
    if not result["success"]:
        result["error"] = str(validation.get("error", "") or "Model validation failed.")

    _json_dump(case_dir / "result.json", _to_jsonable(result))
    return result


def _build_cases(families: list[str], optimizers: list[str], schedulers: list[str], seed_base: int, max_cases: int | None) -> list[CaseDefinition]:
    cases: list[CaseDefinition] = []
    for case_index, (family, optimizer, scheduler) in enumerate(itertools.product(families, optimizers, schedulers), start=1):
        cases.append(
            CaseDefinition(
                case_index=case_index,
                family=family,
                optimizer=optimizer,
                scheduler=scheduler,
                seed=seed_base + case_index - 1,
            )
        )
        if max_cases is not None and len(cases) >= max_cases:
            break
    return cases


def _create_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Matrix smoke-test runner for SageAttention training compatibility.")
    parser.add_argument(
        "--families",
        nargs="+",
        default=["sdxl", "anima"],
        choices=sorted(FAMILY_SPECS.keys()),
        help="Training families to test.",
    )
    parser.add_argument(
        "--optimizers",
        nargs="+",
        default=["auto"],
        help="Optimizer list. Use 'auto' or 'schema' to load choices from mikazuki/schema/shared.ts.",
    )
    parser.add_argument(
        "--schedulers",
        nargs="+",
        default=["constant"],
        help="Scheduler list. Use 'all' to expand all builtin schedulers, or pass a full class path for custom schedulers.",
    )
    parser.add_argument("--steps", type=int, default=8, help="Max train steps for each smoke case.")
    parser.add_argument("--seed-base", type=int, default=2778, help="Base seed used to derive per-case seeds.")
    parser.add_argument("--max-cases", type=int, default=None, help="Optional hard limit for generated cases.")
    parser.add_argument(
        "--output-root",
        type=str,
        default=str(DEFAULT_OUTPUT_ROOT),
        help="Root directory for matrix outputs.",
    )
    parser.add_argument(
        "--python-exe",
        type=str,
        default=sys.executable,
        help="Python executable used to launch training subprocesses.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=3600,
        help="Per-case timeout in seconds.",
    )
    parser.add_argument(
        "--sdxl-attn-backend",
        type=str,
        choices=["sageattn", "sdpa"],
        default="sageattn",
        help="Attention backend used for SDXL cases.",
    )
    parser.add_argument(
        "--anima-attn-backend",
        type=str,
        choices=["sageattn", "sdpa"],
        default="sageattn",
        help="Attention backend used for Anima cases.",
    )
    parser.add_argument(
        "--save-precision",
        type=str,
        choices=["fp16", "float", "bf16"],
        default="fp16",
        help="Model export precision used for the smoke artifact.",
    )
    parser.add_argument(
        "--validation-level",
        type=str,
        choices=["full", "startup"],
        default="full",
        help="Validation depth. 'startup' stops each case once training has clearly started; 'full' runs the complete smoke validation.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Only resolve the case matrix and write no training outputs.")
    parser.add_argument("--list-optimizers", action="store_true", help="Print resolved schema optimizers and exit.")
    parser.add_argument("--list-schedulers", action="store_true", help="Print builtin schedulers and exit.")
    return parser


def main() -> None:
    parser = _create_argument_parser()
    args = parser.parse_args()

    schema_optimizers = _parse_shared_schema_optimizers()
    if args.list_optimizers:
        print(json.dumps({"optimizers": schema_optimizers}, ensure_ascii=False, indent=2))
        return

    if args.list_schedulers:
        print(json.dumps({"schedulers": sorted(BUILTIN_LR_SCHEDULERS)}, ensure_ascii=False, indent=2))
        return

    optimizers = _resolve_requested_optimizers(args.optimizers)
    schedulers = _resolve_requested_schedulers(args.schedulers)
    families = list(args.families)
    cases = _build_cases(families, optimizers, schedulers, args.seed_base, args.max_cases)

    run_stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    run_root = Path(args.output_root) / run_stamp
    run_root.mkdir(parents=True, exist_ok=True)

    summary: dict[str, object] = {
        "success": False,
        "run_root": str(run_root),
        "python_exe": args.python_exe,
        "steps": args.steps,
        "families": families,
        "optimizers": optimizers,
        "schedulers": schedulers,
        "generated_case_count": len(cases),
        "completed_case_count": 0,
        "passed": 0,
        "failed": 0,
        "skipped": 0,
        "cases": [],
        "dry_run": bool(args.dry_run),
    }

    manifest = {
        "run_root": str(run_root),
        "families": families,
        "optimizers": optimizers,
        "schedulers": schedulers,
        "sdxl_attn_backend": args.sdxl_attn_backend,
        "anima_attn_backend": args.anima_attn_backend,
        "save_precision": args.save_precision,
        "validation_level": args.validation_level,
        "steps": args.steps,
        "timeout_seconds": args.timeout_seconds,
        "cases": [_to_jsonable(case.__dict__) | {"case_id": case.case_id} for case in cases],
    }
    _json_dump(run_root / "manifest.json", manifest)
    _print_progress(f"[sage-matrix] run_root={run_root}")
    _print_progress(
        f"[sage-matrix] cases={len(cases)} families={','.join(families)} schedulers={','.join(schedulers)} steps={args.steps}"
    )
    _print_progress(f"[sage-matrix] backends sdxl={args.sdxl_attn_backend} anima={args.anima_attn_backend}")
    _print_progress(f"[sage-matrix] save_precision={args.save_precision}")
    _print_progress(f"[sage-matrix] validation_level={args.validation_level}")

    if args.dry_run:
        summary["success"] = True
        _json_dump(run_root / "summary.json", summary)
        _print_progress("[sage-matrix] dry-run complete")
        print(json.dumps(summary, ensure_ascii=False))
        return

    for case in cases:
        spec = FAMILY_SPECS[case.family]
        attn_backend = args.sdxl_attn_backend if case.family == "sdxl" else args.anima_attn_backend
        _print_progress(
            f"[sage-matrix] start {case.case_index}/{len(cases)} "
            f"family={case.family} optimizer={case.optimizer} scheduler={case.scheduler} attn={attn_backend} seed={case.seed}"
        )
        result = _run_case(
            spec,
            case,
            run_root,
            args.python_exe,
            args.steps,
            args.timeout_seconds,
            attn_backend,
            args.save_precision,
            args.validation_level,
        )
        summary["cases"].append(result)
        summary["completed_case_count"] = int(summary["completed_case_count"]) + 1
        if result.get("skipped"):
            summary["skipped"] = int(summary["skipped"]) + 1
        elif result.get("success"):
            summary["passed"] = int(summary["passed"]) + 1
        else:
            summary["failed"] = int(summary["failed"]) + 1
        _json_dump(run_root / "summary.json", _to_jsonable(summary))
        duration = result.get("duration_seconds")
        duration_text = f"{duration:.1f}s" if isinstance(duration, (int, float)) else "n/a"
        if result.get("skipped"):
            detail = str(result.get("skip_reason", "") or result.get("error", "") or "skipped")
        elif result.get("success"):
            warnings = result.get("validation", {}).get("warnings", [])
            detail = "passed"
            if warnings:
                detail += f" with warnings: {warnings[0]}"
        else:
            detail = str(result.get("error", "") or "failed")
        _print_progress(
            f"[sage-matrix] done  {case.case_index}/{len(cases)} status={result.get('status')} "
            f"duration={duration_text} passed={summary['passed']} failed={summary['failed']} skipped={summary['skipped']} "
            f"detail={detail}"
        )

    summary["success"] = int(summary["failed"]) == 0
    _json_dump(run_root / "summary.json", _to_jsonable(summary))
    _print_progress(
        f"[sage-matrix] finished passed={summary['passed']} failed={summary['failed']} skipped={summary['skipped']}"
    )
    print(json.dumps(_to_jsonable(summary), ensure_ascii=False))

    if not summary["success"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
