@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo Cleanup SD-rescripts Workspace
echo ========================================
echo.

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0python\python.exe"
set "TAGEDITOR_PYTHON_EXE=%~dp0python_tageditor\python.exe"
set "BLACKWELL_PYTHON_EXE=%~dp0python_blackwell\python.exe"
set "SAGEATTENTION_DIR_PRIMARY=python-sageattention"
set "SAGEATTENTION_DIR_LEGACY=python_sageattention"
set "SAGEATTENTION_BLACKWELL_DIR_PRIMARY=python-sageattention-blackwell"
set "SAGEATTENTION_BLACKWELL_DIR_LEGACY=python_sageattention_blackwell"

echo [1/7] Removing Python cache...
for /d /r %%D in (__pycache__) do @if exist "%%~fD" rmdir /s /q "%%~fD" 2>nul
del /s /q *.pyc *.pyo 2>nul
echo [Done]

echo.
echo [2/7] Resetting runtime folders to initial state...
if exist "logs" rmdir /s /q "logs" 2>nul
if exist "config\autosave" rmdir /s /q "config\autosave" 2>nul
if exist "tmp" rmdir /s /q "tmp" 2>nul
if exist "frontend\.vitepress\cache" rmdir /s /q "frontend\.vitepress\cache" 2>nul

mkdir "logs" 2>nul
mkdir "config\autosave" 2>nul
mkdir "tmp" 2>nul
mkdir "huggingface" 2>nul
echo [Done]

echo.
echo [3/7] Optional data cleanup...
echo Delete output folder? (Y/N, default N)
set /p "DEL_OUTPUT=: "
if /i "%DEL_OUTPUT%"=="Y" (
    if exist "output" rmdir /s /q "output" 2>nul
    echo [Deleted] output
) else (
    echo [Keep] output
)

echo.
echo Delete HuggingFace cache/config folders? (Y/N, default N)
echo This can free a lot of space, but model/download cache will be rebuilt later.
set /p "DEL_HF=: "
if /i "%DEL_HF%"=="Y" (
    if exist "huggingface\hub" rmdir /s /q "huggingface\hub" 2>nul
    if exist "huggingface\accelerate" rmdir /s /q "huggingface\accelerate" 2>nul
    if exist "huggingface\datasets" rmdir /s /q "huggingface\datasets" 2>nul
    if exist "huggingface\modules" rmdir /s /q "huggingface\modules" 2>nul
    if exist "huggingface\xet" rmdir /s /q "huggingface\xet" 2>nul
    if exist "huggingface\assets" rmdir /s /q "huggingface\assets" 2>nul
    del /q "huggingface\token" "huggingface\stored_tokens" 2>nul
    mkdir "huggingface" 2>nul
    echo [Deleted] HuggingFace cache/config
    echo Includes: hub, accelerate, datasets, modules, xet, assets, token files
)
else (
    echo [Keep] HuggingFace cache/config
)

echo.
echo [4/7] Slim bundled main Python packages for distribution? (Y/N, default N)
echo This will physically remove installed runtime packages like torch / torchvision / xformers / diffusers / transformers / numpy / scipy / onnxruntime.
echo It keeps only pip / setuptools / wheel bootstrap components so first startup can auto-install dependencies again.
set /p "SLIM_MAIN=: "
if /i "%SLIM_MAIN%"=="Y" (
    if not exist "%PYTHON_EXE%" (
        echo [Skip] portable main Python not found
    ) else (
        echo [Main] Removing site-packages, scripts and share payload while keeping bootstrap tools...
        "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command ^
          "$ErrorActionPreference='Stop';" ^
          "$site = Join-Path (Get-Location) 'python\Lib\site-packages';" ^
          "$scripts = Join-Path (Get-Location) 'python\Scripts';" ^
          "$share = Join-Path (Get-Location) 'python\share';" ^
          "$keepPatterns = @('pip','pip-*','setuptools','setuptools-*','wheel','wheel-*','_distutils_hack','pkg_resources','distutils-precedence.pth');" ^
          "if(Test-Path $site){ Get-ChildItem -LiteralPath $site -Force | Where-Object { $name = $_.Name; -not ($keepPatterns | ForEach-Object { $name -like $_ } | Where-Object { $_ } | Select-Object -First 1) } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue };" ^
          "if(Test-Path $scripts){ Get-ChildItem -LiteralPath $scripts -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue };" ^
          "if(Test-Path $share){ Get-ChildItem -LiteralPath $share -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }"
        del /q "python\.deps_installed" 2>nul
        del /q "python\.tageditor_installed" 2>nul
        echo [Done] main Python slimmed
    )
) else (
    echo [Keep] main Python packages
)

