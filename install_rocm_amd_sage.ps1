param()

$ErrorActionPreference = "Stop"

$Env:HF_HOME = "huggingface"
$Env:PYTHONUTF8 = "1"
$Env:PIP_DISABLE_PIP_VERSION_CHECK = "1"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $repoRoot "python_rocm_amd_sage"
$runtimePython = Join-Path $runtimeDir "python.exe"
$runtimeMarker = Join-Path $runtimeDir ".deps_installed"
$selfTestScript = Join-Path $repoRoot "mikazuki\scripts\amd_rocm_sage_selftest.py"
$requirementsPath = Join-Path $repoRoot "requirements.txt"
$sourceCandidates = @(
    (Join-Path $runtimeDir "SageAttention-rocm"),
    (Join-Path $repoRoot "python_rocm_amd\SageAttention-rocm")
)
$mainRequiredModules = @(
    "accelerate",
    "torch",
    "fastapi",
    "toml",
    "transformers",
    "diffusers",
    "cv2"
)
$incompatiblePackages = @(
    "bitsandbytes",
    "xformers",
    "sageattention",
    "triton-windows",
    "pytorch-triton-rocm"
)

$expectedRuntime = @{
    PythonMinor = "3.12"
    TorchPrefix = "2.9.1+"
    TorchVisionPrefix = "0.24.1+"
    HipPrefix = "7.2"
}

$rocmWheelBase = "https://repo.radeon.com/rocm/windows/rocm-rel-7.2"
$rocmSdkPackages = @(
    "$rocmWheelBase/rocm_sdk_core-7.2.0.dev0-py3-none-win_amd64.whl",
    "$rocmWheelBase/rocm_sdk_libraries_custom-7.2.0.dev0-py3-none-win_amd64.whl",
    "$rocmWheelBase/rocm_sdk_devel-7.2.0.dev0-py3-none-win_amd64.whl",
    "$rocmWheelBase/rocm-7.2.0.dev0.tar.gz"
)
$rocmTorchPackages = @(
    "$rocmWheelBase/torch-2.9.1+rocmsdk20260116-cp312-cp312-win_amd64.whl",
    "$rocmWheelBase/torchvision-0.24.1+rocmsdk20260116-cp312-cp312-win_amd64.whl",
    "$rocmWheelBase/torchaudio-2.9.1+rocmsdk20260116-cp312-cp312-win_amd64.whl"
)
$rocmTorchPythonDeps = @(
    "filelock",
    "typing-extensions>=4.10.0",
    "sympy>=1.13.3",
    "networkx>=2.5.1",
    "jinja2",
    "fsspec>=0.8.5"
)
$transformersConstraint = "transformers>=4.55.5,<5"

function Test-PipReady {
    param (
        [string]$PythonExe
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $PythonExe -m pip --version 1>$null 2>$null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Invoke-Step {
    param (
        [string]$Message,
        [scriptblock]$Action
    )

    Write-Host -ForegroundColor Green $Message
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Message failed with exit code $LASTEXITCODE."
    }
}

function Invoke-OptionalStep {
    param (
        [string]$Message,
        [scriptblock]$Action,
        [string]$WarningMessage
    )

    Write-Host -ForegroundColor Green $Message
    & $Action
    if ($LASTEXITCODE -ne 0) {
        Write-Host -ForegroundColor Yellow $WarningMessage
    }
}

function Test-ModulesReady {
    param (
        [string]$PythonExe,
        [string[]]$Modules
    )

    if (-not $Modules -or $Modules.Count -eq 0) {
        return $true
    }

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $PythonExe -c "import importlib, sys; failed=[];
for name in sys.argv[1:]:
    try:
        importlib.import_module(name)
    except Exception:
        failed.append(name)
raise SystemExit(1 if failed else 0)" @Modules 1>$null 2>$null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Get-MissingModulesReport {
    param (
        [string]$PythonExe,
        [string[]]$Modules
    )

    if (-not $Modules -or $Modules.Count -eq 0) {
        return @()
    }

    $report = @()
    foreach ($moduleName in $Modules) {
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            $output = & $PythonExe -c "import importlib, sys; importlib.import_module(sys.argv[1])" $moduleName 2>&1
            $exitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        if ($exitCode -eq 0) {
            continue
        }

        $reason = ""
        if ($output) {
            $reason = (($output | ForEach-Object { [string]$_ }) -join " ").Trim()
        }
        if ([string]::IsNullOrWhiteSpace($reason)) {
            $reason = "python exited with code $exitCode while importing $moduleName"
        }

        $report += [pscustomobject]@{
            module = $moduleName
            reason = $reason
        }
    }

    return $report
}

function New-FilteredRequirementsFile {
    param (
        [string]$SourcePath
    )

    $tempPath = [System.IO.Path]::GetTempFileName()
    $filteredPath = [System.IO.Path]::ChangeExtension($tempPath, ".txt")
    Move-Item -LiteralPath $tempPath -Destination $filteredPath -Force

    $lines = Get-Content -LiteralPath $SourcePath
    $filtered = foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith("#") -or [string]::IsNullOrWhiteSpace($trimmed)) {
            $line
            continue
        }

        $normalizedRequirement = $trimmed.ToLowerInvariant()
        if (
            $normalizedRequirement -like "bitsandbytes*" -or
            $normalizedRequirement -like "xformers*" -or
            $normalizedRequirement -like "sageattention*" -or
            $normalizedRequirement -like "triton*" -or
            $normalizedRequirement -like "pytorch-triton-rocm*" -or
            $normalizedRequirement -like "pytorch-optimizer*"
        ) {
            continue
        }
        $line
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllLines($filteredPath, $filtered, $utf8NoBom)
    return $filteredPath
}

