import importlib
import os
import sys

from mikazuki.log import log
from packaging.version import Version

available_devices = []
printable_devices = []
xformers_status = {
    "checked": False,
    "installed": False,
    "supported": False,
    "verified": False,
    "version": None,
    "reason": "Not checked yet.",
    "per_gpu": {},
}


def _infer_attention_runtime_mode() -> str:
    if os.environ.get("MIKAZUKI_SAGEATTENTION_STARTUP") == "1" or os.environ.get("MIKAZUKI_SAGEATTENTION2_STARTUP") == "1":
        return "sageattention"
    if os.environ.get("MIKAZUKI_BLACKWELL_STARTUP") == "1":
        return "blackwell"

    executable = sys.executable.replace("\\", "/").lower()
    if "/python-sageattention-latest/" in executable or "/python_sageattention_latest/" in executable:
        return "sageattention"
    if "/python-sageattention-blackwell/" in executable or "/python_sageattention_blackwell/" in executable:
        return "sageattention"
    if "/python-sageattention/" in executable or "/python_sageattention/" in executable:
        return "sageattention"
    if "/python_blackwell/" in executable:
        return "blackwell"
    return "standard"


def get_attention_runtime_mode() -> str:
    return _infer_attention_runtime_mode()


def _probe_sageattention_status(torch_module) -> dict:
    status = {
        "installed": False,
        "importable": False,
        "symbols_ok": False,
        "reason": "Not checked yet.",
    }

    try:
        importlib.import_module("triton")
    except Exception as exc:
        status["reason"] = f"triton import failed: {_short_exc_message(exc)}"
        return status

    try:
        sage_module = importlib.import_module("sageattention")
        sageattn = getattr(sage_module, "sageattn", None)
        sageattn_varlen = getattr(sage_module, "sageattn_varlen", None)
        status["installed"] = True
        status["importable"] = True
        status["symbols_ok"] = callable(sageattn) and callable(sageattn_varlen)
        if status["symbols_ok"]:
            status["reason"] = "ok"
        else:
            status["reason"] = "required SageAttention symbols are missing."
    except Exception as exc:
        status["reason"] = f"sageattention import failed: {_short_exc_message(exc)}"

    if not torch_module.cuda.is_available() and status["reason"] == "ok":
        status["reason"] = "CUDA is not available."

    return status


def _build_attention_backend_summary(torch_module, xformers_info: dict) -> dict:
    runtime_mode = _infer_attention_runtime_mode()
    sdpa_available = bool(
        torch_module.cuda.is_available() and hasattr(torch_module.nn.functional, "scaled_dot_product_attention")
    )
    sageattention_status = _probe_sageattention_status(torch_module)

    preferred_backend = "torch"
    if runtime_mode == "sageattention" and sageattention_status["symbols_ok"] and torch_module.cuda.is_available():
        preferred_backend = "sageattn"
    elif xformers_info.get("supported"):
        preferred_backend = "xformers"
    elif sdpa_available:
        preferred_backend = "sdpa"

    if runtime_mode == "sageattention" and preferred_backend == "sageattn":
        detail = (
            "SageAttention runtime active. Routes that explicitly enable sageattn will use SageAttention; "
            "other xformers configs will fall back to SDPA when supported."
        )
        detail_zh = (
            "当前为 SageAttention 专用运行时。显式启用 sageattn 的训练路由会使用 SageAttention；"
            "其他仍勾选 xformers 的配置在支持时会自动降级到 SDPA。"
        )
    elif preferred_backend == "xformers":
        detail = "xformers is currently the strongest verified attention backend in this runtime."
        detail_zh = "当前运行时里，xformers 是最优先且已验证可用的 attention 后端。"
    elif preferred_backend == "sdpa":
        detail = "SDPA is currently the default fallback attention backend in this runtime."
        detail_zh = "当前运行时里，SDPA 是默认的回退 attention 后端。"
    else:
        detail = "Only the baseline torch attention path is currently available."
        detail_zh = "当前仅可使用基础的 torch attention 路径。"

    return {
        "runtime_mode": runtime_mode,
        "preferred_backend": preferred_backend,
        "sdpa_available": sdpa_available,
        "sageattention": sageattention_status,
        "detail": detail,
        "detail_zh": detail_zh,
    }


