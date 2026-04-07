from __future__ import annotations

import importlib.metadata as md
import json
import math
import sys
import traceback


def metadata_version(*names: str) -> str:
    for name in names:
        try:
            return md.version(name)
        except Exception:
            continue
    return ""


def short_exc(exc: Exception) -> str:
    message = str(exc).strip()
    if not message:
        return exc.__class__.__name__
    return message.splitlines()[0]


def run_forward_case(torch, sageattn, *, device, dtype) -> tuple[float | None, bool, list[int]]:
    with torch.no_grad():
        batch = 1
        seq_len = 16
        heads = 4
        head_dim = 64

        q = torch.randn((batch, seq_len, heads, head_dim), device=device, dtype=dtype)
        k = torch.randn((batch, seq_len, heads, head_dim), device=device, dtype=dtype)
        v = torch.randn((batch, seq_len, heads, head_dim), device=device, dtype=dtype)

        out = sageattn(
            q,
            k,
            v,
            tensor_layout="NHD",
            is_causal=False,
            sm_scale=head_dim**-0.5,
        )

        q_sdpa = q.permute(0, 2, 1, 3).contiguous()
        k_sdpa = k.permute(0, 2, 1, 3).contiguous()
        v_sdpa = v.permute(0, 2, 1, 3).contiguous()
        sdpa_out = torch.nn.functional.scaled_dot_product_attention(
            q_sdpa,
            k_sdpa,
            v_sdpa,
            attn_mask=None,
            dropout_p=0.0,
        ).permute(0, 2, 1, 3).contiguous()

        torch.xpu.synchronize(device)

        diff = (out.float() - sdpa_out.float()).abs().max().item()
        finite = bool(torch.isfinite(out).all().item())
        return (None if math.isnan(diff) else float(diff)), finite, list(out.shape)


def run_backward_case(torch, sageattn, *, device, dtype) -> tuple[bool, float]:
    batch = 1
    seq_len = 8
    heads = 4
    head_dim = 64

    q = torch.randn((batch, seq_len, heads, head_dim), device=device, dtype=dtype, requires_grad=True)
    k = torch.randn((batch, seq_len, heads, head_dim), device=device, dtype=dtype, requires_grad=True)
    v = torch.randn((batch, seq_len, heads, head_dim), device=device, dtype=dtype, requires_grad=True)

    out = sageattn(
        q,
        k,
        v,
        tensor_layout="NHD",
        is_causal=False,
        sm_scale=head_dim**-0.5,
    )
    loss = out.float().square().mean()
    loss.backward()
    torch.xpu.synchronize(device)

    grad_tensors = (q.grad, k.grad, v.grad)
    grads_ok = all(tensor is not None and bool(torch.isfinite(tensor).all().item()) for tensor in grad_tensors)
    return grads_ok, float(loss.detach().float().item())


def main() -> None:
    result: dict[str, object] = {
        "success": False,
        "python_version": "",
        "torch_version": "",
        "torchvision_version": "",
        "triton_version": "",
        "sageattention_version": "",
        "xpu_available": False,
        "gpu_name": "",
        "bf16_supported": None,
        "tested_dtype": "",
        "tested_layout": "",
        "tested_variants": [],
        "output_shape": [],
        "all_finite": False,
        "max_abs_diff_vs_sdpa": None,
        "backward_ok": False,
        "backward_loss": None,
        "runtime_error": "",
        "traceback_tail": "",
    }

    try:
        result["python_version"] = sys.version.split()[0]

        import torch

        result["torch_version"] = getattr(torch, "__version__", "")
        result["torchvision_version"] = metadata_version("torchvision")
        result["triton_version"] = metadata_version("triton", "pytorch-triton-xpu")
        result["sageattention_version"] = metadata_version("sageattention")

        result["xpu_available"] = bool(hasattr(torch, "xpu") and torch.xpu.is_available())
        if not result["xpu_available"]:
            result["runtime_error"] = "Torch XPU runtime is not available."
            print(json.dumps(result, ensure_ascii=False))
            return

        if torch.xpu.device_count() <= 0:
            result["runtime_error"] = "No Intel XPU device is visible to Torch."
            print(json.dumps(result, ensure_ascii=False))
            return

        result["gpu_name"] = str(torch.xpu.get_device_name(0) or "")
        if hasattr(torch.xpu, "is_bf16_supported"):
            try:
                result["bf16_supported"] = bool(torch.xpu.is_bf16_supported())
            except Exception:
                result["bf16_supported"] = None

        import triton  # noqa: F401
        from sageattention import sageattn

        device = torch.device("xpu:0")
        candidate_dtypes = []
        if result["bf16_supported"] is not False:
            candidate_dtypes.append(torch.bfloat16)
        candidate_dtypes.append(torch.float16)

        last_error = ""
        last_traceback = ""

        for dtype in candidate_dtypes:
            try:
                diff, finite, shape = run_forward_case(torch, sageattn, device=device, dtype=dtype)
                if not finite:
                    raise RuntimeError("SageAttention returned non-finite values on Intel XPU.")

                backward_ok, backward_loss = run_backward_case(torch, sageattn, device=device, dtype=dtype)
                if not backward_ok:
                    raise RuntimeError("SageAttention backward produced missing or non-finite gradients on Intel XPU.")

                result["success"] = True
                result["tested_dtype"] = str(dtype).replace("torch.", "")
                result["tested_layout"] = "NHD"
                result["tested_variants"] = ["forward-64", "backward-64"]
                result["output_shape"] = shape
                result["all_finite"] = True
                result["max_abs_diff_vs_sdpa"] = diff
                result["backward_ok"] = True
                result["backward_loss"] = backward_loss
                print(json.dumps(result, ensure_ascii=False))
                return
            except Exception as exc:
                last_error = short_exc(exc)
                last_traceback = traceback.format_exc(limit=5)

        result["runtime_error"] = last_error or "Intel XPU Sage self-test failed."
        result["traceback_tail"] = last_traceback.strip()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        result["runtime_error"] = short_exc(exc)
        result["traceback_tail"] = traceback.format_exc(limit=5).strip()
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
