from __future__ import annotations

import importlib.metadata as md
import json
import math
import sys
import traceback

from mikazuki.utils.amd_sageattention import load_runtime_sageattention_symbols, probe_runtime_sageattention


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


def run_fixed_forward_case(torch, sageattn, *, device, dtype, head_dim: int) -> tuple[float, bool, list[int]]:
    with torch.no_grad():
        batch = 1
        seq_len = 16
        heads = 4

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

        torch.cuda.synchronize(device)

        diff = (out.float() - sdpa_out.float()).abs().max().item()
        finite = bool(torch.isfinite(out).all().item())
        return (None if math.isnan(diff) else float(diff)), finite, list(out.shape)


def run_varlen_forward_case(torch, sageattn_varlen, *, device, dtype, head_dim: int) -> tuple[float, bool, list[int]]:
    with torch.no_grad():
        lengths = (5, 7)
        total_tokens = sum(lengths)
        heads = 4

        q = torch.randn((total_tokens, heads, head_dim), device=device, dtype=dtype)
        k = torch.randn((total_tokens, heads, head_dim), device=device, dtype=dtype)
        v = torch.randn((total_tokens, heads, head_dim), device=device, dtype=dtype)
        cu_seqlens = torch.tensor([0, lengths[0], total_tokens], device=device, dtype=torch.int32)

        out = sageattn_varlen(
            q,
            k,
            v,
            cu_seqlens,
            cu_seqlens,
            max(lengths),
            max(lengths),
            is_causal=False,
            sm_scale=head_dim**-0.5,
        )

        sdpa_chunks = []
        start = 0
        for length in lengths:
            end = start + length
            q_chunk = q[start:end].permute(1, 0, 2).unsqueeze(0).contiguous()
            k_chunk = k[start:end].permute(1, 0, 2).unsqueeze(0).contiguous()
            v_chunk = v[start:end].permute(1, 0, 2).unsqueeze(0).contiguous()
            sdpa_chunk = torch.nn.functional.scaled_dot_product_attention(
                q_chunk,
                k_chunk,
                v_chunk,
                attn_mask=None,
                dropout_p=0.0,
            ).squeeze(0).permute(1, 0, 2).contiguous()
            sdpa_chunks.append(sdpa_chunk)
            start = end

        sdpa_out = torch.cat(sdpa_chunks, dim=0)

        torch.cuda.synchronize(device)

        diff = (out.float() - sdpa_out.float()).abs().max().item()
        finite = bool(torch.isfinite(out).all().item())
        return (None if math.isnan(diff) else float(diff)), finite, list(out.shape)


