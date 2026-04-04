from __future__ import annotations

import importlib
import importlib.util
import sys
from importlib import metadata
from typing import Iterable


PACKAGE_REGISTRY = {
    "accelerate": {
        "package_name": "accelerate",
        "display_name": "accelerate",
        "required_by_default": True,
    },
    "torch": {
        "package_name": "torch",
        "display_name": "PyTorch",
        "required_by_default": True,
    },
    "fastapi": {
        "package_name": "fastapi",
        "display_name": "FastAPI",
        "required_by_default": True,
    },
    "toml": {
        "package_name": "toml",
        "display_name": "toml",
        "required_by_default": True,
    },
    "lion_pytorch": {
        "package_name": "lion-pytorch",
        "display_name": "lion-pytorch",
        "required_by_default": True,
    },
    "dadaptation": {
        "package_name": "dadaptation",
        "display_name": "dadaptation",
        "required_by_default": True,
    },
    "schedulefree": {
        "package_name": "schedulefree",
        "display_name": "schedulefree",
        "required_by_default": True,
    },
    "prodigyopt": {
        "package_name": "prodigyopt",
        "display_name": "prodigyopt",
        "required_by_default": True,
    },
    "prodigyplus": {
        "package_name": "prodigy-plus-schedule-free",
        "display_name": "prodigyplus",
        "required_by_default": True,
    },
    "pytorch_optimizer": {
        "package_name": "pytorch-optimizer",
        "display_name": "pytorch-optimizer",
        "required_by_default": True,
    },
    "lycoris": {
        "package_name": "lycoris-lora",
        "display_name": "lycoris-lora",
        "required_by_default": False,
    },
    "safetensors": {
        "package_name": "safetensors",
        "display_name": "safetensors",
        "required_by_default": True,
    },
    "sentencepiece": {
        "package_name": "sentencepiece",
        "display_name": "sentencepiece",
        "required_by_default": False,
    },
    "sageattention": {
        "package_name": "sageattention",
        "display_name": "sageattention",
        "required_by_default": False,
    },
    "bitsandbytes": {
        "package_name": "bitsandbytes",
        "display_name": "bitsandbytes",
        "required_by_default": False,
    },
    "transformers": {
        "package_name": "transformers",
        "display_name": "transformers",
        "required_by_default": True,
    },
    "diffusers": {
        "package_name": "diffusers",
        "display_name": "diffusers",
        "required_by_default": True,
    },
    "requests": {
        "package_name": "requests",
        "display_name": "requests",
        "required_by_default": False,
    },
    "psutil": {
        "package_name": "psutil",
        "display_name": "psutil",
        "required_by_default": False,
    },
    "cv2": {
        "package_name": "opencv-python",
        "display_name": "opencv-python",
        "required_by_default": False,
    },
    "matplotlib": {
        "package_name": "matplotlib",
        "display_name": "matplotlib",
        "required_by_default": False,
    },
    "scipy": {
        "package_name": "scipy",
        "display_name": "scipy",
        "required_by_default": False,
    },
    "polars": {
        "package_name": "polars",
        "display_name": "polars",
        "required_by_default": False,
    },
    "torchvision": {
        "package_name": "torchvision",
        "display_name": "torchvision",
        "required_by_default": False,
    },
    "open_clip": {
        "package_name": "open-clip-torch",
        "display_name": "open-clip-torch",
        "required_by_default": False,
    },
    "timm": {
        "package_name": "timm",
        "display_name": "timm",
        "required_by_default": False,
    },
    "tqdm": {
        "package_name": "tqdm",
        "display_name": "tqdm",
        "required_by_default": False,
    },
    "yaml": {
        "package_name": "PyYAML",
        "display_name": "PyYAML",
        "required_by_default": False,
    },
    "PIL": {
        "package_name": "Pillow",
        "display_name": "Pillow",
        "required_by_default": False,
    },
    "thop": {
        "package_name": "ultralytics-thop",
        "display_name": "ultralytics-thop",
        "required_by_default": False,
    },
}

