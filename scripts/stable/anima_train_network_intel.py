# Thin entrypoint for the standalone Lulynx Intel XPU experimental Anima LoRA core.

from anima_lora_trainer_with_cooldown import setup_parser
from library import train_util
from lulynx_intel.anima_lora_trainer import AnimaNetworkTrainer


def _restore_missing_parser_defaults(parser, args):
    for action in getattr(parser, "_actions", []):
        dest = getattr(action, "dest", None)
        if not dest or dest == "help":
            continue
        if not hasattr(args, dest):
            setattr(args, dest, action.default)
    return args


if __name__ == "__main__":
    parser = setup_parser()

    args = parser.parse_args()
    train_util.verify_command_line_training_args(args)
    args = train_util.read_config_from_file(args, parser)
    args = _restore_missing_parser_defaults(parser, args)

    if args.attn_mode == "sdpa":
        args.attn_mode = "torch"
        if hasattr(args, "sdpa"):
            args.sdpa = True

    trainer = AnimaNetworkTrainer()
    trainer.train(args)
