@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo Cleanup SD-rescripts Workspace
echo ========================================
echo.

cd /d "%~dp0"

call :set_preferred_runtime_dir "python" MAIN_RUNTIME_DIR
call :set_preferred_runtime_dir "python_tageditor" TAGEDITOR_RUNTIME_DIR
call :set_preferred_runtime_dir "python_blackwell" BLACKWELL_RUNTIME_DIR
call :set_preferred_runtime_dir "python-flashattention" FLASHATTENTION_DIR_PRIMARY
call :set_preferred_runtime_dir "python_flashattention" FLASHATTENTION_DIR_LEGACY
call :set_preferred_runtime_dir "python_xpu_intel" INTEL_XPU_RUNTIME_DIR
call :set_preferred_runtime_dir "python_xpu_intel_sage" INTEL_XPU_SAGE_RUNTIME_DIR
call :set_preferred_runtime_dir "python_rocm_amd" AMD_ROCM_RUNTIME_DIR
call :set_preferred_runtime_dir "python_rocm_amd_sage" AMD_ROCM_SAGE_RUNTIME_DIR
call :set_preferred_runtime_dir "python-sageattention" SAGEATTENTION_DIR_PRIMARY
call :set_preferred_runtime_dir "python_sageattention" SAGEATTENTION_DIR_LEGACY
call :set_preferred_runtime_dir "python_sagebwd_nvidia" SAGEBWD_NVIDIA_DIR
call :set_preferred_runtime_dir "python-sagebwd-nvidia" SAGEBWD_NVIDIA_DIR_LEGACY

set "PYTHON_EXE=%~dp0%MAIN_RUNTIME_DIR%\python.exe"
set "TAGEDITOR_PYTHON_EXE=%~dp0%TAGEDITOR_RUNTIME_DIR%\python.exe"
set "BLACKWELL_PYTHON_EXE=%~dp0%BLACKWELL_RUNTIME_DIR%\python.exe"

echo [1/9] Removing Python cache...
for /d /r %%D in (__pycache__) do @if exist "%%~fD" rmdir /s /q "%%~fD" 2>nul
del /s /q *.pyc *.pyo 2>nul
echo [Done]

echo.
echo [2/9] Resetting runtime folders to initial state...
if exist "logs" rmdir /s /q "logs" 2>nul
if exist "config\autosave" rmdir /s /q "config\autosave" 2>nul
if exist "tmp" rmdir /s /q "tmp" 2>nul
if exist "frontend\.vitepress\cache" rmdir /s /q "frontend\.vitepress\cache" 2>nul
call :clear_runtime_cache "%MAIN_RUNTIME_DIR%"
call :clear_runtime_cache "%TAGEDITOR_RUNTIME_DIR%"
call :clear_runtime_cache "%BLACKWELL_RUNTIME_DIR%"
call :clear_runtime_cache "%FLASHATTENTION_DIR_PRIMARY%"
call :clear_runtime_cache "%FLASHATTENTION_DIR_LEGACY%"
call :clear_runtime_cache "%INTEL_XPU_RUNTIME_DIR%"
call :clear_runtime_cache "%INTEL_XPU_SAGE_RUNTIME_DIR%"
call :clear_runtime_cache "%AMD_ROCM_RUNTIME_DIR%"
call :clear_runtime_cache "%AMD_ROCM_SAGE_RUNTIME_DIR%"
call :clear_runtime_cache "%SAGEATTENTION_DIR_PRIMARY%"
call :clear_runtime_cache "%SAGEATTENTION_DIR_LEGACY%"
call :clear_runtime_cache "%SAGEBWD_NVIDIA_DIR%"
call :clear_runtime_cache "%SAGEBWD_NVIDIA_DIR_LEGACY%"

mkdir "logs" 2>nul
mkdir "config\autosave" 2>nul
mkdir "tmp" 2>nul
mkdir "huggingface" 2>nul
echo [Done]

