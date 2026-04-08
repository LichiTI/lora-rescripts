@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo SD-rescripts SageAttention Environment Check
echo ========================================
echo.

cd /d "%~dp0"

set "SAGE_RUNTIME_DIR=env\python-sageattention"

if not exist "%~dp0%SAGE_RUNTIME_DIR%\python.exe" (
    if exist "%~dp0python-sageattention\python.exe" set "SAGE_RUNTIME_DIR=python-sageattention"
    if exist "%~dp0env\python_sageattention\python.exe" set "SAGE_RUNTIME_DIR=env\python_sageattention"
    if exist "%~dp0python_sageattention\python.exe" set "SAGE_RUNTIME_DIR=python_sageattention"
)

set "PYTHON_EXE=%~dp0%SAGE_RUNTIME_DIR%\python.exe"

if not exist "%PYTHON_EXE%" (
    echo [ERROR] %SAGE_RUNTIME_DIR% not found.
    echo Expected: %PYTHON_EXE%
    echo.
    pause
    exit /b 1
)

echo Runtime directory: %SAGE_RUNTIME_DIR%
echo.

echo [1/4] Python version
"%PYTHON_EXE%" -V
if errorlevel 1 goto failed

echo.
echo [2/4] Torch / CUDA / Triton / SageAttention versions
"%PYTHON_EXE%" -c "import importlib.metadata as md; import torch, triton; print('Torch:', torch.__version__); print('CUDA available:', torch.cuda.is_available()); print('CUDA runtime:', torch.version.cuda); print('Triton:', getattr(triton, '__version__', md.version('triton-windows') if md.packages_distributions().get('triton') else 'unknown')); print('SageAttention:', md.version('sageattention') if md.packages_distributions().get('sageattention') else 'not installed')"
if errorlevel 1 goto failed

echo.
echo [3/4] GPU detection
"%PYTHON_EXE%" -c "import torch; print('GPU count:', torch.cuda.device_count()); [print(f'GPU {i}: {torch.cuda.get_device_name(i)} capability {torch.cuda.get_device_capability(i)}') for i in range(torch.cuda.device_count())]"
if errorlevel 1 goto failed

echo.
echo [4/4] SageAttention import smoke test
"%PYTHON_EXE%" -c "from sageattention import sageattn, sageattn_varlen; print('sageattn callable:', callable(sageattn)); print('sageattn_varlen callable:', callable(sageattn_varlen))"
if errorlevel 1 goto failed

echo.
echo Check completed.
echo.
pause
exit /b 0

:failed
echo.
echo [ERROR] SageAttention environment check failed.
echo.
pause
exit /b 1
