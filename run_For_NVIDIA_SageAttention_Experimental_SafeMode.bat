@echo off
chcp 65001 >nul
setlocal

call "%~dp0run_For_SageAttention_Experimental_SafeMode.bat" %*
exit /b %ERRORLEVEL%
