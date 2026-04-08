from __future__ import annotations

import importlib
import logging
import os
from argparse import Namespace

import torch


logger = logging.getLogger(__name__)

INTEL_XPU_EXPERIMENTAL_ENV = "MIKAZUKI_INTEL_XPU_EXPERIMENTAL"

_SAFE_OPTIMIZER_NAMES = {
    "adamw",
    "adafactor",
    "lion",
    "sgdnesterov",
}

_UNSAFE_OPTIMIZER_KEYWORDS = (
    "8bit",
    "paged",
    "bitsandbytes",
    "ademamix",
)


def _probe_experimental_sageattention() -> dict[str, object]:
    result: dict[str, object] = {
        "ready": False,
        "reason": "",
    }
    try:
        sage_module = importlib.import_module("sageattention")
    except Exception as exc:
        result["reason"] = f"sageattention import failed: {exc}"
        return result

    result["ready"] = callable(getattr(sage_module, "sageattn", None)) and callable(getattr(sage_module, "sageattn_varlen", None))
    if not result["ready"]:
        result["reason"] = "required SageAttention symbols are missing"
    return result


def _requested_sageattention(args: Namespace) -> bool:
    attn_mode = str(getattr(args, "attn_mode", "") or "").strip().lower()
    return bool(attn_mode == "sageattn" or getattr(args, "sageattn", False) or getattr(args, "use_sage_attn", False))


def _apply_ipex_attention_guard(messages: list[str]) -> None:
    os.environ.setdefault("IPEX_SDPA_SLICE_TRIGGER_RATE", "0.75")
    os.environ.setdefault("IPEX_ATTENTION_SLICE_RATE", "0.4")
    messages.append(
        f"Intel XPU 实验核心当前使用 IPEX attention slicing：trigger={os.environ['IPEX_SDPA_SLICE_TRIGGER_RATE']}，slice={os.environ['IPEX_ATTENTION_SLICE_RATE']}。"
    )


def _get_device_visibility_hint() -> str:
    for key in ("ZE_AFFINITY_MASK", "ONEAPI_DEVICE_SELECTOR", "SYCL_DEVICE_FILTER", "CUDA_VISIBLE_DEVICES"):
        value = str(os.environ.get(key, "") or "").strip()
        if value:
            return f"{key}={value}"
    return "all-visible"


def is_intel_xpu_runtime() -> bool:
    try:
        return bool(hasattr(torch, "xpu") and torch.xpu.is_available())
    except Exception:
        return False


def get_intel_xpu_runtime_probe() -> dict[str, object]:
    gpu_names: list[str] = []
    gpu_count = 0
    bf16_supported = None

    try:
        if is_intel_xpu_runtime():
            gpu_count = int(torch.xpu.device_count())
            gpu_names = [str(torch.xpu.get_device_name(index) or "").strip() for index in range(gpu_count)]
    except Exception:
        gpu_count = 0
        gpu_names = []

    try:
        if hasattr(torch.xpu, "is_bf16_supported"):
            bf16_supported = bool(torch.xpu.is_bf16_supported())
    except Exception:
        bf16_supported = None

    return {
        "torch_version": str(getattr(torch, "__version__", "") or ""),
        "gpu_count": gpu_count,
        "gpu_names": gpu_names,
        "bf16_supported": bf16_supported,
    }


def get_intel_xpu_runtime_label() -> str:
    probe = get_intel_xpu_runtime_probe()
    device_name = ""
    gpu_names = probe["gpu_names"]
    if gpu_names:
        device_name = str(gpu_names[0] or "").strip()
    if device_name:
        return f"Intel XPU / {device_name}"
    return "Intel XPU"


def _normalize_optimizer_type(raw_value: str) -> tuple[str, str | None]:
    normalized = str(raw_value or "").strip()
    if not normalized:
        return "AdamW", "Intel XPU 实验核心未指定 optimizer_type，已自动改用 AdamW。"

    lowered = normalized.lower()
    if lowered.startswith("pytorch_optimizer."):
        return (
            "AdamW",
            f"Intel XPU 实验核心当前暂不启用 {normalized}，已自动回退为 AdamW。",
        )

    if lowered in _SAFE_OPTIMIZER_NAMES:
        return normalized, None

    if any(keyword in lowered for keyword in _UNSAFE_OPTIMIZER_KEYWORDS):
        return "AdamW", f"Intel XPU 实验核心暂不启用 {normalized}，已自动回退为 AdamW。"

    if lowered.startswith("torch.optim."):
        return normalized, None

    return "AdamW", f"Intel XPU 实验核心暂未验证 optimizer_type={normalized}，已自动回退为 AdamW。"


