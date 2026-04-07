from __future__ import annotations

from contextlib import contextmanager

import torch
from library import anima_train_utils
from lulynx.anima_lora_trainer import AnimaNetworkTrainer as _BaseAnimaNetworkTrainer
from lulynx_intel.anima_runtime import (
    apply_anima_intel_xpu_experimental_policy,
    is_intel_xpu_runtime,
    log_anima_intel_xpu_experimental_banner,
)


@contextmanager
def _temporary_anima_intel_runtime_patches():
    original_should_use_pinned_memory = anima_train_utils.should_use_anima_pinned_memory
    original_should_use_non_blocking = anima_train_utils.should_use_anima_non_blocking

    try:
        anima_train_utils.should_use_anima_pinned_memory = lambda accelerator: False
        anima_train_utils.should_use_anima_non_blocking = lambda accelerator: False
        yield
    finally:
        anima_train_utils.should_use_anima_pinned_memory = original_should_use_pinned_memory
        anima_train_utils.should_use_anima_non_blocking = original_should_use_non_blocking


class AnimaNetworkTrainer(_BaseAnimaNetworkTrainer):
    def _cleanup_intel_runtime_memory(self) -> None:
        if not is_intel_xpu_runtime():
            return
        if not hasattr(torch, "xpu") or not torch.xpu.is_available():
            return
        try:
            torch.xpu.empty_cache()
        except Exception:
            return

    def cache_text_encoder_outputs_if_needed(
        self,
        args,
        accelerator,
        text_encoders,
        dataset,
        tokenize_strategy,
        text_encoding_strategy,
    ):
        result = super().cache_text_encoder_outputs_if_needed(
            args,
            accelerator,
            text_encoders,
            dataset,
            tokenize_strategy,
            text_encoding_strategy,
        )
        self._cleanup_intel_runtime_memory()
        return result

    def sample_images(
        self,
        accelerator,
        args,
        epoch,
        global_step,
        vae,
        text_encoder,
        dit,
        tokenize_strategy,
        text_encoding_strategy,
        network=None,
    ):
        result = super().sample_images(
            accelerator,
            args,
            epoch,
            global_step,
            vae,
            text_encoder,
            dit,
            tokenize_strategy,
            text_encoding_strategy,
            network=network,
        )
        self._cleanup_intel_runtime_memory()
        return result

    def train(self, args):
        policy_messages = apply_anima_intel_xpu_experimental_policy(args)
        if is_intel_xpu_runtime():
            policy_messages.append("Intel XPU 实验核心已自动禁用 DataLoader pin_memory / non_blocking。")
            policy_messages.append("Intel XPU 实验核心会在文本编码缓存和训练预览后主动执行 empty_cache。")
        log_anima_intel_xpu_experimental_banner(args, policy_messages)
        if not is_intel_xpu_runtime():
            return super().train(args)

        with _temporary_anima_intel_runtime_patches():
            return super().train(args)
