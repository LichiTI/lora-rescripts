#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

export PYTHONUTF8=1
export PIP_DISABLE_PIP_VERSION_CHECK=1

portable_python="$script_dir/python/bin/python"
venv_python="$script_dir/venv/bin/python"
tageditor_portable_python="$script_dir/python_tageditor/bin/python"
tageditor_venv_python="$script_dir/venv-tageditor/bin/python"
tageditor_requirements="$script_dir/mikazuki/dataset-tag-editor/requirements.txt"

python_exe=""
marker_file=""

find_system_python() {
    if [[ -n "${PYTHON:-}" ]]; then
        if [[ -x "${PYTHON}" ]]; then
            printf '%s\n' "${PYTHON}"
            return 0
        fi
        if command -v "${PYTHON}" >/dev/null 2>&1; then
            command -v "${PYTHON}"
            return 0
        fi
    fi

    if command -v python3 >/dev/null 2>&1; then
        command -v python3
        return 0
    fi

    if command -v python >/dev/null 2>&1; then
        command -v python
        return 0
    fi

    echo "No usable system Python was found. Install python3 or set \$PYTHON first." >&2
    exit 1
}

test_pip_ready() {
    local python_bin="$1"
    "$python_bin" -m pip --version >/dev/null 2>&1
}

get_python_minor_version() {
    local python_bin="$1"
    "$python_bin" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null
}

invoke_step() {
    local message="$1"
    shift
    echo "$message"
    "$@"
}

select_python() {
    if [[ -x "$tageditor_portable_python" ]]; then
        python_exe="$tageditor_portable_python"
        marker_file="$script_dir/python_tageditor/.tageditor_installed"
        return 0
    fi

    if [[ -x "$tageditor_venv_python" ]]; then
        python_exe="$tageditor_venv_python"
        marker_file="$script_dir/venv-tageditor/.tageditor_installed"
        return 0
    fi

    if [[ -x "$portable_python" ]]; then
        if [[ "$(get_python_minor_version "$portable_python" || true)" == "3.13" ]]; then
            cat <<'EOF' >&2
Main Python is 3.13, but dataset-tag-editor currently depends on Gradio 4.28.3 and should use a separate Python 3.12 runtime.

Recommended fixes:
1. Prepare python_tageditor/bin/python with Python 3.12 and rerun install_tageditor.sh
2. Or create venv-tageditor with Python 3.12 and rerun install_tageditor.sh
EOF
            exit 1
        fi
        python_exe="$portable_python"
        marker_file="$script_dir/python/.tageditor_installed"
        return 0
    fi

    if [[ -x "$venv_python" ]]; then
        if [[ "$(get_python_minor_version "$venv_python" || true)" == "3.13" ]]; then
            cat <<'EOF' >&2
Main Python is 3.13, but dataset-tag-editor currently depends on Gradio 4.28.3 and should use a separate Python 3.12 runtime.

Recommended fixes:
1. Prepare python_tageditor/bin/python with Python 3.12 and rerun install_tageditor.sh
2. Or create venv-tageditor with Python 3.12 and rerun install_tageditor.sh
EOF
            exit 1
        fi
        python_exe="$venv_python"
        marker_file="$script_dir/venv/.tageditor_installed"
        return 0
    fi

    cat <<EOF >&2
No project-local Python found for tag editor installation.

Expected one of:
- $tageditor_portable_python
- $tageditor_venv_python
- $portable_python
- $venv_python

Recommended fixes:
1. Prepare python_tageditor/bin/python or venv-tageditor/bin/python for the bundled tag editor runtime
2. Or run install.bash first so the project can bootstrap ./venv intentionally
EOF
    exit 1
}

select_python

if ! test_pip_ready "$python_exe"; then
    echo "Tag editor Python is incomplete: pip is not available." >&2
    exit 1
fi

cd "$script_dir"

invoke_step "Upgrading pip tooling for tag editor..." \
    "$python_exe" -m pip install --upgrade --no-warn-script-location pip "setuptools<81" wheel

invoke_step "Installing tag editor dependencies..." \
    "$python_exe" -m pip install --upgrade --no-warn-script-location --prefer-binary -r "$tageditor_requirements"

invoke_step "Aligning tag editor package constraints..." \
    "$python_exe" -m pip install --upgrade --no-warn-script-location --prefer-binary \
    gradio==4.28.3 gradio-client==0.16.0 \
    "fastapi<0.113" "starlette<0.39" "pydantic<2.11" "huggingface-hub<1"

if [[ -n "$marker_file" ]]; then
    : > "$marker_file"
fi

echo "Tag editor dependencies installed"
