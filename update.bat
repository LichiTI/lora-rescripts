@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\runtime\update_repo.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] Update failed.
    echo.
    pause
)

exit /b %EXIT_CODE%
