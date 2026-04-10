param(
    [ValidateSet("stable", "nightly", "panchovix-20250321", "czmahi-20250502")]
    [string]$TorchChannel = "czmahi-20250502",
    [string]$XformersWheel = "",
    [switch]$SkipXformers,
    [switch]$AllowOfficialXformersFallback
)

$ErrorActionPreference = "Stop"

$Env:HF_HOME = "huggingface"
$Env:PYTHONUTF8 = "1"
$Env:PIP_DISABLE_PIP_VERSION_CHECK = "1"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $repoRoot "tools\runtime\runtime_paths.ps1")

$blackwellRuntimeInfo = Resolve-RuntimeDirectoryInfo -RepoRoot $repoRoot -RuntimeName "blackwell"
$blackwellRuntimeDirName = $blackwellRuntimeInfo.DirectoryName
$blackwellRuntimeDir = $blackwellRuntimeInfo.DirectoryPath
$blackwellPython = Join-Path $blackwellRuntimeDir "python.exe"
$blackwellMarker = Join-Path $blackwellRuntimeDir ".deps_installed"
$mainRequiredModules = @("accelerate", "torch", "fastapi", "toml", "transformers", "diffusers", "lion_pytorch", "dadaptation", "schedulefree", "prodigyopt", "prodigyplus", "pytorch_optimizer")

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

function Get-BlackwellExpectedPackageVersions {
    param (
        [string]$Profile
    )

    switch ($Profile) {
        "czmahi-20250502" {
            return @{
                PythonMinor = "3.12"
                Torch = "2.8.0.dev20250501+cu128"
                TorchVision = "0.22.0.dev20250502+cu128"
                Xformers = "0.0.31+8fc8ec5a.d20250503"
            }
        }
        "panchovix-20250321" {
            return @{
                PythonMinor = "3.12"
                Torch = "2.8.0.dev20250320+cu128"
                TorchVision = "0.22.0.dev20250321+cu128"
                Xformers = "0.0.30+9a2cd3ef.d20250321"
            }
        }
        default {
            return @{
                PythonMinor = "3.12"
                Torch = ""
                TorchVision = ""
                Xformers = ""
            }
        }
    }
}

function Get-BlackwellRuntimeProbe {
    param (
        [string]$PythonExe
    )

    $script = @"
import json
import sys
import importlib.metadata as md

result = {
    "python_version": sys.version.split()[0],
    "python_minor": f"{sys.version_info.major}.{sys.version_info.minor}",
    "torch_version": "",
    "torchvision_version": "",
    "xformers_version": "",
    "cuda_available": False,
    "torch_cuda_runtime": "",
    "xformers_import_ok": False,
    "xformers_ops_ok": False,
    "xformers_error": "",
}

try:
    import torch
except Exception as exc:
    result["xformers_error"] = f"torch import failed: {exc}"
    print(json.dumps(result))
    raise SystemExit(0)

result["torch_version"] = getattr(torch, "__version__", "")
result["torch_cuda_runtime"] = getattr(torch.version, "cuda", "")
result["cuda_available"] = bool(torch.cuda.is_available())

try:
    result["torchvision_version"] = md.version("torchvision")
except Exception:
    result["torchvision_version"] = ""

try:
    result["xformers_version"] = md.version("xformers")
except Exception:
    result["xformers_version"] = ""

try:
    import xformers
    result["xformers_import_ok"] = True
    _ = xformers.__version__
    from xformers.ops import memory_efficient_attention  # noqa: F401
    result["xformers_ops_ok"] = True
except Exception as exc:
    result["xformers_error"] = str(exc)

print(json.dumps(result))
"@

    $raw = & $PythonExe -c $script 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
        return $null
    }

    try {
        return $raw | ConvertFrom-Json
    }
    catch {
        return $null
    }
}

