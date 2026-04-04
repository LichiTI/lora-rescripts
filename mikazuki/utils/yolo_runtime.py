from __future__ import annotations

from mikazuki.launch_utils import base_dir_path
from mikazuki.utils.direct_trainers import YOLO_LOCAL_REPO
from mikazuki.utils.runtime_installer import RuntimeDependencyInstaller, RuntimeInstallerSpec


YOLO_RUNTIME_STATUS_FILE = (base_dir_path() / "tmp" / "yolo_runtime_status.json").resolve()
YOLO_INSTALL_REQUIREMENT_SPECS = {
    "cv2": "opencv-python>=4.6.0",
    "matplotlib": "matplotlib>=3.3.0",
    "scipy": "scipy>=1.4.1",
    "polars": "polars>=0.20.0",
    "requests": "requests>=2.23.0",
    "psutil": "psutil>=5.8.0",
    "PIL": "pillow>=7.1.2",
    "yaml": "pyyaml>=5.3.1",
    "torchvision": "torchvision>=0.9.0",
}


def _build_yolo_runtime_payload(_dependency_report: dict, _install_status: dict) -> dict:
    return {
        "repo_exists": YOLO_LOCAL_REPO.exists() and YOLO_LOCAL_REPO.is_dir(),
        "repo_path": str(YOLO_LOCAL_REPO),
        "support": {
            "train_wrapper": True,
            "data_yaml_autogen": True,
            "custom_data_yaml": True,
            "image_resize_tool": True,
            "dataset_analysis_tool": False,
            "annotation_conversion_tool": False,
            "bbox_label_visualizer": False,
            "auto_split_train_val": False,
        },
    }


_yolo_installer = RuntimeDependencyInstaller(
    RuntimeInstallerSpec(
        training_type="yolo",
        display_name="YOLO",
        status_file=YOLO_RUNTIME_STATUS_FILE,
        requirement_specs=YOLO_INSTALL_REQUIREMENT_SPECS,
        ready_detail="YOLO 运行依赖已就绪。",
        missing_detail="检测到 YOLO 运行依赖缺失，可点击下方按钮安装。",
        running_detail="正在安装 YOLO 运行依赖，请等待安装日志输出。",
        completed_detail="YOLO 依赖安装完成。为确保当前运行时重新加载新模块，请重启后端。",
        already_ready_message="当前 YOLO 运行依赖已经齐全，无需再次安装。",
        already_running_message="YOLO 依赖安装任务已经在运行中。",
        install_started_message="YOLO 依赖安装任务已启动。",
        repo_path=YOLO_LOCAL_REPO,
        repo_missing_message=f"未找到内置 Ultralytics 仓库目录: {YOLO_LOCAL_REPO}",
        payload_builder=_build_yolo_runtime_payload,
    )
)


def build_yolo_runtime_payload() -> dict:
    return _yolo_installer.build_payload()


def start_yolo_dependency_install() -> tuple[bool, str, dict]:
    return _yolo_installer.start_install()
