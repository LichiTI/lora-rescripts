$Env:HF_HOME = "huggingface"
$Env:PYTHONUTF8 = "1"
$Env:PIP_DISABLE_PIP_VERSION_CHECK = "1"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$blackwellPython = Join-Path $repoRoot "python_blackwell\python.exe"
$blackwellDepsMarker = Join-Path $repoRoot "python_blackwell\.deps_installed"
$sageAttentionRuntimeDirName = if (Test-Path (Join-Path $repoRoot "python-sageattention")) { "python-sageattention" } else { "python_sageattention" }
$sageAttentionRuntimeDir = Join-Path $repoRoot $sageAttentionRuntimeDirName
$sageAttentionPython = Join-Path $sageAttentionRuntimeDir "python.exe"
$sageAttentionDepsMarker = Join-Path $sageAttentionRuntimeDir ".deps_installed"
$sageAttention2RuntimeDirName = if (Test-Path (Join-Path $repoRoot "python-sageattention-latest")) { "python-sageattention-latest" } else { "python_sageattention_latest" }
$sageAttention2RuntimeDir = Join-Path $repoRoot $sageAttention2RuntimeDirName
$sageAttention2Python = Join-Path $sageAttention2RuntimeDir "python.exe"
$sageAttention2DepsMarker = Join-Path $sageAttention2RuntimeDir ".deps_installed"
$sageAttentionBlackwellRuntimeDirName = if (Test-Path (Join-Path $repoRoot "python-sageattention-blackwell")) { "python-sageattention-blackwell" } else { "python_sageattention_blackwell" }
$sageAttentionBlackwellRuntimeDir = Join-Path $repoRoot $sageAttentionBlackwellRuntimeDirName
$sageAttentionBlackwellPython = Join-Path $sageAttentionBlackwellRuntimeDir "python.exe"
$sageAttentionBlackwellDepsMarker = Join-Path $sageAttentionBlackwellRuntimeDir ".deps_installed"
$portablePython = Join-Path $repoRoot "python\python.exe"
$venvPython = Join-Path $repoRoot "venv\Scripts\python.exe"
$portableDepsMarker = Join-Path $repoRoot "python\.deps_installed"
$venvDepsMarker = Join-Path $repoRoot "venv\.deps_installed"
$portableTagEditorPython = Join-Path $repoRoot "python_tageditor\python.exe"
$venvTagEditorPython = Join-Path $repoRoot "venv-tageditor\Scripts\python.exe"
$allowExternalPython = $Env:MIKAZUKI_ALLOW_SYSTEM_PYTHON -eq "1"
$preferBlackwellRuntime = $Env:MIKAZUKI_PREFERRED_RUNTIME -eq "blackwell"
$preferSageAttentionRuntime = $Env:MIKAZUKI_PREFERRED_RUNTIME -eq "sageattention"
$preferSageAttention2Runtime = $Env:MIKAZUKI_PREFERRED_RUNTIME -eq "sageattention2"
$preferSageAttentionBlackwellRuntime = $Env:MIKAZUKI_PREFERRED_RUNTIME -eq "sageattention-blackwell"
$mainRuntimeModules = @("accelerate", "torch", "fastapi", "toml", "transformers", "diffusers", "lion_pytorch", "dadaptation", "schedulefree", "prodigyopt", "prodigyplus", "pytorch_optimizer")
$blackwellPreferredProfile = "czmahi-20250502"
$sageAttentionPreferredProfile = "triton-v1"
$sageAttention2PreferredProfile = "triton-v2"
$sageAttentionBlackwellPreferredProfile = "triton-v1"

if ((@($preferBlackwellRuntime, $preferSageAttentionRuntime, $preferSageAttention2Runtime, $preferSageAttentionBlackwellRuntime) | Where-Object { $_ }).Count -gt 1) {
    throw "Only one dedicated runtime can be preferred at a time. Clear MIKAZUKI_PREFERRED_RUNTIME or choose blackwell / sageattention / sageattention2 / sageattention-blackwell."
}

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