echo.
echo [3/9] Optional data cleanup...
echo Delete output folder? (Y/N, default Y)
call :prompt_yes_default_yes DEL_OUTPUT ": "
if /i "%DEL_OUTPUT%"=="Y" (
    if exist "output" rmdir /s /q "output" 2>nul
    echo [Deleted] output
) else (
    echo [Keep] output
)

echo.
echo Delete HuggingFace cache/config folders? (Y/N, default Y)
echo This can free a lot of space, but model/download cache will be rebuilt later.
call :prompt_yes_default_yes DEL_HF ": "
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
) else (
    echo [Keep] HuggingFace cache/config
)

echo.
echo [4/9] Slim bundled main Python packages for distribution? (Y/N, default Y)
echo This will physically remove installed runtime packages like torch / torchvision / xformers / diffusers / transformers / numpy / scipy / onnxruntime.
echo It also removes YOLO and aesthetic scorer related packages such as opencv-python / matplotlib / polars / PyYAML / open-clip-torch / timm / tqdm.
echo It keeps only pip / setuptools / wheel bootstrap components so first startup can auto-install dependencies again.
echo It does not delete the python folder itself; only Lib\site-packages / Scripts / share payload is slimmed.
echo [Input] Press Enter to slim the main python runtime. Enter N to keep it.
call :prompt_yes_default_yes SLIM_MAIN "[4/9 Confirm] > "
if /i "%SLIM_MAIN%"=="Y" (
    if not exist "%PYTHON_EXE%" (
        echo [Skip] portable main Python not found
    ) else (
        call :slim_python_runtime "%MAIN_RUNTIME_DIR%" "Main" ".deps_installed .tageditor_installed"
    )
) else (
    echo [Keep] main Python packages
)

echo.
echo [5/9] Slim bundled tag editor Python packages too? (Y/N, default Y)
echo This will physically remove gradio / transformers / timm / torch and other tag editor runtime packages.
echo It keeps only pip / setuptools / wheel bootstrap components.
echo It does not delete the python_tageditor folder itself; only runtime payload is slimmed.
echo [Input] Press Enter to slim the tag editor runtime. Enter N to keep it.
call :prompt_yes_default_yes SLIM_TAGEDITOR "[5/9 Confirm] > "
if /i "%SLIM_TAGEDITOR%"=="Y" (
    if not exist "%TAGEDITOR_PYTHON_EXE%" (
        echo [Skip] tag editor Python not found
    ) else (
        call :slim_python_runtime "%TAGEDITOR_RUNTIME_DIR%" "TagEditor" ".tageditor_installed"
    )
) else (
    echo [Keep] tag editor Python packages
)

echo.
echo [6/9] Slim bundled Blackwell / FlashAttention Python packages too? (Y/N, default Y)
echo This will physically remove torch / torchvision / xformers and other Blackwell runtime packages.
echo It also covers the dedicated FlashAttention runtime if detected.
echo It keeps only pip / setuptools / wheel bootstrap components.
echo It does not delete the python_blackwell / python-flashattention folders themselves; only runtime payload is slimmed.
echo [Input] Press Enter to slim the Blackwell / FlashAttention runtimes. Enter N to keep them.
call :prompt_yes_default_yes SLIM_BLACKWELL "[6/9 Confirm] > "
if /i "%SLIM_BLACKWELL%"=="Y" (
    if not exist "%BLACKWELL_PYTHON_EXE%" (
        echo [Skip] Blackwell Python not found
    ) else (
        call :slim_python_runtime "%BLACKWELL_RUNTIME_DIR%" "Blackwell" ".deps_installed"
    )
    call :slim_python_runtime "%FLASHATTENTION_DIR_PRIMARY%" "FlashAttention" ".deps_installed"
    if /i not "%FLASHATTENTION_DIR_PRIMARY%"=="%FLASHATTENTION_DIR_LEGACY%" call :slim_python_runtime "%FLASHATTENTION_DIR_LEGACY%" "FlashAttention Legacy" ".deps_installed"
) else (
    echo [Keep] Blackwell / FlashAttention Python packages
)

