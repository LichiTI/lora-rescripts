import runpy
import sys
from pathlib import Path


def _resolve_target_path(base_dir: Path, script_arg: str) -> Path:
    target_path = Path(script_arg)
    if not target_path.is_absolute():
        target_path = base_dir / target_path
    return target_path.resolve()


def _prepend_sys_paths(paths):
    unique_paths = []
    for path in paths:
        path_str = str(path)
        if path.exists() and path_str not in unique_paths:
            unique_paths.append(path_str)

    for path_str in reversed(unique_paths):
        if path_str not in sys.path:
            sys.path.insert(0, path_str)


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: script_runner.py <script_path> [args...]")

    runner_path = Path(__file__).resolve()
    base_dir = runner_path.parent.parent
    target_path = _resolve_target_path(base_dir, sys.argv[1])

    _prepend_sys_paths([target_path.parent, target_path.parent.parent, base_dir])
    from mikazuki.utils.runtime_import_guards import install_experimental_runtime_import_guards
    from mikazuki.utils.runtime_distributed_compat import apply_torch_distributed_compat_shims
    from mikazuki.utils.runtime_mode import infer_attention_runtime_mode, is_amd_rocm_runtime, is_intel_xpu_runtime

    install_experimental_runtime_import_guards()
    apply_torch_distributed_compat_shims()

    runtime_mode = infer_attention_runtime_mode()
    if is_amd_rocm_runtime(runtime_mode) or is_intel_xpu_runtime(runtime_mode):
        print(
            f"Experimental runtime bootstrap: mode={runtime_mode}; import_guards=on; distributed_compat=on",
            flush=True,
        )

    sys.argv = [str(target_path), *sys.argv[2:]]
    runpy.run_path(str(target_path), run_name="__main__")


if __name__ == "__main__":
    main()
