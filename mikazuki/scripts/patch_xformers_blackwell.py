import importlib.metadata as md
import importlib.util
import re
import sys
from pathlib import Path


PATCH_MARKER = "patched by Mikazuki Blackwell startup"
BACKUP_SUFFIX = ".mikazuki-blackwell.bak"


def print_line(message: str) -> None:
    print(f"[BlackwellPatch] {message}")


def detect_blackwell_gpus():
    try:
        import torch
    except Exception as exc:
        print_line(f"torch import failed, skipping patch: {exc}")
        return []

    if not torch.cuda.is_available():
        print_line("CUDA is not available, skipping patch.")
        return []

    detected = []
    for gpu_index in range(torch.cuda.device_count()):
        capability = torch.cuda.get_device_capability(gpu_index)
        name = torch.cuda.get_device_name(gpu_index)
        if capability[0] >= 12:
            detected.append((gpu_index, name, capability))

    return detected


def get_xformers_dispatch_path():
    spec = importlib.util.find_spec("xformers")
    if spec is None or spec.origin is None:
        return None

    package_dir = Path(spec.origin).resolve().parent
    dispatch_path = package_dir / "ops" / "fmha" / "dispatch.py"
    if not dispatch_path.exists():
        return None

    return dispatch_path


def read_text_preserve_newlines(path: Path):
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def write_text_preserve_newlines(path: Path, content: str):
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(content)


def patch_dispatch_file(dispatch_path: Path) -> bool:
    original_text = read_text_preserve_newlines(dispatch_path)

    if PATCH_MARKER in original_text:
        print_line(f"FA3 switch already patched: {dispatch_path}")
        return True

    pattern = re.compile(
        r"^(\s*_USE_FLASH_ATTENTION_3\s*=\s*)(True|False)(\s*(?:#.*)?)$",
        re.MULTILINE,
    )
    match = pattern.search(original_text)
    if not match:
        print_line(f"Could not find _USE_FLASH_ATTENTION_3 in {dispatch_path}")
        return False

    current_value = match.group(2)
    if current_value == "False":
        print_line(f"FA3 is already disabled in {dispatch_path}")
        return True

    backup_path = dispatch_path.with_name(dispatch_path.name + BACKUP_SUFFIX)
    if not backup_path.exists():
        write_text_preserve_newlines(backup_path, original_text)
        print_line(f"Backup created: {backup_path}")

    patched_text = pattern.sub(
        r"\1False\3  # " + PATCH_MARKER,
        original_text,
        count=1,
    )
    write_text_preserve_newlines(dispatch_path, patched_text)
    print_line(f"Disabled xformers FA3 for Blackwell in: {dispatch_path}")
    return True


def main():
    blackwell_gpus = detect_blackwell_gpus()
    if not blackwell_gpus:
        print_line("No Blackwell GPU detected, nothing to patch.")
        return 0

    gpu_desc = ", ".join(
        f"GPU {gpu_index} {name} capability {capability}"
        for gpu_index, name, capability in blackwell_gpus
    )
    print_line(f"Detected Blackwell GPUs: {gpu_desc}")

    try:
        xformers_version = md.version("xformers")
        print_line(f"xformers version: {xformers_version}")
    except md.PackageNotFoundError:
        print_line("xformers is not installed, skipping patch.")
        return 0

    dispatch_path = get_xformers_dispatch_path()
    if dispatch_path is None:
        print_line("xformers dispatch.py was not found, skipping patch.")
        return 0

    if patch_dispatch_file(dispatch_path):
        return 0

    print_line("Patch step did not complete cleanly. Startup will continue.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