function Assert-BlackwellRuntimeReady {
    param (
        [string]$PythonExe,
        [hashtable]$Expected,
        [bool]$RequireXformers = $true
    )

    $probe = Get-BlackwellRuntimeProbe -PythonExe $PythonExe
    if (-not $probe) {
        throw "Could not probe $blackwellRuntimeDirName runtime details after installation."
    }

    $issues = New-Object System.Collections.Generic.List[string]
    if ($Expected.PythonMinor -and $probe.python_minor -ne $Expected.PythonMinor) {
        $issues.Add("Python minor is $($probe.python_minor), expected $($Expected.PythonMinor)") | Out-Null
    }
    if ($Expected.Torch -and $probe.torch_version -ne $Expected.Torch) {
        $issues.Add("Torch is $($probe.torch_version), expected $($Expected.Torch)") | Out-Null
    }
    if ($Expected.TorchVision -and $probe.torchvision_version -ne $Expected.TorchVision) {
        $issues.Add("TorchVision is $($probe.torchvision_version), expected $($Expected.TorchVision)") | Out-Null
    }
    if ($RequireXformers -and $Expected.Xformers -and $probe.xformers_version -ne $Expected.Xformers) {
        $issues.Add("xformers is $($probe.xformers_version), expected $($Expected.Xformers)") | Out-Null
    }
    if ($RequireXformers -and (-not $probe.xformers_import_ok -or -not $probe.xformers_ops_ok)) {
        $errorMessage = $probe.xformers_error
        if ([string]::IsNullOrWhiteSpace($errorMessage)) {
            $errorMessage = "xformers import or ops binding check failed"
        }
        $issues.Add($errorMessage) | Out-Null
    }

    if ($issues.Count -gt 0) {
        throw "Blackwell runtime verification failed: $($issues -join '; ')"
    }

    Write-Host -ForegroundColor Green "Blackwell runtime versions: Python $($probe.python_version); Torch $($probe.torch_version); TorchVision $($probe.torchvision_version); xformers $($probe.xformers_version)"
    Write-Host -ForegroundColor Green "CUDA available: $($probe.cuda_available); runtime: $($probe.torch_cuda_runtime)"
}

function Resolve-XformersWheel {
    param (
        [string]$RequestedWheel,
        [string]$Profile
    )

    if ($RequestedWheel) {
        if (Test-Path $RequestedWheel) {
            return (Resolve-Path $RequestedWheel).Path
        }

        if (-not ($RequestedWheel -match '^https?://')) {
            throw "Specified XformersWheel path was not found: $RequestedWheel"
        }

        $downloadDir = Join-Path $repoRoot "blackwell-wheels"
        if (-not (Test-Path $downloadDir)) {
            New-Item -ItemType Directory -Path $downloadDir | Out-Null
        }

        $fileName = [System.IO.Path]::GetFileName(([System.Uri]$RequestedWheel).AbsolutePath)
        if ([string]::IsNullOrWhiteSpace($fileName)) {
            throw "Could not infer wheel filename from URL: $RequestedWheel"
        }

        $fileName = [System.Uri]::UnescapeDataString($fileName)
        $downloadPath = Join-Path $downloadDir $fileName
        Write-Host -ForegroundColor Yellow "Downloading Blackwell xformers wheel..."
        Invoke-WebRequest -Uri $RequestedWheel -OutFile $downloadPath
        return $downloadPath
    }

    $czmahiDefaultWheelUrl = "https://huggingface.co/czmahi/xformers-windows-torch2.8-cu128-py312/resolve/main/latest-torch2.8-python3.12-xformers-comfyui-windows/xformers-0.0.31%2B8fc8ec5a.d20250503-cp312-cp312-win_amd64.whl"
    $czmahiDefaultWheelName = "xformers-0.0.31+8fc8ec5a.d20250503-cp312-cp312-win_amd64.whl"

    $searchRoots = @(
        $repoRoot,
        (Join-Path $repoRoot "blackwell-wheels"),
        (Join-Path $repoRoot "wheels")
    )

    if ($Profile -eq "czmahi-20250502") {
        foreach ($root in $searchRoots) {
            if (-not (Test-Path $root)) {
                continue
            }

            $preferredWheel = Join-Path $root $czmahiDefaultWheelName
            if (Test-Path $preferredWheel) {
                return (Resolve-Path $preferredWheel).Path
            }
        }

        return Resolve-XformersWheel -RequestedWheel $czmahiDefaultWheelUrl -Profile ""
    }

    return $null
}

if (-not (Test-Path $blackwellPython)) {
    throw @"
Blackwell portable Python was not found.

Expected:
- $blackwellPython

Recommended fix:
1. Extract a Python 3.12 embeddable package into:
   - $blackwellRuntimeDir
2. Run install_blackwell.ps1 again
"@
}

if (-not (Test-PipReady -PythonExe $blackwellPython)) {
    Write-Host -ForegroundColor Yellow "$blackwellRuntimeDirName is not initialized yet. Running setup_embeddable_python.bat..."
    & (Join-Path $repoRoot "setup_embeddable_python.bat") --auto $blackwellRuntimeDirName
    if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $blackwellPython)) {
        throw "Failed to initialize $blackwellRuntimeDirName."
    }
}

Set-Location $repoRoot
$blackwellExpectedPackages = Get-BlackwellExpectedPackageVersions -Profile $TorchChannel