function Test-PackageConstraints {
    param (
        [string]$PythonExe,
        [hashtable]$Constraints
    )

    if (-not $Constraints -or $Constraints.Count -eq 0) {
        return $true
    }

    $pairs = @()
    foreach ($entry in $Constraints.GetEnumerator()) {
        $pairs += "$($entry.Key)$([char]31)$($entry.Value)"
    }

    $script = @"
import sys
import importlib.metadata as md
from pip._vendor.packaging.specifiers import SpecifierSet
from pip._vendor.packaging.version import Version

ok = True
for item in sys.argv[1:]:
    name, spec = item.split(chr(31), 1)
    try:
        version = md.version(name)
    except md.PackageNotFoundError:
        ok = False
        continue
    if spec and Version(version) not in SpecifierSet(spec):
        ok = False

raise SystemExit(0 if ok else 1)
"@

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & $PythonExe -c $script @pairs 1>$null 2>$null
        return $LASTEXITCODE -eq 0
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

function Get-PythonMinorVersion {
    param (
        [string]$PythonExe
    )

    $version = & $PythonExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $null
    }
    return $version.Trim()
}

function Set-DedicatedRuntimeCaches {
    param (
        [string]$RuntimeName,
        [string]$PythonExe
    )

    if ($RuntimeName -notin @("blackwell", "sageattention", "sageattention2", "sageattention-blackwell")) {
        return
    }

    $runtimeRoot = Split-Path -Parent $PythonExe
    if ([string]::IsNullOrWhiteSpace($runtimeRoot) -or -not (Test-Path $runtimeRoot)) {
        return
    }

    $cacheRoot = Join-Path $runtimeRoot ".cache"
    $tritonCacheDir = if ($Env:TRITON_CACHE_DIR) { $Env:TRITON_CACHE_DIR } else { Join-Path $cacheRoot "triton" }
    $torchInductorCacheDir = if ($Env:TORCHINDUCTOR_CACHE_DIR) { $Env:TORCHINDUCTOR_CACHE_DIR } else { Join-Path $cacheRoot "torchinductor" }

    foreach ($path in @($cacheRoot, $tritonCacheDir, $torchInductorCacheDir)) {
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }

    if (-not $Env:TRITON_CACHE_DIR) {
        $Env:TRITON_CACHE_DIR = $tritonCacheDir
    }
    if (-not $Env:TORCHINDUCTOR_CACHE_DIR) {
        $Env:TORCHINDUCTOR_CACHE_DIR = $torchInductorCacheDir
    }

    if (-not $Env:TRITON_HOME) {
        $Env:TRITON_HOME = $cacheRoot
    }

    Write-Host -ForegroundColor DarkGray "Persistent compile cache enabled for $RuntimeName runtime:"
    Write-Host -ForegroundColor DarkGray "- TRITON_CACHE_DIR=$tritonCacheDir"
    Write-Host -ForegroundColor DarkGray "- TORCHINDUCTOR_CACHE_DIR=$torchInductorCacheDir"
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

function Get-SageAttentionExpectedPackageVersions {
    param (
        [string]$Profile
    )

    switch ($Profile) {
        "triton-v1" {
            return @{
                PythonMinor = ""
                Torch = "2.10.0+cu128"
                TorchVision = "0.25.0+cu128"
                SageAttention = ""
                Triton = ""
            }
        }
        "triton-v2" {
            return @{
                PythonMinor = "3.12"
                Torch = "2.10.0+cu128"
                TorchVision = "0.25.0+cu128"
                SageAttention = "2.2.0"
                Triton = "3.5.1.post24"
            }
        }
        default {
            return @{
                PythonMinor = ""
                Torch = ""
                TorchVision = ""
                SageAttention = ""
                Triton = ""
            }
        }
    }
}

function ConvertFrom-PythonJsonTail {
    param (
        [object]$Raw
    )

    if ($null -eq $Raw) {
        return $null
    }

    $text = if ($Raw -is [System.Array]) {
        ($Raw | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
    }
    else {
        [string]$Raw
    }

    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
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

        return ConvertFrom-PythonJsonTail -Raw $raw
    }
    finally {
        Remove-Item -LiteralPath $tempPyPath -Force -ErrorAction SilentlyContinue
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

    return Invoke-PythonJsonProbe -PythonExe $PythonExe -ScriptContent $script
}

function Get-SageAttentionRuntimeProbe {
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
    "sageattention_version": "",
    "triton_version": "",
    "cuda_available": False,
    "triton_import_ok": False,
    "sageattention_import_ok": False,
    "sageattention_symbols_ok": False,
    "sageattention_error": "",
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
    result["sageattention_error"] = f"torch import failed: {exc}"
    print(json.dumps(result))
    raise SystemExit(0)

result["torch_version"] = getattr(torch, "__version__", "")
result["cuda_available"] = bool(torch.cuda.is_available())
result["torchvision_version"] = metadata_version("torchvision")
result["sageattention_version"] = metadata_version("sageattention")
result["triton_version"] = metadata_version("triton-windows", "triton")

try:
    import triton  # noqa: F401
    result["triton_import_ok"] = True
except Exception as exc:
    result["sageattention_error"] = f"triton import failed: {exc}"
    print(json.dumps(result))
    raise SystemExit(0)

try:
    from sageattention import sageattn, sageattn_varlen
    result["sageattention_import_ok"] = True
    result["sageattention_symbols_ok"] = callable(sageattn) and callable(sageattn_varlen)
    if not result["sageattention_symbols_ok"]:
        result["sageattention_error"] = "sageattention import succeeded but required symbols are missing"
except Exception as exc:
    result["sageattention_error"] = str(exc)

print(json.dumps(result))
"@

    return Invoke-PythonJsonProbe -PythonExe $PythonExe -ScriptContent $script
}

function Test-BlackwellRuntimeReady {
    param (
        [string]$PythonExe,
        [hashtable]$Expected,
        [ref]$Message
    )

    $probe = Get-BlackwellRuntimeProbe -PythonExe $PythonExe
    if (-not $probe) {
        $Message.Value = "could not probe python_blackwell runtime details"
        return $false
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
    if ($Expected.Xformers -and $probe.xformers_version -ne $Expected.Xformers) {
        $issues.Add("xformers is $($probe.xformers_version), expected $($Expected.Xformers)") | Out-Null
    }
    if (-not $probe.xformers_import_ok -or -not $probe.xformers_ops_ok) {
        $errorMessage = $probe.xformers_error
        if ([string]::IsNullOrWhiteSpace($errorMessage)) {
            $errorMessage = "xformers import or ops binding check failed"
        }
        $issues.Add($errorMessage) | Out-Null
    }

    if ($issues.Count -gt 0) {
        $Message.Value = ($issues -join "; ")
        return $false
    }

    $Message.Value = "Python $($probe.python_version); Torch $($probe.torch_version); TorchVision $($probe.torchvision_version); xformers $($probe.xformers_version)"
    return $true
}

function Test-SageAttentionRuntimeReady {
    param (
        [string]$PythonExe,
        [hashtable]$Expected,
        [string]$RuntimeDirName = $sageAttentionRuntimeDirName,
        [ref]$Message
    )

    $probe = Get-SageAttentionRuntimeProbe -PythonExe $PythonExe
    if (-not $probe) {
        $Message.Value = "could not probe $RuntimeDirName runtime details"
        return $false
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
    if ($Expected.SageAttention -and $probe.sageattention_version -ne $Expected.SageAttention) {
        $issues.Add("sageattention is $($probe.sageattention_version), expected $($Expected.SageAttention)") | Out-Null
    }
    if ($Expected.Triton -and $probe.triton_version -ne $Expected.Triton) {
        $issues.Add("triton is $($probe.triton_version), expected $($Expected.Triton)") | Out-Null
    }
    if (-not $probe.cuda_available) {
        $issues.Add("CUDA is not available") | Out-Null
    }
    if (-not $probe.triton_import_ok) {
        $issues.Add("triton import failed") | Out-Null
    }
    if (-not $probe.sageattention_import_ok -or -not $probe.sageattention_symbols_ok) {
        $errorMessage = $probe.sageattention_error
        if ([string]::IsNullOrWhiteSpace($errorMessage)) {
            $errorMessage = "sageattention import or symbol check failed"
        }
        elseif ($errorMessage -match "_fused|DLL load failed") {
            $errorMessage = "sageattention native extension failed to load (_fused). This usually means the installed SageAttention wheel does not match the current Torch/CUDA runtime stack, or the Microsoft Visual C++ x64 runtime is missing. On Windows this is commonly a binary compatibility issue, especially for SageAttention 2.x wheels."
        }
        $issues.Add($errorMessage) | Out-Null
    }

    if ($issues.Count -gt 0) {
        $Message.Value = ($issues -join "; ")
        return $false
    }

    $Message.Value = "Python $($probe.python_version); Torch $($probe.torch_version); TorchVision $($probe.torchvision_version); Triton $($probe.triton_version); SageAttention $($probe.sageattention_version)"
    return $true
}

function Get-MainPythonSelection {
    if ($preferBlackwellRuntime -and -not (Test-Path $blackwellPython)) {
        throw @"
Blackwell startup was requested, but python_blackwell is missing.

Expected:
- $blackwellPython

Recommended fix:
1. Extract a Python 3.12 embeddable package into .\python_blackwell
2. Run run_For_Only_Blackwell.bat again
"@
    }

    if ($preferSageAttentionRuntime -and -not (Test-Path $sageAttentionPython)) {
        throw @"
SageAttention startup was requested, but the dedicated runtime is missing.

Expected:
- $sageAttentionPython

Recommended fix:
1. Extract a Python 3.11 embeddable package into .\$sageAttentionRuntimeDirName
2. Run run_For_SageAttention_Experimental.bat again
"@
    }

    if ($preferSageAttention2Runtime -and -not (Test-Path $sageAttention2Python)) {
        throw @"
SageAttention2 startup was requested, but the dedicated runtime is missing.

Expected:
- $sageAttention2Python

Recommended fix:
1. Extract a Python 3.12 embeddable package into .\$sageAttention2RuntimeDirName
2. Run run_For_SageAttention2_Experimental.bat again
"@
    }

    if ($preferSageAttentionBlackwellRuntime -and -not (Test-Path $sageAttentionBlackwellPython)) {
        throw @"
Blackwell SageAttention startup was requested, but the dedicated runtime is missing.

Expected:
- $sageAttentionBlackwellPython

Recommended fix:
1. Extract a Python 3.11 embeddable package into .\$sageAttentionBlackwellRuntimeDirName
2. Run run_For_Only_Blackwell_SageAttention_Experimental.bat again
"@
    }

    if ($preferBlackwellRuntime -and (Test-Path $blackwellPython)) {
        Write-Host -ForegroundColor Green "Using Blackwell experimental Python..."
        if (-not (Test-PipReady -PythonExe $blackwellPython)) {
            Write-Host -ForegroundColor Yellow "python_blackwell is not initialized yet. Running setup_embeddable_python.bat..."
            & (Join-Path $repoRoot "setup_embeddable_python.bat") --auto python_blackwell
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $blackwellPython)) {
                throw "Blackwell experimental Python is incomplete: pip is not available."
            }
        }
        return @{
            PythonExe = $blackwellPython
            DepsMarker = $blackwellDepsMarker
            Runtime = "blackwell"
        }
    }

    if ($preferSageAttentionRuntime -and (Test-Path $sageAttentionPython)) {
        Write-Host -ForegroundColor Green "Using SageAttention experimental Python..."
        if (-not (Test-PipReady -PythonExe $sageAttentionPython)) {
            Write-Host -ForegroundColor Yellow "$sageAttentionRuntimeDirName is not initialized yet. Running setup_embeddable_python.bat..."
            & (Join-Path $repoRoot "setup_embeddable_python.bat") --auto $sageAttentionRuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $sageAttentionPython)) {
                throw "SageAttention experimental Python is incomplete: pip is not available."
            }
        }
        return @{
            PythonExe = $sageAttentionPython
            DepsMarker = $sageAttentionDepsMarker
            Runtime = "sageattention"
        }
    }

    if ($preferSageAttention2Runtime -and (Test-Path $sageAttention2Python)) {
        Write-Host -ForegroundColor Green "Using SageAttention2 experimental Python..."
        if (-not (Test-PipReady -PythonExe $sageAttention2Python)) {
            Write-Host -ForegroundColor Yellow "$sageAttention2RuntimeDirName is not initialized yet. Running setup_embeddable_python.bat..."
            & (Join-Path $repoRoot "setup_embeddable_python.bat") --auto $sageAttention2RuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $sageAttention2Python)) {
                throw "SageAttention2 experimental Python is incomplete: pip is not available."
            }
        }
        return @{
            PythonExe = $sageAttention2Python
            DepsMarker = $sageAttention2DepsMarker
            Runtime = "sageattention2"
        }
    }

    if ($preferSageAttentionBlackwellRuntime -and (Test-Path $sageAttentionBlackwellPython)) {
        Write-Host -ForegroundColor Green "Using Blackwell SageAttention experimental Python..."
        if (-not (Test-PipReady -PythonExe $sageAttentionBlackwellPython)) {
            Write-Host -ForegroundColor Yellow "$sageAttentionBlackwellRuntimeDirName is not initialized yet. Running setup_embeddable_python.bat..."
            & (Join-Path $repoRoot "setup_embeddable_python.bat") --auto $sageAttentionBlackwellRuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $sageAttentionBlackwellPython)) {
                throw "Blackwell SageAttention experimental Python is incomplete: pip is not available."
            }
        }
        return @{
            PythonExe = $sageAttentionBlackwellPython
            DepsMarker = $sageAttentionBlackwellDepsMarker
            Runtime = "sageattention-blackwell"
        }
    }

    if (Test-Path $portablePython) {
        Write-Host -ForegroundColor Green "Using portable Python..."
        if (-not (Test-PipReady -PythonExe $portablePython)) {
            throw "Portable Python is incomplete: pip is not available. Repair or replace the bundled python folder first."
        }
        return @{
            PythonExe = $portablePython
            DepsMarker = $portableDepsMarker
            Runtime = "portable"
        }
    }

    if (Test-Path $venvPython) {
        Write-Host -ForegroundColor Green "Using project virtual environment..."
        if (-not (Test-PipReady -PythonExe $venvPython)) {
            throw "Project virtual environment is incomplete: pip is not available. Repair or recreate .\venv first."
        }
        return @{
            PythonExe = $venvPython
            DepsMarker = $venvDepsMarker
            Runtime = "venv"
        }
    }

    if ($allowExternalPython) {
        Write-Host -ForegroundColor Yellow "No project-local Python found. MIKAZUKI_ALLOW_SYSTEM_PYTHON=1 is set, bootstrapping a project-local venv via install.ps1..."
        & (Join-Path $repoRoot "install.ps1")
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to bootstrap a project-local Python environment."
        }

        if (Test-Path $portablePython) {
            return @{
                PythonExe = $portablePython
                DepsMarker = $portableDepsMarker
                Runtime = "portable"
            }
        }

        if (Test-Path $venvPython) {
            return @{
                PythonExe = $venvPython
                DepsMarker = $venvDepsMarker
                Runtime = "venv"
            }
        }

        throw "install.ps1 finished, but no project-local Python environment was created."
    }

    throw @"
