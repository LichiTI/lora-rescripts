function Get-IntelXpuExpectedPackageVersions {
    return @{
        PythonMinors = @("3.10", "3.11")
    }
}

function Get-IntelXpuSageExpectedPackageVersions {
    return @{
        PythonMinors = @("3.10", "3.11")
        SageAttention = "1.0.6"
    }
}

function Convert-IntelDriverVersion {
    param(
        [string]$Version
    )

    $normalized = [string]$Version
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        return $null
    }

    try {
        return [version]$normalized.Trim()
    }
    catch {
        return $null
    }
}

function Test-IntelDriverVersionAtLeast {
    param(
        [string]$Version,
        [string]$MinimumVersion
    )

    $actualVersion = Convert-IntelDriverVersion -Version $Version
    $minimum = Convert-IntelDriverVersion -Version $MinimumVersion
    if ($null -eq $actualVersion -or $null -eq $minimum) {
        return $false
    }

    return $actualVersion.CompareTo($minimum) -ge 0
}

function Get-IntelXpuAdapterDriverTargetClass {
    param(
        [string]$AdapterName
    )

    $lowered = ([string]$AdapterName).Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($lowered)) {
        return 'other-intel'
    }

    if (
        $lowered -match 'arc\s+a' -or
        $lowered -match 'arc\s+b' -or
        $lowered -match '\bb3\d{2}\b' -or
        $lowered -match '\bb5\d{2}\b' -or
        (($lowered -match '\barc\b') -and ($lowered -notmatch 'arc graphics'))
    ) {
        return 'discrete-arc'
    }

    if (
        $lowered -match 'arc graphics' -or
        $lowered -match 'core ultra' -or
        $lowered -match 'meteor lake' -or
        $lowered -match 'arrow lake' -or
        $lowered -match 'lunar lake' -or
        $lowered -match 'panther lake'
    ) {
        return 'integrated-arc'
    }

    return 'other-intel'
}