echo.
echo [5/7] Slim bundled tag editor Python packages too? (Y/N, default N)
echo This will physically remove gradio / transformers / timm / torch and other tag editor runtime packages.
echo It keeps only pip / setuptools / wheel bootstrap components.
set /p "SLIM_TAGEDITOR=: "
if /i "%SLIM_TAGEDITOR%"=="Y" (
    if not exist "%TAGEDITOR_PYTHON_EXE%" (
        echo [Skip] tag editor Python not found
    ) else (
        echo [TagEditor] Removing site-packages, scripts and share payload while keeping bootstrap tools...
        "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command ^
          "$ErrorActionPreference='Stop';" ^
          "$site = Join-Path (Get-Location) 'python_tageditor\Lib\site-packages';" ^
          "$scripts = Join-Path (Get-Location) 'python_tageditor\Scripts';" ^
          "$share = Join-Path (Get-Location) 'python_tageditor\share';" ^
          "$keepPatterns = @('pip','pip-*','setuptools','setuptools-*','wheel','wheel-*','_distutils_hack','pkg_resources','distutils-precedence.pth');" ^
          "if(Test-Path $site){ Get-ChildItem -LiteralPath $site -Force | Where-Object { $name = $_.Name; -not ($keepPatterns | ForEach-Object { $name -like $_ } | Where-Object { $_ } | Select-Object -First 1) } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue };" ^
          "if(Test-Path $scripts){ Get-ChildItem -LiteralPath $scripts -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue };" ^
          "if(Test-Path $share){ Get-ChildItem -LiteralPath $share -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }"
        del /q "python_tageditor\.tageditor_installed" 2>nul
        echo [Done] tag editor Python slimmed
    )
) else (
    echo [Keep] tag editor Python packages
)

echo.
echo [6/7] Slim bundled Blackwell Python packages too? (Y/N, default N)
echo This will physically remove torch / torchvision / xformers and other Blackwell runtime packages.
echo It keeps only pip / setuptools / wheel bootstrap components.
set /p "SLIM_BLACKWELL=: "
if /i "%SLIM_BLACKWELL%"=="Y" (
    if not exist "%BLACKWELL_PYTHON_EXE%" (
        echo [Skip] Blackwell Python not found
    ) else (
        echo [Blackwell] Removing site-packages, scripts and share payload while keeping bootstrap tools...
        "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command ^
          "$ErrorActionPreference='Stop';" ^
          "$site = Join-Path (Get-Location) 'python_blackwell\Lib\site-packages';" ^
          "$scripts = Join-Path (Get-Location) 'python_blackwell\Scripts';" ^
          "$share = Join-Path (Get-Location) 'python_blackwell\share';" ^
          "$keepPatterns = @('pip','pip-*','setuptools','setuptools-*','wheel','wheel-*','_distutils_hack','pkg_resources','distutils-precedence.pth');" ^
          "if(Test-Path $site){ Get-ChildItem -LiteralPath $site -Force | Where-Object { $name = $_.Name; -not ($keepPatterns | ForEach-Object { $name -like $_ } | Where-Object { $_ } | Select-Object -First 1) } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue };" ^
          "if(Test-Path $scripts){ Get-ChildItem -LiteralPath $scripts -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue };" ^
          "if(Test-Path $share){ Get-ChildItem -LiteralPath $share -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }"
        del /q "python_blackwell\.deps_installed" 2>nul
        echo [Done] Blackwell Python slimmed
    )
) else (
    echo [Keep] Blackwell Python packages
)

