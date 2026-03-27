from __future__ import annotations

import os
from copy import deepcopy
from dataclasses import asdict
from pathlib import Path
from typing import Optional

from mikazuki.launch_utils import base_dir_path
from mikazuki.log import log
from mikazuki.utils import train_utils
from mikazuki.utils.dataset_cache_preflight import analyze_dataset_cache_preflight
from mikazuki.utils.dataset_analysis import analyze_dataset
from mikazuki.utils.distributed import resolve_distributed_runtime
from mikazuki.utils.distributed_sync import resolve_worker_sync_runtime
from mikazuki.utils.mixed_resolution import (
    build_mixed_resolution_plan,
    build_mixed_resolution_summary_text,
)
from mikazuki.utils.resume_guard import validate_resume_launch_guard
from mikazuki.utils.runtime_dependencies import analyze_training_runtime_dependencies
from mikazuki.utils.tensorboard_runs import apply_tensorboard_runtime_config


def parse_boolish(value) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"", "0", "false", "no", "off", "none", "null"}:
            return False
        if normalized in {"1", "true", "yes", "on"}:
            return True
    return bool(value)


def add_anima_preflight_guidance(payload: dict, training_type: str, errors: list[str], warnings: list[str], notes: list[str]) -> None:
    if not training_type.startswith("anima"):
        return

    qwen3_path = str(payload.get("qwen3", "")).strip()
    if not qwen3_path:
        errors.append("qwen3 is required for Anima training. / Anima 训练必须填写 Qwen3 文本模型路径。")
    elif not os.path.exists(qwen3_path):
        errors.append(f"Qwen3 path does not exist: {qwen3_path}")
    elif os.path.isdir(qwen3_path):
        notes.append("Qwen3 resource: using a local model directory.")
    else:
        notes.append("Qwen3 resource: using a single checkpoint file with bundled local configs.")

    vae_path = str(payload.get("vae", "")).strip()
    if not vae_path:
        errors.append(f"vae is required for {training_type}. / {training_type} 必须填写 VAE 路径。")
    elif not os.path.exists(vae_path):
        errors.append(f"VAE path does not exist: {vae_path}")
    elif not os.path.isfile(vae_path):
        errors.append(f"VAE path must point to a model file, not a directory: {vae_path}")
    else:
        notes.append("Anima VAE path detected.")

    llm_adapter_path = str(payload.get("llm_adapter_path", "")).strip()
    if llm_adapter_path:
        if not os.path.exists(llm_adapter_path):
            errors.append(f"LLM Adapter path does not exist: {llm_adapter_path}")
        else:
            notes.append("External LLM Adapter path detected. It will override adapter weights inside the checkpoint.")

    t5_tokenizer_path = str(payload.get("t5_tokenizer_path", "")).strip()
    if t5_tokenizer_path:
        if not os.path.exists(t5_tokenizer_path):
            errors.append(f"T5 tokenizer path does not exist: {t5_tokenizer_path}")
        else:
            notes.append("Custom T5 tokenizer path detected.")
    else:
        notes.append("T5 tokenizer path left empty; Anima will fall back to the bundled configs/t5_old tokenizer if available.")

    custom_attributes = payload.get("custom_attributes")
    prefer_json_caption = False
    if isinstance(custom_attributes, dict):
        prefer_json_caption = parse_boolish(custom_attributes.get("prefer_json_caption"))
    if not prefer_json_caption:
        prefer_json_caption = parse_boolish(payload.get("prefer_json_caption"))

    if prefer_json_caption:
        notes.append("Anima JSON caption priority is enabled. Same-name .json tags will be preferred before caption_extension fallback.")

    inline_sample_prompts = str(payload.get("sample_prompts", "")).strip()
    if inline_sample_prompts and "\n" in inline_sample_prompts:
        notes.append("Multi-prompt preview rotation detected. Inline sample_prompts will be written to a temporary prompt file at launch.")

    sample_scheduler = str(payload.get("sample_scheduler", "")).strip().lower()
    if sample_scheduler and sample_scheduler != "simple":
        warnings.append("Anima preview scheduler currently falls back to simple. / 当前 Anima 预览调度器仅支持 simple，其他值会自动回退。")

    if training_type == "anima-lora":
        network_module = str(payload.get("network_module", "")).strip().lower()
        if network_module == "lycoris.kohya":
            notes.append("Anima adapter mode: LoKr / LyCORIS.")
        else:
            notes.append("Anima adapter mode: LoRA.")