function Get-IntelXpuGraphicsDriverProbe {
    $result = [ordered]@{
        AdapterDetected = $false
        AdapterNames = @()
        AdapterEntries = @()
        WindowsDriverVersions = @()
        RegistryDriverVersions = @()
        ProbeError = ""
    }

    try {
        $videoControllers = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop | Where-Object {
                ([string]$_.Name -match 'Intel') -or ([string]$_.AdapterCompatibility -match 'Intel')
            })
        if ($videoControllers.Count -gt 0) {
            $result.AdapterDetected = $true
            $entries = foreach ($controller in $videoControllers) {
                $name = [string]$controller.Name
                $driverVersion = [string]$controller.DriverVersion
                [pscustomobject]@{
                    Name = $name
                    WindowsDriverVersion = $driverVersion
                    TargetClass = Get-IntelXpuAdapterDriverTargetClass -AdapterName $name
                }
            }
            $result.AdapterEntries = @($entries)
            $result.AdapterNames = @($result.AdapterEntries | ForEach-Object { [string]$_.Name } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
            $result.WindowsDriverVersions = @($result.AdapterEntries | ForEach-Object { [string]$_.WindowsDriverVersion } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
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
                    $isIntel = ([string]$props.DriverDesc -match 'Intel') -or ([string]$props.ProviderName -match 'Intel')
                    if ($isIntel -and -not [string]::IsNullOrWhiteSpace([string]$props.DriverVersion)) {
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

function Write-IntelXpuGraphicsDriverNotice {
    param(
        [string]$RecommendedPackageVersion = "32.0.101.6127_101.6044",
        [string]$DiscreteMinimumVersion = "32.0.101.6127",
        [string]$IntegratedMinimumVersion = "32.0.101.6044"
    )

    $probe = Get-IntelXpuGraphicsDriverProbe
    if (-not $probe.AdapterDetected) {
        return
    }

    $adapterLabel = if ($probe.AdapterNames -and $probe.AdapterNames.Count -gt 0) {
        $probe.AdapterNames -join ', '
    }
    else {
        'Intel GPU'
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

    $adapterEntries = @($probe.AdapterEntries)
    $recognizedEntries = @()
    $belowMinimumEntries = @()
    foreach ($entry in $adapterEntries) {
        $targetClass = [string]$entry.TargetClass
        if ($targetClass -notin @('discrete-arc', 'integrated-arc')) {
            continue
        }

        $minimumVersion = if ($targetClass -eq 'discrete-arc') { $DiscreteMinimumVersion } else { $IntegratedMinimumVersion }
        $targetLabel = if ($targetClass -eq 'discrete-arc') { 'discrete Intel Arc' } else { 'Intel Arc Graphics / integrated XPU' }
        $recognizedEntries += [pscustomobject]@{
            Name = [string]$entry.Name
            WindowsDriverVersion = [string]$entry.WindowsDriverVersion
            MinimumVersion = $minimumVersion
            TargetLabel = $targetLabel
        }

        if (-not (Test-IntelDriverVersionAtLeast -Version ([string]$entry.WindowsDriverVersion) -MinimumVersion $minimumVersion)) {
            $belowMinimumEntries += [pscustomobject]@{
                Name = [string]$entry.Name
                WindowsDriverVersion = [string]$entry.WindowsDriverVersion
                MinimumVersion = $minimumVersion
                TargetLabel = $targetLabel
            }
        }
    }

    if ($belowMinimumEntries.Count -gt 0) {
        $detail = ($belowMinimumEntries | ForEach-Object {
                $detectedVersion = [string]$_.WindowsDriverVersion
                if ([string]::IsNullOrWhiteSpace($detectedVersion)) {
                    $detectedVersion = 'unknown'
                }
                "{0}: detected {1}, expected >= {2} ({3})" -f $_.Name, $detectedVersion, $_.MinimumVersion, $_.TargetLabel
            }) -join '; '
        Write-Host -ForegroundColor Yellow ("Intel XPU driver check: Intel display adapter detected ({0}). Windows driver version(s): {1}; registry DriverVersion: {2}. The current public PyTorch Windows XPU baseline is Intel graphics driver package {3} or newer. This system appears below the current target baseline: {4}. Please upgrade the Intel graphics driver and retry if XPU is unavailable. / Intel XPU 驱动检查：已检测到 Intel 显示适配器（{0}）。Windows 驱动版本：{1}；注册表 DriverVersion：{2}。PyTorch 当前公开的 Windows XPU 参考驱动包基线为至少 {3}。当前系统看起来低于目标基线：{4}。如果 XPU 不可用，请先升级 Intel 显卡驱动后再重试。" -f $adapterLabel, $windowsDriverVersions, $registryDriverVersions, $RecommendedPackageVersion, $detail)
        return
    }

    if ($recognizedEntries.Count -gt 0) {
        $detail = ($recognizedEntries | ForEach-Object {
                $detectedVersion = [string]$_.WindowsDriverVersion
                if ([string]::IsNullOrWhiteSpace($detectedVersion)) {
                    $detectedVersion = 'unknown'
                }
                "{0}: {1} (target >= {2})" -f $_.Name, $detectedVersion, $_.MinimumVersion
            }) -join '; '
        Write-Host -ForegroundColor Green ("Intel XPU driver check: Intel display adapter detected ({0}). Windows driver version(s): {1}; registry DriverVersion: {2}. The current driver appears to meet the project's current Intel XPU baseline ({3}). Details: {4}. / Intel XPU 驱动检查：已检测到 Intel 显示适配器（{0}）。Windows 驱动版本：{1}；注册表 DriverVersion：{2}。当前驱动看起来已达到本项目当前 Intel XPU 基线（{3}）。明细：{4}。" -f $adapterLabel, $windowsDriverVersions, $registryDriverVersions, $RecommendedPackageVersion, $detail)
        return
    }

    Write-Host -ForegroundColor Yellow ("Intel XPU driver check: Intel display adapter detected ({0}), but the current adapter model is outside the project's main Arc/Core Ultra target set, so the public XPU driver baseline could not be matched automatically. Windows driver version(s): {1}; registry DriverVersion: {2}. Please confirm and update the Intel graphics driver manually if needed. / Intel XPU 驱动检查：已检测到 Intel 显示适配器（{0}），但当前适配器型号不在项目主要面向的 Arc/Core Ultra 目标集合中，因此无法自动匹配公开的 XPU 驱动基线。Windows 驱动版本：{1}；注册表 DriverVersion：{2}。如有需要，请手动确认并升级 Intel 显卡驱动。" -f $adapterLabel, $windowsDriverVersions, $registryDriverVersions)
}

function Get-IntelXpuWindowsPlatformProbe {
    $result = [ordered]@{
        IntelGpuDetected = $false
        GpuNames = @()
        OsCaption = ""
        OsVersion = ""
        BuildNumber = ""
        IsWindows11 = $false
        ProbeError = ""
    }

    try {
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
        $buildNumber = [string]$os.BuildNumber
        $result.OsCaption = [string]$os.Caption
        $result.OsVersion = [string]$os.Version
        $result.BuildNumber = $buildNumber
        $numericBuild = 0
        if ([int]::TryParse($buildNumber, [ref]$numericBuild)) {
            $result.IsWindows11 = $numericBuild -ge 22000
        }
    }
    catch {
        $result.ProbeError = $_.Exception.Message
    }

    try {
        $videoControllers = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop | Where-Object {
                ([string]$_.Name -match 'Intel') -or ([string]$_.AdapterCompatibility -match 'Intel')
            })
        if ($videoControllers.Count -gt 0) {
            $result.IntelGpuDetected = $true
            $result.GpuNames = @($videoControllers | ForEach-Object { [string]$_.Name } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)
        }
    }
    catch {
        if ([string]::IsNullOrWhiteSpace($result.ProbeError)) {
            $result.ProbeError = $_.Exception.Message
        }
    }

    return [pscustomobject]$result
}

function Write-IntelXpuWindowsPrereqNotice {
    $platform = Get-IntelXpuWindowsPlatformProbe
    if (-not $platform.IsWindows11 -and -not [string]::IsNullOrWhiteSpace($platform.OsVersion)) {
        Write-Host -ForegroundColor Yellow ("Intel XPU Windows prerequisite notice: PyTorch's current public Windows XPU support mainly targets Windows 11 on Arc A/B and Core Ultra platforms with Arc Graphics. Current system: {0} ({1}, build {2}). Treat this route as experimental. / Intel XPU Windows 前置提示：PyTorch 当前公开的 Windows XPU 主支持范围主要是 Windows 11 上的 Arc A/B 与带 Arc Graphics 的 Core Ultra 平台。当前系统：{0}（{1}，build {2}）。请将这条路线视为实验性支持。" -f $platform.OsCaption, $platform.OsVersion, $platform.BuildNumber)
    }
    else {
        Write-Host -ForegroundColor Yellow "Intel XPU Windows prerequisite notice: PyTorch's current public Windows XPU support mainly targets Windows 11 on Arc A/B and Core Ultra platforms with Arc Graphics. Treat other Intel GPUs or older Windows versions as experimental. / Intel XPU Windows 前置提示：PyTorch 当前公开的 Windows XPU 主支持范围主要是 Windows 11 上的 Arc A/B 与带 Arc Graphics 的 Core Ultra 平台。其他 Intel GPU 或较旧 Windows 版本请按实验路线看待。"
    }

    Write-Host -ForegroundColor Yellow "Intel XPU Windows prerequisite notice: if you want to experiment with torch.compile(XPU) on Windows, PyTorch currently requires an MSVC build toolchain. This project disables torch_compile on the Intel experimental routes by default. / Intel XPU Windows 前置提示：如果你想在 Windows 上尝试 torch.compile(XPU)，PyTorch 当前需要额外的 MSVC 编译工具链。本项目 Intel 实验路线默认会禁用 torch_compile。"
    Write-Host -ForegroundColor Yellow "Intel XPU Windows prerequisite notice: Intel Arc A series still has a known fp16 AMP + GradScaler hardware limitation. When AMP or GradScaler fails, switch to bf16 first. / Intel XPU Windows 前置提示：Intel Arc A 系列目前仍有 fp16 AMP + GradScaler 的硬件限制。若 AMP 或 GradScaler 出错，请优先切换到 bf16。"
}

function Get-IntelXpuRuntimeProbe {
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
        '    "xpu_available": False,',
        '    "gpu_count": 0,',
        '    "gpu_name": "",',
        '    "ipex_version": "",',
        '    "bf16_supported": None,',
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
        'result["ipex_version"] = metadata_version("intel-extension-for-pytorch")',
        '',
        'try:',
        '    result["xpu_available"] = bool(hasattr(torch, "xpu") and torch.xpu.is_available())',
        '    if result["xpu_available"]:',
        '        result["gpu_count"] = int(torch.xpu.device_count())',
        '    if result["xpu_available"] and torch.xpu.device_count() > 0:',
        '        result["gpu_name"] = str(torch.xpu.get_device_name(0) or "")',
        '    if hasattr(torch.xpu, "is_bf16_supported"):',
        '        try:',
        '            result["bf16_supported"] = bool(torch.xpu.is_bf16_supported())',
        '        except Exception:',
        '            result["bf16_supported"] = None',
        'except Exception as exc:',
        '    if not result["runtime_error"]:',
        '        result["runtime_error"] = f"xpu probe failed: {exc}"',
        '',
        'if not result["xpu_available"] and not result["runtime_error"]:',
        '    result["runtime_error"] = "Torch XPU runtime is installed, but no Intel GPU is available to Torch."',
        '',
        'print(json.dumps(result))'
    )

    return Invoke-ExperimentalRuntimeJsonProbe -PythonExe $PythonExe -ScriptLines $scriptLines
}

function Get-IntelXpuSageRuntimeProbe {
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
        '    "triton_version": "",',
        '    "sageattention_version": "",',
        '    "xpu_available": False,',
        '    "gpu_count": 0,',
        '    "gpu_name": "",',
        '    "bf16_supported": None,',
        '    "triton_import_ok": False,',
        '    "sageattention_import_ok": False,',
        '    "sageattention_symbols_ok": False,',
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
        'result["triton_version"] = metadata_version("triton", "pytorch-triton-xpu")',
        'result["sageattention_version"] = metadata_version("sageattention")',
        '',
        'try:',
        '    result["xpu_available"] = bool(hasattr(torch, "xpu") and torch.xpu.is_available())',
        '    if result["xpu_available"]:',
        '        result["gpu_count"] = int(torch.xpu.device_count())',
        '    if result["xpu_available"] and torch.xpu.device_count() > 0:',
        '        result["gpu_name"] = str(torch.xpu.get_device_name(0) or "")',
        '    if hasattr(torch.xpu, "is_bf16_supported"):',
        '        try:',
        '            result["bf16_supported"] = bool(torch.xpu.is_bf16_supported())',
        '        except Exception:',
        '            result["bf16_supported"] = None',
        'except Exception as exc:',
        '    if not result["runtime_error"]:',
        '        result["runtime_error"] = f"xpu probe failed: {exc}"',
        '',
        'try:',
        '    import triton  # noqa: F401',
        '    result["triton_import_ok"] = True',
        'except Exception as exc:',
        '    if not result["runtime_error"]:',
        '        result["runtime_error"] = f"triton import failed: {exc}"',
        '',
        'try:',
        '    from sageattention import sageattn, sageattn_varlen',
        '    result["sageattention_import_ok"] = True',
        '    result["sageattention_symbols_ok"] = callable(sageattn) and callable(sageattn_varlen)',
        '    if not result["sageattention_symbols_ok"] and not result["runtime_error"]:',
        '        result["runtime_error"] = "sageattention import succeeded but required symbols are missing"',
        'except Exception as exc:',
        '    if not result["runtime_error"]:',
        '        result["runtime_error"] = f"sageattention import failed: {exc}"',
        '',
        'if not result["xpu_available"] and not result["runtime_error"]:',
        '    result["runtime_error"] = "Torch XPU runtime is installed, but no Intel GPU is available to Torch."',
        '',
        'print(json.dumps(result))'
    )

    return Invoke-ExperimentalRuntimeJsonProbe -PythonExe $PythonExe -ScriptLines $scriptLines
}
