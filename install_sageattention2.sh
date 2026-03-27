#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
allow_external_python="${MIKAZUKI_ALLOW_SYSTEM_PYTHON:-0}"

export HF_HOME="${HF_HOME:-huggingface}"
export PYTHONUTF8=1
export PIP_DISABLE_PIP_VERSION_CHECK=1

runtime_dir_name="python-sageattention-latest"
if [[ ! -d "$script_dir/$runtime_dir_name" && -d "$script_dir/python_sageattention_latest" ]]; then
    runtime_dir_name="python_sageattention_latest"
fi

runtime_dir="$script_dir/$runtime_dir_name"
runtime_python="$runtime_dir/bin/python"
runtime_marker="$runtime_dir/.deps_installed"

portable_python="$script_dir/python/bin/python"
venv_python="$script_dir/venv/bin/python"

main_required_modules=(accelerate torch fastapi toml transformers diffusers lion_pytorch dadaptation schedulefree prodigyopt prodigyplus pytorch_optimizer)

python_minor_version() {
    local python_bin="$1"
    "$python_bin" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null
}

python_is_312() {
    local python_bin="$1"
    [[ -x "$python_bin" ]] || return 1
    [[ "$(python_minor_version "$python_bin" || true)" == "3.12" ]]
}

find_system_python_312() {
    if [[ -n "${PYTHON:-}" ]]; then
        if [[ -x "${PYTHON}" ]] && python_is_312 "${PYTHON}"; then
            printf '%s\n' "${PYTHON}"
            return 0
        fi
        if command -v "${PYTHON}" >/dev/null 2>&1; then
            local detected
            detected="$(command -v "${PYTHON}")"
            if python_is_312 "$detected"; then
                printf '%s\n' "$detected"
                return 0
            fi
        fi
    fi

    for candidate in python3.12 python3 python; do
        if command -v "$candidate" >/dev/null 2>&1; then
            local detected
            detected="$(command -v "$candidate")"
            if python_is_312 "$detected"; then
                printf '%s\n' "$detected"
                return 0
            fi
        fi
    done

    echo "No usable Python 3.12 bootstrap interpreter was found. Install python3.12 or set \$PYTHON to a Python 3.12 executable first." >&2
    exit 1
}

test_pip_ready() {
    local python_bin="$1"
    "$python_bin" -m pip --version >/dev/null 2>&1
}

test_modules_ready() {
    local python_bin="$1"
    shift

    if [[ "$#" -eq 0 ]]; then
        return 0
    fi

    "$python_bin" -c "import importlib, sys; failed=[]
for name in sys.argv[1:]:
    try:
        importlib.import_module(name)
    except Exception:
        failed.append(name)
raise SystemExit(1 if failed else 0)" "$@" >/dev/null 2>&1
}

test_sageattention2_runtime_ready() {
    local python_bin="$1"

    "$python_bin" -c "import torch
try:
    import triton  # noqa: F401
    from sageattention import sageattn, sageattn_varlen
    ok = callable(sageattn) and callable(sageattn_varlen) and torch.cuda.is_available()
    if ok:
        q = torch.randn((1, 8, 64, 64), device='cuda', dtype=torch.float16)
        out = sageattn(q, q, q)
        torch.cuda.synchronize()
        ok = tuple(out.shape) == tuple(q.shape)
except Exception:
    ok = False
raise SystemExit(0 if ok else 1)" >/dev/null 2>&1
}

invoke_step() {
    local message="$1"
    shift
    echo "$message"
    "$@"
}

resolve_sageattention2_package() {
    local wheel_dir
    for wheel_dir in "$script_dir/wheel" "$script_dir/sageattention-wheels" "$script_dir/sageattention_wheels"; do
        [[ -d "$wheel_dir" ]] || continue

        local wheel
        wheel="$(find "$wheel_dir" -maxdepth 1 -type f \( -name 'sageattention-2.2.0-cp312-cp312-linux_x86_64.whl' -o -name 'sageattention*cp312*linux_x86_64.whl' \) | head -n 1 || true)"
        if [[ -n "$wheel" ]]; then
            printf '%s\n' "$wheel"
            return 0
        fi
    done

    printf '%s\n' "sageattention==2.2.0"
}

