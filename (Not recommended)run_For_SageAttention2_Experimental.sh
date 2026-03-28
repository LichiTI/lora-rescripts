#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "========================================"
echo "SD-rescripts SageAttention2 Startup"
echo "========================================"
echo
echo "SageAttention2 experimental mode:"
echo "- uses a dedicated python-sageattention-latest runtime"
echo "- targets SageAttention 2.x with a separate Python 3.12 environment"
echo "- intended for NVIDIA GPUs that want to try the newer sageattn stack"
echo "- keeps the main runtime untouched"
echo "- only affects routes that explicitly enable sageattn"
echo

export MIKAZUKI_SAGEATTENTION_STARTUP=1
export MIKAZUKI_SAGEATTENTION2_STARTUP=1
export MIKAZUKI_PREFERRED_RUNTIME=sageattention2

exec bash "$script_dir/run_gui.sh" "$@"
