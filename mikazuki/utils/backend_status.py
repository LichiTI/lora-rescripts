from __future__ import annotations

import json
import os
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

from mikazuki.launch_utils import base_dir_path
from mikazuki.log import log


BACKEND_STATUS_FILE_ENV = "MIKAZUKI_BACKEND_STATUS_FILE"
_restart_lock = threading.Lock()
_restart_pending = False


def get_backend_status_file() -> Path:
    configured = str(os.environ.get(BACKEND_STATUS_FILE_ENV, "") or "").strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return (base_dir_path() / "tmp" / "backend_status.json").resolve()


def read_backend_status() -> dict:
    fallback = {
        "status": "unknown",
        "detail": "",
        "updated_at": "",
    }
    status_file = get_backend_status_file()
    if not status_file.exists():
        return fallback

    try:
        with open(status_file, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        if not isinstance(data, dict):
            return fallback
        return {
            "status": str(data.get("status", fallback["status"]) or fallback["status"]),
            "detail": str(data.get("detail", fallback["detail"]) or ""),
            "updated_at": str(data.get("updated_at", fallback["updated_at"]) or ""),
        }
    except Exception as exc:
        log.warning(f"Failed to read backend status file: {exc}")
        return fallback


def write_backend_status(status: str, detail: str = "") -> dict:
    payload = {
        "status": str(status or "unknown").strip() or "unknown",
        "detail": str(detail or "").strip(),
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }
    status_file = get_backend_status_file()
    status_file.parent.mkdir(parents=True, exist_ok=True)
    with open(status_file, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    return payload


def _restart_worker(delay_seconds: float) -> None:
    global _restart_pending

    try:
        write_backend_status("restarting", "正在关闭当前后端并重新拉起进程。")
        time.sleep(max(0.1, float(delay_seconds)))

        argv = [sys.executable, *sys.argv]
        log.info(f"Restarting backend with argv: {argv}")
        os.execv(sys.executable, argv)
    except Exception as exc:
        log.exception("Backend restart failed")
        write_backend_status("failed", f"后端重启失败: {exc}")
        with _restart_lock:
            _restart_pending = False


def request_backend_restart(delay_seconds: float = 0.8) -> tuple[bool, str]:
    global _restart_pending

    with _restart_lock:
        if _restart_pending:
            return False, "后端重启已在进行中。"
        _restart_pending = True

    thread = threading.Thread(
        target=_restart_worker,
        args=(delay_seconds,),
        name="mikazuki-backend-restart",
        daemon=False,
    )
    thread.start()
    return True, "后端重启请求已提交。"