function Resolve-SageAttentionSourceRoot {
    foreach ($candidate in $sourceCandidates) {
        if (Test-Path (Join-Path $candidate "sageattention\triton\attn_qk_int8_per_block.py")) {
            return $candidate
        }
    }
    return ""
}

function Invoke-PythonJsonProbe {
    param (
        [string]$PythonExe,
        [string]$ScriptContent
    )

    $tempPath = [System.IO.Path]::GetTempFileName()
    $tempPyPath = [System.IO.Path]::ChangeExtension($tempPath, ".py")
    Move-Item -LiteralPath $tempPath -Destination $tempPyPath -Force

    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tempPyPath, $ScriptContent, $utf8NoBom)
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            $raw = & $PythonExe $tempPyPath 2>$null
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }

        $text = if ($raw -is [System.Array]) {
            ($raw | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
        }
        else {
            [string]$raw
        }

        $jsonLine = $text -split "\r?\n" |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -match '^[\{\[]' } |
            Select-Object -Last 1

        if ([string]::IsNullOrWhiteSpace($jsonLine)) {
            return $null
        }

        try {
            return $jsonLine | ConvertFrom-Json
        }
        catch {
            return $null
        }
    }
    finally {
        Remove-Item -LiteralPath $tempPyPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-ROCmAmdSageRuntimeProbe {
    param (
        [string]$PythonExe,
        [string]$SourceRoot
    )

    $repoRootForPython = ($repoRoot -replace "\\", "/")
    $sourceRootForPython = ($SourceRoot -replace "\\", "/")
    $script = @"
import json
import sys
import importlib.metadata as md

sys.path.insert(0, r"$repoRootForPython")

result = {
    "python_version": sys.version.split()[0],
    "python_minor": f"{sys.version_info.major}.{sys.version_info.minor}",
    "torch_version": "",
    "torchvision_version": "",
    "triton_version": "",
    "hip_version": "",
    "gpu_name": "",
    "cuda_available": False,
    "hip_available": False,
    "sageattention_ready": False,
    "sageattention_source": "",
    "sageattention_source_root": r"$sourceRootForPython",
    "runtime_error": "",
}

def metadata_version(*names):
    for name in names:
        try:
            return md.version(name)
        except Exception:
            continue
    return ""

try:
    import torch
except Exception as exc:
    result["runtime_error"] = f"torch import failed: {exc}"
    print(json.dumps(result))
    raise SystemExit(0)

result["torch_version"] = getattr(torch, "__version__", "")
result["torchvision_version"] = metadata_version("torchvision")
result["triton_version"] = metadata_version("triton", "pytorch-triton-rocm")
result["cuda_available"] = bool(torch.cuda.is_available())
result["hip_version"] = str(getattr(torch.version, "hip", "") or "")
result["hip_available"] = bool(result["hip_version"])

try:
    if result["cuda_available"] and torch.cuda.device_count() > 0:
        result["gpu_name"] = str(torch.cuda.get_device_name(0) or "")
except Exception as exc:
    if not result["runtime_error"]:
        result["runtime_error"] = f"device probe failed: {exc}"

try:
    import triton  # noqa: F401
except Exception as exc:
    if not result["runtime_error"]:
        result["runtime_error"] = f"triton import failed: {exc}"

try:
    from mikazuki.utils.amd_sageattention import probe_runtime_sageattention
    probe = probe_runtime_sageattention()
    result["sageattention_ready"] = bool(probe.get("ready"))
    result["sageattention_source"] = str(probe.get("source", "") or "")
    if not result["sageattention_source_root"]:
        result["sageattention_source_root"] = str(probe.get("source_root", "") or "")
    if not result["sageattention_ready"] and not result["runtime_error"]:
        result["runtime_error"] = str(probe.get("reason", "") or "AMD SageAttention bridge is not ready.")
except Exception as exc:
    if not result["runtime_error"]:
        result["runtime_error"] = f"AMD SageAttention probe failed: {exc}"

if not result["hip_available"] and not result["runtime_error"]:
    result["runtime_error"] = "Torch is not a ROCm build."
elif not result["cuda_available"] and not result["runtime_error"]:
    result["runtime_error"] = "ROCm runtime is installed, but no AMD GPU is available to Torch."

print(json.dumps(result))
"@

    return Invoke-PythonJsonProbe -PythonExe $PythonExe -ScriptContent $script
}

if (-not (Test-Path $runtimePython)) {
    throw @"
python_rocm_amd_sage\python.exe was not found.

Expected path:
- $runtimePython

Recommended fix:
1. Copy your working python_rocm_amd runtime to .\python_rocm_amd_sage
2. Keep the downloaded SageAttention-rocm source under:
   - .\python_rocm_amd_sage\SageAttention-rocm
   or
   - .\python_rocm_amd\SageAttention-rocm
3. Rerun this installer
"@
}

$sourceRoot = Resolve-SageAttentionSourceRoot
if (-not $sourceRoot) {
    throw @"
SageAttention-rocm source was not found.

Expected one of:
- .\python_rocm_amd_sage\SageAttention-rocm
- .\python_rocm_amd\SageAttention-rocm
"@
}

Set-Location $repoRoot

if (-not (Test-PipReady -PythonExe $runtimePython)) {
    Write-Host -ForegroundColor Yellow "python_rocm_amd_sage 尚未完成 pip 初始化，正在尝试自动修复。"
    & (Join-Path $repoRoot "setup_embeddable_python.bat") --auto python_rocm_amd_sage
    if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $runtimePython)) {
        throw "python_rocm_amd_sage pip 初始化失败，请先修复该运行时。"
    }
}