def _short_exc_message(exc) -> str:
    message = str(exc).strip()
    if not message:
        return exc.__class__.__name__
    return message.splitlines()[0]


def _is_inconclusive_xformers_probe_error(reason: str) -> bool:
    lowered = reason.lower()
    return (
        "no operator found" in lowered
        or "memory_efficient_attention_forward" in lowered
        or "operator wasn't built" in lowered
        or "no kernel image is available for execution on the device" in lowered
        or "no kernel image available for execution on the device" in lowered
    )


def _probe_xformers_runtime(torch_module, device):
    import xformers.ops as xops

    last_reason = ""
    tested_dtypes = []
    tested_shapes = []
    probe_shapes = [
        (1, 32, 8, 64),
        (1, 256, 8, 64),
        (1, 1024, 8, 64),
    ]

    for dtype in (torch_module.float16, torch_module.bfloat16):
        tested_dtypes.append(str(dtype).replace("torch.", ""))
        for shape in probe_shapes:
            tested_shapes.append(f"{str(dtype).replace('torch.', '')}:{shape}")
            try:
                q = torch_module.randn(shape, device=device, dtype=dtype)
                k = torch_module.randn(shape, device=device, dtype=dtype)
                v = torch_module.randn(shape, device=device, dtype=dtype)
                xops.memory_efficient_attention(q, k, v, attn_bias=None)
                torch_module.cuda.synchronize(device)
                return {
                    "supported": True,
                    "verified": True,
                    "reason": f"ok ({str(dtype).replace('torch.', '')}, shape={shape})",
                }
            except Exception as exc:
                last_reason = _short_exc_message(exc)

    capability = torch_module.cuda.get_device_capability(device)
    if capability[0] >= 12 and _is_inconclusive_xformers_probe_error(last_reason):
        return {
            "supported": True,
            "verified": False,
            "reason": (
                "runtime probe was inconclusive on this newer GPU architecture "
                f"(tested: {', '.join(tested_shapes)}; last error: {last_reason})"
            ),
        }

    return {
        "supported": False,
        "verified": False,
        "reason": last_reason or f"runtime probe failed for {', '.join(tested_shapes)}",
    }


def refresh_xformers_status(torch_module=None):
    if torch_module is None:
        import torch as torch_module

    xformers_status["checked"] = True
    xformers_status["installed"] = False
    xformers_status["supported"] = False
    xformers_status["verified"] = False
    xformers_status["version"] = None
    xformers_status["reason"] = "Not checked yet."
    xformers_status["per_gpu"] = {}

    if not torch_module.cuda.is_available():
        xformers_status["reason"] = "CUDA is not available."
        return xformers_status

    try:
        import xformers
        import xformers.ops as xops  # noqa: F401
    except Exception as exc:
        xformers_status["reason"] = f"xformers import failed: {_short_exc_message(exc)}"
        return xformers_status

    xformers_status["installed"] = True
    xformers_status["version"] = getattr(xformers, "__version__", "unknown")

    overall_supported = True
    overall_verified = True
    first_reason = ""

    for gpu_index in range(torch_module.cuda.device_count()):
        device_name = torch_module.cuda.get_device_name(gpu_index)
        try:
            device = torch_module.device(f"cuda:{gpu_index}")
            probe_result = _probe_xformers_runtime(torch_module, device)
            gpu_status = {
                "name": device_name,
                "supported": probe_result["supported"],
                "verified": probe_result["verified"],
                "reason": probe_result["reason"],
            }
            xformers_status["per_gpu"][gpu_index] = gpu_status

            if not gpu_status["supported"]:
                overall_supported = False
                overall_verified = False
                if not first_reason:
                    first_reason = f"GPU {gpu_index} ({device_name}): {gpu_status['reason']}"
            elif not gpu_status["verified"]:
                overall_verified = False
                if not first_reason:
                    first_reason = f"GPU {gpu_index} ({device_name}): {gpu_status['reason']}"
        except Exception as exc:
            reason = _short_exc_message(exc)
            xformers_status["per_gpu"][gpu_index] = {
                "name": device_name,
                "supported": False,
                "verified": False,
                "reason": reason,
            }
            overall_supported = False
            overall_verified = False
            if not first_reason:
                first_reason = f"GPU {gpu_index} ({device_name}): {reason}"
        finally:
            if torch_module.cuda.is_available():
                torch_module.cuda.empty_cache()

    xformers_status["supported"] = overall_supported
    xformers_status["verified"] = overall_verified
    if overall_supported and overall_verified:
        xformers_status["reason"] = "ok"
    elif overall_supported:
        xformers_status["reason"] = first_reason or "xformers is available but runtime probe was inconclusive."
    else:
        xformers_status["reason"] = first_reason
    return xformers_status


