from __future__ import annotations

from library import train_util
from lulynx.anima_lora_trainer import AnimaNetworkTrainer as _BaseAnimaNetworkTrainer, setup_parser


class AnimaNetworkTrainer(_BaseAnimaNetworkTrainer):
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
        super().sample_images(
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
        if epoch is not None and epoch > 0:
            train_util.maybe_run_epoch_cooldown(
                args,
                accelerator,
                int(epoch),
                getattr(args, "max_train_epochs", None),
                context_label="Anima LoRA",
            )
