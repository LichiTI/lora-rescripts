from __future__ import annotations

from mikazuki.launch_utils import base_dir_path
from mikazuki.utils.runtime_installer import RuntimeDependencyInstaller, RuntimeInstallerSpec


AESTHETIC_RUNTIME_STATUS_FILE = (base_dir_path() / "tmp" / "aesthetic_runtime_status.json").resolve()
AESTHETIC_INSTALL_REQUIREMENT_SPECS = {
    "open_clip": "open-clip-torch==2.20.0",
    "timm": "timm>=1.0.0",
    "transformers": "transformers==4.54.1",
    "safetensors": "safetensors==0.5.3",
    "PIL": "pillow>=10,<12",
    "tqdm": "tqdm>=4.27",
}


def _build_aesthetic_runtime_payload(_dependency_report: dict, _install_status: dict) -> dict:
    return {
        "support": {
            "training": True,
            "batch_inference": True,
            "labeling": False,
        },
    }


_aesthetic_installer = RuntimeDependencyInstaller(
    RuntimeInstallerSpec(
        training_type="aesthetic-scorer",
        display_name="美学评分",
        status_file=AESTHETIC_RUNTIME_STATUS_FILE,
        requirement_specs=AESTHETIC_INSTALL_REQUIREMENT_SPECS,
        ready_detail="美学评分运行依赖已就绪。",
        missing_detail="检测到美学评分运行依赖缺失，可点击下方按钮安装。",
        running_detail="正在安装美学评分运行依赖，请等待安装日志输出。",
        completed_detail="美学评分依赖安装完成。为确保当前运行时重新加载新模块，请重启后端。",
        already_ready_message="当前美学评分运行依赖已经齐全，无需再次安装。",
        already_running_message="美学评分依赖安装任务已经在运行中。",
        install_started_message="美学评分依赖安装任务已启动。",
        ready_reset_statuses=("idle", "ready"),
        restart_requires_new_pid=True,
        payload_builder=_build_aesthetic_runtime_payload,
    )
)


def build_aesthetic_runtime_payload() -> dict:
    return _aesthetic_installer.build_payload()


def start_aesthetic_dependency_install() -> tuple[bool, str, dict]:
    return _aesthetic_installer.start_install()
