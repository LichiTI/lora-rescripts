@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo SD-rescripts Intel XPU SageAttention Startup
echo ========================================
echo.
echo Intel XPU Sage experimental mode:
echo - uses the dedicated python_xpu_intel_sage runtime
echo - keeps the existing Intel XPU runtime untouched
echo - is intended for Triton + SageAttention 1.0.6 experiments on Intel GPUs
echo - remains isolated from the current IPEX-based Intel stable route
echo.

cd /d "%~dp0"
set "MIKAZUKI_INTEL_XPU_EXPERIMENTAL=1"
set "MIKAZUKI_INTEL_XPU_SAGE_EXPERIMENTAL=1"
set "MIKAZUKI_INTEL_XPU_SAGE_STARTUP=1"
set "MIKAZUKI_PREFERRED_RUNTIME=intel-xpu-sage"
set "MIKAZUKI_STARTUP_ATTENTION_POLICY=runtime_guarded"
set "MIKAZUKI_ALLOW_INTEL_XPU_SAGEATTN=1"

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_gui.ps1" %*
if errorlevel 1 (
    echo.
    echo [ERROR] Program execution failed.
    echo.
    pause
)

exit /b %ERRORLEVEL%