echo.
echo [7/7] Slim bundled SageAttention Python packages too? (Y/N, default N)
echo This will physically remove torch / torchvision / triton / sageattention and other SageAttention runtime packages.
echo It keeps only pip / setuptools / wheel bootstrap components.
echo If both hyphen and legacy underscore runtime folders exist, all detected SageAttention runtimes will be slimmed here.
set /p "SLIM_SAGEATTENTION=: "
if /i "%SLIM_SAGEATTENTION%"=="Y" (
    call :slim_python_runtime "%SAGEATTENTION_DIR_PRIMARY%" "SageAttention"
    if /i not "%SAGEATTENTION_DIR_PRIMARY%"=="%SAGEATTENTION_DIR_LEGACY%" call :slim_python_runtime "%SAGEATTENTION_DIR_LEGACY%" "SageAttention Legacy"
    call :slim_python_runtime "%SAGEATTENTION_BLACKWELL_DIR_PRIMARY%" "SageAttention Blackwell"
    if /i not "%SAGEATTENTION_BLACKWELL_DIR_PRIMARY%"=="%SAGEATTENTION_BLACKWELL_DIR_LEGACY%" call :slim_python_runtime "%SAGEATTENTION_BLACKWELL_DIR_LEGACY%" "SageAttention Blackwell Legacy"
) else (
    echo [Keep] SageAttention Python packages
)

echo.
echo Cleanup summary:
echo - Always cleared: __pycache__, *.pyc, logs, config\autosave, tmp, frontend\.vitepress\cache
echo - Optional: output, huggingface cache/config, main python deps, tag editor deps, blackwell python deps, SageAttention python deps
echo - Main/Blackwell python slimming also removes xformers and will require reinstall on next startup
echo - SageAttention python slimming removes triton / sageattention and will require reinstall on next startup
echo - Main remaining bulky folder should drop massively after choosing Y for main python slimming
echo.
pause
exit /b 0

:slim_python_runtime
set "RUNTIME_DIR=%~1"
set "RUNTIME_LABEL=%~2"

if "%RUNTIME_DIR%"=="" exit /b 0
if not exist "%~dp0%RUNTIME_DIR%\python.exe" (
    echo [Skip] %RUNTIME_LABEL% Python not found: %RUNTIME_DIR%
    exit /b 0
)

echo [%RUNTIME_LABEL%] Removing site-packages, scripts and share payload while keeping bootstrap tools... (%RUNTIME_DIR%)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$site = Join-Path (Get-Location) '%RUNTIME_DIR%\Lib\site-packages';" ^
  "$scripts = Join-Path (Get-Location) '%RUNTIME_DIR%\Scripts';" ^
  "$share = Join-Path (Get-Location) '%RUNTIME_DIR%\share';" ^
  "$keepPatterns = @('pip','pip-*','setuptools','setuptools-*','wheel','wheel-*','_distutils_hack','pkg_resources','distutils-precedence.pth');" ^
  "if(Test-Path $site){ Get-ChildItem -LiteralPath $site -Force | Where-Object { $name = $_.Name; -not ($keepPatterns | ForEach-Object { $name -like $_ } | Where-Object { $_ } | Select-Object -First 1) } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue };" ^
  "if(Test-Path $scripts){ Get-ChildItem -LiteralPath $scripts -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue };" ^
  "if(Test-Path $share){ Get-ChildItem -LiteralPath $share -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue }"
del /q "%RUNTIME_DIR%\.deps_installed" 2>nul
echo [Done] %RUNTIME_LABEL% Python slimmed (%RUNTIME_DIR%)
exit /b 0
