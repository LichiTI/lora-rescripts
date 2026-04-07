@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo SD-rescripts AMD ROCm SageAttention Startup
echo ========================================
echo.
echo AMD ROCm Sage experimental mode:
echo - uses the dedicated python_rocm_amd_sage runtime
echo - keeps the existing python_rocm_amd runtime untouched
echo - uses a local ROCm Triton bridge first, then falls back if unavailable
echo - is currently intended for the isolated AMD experimental route only
echo.

cd /d "%~dp0"
set "MIKAZUKI_AMD_EXPERIMENTAL=1"
set "MIKAZUKI_ROCM_AMD_SAGE_EXPERIMENTAL=1"
set "MIKAZUKI_ROCM_AMD_SAGE_STARTUP=1"
set "MIKAZUKI_PREFERRED_RUNTIME=rocm-amd-sage"
set "MIKAZUKI_STARTUP_ATTENTION_POLICY=runtime_guarded"
set "MIKAZUKI_ALLOW_AMD_ROCM_SAGEATTN=1"
set "MIKAZUKI_ROCM_SDPA_SLICE_TRIGGER_GB=0.75"
set "MIKAZUKI_ROCM_SDPA_SLICE_GB=0.35"

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_gui.ps1" %*
if errorlevel 1 (
    echo.
    echo [ERROR] Program execution failed.
    echo.
    pause
)

exit /b %ERRORLEVEL%
