@echo off
chcp 65001 >nul
setlocal

title SD-rescripts Big Console Startup
mode con cols=140 lines=40

cd /d "%~dp0"
call "%~dp0run_auto.bat" %*
exit /b %ERRORLEVEL%
