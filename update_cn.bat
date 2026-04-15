@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"
set "MIKAZUKI_CN_MIRROR=1"
echo [CN Mirror] Git / PyPI / Hugging Face mirror helpers enabled.

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\runtime\update_repo.ps1" -UseChinaMirror -PromptOnFirstUse %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo [ERROR] CN update failed.
    echo.
    pause
)

exit /b %EXIT_CODE%