No project-local Python environment was found.

This build is locked to project-local Python by default to avoid leaking installs into the host machine.

Expected one of:
- $portablePython
- $venvPython

Recommended fix:
1. Bundle a ready-to-run portable Python in .\python
2. Or create a project-local venv in .\venv for development

Developer override:
- Set MIKAZUKI_ALLOW_SYSTEM_PYTHON=1 and rerun to bootstrap a project-local venv intentionally.
"@
}

$blackwellExpectedPackages = Get-BlackwellExpectedPackageVersions -Profile $blackwellPreferredProfile
$sageAttentionExpectedPackages = Get-SageAttentionExpectedPackageVersions -Profile $sageAttentionPreferredProfile
$sageAttention2ExpectedPackages = Get-SageAttentionExpectedPackageVersions -Profile $sageAttention2PreferredProfile
$sageAttentionBlackwellExpectedPackages = Get-SageAttentionExpectedPackageVersions -Profile $sageAttentionBlackwellPreferredProfile
$mainPython = Get-MainPythonSelection
$pythonExe = $mainPython.PythonExe
$depsMarker = $mainPython.DepsMarker
$runtimeName = $mainPython.Runtime
Set-DedicatedRuntimeCaches -RuntimeName $runtimeName -PythonExe $pythonExe
$mainModulesReady = Test-ModulesReady -PythonExe $pythonExe -Modules $mainRuntimeModules
$blackwellXformersReady = $true
$blackwellRuntimeMessage = ""
$sageAttentionRuntimeReady = $true
$sageAttentionRuntimeMessage = ""
if ($runtimeName -eq "blackwell") {
    $blackwellXformersReady = Test-BlackwellRuntimeReady -PythonExe $pythonExe -Expected $blackwellExpectedPackages -Message ([ref]$blackwellRuntimeMessage)
    if (-not $blackwellXformersReady -and $blackwellRuntimeMessage) {
        Write-Host -ForegroundColor Yellow "Blackwell runtime is not ready yet: $blackwellRuntimeMessage"
    }
}
elseif ($runtimeName -eq "sageattention") {
    $sageAttentionRuntimeReady = Test-SageAttentionRuntimeReady -PythonExe $pythonExe -Expected $sageAttentionExpectedPackages -RuntimeDirName $sageAttentionRuntimeDirName -Message ([ref]$sageAttentionRuntimeMessage)
    if (-not $sageAttentionRuntimeReady -and $sageAttentionRuntimeMessage) {
        Write-Host -ForegroundColor Yellow "SageAttention runtime is not ready yet: $sageAttentionRuntimeMessage"
    }
}
elseif ($runtimeName -eq "sageattention2") {
    $sageAttentionRuntimeReady = Test-SageAttentionRuntimeReady -PythonExe $pythonExe -Expected $sageAttention2ExpectedPackages -RuntimeDirName $sageAttention2RuntimeDirName -Message ([ref]$sageAttentionRuntimeMessage)
    if (-not $sageAttentionRuntimeReady -and $sageAttentionRuntimeMessage) {
        Write-Host -ForegroundColor Yellow "SageAttention2 runtime is not ready yet: $sageAttentionRuntimeMessage"
    }
}
elseif ($runtimeName -eq "sageattention-blackwell") {
    $sageAttentionRuntimeReady = Test-SageAttentionRuntimeReady -PythonExe $pythonExe -Expected $sageAttentionBlackwellExpectedPackages -RuntimeDirName $sageAttentionBlackwellRuntimeDirName -Message ([ref]$sageAttentionRuntimeMessage)
    if (-not $sageAttentionRuntimeReady -and $sageAttentionRuntimeMessage) {
        Write-Host -ForegroundColor Yellow "Blackwell SageAttention runtime is not ready yet: $sageAttentionRuntimeMessage"
    }
}
if (-not (Test-Path $depsMarker) -or -not $mainModulesReady -or -not $blackwellXformersReady -or -not $sageAttentionRuntimeReady) {
    if ($runtimeName -eq "blackwell") {
        Write-Host -ForegroundColor Yellow "Blackwell experimental dependencies are not installed yet. Running install_blackwell.ps1..."
        & (Join-Path $repoRoot "install_blackwell.ps1") -TorchChannel $blackwellPreferredProfile
    }
    elseif ($runtimeName -eq "sageattention") {
        Write-Host -ForegroundColor Yellow "SageAttention experimental dependencies are not installed yet. Running install_sageattention.ps1..."
        & (Join-Path $repoRoot "install_sageattention.ps1") -Profile $sageAttentionPreferredProfile -RuntimeTarget general
    }
    elseif ($runtimeName -eq "sageattention2") {
        Write-Host -ForegroundColor Yellow "SageAttention2 experimental dependencies are not installed yet. Running install_sageattention2.ps1..."
        & (Join-Path $repoRoot "install_sageattention2.ps1")
    }
    elseif ($runtimeName -eq "sageattention-blackwell") {
        Write-Host -ForegroundColor Yellow "Blackwell SageAttention experimental dependencies are not installed yet. Running install_sageattention.ps1..."
        & (Join-Path $repoRoot "install_sageattention.ps1") -Profile $sageAttentionBlackwellPreferredProfile -RuntimeTarget blackwell
    }
    else {
        Write-Host -ForegroundColor Yellow "Dependencies are not installed yet. Running install.ps1..."
        & (Join-Path $repoRoot "install.ps1")
    }
    $mainPython = Get-MainPythonSelection
    $pythonExe = $mainPython.PythonExe
    $depsMarker = $mainPython.DepsMarker
    $runtimeName = $mainPython.Runtime
    Set-DedicatedRuntimeCaches -RuntimeName $runtimeName -PythonExe $pythonExe
    $mainModulesReady = Test-ModulesReady -PythonExe $pythonExe -Modules $mainRuntimeModules
    $blackwellXformersReady = $true
    $blackwellRuntimeMessage = ""
    $sageAttentionRuntimeReady = $true
    $sageAttentionRuntimeMessage = ""
    if ($runtimeName -eq "blackwell") {
        $blackwellXformersReady = Test-BlackwellRuntimeReady -PythonExe $pythonExe -Expected $blackwellExpectedPackages -Message ([ref]$blackwellRuntimeMessage)
    }
    elseif ($runtimeName -eq "sageattention") {
        $sageAttentionRuntimeReady = Test-SageAttentionRuntimeReady -PythonExe $pythonExe -Expected $sageAttentionExpectedPackages -RuntimeDirName $sageAttentionRuntimeDirName -Message ([ref]$sageAttentionRuntimeMessage)
    }
    elseif ($runtimeName -eq "sageattention2") {
        $sageAttentionRuntimeReady = Test-SageAttentionRuntimeReady -PythonExe $pythonExe -Expected $sageAttention2ExpectedPackages -RuntimeDirName $sageAttention2RuntimeDirName -Message ([ref]$sageAttentionRuntimeMessage)
    }
    elseif ($runtimeName -eq "sageattention-blackwell") {
        $sageAttentionRuntimeReady = Test-SageAttentionRuntimeReady -PythonExe $pythonExe -Expected $sageAttentionBlackwellExpectedPackages -RuntimeDirName $sageAttentionBlackwellRuntimeDirName -Message ([ref]$sageAttentionRuntimeMessage)
    }
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $depsMarker) -or -not $mainModulesReady -or -not $blackwellXformersReady -or -not $sageAttentionRuntimeReady) {
        if ($runtimeName -eq "blackwell" -and $blackwellRuntimeMessage) {
            throw "Dependency installation failed. Blackwell runtime is still not ready: $blackwellRuntimeMessage"
        }
        if ($runtimeName -in @("sageattention", "sageattention2", "sageattention-blackwell") -and $sageAttentionRuntimeMessage) {
            throw "Dependency installation failed. SageAttention runtime is still not ready: $sageAttentionRuntimeMessage"
        }
        throw "Dependency installation failed."
    }
}

