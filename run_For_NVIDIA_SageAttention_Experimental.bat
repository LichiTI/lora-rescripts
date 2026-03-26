@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo SD-rescripts SageAttention Startup
echo ========================================
echo.
echo SageAttention experimental mode:
echo - uses a dedicated python-sageattention runtime
echo - intended for NVIDIA GPUs that want to try sageattn
echo - can be useful on RTX 20 / 30 / 40 / 50 series when the runtime matches
echo - only affects routes that explicitly enable sageattn
echo.

cd /d "%~dp0"
set "MIKAZUKI_SAGEATTENTION_STARTUP=1"
set "MIKAZUKI_PREFERRED_RUNTIME=sageattention"

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_gui.ps1" %*
if errorlevel 1 (
    echo.
    echo [ERROR] Program execution failed.
    echo.
    pause
)

exit /b %ERRORLEVEL%
