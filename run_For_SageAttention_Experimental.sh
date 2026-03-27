#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "========================================"
echo "SD-rescripts SageAttention Startup"
echo "========================================"
echo
echo "SageAttention experimental mode:"
echo "- uses a dedicated python-sageattention runtime"
echo "- intended for NVIDIA GPUs that want to try sageattn"
echo "- can be useful on RTX 20 / 30 / 40 / 50 series when the runtime matches"
echo "- keeps the main runtime untouched"
echo "- only affects routes that explicitly enable sageattn"
echo

export MIKAZUKI_SAGEATTENTION_STARTUP=1
export MIKAZUKI_PREFERRED_RUNTIME=sageattention

exec bash "$script_dir/run_gui.sh" "$@"
