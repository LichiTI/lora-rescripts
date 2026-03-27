
import asyncio
import os
import sys
from pathlib import Path
from typing import Optional

import toml

from mikazuki.app.models import APIResponse
from mikazuki.launch_utils import base_dir_path
from mikazuki.log import log
from mikazuki.tasks import tm


def prepare_python_script(script_path, environ=None):
    resolved_path = Path(script_path)
    if not resolved_path.is_absolute():
        resolved_path = base_dir_path() / resolved_path
    resolved_path = resolved_path.resolve()

    customize_env = (environ or os.environ).copy()
    return resolved_path, customize_env


def get_script_runner_path():
    return base_dir_path() / "mikazuki" / "script_runner.py"


def apply_windows_accelerate_env(customize_env: dict):
    if sys.platform == "win32":
        # Some Windows PyTorch wheels ship without libuv-enabled TCPStore support.
        customize_env["USE_LIBUV"] = "0"


def build_accelerate_launch_args(
    script_runner: Path,
    trainer_path: Path,
    toml_path: str,
    cpu_threads: int,
    *,
    quiet: bool = True,
    num_processes: int = 1,
):
    args = [
        sys.executable,
        "-m",
        "accelerate.commands.launch",
        "--num_cpu_threads_per_process",
        str(cpu_threads),
    ]

    if num_processes > 1:
        args.extend(["--multi_gpu", "--num_processes", str(num_processes)])
        if sys.platform == "win32":
            args.extend(["--rdzv_backend", "c10d"])

    if quiet:
        args.append("--quiet")

    args.extend(
        [
            str(script_runner),
            str(trainer_path),
            "--config_file",
            toml_path,
        ]
    )
    return args


def build_staged_resolution_runner_args(
    runner_path: Path,
    trainer_path: Path,
    toml_path: str,
    cpu_threads: int,
    *,
    quiet: bool = True,
    num_processes: int = 1,
):
    args = [
        sys.executable,
        str(runner_path),
        "--config_file",
        toml_path,
        "--trainer_file",
        str(trainer_path),
        "--num_cpu_threads_per_process",
        str(cpu_threads),
        "--num_processes",
        str(num_processes),
    ]
    if quiet:
        args.append("--quiet")
    return args


def run_train(
    toml_path: str,
    trainer_file: str = "./scripts/train_network.py",
    gpu_ids: Optional[list] = None,
    cpu_threads: Optional[int] = 2,
):
    log.info(f"Training started with config file / 训练开始，使用配置文件: {toml_path}")
    trainer_path, customize_env = prepare_python_script(trainer_file)

    try:
        config_data = toml.load(toml_path)
    except Exception:
        config_data = {}

    customize_env["ACCELERATE_DISABLE_RICH"] = "1"
    customize_env["PYTHONUNBUFFERED"] = "1"
    customize_env["PYTHONWARNINGS"] = "ignore::FutureWarning,ignore::UserWarning"
    apply_windows_accelerate_env(customize_env)

    num_processes = 1
    if gpu_ids:
        customize_env["CUDA_VISIBLE_DEVICES"] = ",".join(gpu_ids)
        log.info(f"Using GPU(s) / 使用 GPU: {gpu_ids}")
        num_processes = len(gpu_ids)
        log.info(f"Final training GPU selection / 最终参与训练的 GPU: {', '.join(gpu_ids)}")
    else:
        log.info("Final training GPU selection / 最终参与训练的 GPU: default visible CUDA device")

    if bool(config_data.get("enable_mixed_resolution_training")):
        runner_path = base_dir_path() / "mikazuki" / "staged_resolution_runner.py"
        args = build_staged_resolution_runner_args(
            runner_path,
            trainer_path,
            toml_path,
            int(cpu_threads),
            quiet=True,
            num_processes=num_processes,
        )
    else:
        script_runner = get_script_runner_path()
        args = build_accelerate_launch_args(
            script_runner,
            trainer_path,
            toml_path,
            int(cpu_threads),
            quiet=True,
            num_processes=num_processes,
        )

    if not (task := tm.create_task(args, customize_env)):
        return APIResponse(status="error", message="Failed to create task / 无法创建训练任务")

    def _run():
        try:
            task.execute()
            result = task.communicate()
            if result.returncode != 0:
                log.error("Training failed / 训练失败")
            else:
                log.info("Training finished / 训练完成")
        except Exception as exc:
            log.error(f"An error occurred when training / 训练出现致命错误: {exc}")

    coro = asyncio.to_thread(_run)
    asyncio.create_task(coro)

    return APIResponse(
        status="success",
        message=f"Training started / 训练开始 ID: {task.task_id}",
        data={"task_id": task.task_id},
    )
