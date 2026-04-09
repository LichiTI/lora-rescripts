from __future__ import annotations

import importlib.metadata as md
import json
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


def sync(torch, device) -> None:
    torch.cuda.synchronize(device)


def all_finite_tensors(torch, tensors) -> bool:
    for tensor in tensors:
        if tensor is None:
            return False
        if not bool(torch.isfinite(tensor).all().item()):
            return False
    return True


def emit_result(result: dict[str, object]) -> None:
    print(json.dumps(result, ensure_ascii=False, indent=2))


def run_matmul_case(torch, *, device, dtype):
    left = torch.randn((256, 256), device=device, dtype=dtype, requires_grad=True)
    right = torch.randn((256, 256), device=device, dtype=dtype, requires_grad=True)
    out = left @ right
    loss = out.float().square().mean()
    loss.backward()
    sync(torch, device)

    ok = bool(torch.isfinite(out).all().item()) and all_finite_tensors(torch, (left.grad, right.grad))
    return ok, float(loss.detach().float().item()), list(out.shape)


def run_sdpa_case(torch, *, device, dtype):
    batch = 1
    heads = 4
    seq_len = 32
    head_dim = 64

    q = torch.randn((batch, heads, seq_len, head_dim), device=device, dtype=dtype, requires_grad=True)
    k = torch.randn((batch, heads, seq_len, head_dim), device=device, dtype=dtype, requires_grad=True)
    v = torch.randn((batch, heads, seq_len, head_dim), device=device, dtype=dtype, requires_grad=True)

    out = torch.nn.functional.scaled_dot_product_attention(
        q,
        k,
        v,
        attn_mask=None,
        dropout_p=0.0,
        is_causal=False,
    )
    loss = out.float().square().mean()
    loss.backward()
    sync(torch, device)

    ok = bool(torch.isfinite(out).all().item()) and all_finite_tensors(torch, (q.grad, k.grad, v.grad))
    return ok, float(loss.detach().float().item()), list(out.shape)


def run_conv_adamw_case(torch, *, device):
    model = torch.nn.Sequential(
        torch.nn.Conv2d(4, 8, kernel_size=3, padding=1),
        torch.nn.SiLU(),
        torch.nn.Conv2d(8, 4, kernel_size=3, padding=1),
    ).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

    inputs = torch.randn((1, 4, 32, 32), device=device, dtype=torch.float32)
    target = torch.randn((1, 4, 32, 32), device=device, dtype=torch.float32)

    optimizer.zero_grad(set_to_none=True)
    out = model(inputs)
    loss = torch.nn.functional.mse_loss(out, target)
    loss.backward()
    optimizer.step()
    sync(torch, device)

    params = [param.detach() for param in model.parameters()]
    ok = bool(torch.isfinite(out).all().item()) and all_finite_tensors(torch, params)
    return ok, float(loss.detach().float().item()), list(out.shape)


def main() -> int:
    result: dict[str, object] = {
        "success": False,
        "python_version": "",
        "torch_version": "",
        "torchvision_version": "",
        "hip_version": "",
        "cuda_available": False,
        "gpu_count": 0,
        "gpu_name": "",
        "bf16_supported": None,
        "preferred_dtype": "",
        "tested_cases": [],
        "case_losses": {},
        "case_shapes": {},
        "runtime_error": "",
        "traceback_tail": "",
    }

    try:
        import torch

        result["python_version"] = sys.version.split()[0]
        result["torch_version"] = str(getattr(torch, "__version__", "") or "")
        result["torchvision_version"] = metadata_version("torchvision")
        result["hip_version"] = str(getattr(torch.version, "hip", "") or "")
        result["cuda_available"] = bool(torch.cuda.is_available())

        if not result["hip_version"]:
            result["runtime_error"] = "Torch is not a ROCm build."
            emit_result(result)
            return 1

        if not result["cuda_available"]:
            result["runtime_error"] = "ROCm GPU is not available to Torch."
            emit_result(result)
            return 1

        gpu_count = int(torch.cuda.device_count())
        result["gpu_count"] = gpu_count
        if gpu_count <= 0:
            result["runtime_error"] = "No AMD GPU is visible to Torch."
            emit_result(result)
            return 1

        device = torch.device("cuda:0")
        result["gpu_name"] = str(torch.cuda.get_device_name(0) or "")

        try:
            if hasattr(torch.cuda, "is_bf16_supported"):
                result["bf16_supported"] = bool(torch.cuda.is_bf16_supported())
        except Exception:
            result["bf16_supported"] = None

        candidate_dtypes = []
        if result["bf16_supported"] is not False:
            candidate_dtypes.append(torch.bfloat16)
        candidate_dtypes.append(torch.float16)

        last_error = ""
        last_traceback = ""

        for dtype in candidate_dtypes:
            try:
                tested_cases: list[str] = []
                case_losses: dict[str, float] = {}
                case_shapes: dict[str, list[int]] = {}

                matmul_ok, matmul_loss, matmul_shape = run_matmul_case(torch, device=device, dtype=dtype)
                if not matmul_ok:
                    raise RuntimeError("matmul backward produced non-finite values")
                tested_cases.append("matmul_backward")
                case_losses["matmul_backward"] = matmul_loss
                case_shapes["matmul_backward"] = matmul_shape

                sdpa_ok, sdpa_loss, sdpa_shape = run_sdpa_case(torch, device=device, dtype=dtype)
                if not sdpa_ok:
                    raise RuntimeError("scaled_dot_product_attention backward produced non-finite values")
                tested_cases.append("sdpa_backward")
                case_losses["sdpa_backward"] = sdpa_loss
                case_shapes["sdpa_backward"] = sdpa_shape

                conv_ok, conv_loss, conv_shape = run_conv_adamw_case(torch, device=device)
                if not conv_ok:
                    raise RuntimeError("conv2d + AdamW step produced non-finite values")
                tested_cases.append("conv2d_adamw_step")
                case_losses["conv2d_adamw_step"] = conv_loss
                case_shapes["conv2d_adamw_step"] = conv_shape

                result["success"] = True
                result["preferred_dtype"] = str(dtype).replace("torch.", "")
                result["tested_cases"] = tested_cases
                result["case_losses"] = case_losses
                result["case_shapes"] = case_shapes
                emit_result(result)
                return 0
            except Exception as exc:
                last_error = short_exc(exc)
                last_traceback = traceback.format_exc(limit=6)

        result["runtime_error"] = last_error or "AMD ROCm training self-test failed."
        result["traceback_tail"] = last_traceback.strip()
        emit_result(result)
        return 1
    except Exception as exc:
        result["runtime_error"] = short_exc(exc)
        result["traceback_tail"] = traceback.format_exc(limit=6).strip()
        emit_result(result)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