ensure_runtime_python() {
    if [[ -x "$runtime_python" ]]; then
        return 0
    fi

    local bootstrap_python=""
    if python_is_312 "$portable_python"; then
        bootstrap_python="$portable_python"
    elif python_is_312 "$venv_python"; then
        bootstrap_python="$venv_python"
    else
        bootstrap_python="$(find_system_python_312)"
    fi

    echo "Creating dedicated SageAttention2 runtime at ./$runtime_dir_name ..."
    "$bootstrap_python" -m venv "$runtime_dir"
}

ensure_runtime_python

if [[ ! -x "$runtime_python" ]]; then
    echo "SageAttention2 runtime python was not created correctly in ./$runtime_dir_name" >&2
    exit 1
fi

if [[ "$(python_minor_version "$runtime_python" || true)" != "3.12" ]]; then
    echo "SageAttention2 requires Python 3.12, but ./$runtime_dir_name is using $(python_minor_version "$runtime_python" || echo unknown)." >&2
    exit 1
fi

if ! test_pip_ready "$runtime_python"; then
    echo "SageAttention2 runtime is incomplete: pip is not available in ./$runtime_dir_name" >&2
    exit 1
fi

cd "$script_dir"

invoke_step "Upgrading pip tooling for SageAttention2 environment..." \
    "$runtime_python" -m pip install --upgrade --no-warn-script-location pip "setuptools<81" wheel packaging

invoke_step "Installing PyTorch and torchvision for SageAttention2 environment..." \
    "$runtime_python" -m pip install --upgrade --force-reinstall --no-warn-script-location --prefer-binary \
    torch==2.10.0+cu128 torchvision==0.25.0+cu128 \
    --extra-index-url https://download.pytorch.org/whl/cu128

invoke_step "Installing project dependencies into SageAttention2 runtime..." \
    "$runtime_python" -m pip install --upgrade --no-warn-script-location --prefer-binary -r requirements.txt

invoke_step "Installing Triton for SageAttention2..." \
    "$runtime_python" -m pip install --upgrade --no-warn-script-location --prefer-binary triton

sageattention_package="$(resolve_sageattention2_package)"
if [[ -f "$sageattention_package" ]]; then
    invoke_step "Installing SageAttention2 package from local file..." \
        "$runtime_python" -m pip install --upgrade --no-warn-script-location --no-deps "$sageattention_package"
else
    invoke_step "Installing SageAttention2 package..." \
        "$runtime_python" -m pip install --upgrade --no-warn-script-location --prefer-binary "$sageattention_package"
fi

invoke_step "Verifying SageAttention2 import/runtime bindings..." \
    "$runtime_python" -c "import importlib.metadata as md; import torch, triton; from sageattention import sageattn, sageattn_varlen; print('torch:', torch.__version__); print('triton:', getattr(triton, '__version__', 'unknown')); print('sageattention:', md.version('sageattention')); print('cuda:', torch.cuda.is_available()); print('symbols:', callable(sageattn), callable(sageattn_varlen))"

if ! test_modules_ready "$runtime_python" "${main_required_modules[@]}"; then
    echo "Project dependencies did not finish installing correctly in ./$runtime_dir_name" >&2
    exit 1
fi

if ! test_sageattention2_runtime_ready "$runtime_python"; then
    cat >&2 <<EOF
SageAttention2 runtime verification failed in ./$runtime_dir_name

Common causes on Linux:
- current Python / CUDA / Torch / Triton combination is incompatible
- the local SageAttention2 wheel does not match this machine
- CUDA is not available inside this runtime
- the current GPU driver/runtime stack is missing pieces SageAttention2 expects
EOF
    exit 1
fi

: > "$runtime_marker"
echo "SageAttention2 experimental environment is ready"
