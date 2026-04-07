from __future__ import annotations

import os
from typing import Optional

from mikazuki.app.models import APIResponse
from mikazuki.launch_utils import base_dir_path
from mikazuki.log import log
from mikazuki.utils.distributed import resolve_distributed_runtime
from mikazuki.utils.distributed_sync import (
    apply_worker_sync_from_main,
    clear_dataset_npz_cache,
    resolve_worker_sync_runtime,
)
from mikazuki.utils.runtime_mode import (
    is_amd_rocm_runtime,
    is_intel_xpu_runtime,
    resolve_preferred_runtime,
)


def resolve_training_process_runtime(
    config_data: dict,
    gpu_ids: Optional[list],
    *,
    direct_python_trainer: bool,
    direct_launch_summary: str,
    customize_env: dict,
) -> tuple[Optional[dict], Optional[dict], Optional[APIResponse]]:
    if direct_python_trainer:
        distributed_runtime = {
            "enabled": False,
            "is_multi_machine": False,
            "total_num_processes": 1,
            "env_overrides": {},
            "warnings": [],
            "notes": [],
            "summary": direct_launch_summary,
        }
        worker_sync_runtime = {
            "enabled": False,
            "is_worker": False,
            "warnings": [],
            "notes": [],
        }
        return distributed_runtime, worker_sync_runtime, None

    try:
        distributed_runtime = resolve_distributed_runtime(config_data, gpu_ids)
    except ValueError as exc:
        log.warning(f"[distributed] {exc}")
        return None, None, APIResponse(status="error", message=str(exc))
    except Exception as exc:
        log.error(f"[distributed] failed to resolve distributed runtime: {exc}")
        return None, None, APIResponse(status="error", message="分布式运行时解析失败，请检查日志。")

    customize_env.update(distributed_runtime.get("env_overrides", {}))
    for warning in distributed_runtime.get("warnings", []):
        log.warning(f"[distributed] {warning}")
    for note in distributed_runtime.get("notes", []):
        log.info(f"[distributed] {note}")

    try:
        worker_sync_runtime = resolve_worker_sync_runtime(config_data, distributed_runtime, base_dir_path())
    except ValueError as exc:
        log.warning(f"[distributed-sync] {exc}")
        return None, None, APIResponse(status="error", message=str(exc))
    except Exception as exc:
        log.error(f"[distributed-sync] failed to resolve worker sync runtime: {exc}")
        return None, None, APIResponse(status="error", message="分布式同步运行时解析失败，请检查日志。")

    for warning in worker_sync_runtime.get("warnings", []):
        log.warning(f"[distributed-sync] {warning}")
    for note in worker_sync_runtime.get("notes", []):
        log.info(f"[distributed-sync] {note}")

    return distributed_runtime, worker_sync_runtime, None


def apply_training_process_sync_guards(
    toml_path: str,
    config_data: dict,
    worker_sync_runtime: dict,
) -> tuple[dict, Optional[APIResponse]]:
    if worker_sync_runtime.get("enabled"):
        sync_ok, sync_message = apply_worker_sync_from_main(toml_path, worker_sync_runtime, base_dir_path())
        if not sync_ok:
            log.warning(f"[distributed-sync] {sync_message}")
            return config_data, APIResponse(status="error", message=sync_message)
        try:
            import toml

            config_data = toml.load(toml_path)
        except Exception as exc:
            return config_data, APIResponse(status="error", message=f"同步后重新读取训练配置失败: {exc}")

    if bool(config_data.get("clear_dataset_npz_before_train")) and not worker_sync_runtime.get("is_worker"):
        cache_ok, cache_message = clear_dataset_npz_cache(toml_path, base_dir_path())
        if not cache_ok:
            log.warning(f"[cache-reset] {cache_message}")
            return config_data, APIResponse(status="error", message=cache_message)

    return config_data, None


def apply_training_device_visibility(customize_env: dict, gpu_ids: Optional[list]) -> None:
    merged_runtime_env = dict(os.environ)
    merged_runtime_env.update({key: str(value) for key, value in customize_env.items() if value is not None})
    preferred_runtime = resolve_preferred_runtime(merged_runtime_env)
    intel_xpu_runtime = is_intel_xpu_runtime(preferred_runtime) or str(
        customize_env.get("MIKAZUKI_INTEL_XPU_STARTUP")
        or os.environ.get("MIKAZUKI_INTEL_XPU_STARTUP")
        or ""
    ).strip() == "1"
    amd_rocm_runtime = is_amd_rocm_runtime(preferred_runtime) or str(
        customize_env.get("MIKAZUKI_ROCM_AMD_STARTUP")
        or os.environ.get("MIKAZUKI_ROCM_AMD_STARTUP")
        or ""
    ).strip() == "1"

    if gpu_ids:
        if intel_xpu_runtime:
            customize_env["ZE_AFFINITY_MASK"] = ",".join(gpu_ids)
            log.info(f"Using Intel XPU(s) / 使用 Intel XPU: {gpu_ids}")
        elif amd_rocm_runtime:
            selected_gpu_ids = ",".join(gpu_ids)
            customize_env["CUDA_VISIBLE_DEVICES"] = selected_gpu_ids
            customize_env["HIP_VISIBLE_DEVICES"] = selected_gpu_ids
            customize_env["ROCR_VISIBLE_DEVICES"] = selected_gpu_ids
            log.info(f"Using AMD ROCm GPU(s) / 使用 AMD ROCm 显卡: {gpu_ids}")
            log.info(
                "AMD ROCm visibility / AMD ROCm 设备可见性: "
                f"CUDA_VISIBLE_DEVICES={customize_env['CUDA_VISIBLE_DEVICES']} | "
                f"HIP_VISIBLE_DEVICES={customize_env['HIP_VISIBLE_DEVICES']} | "
                f"ROCR_VISIBLE_DEVICES={customize_env['ROCR_VISIBLE_DEVICES']}"
            )
        else:
            customize_env["CUDA_VISIBLE_DEVICES"] = ",".join(gpu_ids)
            log.info(f"Using GPU(s) / 使用 GPU: {gpu_ids}")
        log.info(f"Final training GPU selection / 最终参与训练的 GPU: {', '.join(gpu_ids)}")
        return

    if intel_xpu_runtime:
        log.info("Final training GPU selection / 最终参与训练的 GPU: default visible Intel XPU device")
    elif amd_rocm_runtime:
        log.info("Final training GPU selection / 最终参与训练的 GPU: default visible AMD ROCm device")
    else:
        log.info("Final training GPU selection / 最终参与训练的 GPU: default visible CUDA device")


def resolve_mesh_network_interface(customize_env: dict, distributed_runtime: dict) -> None:
    if not distributed_runtime.get("is_multi_machine"):
        return

    from mikazuki.utils.distributed import pick_training_mesh_iface

    mesh_iface = pick_training_mesh_iface(
        str(distributed_runtime.get("nccl_socket_ifname", "") or ""),
        str(distributed_runtime.get("gloo_socket_ifname", "") or ""),
        str(distributed_runtime.get("main_process_ip", "") or ""),
    )
    if mesh_iface:
        customize_env["MIKAZUKI_MESH_NET_IFACE"] = mesh_iface
        log.info(f"[mesh-net] selected local training interface: {mesh_iface}")
    else:
        log.warning("[mesh-net] distributed training detected but unable to resolve local training interface")