if ($runtimeName -eq "blackwell" -and $blackwellRuntimeMessage) {
    Write-Host -ForegroundColor Green "Blackwell pinned runtime check passed: $blackwellRuntimeMessage"
}
elseif ($runtimeName -eq "sageattention" -and $sageAttentionRuntimeMessage) {
    Write-Host -ForegroundColor Green "SageAttention runtime check passed: $sageAttentionRuntimeMessage"
}
elseif ($runtimeName -eq "sageattention2" -and $sageAttentionRuntimeMessage) {
    Write-Host -ForegroundColor Green "SageAttention2 runtime check passed: $sageAttentionRuntimeMessage"
}
elseif ($runtimeName -eq "sageattention-blackwell" -and $sageAttentionRuntimeMessage) {
    Write-Host -ForegroundColor Green "Blackwell SageAttention runtime check passed: $sageAttentionRuntimeMessage"
}

if ($Env:MIKAZUKI_BLACKWELL_STARTUP -eq "1") {
    $blackwellPatchScript = Join-Path $repoRoot "mikazuki\scripts\patch_xformers_blackwell.py"
    if (Test-Path $blackwellPatchScript) {
        Write-Host -ForegroundColor Yellow "Blackwell startup mode enabled. Checking xformers FA3 compatibility..."
        & $pythonExe $blackwellPatchScript
        if ($LASTEXITCODE -ne 0) {
            Write-Host -ForegroundColor Yellow "Blackwell xformers patch step reported a warning. Continuing startup..."
        }
    }
}

