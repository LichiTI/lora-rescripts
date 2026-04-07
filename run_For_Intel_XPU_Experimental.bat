@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo SD-rescripts Intel XPU Startup
echo ========================================
echo.
echo Intel XPU experimental mode:
echo - uses the dedicated python_xpu_intel runtime
echo - defaults to SDPA safe mode, but keeps experimental SageAttention probe path available
echo - currently isolates the Intel experimental route to Anima LoRA
echo - keeps the main runtime and NVIDIA paths untouched
echo.

cd /d "%~dp0"
set "MIKAZUKI_INTEL_XPU_EXPERIMENTAL=1"
set "MIKAZUKI_INTEL_XPU_STARTUP=1"
set "MIKAZUKI_PREFERRED_RUNTIME=intel-xpu"
set "MIKAZUKI_STARTUP_ATTENTION_POLICY=runtime_guarded"
set "MIKAZUKI_ALLOW_INTEL_XPU_SAGEATTN=1"
set "IPEX_SDPA_SLICE_TRIGGER_RATE=0.75"
set "IPEX_ATTENTION_SLICE_RATE=0.4"

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_gui.ps1" %*
if errorlevel 1 (
    echo.
    echo [ERROR] Program execution failed.
    echo.
    pause
)

exit /b %ERRORLEVEL%
