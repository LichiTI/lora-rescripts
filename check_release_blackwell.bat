@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check_release_blackwell.ps1" %*
if errorlevel 1 (
    echo.
    echo [ERROR] Release check failed.
    echo.
    pause
    exit /b 1
)

echo.
echo [OK] Release check passed.
echo.
pause
exit /b 0
