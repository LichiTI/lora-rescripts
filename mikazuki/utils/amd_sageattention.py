from __future__ import annotations

import importlib
import importlib.util
import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

from mikazuki.utils.runtime_mode import infer_attention_runtime_mode
from mikazuki.utils.runtime_paths import iter_runtime_dir_candidates

_AMD_SAGE_RUNTIME_NAMES = {"rocm-amd-sage"}


def is_amd_rocm_sage_runtime() -> bool:
    return infer_attention_runtime_mode() in _AMD_SAGE_RUNTIME_NAMES


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _normalize_source_candidate(raw_value: str) -> Path | None:
    normalized = str(raw_value or "").strip()
    if not normalized:
        return None
    candidate = Path(os.path.expandvars(os.path.expanduser(normalized)))
    if not candidate.is_absolute():
        candidate = (_repo_root() / candidate).resolve()
    return candidate


def get_amd_rocm_sage_source_root() -> Path | None:
    candidates: list[Path | None] = [
        _normalize_source_candidate(os.environ.get("MIKAZUKI_AMD_SAGE_SOURCE", "")),
        *[candidate / "SageAttention-rocm" for candidate in iter_runtime_dir_candidates(_repo_root(), "rocm-amd-sage")],
        *[candidate / "SageAttention-rocm" for candidate in iter_runtime_dir_candidates(_repo_root(), "rocm-amd")],
    ]

    for candidate in candidates:
        if candidate is None:
            continue
        if (candidate / "sageattention" / "triton" / "attn_qk_int8_per_block.py").is_file():
            return candidate
    return None


