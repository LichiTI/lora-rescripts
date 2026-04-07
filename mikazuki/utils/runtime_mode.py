from __future__ import annotations

import os
import sys
from typing import Mapping


RUNTIME_ENVIRONMENT_ALIASES = {
    "sageattention2": "sageattention",
    "sageattention-blackwell": "sageattention",
}

INTEL_XPU_RUNTIME_NAMES = {"intel-xpu", "intel-xpu-sage"}
AMD_ROCM_RUNTIME_NAMES = {"rocm-amd", "rocm-amd-sage"}
SAGEATTENTION_RUNTIME_NAMES = {"sageattention", "sageattention2", "sageattention-blackwell"}


def normalize_runtime_name(runtime_name: str) -> str:
    normalized = str(runtime_name or "").strip().lower()
    return RUNTIME_ENVIRONMENT_ALIASES.get(normalized, normalized)


def infer_runtime_environment_name(executable: str | None = None) -> str:
    normalized_executable = str(executable or sys.executable).replace("\\", "/").lower()

    if "/python_sagebwd_nvidia/" in normalized_executable or "/python-sagebwd-nvidia/" in normalized_executable:
        return "sagebwd-nvidia"
    if "/python_xpu_intel_sage/" in normalized_executable or "/python-xpu-intel-sage/" in normalized_executable:
        return "intel-xpu-sage"
    if "/python_xpu_intel/" in normalized_executable or "/python-xpu-intel/" in normalized_executable:
        return "intel-xpu"
    if "/python_rocm_amd_sage/" in normalized_executable or "/python-rocm-amd-sage/" in normalized_executable:
        return "rocm-amd-sage"
    if "/python_rocm_amd/" in normalized_executable or "/python-rocm-amd/" in normalized_executable:
        return "rocm-amd"
    if "/python_blackwell/" in normalized_executable:
        return "blackwell"
    if "/python-sageattention-latest/" in normalized_executable or "/python_sageattention_latest/" in normalized_executable:
        return "sageattention2"
    if "/python-sageattention-blackwell/" in normalized_executable or "/python_sageattention_blackwell/" in normalized_executable:
        return "sageattention-blackwell"
    if "/python-sageattention/" in normalized_executable or "/python_sageattention/" in normalized_executable:
        return "sageattention"
    if "/python_tageditor/" in normalized_executable or "/venv-tageditor/" in normalized_executable:
        return "tageditor"
    if "/venv/" in normalized_executable:
        return "venv"
    if "/python/" in normalized_executable:
        return "portable"
    return "system"


def infer_attention_runtime_mode(environ: Mapping[str, str] | None = None, executable: str | None = None) -> str:
    env = environ if environ is not None else os.environ

    if str(env.get("MIKAZUKI_SAGEBWD_STARTUP", "") or "").strip() == "1":
        return "sagebwd-nvidia"
    if (
        str(env.get("MIKAZUKI_SAGEATTENTION_STARTUP", "") or "").strip() == "1"
        or str(env.get("MIKAZUKI_SAGEATTENTION2_STARTUP", "") or "").strip() == "1"
    ):
        return "sageattention"
    if str(env.get("MIKAZUKI_BLACKWELL_STARTUP", "") or "").strip() == "1":
        return "blackwell"
    if str(env.get("MIKAZUKI_INTEL_XPU_SAGE_STARTUP", "") or "").strip() == "1":
        return "intel-xpu-sage"
    if str(env.get("MIKAZUKI_INTEL_XPU_STARTUP", "") or "").strip() == "1":
        return "intel-xpu"
    if str(env.get("MIKAZUKI_ROCM_AMD_SAGE_STARTUP", "") or "").strip() == "1":
        return "rocm-amd-sage"
    if str(env.get("MIKAZUKI_ROCM_AMD_STARTUP", "") or "").strip() == "1":
        return "rocm-amd"

    return normalize_runtime_name(infer_runtime_environment_name(executable=executable))


def resolve_preferred_runtime(environ: Mapping[str, str] | None = None) -> str:
    env = environ if environ is not None else os.environ
    return str(env.get("MIKAZUKI_PREFERRED_RUNTIME", "") or "").strip().lower()


def is_intel_xpu_runtime(runtime_name: str) -> bool:
    return str(runtime_name or "").strip().lower() in INTEL_XPU_RUNTIME_NAMES


def is_amd_rocm_runtime(runtime_name: str) -> bool:
    return str(runtime_name or "").strip().lower() in AMD_ROCM_RUNTIME_NAMES