def analyze_training_preflight(
    config: dict,
    *,
    training_type: str,
    trainer_supported: bool,
    conditioning_required: bool,
    sample_prompt_builder,
    attention_fallback_checker,
) -> dict:
    payload = deepcopy(config)
    train_utils.fix_config_types(payload)

    errors: list[str] = []
    warnings: list[str] = []
    notes: list[str] = []

    train_data_dir = str(payload.get("train_data_dir", "")).strip()
    conditioning_data_dir = str(payload.get("conditioning_data_dir", "")).strip()
    resume_path = str(payload.get("resume", "")).strip()
    model_path = str(payload.get("pretrained_model_name_or_path", "")).strip()
    raw_gpu_ids = payload.get("gpu_ids")
    gpu_ids = [str(item) for item in raw_gpu_ids] if isinstance(raw_gpu_ids, list) else []
    distributed_runtime = None
    worker_sync_runtime = None

    if not trainer_supported:
        errors.append(f"Unsupported trainer type: {training_type}")

    dataset_summary = None
    if train_data_dir:
        try:
            dataset_report = analyze_dataset(train_data_dir, caption_extension=str(payload.get("caption_extension", ".txt")))
            dataset_summary = summarize_dataset_report(dataset_report)
            warnings.extend(dataset_report.get("warnings", []))
        except ValueError as exc:
            errors.append(str(exc))
        except Exception as exc:
            log.warning(f"Training preflight dataset analysis failed: {exc}")
            warnings.append("Dataset analysis could not complete during preflight.")
    else:
        errors.append("train_data_dir is empty.")

    conditioning_summary = None
    if conditioning_required:
        if not conditioning_data_dir:
            errors.append("conditioning_data_dir is required for this training type.")
        else:
            try:
                conditioning_report = analyze_dataset(conditioning_data_dir, caption_extension=str(payload.get("caption_extension", ".txt")))
                conditioning_summary = summarize_dataset_report(conditioning_report)
                warnings.extend([f"Conditioning dataset: {message}" for message in conditioning_report.get("warnings", [])])
            except ValueError as exc:
                errors.append(str(exc))
            except Exception as exc:
                log.warning(f"Training preflight conditioning dataset analysis failed: {exc}")
                warnings.append("Conditioning dataset analysis could not complete during preflight.")

    if model_path:
        validated, message = train_utils.validate_model(model_path, training_type)
        if not validated:
            errors.append(message or "Pretrained model validation failed.")
    else:
        errors.append("pretrained_model_name_or_path is empty.")

    if resume_path:
        if not os.path.exists(resume_path):
            errors.append("Resume path does not exist.")
        elif not os.path.isdir(resume_path):
            warnings.append("Resume path exists but is not a directory. Confirm this is a valid save_state folder.")
        else:
            notes.append(f"Resume path detected: {resume_path}")

    try:
        guard_ok, guard_message = validate_resume_launch_guard(payload, base_dir_path())
    except Exception as exc:
        log.warning(f"Training preflight resume guard failed: {exc}")
        warnings.append("Resume/output guard could not complete during preflight.")
    else:
        if not guard_ok:
            errors.append(guard_message)

    raw_validation_split = payload.get("validation_split", 0)
    try:
        validation_split = float(raw_validation_split or 0)
    except (TypeError, ValueError):
        validation_split = 0.0
        errors.append("validation_split must be a float value between 0 and 1. / validation_split 必须是 0 到 1 之间的浮点数。")

    if validation_split < 0 or validation_split > 1:
        errors.append("validation_split must be between 0 and 1. / validation_split 必须在 0 到 1 之间。")
    elif validation_split > 0:
        notes.append(f"Validation split enabled at {validation_split:.2%}.")
        if validation_split < 0.05:
            warnings.append("Validation split is very small and may produce noisy validation feedback.")
        if validation_split > 0.4:
            warnings.append("Validation split is large and may reduce the amount of actual training data too much.")

    if training_type.startswith("sdxl") and payload.get("clip_skip") not in (None, "", 0):
        warnings.append(
            "SDXL clip_skip is experimental in this build. Training and inference should use the same SDXL clip-skip behavior."
        )

    if training_type.startswith("sdxl") and bool(payload.get("sageattn")):
        warnings.append(
            "SDXL SageAttention is experimental in this build and requires the SageAttention runtime. / "
            "当前构建中的 SDXL SageAttention 仍属实验功能，并且需要 SageAttention 专用环境。"
        )

    if bool(payload.get("torch_compile")):
        backend = str(payload.get("dynamo_backend", "inductor") or "inductor").strip() or "inductor"
        notes.append(
            f"torch.compile enabled with backend '{backend}'. The first launch and first few steps may be slower while graphs compile."
        )

    if bool(payload.get("opt_channels_last")):
        notes.append("channels_last optimization is enabled.")
        if training_type.startswith(("flux", "sd3", "anima", "lumina", "hunyuan")):
            warnings.append(
                "channels_last mainly helps convolution-heavy U-Net routes such as SD1.5 / SDXL / ControlNet. "
                "The current trainer is more transformer-heavy, so the speed gain may be limited."
            )

    add_anima_preflight_guidance(payload, training_type, errors, warnings, notes)

    if bool(payload.get("masked_loss")):
        alpha_candidates = int(dataset_summary.get("alpha_capable_image_count", 0)) if dataset_summary else 0
        if alpha_candidates == 0 and train_data_dir:
            alpha_candidates = count_alpha_candidate_images(train_data_dir)
        notes.append(f"Masked loss enabled. Alpha-capable image candidates found: {alpha_candidates}.")
        if not bool(payload.get("alpha_mask")) and not conditioning_data_dir:
            warnings.append(
                "masked_loss is enabled, but alpha_mask is off. For ordinary alpha-channel datasets this often behaves like a no-op unless another mask source is present."
            )
        if alpha_candidates == 0:
            warnings.append("masked_loss is enabled, but the dataset does not appear to contain obvious alpha-capable image files.")

    if bool(payload.get("alpha_mask")):
        alpha_candidates = int(dataset_summary.get("alpha_capable_image_count", 0)) if dataset_summary else 0
        notes.append("alpha_mask is enabled, so image alpha channels will be loaded as loss masks when available.")
        if alpha_candidates == 0:
            warnings.append("alpha_mask is enabled, but the dataset does not appear to contain obvious PNG/WebP alpha candidates.")

    if bool(payload.get("save_state")):
        notes.append("save_state is enabled, so future resume points should be produced during training.")
    elif resume_path:
        notes.append("Resume is configured from an existing state, but the current run is not set to save new state snapshots.")

    if bool(payload.get("clear_dataset_npz_before_train")):
        notes.append("clear_dataset_npz_before_train is enabled, so train/reg dataset .npz caches will be cleared before launch.")

    try:
        distributed_runtime = resolve_distributed_runtime(payload, gpu_ids)
    except ValueError as exc:
        errors.append(str(exc))
    except Exception as exc:
        log.warning(f"Training preflight distributed runtime analysis failed: {exc}")
        warnings.append("Distributed runtime analysis could not complete during preflight.")
    else:
        warnings.extend(distributed_runtime.get("warnings", []))
        notes.extend(distributed_runtime.get("notes", []))
        if int(distributed_runtime.get("total_num_processes", 1) or 1) > 1:
            notes.append("当前为多进程/分布式训练：train_batch_size 将按全局 batch 解释，启动时会自动换算成每卡 batch。")
        try:
            worker_sync_runtime = resolve_worker_sync_runtime(payload, distributed_runtime, base_dir_path())
        except ValueError as exc:
            errors.append(str(exc))
        except Exception as exc:
            log.warning(f"Training preflight worker sync analysis failed: {exc}")
            warnings.append("Worker sync analysis could not complete during preflight.")
        else:
            warnings.extend(worker_sync_runtime.get("warnings", []))
            notes.extend(worker_sync_runtime.get("notes", []))

    try:
        tensorboard_runtime = apply_tensorboard_runtime_config(payload, base_dir_path())
    except Exception as exc:
        log.warning(f"Training preflight tensorboard runtime analysis failed: {exc}")
        warnings.append("TensorBoard run directory analysis could not complete during preflight.")
    else:
        if tensorboard_runtime.get("enabled") and tensorboard_runtime.get("run_dir") is not None:
            notes.append(f"TensorBoard 日志预计写入: {tensorboard_runtime['run_dir']}")
            if tensorboard_runtime.get("reused_from_state"):
                notes.append("TensorBoard 将沿用 resume state 中记录的原日志目录。")
            elif tensorboard_runtime.get("resume_merge"):
                notes.append("TensorBoard 将复用当前模型最近一次已有的日志目录。")
            else:
                notes.append("TensorBoard 将创建新的日志运行目录。")

    mixed_resolution = None
    try:
        mixed_resolution_payload = dict(payload)
        if distributed_runtime is not None:
            mixed_resolution_payload["num_processes"] = int(distributed_runtime.get("total_num_processes", 1) or 1)
        mixed_resolution = build_mixed_resolution_plan(mixed_resolution_payload, training_type=training_type)
        if mixed_resolution.enabled:
            notes.append(build_mixed_resolution_summary_text(mixed_resolution))
    except ValueError as exc:
        errors.append(str(exc))
    except Exception as exc:
        log.warning(f"Training preflight mixed-resolution analysis failed: {exc}")
        warnings.append("Mixed-resolution planning could not complete during preflight.")

    cache_preflight = None
    try:
        cache_preflight = analyze_dataset_cache_preflight(payload, training_type=training_type)
        errors.extend(cache_preflight.get("errors", []))
        warnings.extend(cache_preflight.get("warnings", []))
        notes.extend(cache_preflight.get("notes", []))
    except Exception as exc:
        log.warning(f"Training preflight cache analysis failed: {exc}")
        warnings.append("Dataset cache audit could not complete during preflight.")

    sample_prompt = None
    try:
        sample_prompt = sample_prompt_builder(payload)
        if sample_prompt:
            warnings.extend([str(item) for item in sample_prompt.get("warnings", []) if str(item).strip()])
            notes.extend([str(item) for item in sample_prompt.get("notes", []) if str(item).strip()])
            if sample_prompt.get("warning"):
                warnings.append(str(sample_prompt["warning"]))
    except ValueError as exc:
        warnings.append(str(exc))
    except Exception as exc:
        log.warning(f"Training preflight sample prompt preview failed: {exc}")
        warnings.append("Sample prompt preview could not be generated.")

    attention_warning = attention_fallback_checker(payload)
    if attention_warning:
        warnings.append(attention_warning)

    dependency_report = analyze_training_runtime_dependencies(payload)
    for dependency in dependency_report["missing"]:
        package_label = dependency["display_name"]
        requirement = ", ".join(dependency.get("required_for", []))
        reason = dependency.get("reason") or "Package is not importable in the active runtime."
        errors.append(
            f"Required runtime dependency {package_label} is unavailable ({requirement}): {reason}"
        )

    for dependency in dependency_report["required"]:
        if dependency["importable"]:
            version = dependency.get("version") or "unknown"
            notes.append(
                f"{dependency['display_name']} {version} is ready for {', '.join(dependency.get('required_for', []))}."
            )

    return {
        "training_type": training_type,
        "can_start": len(errors) == 0,
        "errors": dedupe_strings(errors),
        "warnings": dedupe_strings(warnings),
        "notes": dedupe_strings(notes),
        "dataset": dataset_summary,
        "conditioning_dataset": conditioning_summary,
        "distributed": distributed_runtime,
        "distributed_sync": worker_sync_runtime,
        "mixed_resolution": asdict(mixed_resolution) if mixed_resolution is not None else None,
        "cache": cache_preflight,
        "sample_prompt": sample_prompt,
        "dependencies": dependency_report,
    }


def summarize_dataset_report(report: dict) -> dict:
    summary = report.get("summary", {})
    return {
        "path": report.get("root_path", ""),
        "scan_mode": report.get("scan_mode", ""),
        "image_count": int(summary.get("image_count", 0)),
        "effective_image_count": int(summary.get("effective_image_count", 0)),
        "alpha_capable_image_count": int(summary.get("alpha_capable_image_count", 0)),
        "caption_coverage": float(summary.get("caption_coverage", 0)),
        "dataset_folder_count": int(summary.get("dataset_folder_count", 0)),
        "images_without_caption_count": int(summary.get("images_without_caption_count", 0)),
        "broken_image_count": int(summary.get("broken_image_count", 0)),
    }


def count_alpha_candidate_images(path: str) -> int:
    if not path or not os.path.isdir(path):
        return 0
    root = Path(path)
    count = 0
    for image_path in root.rglob("*"):
        if not image_path.is_file():
            continue
        if image_path.suffix.lower() in {".png", ".webp"}:
            count += 1
    return count


def dedupe_strings(items: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result