def _disable_preview_settings(args: Namespace, messages: list[str]) -> None:
    preview_requested = bool(
        getattr(args, "sample_at_first", False)
        or getattr(args, "sample_every_n_steps", None) is not None
        or getattr(args, "sample_every_n_epochs", None) is not None
        or getattr(args, "sample_prompts", None)
        or getattr(args, "enable_preview", False)
    )
    args._intel_preview_requested = preview_requested
    if not preview_requested:
        args._intel_preview_forced_off = False
        return

    args.enable_preview = False
    args.sample_at_first = False
    args.sample_every_n_steps = None
    args.sample_every_n_epochs = None
    args.sample_prompts = None
    args._intel_preview_forced_off = True
    messages.append("Intel XPU 实验核心已自动关闭训练预览图，并跳过预览提示词。")


def _apply_mixed_precision_policy(args: Namespace, messages: list[str], runtime_probe: dict[str, object]) -> None:
    bf16_supported = runtime_probe.get("bf16_supported")
    mixed_precision = str(getattr(args, "mixed_precision", "") or "").strip().lower()
    args._intel_requested_mixed_precision = mixed_precision or "auto"

    if not mixed_precision:
        args.mixed_precision = "bf16" if bf16_supported is not False else "fp16"
        messages.append(f"Intel XPU 实验核心未指定 mixed_precision，已自动改用 {args.mixed_precision}。")
        return

    if mixed_precision == "bf16" and bf16_supported is False:
        args.mixed_precision = "fp16"
        messages.append("Intel XPU 实验核心当前未检测到 bf16 支持，已自动把 mixed_precision 从 bf16 回退为 fp16。")


def apply_anima_intel_xpu_experimental_policy(args: Namespace) -> list[str]:
    messages: list[str] = []

    if not is_intel_xpu_runtime():
        return messages

    os.environ[INTEL_XPU_EXPERIMENTAL_ENV] = "1"
    runtime_probe = get_intel_xpu_runtime_probe()
    _apply_ipex_attention_guard(messages)

    requested_attn_mode = str(getattr(args, "attn_mode", "") or "").strip().lower()
    wants_sageattention = _requested_sageattention(args)
    sage_probe = _probe_experimental_sageattention() if wants_sageattention else {"ready": False, "reason": ""}
    args._intel_requested_attn_mode = requested_attn_mode or "auto"
    args._intel_device_visibility_hint = _get_device_visibility_hint()
    if requested_attn_mode not in {"", "none", "null", "torch", "sdpa", "sageattn"}:
        messages.append(f"Intel XPU 实验核心暂不启用 {requested_attn_mode} attention，已强制改用 SDPA。")
    args.attn_mode = "torch"
    if hasattr(args, "sdpa"):
        args.sdpa = True
    args.enable_preview = False

    if bool(getattr(args, "xformers", False)):
        args.xformers = False
        messages.append("Intel XPU 实验核心已自动禁用 xformers。")

    if bool(getattr(args, "mem_eff_attn", False)):
        args.mem_eff_attn = False
        messages.append("Intel XPU 实验核心已自动禁用 mem_eff_attn。")

    if bool(getattr(args, "use_8bit_adam", False)):
        args.use_8bit_adam = False
        messages.append("Intel XPU 实验核心已自动禁用 use_8bit_adam。")

    normalized_optimizer, optimizer_message = _normalize_optimizer_type(getattr(args, "optimizer_type", ""))
    args.optimizer_type = normalized_optimizer
    if optimizer_message:
        messages.append(optimizer_message)

    if bool(getattr(args, "fused_backward_pass", False)):
        args.fused_backward_pass = False
        messages.append("Intel XPU 实验核心已自动禁用 fused_backward_pass。")

    if bool(getattr(args, "full_fp16", False)):
        args.full_fp16 = False
        messages.append("Intel XPU 实验核心暂不启用 full_fp16，已自动关闭。")

    if bool(getattr(args, "full_bf16", False)):
        args.full_bf16 = False
        messages.append("Intel XPU 实验核心暂不启用 full_bf16，已自动关闭。")

    if bool(getattr(args, "torch_compile", False)):
        args.torch_compile = False
        messages.append("Intel XPU 实验核心已自动禁用 torch_compile。")

    try:
        max_workers = int(getattr(args, "max_data_loader_n_workers", 0) or 0)
    except (TypeError, ValueError):
        max_workers = 0
    if max_workers > 0:
        args.max_data_loader_n_workers = 0
        messages.append("Intel XPU 实验核心已自动把 max_data_loader_n_workers 改为 0。")

    if bool(getattr(args, "persistent_data_loader_workers", False)):
        args.persistent_data_loader_workers = False
        messages.append("Intel XPU 实验核心已自动关闭 persistent_data_loader_workers。")

    try:
        nan_check_interval = int(getattr(args, "anima_nan_check_interval", 0) or 0)
    except (TypeError, ValueError):
        nan_check_interval = 0
    if nan_check_interval <= 0:
        args.anima_nan_check_interval = 1
        messages.append("Intel XPU 实验核心已自动把 anima_nan_check_interval 改为 1。")

    if wants_sageattention and sage_probe["ready"]:
        args.attn_mode = "sageattn"
        args.sageattn = True
        if hasattr(args, "use_sage_attn"):
            args.use_sage_attn = True
        if hasattr(args, "sdpa"):
            args.sdpa = False
        messages.append("Intel XPU 实验核心将试运行实验性 SageAttention；若内核调用失败，运行时会自动回退为 SDPA。")
    else:
        if bool(getattr(args, "sageattn", False)):
            args.sageattn = False
        if hasattr(args, "use_sage_attn") and bool(getattr(args, "use_sage_attn", False)):
            args.use_sage_attn = False
        if hasattr(args, "sdpa"):
            args.sdpa = True
        if wants_sageattention:
            messages.append(
                f"Intel XPU 实验核心当前未检测到可用的 SageAttention 构建（{sage_probe['reason'] or 'runtime probe failed'}），已自动回退为 SDPA。"
            )

    _disable_preview_settings(args, messages)
    _apply_mixed_precision_policy(args, messages, runtime_probe)

    return messages


