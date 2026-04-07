from __future__ import annotations

import json
import sys
from pathlib import Path


def _setup_repo_paths() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    stable_root = repo_root / "scripts" / "stable"
    for path in (repo_root, stable_root):
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)
    return repo_root


def _tensor_grad_summary(torch, tensor):
    if tensor is None:
        return {"present": False, "finite": False, "abs_sum": None, "abs_max": None}
    return {
        "present": True,
        "finite": bool(torch.isfinite(tensor).all().item()),
        "abs_sum": float(tensor.abs().sum().item()),
        "abs_max": float(tensor.abs().max().item()),
    }


def _run_direct_case(torch, call_sageattention):
    device = "cuda"
    dtype = torch.bfloat16
    batch, seq_len, channels, heads = 2, 16, 256, 4
    head_dim = channels // heads

    to_q = torch.nn.Linear(channels, channels, bias=False, device=device, dtype=dtype)
    to_k = torch.nn.Linear(channels, channels, bias=False, device=device, dtype=dtype)
    to_v = torch.nn.Linear(channels, channels, bias=False, device=device, dtype=dtype)
    to_out = torch.nn.Linear(channels, channels, bias=False, device=device, dtype=dtype)

    hidden = torch.randn(batch, seq_len, channels, device=device, dtype=dtype)
    context = torch.randn(batch, seq_len, channels, device=device, dtype=dtype)

    q = to_q(hidden).reshape(batch, seq_len, heads, head_dim).permute(0, 2, 1, 3).contiguous()
    k = to_k(context).reshape(batch, seq_len, heads, head_dim).permute(0, 2, 1, 3).contiguous()
    v = to_v(context).reshape(batch, seq_len, heads, head_dim).permute(0, 2, 1, 3).contiguous()

    out = call_sageattention(q, k, v, tensor_layout="HND", is_causal=False, sm_scale=head_dim**-0.5)
    out = out.permute(0, 2, 1, 3).reshape(batch, seq_len, channels)
    out = to_out(out)
    loss = out.float().square().mean()
    loss.backward()

    return {
        "loss": float(loss.item()),
        "to_q": _tensor_grad_summary(torch, to_q.weight.grad),
        "to_k": _tensor_grad_summary(torch, to_k.weight.grad),
        "to_v": _tensor_grad_summary(torch, to_v.weight.grad),
        "to_out": _tensor_grad_summary(torch, to_out.weight.grad),
    }


def _run_attention_module_case(torch, attention_module):
    device = "cuda"
    dtype = torch.bfloat16
    batch, seq_len, heads, head_dim = 2, 16, 4, 64

    q = torch.randn(batch, seq_len, heads, head_dim, device=device, dtype=dtype, requires_grad=True)
    k = torch.randn(batch, seq_len, heads, head_dim, device=device, dtype=dtype, requires_grad=True)
    v = torch.randn(batch, seq_len, heads, head_dim, device=device, dtype=dtype, requires_grad=True)

    attn_params = attention_module.AttentionParams.create_attention_params("sageattn", False)
    out = attention_module.attention(q, k, v, attn_params, drop_rate=0.0)
    loss = out.float().square().mean()
    loss.backward()

    return {
        "loss": float(loss.item()),
        "q": _tensor_grad_summary(torch, q.grad),
        "k": _tensor_grad_summary(torch, k.grad),
        "v": _tensor_grad_summary(torch, v.grad),
    }


def main() -> None:
    _setup_repo_paths()

    result = {
        "success": False,
        "runtime_source": "",
        "cuda_available": False,
        "direct_case": {},
        "attention_module_case": {},
        "error": "",
    }

    try:
        import torch
        from library import attention as attention_module
        from library.sageattention_compat import call_sageattention, get_runtime_sageattention_source

        result["cuda_available"] = bool(torch.cuda.is_available())
        result["runtime_source"] = get_runtime_sageattention_source()
        if not result["cuda_available"]:
            result["error"] = "CUDA is not available."
            print(json.dumps(result, ensure_ascii=False))
            return

        result["direct_case"] = _run_direct_case(torch, call_sageattention)
        result["attention_module_case"] = _run_attention_module_case(torch, attention_module)

        checks = [
            result["direct_case"]["to_q"]["present"],
            result["direct_case"]["to_k"]["present"],
            result["direct_case"]["to_v"]["present"],
            result["direct_case"]["to_out"]["present"],
            result["attention_module_case"]["q"]["present"],
            result["attention_module_case"]["k"]["present"],
            result["attention_module_case"]["v"]["present"],
            result["direct_case"]["to_q"]["finite"],
            result["direct_case"]["to_k"]["finite"],
            result["direct_case"]["to_v"]["finite"],
            result["direct_case"]["to_out"]["finite"],
            result["attention_module_case"]["q"]["finite"],
            result["attention_module_case"]["k"]["finite"],
            result["attention_module_case"]["v"]["finite"],
        ]
        result["success"] = all(checks)
    except Exception as exc:
        result["error"] = str(exc)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
