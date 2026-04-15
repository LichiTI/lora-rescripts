@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo Install Newbie Runtime Support
echo ========================================
echo.

cd /d "%~dp0"

set "LULYNX_SUPPRESS_NEWBIE_SUPPORT_PS_HEADER=1"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_newbie_support.ps1" %*
set "LULYNX_SUPPRESS_NEWBIE_SUPPORT_PS_HEADER="
if errorlevel 1 (
    echo.
    echo [ERROR] Newbie support installation failed.
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Done.
echo.
pause
exit /b 0
