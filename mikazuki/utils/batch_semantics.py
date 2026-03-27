from __future__ import annotations


def resolve_per_device_batch_from_global(global_batch: int, world_size: int) -> tuple[bool, int, str]:
    ws = max(1, int(world_size or 1))

    try:
        gb = int(global_batch)
    except (TypeError, ValueError):
        return False, 0, "train_batch_size 必须是有效整数。"

    if gb <= 0:
        return False, 0, "train_batch_size 必须大于 0。"

    if ws == 1:
        return True, gb, ""

    if gb < ws:
        return (
            False,
            0,
            f"为保持等效全局 batch 不变，train_batch_size(={gb}) 不能小于 world_size(={ws})。"
            "请增大 batch 或减少并行卡数。",
        )

    if gb % ws != 0:
        return (
            False,
            0,
            f"为保持等效全局 batch 不变，train_batch_size(={gb}) 必须能被 world_size(={ws}) 整除。"
            "请调整 batch 或并行卡数。",
        )

    return True, gb // ws, ""
