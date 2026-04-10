param(
    [string]$ExpectedPythonMinor = "3.12",
    [string]$ExpectedTorch = "2.8.0.dev20250501+cu128",
    [string]$ExpectedTorchVision = "0.22.0.dev20250502+cu128",
    [string]$ExpectedXformers = "0.0.31+8fc8ec5a.d20250503",
    [switch]$AllowNoGpu,
    [switch]$AllowNonBlackwellGpu
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonExe = Join-Path $repoRoot "python_blackwell\python.exe"
$depsMarker = Join-Path $repoRoot "python_blackwell\.deps_installed"

$failed = New-Object System.Collections.Generic.List[string]
$passed = New-Object System.Collections.Generic.List[string]

function Invoke-PythonCapture {
    param(
        [string]$PythonExe,
        [string[]]$Arguments
    )

    $process = New-Object System.Diagnostics.Process
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $PythonExe
    $startInfo.Arguments = [string]::Join(" ", ($Arguments | ForEach-Object {
        if ($_ -match '\s|"') {
            '"' + ($_ -replace '"', '\"') + '"'
        }
        else {
            $_
        }
    }))
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process.StartInfo = $startInfo

    try {
        $null = $process.Start()
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()
        return @{
            ExitCode = $process.ExitCode
            StdOut = $stdout
            StdErr = $stderr
        }
    }
    finally {
        $process.Dispose()
    }
}

function Test-PipReady {
    param([string]$PythonExe)
    $result = Invoke-PythonCapture -PythonExe $PythonExe -Arguments @("-m", "pip", "--version")
    return $result.ExitCode -eq 0
}

function Add-Pass {
    param([string]$Message)
    $passed.Add($Message) | Out-Null
    Write-Host -ForegroundColor Green "[PASS] $Message"
}

function Add-Fail {
    param([string]$Message)
    $failed.Add($Message) | Out-Null
    Write-Host -ForegroundColor Red "[FAIL] $Message"
}

function Compare-Exact {
    param(
        [string]$Name,
        [string]$Actual,
        [string]$Expected
    )

    if ($Actual -eq $Expected) {
        Add-Pass "$Name = $Actual"
    }
    else {
        Add-Fail "$Name expected '$Expected' but got '$Actual'"
    }
}

Write-Host "========================================"
Write-Host "SD-rescripts Blackwell Release Check"
Write-Host "========================================"
Write-Host ""

if (-not (Test-Path $pythonExe)) {
    Add-Fail "python_blackwell runtime not found: $pythonExe"
    Write-Host ""
    Write-Host -ForegroundColor Red "Release check failed."
    exit 1
}
Add-Pass "python_blackwell runtime exists"

if (-not (Test-PipReady -PythonExe $pythonExe)) {
    Add-Fail "pip is not available in python_blackwell"
}
else {
    Add-Pass "pip is available in python_blackwell"
}

if (Test-Path $depsMarker) {
    Add-Pass ".deps_installed marker exists"
}
else {
    Add-Fail ".deps_installed marker is missing"
}

$probeScript = @"
import json
import sys
import importlib.metadata as md

result = {
    "python_version": "",
    "python_minor": "",
    "torch_version": "",
    "torch_cuda_runtime": "",
    "torchvision_version": "",
    "xformers_version": "",
    "cuda_available": False,
    "gpu_count": 0,
    "gpus": [],
    "xformers_import_ok": False,
    "xformers_ops_ok": False,
    "xformers_error": "",
}

result["python_version"] = sys.version.split()[0]
result["python_minor"] = f"{sys.version_info.major}.{sys.version_info.minor}"

try:
    import torch
except Exception as exc:
    result["xformers_error"] = f"torch import failed: {exc}"
    print(json.dumps(result))
    raise SystemExit(0)

result["torch_version"] = getattr(torch, "__version__", "")
result["torch_cuda_runtime"] = getattr(torch.version, "cuda", "")
result["cuda_available"] = bool(torch.cuda.is_available())

if result["cuda_available"]:
    result["gpu_count"] = int(torch.cuda.device_count())
    for i in range(result["gpu_count"]):
        cap = torch.cuda.get_device_capability(i)
        result["gpus"].append(
            {
                "index": i,
                "name": torch.cuda.get_device_name(i),
                "capability": [int(cap[0]), int(cap[1])],
            }
        )

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

$probeResult = Invoke-PythonCapture -PythonExe $pythonExe -Arguments @("-c", $probeScript)
$probeJson = $probeResult.StdOut
if ($probeResult.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($probeJson)) {
    Add-Fail "failed to probe runtime details from python_blackwell"
}
else {
    try {
        $probe = $probeJson | ConvertFrom-Json
    }
    catch {
        Add-Fail "runtime probe returned invalid JSON"
        $probe = $null
    }

    if ($probe) {
        Add-Pass "Python runtime: $($probe.python_version)"
        Compare-Exact -Name "Python minor" -Actual $probe.python_minor -Expected $ExpectedPythonMinor
        Compare-Exact -Name "Torch" -Actual $probe.torch_version -Expected $ExpectedTorch
        Compare-Exact -Name "TorchVision" -Actual $probe.torchvision_version -Expected $ExpectedTorchVision
        Compare-Exact -Name "xformers" -Actual $probe.xformers_version -Expected $ExpectedXformers

        if ($probe.cuda_available) {
            Add-Pass "CUDA available (runtime $($probe.torch_cuda_runtime))"
        }
        else {
            Add-Fail "CUDA is not available in python_blackwell"
        }

        if ([int]$probe.gpu_count -gt 0) {
            Add-Pass "Detected $($probe.gpu_count) GPU(s)"
            foreach ($gpu in $probe.gpus) {
                $capability = "$($gpu.capability[0]).$($gpu.capability[1])"
                Write-Host -ForegroundColor Cyan "       GPU $($gpu.index): $($gpu.name) capability $capability"
            }
        }
        elseif ($AllowNoGpu) {
            Write-Host -ForegroundColor Yellow "[WARN] No GPU detected, continuing because -AllowNoGpu was set."
        }
        else {
            Add-Fail "No GPU detected"
        }

        $hasBlackwell = $false
        foreach ($gpu in $probe.gpus) {
            if ([int]$gpu.capability[0] -ge 12) {
                $hasBlackwell = $true
                break
            }
        }

        if ($probe.gpu_count -gt 0) {
            if ($hasBlackwell) {
                Add-Pass "Blackwell-class GPU detected (compute capability >= 12.0)"
            }
            elseif ($AllowNonBlackwellGpu) {
                Write-Host -ForegroundColor Yellow "[WARN] Non-Blackwell GPU detected, continuing because -AllowNonBlackwellGpu was set."
            }
            else {
                Add-Fail "No Blackwell-class GPU detected (compute capability >= 12.0)"
            }
        }

        if ($probe.xformers_import_ok -and $probe.xformers_ops_ok) {
            Add-Pass "xformers import and ops binding check passed"
        }
        else {
            $err = $probe.xformers_error
            if ([string]::IsNullOrWhiteSpace($err)) {
                $err = "unknown xformers import error"
            }
            Add-Fail "xformers runtime check failed: $err"
        }
    }
}

Write-Host ""
Write-Host "Summary:"
Write-Host "  Passed: $($passed.Count)"
Write-Host "  Failed: $($failed.Count)"

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host -ForegroundColor Red "Release check failed. Please fix the failed items before packaging."
    exit 1
}

Write-Host ""
Write-Host -ForegroundColor Green "Release check passed. Blackwell package looks ready."
exit 0