echo.
echo [7/9] Slim bundled Intel XPU Python packages too? (Y/N, default Y)
echo This will physically remove torch / torchvision / intel-xpu related packages from the Intel runtimes.
echo It also covers the Intel XPU Sage runtime if detected.
echo It keeps only pip / setuptools / wheel bootstrap components.
echo [Input] Press Enter to slim the Intel XPU runtimes. Enter N to keep them.
call :prompt_yes_default_yes SLIM_INTEL_XPU "[7/9 Confirm] > "
if /i "%SLIM_INTEL_XPU%"=="Y" (
    call :slim_python_runtime "%INTEL_XPU_RUNTIME_DIR%" "Intel XPU" ".deps_installed"
    call :slim_python_runtime "%INTEL_XPU_SAGE_RUNTIME_DIR%" "Intel XPU Sage" ".deps_installed"
) else (
    echo [Keep] Intel XPU Python packages
)

echo.
echo [8/9] Slim bundled AMD ROCm Python packages too? (Y/N, default Y)
echo This will physically remove torch / torchvision / ROCm related packages from the AMD runtimes.
echo It also covers the AMD ROCm Sage runtime if detected.
echo It keeps only pip / setuptools / wheel bootstrap components.
echo [Input] Press Enter to slim the AMD ROCm runtimes. Enter N to keep them.
call :prompt_yes_default_yes SLIM_AMD_ROCM "[8/9 Confirm] > "
if /i "%SLIM_AMD_ROCM%"=="Y" (
    call :slim_python_runtime "%AMD_ROCM_RUNTIME_DIR%" "AMD ROCm" ".deps_installed"
    call :slim_python_runtime "%AMD_ROCM_SAGE_RUNTIME_DIR%" "AMD ROCm Sage" ".deps_installed"
) else (
    echo [Keep] AMD ROCm Python packages
)

echo.
echo [9/9] Slim bundled SageAttention Python packages too? (Y/N, default Y)
echo This will physically remove torch / torchvision / triton / sageattention and other SageAttention runtime packages.
echo It also covers the experimental SageBwd NVIDIA runtime if detected.
echo It also removes YOLO and aesthetic scorer related packages such as opencv-python / matplotlib / polars / PyYAML / open-clip-torch / timm / tqdm.
echo It keeps only pip / setuptools / wheel bootstrap components.
echo It does not delete the SageAttention / SageBwd runtime folders themselves; only runtime payload is slimmed.
echo If both hyphen and legacy underscore runtime folders exist, all detected SageAttention runtimes will be slimmed here.
echo [Input] Press Enter to slim the SageAttention / SageBwd runtimes. Enter N to keep them.
call :prompt_yes_default_yes SLIM_SAGEATTENTION "[9/9 Confirm] > "
if /i "%SLIM_SAGEATTENTION%"=="Y" (
    call :slim_python_runtime "%SAGEATTENTION_DIR_PRIMARY%" "SageAttention"
    if /i not "%SAGEATTENTION_DIR_PRIMARY%"=="%SAGEATTENTION_DIR_LEGACY%" call :slim_python_runtime "%SAGEATTENTION_DIR_LEGACY%" "SageAttention Legacy"
    call :slim_python_runtime "%SAGEBWD_NVIDIA_DIR%" "SageBwd NVIDIA"
    if /i not "%SAGEBWD_NVIDIA_DIR%"=="%SAGEBWD_NVIDIA_DIR_LEGACY%" call :slim_python_runtime "%SAGEBWD_NVIDIA_DIR_LEGACY%" "SageBwd NVIDIA Legacy"
) else (
    echo [Keep] SageAttention / SageBwd Python packages
)

