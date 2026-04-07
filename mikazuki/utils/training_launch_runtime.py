from __future__ import annotations

from pathlib import Path

from mikazuki.log import log
from mikazuki.utils.distributed import resolve_distributed_runtime
from mikazuki.utils.distributed_sync import resolve_worker_sync_runtime


def resolve_training_launch_runtime(
    config: dict,
    gpu_ids: list[str],
    *,
    direct_python_training: bool,
    yolo_training: bool,
    base_dir: Path,
) -> dict:
    if direct_python_training:
        warnings: list[str] = []
        if yolo_training and len(gpu_ids) > 1:
            warnings.append(
                "已为 YOLO 保留多张可见 GPU；若未手动填写 device，Ultralytics 会按当前可见显卡自行决定多卡训练方式。"
            )
        return {
            "error_message": None,
            "distributed_runtime": {
                "total_num_processes": 1,
                "warnings": [],
                "notes": [],
                "summary": "当前训练种类直接由独立 Python 训练器启动，不走 accelerate 分布式包装。",
            },
            "worker_sync_runtime": {
                "warnings": [],
                "notes": [],
            },
            "warnings": warnings,
        }

    try:
        distributed_runtime = resolve_distributed_runtime(config, gpu_ids)
    except ValueError as exc:
        return {
            "error_message": str(exc),
            "distributed_runtime": None,
            "worker_sync_runtime": None,
            "warnings": [],
        }
    except Exception:
        log.exception("Distributed runtime resolution failed unexpectedly")
        return {
            "error_message": "分布式运行时解析失败，请查看日志。",
            "distributed_runtime": None,
            "worker_sync_runtime": None,
            "warnings": [],
        }

    warnings = [
        *distributed_runtime.get("warnings", []),
        *distributed_runtime.get("notes", []),
    ]
    if int(distributed_runtime.get("total_num_processes", 1) or 1) > 1:
        warnings.append(
            "当前为多进程/分布式训练：train_batch_size 将按全局 batch 解释，启动时会自动换算成每卡 batch。"
        )

    try:
        worker_sync_runtime = resolve_worker_sync_runtime(config, distributed_runtime, base_dir)
    except ValueError as exc:
        return {
            "error_message": str(exc),
            "distributed_runtime": None,
            "worker_sync_runtime": None,
            "warnings": warnings,
        }
    except Exception:
        log.exception("Worker sync runtime resolution failed unexpectedly")
        return {
            "error_message": "分布式同步运行时解析失败，请查看日志。",
            "distributed_runtime": None,
            "worker_sync_runtime": None,
            "warnings": warnings,
        }

    warnings.extend(worker_sync_runtime.get("warnings", []))
    warnings.extend(worker_sync_runtime.get("notes", []))
    return {
        "error_message": None,
        "distributed_runtime": distributed_runtime,
        "worker_sync_runtime": worker_sync_runtime,
        "warnings": warnings,
    }