if ($Env:MIKAZUKI_SAGEATTENTION_STARTUP -eq "1") {
    if ($Env:MIKAZUKI_SAGEATTENTION2_STARTUP -eq "1" -or $runtimeName -eq "sageattention2") {
        Write-Host -ForegroundColor Yellow "SageAttention2 startup mode enabled. This runtime prepares the dedicated SageAttention 2.x environment; enable sageattn manually on supported routes."
    }
    elseif ($runtimeName -eq "sageattention-blackwell") {
        Write-Host -ForegroundColor Yellow "Blackwell SageAttention startup mode enabled. This runtime prepares the dedicated Blackwell SageAttention environment; enable sageattn manually on supported routes."
    }
    else {
        Write-Host -ForegroundColor Yellow "SageAttention startup mode enabled. This runtime prepares SageAttention only; enable sageattn manually on supported routes."
    }
}

if (-not ($args -contains "--disable-tageditor")) {
    $tagEditorPython = $null
    $tagEditorMarker = $null

    if (Test-Path $portableTagEditorPython) {
        $tagEditorPython = $portableTagEditorPython
        $tagEditorMarker = Join-Path $repoRoot "python_tageditor\.tageditor_installed"
    }
    elseif (Test-Path $venvTagEditorPython) {
        $tagEditorPython = $venvTagEditorPython
        $tagEditorMarker = Join-Path $repoRoot "venv-tageditor\.tageditor_installed"
    }
    else {
        $fallbackMainPython = $null
        if ($runtimeName -in @("blackwell", "sageattention", "sageattention2", "sageattention-blackwell")) {
            if (Test-Path $portablePython) {
                $fallbackMainPython = $portablePython
                $tagEditorMarker = Join-Path $repoRoot "python\.tageditor_installed"
            }
            elseif (Test-Path $venvPython) {
                $fallbackMainPython = $venvPython
                $tagEditorMarker = Join-Path $repoRoot "venv\.tageditor_installed"
            }
        }
        else {
            $fallbackMainPython = $pythonExe
            if (Test-Path $portablePython) {
                $tagEditorMarker = Join-Path $repoRoot "python\.tageditor_installed"
            }
            elseif (Test-Path $venvPython) {
                $tagEditorMarker = Join-Path $repoRoot "venv\.tageditor_installed"
            }
        }

        $mainPythonVersion = $null
        if ($fallbackMainPython) {
            $mainPythonVersion = Get-PythonMinorVersion -PythonExe $fallbackMainPython
        }
        if ($mainPythonVersion -and $mainPythonVersion -ne "3.13") {
            $tagEditorPython = $fallbackMainPython
        }
    }

    if ($tagEditorPython) {
        $tagEditorPackageConstraints = @{
            "gradio" = "==4.28.3"
            "gradio-client" = "==0.16.0"
            "fastapi" = "<0.113"
            "starlette" = "<0.39"
            "pydantic" = "<2.11"
            "huggingface-hub" = "<1"
        }
        $tagEditorModulesReady = Test-ModulesReady -PythonExe $tagEditorPython -Modules @("gradio", "transformers", "timm", "print_color")
        $tagEditorVersionsReady = Test-PackageConstraints -PythonExe $tagEditorPython -Constraints $tagEditorPackageConstraints
        $tagEditorMarkerReady = (-not $tagEditorMarker) -or (Test-Path $tagEditorMarker)
        if (-not $tagEditorMarkerReady -or -not $tagEditorModulesReady -or -not $tagEditorVersionsReady) {
            if (-not (Test-PipReady -PythonExe $tagEditorPython)) {
                throw "Tag editor Python is incomplete: pip is not available."
            }

            Write-Host -ForegroundColor Yellow "Tag editor dependencies are missing or incompatible. Running install_tageditor.ps1..."
            & (Join-Path $repoRoot "install_tageditor.ps1")
            $tagEditorModulesReady = Test-ModulesReady -PythonExe $tagEditorPython -Modules @("gradio", "transformers", "timm", "print_color")
            $tagEditorVersionsReady = Test-PackageConstraints -PythonExe $tagEditorPython -Constraints $tagEditorPackageConstraints
            $tagEditorMarkerReady = (-not $tagEditorMarker) -or (Test-Path $tagEditorMarker)
            if ($LASTEXITCODE -ne 0 -or -not $tagEditorMarkerReady -or -not $tagEditorModulesReady -or -not $tagEditorVersionsReady) {
                throw "Tag editor dependency installation failed."
            }
        }
    }
}

$Env:MIKAZUKI_SKIP_REQUIREMENTS_VALIDATION = "1"
Set-Location $repoRoot
& $pythonExe "gui.py" @args