echo.
echo Cleanup summary:
echo - Always cleared: __pycache__, *.pyc, logs, config\autosave, tmp, frontend\.vitepress\cache, runtime .cache / torch_compile_debug
echo - Always checked for caches in both root runtimes and env\ runtimes when detected
echo - Optional: output, huggingface cache/config, main python deps, tag editor deps, Blackwell / FlashAttention deps, Intel XPU deps, AMD ROCm deps, SageAttention deps
echo - Main/Blackwell/FlashAttention/Intel/AMD slimming removes most installed runtime payload and will require reinstall on next startup
echo - SageAttention python slimming also covers the experimental SageBwd NVIDIA runtime, removes triton / sageattention-related payloads / YOLO extras / aesthetic scorer extras, and will require reinstall on next startup
echo - Main remaining bulky folder should drop massively after choosing Y for main python slimming
echo.
pause
exit /b 0

:set_preferred_runtime_dir
set "%~2=%~1"
if exist "%~dp0env\%~1\" set "%~2=env\%~1"
exit /b 0

:prompt_yes_default_yes
set "%~1="
set /p "%~1=%~2"
if not defined %~1 set "%~1=Y"
exit /b 0

:clear_runtime_cache
set "CACHE_RUNTIME_DIR=%~1"
if "%CACHE_RUNTIME_DIR%"=="" exit /b 0
if not exist "%~dp0%CACHE_RUNTIME_DIR%" exit /b 0
if exist "%CACHE_RUNTIME_DIR%\.cache" rmdir /s /q "%CACHE_RUNTIME_DIR%\.cache" 2>nul
if exist "%CACHE_RUNTIME_DIR%\torch_compile_debug" rmdir /s /q "%CACHE_RUNTIME_DIR%\torch_compile_debug" 2>nul
exit /b 0

:slim_python_runtime
set "RUNTIME_DIR=%~1"
set "RUNTIME_LABEL=%~2"
set "RUNTIME_MARKERS=%~3"

if "%RUNTIME_DIR%"=="" exit /b 0
if not exist "%~dp0%RUNTIME_DIR%\python.exe" (
    echo [Skip] %RUNTIME_LABEL% Python not found: %RUNTIME_DIR%
    exit /b 0
)

call :runtime_is_in_use "%RUNTIME_DIR%"
if errorlevel 7 (
    echo [Warn] %RUNTIME_LABEL% Python is currently in use.
    call :runtime_list_processes "%RUNTIME_DIR%"
    echo [Confirm] %RUNTIME_LABEL% runtime is busy, so cleanup cannot continue unless those processes are closed first.
    echo [Confirm] Press Enter to force close processes under %RUNTIME_DIR% and continue cleanup. Enter N to skip this runtime.
    call :prompt_yes_default_yes FORCE_CLOSE_RUNTIME "[Force Close %RUNTIME_LABEL%] > "
    if /i not "%FORCE_CLOSE_RUNTIME%"=="Y" (
        echo [Skip] %RUNTIME_LABEL% Python slimming skipped because the runtime is in use.
        exit /b 0
    )
    call :runtime_force_close "%RUNTIME_DIR%"
    timeout /t 2 /nobreak >nul
    call :runtime_is_in_use "%RUNTIME_DIR%"
    if errorlevel 7 (
        echo [Fail] %RUNTIME_LABEL% Python is still in use after the forced close attempt.
        exit /b 1
    )
)

