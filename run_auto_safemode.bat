@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo SD-rescripts Auto Safe Mode
echo ========================================
echo.
echo Safe mode will:
echo - clear inherited Python / pip / conda environment overrides
echo - force the safe-sdpa launcher profile
echo - keep the normal project-local runtime guard enabled
echo.

cd /d "%~dp0"

set "PYTHONHOME="
set "PYTHONPATH="
set "PYTHONSTARTUP="
set "PYTHONUSERBASE="
set "PYTHONNOUSERSITE=1"
set "PIP_REQUIRE_VIRTUALENV="
set "PIP_CONFIG_FILE="
set "VIRTUAL_ENV="
set "CONDA_PREFIX="
set "CONDA_DEFAULT_ENV="
set "CONDA_PROMPT_MODIFIER="
set "CONDA_EXE="
set "CONDA_PYTHON_EXE="
set "MIKAZUKI_ALLOW_SYSTEM_PYTHON="
set "MIKAZUKI_PREFERRED_RUNTIME="
set "MIKAZUKI_FLASHATTENTION_STARTUP="
set "MIKAZUKI_SAGEATTENTION_STARTUP="
set "MIKAZUKI_BLACKWELL_STARTUP="
set "MIKAZUKI_STARTUP_ATTENTION_POLICY="

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\runtime\launcher.ps1" -Mode Auto -Selection safe-sdpa %*
if errorlevel 1 (
    echo.
    echo [ERROR] Safe mode startup failed.
    echo.
    pause
)

exit /b %ERRORLEVEL%