def get_xformers_status(gpu_ids=None):
    if not xformers_status["checked"]:
        try:
            refresh_xformers_status()
        except Exception as exc:
            xformers_status["checked"] = True
            xformers_status["installed"] = False
            xformers_status["supported"] = False
            xformers_status["verified"] = False
            xformers_status["version"] = None
            xformers_status["reason"] = f"xformers probe failed: {_short_exc_message(exc)}"
            xformers_status["per_gpu"] = {}

    selected_gpu_ids = []
    if gpu_ids:
        for gpu_id in gpu_ids:
            try:
                selected_gpu_ids.append(int(gpu_id))
            except (TypeError, ValueError):
                continue
    elif xformers_status["per_gpu"]:
        selected_gpu_ids = [min(xformers_status["per_gpu"].keys())]

    if not selected_gpu_ids:
        return {
            **xformers_status,
            "selected_gpu_ids": [],
        }

    selected_info = [
        xformers_status["per_gpu"].get(gpu_id, {
            "name": f"GPU {gpu_id}",
            "supported": False,
            "verified": False,
            "reason": "GPU status not found.",
        })
        for gpu_id in selected_gpu_ids
    ]

    selected_supported = all(info["supported"] for info in selected_info)
    selected_verified = all(info.get("verified", False) for info in selected_info)
    reason = "ok" if selected_supported else next(
        f"GPU {gpu_id} ({info['name']}): {info['reason']}"
        for gpu_id, info in zip(selected_gpu_ids, selected_info)
        if not info["supported"]
    )
    if selected_supported and not selected_verified:
        reason = next(
            f"GPU {gpu_id} ({info['name']}): {info['reason']}"
            for gpu_id, info in zip(selected_gpu_ids, selected_info)
            if not info.get("verified", False)
        )

    return {
        **xformers_status,
        "selected_gpu_ids": selected_gpu_ids,
        "selected_supported": selected_supported,
        "selected_verified": selected_verified,
        "reason": reason,
    }