def run_backward_case(torch, sageattn, *, device, dtype, head_dim: int) -> tuple[bool, float]:
    batch = 1
    seq_len = 8
    heads = 4

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
    torch.cuda.synchronize(device)

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
        "hip_version": "",
        "sageattention_source": "",
        "sageattention_source_root": "",
        "cuda_available": False,
        "gpu_name": "",
        "bf16_supported": None,
        "tested_dtype": "",
        "tested_layout": "",
        "tested_head_dims": [],
        "tested_variants": [],
        "output_shape": [],
        "all_finite": False,
        "max_abs_diff_vs_sdpa": None,
        "varlen_ok": False,
        "varlen_max_abs_diff_vs_sdpa": None,
        "backward_ok": False,
        "backward_loss": None,
        "runtime_error": "",
        "traceback_tail": "",
    }

    try:
        import torch

        result["python_version"] = sys.version.split()[0]
        result["torch_version"] = str(getattr(torch, "__version__", "") or "")
        result["torchvision_version"] = metadata_version("torchvision")
        result["triton_version"] = metadata_version("triton", "pytorch-triton-rocm")
        result["hip_version"] = str(getattr(torch.version, "hip", "") or "")
        result["cuda_available"] = bool(torch.cuda.is_available())

        if not result["hip_version"]:
            result["runtime_error"] = "Torch is not a ROCm build."
            print(json.dumps(result, ensure_ascii=False))
            return

        if not result["cuda_available"] or torch.cuda.device_count() <= 0:
            result["runtime_error"] = "ROCm GPU is not available to Torch."
            print(json.dumps(result, ensure_ascii=False))
            return

        try:
            result["gpu_name"] = str(torch.cuda.get_device_name(0) or "")
        except Exception as exc:
            result["runtime_error"] = f"device probe failed: {exc}"
            print(json.dumps(result, ensure_ascii=False))
            return

        try:
            if hasattr(torch.cuda, "is_bf16_supported"):
                result["bf16_supported"] = bool(torch.cuda.is_bf16_supported())
        except Exception:
            result["bf16_supported"] = None

        try:
            import triton  # noqa: F401
        except Exception as exc:
            result["runtime_error"] = f"triton import failed: {exc}"
            print(json.dumps(result, ensure_ascii=False))
            return

        probe = probe_runtime_sageattention()
        result["sageattention_source"] = str(probe.get("source", "") or "")
        result["sageattention_source_root"] = str(probe.get("source_root", "") or "")
        if not probe.get("ready"):
            result["runtime_error"] = str(probe.get("reason", "") or "AMD SageAttention bridge is not ready.")
            print(json.dumps(result, ensure_ascii=False))
            return

        sageattn, sageattn_varlen, _ = load_runtime_sageattention_symbols()
        if sageattn is None or sageattn_varlen is None:
            result["runtime_error"] = "AMD SageAttention bridge returned empty symbols."
            print(json.dumps(result, ensure_ascii=False))
            return

        device = torch.device("cuda:0")
        candidate_dtypes = []
        if result["bf16_supported"] is not False:
            candidate_dtypes.append(torch.bfloat16)
        candidate_dtypes.append(torch.float16)

        last_error = ""
        last_traceback = ""
        for dtype in candidate_dtypes:
            try:
                forward_diffs: list[float] = []
                tested_head_dims: list[int] = []

                for head_dim in (64, 128):
                    diff, finite, shape = run_fixed_forward_case(
                        torch,
                        sageattn,
                        device=device,
                        dtype=dtype,
                        head_dim=head_dim,
                    )
                    if not finite:
                        raise RuntimeError(f"fixed forward returned non-finite values at head_dim={head_dim}")
                    if diff is not None:
                        forward_diffs.append(diff)
                    tested_head_dims.append(head_dim)
                    result["output_shape"] = shape

                varlen_diff, varlen_finite, _ = run_varlen_forward_case(
                    torch,
                    sageattn_varlen,
                    device=device,
                    dtype=dtype,
                    head_dim=64,
                )
                if not varlen_finite:
                    raise RuntimeError("varlen forward returned non-finite values")

                backward_ok, backward_loss = run_backward_case(
                    torch,
                    sageattn,
                    device=device,
                    dtype=dtype,
                    head_dim=64,
                )
                if not backward_ok:
                    raise RuntimeError("backward produced missing or non-finite gradients")

                result["success"] = True
                result["tested_dtype"] = str(dtype).replace("torch.", "")
                result["tested_layout"] = "NHD"
                result["tested_head_dims"] = tested_head_dims
                result["tested_variants"] = ["fixed-64", "fixed-128", "varlen-64", "backward-64"]
                result["all_finite"] = True
                result["max_abs_diff_vs_sdpa"] = max(forward_diffs) if forward_diffs else None
                result["varlen_ok"] = True
                result["varlen_max_abs_diff_vs_sdpa"] = varlen_diff
                result["backward_ok"] = True
                result["backward_loss"] = backward_loss
                print(json.dumps(result, ensure_ascii=False))
                return
            except Exception as exc:
                last_error = short_exc(exc)
                last_traceback = traceback.format_exc(limit=6)

        result["runtime_error"] = last_error or "AMD ROCm Sage self-test failed."
        result["traceback_tail"] = last_traceback.strip()
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        result["runtime_error"] = short_exc(exc)
        result["traceback_tail"] = traceback.format_exc(limit=6).strip()
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
