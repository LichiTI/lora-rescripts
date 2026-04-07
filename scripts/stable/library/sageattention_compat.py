from __future__ import annotations

from functools import lru_cache
import logging
from typing import Any

import torch
from torch.nn import functional as F

from mikazuki.utils.amd_sageattention import load_runtime_sageattention_symbols
from mikazuki.utils.sagebwd_runtime import is_sagebwd_nvidia_runtime, probe_runtime_sagebwd

logger = logging.getLogger(__name__)

try:
    _runtime_sageattn, _runtime_sageattn_varlen, _runtime_sageattention_source = load_runtime_sageattention_symbols()
except Exception:
    _runtime_sageattn = None
    _runtime_sageattn_varlen = None
    _runtime_sageattention_source = ""


def get_runtime_sageattention_source() -> str:
    return _runtime_sageattention_source


def get_runtime_sageattention_symbols() -> tuple[Any, Any]:
    return _runtime_sageattn, _runtime_sageattn_varlen


@lru_cache(maxsize=2)
def _warn_backward_shim_once(source: str) -> None:
    runtime_source = source or "unknown"
    if is_sagebwd_nvidia_runtime():
        logger.warning(
            "SageBwd NVIDIA compatibility shim is active for source '%s': "
            "native backward is not ready, so forward uses Sage/SageBwd runtime while backward recomputes gradients with SDPA.",
            runtime_source,
        )
        return

    logger.warning(
        "SageAttention training compatibility shim is active for source '%s': "
        "forward uses SageAttention, backward recomputes gradients with SDPA.",
        runtime_source,
    )


def _runtime_prefers_native_backward() -> bool:
    source = _runtime_sageattention_source or ""
    if source.startswith("local-rocm-triton:"):
        return True
    if is_sagebwd_nvidia_runtime():
        try:
            probe = probe_runtime_sagebwd()
        except Exception:
            return False
        return bool(probe.get("native_backward"))
    return False


def _run_sdpa_attention(
    q: torch.Tensor,
    k: torch.Tensor,
    v: torch.Tensor,
    *,
    tensor_layout: str,
    is_causal: bool,
    sm_scale: float | None,
) -> torch.Tensor:
    if tensor_layout == "HND":
        q_sdpa = q
        k_sdpa = k
        v_sdpa = v
    elif tensor_layout == "NHD":
        q_sdpa = q.permute(0, 2, 1, 3).contiguous()
        k_sdpa = k.permute(0, 2, 1, 3).contiguous()
        v_sdpa = v.permute(0, 2, 1, 3).contiguous()
    else:
        raise ValueError(f"Unsupported SageAttention tensor_layout: {tensor_layout}")

    sdpa_kwargs = {
        "attn_mask": None,
        "dropout_p": 0.0,
        "is_causal": is_causal,
    }
    if sm_scale is not None:
        sdpa_kwargs["scale"] = sm_scale

    out = F.scaled_dot_product_attention(q_sdpa, k_sdpa, v_sdpa, **sdpa_kwargs)

    if tensor_layout == "NHD":
        out = out.permute(0, 2, 1, 3).contiguous()
    return out


class _SageAttentionWithSdpaBackward(torch.autograd.Function):
    @staticmethod
    def forward(
        ctx,
        q: torch.Tensor,
        k: torch.Tensor,
        v: torch.Tensor,
        tensor_layout: str,
        is_causal: bool,
        sm_scale: float | None,
    ) -> torch.Tensor:
        if _runtime_sageattn is None:
            raise ImportError("No SageAttention runtime is available")

        ctx.tensor_layout = tensor_layout
        ctx.is_causal = is_causal
        ctx.sm_scale = sm_scale
        ctx.save_for_backward(q, k, v)

        return _runtime_sageattn(
            q,
            k,
            v,
            tensor_layout=tensor_layout,
            is_causal=is_causal,
            sm_scale=sm_scale,
        )

    @staticmethod
    def backward(ctx, grad_out: torch.Tensor):
        q, k, v = ctx.saved_tensors

        with torch.enable_grad():
            q_re = q.detach().requires_grad_(ctx.needs_input_grad[0])
            k_re = k.detach().requires_grad_(ctx.needs_input_grad[1])
            v_re = v.detach().requires_grad_(ctx.needs_input_grad[2])

            out = _run_sdpa_attention(
                q_re,
                k_re,
                v_re,
                tensor_layout=ctx.tensor_layout,
                is_causal=ctx.is_causal,
                sm_scale=ctx.sm_scale,
            )

        grad_inputs = torch.autograd.grad(
            out,
            (q_re, k_re, v_re),
            grad_out,
            allow_unused=True,
        )

        return grad_inputs[0], grad_inputs[1], grad_inputs[2], None, None, None


def call_sageattention(
    q: torch.Tensor,
    k: torch.Tensor,
    v: torch.Tensor,
    *,
    tensor_layout: str,
    is_causal: bool = False,
    sm_scale: float | None = None,
    prefer_native_backward: bool = True,
    **runtime_kwargs: Any,
):
    if _runtime_sageattn is None:
        raise ImportError("No SageAttention runtime is available")

    if prefer_native_backward and _runtime_prefers_native_backward():
        return _runtime_sageattn(
            q,
            k,
            v,
            tensor_layout=tensor_layout,
            is_causal=is_causal,
            sm_scale=sm_scale,
            **runtime_kwargs,
        )

    needs_backward = torch.is_grad_enabled() and any(t.requires_grad for t in (q, k, v))
    if not needs_backward:
        return _runtime_sageattn(
            q,
            k,
            v,
            tensor_layout=tensor_layout,
            is_causal=is_causal,
            sm_scale=sm_scale,
            **runtime_kwargs,
        )

    _warn_backward_shim_once(_runtime_sageattention_source)
    return _SageAttentionWithSdpaBackward.apply(q, k, v, tensor_layout, is_causal, sm_scale)