if (-not (Test-Path $requirementsPath)) {
    throw "requirements.txt was not found: $requirementsPath"
}

Write-Host -ForegroundColor Yellow "AMD Sage 支线当前不会覆盖主线 sageattention 包，而是优先尝试加载本地 SageAttention-rocm Triton 源码桥接层。"
Write-Host -ForegroundColor Yellow "这条线依赖 Triton 能在 Windows ROCm 运行；若 Triton 不可用，安装器会直接把这条支线标记为未就绪。"
Write-Host -ForegroundColor Yellow "本次使用的本地 SageAttention-rocm 路径: $sourceRoot"
Write-Host -ForegroundColor Yellow "当前安装器会先把 python_rocm_amd_sage 强制切到独立的 AMD ROCm wheel 组合，然后再尝试实验性 Triton + AMD Sage bridge。"

$filteredRequirementsPath = $null

try {
    Remove-Item -LiteralPath $runtimeMarker -Force -ErrorAction SilentlyContinue

    Invoke-Step "Upgrading pip tooling..." {
        & $runtimePython -m pip install --upgrade --no-warn-script-location pip "setuptools<81" wheel
    }

    Invoke-OptionalStep "Removing conflicting packages from AMD Sage runtime..." {
        & $runtimePython -m pip uninstall -y @incompatiblePackages
    } "Skipping incompatible package cleanup because pip uninstall returned a non-zero exit code."

    Invoke-Step "Installing AMD ROCm SDK wheels for AMD Sage runtime..." {
        & $runtimePython -m pip install --upgrade --force-reinstall --no-warn-script-location --prefer-binary @rocmSdkPackages
    }

    Invoke-Step "Installing shared Python dependencies required by ROCm PyTorch wheels for AMD Sage runtime..." {
        & $runtimePython -m pip install --upgrade --no-warn-script-location --prefer-binary @rocmTorchPythonDeps
    }

    Invoke-Step "Installing PyTorch ROCm wheels for AMD Sage runtime..." {
        & $runtimePython -m pip install --upgrade --force-reinstall --no-deps --no-warn-script-location --prefer-binary @rocmTorchPackages
    }

    $filteredRequirementsPath = New-FilteredRequirementsFile -SourcePath $requirementsPath

    Invoke-Step "Installing project dependencies for AMD Sage runtime..." {
        & $runtimePython -m pip install --upgrade --no-warn-script-location --prefer-binary -r $filteredRequirementsPath
    }

    Invoke-Step "Upgrading transformers for AMD Sage runtime compatibility..." {
        & $runtimePython -m pip install --upgrade --no-warn-script-location --prefer-binary $transformersConstraint
    }

    Invoke-OptionalStep "Installing Triton for AMD Sage runtime..." {
        & $runtimePython -m pip install --upgrade --no-warn-script-location --prefer-binary triton
    } "Triton install did not finish cleanly. The AMD Sage self-test will determine whether this runtime is usable."

    if (-not (Test-ModulesReady -PythonExe $runtimePython -Modules $mainRequiredModules)) {
        $missingModules = @(Get-MissingModulesReport -PythonExe $runtimePython -Modules $mainRequiredModules)
        if ($missingModules.Count -gt 0) {
            $details = $missingModules | ForEach-Object {
                $moduleName = [string]$_.module
                $reason = [string]$_.reason
                if ([string]::IsNullOrWhiteSpace($reason)) {
                    $moduleName
                }
                else {
                    "${moduleName}: ${reason}"
                }
            }
            throw "Project dependencies did not finish installing correctly in python_rocm_amd_sage. Missing/broken modules: $($details -join '; ')"
        }
        throw "Project dependencies did not finish installing correctly in python_rocm_amd_sage."
    }

    $probe = Get-ROCmAmdSageRuntimeProbe -PythonExe $runtimePython -SourceRoot $sourceRoot
    if (-not $probe) {
        throw "Could not probe python_rocm_amd_sage runtime details."
    }
    if ($expectedRuntime.PythonMinor -and $probe.python_minor -ne $expectedRuntime.PythonMinor) {
        throw "Python minor is $($probe.python_minor), expected $($expectedRuntime.PythonMinor)"
    }
    if ($expectedRuntime.TorchPrefix -and ([string]::IsNullOrWhiteSpace($probe.torch_version) -or -not $probe.torch_version.StartsWith($expectedRuntime.TorchPrefix))) {
        throw "Torch is $($probe.torch_version), expected prefix $($expectedRuntime.TorchPrefix)"
    }
    if ($expectedRuntime.TorchVisionPrefix -and ([string]::IsNullOrWhiteSpace($probe.torchvision_version) -or -not $probe.torchvision_version.StartsWith($expectedRuntime.TorchVisionPrefix))) {
        throw "TorchVision is $($probe.torchvision_version), expected prefix $($expectedRuntime.TorchVisionPrefix)"
    }
    if ($expectedRuntime.HipPrefix -and ([string]::IsNullOrWhiteSpace($probe.hip_version) -or -not $probe.hip_version.StartsWith($expectedRuntime.HipPrefix))) {
        throw "HIP runtime is $($probe.hip_version), expected prefix $($expectedRuntime.HipPrefix)"
    }
    if (-not $probe.hip_available) {
        throw "Torch is not a ROCm build."
    }
    if (-not $probe.cuda_available) {
        throw "ROCm GPU is not available to Torch."
    }
    if (-not $probe.sageattention_ready) {
        throw "AMD Sage bridge is not ready."
    }
    if ($probe.runtime_error) {
        throw $probe.runtime_error
    }

    Write-Host -ForegroundColor Green "AMD ROCm Sage runtime: Python $($probe.python_version); Torch $($probe.torch_version); TorchVision $($probe.torchvision_version); Triton $($probe.triton_version); HIP $($probe.hip_version); GPU $($probe.gpu_name)"
    Write-Host -ForegroundColor Green "AMD ROCm Sage source: $($probe.sageattention_source)"

    Invoke-Step "Running AMD ROCm Sage self-test / 运行 AMD ROCm Sage 最小自检" -Action {
        if (-not (Test-Path $selfTestScript)) {
            throw "AMD ROCm Sage self-test script was not found: $selfTestScript"
        }

        $raw = & $runtimePython $selfTestScript
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
            throw "AMD ROCm Sage self-test did not return a readable result."
        }

        $probe = (($raw | Select-Object -Last 1) | ConvertFrom-Json)
        if (-not $probe.success) {
            $detail = [string]$probe.runtime_error
            if (-not [string]::IsNullOrWhiteSpace([string]$probe.traceback_tail)) {
                $detail = "$detail | $($probe.traceback_tail)"
            }
            throw "AMD ROCm Sage self-test failed: $detail"
        }

        Write-Host -ForegroundColor Green "AMD ROCm Sage self-test passed: dtype=$($probe.tested_dtype); layout=$($probe.tested_layout); head_dims=$($probe.tested_head_dims -join ','); variants=$($probe.tested_variants -join ','); shape=$($probe.output_shape -join 'x'); finite=$($probe.all_finite); max_abs_diff_vs_sdpa=$($probe.max_abs_diff_vs_sdpa); varlen_ok=$($probe.varlen_ok); backward_ok=$($probe.backward_ok)"
    }

    Set-Content -Path $runtimeMarker -Value "ok" -Encoding ASCII
    Write-Host -ForegroundColor Green "AMD ROCm Sage experimental runtime install completed"
}
finally {
    if ($filteredRequirementsPath -and (Test-Path $filteredRequirementsPath)) {
        Remove-Item -LiteralPath $filteredRequirementsPath -Force -ErrorAction SilentlyContinue
    }
}
