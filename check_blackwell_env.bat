@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo SD-rescripts Blackwell Environment Check
echo ========================================
echo.

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0python_blackwell\python.exe"

if not exist "%PYTHON_EXE%" (
    echo [ERROR] python_blackwell not found.
    echo Expected: %PYTHON_EXE%
    echo.
    pause
    exit /b 1
)

echo [1/4] Python version
"%PYTHON_EXE%" -V
if errorlevel 1 goto failed

echo.
echo [2/4] Torch / CUDA / xformers versions
"%PYTHON_EXE%" -c "import importlib.metadata as md; import torch; print('Torch:', torch.__version__); print('CUDA available:', torch.cuda.is_available()); print('CUDA runtime:', torch.version.cuda); print('xformers:', md.version('xformers') if md.packages_distributions().get('xformers') else 'not installed')"
if errorlevel 1 goto failed

echo.
echo [3/4] GPU detection
"%PYTHON_EXE%" -c "import torch; print('GPU count:', torch.cuda.device_count()); [print(f'GPU {i}: {torch.cuda.get_device_name(i)} capability {torch.cuda.get_device_capability(i)}') for i in range(torch.cuda.device_count())]"
if errorlevel 1 goto failed

echo.
echo [4/4] xformers.info
"%PYTHON_EXE%" -m xformers.info
if errorlevel 1 (
    echo.
    echo [WARN] xformers.info failed.
    echo This usually means xformers is missing or the current build is incompatible.
)

echo.
echo Check completed.
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] Blackwell environment check failed.
echo.
pause
exit /b 1
