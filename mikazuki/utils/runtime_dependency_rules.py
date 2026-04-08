from __future__ import annotations

from mikazuki.utils.runtime_mode import infer_runtime_environment_name, is_amd_rocm_runtime, is_intel_xpu_runtime


BUILTIN_LR_SCHEDULERS = {
    "linear",
    "cosine",
    "cosine_with_restarts",
    "polynomial",
    "constant",
    "constant_with_warmup",
}

CUSTOM_SCHEDULER_PREFIX = "__custom__:"


def append_requirement(target: dict[str, list[str]], module_name: str, reason: str) -> None:
    if module_name not in target:
        target[module_name] = []
    if reason not in target[module_name]:
        target[module_name].append(reason)


def config_flag_enabled(value) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def add_optimizer_requirement(target: dict[str, list[str]], optimizer_type: str) -> None:
    if not optimizer_type:
        return

    normalized = optimizer_type.strip()
    lower_name = normalized.lower()
    runtime_name = infer_runtime_environment_name()
    if (is_amd_rocm_runtime(runtime_name) or is_intel_xpu_runtime(runtime_name)) and lower_name.startswith("pytorch_optimizer."):
        return

    if "." in normalized:
        module_name = normalized.split(".", 1)[0]
        append_requirement(target, module_name, f"optimizer_type={normalized}")
        return

    if normalized == "Lion":
        append_requirement(target, "lion_pytorch", f"optimizer_type={normalized}")
    elif normalized == "AdaFactor":
        append_requirement(target, "transformers", f"optimizer_type={normalized}")
    elif lower_name.endswith("8bit"):
        append_requirement(target, "bitsandbytes", f"optimizer_type={normalized}")
    elif lower_name.startswith("dadapt"):
        append_requirement(target, "dadaptation", f"optimizer_type={normalized}")
    elif normalized == "Prodigy":
        append_requirement(target, "prodigyopt", f"optimizer_type={normalized}")
    elif lower_name.endswith("schedulefree"):
        append_requirement(target, "schedulefree", f"optimizer_type={normalized}")


def add_scheduler_requirement(target: dict[str, list[str]], scheduler_type: str) -> None:
    normalized = scheduler_type.strip()
    if not normalized:
        return

    if normalized.startswith(CUSTOM_SCHEDULER_PREFIX):
        normalized = normalized[len(CUSTOM_SCHEDULER_PREFIX):]

    if normalized in BUILTIN_LR_SCHEDULERS or "." not in normalized:
        return

    module_name = normalized.split(".", 1)[0]
    append_requirement(target, module_name, f"lr_scheduler_type={normalized}")


def add_attention_requirement(target: dict[str, list[str]], config: dict) -> None:
    attn_mode = str(config.get("attn_mode", "")).strip().lower()
    if attn_mode == "sageattn":
        append_requirement(target, "sageattention", "attn_mode=sageattn")
        return

    if config_flag_enabled(config.get("use_sage_attn")):
        append_requirement(target, "sageattention", "use_sage_attn=true")
    if config_flag_enabled(config.get("sageattn")):
        append_requirement(target, "sageattention", "sageattn=true")


def add_network_module_requirement(target: dict[str, list[str]], config: dict) -> None:
    network_module = str(config.get("network_module", "")).strip()
    if not network_module:
        return

    if network_module.lower().startswith("lycoris."):
        append_requirement(target, "lycoris", f"network_module={network_module}")


def add_anima_requirement(target: dict[str, list[str]], config: dict) -> None:
    model_train_type = str(config.get("model_train_type", "")).strip().lower()
    if not model_train_type.startswith("anima"):
        return

    append_requirement(target, "safetensors", f"model_train_type={model_train_type}")
    append_requirement(target, "sentencepiece", f"model_train_type={model_train_type}")


def add_yolo_requirement(target: dict[str, list[str]], config: dict) -> None:
    model_train_type = str(config.get("model_train_type", "")).strip().lower()
    if model_train_type != "yolo":
        return

    for module_name in (
        "cv2",
        "matplotlib",
        "scipy",
        "polars",
        "requests",
        "psutil",
        "torchvision",
        "PIL",
        "yaml",
    ):
        append_requirement(target, module_name, f"model_train_type={model_train_type}")


def add_aesthetic_requirement(target: dict[str, list[str]], config: dict) -> None:
    model_train_type = str(config.get("model_train_type", "")).strip().lower()
    if model_train_type != "aesthetic-scorer":
        return

    for module_name in (
        "open_clip",
        "timm",
        "transformers",
        "safetensors",
        "PIL",
        "tqdm",
    ):
        append_requirement(target, module_name, f"model_train_type={model_train_type}")


def collect_training_dependency_requirements(config: dict) -> dict[str, list[str]]:
    requirements: dict[str, list[str]] = {}
    add_optimizer_requirement(requirements, str(config.get("optimizer_type", "")).strip())
    add_scheduler_requirement(requirements, str(config.get("lr_scheduler_type", "")).strip())
    add_attention_requirement(requirements, config)
    add_network_module_requirement(requirements, config)
    add_anima_requirement(requirements, config)
    add_yolo_requirement(requirements, config)
    add_aesthetic_requirement(requirements, config)
    return requirements