def log_anima_intel_xpu_experimental_banner(args: Namespace, messages: list[str]) -> None:
    if not is_intel_xpu_runtime():
        return

    runtime_probe = get_intel_xpu_runtime_probe()
    mixed_precision = str(getattr(args, "mixed_precision", "no") or "no").strip().lower()
    gpu_names = [name for name in runtime_probe.get("gpu_names", []) if str(name).strip()]
    gpu_summary = ", ".join(gpu_names) if gpu_names else "unknown"
    logger.warning(
        f"Anima Intel XPU experimental core active: runtime={get_intel_xpu_runtime_label()} | "
        f"device_visibility={getattr(args, '_intel_device_visibility_hint', _get_device_visibility_hint())} | "
        f"requested_attn_mode={getattr(args, '_intel_requested_attn_mode', 'auto')} | "
        f"attn_mode={getattr(args, 'attn_mode', 'torch')} | "
        f"optimizer_type={getattr(args, 'optimizer_type', 'AdamW')} | "
        f"requested_mixed_precision={getattr(args, '_intel_requested_mixed_precision', 'auto')} | "
        f"mixed_precision={mixed_precision} | "
        f"visible_gpu_count={runtime_probe.get('gpu_count', 0)} | "
        f"visible_gpus={gpu_summary} | "
        f"bf16_supported={runtime_probe.get('bf16_supported')} | "
        f"preview_requested={bool(getattr(args, '_intel_preview_requested', False))} | "
        f"preview_forced_off={bool(getattr(args, '_intel_preview_forced_off', False))} | "
        f"sample_at_first={bool(getattr(args, 'sample_at_first', False))} | "
        f"sample_every_n_steps={getattr(args, 'sample_every_n_steps', None)} | "
        f"sample_every_n_epochs={getattr(args, 'sample_every_n_epochs', None)} | "
        f"max_data_loader_n_workers={getattr(args, 'max_data_loader_n_workers', 0)} | "
        f"persistent_data_loader_workers={bool(getattr(args, 'persistent_data_loader_workers', False))} | "
        f"anima_nan_check_interval={getattr(args, 'anima_nan_check_interval', 0)} | "
        f"ipex_sdpa_slice_trigger_rate={os.environ.get('IPEX_SDPA_SLICE_TRIGGER_RATE', '')} | "
        f"ipex_attention_slice_rate={os.environ.get('IPEX_ATTENTION_SLICE_RATE', '')}"
    )
    logger.warning(
        "当前已进入 Anima Intel XPU 实验核心。该路由仅面向 Intel Arc / XPU 环境，优先保证可训练与可回退，不追求极限性能。"
    )

    for message in messages:
        logger.warning(message)
