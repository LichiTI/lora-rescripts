@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo SD-rescripts Blackwell Startup
echo ========================================
echo.
echo Blackwell compatibility mode:
echo - enables the startup patch for xformers FA3
echo - intended for RTX 50 and RTX PRO Blackwell GPUs
echo.

cd /d "%~dp0"
set "MIKAZUKI_BLACKWELL_STARTUP=1"
set "MIKAZUKI_PREFERRED_RUNTIME=blackwell"

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_gui.ps1" %*
if errorlevel 1 (
    echo.
    echo [ERROR] Program execution failed.
    echo.
    pause
)

exit /b %ERRORLEVEL%
