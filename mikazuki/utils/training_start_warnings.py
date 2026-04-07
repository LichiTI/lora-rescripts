from __future__ import annotations

from typing import Optional


def build_training_resource_warnings(config: dict) -> list[str]:
    warnings: list[str] = []

    cooldown_every_n_epochs = config.get("cooldown_every_n_epochs")
    cooldown_minutes = config.get("cooldown_minutes")
    cooldown_until_temp_c = config.get("cooldown_until_temp_c")
    cooldown_poll_seconds = config.get("cooldown_poll_seconds")

    try:
        cooldown_every_n_epochs_value = int(round(float(cooldown_every_n_epochs)))
    except (TypeError, ValueError):
        cooldown_every_n_epochs_value = None
    try:
        cooldown_minutes_value = float(cooldown_minutes)
    except (TypeError, ValueError):
        cooldown_minutes_value = None
    try:
        cooldown_until_temp_c_value = int(round(float(cooldown_until_temp_c)))
    except (TypeError, ValueError):
        cooldown_until_temp_c_value = None
    try:
        cooldown_poll_seconds_value = int(round(float(cooldown_poll_seconds)))
    except (TypeError, ValueError):
        cooldown_poll_seconds_value = 15

    if cooldown_every_n_epochs_value is not None and cooldown_every_n_epochs_value > 0 and (
        (cooldown_minutes_value is not None and cooldown_minutes_value > 0)
        or (cooldown_until_temp_c_value is not None and cooldown_until_temp_c_value > 0)
    ):
        cooldown_details = [f"每 {cooldown_every_n_epochs_value} 个 epoch 在该轮保存与预览完成后暂停一次"]
        if cooldown_minutes_value is not None and cooldown_minutes_value > 0:
            cooldown_details.append(f"至少等待 {cooldown_minutes_value:g} 分钟")
        if cooldown_until_temp_c_value is not None and cooldown_until_temp_c_value > 0:
            poll_seconds = cooldown_poll_seconds_value or 15
            cooldown_details.append(f"并等待显卡温度降到 {cooldown_until_temp_c_value}°C 以下（每 {poll_seconds} 秒轮询一次）")
        warnings.append("散热冷却已启用：" + "，".join(cooldown_details) + "。")

    raw_gpu_power_limit = config.get("gpu_power_limit_w")
    try:
        gpu_power_limit_w_value = int(round(float(raw_gpu_power_limit)))
    except (TypeError, ValueError):
        gpu_power_limit_w_value = None
    if gpu_power_limit_w_value is not None and gpu_power_limit_w_value > 0:
        warnings.append(
            f"已请求 GPU 功率墙：{gpu_power_limit_w_value}W。该限制作用于整张显卡，不是单个训练进程；依赖 nvidia-smi、驱动与管理员/root 权限，不支持时会自动跳过。"
        )

    return warnings


def build_training_gpu_selection_warning(gpu_ids: list[str]) -> str:
    if gpu_ids:
        return f"本次训练将使用 GPU: {', '.join(gpu_ids)}"
    return "本次训练未显式指定 GPU，默认使用当前 PyTorch 可见的主训练显卡。"


def build_runtime_dependency_failure_message(dependency_report: dict) -> Optional[str]:
    if dependency_report.get("ready"):
        return None

    missing_details = []
    for dependency in dependency_report.get("missing", []):
        package_label = dependency["display_name"]
        reason = dependency.get("reason") or "Package is not importable."
        requirement = ", ".join(dependency.get("required_for", []))
        missing_details.append(f"{package_label} ({requirement}): {reason}")
    return "Required runtime dependencies are missing or broken: " + " | ".join(missing_details)


def merge_training_result_warnings(
    result,
    warnings: list[str],
    *,
    mixed_resolution_payload: dict | None = None,
) -> None:
    if mixed_resolution_payload is not None:
        result.data = result.data or {}
        result.data["mixed_resolution"] = mixed_resolution_payload

    tensorboard_run_dir = ""
    tensorboard_resume_merge = False
    tensorboard_reused_from_state = False
    if result.data:
        tensorboard_run_dir = str(result.data.get("tensorboard_run_dir", "") or "").strip()
        tensorboard_resume_merge = bool(result.data.get("tensorboard_resume_merge"))
        tensorboard_reused_from_state = bool(result.data.get("tensorboard_reused_from_state"))
        distributed_active = bool(result.data.get("distributed_active"))
        distributed_summary = str(result.data.get("distributed_summary", "") or "").strip()
        if distributed_active and distributed_summary and distributed_summary not in warnings:
            warnings.append(f"分布式摘要：{distributed_summary}")

    if tensorboard_run_dir:
        warnings.append(f"TensorBoard 日志目录：{tensorboard_run_dir}")
        if tensorboard_reused_from_state:
            warnings.append("TensorBoard 将继续写入 resume state 中记录的原日志目录。")
        elif tensorboard_resume_merge:
            warnings.append("TensorBoard 将复用当前模型最近一次已有的日志目录。")

    if not warnings:
        return

    result.data = result.data or {}
    result.data["warnings"] = warnings
    if result.message:
        result.message = f"{result.message} {' '.join(warnings)}"
    else:
        result.message = " ".join(warnings)
