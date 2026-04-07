from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def _setup_repo_paths() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    stable_root = repo_root / "scripts" / "stable"
    for path in (repo_root, stable_root):
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)
    return repo_root


def _default_paths(repo_root: Path) -> dict[str, Path]:
    return {
        "model": repo_root / "models" / "silentEraFurrymixNAIXL_v10.safetensors",
        "train_data": repo_root / "sucai" / "6_lulu",
        "logs_dir": repo_root / "tmp" / "logs",
        "output_root": repo_root / "tmp" / "selftests",
    }


def _build_config_text(repo_root: Path, output_dir: Path) -> str:
    paths = _default_paths(repo_root)
    return f"""model_train_type = "sdxl-lora"
pretrained_model_name_or_path = "{paths["model"].as_posix()}"
train_data_dir = "{paths["train_data"].as_posix()}"
prior_loss_weight = 1
resolution = "1024,1024"
enable_bucket = true
min_bucket_reso = 256
max_bucket_reso = 1536
bucket_reso_steps = 64
bucket_no_upscale = true
output_name = "sdxl-sage-locon-smoke"
output_dir = "{output_dir.as_posix()}"
save_model_as = "safetensors"
save_precision = "fp16"
save_every_n_steps = 12
save_state = false
save_state_on_train_end = false
max_train_steps = 12
train_batch_size = 1
gradient_checkpointing = true
gradient_accumulation_steps = 1
network_train_unet_only = true
network_train_text_encoder_only = false
enable_mixed_resolution_training = false
learning_rate = 1
unet_lr = 1
text_encoder_lr = 1
lr_scheduler = "constant"
lr_scheduler_args = [ ]
lr_warmup_steps = 0
optimizer_type = "Prodigy"
network_module = "lycoris.kohya"
network_dim = 16
network_alpha = 1
dim_from_weights = false
dora_wd = false
randomly_choice_prompt = false
sample_every_n_epochs = 0
sample_at_first = false
log_with = "tensorboard"
log_prefix = "sdxl-sage-locon-smoke"
log_tracker_name = "locon"
logging_dir = "{paths["logs_dir"].as_posix()}"
validation_split = 0.0
caption_extension = ".txt"
shuffle_caption = true
keep_tokens = 1
max_token_length = 255
noise_offset_random_strength = false
ip_noise_gamma_random_strength = false
seed = 2778
masked_loss = false
alpha_mask = false
ema_enabled = false
safeguard_enabled = false
no_metadata = false
skip_until_initial_step = false
mixed_precision = "bf16"
torch_compile = false
dynamo_backend = "inductor"
opt_channels_last = false
xformers = false
sdpa = false
lowram = false
cache_latents = true
cache_latents_to_disk = true
cache_text_encoder_outputs = false
cache_text_encoder_outputs_to_disk = false
persistent_data_loader_workers = true
cpu_offload_checkpointing = false
sageattn = true
cooldown_poll_seconds = 15
enable_distributed_training = false
num_machines = 1
machine_rank = 0
main_process_port = 29500
sync_config_from_main = true
sync_config_keys_from_main = "*"
sync_missing_assets_from_main = true
sync_asset_keys = "pretrained_model_name_or_path,train_data_dir,reg_data_dir,vae,resume"
sync_main_toml = "./config/autosave/distributed-main-latest.toml"
sync_ssh_port = 22
sync_use_password_auth = false
clear_dataset_npz_before_train = false
network_args = [ "conv_dim=16", "conv_alpha=1", "dropout=0.1", "algo=locon" ]
optimizer_args = [
  "decouple=True",
  "weight_decay=0.01",
  "use_bias_correction=True",
  "d_coef=2.0"
]
"""


def _count_attn_qkv_weights(model_path: Path) -> dict[str, object]:
    from safetensors import safe_open

    zero_names: list[str] = []
    nonzero_names: list[str] = []
    total = 0

    with safe_open(str(model_path), framework="pt", device="cpu") as handle:
        for name in handle.keys():
            if not name.endswith("lora_up.weight"):
                continue
            if not any(token in name for token in ("to_q", "to_k", "to_v")):
                continue

            total += 1
            tensor = handle.get_tensor(name)
            if bool((tensor == 0).all().item()):
                if len(zero_names) < 12:
                    zero_names.append(name)
            else:
                if len(nonzero_names) < 12:
                    nonzero_names.append(name)

    return {
        "total_attn_qkv_lora_up": total,
        "zero_count": len(zero_names),
        "nonzero_count": total - len(zero_names),
        "zero_examples": zero_names,
        "nonzero_examples": nonzero_names,
    }


def _run_training(repo_root: Path, config_path: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(repo_root)

    cmd = [
        sys.executable,
        "-m",
        "accelerate.commands.launch",
        "--num_cpu_threads_per_process",
        "1",
        "--quiet",
        str(repo_root / "mikazuki" / "script_runner.py"),
        str(repo_root / "scripts" / "stable" / "sdxl_train_network.py"),
        "--config_file",
        str(config_path),
    ]

    return subprocess.run(
        cmd,
        cwd=repo_root,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def main() -> None:
    repo_root = _setup_repo_paths()
    paths = _default_paths(repo_root)

    result: dict[str, object] = {
        "success": False,
        "config_path": "",
        "output_dir": "",
        "model_path": "",
        "train_returncode": None,
        "train_stdout_tail": "",
        "train_stderr_tail": "",
        "attn_qkv_summary": {},
        "error": "",
    }

    try:
        missing = [str(path) for path in (paths["model"], paths["train_data"]) if not path.exists()]
        if missing:
            result["error"] = f"Required smoke-test assets are missing: {missing}"
            print(json.dumps(result, ensure_ascii=False))
            return

        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output_dir = paths["output_root"] / f"sdxl-sage-locon-{timestamp}"
        output_dir.mkdir(parents=True, exist_ok=True)
        config_path = output_dir / "sdxl_sage_locon_smoke.toml"
        config_path.write_text(_build_config_text(repo_root, output_dir), encoding="utf-8")

        result["config_path"] = str(config_path)
        result["output_dir"] = str(output_dir)

        completed = _run_training(repo_root, config_path)
        result["train_returncode"] = completed.returncode
        result["train_stdout_tail"] = "\n".join(completed.stdout.splitlines()[-40:])
        result["train_stderr_tail"] = "\n".join(completed.stderr.splitlines()[-40:])

        if completed.returncode != 0:
            result["error"] = "Training subprocess failed."
            print(json.dumps(result, ensure_ascii=False))
            return

        model_path = output_dir / "sdxl-sage-locon-smoke.safetensors"
        result["model_path"] = str(model_path)
        if not model_path.exists():
            result["error"] = f"Expected model was not created: {model_path}"
            print(json.dumps(result, ensure_ascii=False))
            return

        summary = _count_attn_qkv_weights(model_path)
        result["attn_qkv_summary"] = summary
        result["success"] = bool(
            summary["total_attn_qkv_lora_up"] > 0 and summary["zero_count"] == 0
        )
        if not result["success"]:
            result["error"] = "attn_qkv weights still contain all-zero LoRA-up tensors."
    except Exception as exc:
        result["error"] = str(exc)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
