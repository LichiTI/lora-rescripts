from __future__ import annotations

import argparse
import csv
from collections import deque
from contextlib import contextmanager
from datetime import datetime
import logging
import math
import os
from pathlib import Path
import platform
import subprocess
import sys
import time
import traceback
from typing import Any, Optional

import torch
from library import anima_train_utils


logger = logging.getLogger(__name__)

_BaseAnimaStepTimingProfiler = anima_train_utils.AnimaStepTimingProfiler


def _utc_timestamp() -> str:
    return datetime.utcnow().strftime("%Y%m%d-%H%M%S")


def _safe_json_value(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, argparse.Namespace):
        return _safe_json_value(vars(value))
    if isinstance(value, dict):
        return {str(key): _safe_json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, deque)):
        return [_safe_json_value(item) for item in value]
    if isinstance(value, torch.dtype):
        return str(value)
    if isinstance(value, torch.device):
        return str(value)
    return str(value)


def _detect_windows_video_controllers() -> list[dict[str, str]]:
    if os.name != "nt":
        return []

    try:
        completed = subprocess.run(
            ["wmic", "path", "win32_VideoController", "get", "Name,DriverVersion", "/format:csv"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=10,
            check=False,
        )
    except Exception:
        return []

    rows: list[dict[str, str]] = []
    stdout = str(completed.stdout or "").strip()
    if not stdout:
        return rows

    try:
        reader = csv.DictReader(line for line in stdout.splitlines() if line.strip())
        for row in reader:
            name = str(row.get("Name", "") or "").strip()
            driver_version = str(row.get("DriverVersion", "") or "").strip()
            if not name and not driver_version:
                continue
            rows.append(
                {
                    "name": name,
                    "driver_version": driver_version,
                }
            )
    except Exception:
        return []

    return rows


def _build_runtime_probe() -> dict[str, Any]:
    hip_version = str(getattr(torch.version, "hip", "") or "")
    cuda_available = False
    gpu_names: list[str] = []
    gpu_count = 0
    bf16_supported = None

    try:
        cuda_available = bool(torch.cuda.is_available())
    except Exception:
        cuda_available = False

    try:
        if cuda_available:
            gpu_count = int(torch.cuda.device_count())
            gpu_names = [str(torch.cuda.get_device_name(index) or "").strip() for index in range(gpu_count)]
    except Exception:
        gpu_count = 0
        gpu_names = []

    try:
        if hasattr(torch.cuda, "is_bf16_supported"):
            bf16_supported = bool(torch.cuda.is_bf16_supported())
    except Exception:
        bf16_supported = None

    return {
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "torch": str(getattr(torch, "__version__", "") or ""),
        "hip_version": hip_version,
        "cuda_available": cuda_available,
        "gpu_count": gpu_count,
        "gpu_names": gpu_names,
        "bf16_supported": bf16_supported,
        "video_controllers": _detect_windows_video_controllers(),
    }


class AmdAnimaDiagnosticsMonitor:
    def __init__(self, args: argparse.Namespace, *, route_label: str = "Anima AMD experimental") -> None:
        self.args = args
        self.route_label = route_label
        self.runtime_probe = _build_runtime_probe()
        self.snapshot_dir = self._resolve_snapshot_dir(args)
        self.started_at = time.time()
        self.recent_losses: deque[dict[str, Any]] = deque(maxlen=128)
        self.recent_grad_norms: deque[dict[str, Any]] = deque(maxlen=64)
        self.recent_memory: deque[dict[str, Any]] = deque(maxlen=64)
        self.recent_windows: deque[dict[str, Any]] = deque(maxlen=32)
        self.events: deque[dict[str, Any]] = deque(maxlen=128)
        self.optimizer_steps_observed = 0
        self.last_global_step_hint = 0
        self.last_epoch_hint = 0
        self.last_preview_step = None
        self.last_preview_epoch = None
        self.last_preview_timestamp = None
        self.last_loss_value = None
        self.last_grad_norm = None
        self.last_memory_snapshot = None
        self.latest_report_path = None

    def _resolve_snapshot_dir(self, args: argparse.Namespace) -> Path:
        output_dir = str(getattr(args, "output_dir", "") or "").strip()
        root = Path(output_dir) if output_dir else Path.cwd()
        snapshot_dir = root / "amd_diagnostics"
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        return snapshot_dir

    def _build_args_snapshot(self) -> dict[str, Any]:
        payload = {}
        for key, value in vars(self.args).items():
            if key.startswith("_amd_"):
                continue
            payload[key] = _safe_json_value(value)
        return payload

    def record_event(self, message: str, *, level: str = "info", extra: Optional[dict[str, Any]] = None) -> None:
        entry = {
            "timestamp": time.time(),
            "level": level,
            "message": str(message),
        }
        if extra:
            entry["extra"] = _safe_json_value(extra)
        self.events.append(entry)

    def record_loss(self, loss_value: float) -> None:
        try:
            normalized = float(loss_value)
        except Exception:
            normalized = float("nan")
        self.last_loss_value = normalized
        self.recent_losses.append(
            {
                "timestamp": time.time(),
                "optimizer_steps_observed": self.optimizer_steps_observed,
                "global_step_hint": self.last_global_step_hint,
                "loss": normalized,
                "finite": math.isfinite(normalized),
            }
        )

    def record_grad_norm(self, grad_norm: Optional[float], *, non_finite_grad_count: int = 0) -> None:
        normalized = None if grad_norm is None else float(grad_norm)
        self.last_grad_norm = normalized
        self.recent_grad_norms.append(
            {
                "timestamp": time.time(),
                "optimizer_steps_observed": self.optimizer_steps_observed,
                "global_step_hint": self.last_global_step_hint,
                "grad_norm": normalized,
                "non_finite_grad_count": int(non_finite_grad_count),
                "finite": normalized is not None and math.isfinite(normalized),
            }
        )

    def capture_grad_norm_from_network(self, network: torch.nn.Module) -> tuple[Optional[float], int]:
        total_sq = 0.0
        non_finite_grad_count = 0
        seen_grad = False

        for param in network.parameters():
            grad = getattr(param, "grad", None)
            if grad is None:
                continue
            seen_grad = True
            grad_detached = grad.detach()
            if not torch.isfinite(grad_detached).all():
                non_finite_grad_count += 1
                continue
            grad_norm = float(grad_detached.float().pow(2).sum().item())
            total_sq += grad_norm

        if not seen_grad:
            self.record_grad_norm(None, non_finite_grad_count=non_finite_grad_count)
            return None, non_finite_grad_count

        if non_finite_grad_count > 0:
            self.record_grad_norm(float("nan"), non_finite_grad_count=non_finite_grad_count)
            return float("nan"), non_finite_grad_count

        grad_norm_value = math.sqrt(max(total_sq, 0.0))
        self.record_grad_norm(grad_norm_value, non_finite_grad_count=0)
        return grad_norm_value, 0

    def record_memory_snapshot(self, *, label: str, global_step: Optional[int] = None) -> Optional[dict[str, Any]]:
        if not torch.cuda.is_available():
            return None

        try:
            device_index = torch.cuda.current_device()
            allocated = int(torch.cuda.memory_allocated(device_index))
            reserved = int(torch.cuda.memory_reserved(device_index))
            max_allocated = int(torch.cuda.max_memory_allocated(device_index))
            max_reserved = int(torch.cuda.max_memory_reserved(device_index))
            free_bytes = None
            total_bytes = None
            if hasattr(torch.cuda, "mem_get_info"):
                free_bytes, total_bytes = torch.cuda.mem_get_info(device_index)
        except Exception:
            return None

        snapshot = {
            "timestamp": time.time(),
            "label": label,
            "global_step_hint": self.last_global_step_hint if global_step is None else int(global_step),
            "optimizer_steps_observed": self.optimizer_steps_observed,
            "device_index": device_index,
            "allocated_mb": round(allocated / (1024**2), 2),
            "reserved_mb": round(reserved / (1024**2), 2),
            "max_allocated_mb": round(max_allocated / (1024**2), 2),
            "max_reserved_mb": round(max_reserved / (1024**2), 2),
        }
        if free_bytes is not None and total_bytes is not None:
            snapshot["free_mb"] = round(int(free_bytes) / (1024**2), 2)
            snapshot["total_mb"] = round(int(total_bytes) / (1024**2), 2)

        self.last_memory_snapshot = snapshot
        self.recent_memory.append(snapshot)
        return snapshot

    def note_preview(self, *, epoch: Optional[int], global_step: int) -> None:
        self.last_preview_step = int(global_step)
        self.last_preview_epoch = None if epoch is None else int(epoch)
        self.last_preview_timestamp = time.time()
        self.last_global_step_hint = int(global_step)
        if epoch is not None:
            self.last_epoch_hint = int(epoch)

    def note_epoch(self, epoch: int) -> None:
        self.last_epoch_hint = int(epoch)

    def note_global_step(self, global_step: int) -> None:
        self.last_global_step_hint = int(global_step)

    def note_optimizer_step(self, *, next_global_step: Optional[int] = None) -> None:
        self.optimizer_steps_observed += 1
        if next_global_step is not None:
            self.last_global_step_hint = int(next_global_step)

    def record_timing_window(self, global_step: int, profiler: _BaseAnimaStepTimingProfiler) -> None:
        total = float(profiler._window_totals.get("step_total", 0.0))
        if total <= 0 or int(profiler._window_steps) <= 0:
            return

        avg_step_ms = total * 1000.0 / profiler._window_steps
        sections = {}
        for section_name in profiler.SECTION_ORDER:
            elapsed = float(profiler._window_totals.get(section_name, 0.0))
            if elapsed <= 0:
                continue
            sections[section_name] = {
                "avg_ms": round(elapsed * 1000.0 / profiler._window_steps, 2),
                "ratio_pct": round(elapsed / total * 100.0, 2),
            }

        memory_snapshot = self.record_memory_snapshot(label="timing_window", global_step=global_step)
        window_payload = {
            "timestamp": time.time(),
            "global_step": int(global_step),
            "optimizer_steps_observed": self.optimizer_steps_observed,
            "window_steps": int(profiler._window_steps),
            "avg_step_ms": round(avg_step_ms, 2),
            "sections": sections,
            "memory": memory_snapshot,
            "last_loss": self.last_loss_value,
            "last_grad_norm": self.last_grad_norm,
        }
        self.recent_windows.append(window_payload)

        summary_parts = [
            f"step={global_step}",
            f"avg_step={avg_step_ms:.2f} ms",
        ]
        if self.last_loss_value is not None:
            summary_parts.append(f"loss={self.last_loss_value:.6f}")
        if self.last_grad_norm is not None:
            if math.isfinite(self.last_grad_norm):
                summary_parts.append(f"grad_norm={self.last_grad_norm:.6f}")
            else:
                summary_parts.append("grad_norm=non-finite")
        if memory_snapshot is not None:
            summary_parts.append(f"alloc={memory_snapshot['allocated_mb']:.2f} MB")
            summary_parts.append(f"reserved={memory_snapshot['reserved_mb']:.2f} MB")
            summary_parts.append(f"peak={memory_snapshot['max_allocated_mb']:.2f} MB")

        logger.info(f"{self.route_label} 监控窗口：{' | '.join(summary_parts)}")

    def build_report(self, *, reason: str, exception: Optional[BaseException] = None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "reason": reason,
            "timestamp": time.time(),
            "timestamp_utc": _utc_timestamp(),
            "route_label": self.route_label,
            "runtime_probe": self.runtime_probe,
            "args": self._build_args_snapshot(),
            "env": {
                "MIKAZUKI_AMD_EXPERIMENTAL": str(os.environ.get("MIKAZUKI_AMD_EXPERIMENTAL", "") or ""),
                "MIKAZUKI_PREFERRED_RUNTIME": str(os.environ.get("MIKAZUKI_PREFERRED_RUNTIME", "") or ""),
                "HIP_VISIBLE_DEVICES": str(os.environ.get("HIP_VISIBLE_DEVICES", "") or ""),
                "ROCR_VISIBLE_DEVICES": str(os.environ.get("ROCR_VISIBLE_DEVICES", "") or ""),
                "CUDA_VISIBLE_DEVICES": str(os.environ.get("CUDA_VISIBLE_DEVICES", "") or ""),
            },
            "state": {
                "started_at": self.started_at,
                "optimizer_steps_observed": self.optimizer_steps_observed,
                "last_global_step_hint": self.last_global_step_hint,
                "last_epoch_hint": self.last_epoch_hint,
                "last_preview_step": self.last_preview_step,
                "last_preview_epoch": self.last_preview_epoch,
                "last_preview_timestamp": self.last_preview_timestamp,
                "last_loss_value": self.last_loss_value,
                "last_grad_norm": self.last_grad_norm,
                "last_memory_snapshot": self.last_memory_snapshot,
            },
            "recent_losses": list(self.recent_losses),
            "recent_grad_norms": list(self.recent_grad_norms),
            "recent_memory": list(self.recent_memory),
            "recent_windows": list(self.recent_windows),
            "events": list(self.events),
        }

        if exception is not None:
            payload["exception"] = {
                "type": type(exception).__name__,
                "message": str(exception),
                "traceback": traceback.format_exc(),
            }

        return _safe_json_value(payload)

    def write_report(self, *, reason: str, exception: Optional[BaseException] = None) -> str:
        payload = self.build_report(reason=reason, exception=exception)
        timestamp = _utc_timestamp()
        report_path = self.snapshot_dir / f"amd_diag_{reason}_{timestamp}.json"
        latest_path = self.snapshot_dir / "amd_diag_latest.json"
        report_path.write_text(__import__("json").dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        latest_path.write_text(__import__("json").dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self.latest_report_path = str(report_path)
        logger.warning(f"{self.route_label} 诊断信息已写入：{report_path}")
        return str(report_path)


class AmdAnimaStepTimingProfiler(_BaseAnimaStepTimingProfiler):
    def __init__(self, args: argparse.Namespace, accelerator: Optional[Any], *, route_label: str = "Anima") -> None:
        self._amd_monitor = getattr(args, "_amd_diagnostics_monitor", None)
        super().__init__(args, accelerator, route_label=route_label)

    def log_window_summary(self, global_step: int) -> None:
        super().log_window_summary(global_step)
        if self._amd_monitor is None:
            return
        self._amd_monitor.record_timing_window(global_step, self)


@contextmanager
def patch_anima_timing_profiler():
    original_profiler = anima_train_utils.AnimaStepTimingProfiler
    anima_train_utils.AnimaStepTimingProfiler = AmdAnimaStepTimingProfiler
    try:
        yield
    finally:
        anima_train_utils.AnimaStepTimingProfiler = original_profiler