def check_torch_gpu():
    try:
        import torch
        available_devices.clear()
        printable_devices.clear()
        log.info(f'Torch {torch.__version__}')
        if not torch.cuda.is_available():
            log.error("Torch is not able to use GPU, please check your torch installation.\n Use --skip-prepare-environment to disable this check")
            log.error("！！！Torch 无法使用 GPU，您无法正常开始训练！！！\n您的显卡可能并不支持，或是 torch 安装有误。请检查您的 torch 安装。")
            if "cpu" in torch.__version__:
                log.error("You are using torch CPU, please install torch GPU version by run install script again.")
                log.error("！！！您正在使用 CPU 版本的 torch，无法正常开始训练。请重新运行安装脚本！！！")
            return

        if Version(torch.__version__) < Version("2.3.0"):
            log.warning("Torch version is lower than 2.3.0, which may not be able to train FLUX model properly. Please re-run the installation script (install.ps1 or install.bash) to upgrade Torch.")
            log.warning("！！！Torch 版本低于 2.3.0，将无法正常训练 FLUX 模型。请考虑重新运行安装脚本以升级 Torch！！！")
            log.warning("！！！若您正在使用训练包，请直接下载最新训练包！！！")

        if torch.version.cuda:
            log.info(
                f'Torch backend: nVidia CUDA {torch.version.cuda} cuDNN {torch.backends.cudnn.version() if torch.backends.cudnn.is_available() else "N/A"}')
        elif torch.version.hip:
            log.info(f'Torch backend: AMD ROCm HIP {torch.version.hip}')

        devices = [torch.cuda.device(i) for i in range(torch.cuda.device_count())]

        for pos, device in enumerate(devices):
            name = torch.cuda.get_device_name(device)
            memory = torch.cuda.get_device_properties(device).total_memory
            available_devices.append(device)
            printable_devices.append(f"GPU {pos}: {name} ({round(memory / (1024**3))} GB)")
            log.info(
                f'Torch detected GPU: {name} VRAM {round(memory / 1024 / 1024)} Arch {torch.cuda.get_device_capability(device)} Cores {torch.cuda.get_device_properties(device).multi_processor_count}')

        status = refresh_xformers_status(torch)
        attention_summary = _build_attention_backend_summary(torch, status)
        log.info(f"Running on attention backend: {attention_summary['preferred_backend']}")
        log.info(f"当前运行的注意力后端：{attention_summary['preferred_backend']}")
        log.info(
            "Attention backend summary: "
            f"preferred={attention_summary['preferred_backend']} | "
            f"runtime={attention_summary['runtime_mode']} | "
            f"xformers={'ready' if status.get('supported') else 'unavailable'} | "
            f"sdpa={'ready' if attention_summary['sdpa_available'] else 'unavailable'} | "
            f"sageattn={'ready' if attention_summary['sageattention']['symbols_ok'] else 'unavailable'}"
        )
        log.info(attention_summary["detail"])
        log.info(f"注意力后端摘要：当前优先后端={attention_summary['preferred_backend']}。{attention_summary['detail_zh']}")

        if not status["installed"]:
            if attention_summary["runtime_mode"] == "sageattention" and attention_summary["sageattention"]["symbols_ok"]:
                log.info(
                    f"xformers is not installed in this SageAttention runtime: {status['reason']}"
                )
                log.info(
                    "This is expected for the dedicated SageAttention runtime. xformers-style configs will fall back to SDPA here."
                )
                log.info(
                    f"SageAttention 专用运行时中未安装 xformers：{status['reason']}。这属于预期行为；若训练配置仍启用了 xformers，这里会回退到 sdpa。"
                )
            else:
                log.warning(
                    f"xformers is not available in the current environment: {status['reason']}"
                )
                log.warning(
                    "When a training config enables xformers, Mikazuki will automatically fall back to SDPA when possible."
                )
                log.warning(
                    f"当前环境不可用 xformers：{status['reason']}。若训练配置启用了 xformers，Mikazuki 会尽量自动降级到 sdpa。"
                )
        elif not status["supported"]:
            if status.get("version"):
                log.warning(f"xformers version detected: {status['version']}")
            for gpu_index, gpu_status in status["per_gpu"].items():
                if gpu_status["supported"]:
                    continue
                log.warning(
                    f"xformers is not supported on GPU {gpu_index} ({gpu_status['name']}): {gpu_status['reason']}"
                )
                log.warning(
                    f"检测到 GPU {gpu_index}（{gpu_status['name']}）暂不支持 xformers：{gpu_status['reason']}"
                )
            log.warning(
                "Unsupported xformers setups will automatically fall back to SDPA when supported by the trainer."
            )
            log.warning(
                "对于不支持 xformers 的训练配置，启动训练时会自动改用 sdpa（若当前训练器支持）。"
            )
        elif not status.get("verified", False):
            if status.get("version"):
                log.warning(f"xformers version detected: {status['version']}")
            for gpu_index, gpu_status in status["per_gpu"].items():
                if not gpu_status["supported"] or gpu_status.get("verified", False):
                    continue
                log.warning(
                    f"xformers runtime probe is inconclusive on GPU {gpu_index} ({gpu_status['name']}): {gpu_status['reason']}"
                )
                log.warning(
                    f"检测到 GPU {gpu_index}（{gpu_status['name']}）上的 xformers 运行探测结果未确认：{gpu_status['reason']}"
                )
            log.warning(
                "Keeping xformers enabled for these GPUs. If a specific training run still fails, switch that config to SDPA manually."
            )
            log.warning(
                "此类 GPU 仍会保留 xformers 可用状态；若某个训练器实际运行仍报错，请再手动切换到 sdpa。"
            )
        else:
            version_suffix = f" (xformers {status['version']})" if status.get("version") else ""
            log.info(f"xformers runtime probe passed on all detected GPUs.{version_suffix}")
    except Exception as e:
        log.error(f'Could not load torch: {e}')