def _load_module_from_file(module_name: str, file_path: Path):
    existing = sys.modules.get(module_name)
    if existing is not None:
        return existing

    spec = importlib.util.spec_from_file_location(module_name, str(file_path))
    if spec is None or spec.loader is None:
        raise ImportError(f"Unable to create import spec for {file_path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


@lru_cache(maxsize=2)
def _load_rocm_triton_components(source_root_str: str) -> dict[str, Any]:
    source_root = Path(source_root_str)
    triton_dir = source_root / "sageattention" / "triton"
    if not triton_dir.is_dir():
        raise FileNotFoundError(f"AMD SageAttention triton directory was not found: {triton_dir}")

    namespace = "mikazuki_amd_sageattention_runtime.triton"
    modules = {
        "quant_per_block": _load_module_from_file(f"{namespace}.quant_per_block", triton_dir / "quant_per_block.py"),
        "quant_per_block_hd96": _load_module_from_file(
            f"{namespace}.quant_per_block_hd96", triton_dir / "quant_per_block_hd96.py"
        ),
        "quant_per_block_varlen": _load_module_from_file(
            f"{namespace}.quant_per_block_varlen", triton_dir / "quant_per_block_varlen.py"
        ),
        "attn_qk_int8_per_block": _load_module_from_file(
            f"{namespace}.attn_qk_int8_per_block", triton_dir / "attn_qk_int8_per_block.py"
        ),
        "attn_qk_int8_per_block_causal": _load_module_from_file(
            f"{namespace}.attn_qk_int8_per_block_causal", triton_dir / "attn_qk_int8_per_block_causal.py"
        ),
        "attn_qk_int8_per_block_h96": _load_module_from_file(
            f"{namespace}.attn_qk_int8_per_block_h96", triton_dir / "attn_qk_int8_per_block_h96.py"
        ),
        "attn_qk_int8_per_block_h96_causal": _load_module_from_file(
            f"{namespace}.attn_qk_int8_per_block_h96_causal", triton_dir / "attn_qk_int8_per_block_h96_causal.py"
        ),
        "attn_qk_int8_block_varlen": _load_module_from_file(
            f"{namespace}.attn_qk_int8_block_varlen", triton_dir / "attn_qk_int8_block_varlen.py"
        ),
        "attn_qk_int8_per_block_causal_varlen": _load_module_from_file(
            f"{namespace}.attn_qk_int8_per_block_causal_varlen",
            triton_dir / "attn_qk_int8_per_block_causal_varlen.py",
        ),
    }
    return modules


@lru_cache(maxsize=2)
def _build_rocm_triton_sageattention_symbols(source_root_str: str) -> tuple[Callable[..., Any], Callable[..., Any]]:
    import torch

    modules = _load_rocm_triton_components(source_root_str)

    per_block_int8 = modules["quant_per_block"].per_block_int8
    per_block_int8_hd96 = modules["quant_per_block_hd96"].per_block_int8_hd96
    per_block_int8_varlen = modules["quant_per_block_varlen"].per_block_int8
    attn_false = modules["attn_qk_int8_per_block"].forward
    attn_true = modules["attn_qk_int8_per_block_causal"].forward
    attn_h96_false = modules["attn_qk_int8_per_block_h96"].forward
    attn_h96_true = modules["attn_qk_int8_per_block_h96_causal"].forward
    attn_false_varlen = modules["attn_qk_int8_block_varlen"].forward
    attn_true_varlen = modules["attn_qk_int8_per_block_causal_varlen"].forward

    def sageattn(
        q: torch.Tensor,
        k: torch.Tensor,
        v: torch.Tensor,
        tensor_layout: str = "HND",
        is_causal: bool = False,
        sm_scale: float | None = None,
        return_lse: bool = False,
        **_: Any,
    ):
        dtype = q.dtype
        assert q.is_cuda, "Input tensors must be on ROCm/CUDA."
        assert dtype in (torch.float16, torch.bfloat16), "Input tensors must be float16 or bfloat16."
        assert q.device == k.device == v.device, "All tensors must be on the same device."
        assert q.dtype == k.dtype == v.dtype, "All tensors must have the same dtype."
        assert q.stride(-1) == 1 and k.stride(-1) == 1 and v.stride(-1) == 1, "Last dim of qkv must be contiguous."

        head_dim = q.size(-1)
        assert head_dim in (64, 96, 128), "head_dim must be one of 64, 96, 128."
        if sm_scale is None:
            sm_scale = head_dim**-0.5

        seq_dim = 1 if tensor_layout == "NHD" else 2
        km = k.mean(dim=seq_dim, keepdim=True)
        if return_lse:
            if tensor_layout == "NHD":
                lse_correction = torch.matmul(q.transpose(1, 2), km.transpose(1, 2).transpose(2, 3)).squeeze(-1).to(torch.float32)
            else:
                lse_correction = torch.matmul(q, km.transpose(2, 3)).squeeze(-1).to(torch.float32)
        else:
            lse_correction = None

        if dtype == torch.bfloat16:
            v = v.to(torch.float16)

        if head_dim == 96:
            q_int8, q_scale, k_int8, k_scale = per_block_int8_hd96(q, k, km=km, sm_scale=sm_scale, tensor_layout=tensor_layout)
            if is_causal:
                out, lse = attn_h96_true(q_int8, k_int8, v, q_scale, k_scale, tensor_layout=tensor_layout, output_dtype=dtype, return_lse=return_lse)
            else:
                out, lse = attn_h96_false(q_int8, k_int8, v, q_scale, k_scale, tensor_layout=tensor_layout, output_dtype=dtype, return_lse=return_lse)
        else:
            q_int8, q_scale, k_int8, k_scale = per_block_int8(q, k, km=km, sm_scale=sm_scale, tensor_layout=tensor_layout)
            if is_causal:
                out, lse = attn_true(q_int8, k_int8, v, q_scale, k_scale, tensor_layout=tensor_layout, output_dtype=dtype, return_lse=return_lse)
            else:
                out, lse = attn_false(q_int8, k_int8, v, q_scale, k_scale, tensor_layout=tensor_layout, output_dtype=dtype, return_lse=return_lse)

        if return_lse:
            if lse_correction is not None:
                return out, lse / 1.44269504 + lse_correction * sm_scale
            return out, lse / 1.44269504
        return out

    def sageattn_varlen(
        q: torch.Tensor,
        k: torch.Tensor,
        v: torch.Tensor,
        cu_seqlens_q: torch.Tensor,
        cu_seqlens_k: torch.Tensor,
        max_seqlen_q: int,
        max_seqlen_k: int,
        is_causal: bool = False,
        sm_scale: float | None = None,
        smooth_k: bool = True,
        **_: Any,
    ):
        dtype = q.dtype
        assert q.is_cuda, "Input tensors must be on ROCm/CUDA."
        assert dtype in (torch.float16, torch.bfloat16), "Input tensors must be float16 or bfloat16."
        assert q.device == k.device == v.device, "All tensors must be on the same device."
        assert q.dtype == k.dtype == v.dtype, "All tensors must have the same dtype."
        assert q.stride(-1) == 1 and k.stride(-1) == 1 and v.stride(-1) == 1, "Last dim of qkv must be contiguous."
        assert cu_seqlens_q.is_contiguous() and cu_seqlens_k.is_contiguous(), "cu_seqlens tensors must be contiguous."

        head_dim = q.size(-1)
        assert head_dim in (64, 128), "varlen only supports head_dim 64 or 128."

        if dtype == torch.bfloat16:
            v = v.to(torch.float16)

        if smooth_k:
            km = k.mean(dim=0, keepdim=True)
            k = k - km

        q_int8, q_scale, k_int8, k_scale, cu_seqlens_q_scale, cu_seqlens_k_scale = per_block_int8_varlen(
            q,
            k,
            cu_seqlens_q,
            cu_seqlens_k,
            max_seqlen_q,
            max_seqlen_k,
            sm_scale=sm_scale,
        )

        if is_causal:
            return attn_true_varlen(
                q_int8,
                k_int8,
                v,
                cu_seqlens_q,
                cu_seqlens_k,
                max_seqlen_q,
                q_scale,
                k_scale,
                cu_seqlens_q_scale,
                cu_seqlens_k_scale,
                output_dtype=dtype,
            )

        return attn_false_varlen(
            q_int8,
            k_int8,
            v,
            cu_seqlens_q,
            cu_seqlens_k,
            max_seqlen_q,
            q_scale,
            k_scale,
            cu_seqlens_q_scale,
            cu_seqlens_k_scale,
            output_dtype=dtype,
        )

    return sageattn, sageattn_varlen


def _load_package_sageattention_symbols() -> tuple[Callable[..., Any], Callable[..., Any]]:
    sage_module = importlib.import_module("sageattention")
    sageattn = getattr(sage_module, "sageattn", None)
    sageattn_varlen = getattr(sage_module, "sageattn_varlen", None)
    if not callable(sageattn) or not callable(sageattn_varlen):
        raise ImportError("required SageAttention symbols are missing")
    return sageattn, sageattn_varlen


def load_runtime_sageattention_symbols() -> tuple[Callable[..., Any] | None, Callable[..., Any] | None, str]:
    errors: list[str] = []

    if is_amd_rocm_sage_runtime():
        source_root = get_amd_rocm_sage_source_root()
        if source_root is not None:
            try:
                sageattn, sageattn_varlen = _build_rocm_triton_sageattention_symbols(str(source_root))
                return sageattn, sageattn_varlen, f"local-rocm-triton:{source_root}"
            except Exception as exc:
                errors.append(f"local ROCm Sage bridge failed: {exc}")
        else:
            errors.append("local ROCm SageAttention-rocm source was not found")

    try:
        sageattn, sageattn_varlen = _load_package_sageattention_symbols()
        return sageattn, sageattn_varlen, "package"
    except Exception as exc:
        errors.append(f"package import failed: {exc}")

    raise ImportError("; ".join(errors))


def probe_runtime_sageattention() -> dict[str, Any]:
    result: dict[str, Any] = {
        "ready": False,
        "importable": False,
        "source": "",
        "source_root": "",
        "reason": "",
    }

    source_root = get_amd_rocm_sage_source_root()
    if source_root is not None:
        result["source_root"] = str(source_root)

    try:
        sageattn, sageattn_varlen, source = load_runtime_sageattention_symbols()
    except Exception as exc:
        result["reason"] = str(exc)
        return result

    result["importable"] = True
    result["ready"] = callable(sageattn) and callable(sageattn_varlen)
    result["source"] = source
    if not result["ready"]:
        result["reason"] = "required SageAttention symbols are missing"
    return result
