from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

import toml

from mikazuki.launch_utils import base_dir_path
from mikazuki.process import apply_windows_accelerate_env, build_accelerate_launch_args
from mikazuki.utils.mixed_resolution import (
    build_mixed_resolution_summary_text,
    build_phase_run_configs,
    load_config_file,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run staged mixed-resolution training phases sequentially.")
    parser.add_argument("--config_file", required=True, help="Base TOML config file")
    parser.add_argument("--trainer_file", required=True, help="Underlying trainer script path")
    parser.add_argument("--num_cpu_threads_per_process", type=int, default=2)
    parser.add_argument("--num_processes", type=int, default=1)
    parser.add_argument("--quiet", action="store_true")
    return parser.parse_args()


def resolve_trainer_path(script_arg: str) -> Path:
    target_path = Path(script_arg)
    if not target_path.is_absolute():
        target_path = base_dir_path() / target_path
    return target_path.resolve()


def main() -> int:
    args = parse_args()

    repo_root = base_dir_path()
    base_config_path = Path(args.config_file).resolve()
    trainer_path = resolve_trainer_path(args.trainer_file)
    script_runner = repo_root / "mikazuki" / "script_runner.py"

    if not base_config_path.exists():
        raise SystemExit(f"Base config file not found: {base_config_path}")
    if not trainer_path.exists():
        raise SystemExit(f"Trainer script not found: {trainer_path}")

    base_config = load_config_file(base_config_path)
    if args.num_processes and args.num_processes > 1:
        base_config["num_processes"] = args.num_processes
    training_type = str(base_config.get("model_train_type", "sdxl-lora"))

    plan, phase_configs = build_phase_run_configs(base_config, training_type=training_type)
    if not plan.enabled:
        raise SystemExit("Mixed-resolution training is not enabled in this config.")

    print(build_mixed_resolution_summary_text(plan), flush=True)

    autosave_dir = repo_root / "config" / "autosave"
    autosave_dir.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    apply_windows_accelerate_env(env)

    for index, (phase, phase_config) in enumerate(zip(plan.phases, phase_configs), start=1):
        phase_toml = autosave_dir / f"{base_config_path.stem}.mixed-phase-{index:02d}-{phase.resolution[0]}x{phase.resolution[1]}.toml"
        with open(phase_toml, "w", encoding="utf-8") as handle:
            toml.dump(phase_config, handle)

        print(
            f"[MixedResolution] Starting phase {index}/{len(plan.phases)}: "
            f"{phase.label} | batch={phase.train_batch_size} | "
            f"steps/epoch={phase.steps_per_epoch} | actual_epoch={phase.actual_epochs} | "
            f"target_max_steps={phase.cumulative_steps}",
            flush=True,
        )

        command = build_accelerate_launch_args(
            script_runner,
            trainer_path,
            str(phase_toml),
            args.num_cpu_threads_per_process,
            quiet=args.quiet,
            num_processes=max(1, int(args.num_processes or 1)),
        )

        result = subprocess.run(command, env=env)
        if result.returncode != 0:
            print(
                f"[MixedResolution] Phase {index} failed with exit code {result.returncode}.",
                flush=True,
            )
            return result.returncode

    print("[MixedResolution] All phases completed successfully.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
