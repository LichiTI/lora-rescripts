from __future__ import annotations

import json
import sys
from pathlib import Path


def _setup_repo_paths() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    stable_root = repo_root / "scripts" / "stable"
    for path in (repo_root, stable_root):
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)


def main() -> None:
    _setup_repo_paths()

    result = {
        "success": False,
        "runtime_requested": False,
        "ready": False,
        "importable": False,
        "native_backward": False,
        "source": "",
        "reason": "",
        "backward_reason": "",
        "torch_version": "",
        "cuda_available": False,
        "device": "",
        "dtype": "",
    }

    try:
        from mikazuki.utils.sagebwd_runtime import probe_runtime_sagebwd

        result.update(probe_runtime_sagebwd())
        result["success"] = bool(result["ready"])
    except Exception as exc:
        result["reason"] = str(exc)

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
