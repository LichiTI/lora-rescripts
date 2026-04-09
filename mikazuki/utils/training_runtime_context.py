from __future__ import annotations

import re
from typing import Any, Optional

from mikazuki.utils.amd_rocm_guard import (
    apply_amd_anima_runtime_config_guard,
    apply_amd_anima_topology_guard,
    apply_amd_runtime_optimizer_guard,
)
from mikazuki.utils.attention_runtime_guard import apply_anima_runtime_attention_backend, apply_sdxl_runtime_attention_backend
from mikazuki.utils.devices import printable_devices
from mikazuki.utils.intel_xpu_guard import (
    apply_intel_anima_runtime_config_guard,
    apply_intel_anima_topology_guard,
)


def normalize_requested_gpu_ids(raw_gpu_ids) -> tuple[list[str], Optional[str]]:
    def _extract_ids(value):
        if value is None:
            return []
        if isinstance(value, bool):
            return []
        if isinstance(value, (int, float)):
            return [str(int(value))]
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []

            gpu_matches = re.findall(r"\bGPU\s*(\d+)\b", stripped, flags=re.IGNORECASE)
            if gpu_matches:
                return gpu_matches

            if stripped.isdigit():
                return [stripped]

            tokens = [token for token in re.split(r"[\s,\[\]\(\)\"']+", stripped) if token]
            return [token for token in tokens if token.isdigit()]

        if isinstance(value, (list, tuple, set)):
            normalized = []
            for item in value:
                normalized.extend(_extract_ids(item))
            return normalized

        return []

    parsed_ids = _extract_ids(raw_gpu_ids)
    unique_ids = []
    seen = set()
    for gpu_id in parsed_ids:
        if gpu_id in seen:
            continue
        seen.add(gpu_id)
        unique_ids.append(gpu_id)

    max_available = len(printable_devices) if printable_devices else None
    if max_available is None:
        try:
            import torch

            if torch.cuda.is_available():
                max_available = int(torch.cuda.device_count())
        except Exception:
            max_available = None

    valid_ids = []
    dropped_ids = []
    for gpu_id in unique_ids:
        try:
            gpu_index = int(gpu_id)
        except (TypeError, ValueError):
            dropped_ids.append(str(gpu_id))
            continue

        if gpu_index < 0 or (max_available is not None and gpu_index >= max_available):
            dropped_ids.append(str(gpu_id))
            continue

        valid_ids.append(str(gpu_index))

    warning = None
    if dropped_ids:
        warning = (
            "已自动忽略不可用或非 CUDA 的 GPU 选择："
            + ", ".join(dropped_ids)
            + "。当前只会使用可被 PyTorch CUDA 识别的训练显卡。"
        )

    return valid_ids, warning


def resolve_training_runtime_guard_context(
    config: dict,
    raw_gpu_ids,
    *,
    persist_gpu_ids: bool = False,
) -> dict[str, Any]:
    gpu_ids, gpu_filter_warning = normalize_requested_gpu_ids(raw_gpu_ids)

    amd_topology_guard = apply_amd_anima_topology_guard(config, gpu_ids)
    gpu_ids = amd_topology_guard["gpu_ids"]
    intel_topology_guard = apply_intel_anima_topology_guard(config, gpu_ids)
    gpu_ids = intel_topology_guard["gpu_ids"]

    if persist_gpu_ids:
        if gpu_ids:
            config["gpu_ids"] = gpu_ids
        else:
            config.pop("gpu_ids", None)

    apply_anima_runtime_attention_backend(config, gpu_ids)
    flashattention_runtime_message = apply_sdxl_runtime_attention_backend(config, gpu_ids)

    amd_optimizer_guard = apply_amd_runtime_optimizer_guard(config)
    amd_runtime_config_guard = apply_amd_anima_runtime_config_guard(config, amd_topology_guard.get("probe"))
    intel_runtime_config_guard = apply_intel_anima_runtime_config_guard(config, intel_topology_guard.get("probe"))

    warnings: list[str] = []
    notes: list[str] = []
    errors: list[str] = []

    if gpu_filter_warning:
        warnings.append(gpu_filter_warning)
    if flashattention_runtime_message:
        warnings.append(flashattention_runtime_message)

    for guard_result in (
        amd_topology_guard,
        intel_topology_guard,
        amd_optimizer_guard,
        amd_runtime_config_guard,
        intel_runtime_config_guard,
    ):
        warnings.extend(guard_result.get("warnings", []))
        notes.extend(guard_result.get("notes", []))
        errors.extend(guard_result.get("errors", []))

    return {
        "gpu_ids": gpu_ids,
        "gpu_filter_warning": gpu_filter_warning,
        "warnings": warnings,
        "notes": notes,
        "errors": errors,
        "skip_preview_prompt_prep": bool(
            amd_runtime_config_guard.get("skip_preview_prompt_prep")
            or intel_runtime_config_guard.get("skip_preview_prompt_prep")
        ),
        "amd_topology_guard": amd_topology_guard,
        "intel_topology_guard": intel_topology_guard,
        "amd_runtime_config_guard": amd_runtime_config_guard,
        "amd_optimizer_guard": amd_optimizer_guard,
        "intel_runtime_config_guard": intel_runtime_config_guard,
    }