BUILTIN_LR_SCHEDULERS = {
    "linear",
    "cosine",
    "cosine_with_restarts",
    "polynomial",
    "constant",
    "constant_with_warmup",
}

CUSTOM_SCHEDULER_PREFIX = "__custom__:"


def _short_exc_message(exc: Exception) -> str:
    message = str(exc).strip()
    if not message:
        return exc.__class__.__name__
    return message.splitlines()[0]


def _metadata_version(package_name: str) -> str | None:
    try:
        return metadata.version(package_name)
    except metadata.PackageNotFoundError:
        return None


def _infer_environment_name() -> str:
    executable = sys.executable.replace("\\", "/").lower()
    if "/python_blackwell/" in executable:
        return "blackwell"
    if "/python-sageattention-latest/" in executable or "/python_sageattention_latest/" in executable:
        return "sageattention2"
    if "/python-sageattention-blackwell/" in executable or "/python_sageattention_blackwell/" in executable:
        return "sageattention"
    if "/python-sageattention/" in executable or "/python_sageattention/" in executable:
        return "sageattention"
    if "/python_tageditor/" in executable or "/venv-tageditor/" in executable:
        return "tageditor"
    if "/venv/" in executable:
        return "venv"
    if "/python/" in executable:
        return "portable"
    return "system"


def inspect_runtime_package(module_name: str, probe_import: bool = True) -> dict:
    package_info = PACKAGE_REGISTRY.get(
        module_name,
        {
            "package_name": module_name.replace("_", "-"),
            "display_name": module_name,
            "required_by_default": False,
        },
    )
    package_name = package_info["package_name"]
    display_name = package_info["display_name"]
    version = _metadata_version(package_name)
    spec = importlib.util.find_spec(module_name)
    installed = spec is not None or version is not None
    importable = False
    reason = ""

    if not installed:
        reason = "Package is not installed in the active runtime."
    elif not probe_import:
        importable = True
    else:
        try:
            importlib.import_module(module_name)
            importable = True
        except Exception as exc:  # pragma: no cover - import failure depends on local runtime
            reason = _short_exc_message(exc)

    return {
        "module_name": module_name,
        "package_name": package_name,
        "display_name": display_name,
        "required_by_default": bool(package_info.get("required_by_default", False)),
        "installed": installed,
        "importable": importable,
        "version": version,
        "reason": reason,
    }


def build_runtime_status_payload(module_names: Iterable[str] | None = None, probe_import: bool = True) -> dict:
    tracked_modules = list(module_names or PACKAGE_REGISTRY.keys())
    packages = {
        module_name: inspect_runtime_package(module_name, probe_import=probe_import)
        for module_name in tracked_modules
    }
    required_ready = all(
        package["importable"]
        for package in packages.values()
        if package["required_by_default"]
    )
    return {
        "environment": _infer_environment_name(),
        "python_executable": sys.executable,
        "python_version": sys.version.split()[0],
        "required_ready": required_ready,
        "packages": packages,
    }


def _append_requirement(target: dict[str, list[str]], module_name: str, reason: str) -> None:
    if module_name not in target:
        target[module_name] = []
    if reason not in target[module_name]:
        target[module_name].append(reason)


def _config_flag_enabled(value) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _add_optimizer_requirement(target: dict[str, list[str]], optimizer_type: str) -> None:
    if not optimizer_type:
        return

    normalized = optimizer_type.strip()
    lower_name = normalized.lower()

    if "." in normalized:
        module_name = normalized.split(".", 1)[0]
        _append_requirement(target, module_name, f"optimizer_type={normalized}")
        return

    if normalized == "Lion":
        _append_requirement(target, "lion_pytorch", f"optimizer_type={normalized}")
    elif normalized == "AdaFactor":
        _append_requirement(target, "transformers", f"optimizer_type={normalized}")
    elif lower_name.endswith("8bit"):
        _append_requirement(target, "bitsandbytes", f"optimizer_type={normalized}")
    elif lower_name.startswith("dadapt"):
        _append_requirement(target, "dadaptation", f"optimizer_type={normalized}")
    elif normalized == "Prodigy":
        _append_requirement(target, "prodigyopt", f"optimizer_type={normalized}")
    elif lower_name.endswith("schedulefree"):
        _append_requirement(target, "schedulefree", f"optimizer_type={normalized}")