echo [%RUNTIME_LABEL%] Removing site-packages, scripts and share payload while keeping bootstrap tools... (%RUNTIME_DIR%)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$runtime = Join-Path (Get-Location) '%RUNTIME_DIR%';" ^
  "$site = Join-Path $runtime 'Lib\site-packages';" ^
  "$scripts = Join-Path $runtime 'Scripts';" ^
  "$share = Join-Path $runtime 'share';" ^
  "$keepPatterns = @('pip','pip-*','setuptools','setuptools-*','wheel','wheel-*','_distutils_hack','pkg_resources','distutils-precedence.pth');" ^
  "$failed = New-Object System.Collections.Generic.List[string];" ^
  "if(Test-Path $site){ foreach($item in Get-ChildItem -LiteralPath $site -Force){ $name = $item.Name; $keep = $false; foreach($pattern in $keepPatterns){ if($name -like $pattern){ $keep = $true; break } }; if(-not $keep){ try { Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop } catch { $failed.Add($item.FullName) } } } };" ^
  "if(Test-Path $scripts){ foreach($item in Get-ChildItem -LiteralPath $scripts -Force){ try { Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop } catch { $failed.Add($item.FullName) } } };" ^
  "if(Test-Path $share){ foreach($item in Get-ChildItem -LiteralPath $share -Force){ try { Remove-Item -LiteralPath $item.FullName -Recurse -Force -ErrorAction Stop } catch { $failed.Add($item.FullName) } } };" ^
  "if($failed.Count -gt 0){ Write-Host ('FAILED:' + ($failed -join '; ')); exit 1 }"
if errorlevel 1 (
    echo [Fail] %RUNTIME_LABEL% Python slimming failed. Close any running processes using %RUNTIME_DIR% and try again.
    exit /b 1
)
for %%M in (%RUNTIME_MARKERS%) do del /q "%RUNTIME_DIR%\%%~M" 2>nul
echo [Done] %RUNTIME_LABEL% Python slimmed (%RUNTIME_DIR%)
exit /b 0

:runtime_is_in_use
set "CHECK_RUNTIME_DIR=%~1"
if "%CHECK_RUNTIME_DIR%"=="" exit /b 0
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command ^
  "$runtime=[System.IO.Path]::GetFullPath((Join-Path (Get-Location) '%CHECK_RUNTIME_DIR%'));" ^
  "$found=$false;" ^
  "foreach($proc in Get-CimInstance Win32_Process){ if($proc.ExecutablePath){ try{ $exe=[System.IO.Path]::GetFullPath($proc.ExecutablePath) } catch { $exe=$proc.ExecutablePath }; if($exe.StartsWith($runtime,[System.StringComparison]::OrdinalIgnoreCase)){ $found=$true; break } } };" ^
  "if($found){ exit 7 } else { exit 0 }"
exit /b %errorlevel%

:runtime_list_processes
set "CHECK_RUNTIME_DIR=%~1"
if "%CHECK_RUNTIME_DIR%"=="" exit /b 0
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command ^
  "$runtime=[System.IO.Path]::GetFullPath((Join-Path (Get-Location) '%CHECK_RUNTIME_DIR%'));" ^
  "Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | ForEach-Object { try { $exe=[System.IO.Path]::GetFullPath($_.ExecutablePath) } catch { $exe=$_.ExecutablePath }; if($exe.StartsWith($runtime,[System.StringComparison]::OrdinalIgnoreCase)){ Write-Host ('  PID=' + $_.ProcessId + ' Name=' + $_.Name + ' Path=' + $_.ExecutablePath) } }"
exit /b 0

:runtime_force_close
set "CHECK_RUNTIME_DIR=%~1"
if "%CHECK_RUNTIME_DIR%"=="" exit /b 0
echo [Action] Force closing processes under %CHECK_RUNTIME_DIR%...
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -Command ^
  "$runtime=[System.IO.Path]::GetFullPath((Join-Path (Get-Location) '%CHECK_RUNTIME_DIR%'));" ^
  "$targets = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath } | ForEach-Object { try { $exe=[System.IO.Path]::GetFullPath($_.ExecutablePath) } catch { $exe=$_.ExecutablePath }; if($exe.StartsWith($runtime,[System.StringComparison]::OrdinalIgnoreCase)){ $_ } };" ^
  "foreach($proc in $targets){ try { Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop; Write-Host ('  Stopped PID=' + $proc.ProcessId + ' Name=' + $proc.Name) } catch { Write-Host ('  Failed PID=' + $proc.ProcessId + ' Name=' + $proc.Name + ' :: ' + $_.Exception.Message) } }"
exit /b 0