$torchInstallArgs = @()
$optionalTorchaudioArgs = $null
if ($TorchChannel -eq "panchovix-20250321") {
    $torchInstallArgs = @(
        "-m", "pip", "install", "--upgrade", "--force-reinstall", "--no-warn-script-location",
        "torch==2.8.0.dev20250320+cu128",
        "torchvision==0.22.0.dev20250321+cu128",
        "--index-url", "https://download.pytorch.org/whl/nightly/cu128"
    )
}
elseif ($TorchChannel -eq "czmahi-20250502") {
    $torchInstallArgs = @(
        "-m", "pip", "install", "--upgrade", "--force-reinstall", "--no-warn-script-location",
        "https://download.pytorch.org/whl/nightly/cu128/torch-2.8.0.dev20250501%2Bcu128-cp312-cp312-win_amd64.whl",
        "https://download.pytorch.org/whl/nightly/cu128/torchvision-0.22.0.dev20250502%2Bcu128-cp312-cp312-win_amd64.whl"
    )
    $optionalTorchaudioArgs = @(
        "-m", "pip", "install", "--upgrade", "--force-reinstall", "--no-warn-script-location", "--no-deps",
        "https://download.pytorch.org/whl/nightly/cu128/torchaudio-2.6.0.dev20250502%2Bcu128-cp312-cp312-win_amd64.whl"
    )
}
elseif ($TorchChannel -eq "nightly") {
    $torchInstallArgs = @(
        "-m", "pip", "install", "--upgrade", "--no-warn-script-location", "--pre",
        "torch", "torchvision",
        "--index-url", "https://download.pytorch.org/whl/nightly/cu128"
    )
}
else {
    $torchInstallArgs = @(
        "-m", "pip", "install", "--upgrade", "--no-warn-script-location", "--prefer-binary",
        "torch==2.10.0+cu128", "torchvision==0.25.0+cu128",
        "--extra-index-url", "https://download.pytorch.org/whl/cu128"
    )
}

Invoke-Step "Upgrading pip tooling for Blackwell environment..." {
    & $blackwellPython -m pip install --upgrade --no-warn-script-location pip "setuptools<81" wheel
}

Invoke-Step "Installing PyTorch and torchvision for Blackwell environment ($TorchChannel)..." {
    & $blackwellPython @torchInstallArgs
}

if ($optionalTorchaudioArgs) {
    Invoke-OptionalStep "Installing optional torchaudio for Blackwell environment..." {
        & $blackwellPython @optionalTorchaudioArgs
    } "Optional torchaudio installation failed. This does not block SD training/inference in this project."
}

Invoke-Step "Installing project dependencies into $blackwellRuntimeDirName..." {
    & $blackwellPython -m pip install --upgrade --no-warn-script-location --prefer-binary -r requirements.txt
}

if (-not (Test-ModulesReady -PythonExe $blackwellPython -Modules $mainRequiredModules)) {
    throw "Project dependencies did not finish installing correctly in $blackwellRuntimeDirName. One or more required runtime modules are still missing."
}

if (-not $SkipXformers) {
    $resolvedWheel = Resolve-XformersWheel -RequestedWheel $XformersWheel -Profile $TorchChannel
    Invoke-OptionalStep "Removing any existing xformers package..." {
        & $blackwellPython -m pip uninstall -y xformers
    } "Existing xformers cleanup reported a warning. Continuing with fresh install."
    if ($resolvedWheel) {
        Write-Host -ForegroundColor Yellow "Using Blackwell xformers wheel: $resolvedWheel"
        Invoke-Step "Installing Blackwell xformers wheel from local file..." {
            & $blackwellPython -m pip install --upgrade --no-warn-script-location --no-deps $resolvedWheel
        }
    }
    elseif ($AllowOfficialXformersFallback) {
        Invoke-OptionalStep "Installing official xformers wheel as fallback..." {
            & $blackwellPython -m pip install --upgrade --no-warn-script-location --only-binary xformers --index-url https://download.pytorch.org/whl/cu128 "xformers>=0.0.34"
        } "Official xformers installation failed. Blackwell users can still use SDPA or install a community cp312 wheel later."
    }
    else {
        throw @"
No Blackwell-specific xformers wheel was provided.

To continue safely, either:
1. Provide a wheel explicitly: -XformersWheel <path-or-url>
2. Use -AllowOfficialXformersFallback (not recommended for Blackwell)
3. Use -SkipXformers intentionally if you want SDPA only
"@
    }

    Invoke-Step "Verifying xformers import/runtime bindings..." {
        & $blackwellPython -c "import xformers, torch; from xformers.ops import memory_efficient_attention; print('xformers:', xformers.__version__)"
    }
}

Invoke-Step "Verifying Blackwell environment..." {
    Assert-BlackwellRuntimeReady -PythonExe $blackwellPython -Expected $blackwellExpectedPackages -RequireXformers:(-not $SkipXformers)
}

Set-Content -Path $blackwellMarker -Value "" -Encoding ASCII
Write-Host -ForegroundColor Green "Blackwell experimental environment is ready"