def _add_scheduler_requirement(target: dict[str, list[str]], scheduler_type: str) -> None:
    normalized = scheduler_type.strip()
    if not normalized:
        return

    if normalized.startswith(CUSTOM_SCHEDULER_PREFIX):
        normalized = normalized[len(CUSTOM_SCHEDULER_PREFIX):]

    if normalized in BUILTIN_LR_SCHEDULERS:
        return

    if "." not in normalized:
        return

    module_name = normalized.split(".", 1)[0]
    _append_requirement(target, module_name, f"lr_scheduler_type={normalized}")


def _add_attention_requirement(target: dict[str, list[str]], config: dict) -> None:
    attn_mode = str(config.get("attn_mode", "")).strip().lower()
    if attn_mode == "sageattn":
        _append_requirement(target, "sageattention", "attn_mode=sageattn")
        return

    if _config_flag_enabled(config.get("use_sage_attn")):
        _append_requirement(target, "sageattention", "use_sage_attn=true")
    if _config_flag_enabled(config.get("sageattn")):
        _append_requirement(target, "sageattention", "sageattn=true")


def _add_network_module_requirement(target: dict[str, list[str]], config: dict) -> None:
    network_module = str(config.get("network_module", "")).strip()
    if not network_module:
        return

    lower_name = network_module.lower()
    if lower_name.startswith("lycoris."):
        _append_requirement(target, "lycoris", f"network_module={network_module}")


def _add_anima_requirement(target: dict[str, list[str]], config: dict) -> None:
    model_train_type = str(config.get("model_train_type", "")).strip().lower()
    if not model_train_type.startswith("anima"):
        return

    _append_requirement(target, "safetensors", f"model_train_type={model_train_type}")
    _append_requirement(target, "sentencepiece", f"model_train_type={model_train_type}")


def _add_yolo_requirement(target: dict[str, list[str]], config: dict) -> None:
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
        _append_requirement(target, module_name, f"model_train_type={model_train_type}")


def _add_aesthetic_requirement(target: dict[str, list[str]], config: dict) -> None:
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
        _append_requirement(target, module_name, f"model_train_type={model_train_type}")


def collect_training_dependency_requirements(config: dict) -> dict[str, list[str]]:
    requirements: dict[str, list[str]] = {}
    _add_optimizer_requirement(requirements, str(config.get("optimizer_type", "")).strip())
    _add_scheduler_requirement(requirements, str(config.get("lr_scheduler_type", "")).strip())
    _add_attention_requirement(requirements, config)
    _add_network_module_requirement(requirements, config)
    _add_anima_requirement(requirements, config)
    _add_yolo_requirement(requirements, config)
    _add_aesthetic_requirement(requirements, config)
    return requirements


def analyze_training_runtime_dependencies(config: dict) -> dict:
    requirements = collect_training_dependency_requirements(config)
    if not requirements:
        return {
            "ready": True,
            "required": [],
            "missing": [],
        }

    required_records = []
    missing_records = []
    for module_name, required_for in requirements.items():
        package_status = inspect_runtime_package(module_name, probe_import=True)
        record = {
            **package_status,
            "required_for": required_for,
        }
        required_records.append(record)
        if not package_status["importable"]:
            missing_records.append(record)

    return {
        "ready": len(missing_records) == 0,
        "required": required_records,
        "missing": missing_records,
    }
