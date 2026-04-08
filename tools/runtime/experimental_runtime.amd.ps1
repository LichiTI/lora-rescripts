function Get-ROCmAmdExpectedPackageVersions {
    return @{
        PythonMinor = "3.12"
        Torch = "2.9.1+rocmsdk20260116"
        TorchVision = "0.24.1+rocmsdk20260116"
        HipPrefix = "7.2."
    }
}

function Get-ROCmAmdSageExpectedPackageVersions {
    return @{
        PythonMinor = "3.12"
        Torch = "2.9.1+rocmsdk20260116"
        TorchVision = "0.24.1+rocmsdk20260116"
        HipPrefix = "7.2."
    }
}

function Get-ROCmAmdGraphicsDriverProbe {
    $result = [ordered]@{
        AdapterDetected = $false
        AdapterNames = @()
        WindowsDriverVersions = @()
        RegistryDriverVersions = @()
        ProbeError = ""
    }

    try {
        $videoControllers = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop | Where-Object {
                ([string]$_.Name -match 'AMD|Radeon|ATI') -or ([string]$_.AdapterCompatibility -match 'AMD|Advanced Micro Devices|ATI')
            })
        if ($videoControllers.Count -gt 0) {
            $result.AdapterDetected = $true
            $result.AdapterNames = @($videoControllers | ForEach-Object { [string]$_.Name } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
            $result.WindowsDriverVersions = @($videoControllers | ForEach-Object { [string]$_.DriverVersion } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
        }
    }
    catch {
        $result.ProbeError = $_.Exception.Message
    }

    try {
        $displayClassKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'
        if (Test-Path $displayClassKey) {
            $registryVersions = foreach ($child in Get-ChildItem -Path $displayClassKey -ErrorAction SilentlyContinue) {
                try {
                    $props = Get-ItemProperty -Path $child.PSPath -ErrorAction Stop
                    $isAmd = ([string]$props.DriverDesc -match 'AMD|Radeon|ATI') -or ([string]$props.ProviderName -match 'AMD|Advanced Micro Devices|ATI')
                    if ($isAmd -and -not [string]::IsNullOrWhiteSpace([string]$props.DriverVersion)) {
                        [string]$props.DriverVersion
                    }
                }
                catch {
                }
            }
            $result.RegistryDriverVersions = @($registryVersions | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
        }
    }
    catch {
        if ([string]::IsNullOrWhiteSpace($result.ProbeError)) {
            $result.ProbeError = $_.Exception.Message
        }
    }

    return [pscustomobject]$result
}

function Write-ROCmAmdGraphicsDriverNotice {
    param(
        [string]$MinimumVersion = "26.2.2"
    )

    $probe = Get-ROCmAmdGraphicsDriverProbe
    if (-not $probe.AdapterDetected) {
        return
    }

    $adapterLabel = if ($probe.AdapterNames -and $probe.AdapterNames.Count -gt 0) {
        $probe.AdapterNames -join ', '
    }
    else {
        'AMD GPU'
    }
    $windowsDriverVersions = if ($probe.WindowsDriverVersions -and $probe.WindowsDriverVersions.Count -gt 0) {
        $probe.WindowsDriverVersions -join '; '
    }
    else {
        'unknown'
    }
    $registryDriverVersions = if ($probe.RegistryDriverVersions -and $probe.RegistryDriverVersions.Count -gt 0) {
        $probe.RegistryDriverVersions -join '; '
    }
    else {
        'unknown'
    }

    Write-Host -ForegroundColor Yellow ("AMD ROCm driver check: AMD display adapter detected ({0}), but the public AMD Software version could not be verified automatically. Windows driver version(s): {1}; registry DriverVersion: {2}. ROCm 7.2.1 on Windows expects AMD graphics driver {3} or newer. Please confirm and update the AMD driver manually if needed. / AMD ROCm 驱动检查：已检测到 AMD 显示适配器（{0}），但无法自动确认 AMD Software 对外版本。Windows 驱动版本：{1}；注册表 DriverVersion：{2}。Windows 上的 ROCm 7.2.1 期望 AMD 显卡驱动版本至少为 {3}；如有需要，请手动确认并升级驱动。" -f $adapterLabel, $windowsDriverVersions, $registryDriverVersions, $MinimumVersion)
}

function Write-ROCmAmdWindowsPrereqNotice {
    Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: AMD's current public Windows ROCm / PyTorch support matrix lists Windows 11 only. Treat other Windows versions as experimental."
    Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: if startup reports missing DLLs or a native extension load failure, first confirm that Microsoft Visual C++ 2015-2022 x64 Redistributable is installed."
    Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: if Windows Defender Application Guard (WDAG) or Smart App Control is enabled, ROCm / PyTorch runtime loading may be blocked. When you see import failures, instant exits, or no visible GPU, check those two features first."
    Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: AMD currently documents torch.distributed as unsupported on Windows, so this project's AMD experimental route forces a single-GPU safety mode."
    Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: AMD still treats ROCm training on Windows as experimental / unsupported. If instability appears, return to the safe profile first: batch size 1, SDPA, and preview disabled."
}

function Resolve-ROCmAmdSageSourceRoot {
    param(
        [string]$SourceRoot
    )

    if (-not [string]::IsNullOrWhiteSpace($SourceRoot) -and (Test-Path $SourceRoot)) {
        return [System.IO.Path]::GetFullPath((Join-Path $SourceRoot '.'))
    }

    $resolvedRepoRoot = Resolve-ExperimentalRuntimeRepoRoot
    $candidateList = New-Object System.Collections.Generic.List[string]

    if (Get-Command Resolve-RuntimeDirectoryInfo -CommandType Function -ErrorAction SilentlyContinue) {
        $runtimeNames = @('rocm-amd-sage', 'rocm-amd')
        foreach ($runtimeName in $runtimeNames) {
            try {
                $runtimeInfo = Resolve-RuntimeDirectoryInfo -RepoRoot $resolvedRepoRoot -RuntimeName $runtimeName
                if ($runtimeInfo -and -not [string]::IsNullOrWhiteSpace($runtimeInfo.DirectoryPath)) {
                    $null = $candidateList.Add((Join-Path $runtimeInfo.DirectoryPath 'SageAttention-rocm'))
                }
            }
            catch {
            }
        }
    }

    $legacyCandidates = @(
        (Join-Path $resolvedRepoRoot 'python_rocm_amd_sage\SageAttention-rocm'),
        (Join-Path $resolvedRepoRoot 'python_rocm_amd\SageAttention-rocm'),
        (Join-Path $resolvedRepoRoot 'SageAttention-rocm')
    )
    foreach ($candidate in $legacyCandidates) {
        $null = $candidateList.Add($candidate)
    }

    foreach ($candidate in @($candidateList | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique)) {
        if (Test-Path $candidate) {
            return [System.IO.Path]::GetFullPath((Join-Path $candidate '.'))
        }
    }

    return ""
}

function Get-ROCmAmdRuntimeProbe {
    param(
        [string]$PythonExe
    )

    $scriptLines = @(
        'import json',
        'import sys',
        'import importlib.metadata as md',
        '',
        'result = {',
        '    "python_version": sys.version.split()[0],',
        '    "python_minor": f"{sys.version_info.major}.{sys.version_info.minor}",',
        '    "torch_version": "",',
        '    "torchvision_version": "",',
        '    "torchaudio_version": "",',
        '    "hip_version": "",',
        '    "gpu_name": "",',
        '    "cuda_available": False,',
        '    "hip_available": False,',
        '    "runtime_error": "",',
        '}',
        '',
        'def metadata_version(*names):',
        '    for name in names:',
        '        try:',
        '            return md.version(name)',
        '        except Exception:',
        '            continue',
        '    return ""',
        '',
        'try:',
        '    import torch',
        'except Exception as exc:',
        '    result["runtime_error"] = f"torch import failed: {exc}"',
        '    print(json.dumps(result))',
        '    raise SystemExit(0)',
        '',
        'result["torch_version"] = getattr(torch, "__version__", "")',
        'result["torchvision_version"] = metadata_version("torchvision")',
        'result["torchaudio_version"] = metadata_version("torchaudio")',
        'result["cuda_available"] = bool(torch.cuda.is_available())',
        'result["hip_version"] = str(getattr(torch.version, "hip", "") or "")',
        'result["hip_available"] = bool(result["hip_version"])',
        '',
        'try:',
        '    if result["cuda_available"] and torch.cuda.device_count() > 0:',
        '        result["gpu_name"] = str(torch.cuda.get_device_name(0) or "")',
        'except Exception as exc:',
        '    if not result["runtime_error"]:',
        '        result["runtime_error"] = f"device probe failed: {exc}"',
        '',
        'if not result["hip_available"] and not result["runtime_error"]:',
        '    result["runtime_error"] = "Torch is not a ROCm build."',
        'elif not result["cuda_available"] and not result["runtime_error"]:',
        '    result["runtime_error"] = "ROCm runtime is installed, but no AMD GPU is available to Torch."',
        '',
        'print(json.dumps(result))'
    )

    return Invoke-ExperimentalRuntimeJsonProbe -PythonExe $PythonExe -ScriptLines $scriptLines
}

function Get-ROCmAmdSageRuntimeProbe {
    param(
        [string]$PythonExe,
        [string]$SourceRoot
    )

    $resolvedRepoRoot = Resolve-ExperimentalRuntimeRepoRoot
    $resolvedSourceRoot = Resolve-ROCmAmdSageSourceRoot -SourceRoot $SourceRoot
    $repoRootLiteral = ConvertTo-Json -Compress $resolvedRepoRoot
    $sourceRootLiteral = ConvertTo-Json -Compress $resolvedSourceRoot

    $scriptLines = @(
        'import json',
        'import sys',
        'import importlib.metadata as md',
        '',
        ("sys.path.insert(0, {0})" -f $repoRootLiteral),
        '',
        'result = {',
        '    "python_version": sys.version.split()[0],',
        '    "python_minor": f"{sys.version_info.major}.{sys.version_info.minor}",',
        '    "torch_version": "",',
        '    "torchvision_version": "",',
        '    "triton_version": "",',
        '    "hip_version": "",',
        '    "gpu_name": "",',
        '    "cuda_available": False,',
        '    "hip_available": False,',
        '    "sageattention_ready": False,',
        '    "sageattention_source": "",',
        ('    "sageattention_source_root": {0},' -f $sourceRootLiteral),
        '    "runtime_error": "",',
        '}',
        '',
        'def metadata_version(*names):',
        '    for name in names:',
        '        try:',
        '            return md.version(name)',
        '        except Exception:',
        '            continue',
        '    return ""',
        '',
        'try:',
        '    import torch',
        'except Exception as exc:',
        '    result["runtime_error"] = f"torch import failed: {exc}"',
        '    print(json.dumps(result))',
        '    raise SystemExit(0)',
        '',
        'result["torch_version"] = getattr(torch, "__version__", "")',
        'result["torchvision_version"] = metadata_version("torchvision")',
        'result["triton_version"] = metadata_version("triton", "pytorch-triton-rocm")',
        'result["cuda_available"] = bool(torch.cuda.is_available())',
        'result["hip_version"] = str(getattr(torch.version, "hip", "") or "")',
        'result["hip_available"] = bool(result["hip_version"])',
        '',
        'try:',
        '    if result["cuda_available"] and torch.cuda.device_count() > 0:',
        '        result["gpu_name"] = str(torch.cuda.get_device_name(0) or "")',
        'except Exception as exc:',
        '    if not result["runtime_error"]:',
        '        result["runtime_error"] = f"device probe failed: {exc}"',
        '',
        'try:',
        '    import triton  # noqa: F401',
        'except Exception as exc:',
        '    if not result["runtime_error"]:',
        '        result["runtime_error"] = f"triton import failed: {exc}"',
        '',
        'try:',
        '    from mikazuki.utils.amd_sageattention import probe_runtime_sageattention',
        '    probe = probe_runtime_sageattention()',
        '    result["sageattention_ready"] = bool(probe.get("ready"))',
        '    result["sageattention_source"] = str(probe.get("source", "") or "")',
        '    if not result["sageattention_source_root"]:',
        '        result["sageattention_source_root"] = str(probe.get("source_root", "") or "")',
        '    if not result["sageattention_ready"] and not result["runtime_error"]:',
        '        result["runtime_error"] = str(probe.get("reason", "") or "AMD SageAttention bridge is not ready.")',
        'except Exception as exc:',
        '    if not result["runtime_error"]:',
        '        result["runtime_error"] = f"AMD SageAttention probe failed: {exc}"',
        '',
        'if not result["hip_available"] and not result["runtime_error"]:',
        '    result["runtime_error"] = "Torch is not a ROCm build."',
        'elif not result["cuda_available"] and not result["runtime_error"]:',
        '    result["runtime_error"] = "ROCm runtime is installed, but no AMD GPU is available to Torch."',
        '',
        'print(json.dumps(result))'
    )

    return Invoke-ExperimentalRuntimeJsonProbe -PythonExe $PythonExe -ScriptLines $scriptLines
}
