from __future__ import annotations

import os
import sys


def _bootstrap_experimental_runtime_guards() -> None:
    try:
        from mikazuki.utils.runtime_mode import infer_attention_runtime_mode, is_amd_rocm_runtime, is_intel_xpu_runtime

        runtime_mode = infer_attention_runtime_mode()
        if not (is_amd_rocm_runtime(runtime_mode) or is_intel_xpu_runtime(runtime_mode)):
            return

        from mikazuki.utils.runtime_import_guards import install_experimental_runtime_import_guards

        install_experimental_runtime_import_guards()
    except Exception as exc:
        if str(os.environ.get("MIKAZUKI_DEBUG_SITECUSTOMIZE", "") or "").strip() == "1":
            print(f"[sitecustomize] experimental runtime bootstrap failed: {exc}", file=sys.stderr, flush=True)


_bootstrap_experimental_runtime_guards()
