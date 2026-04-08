$Env:HF_HOME = "huggingface"
$Env:PYTHONUTF8 = "1"
$Env:PIP_DISABLE_PIP_VERSION_CHECK = "1"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchLogsDir = Join-Path $repoRoot "logs\launcher"
$launchTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$script:LaunchTranscriptPath = Join-Path $launchLogsDir ("run_gui-" + $launchTimestamp + ".log")
$script:LaunchTranscriptStarted = $false

function Start-LaunchTranscript {
    if ($script:LaunchTranscriptStarted) {
        return
    }

    New-Item -ItemType Directory -Force -Path $launchLogsDir | Out-Null
    try {
        Start-Transcript -Path $script:LaunchTranscriptPath -Append | Out-Null
        $script:LaunchTranscriptStarted = $true
    }
    catch {
        $script:LaunchTranscriptStarted = $false
    }
}

function Stop-LaunchTranscript {
    if (-not $script:LaunchTranscriptStarted) {
        return
    }

    try {
        Stop-Transcript | Out-Null
    }
    catch {
    }
    finally {
        $script:LaunchTranscriptStarted = $false
    }
}

Start-LaunchTranscript
$Env:MIKAZUKI_LAUNCH_LOG = $script:LaunchTranscriptPath
Write-Host -ForegroundColor DarkGray "Launcher log / 启动日志: $($script:LaunchTranscriptPath)"

trap {
    try {
        Write-Host -ForegroundColor Red "Launcher error / 启动错误: $($_.Exception.Message)"
        if ($script:LaunchTranscriptPath) {
            Write-Host -ForegroundColor Yellow "Launcher log saved to / 启动日志已保存到: $($script:LaunchTranscriptPath)"
        }
    }
    finally {
        Stop-LaunchTranscript
    }
    throw
}

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
$intelXpuRuntimeDirName = "python_xpu_intel"
$intelXpuRuntimeDir = Join-Path $repoRoot $intelXpuRuntimeDirName
$intelXpuPython = Join-Path $intelXpuRuntimeDir "python.exe"
$intelXpuDepsMarker = Join-Path $intelXpuRuntimeDir ".deps_installed"
$intelXpuSageRuntimeDirName = "python_xpu_intel_sage"
$intelXpuSageRuntimeDir = Join-Path $repoRoot $intelXpuSageRuntimeDirName
$intelXpuSagePython = Join-Path $intelXpuSageRuntimeDir "python.exe"
$intelXpuSageDepsMarker = Join-Path $intelXpuSageRuntimeDir ".deps_installed"
$rocmAmdRuntimeDirName = "python_rocm_amd"
$rocmAmdRuntimeDir = Join-Path $repoRoot $rocmAmdRuntimeDirName
$rocmAmdPython = Join-Path $rocmAmdRuntimeDir "python.exe"
$rocmAmdDepsMarker = Join-Path $rocmAmdRuntimeDir ".deps_installed"
$rocmAmdSageRuntimeDirName = "python_rocm_amd_sage"
$rocmAmdSageRuntimeDir = Join-Path $repoRoot $rocmAmdSageRuntimeDirName
$rocmAmdSagePython = Join-Path $rocmAmdSageRuntimeDir "python.exe"
$rocmAmdSageDepsMarker = Join-Path $rocmAmdSageRuntimeDir ".deps_installed"
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
$preferIntelXpuRuntime = $Env:MIKAZUKI_PREFERRED_RUNTIME -eq "intel-xpu"
$preferIntelXpuSageRuntime = $Env:MIKAZUKI_PREFERRED_RUNTIME -eq "intel-xpu-sage"
$preferRocmAmdRuntime = $Env:MIKAZUKI_PREFERRED_RUNTIME -eq "rocm-amd"
$preferRocmAmdSageRuntime = $Env:MIKAZUKI_PREFERRED_RUNTIME -eq "rocm-amd-sage"
$rocmAmdRecommendedGraphicsDriverVersion = "26.2.2"
$baseRuntimeModules = @("accelerate", "torch", "fastapi", "toml", "transformers", "diffusers")
$mainRuntimeModules = @($baseRuntimeModules + @("lion_pytorch", "dadaptation", "schedulefree", "prodigyopt", "prodigyplus", "pytorch_optimizer"))
$amdRuntimeModules = @($baseRuntimeModules + @("cv2"))
$blackwellPreferredProfile = "czmahi-20250502"
$sageAttentionPreferredProfile = "triton-v1"
$sageAttention2PreferredProfile = "triton-v2"
$sageAttentionBlackwellPreferredProfile = "triton-v1"

. (Join-Path $repoRoot "tools\runtime\console_i18n.ps1")
Set-ConsoleLanguage -Language $(if ($Env:MIKAZUKI_CONSOLE_LANG) { $Env:MIKAZUKI_CONSOLE_LANG } else { 'auto' }) | Out-Null

$script:OriginalGetConsoleRuntimeDisplayName = (Get-Command Get-ConsoleRuntimeDisplayName -CommandType Function).ScriptBlock
function Get-ExperimentalRuntimeDisplayName {
    param(
        [ValidateSet('intel-xpu', 'intel-xpu-sage', 'rocm-amd', 'rocm-amd-sage')]
        [string]$RuntimeName,
        [ValidateSet('status', 'python')]
        [string]$Kind = 'status'
    )

    $language = Get-ConsoleLanguage
    switch ($RuntimeName) {
        'intel-xpu' {
            if ($language -eq 'zh') {
                return $(if ($Kind -eq 'python') { 'Intel XPU 实验运行时 Python' } else { 'Intel XPU' })
            }
            if ($language -eq 'ja') {
                return $(if ($Kind -eq 'python') { 'Intel XPU 実験ランタイム Python' } else { 'Intel XPU' })
            }
            return $(if ($Kind -eq 'python') { 'Intel XPU experimental Python' } else { 'Intel XPU' })
        }
        'intel-xpu-sage' {
            if ($language -eq 'zh') {
                return $(if ($Kind -eq 'python') { 'Intel XPU Sage 实验运行时 Python' } else { 'Intel XPU Sage' })
            }
            if ($language -eq 'ja') {
                return $(if ($Kind -eq 'python') { 'Intel XPU Sage 実験ランタイム Python' } else { 'Intel XPU Sage' })
            }
            return $(if ($Kind -eq 'python') { 'Intel XPU Sage experimental Python' } else { 'Intel XPU Sage' })
        }
        'rocm-amd' {
            if ($language -eq 'zh') {
                return $(if ($Kind -eq 'python') { 'AMD ROCm 实验运行时 Python' } else { 'AMD ROCm' })
            }
            if ($language -eq 'ja') {
                return $(if ($Kind -eq 'python') { 'AMD ROCm 実験ランタイム Python' } else { 'AMD ROCm' })
            }
            return $(if ($Kind -eq 'python') { 'AMD ROCm experimental Python' } else { 'AMD ROCm' })
        }
        'rocm-amd-sage' {
            if ($language -eq 'zh') {
                return $(if ($Kind -eq 'python') { 'AMD ROCm Sage 实验运行时 Python' } else { 'AMD ROCm Sage' })
            }
            if ($language -eq 'ja') {
                return $(if ($Kind -eq 'python') { 'AMD ROCm Sage 実験ランタイム Python' } else { 'AMD ROCm Sage' })
            }
            return $(if ($Kind -eq 'python') { 'AMD ROCm Sage experimental Python' } else { 'AMD ROCm Sage' })
        }
    }
}

function Get-ConsoleRuntimeDisplayName {
    param(
        [string]$RuntimeName,
        [ValidateSet('status', 'python')]
        [string]$Kind = 'status'
    )

    if ($RuntimeName -eq 'rocm-amd') {
        return Get-ExperimentalRuntimeDisplayName -RuntimeName 'rocm-amd' -Kind $Kind
    }
    if ($RuntimeName -eq 'rocm-amd-sage') {
        return Get-ExperimentalRuntimeDisplayName -RuntimeName 'rocm-amd-sage' -Kind $Kind
    }
    if ($RuntimeName -eq 'intel-xpu-sage') {
        return Get-ExperimentalRuntimeDisplayName -RuntimeName 'intel-xpu-sage' -Kind $Kind
    }
    if ($RuntimeName -eq 'intel-xpu') {
        return Get-ExperimentalRuntimeDisplayName -RuntimeName 'intel-xpu' -Kind $Kind
    }

    return & $script:OriginalGetConsoleRuntimeDisplayName -RuntimeName $RuntimeName -Kind $Kind
}

function Get-SageRuntimeDisplayNameFromDirName {
    param(
        [string]$RuntimeDirName
    )

    if ($RuntimeDirName -eq $sageAttention2RuntimeDirName) {
        return Get-ConsoleRuntimeDisplayName -RuntimeName 'sageattention2'
    }
    if ($RuntimeDirName -eq $sageAttentionBlackwellRuntimeDirName) {
        return Get-ConsoleRuntimeDisplayName -RuntimeName 'sageattention-blackwell'
    }
    return Get-ConsoleRuntimeDisplayName -RuntimeName 'sageattention'
}

function Convert-BlackwellRuntimeErrorMessage {
    param(
        [string]$Message
    )

    if ([string]::IsNullOrWhiteSpace($Message)) {
        return Get-ConsoleText -Key 'issue_xformers_import_failed'
    }
    if ($Message -match '^torch import failed:\s*(.*)$') {
        return (Get-ConsoleText -Key 'issue_torch_import_failed') + ": $($Matches[1])"
    }
    return $Message
}

function Convert-SageAttentionRuntimeErrorMessage {
    param(
        [string]$Message
    )

    if ([string]::IsNullOrWhiteSpace($Message)) {
        return Get-ConsoleText -Key 'issue_sage_import_failed'
    }
    if ($Message -eq 'sageattention import succeeded but required symbols are missing') {
        return Get-ConsoleText -Key 'issue_sage_symbols_missing'
    }
    if ($Message -match '^torch import failed:\s*(.*)$') {
        return (Get-ConsoleText -Key 'issue_torch_import_failed') + ": $($Matches[1])"
    }
    if ($Message -match '^triton import failed:\s*(.*)$') {
        return (Get-ConsoleText -Key 'issue_triton_import_failed') + ": $($Matches[1])"
    }
    if ($Message -match '_fused|DLL load failed') {
        return Get-ConsoleText -Key 'issue_sage_native_extension_failed'
    }
    return $Message
}

function Format-BlackwellRuntimeSummary {
    param(
        [object]$Probe
    )

    return Get-ConsoleText -Key 'runtime_summary_blackwell' -Tokens @{
        python = $Probe.python_version
        torch = $Probe.torch_version
        torchvision = $Probe.torchvision_version
        xformers = $Probe.xformers_version
    }
}

function Format-SageAttentionRuntimeSummary {
    param(
        [object]$Probe
    )

    return Get-ConsoleText -Key 'runtime_summary_sage' -Tokens @{
        python = $Probe.python_version
        torch = $Probe.torch_version
        torchvision = $Probe.torchvision_version
        triton = $Probe.triton_version
        sageattention = $Probe.sageattention_version
    }
}

function Format-ROCmAmdRuntimeSummary {
    param(
        [object]$Probe
    )

    return "Python $($Probe.python_version); Torch $($Probe.torch_version); TorchVision $($Probe.torchvision_version); HIP $($Probe.hip_version); GPU $($Probe.gpu_name)"
}

function Format-ROCmAmdSageRuntimeSummary {
    param(
        [object]$Probe
    )

    return "Python $($Probe.python_version); Torch $($Probe.torch_version); TorchVision $($Probe.torchvision_version); Triton $($Probe.triton_version); HIP $($Probe.hip_version); GPU $($Probe.gpu_name); Source $($Probe.sageattention_source)"
}

function Format-IntelXpuRuntimeSummary {
    param(
        [object]$Probe
    )

    $bf16State = if ($null -eq $Probe.bf16_supported) { "unknown" } elseif ($Probe.bf16_supported) { "yes" } else { "no" }
    return "Python $($Probe.python_version); Torch $($Probe.torch_version); TorchVision $($Probe.torchvision_version); IPEX $($Probe.ipex_version); XPU count $($Probe.gpu_count); GPU $($Probe.gpu_name); BF16 $bf16State"
}

function Format-IntelXpuSageRuntimeSummary {
    param(
        [object]$Probe
    )

    $bf16State = if ($null -eq $Probe.bf16_supported) { "unknown" } elseif ($Probe.bf16_supported) { "yes" } else { "no" }
    return "Python $($Probe.python_version); Torch $($Probe.torch_version); TorchVision $($Probe.torchvision_version); Triton $($Probe.triton_version); SageAttention $($Probe.sageattention_version); XPU count $($Probe.gpu_count); GPU $($Probe.gpu_name); BF16 $bf16State"
}

function Get-NormalizedSemanticVersionString {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $null
    }

    $match = [regex]::Match($Value, '\d+\.\d+\.\d+(?:\.\d+)?')
    if (-not $match.Success) {
        return $null
    }

    $parts = $match.Value.Split('.')
    if ($parts.Count -lt 3) {
        return $null
    }

    return ($parts[0..2] -join '.')
}

function Test-SemanticVersionAtLeast {
    param(
        [string]$CurrentVersion,
        [string]$MinimumVersion
    )

    $currentNormalized = Get-NormalizedSemanticVersionString -Value $CurrentVersion
    $minimumNormalized = Get-NormalizedSemanticVersionString -Value $MinimumVersion
    if ([string]::IsNullOrWhiteSpace($currentNormalized) -or [string]::IsNullOrWhiteSpace($minimumNormalized)) {
        return $false
    }

    return ([Version]$currentNormalized) -ge ([Version]$minimumNormalized)
}

function Get-UniqueNonEmptyValues {
    param(
        [object[]]$Values
    )

    $result = New-Object System.Collections.Generic.List[string]
    foreach ($value in ($Values | Where-Object { $null -ne $_ })) {
        $text = [string]$value
        if ([string]::IsNullOrWhiteSpace($text)) {
            continue
        }
        $trimmed = $text.Trim()
        if ($trimmed -and -not $result.Contains($trimmed)) {
            $result.Add($trimmed) | Out-Null
        }
    }
    return $result
}

function Get-ROCmAmdGraphicsDriverProbe {
    $probe = [ordered]@{
        AmdGpuDetected = $false
        AdapterNames = @()
        RegistryPublicVersion = ""
        RegistryPublicVersionSource = ""
        RegistryRawDriverVersion = ""
        WindowsDriverVersions = @()
        Notes = @()
    }

    try {
        $videoControllers = Get-CimInstance Win32_VideoController -ErrorAction Stop | Where-Object {
            (($_.Name -as [string]) -match 'AMD|Radeon|ATI') -or
            (($_.AdapterCompatibility -as [string]) -match 'AMD|ATI')
        }
        if ($videoControllers) {
            $probe.AmdGpuDetected = $true
            $probe.AdapterNames = @(Get-UniqueNonEmptyValues -Values ($videoControllers | ForEach-Object { $_.Name }))
            $probe.WindowsDriverVersions = @(Get-UniqueNonEmptyValues -Values ($videoControllers | ForEach-Object { $_.DriverVersion }))
        }
    }
    catch {
        $probe.Notes += "Win32_VideoController probe failed: $($_.Exception.Message)"
    }

    foreach ($registryPath in @("HKLM:\SOFTWARE\AMD\CN", "HKLM:\SOFTWARE\WOW6432Node\AMD\CN")) {
        if (-not (Test-Path $registryPath)) {
            continue
        }

        try {
            $item = Get-ItemProperty -Path $registryPath -ErrorAction Stop
            foreach ($propertyName in @("RadeonSoftwareVersion", "ReleaseVersion")) {
                if ($item.PSObject.Properties.Name -contains $propertyName) {
                    $rawValue = [string]$item.$propertyName
                    $normalized = Get-NormalizedSemanticVersionString -Value $rawValue
                    if ($normalized) {
                        $probe.RegistryPublicVersion = $normalized
                        $probe.RegistryPublicVersionSource = "$registryPath::$propertyName"
                        break
                    }
                }
            }

            if (-not $probe.RegistryRawDriverVersion -and ($item.PSObject.Properties.Name -contains "DriverVersion")) {
                $probe.RegistryRawDriverVersion = [string]$item.DriverVersion
            }
        }
        catch {
            $probe.Notes += "AMD registry probe failed at $registryPath : $($_.Exception.Message)"
        }

        if ($probe.RegistryPublicVersion) {
            break
        }
    }

    return [pscustomobject]$probe
}

function Write-ROCmAmdGraphicsDriverNotice {
    param(
        [string]$MinimumVersion
    )

    $probe = Get-ROCmAmdGraphicsDriverProbe
    $adapterText = if ($probe.AdapterNames.Count -gt 0) { $probe.AdapterNames -join ", " } else { "Unknown AMD GPU" }

    if (-not $probe.AmdGpuDetected) {
        Write-Host -ForegroundColor Yellow "AMD ROCm driver check: no AMD display adapter was detected. / AMD ROCm 驱动检查：未检测到 AMD 显示适配器。"
        return
    }

    if (-not [string]::IsNullOrWhiteSpace($probe.RegistryPublicVersion)) {
        if (Test-SemanticVersionAtLeast -CurrentVersion $probe.RegistryPublicVersion -MinimumVersion $MinimumVersion) {
            Write-Host -ForegroundColor DarkGray "AMD ROCm driver check: detected AMD graphics driver $($probe.RegistryPublicVersion) on $adapterText; recommended minimum for ROCm 7.2.1 is $MinimumVersion. / AMD ROCm 驱动检查：在 $adapterText 上检测到 AMD 显卡驱动 $($probe.RegistryPublicVersion)；ROCm 7.2.1 建议最低版本为 $MinimumVersion。"
            return
        }

        Write-Host -ForegroundColor Red "AMD ROCm driver check: detected AMD graphics driver $($probe.RegistryPublicVersion) on $adapterText, but ROCm 7.2.1 on Windows requires AMD graphics driver $MinimumVersion or newer. Please update the AMD graphics driver before using the AMD experimental runtime. / AMD ROCm 驱动检查：在 $adapterText 上检测到 AMD 显卡驱动 $($probe.RegistryPublicVersion)，但 Windows 上的 ROCm 7.2.1 需要 AMD 显卡驱动 $MinimumVersion 或更高版本。请先升级 AMD 显卡驱动，再使用 AMD 实验运行时。"
        return
    }

    $rawWindowsDriverText = if ($probe.WindowsDriverVersions.Count -gt 0) { $probe.WindowsDriverVersions -join ", " } else { "unknown" }
    $rawRegistryDriverText = if (-not [string]::IsNullOrWhiteSpace($probe.RegistryRawDriverVersion)) { $probe.RegistryRawDriverVersion } else { "unknown" }
    Write-Host -ForegroundColor Yellow "AMD ROCm driver check: AMD display adapter detected ($adapterText), but the public AMD Software version could not be verified automatically. Windows driver version(s): $rawWindowsDriverText; registry DriverVersion: $rawRegistryDriverText. ROCm 7.2.1 on Windows expects AMD graphics driver $MinimumVersion or newer. Please confirm and update the AMD driver manually if needed. / AMD ROCm 驱动检查：已检测到 AMD 显示适配器（$adapterText），但无法自动确认 AMD Software 对外版本。Windows 驱动版本：$rawWindowsDriverText；注册表 DriverVersion：$rawRegistryDriverText。Windows 上的 ROCm 7.2.1 期望 AMD 显卡驱动版本至少为 $MinimumVersion；如有需要，请手动确认并升级驱动。"
}

function Write-ROCmAmdWindowsPrereqNotice {
    $language = Get-ConsoleLanguage
    switch ($language) {
        'zh' {
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows 前置提醒：AMD 当前公开的 Windows ROCm / PyTorch 支持矩阵只列 Windows 11。若你现在是其他 Windows 版本，请按实验路线看待。"
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows 前置提醒：若启动时报缺少 DLL、原生扩展加载失败，先确认系统已安装 Microsoft Visual C++ 2015-2022 x64 运行库。"
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows 前置提醒：若系统开启了 Windows Defender Application Guard (WDAG) 或 Smart App Control，ROCm / PyTorch 运行时可能被拦截；遇到导入失败、启动即退或 GPU 不可见时，请优先检查这两项。"
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows 前置提醒：AMD 官方当前说明 Windows 上的 torch.distributed 仍不受支持，因此本项目 AMD 实验路线会强制走单卡安全模式。"
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows 前置提醒：官方当前仍将 Windows 上的 ROCm 训练视为实验/不支持状态；若异常较多，建议先回到 batch size 1、SDPA、关闭预览图的安全配置。"
        }
        'ja' {
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows の事前確認: AMD が現在公開している Windows ROCm / PyTorch のサポート行列は Windows 11 のみです。別の Windows バージョンは実験扱いで見てください。"
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows の事前確認: DLL 不足やネイティブ拡張の読み込み失敗が出る場合は、Microsoft Visual C++ 2015-2022 x64 再頒布可能パッケージの有無を先に確認してください。"
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows の事前確認: Windows Defender Application Guard (WDAG) または Smart App Control が有効だと、ROCm / PyTorch ランタイムがブロックされることがあります。import 失敗、起動直後の終了、GPU 未検出時はまずこの 2 つを確認してください。"
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows の事前確認: AMD 公式によると Windows 上では torch.distributed はまだ未対応です。そのため本プロジェクトの AMD 実験ルートは単一 GPU 安全モードを強制します。"
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows の事前確認: 公式にも Windows 上の ROCm 学習はまだ実験的 / 非対応扱いです。問題が出たら、まず batch size 1、SDPA、プレビュー無効の安全構成に戻すのがおすすめです。"
        }
        default {
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: AMD's current public Windows ROCm / PyTorch support matrix lists Windows 11 only. Treat other Windows versions as experimental."
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: if startup reports missing DLLs or a native extension load failure, first confirm that Microsoft Visual C++ 2015-2022 x64 Redistributable is installed."
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: if Windows Defender Application Guard (WDAG) or Smart App Control is enabled, ROCm / PyTorch runtime loading may be blocked. When you see import failures, instant exits, or no visible GPU, check those two features first."
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: AMD currently documents torch.distributed as unsupported on Windows, so this project's AMD experimental route forces a single-GPU safety mode."
            Write-Host -ForegroundColor Yellow "AMD ROCm Windows prerequisite notice: AMD still treats ROCm training on Windows as experimental / unsupported. If instability appears, return to the safe profile first: batch size 1, SDPA, and preview disabled."
        }
    }
}

function Get-IntelXpuWindowsPlatformProbe {
    $probe = [ordered]@{
        IntelGpuDetected = $false
        AdapterNames = @()
        WindowsVersion = ""
        BuildNumber = 0
        Notes = @()
    }

    try {
        $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
        $probe.WindowsVersion = [string]$osInfo.Version
        $probe.BuildNumber = [int]($osInfo.BuildNumber -as [int])
    }
    catch {
        $probe.Notes += "Win32_OperatingSystem probe failed: $($_.Exception.Message)"
    }

    try {
        $videoControllers = Get-CimInstance Win32_VideoController -ErrorAction Stop | Where-Object {
            (($_.Name -as [string]) -match 'Intel') -or
            (($_.AdapterCompatibility -as [string]) -match 'Intel')
        }
        if ($videoControllers) {
            $probe.IntelGpuDetected = $true
            $probe.AdapterNames = @(Get-UniqueNonEmptyValues -Values ($videoControllers | ForEach-Object { $_.Name }))
        }
    }
    catch {
        $probe.Notes += "Win32_VideoController probe failed: $($_.Exception.Message)"
    }

    return [pscustomobject]$probe
}

function Write-IntelXpuWindowsPrereqNotice {
    $language = Get-ConsoleLanguage
    $probe = Get-IntelXpuWindowsPlatformProbe
    $adapterText = if ($probe.AdapterNames.Count -gt 0) { $probe.AdapterNames -join ", " } else { "Unknown Intel GPU" }
    $looksLikeWindows11 = ($probe.BuildNumber -ge 22000)

    switch ($language) {
        'zh' {
            if (-not $probe.IntelGpuDetected) {
                Write-Host -ForegroundColor Yellow "Intel XPU Windows 前置提醒：当前未检测到 Intel 显示适配器；如果你本来就是准备用 Intel GPU 训练，请先确认系统是否真的识别到了显卡。"
            }
            elseif (-not $looksLikeWindows11) {
                Write-Host -ForegroundColor Yellow "Intel XPU Windows 前置提醒：当前检测到的系统版本看起来不是 Windows 11（版本 $($probe.WindowsVersion) / build $($probe.BuildNumber)）。PyTorch 当前公开的 Windows XPU 主支持范围更偏向 Windows 11。"
            }
            Write-Host -ForegroundColor Yellow "Intel XPU Windows 前置提醒：PyTorch 当前公开的主支持范围主要是 Arc A/B 与带 Arc Graphics 的 Core Ultra 平台。当前检测到的 Intel 显卡：$adapterText。"
            Write-Host -ForegroundColor Yellow "Intel XPU Windows 前置提醒：若启动时报缺少 DLL、原生扩展加载失败，先确认系统已安装 Microsoft Visual C++ 2015-2022 x64 运行库。"
            Write-Host -ForegroundColor Yellow "Intel XPU Windows 前置提醒：若你自己要尝试 torch.compile(XPU)，PyTorch 官方当前要求额外安装 MSVC 编译链；本项目 Intel 实验路线默认会禁用 torch_compile。"
            Write-Host -ForegroundColor Yellow "Intel XPU Windows 前置提醒：如果你用的是 Arc A 系列，官方当前不建议优先走 fp16 AMP + GradScaler；本项目会优先把这类设备拉回 bf16 或给出警告。"
        }
        'ja' {
            if (-not $probe.IntelGpuDetected) {
                Write-Host -ForegroundColor Yellow "Intel XPU Windows の事前確認: Intel GPU が検出されませんでした。Intel GPU で学習する予定なら、まず OS 側で GPU が正しく認識されているか確認してください。"
            }
            elseif (-not $looksLikeWindows11) {
                Write-Host -ForegroundColor Yellow "Intel XPU Windows の事前確認: 現在の OS は Windows 11 ではない可能性があります（version $($probe.WindowsVersion) / build $($probe.BuildNumber)）。PyTorch の公開サポートは主に Windows 11 を前提にしています。"
            }
            Write-Host -ForegroundColor Yellow "Intel XPU Windows の事前確認: PyTorch が現在公開している主サポート範囲は Arc A/B と Arc Graphics 搭載 Core Ultra が中心です。検出された Intel GPU: $adapterText。"
            Write-Host -ForegroundColor Yellow "Intel XPU Windows の事前確認: DLL 不足やネイティブ拡張の読み込み失敗が出る場合は、Microsoft Visual C++ 2015-2022 x64 再頒布可能パッケージを先に確認してください。"
            Write-Host -ForegroundColor Yellow "Intel XPU Windows の事前確認: torch.compile(XPU) を自分で試す場合、PyTorch 公式は追加の MSVC コンパイラ環境を要求しています。本プロジェクトでは既定で torch_compile を無効化しています。"
            Write-Host -ForegroundColor Yellow "Intel XPU Windows の事前確認: Arc A シリーズでは fp16 AMP + GradScaler にハードウェア上の制約があります。本プロジェクトでは bf16 を優先するか、警告を表示します。"
        }
        default {
            if (-not $probe.IntelGpuDetected) {
                Write-Host -ForegroundColor Yellow "Intel XPU Windows prerequisite notice: no Intel display adapter was detected. If you intend to train on Intel GPU, first confirm that Windows actually sees the device."
            }
            elseif (-not $looksLikeWindows11) {
                Write-Host -ForegroundColor Yellow "Intel XPU Windows prerequisite notice: the detected OS does not look like Windows 11 (version $($probe.WindowsVersion) / build $($probe.BuildNumber)). PyTorch's public Windows XPU support is mainly oriented around Windows 11."
            }
            Write-Host -ForegroundColor Yellow "Intel XPU Windows prerequisite notice: PyTorch's current public support focus is mainly Arc A/B and Core Ultra systems with Arc Graphics. Detected Intel GPU: $adapterText."
            Write-Host -ForegroundColor Yellow "Intel XPU Windows prerequisite notice: if startup reports missing DLLs or native extension load failures, first confirm that Microsoft Visual C++ 2015-2022 x64 Redistributable is installed."
            Write-Host -ForegroundColor Yellow "Intel XPU Windows prerequisite notice: if you want to try torch.compile(XPU) yourself, PyTorch currently requires an additional MSVC toolchain on Windows. This project keeps torch_compile disabled on the Intel experimental routes."
            Write-Host -ForegroundColor Yellow "Intel XPU Windows prerequisite notice: Arc A-series currently has hardware caveats around fp16 AMP + GradScaler. This project will prefer bf16 or warn when that combination is requested."
        }
    }
}

function New-MissingDedicatedRuntimeMessage {
    param(
        [string]$RuntimeName,
        [string]$ExpectedPath,
        [string]$PythonMinor,
        [string]$RuntimeDirName,
        [string]$RerunScript
    )

    return Get-ConsoleText -Key 'missing_dedicated_runtime' -Tokens @{
        runtime = Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName
        expected_path = $ExpectedPath
        python_minor = $PythonMinor
        runtime_dir = $RuntimeDirName
        rerun_script = $RerunScript
    }
}


if ((@($preferBlackwellRuntime, $preferSageAttentionRuntime, $preferSageAttention2Runtime, $preferSageAttentionBlackwellRuntime, $preferIntelXpuRuntime, $preferIntelXpuSageRuntime, $preferRocmAmdRuntime, $preferRocmAmdSageRuntime) | Where-Object { $_ }).Count -gt 1) {
    switch (Get-ConsoleLanguage) {
        'zh' {
            throw '同一时间只能指定一个专用运行时。请清理 MIKAZUKI_PREFERRED_RUNTIME，或在 blackwell / sageattention / sageattention2 / sageattention-blackwell / intel-xpu / intel-xpu-sage / rocm-amd / rocm-amd-sage 中只保留一个。'
        }
        'ja' {
            throw '専用ランタイムは同時に 1 つだけ指定できます。MIKAZUKI_PREFERRED_RUNTIME を消去するか、blackwell / sageattention / sageattention2 / sageattention-blackwell / intel-xpu / intel-xpu-sage / rocm-amd / rocm-amd-sage のどれか 1 つだけを指定してください。'
        }
        default {
            throw 'Only one dedicated runtime can be preferred at a time. Clear MIKAZUKI_PREFERRED_RUNTIME or choose blackwell / sageattention / sageattention2 / sageattention-blackwell / intel-xpu / intel-xpu-sage / rocm-amd / rocm-amd-sage.'
        }
    }
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

    if ($RuntimeName -notin @("blackwell", "sageattention", "sageattention2", "sageattention-blackwell", "intel-xpu", "intel-xpu-sage", "rocm-amd", "rocm-amd-sage")) {
        return
    }

    $runtimeRoot = Split-Path -Parent $PythonExe
    if ([string]::IsNullOrWhiteSpace($runtimeRoot) -or -not (Test-Path $runtimeRoot)) {
        return
    }

    $cacheRoot = Join-Path $runtimeRoot ".cache"
    if ($RuntimeName -in @("rocm-amd", "rocm-amd-sage", "intel-xpu", "intel-xpu-sage")) {
        $torchInductorCacheDir = if ($Env:TORCHINDUCTOR_CACHE_DIR) { $Env:TORCHINDUCTOR_CACHE_DIR } else { Join-Path $cacheRoot "torchinductor" }
        foreach ($path in @($cacheRoot, $torchInductorCacheDir)) {
            if (-not (Test-Path $path)) {
                New-Item -ItemType Directory -Path $path -Force | Out-Null
            }
        }
        if (-not $Env:TORCHINDUCTOR_CACHE_DIR) {
            $Env:TORCHINDUCTOR_CACHE_DIR = $torchInductorCacheDir
        }

        Write-ConsoleText -Key 'cache_enabled_header' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName) } -ForegroundColor 'DarkGray'
        Write-Host -ForegroundColor DarkGray "- TORCHINDUCTOR_CACHE_DIR=$torchInductorCacheDir"
        return
    }

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

    Write-ConsoleText -Key 'cache_enabled_header' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName) } -ForegroundColor 'DarkGray'
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

function Get-ROCmAmdExpectedPackageVersions {
    return @{
        PythonMinor = "3.12"
        TorchPrefix = "2.9.1+"
        TorchVisionPrefix = "0.24.1+"
        HipPrefix = "7.2"
    }
}

function Get-ROCmAmdSageExpectedPackageVersions {
    return @{
        PythonMinor = "3.12"
        TorchPrefix = "2.9.1+"
        TorchVisionPrefix = "0.24.1+"
        HipPrefix = "7.2"
    }
}

function Get-IntelXpuExpectedPackageVersions {
    return @{
        PythonMinors = @("3.10", "3.11")
        Torch = ""
        TorchVision = ""
    }
}

function Get-MainRuntimeModulesForRuntime {
    param(
        [string]$RuntimeName
    )

    switch ($RuntimeName) {
        "rocm-amd" { return $amdRuntimeModules }
        "rocm-amd-sage" { return $amdRuntimeModules }
        default { return $mainRuntimeModules }
    }
}

function Get-IntelXpuSageExpectedPackageVersions {
    return @{
        PythonMinors = @("3.10", "3.11")
        Torch = ""
        TorchVision = ""
        SageAttention = "1.0.6"
        Triton = ""
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

function Get-ROCmAmdRuntimeProbe {
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
    "hip_version": "",
    "gpu_name": "",
    "cuda_available": False,
    "hip_available": False,
    "runtime_error": "",
}

def metadata_version(name):
    try:
        return md.version(name)
    except Exception:
        return ""

try:
    import torch
except Exception as exc:
    result["runtime_error"] = f"torch import failed: {exc}"
    print(json.dumps(result))
    raise SystemExit(0)

result["torch_version"] = getattr(torch, "__version__", "")
result["torchvision_version"] = metadata_version("torchvision")
result["cuda_available"] = bool(torch.cuda.is_available())
result["hip_version"] = str(getattr(torch.version, "hip", "") or "")
result["hip_available"] = bool(result["hip_version"])

try:
    if torch.cuda.is_available() and torch.cuda.device_count() > 0:
        result["gpu_name"] = str(torch.cuda.get_device_name(0) or "")
except Exception as exc:
    if not result["runtime_error"]:
        result["runtime_error"] = f"device probe failed: {exc}"

if not result["hip_available"] and not result["runtime_error"]:
    result["runtime_error"] = "Torch is not a ROCm build."
elif not result["cuda_available"] and not result["runtime_error"]:
    result["runtime_error"] = "ROCm runtime is installed, but no AMD GPU is available to Torch."

print(json.dumps(result))
"@

    return Invoke-PythonJsonProbe -PythonExe $PythonExe -ScriptContent $script
}

function Get-ROCmAmdSageRuntimeProbe {
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
    "triton_version": "",
    "hip_version": "",
    "gpu_name": "",
    "cuda_available": False,
    "hip_available": False,
    "sageattention_ready": False,
    "sageattention_source": "",
    "sageattention_source_root": "",
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

function Get-IntelXpuRuntimeProbe {
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
    "ipex_version": "",
    "xpu_available": False,
    "gpu_count": 0,
    "gpu_name": "",
    "bf16_supported": None,
    "runtime_error": "",
}

def metadata_version(name):
    try:
        return md.version(name)
    except Exception:
        return ""

try:
    import torch
except Exception as exc:
    result["runtime_error"] = f"torch import failed: {exc}"
    print(json.dumps(result))
    raise SystemExit(0)

result["torch_version"] = getattr(torch, "__version__", "")
result["torchvision_version"] = metadata_version("torchvision")
result["ipex_version"] = metadata_version("intel-extension-for-pytorch")

try:
    result["xpu_available"] = bool(hasattr(torch, "xpu") and torch.xpu.is_available())
    if result["xpu_available"]:
        result["gpu_count"] = int(torch.xpu.device_count())
    if result["xpu_available"] and torch.xpu.device_count() > 0:
        result["gpu_name"] = str(torch.xpu.get_device_name(0) or "")
    if hasattr(torch.xpu, "is_bf16_supported"):
        try:
            result["bf16_supported"] = bool(torch.xpu.is_bf16_supported())
        except Exception:
            result["bf16_supported"] = None
except Exception as exc:
    if not result["runtime_error"]:
        result["runtime_error"] = f"xpu probe failed: {exc}"

if not result["xpu_available"] and not result["runtime_error"]:
    result["runtime_error"] = "Torch XPU runtime is installed, but no Intel GPU is available to Torch."

print(json.dumps(result))
"@

    return Invoke-PythonJsonProbe -PythonExe $PythonExe -ScriptContent $script
}

function Get-IntelXpuSageRuntimeProbe {
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
    "triton_version": "",
    "sageattention_version": "",
    "xpu_available": False,
    "gpu_count": 0,
    "gpu_name": "",
    "bf16_supported": None,
    "triton_import_ok": False,
    "sageattention_import_ok": False,
    "sageattention_symbols_ok": False,
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
result["triton_version"] = metadata_version("triton", "pytorch-triton-xpu")
result["sageattention_version"] = metadata_version("sageattention")

try:
    result["xpu_available"] = bool(hasattr(torch, "xpu") and torch.xpu.is_available())
    if result["xpu_available"]:
        result["gpu_count"] = int(torch.xpu.device_count())
    if result["xpu_available"] and torch.xpu.device_count() > 0:
        result["gpu_name"] = str(torch.xpu.get_device_name(0) or "")
    if hasattr(torch.xpu, "is_bf16_supported"):
        try:
            result["bf16_supported"] = bool(torch.xpu.is_bf16_supported())
        except Exception:
            result["bf16_supported"] = None
except Exception as exc:
    if not result["runtime_error"]:
        result["runtime_error"] = f"xpu probe failed: {exc}"

try:
    import triton  # noqa: F401
    result["triton_import_ok"] = True
except Exception as exc:
    if not result["runtime_error"]:
        result["runtime_error"] = f"triton import failed: {exc}"

try:
    from sageattention import sageattn, sageattn_varlen
    result["sageattention_import_ok"] = True
    result["sageattention_symbols_ok"] = callable(sageattn) and callable(sageattn_varlen)
    if not result["sageattention_symbols_ok"] and not result["runtime_error"]:
        result["runtime_error"] = "sageattention import succeeded but required symbols are missing"
except Exception as exc:
    if not result["runtime_error"]:
        result["runtime_error"] = f"sageattention import failed: {exc}"

if not result["xpu_available"] and not result["runtime_error"]:
    result["runtime_error"] = "Torch XPU runtime is installed, but no Intel GPU is available to Torch."

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
        $Message.Value = Get-ConsoleText -Key 'probe_runtime_details_failed' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'blackwell') }
        return $false
    }

    $issues = New-Object System.Collections.Generic.List[string]
    if ($Expected.PythonMinor -and $probe.python_minor -ne $Expected.PythonMinor) {
        $issues.Add((Get-ConsoleText -Key 'issue_python_minor_mismatch' -Tokens @{ actual = $probe.python_minor; expected = $Expected.PythonMinor })) | Out-Null
    }
    if ($Expected.TorchPrefix -and ([string]::IsNullOrWhiteSpace($probe.torch_version) -or -not $probe.torch_version.StartsWith($Expected.TorchPrefix))) {
        $issues.Add((Get-ConsoleText -Key 'issue_torch_mismatch' -Tokens @{ actual = $probe.torch_version; expected = "$($Expected.TorchPrefix)*" })) | Out-Null
    }
    if ($Expected.TorchVisionPrefix -and ([string]::IsNullOrWhiteSpace($probe.torchvision_version) -or -not $probe.torchvision_version.StartsWith($Expected.TorchVisionPrefix))) {
        $issues.Add((Get-ConsoleText -Key 'issue_torchvision_mismatch' -Tokens @{ actual = $probe.torchvision_version; expected = "$($Expected.TorchVisionPrefix)*" })) | Out-Null
    }
    if ($Expected.Xformers -and $probe.xformers_version -ne $Expected.Xformers) {
        $issues.Add((Get-ConsoleText -Key 'issue_xformers_mismatch' -Tokens @{ actual = $probe.xformers_version; expected = $Expected.Xformers })) | Out-Null
    }
    if (-not $probe.xformers_import_ok -or -not $probe.xformers_ops_ok) {
        $issues.Add((Convert-BlackwellRuntimeErrorMessage -Message $probe.xformers_error)) | Out-Null
    }

    if ($issues.Count -gt 0) {
        $Message.Value = ($issues -join '; ')
        return $false
    }

    $Message.Value = Format-BlackwellRuntimeSummary -Probe $probe
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
        $Message.Value = Get-ConsoleText -Key 'probe_runtime_details_failed' -Tokens @{ runtime = (Get-SageRuntimeDisplayNameFromDirName -RuntimeDirName $RuntimeDirName) }
        return $false
    }

    $issues = New-Object System.Collections.Generic.List[string]
    if ($Expected.PythonMinor -and $probe.python_minor -ne $Expected.PythonMinor) {
        $issues.Add((Get-ConsoleText -Key 'issue_python_minor_mismatch' -Tokens @{ actual = $probe.python_minor; expected = $Expected.PythonMinor })) | Out-Null
    }
    if ($Expected.TorchPrefix -and ([string]::IsNullOrWhiteSpace($probe.torch_version) -or -not $probe.torch_version.StartsWith($Expected.TorchPrefix))) {
        $issues.Add((Get-ConsoleText -Key 'issue_torch_mismatch' -Tokens @{ actual = $probe.torch_version; expected = "$($Expected.TorchPrefix)*" })) | Out-Null
    }
    if ($Expected.TorchVisionPrefix -and ([string]::IsNullOrWhiteSpace($probe.torchvision_version) -or -not $probe.torchvision_version.StartsWith($Expected.TorchVisionPrefix))) {
        $issues.Add((Get-ConsoleText -Key 'issue_torchvision_mismatch' -Tokens @{ actual = $probe.torchvision_version; expected = "$($Expected.TorchVisionPrefix)*" })) | Out-Null
    }
    if ($Expected.SageAttention -and $probe.sageattention_version -ne $Expected.SageAttention) {
        $issues.Add((Get-ConsoleText -Key 'issue_sageattention_mismatch' -Tokens @{ actual = $probe.sageattention_version; expected = $Expected.SageAttention })) | Out-Null
    }
    if ($Expected.Triton -and $probe.triton_version -ne $Expected.Triton) {
        $issues.Add((Get-ConsoleText -Key 'issue_triton_mismatch' -Tokens @{ actual = $probe.triton_version; expected = $Expected.Triton })) | Out-Null
    }
    if (-not $probe.cuda_available) {
        $issues.Add((Get-ConsoleText -Key 'issue_cuda_unavailable')) | Out-Null
    }
    if (-not $probe.triton_import_ok) {
        $issues.Add((Convert-SageAttentionRuntimeErrorMessage -Message $probe.sageattention_error)) | Out-Null
    }
    elseif (-not $probe.sageattention_import_ok -or -not $probe.sageattention_symbols_ok) {
        $issues.Add((Convert-SageAttentionRuntimeErrorMessage -Message $probe.sageattention_error)) | Out-Null
    }

    if ($issues.Count -gt 0) {
        $Message.Value = ($issues -join '; ')
        return $false
    }

    $Message.Value = Format-SageAttentionRuntimeSummary -Probe $probe
    return $true
}

function Test-ROCmAmdRuntimeReady {
    param (
        [string]$PythonExe,
        [hashtable]$Expected,
        [ref]$Message
    )

    $probe = Get-ROCmAmdRuntimeProbe -PythonExe $PythonExe
    if (-not $probe) {
        $Message.Value = "Could not probe AMD ROCm runtime details."
        return $false
    }

    $issues = New-Object System.Collections.Generic.List[string]
    if ($Expected.PythonMinor -and $probe.python_minor -ne $Expected.PythonMinor) {
        $issues.Add((Get-ConsoleText -Key 'issue_python_minor_mismatch' -Tokens @{ actual = $probe.python_minor; expected = $Expected.PythonMinor })) | Out-Null
    }
    if ($Expected.Torch -and $probe.torch_version -ne $Expected.Torch) {
        $issues.Add((Get-ConsoleText -Key 'issue_torch_mismatch' -Tokens @{ actual = $probe.torch_version; expected = $Expected.Torch })) | Out-Null
    }
    if ($Expected.TorchVision -and $probe.torchvision_version -ne $Expected.TorchVision) {
        $issues.Add((Get-ConsoleText -Key 'issue_torchvision_mismatch' -Tokens @{ actual = $probe.torchvision_version; expected = $Expected.TorchVision })) | Out-Null
    }
    if ($Expected.HipPrefix -and -not [string]::IsNullOrWhiteSpace($probe.hip_version) -and -not $probe.hip_version.StartsWith($Expected.HipPrefix)) {
        $issues.Add("HIP runtime is $($probe.hip_version), expected prefix $($Expected.HipPrefix)") | Out-Null
    }
    if (-not $probe.hip_available) {
        $issues.Add("Torch is not a ROCm build.") | Out-Null
    }
    if (-not $probe.cuda_available) {
        $issues.Add("ROCm GPU is not available to Torch.") | Out-Null
    }
    if ($probe.runtime_error) {
        $issues.Add($probe.runtime_error) | Out-Null
    }

    if ($issues.Count -gt 0) {
        $Message.Value = ($issues -join '; ')
        return $false
    }

    $Message.Value = Format-ROCmAmdRuntimeSummary -Probe $probe
    return $true
}

function Test-ROCmAmdSageRuntimeReady {
    param (
        [string]$PythonExe,
        [hashtable]$Expected,
        [ref]$Message
    )

    $probe = Get-ROCmAmdSageRuntimeProbe -PythonExe $PythonExe
    if (-not $probe) {
        $Message.Value = "Could not probe AMD ROCm Sage runtime details."
        return $false
    }

    $issues = New-Object System.Collections.Generic.List[string]
    if ($Expected.PythonMinor -and $probe.python_minor -ne $Expected.PythonMinor) {
        $issues.Add((Get-ConsoleText -Key 'issue_python_minor_mismatch' -Tokens @{ actual = $probe.python_minor; expected = $Expected.PythonMinor })) | Out-Null
    }
    if ($Expected.Torch -and $probe.torch_version -ne $Expected.Torch) {
        $issues.Add((Get-ConsoleText -Key 'issue_torch_mismatch' -Tokens @{ actual = $probe.torch_version; expected = $Expected.Torch })) | Out-Null
    }
    if ($Expected.TorchVision -and $probe.torchvision_version -ne $Expected.TorchVision) {
        $issues.Add((Get-ConsoleText -Key 'issue_torchvision_mismatch' -Tokens @{ actual = $probe.torchvision_version; expected = $Expected.TorchVision })) | Out-Null
    }
    if ($Expected.HipPrefix -and -not [string]::IsNullOrWhiteSpace($probe.hip_version) -and -not $probe.hip_version.StartsWith($Expected.HipPrefix)) {
        $issues.Add("HIP runtime is $($probe.hip_version), expected prefix $($Expected.HipPrefix)") | Out-Null
    }
    if (-not $probe.hip_available) {
        $issues.Add("Torch is not a ROCm build.") | Out-Null
    }
    if (-not $probe.cuda_available) {
        $issues.Add("ROCm GPU is not available to Torch.") | Out-Null
    }
    if (-not $probe.sageattention_ready) {
        $issues.Add("AMD SageAttention bridge is not ready.") | Out-Null
    }
    if ($probe.runtime_error) {
        $issues.Add($probe.runtime_error) | Out-Null
    }

    if ($issues.Count -gt 0) {
        $Message.Value = ($issues -join '; ')
        return $false
    }

    $Message.Value = Format-ROCmAmdSageRuntimeSummary -Probe $probe
    return $true
}

function Test-IntelXpuRuntimeReady {
    param (
        [string]$PythonExe,
        [hashtable]$Expected,
        [ref]$Message
    )

    $probe = Get-IntelXpuRuntimeProbe -PythonExe $PythonExe
    if (-not $probe) {
        $Message.Value = "Could not probe Intel XPU runtime details."
        return $false
    }

    $issues = New-Object System.Collections.Generic.List[string]
    if ($Expected.PythonMinors -and $Expected.PythonMinors.Count -gt 0 -and $probe.python_minor -notin $Expected.PythonMinors) {
        $issues.Add((Get-ConsoleText -Key 'issue_python_minor_mismatch' -Tokens @{ actual = $probe.python_minor; expected = ($Expected.PythonMinors -join '/') })) | Out-Null
    }
    if ($Expected.Torch -and $probe.torch_version -ne $Expected.Torch) {
        $issues.Add((Get-ConsoleText -Key 'issue_torch_mismatch' -Tokens @{ actual = $probe.torch_version; expected = $Expected.Torch })) | Out-Null
    }
    if ($Expected.TorchVision -and $probe.torchvision_version -ne $Expected.TorchVision) {
        $issues.Add((Get-ConsoleText -Key 'issue_torchvision_mismatch' -Tokens @{ actual = $probe.torchvision_version; expected = $Expected.TorchVision })) | Out-Null
    }
    if (-not $probe.xpu_available) {
        $issues.Add("Intel XPU is not available to Torch.") | Out-Null
    }
    if ($probe.runtime_error) {
        $issues.Add($probe.runtime_error) | Out-Null
    }

    if ($issues.Count -gt 0) {
        $Message.Value = ($issues -join '; ')
        return $false
    }

    $Message.Value = Format-IntelXpuRuntimeSummary -Probe $probe
    return $true
}

function Test-IntelXpuSageRuntimeReady {
    param (
        [string]$PythonExe,
        [hashtable]$Expected,
        [ref]$Message
    )

    $probe = Get-IntelXpuSageRuntimeProbe -PythonExe $PythonExe
    if (-not $probe) {
        $Message.Value = "Could not probe Intel XPU Sage runtime details."
        return $false
    }

    $issues = New-Object System.Collections.Generic.List[string]
    if ($Expected.PythonMinors -and $Expected.PythonMinors.Count -gt 0 -and $probe.python_minor -notin $Expected.PythonMinors) {
        $issues.Add((Get-ConsoleText -Key 'issue_python_minor_mismatch' -Tokens @{ actual = $probe.python_minor; expected = ($Expected.PythonMinors -join '/') })) | Out-Null
    }
    if ($Expected.Torch -and $probe.torch_version -ne $Expected.Torch) {
        $issues.Add((Get-ConsoleText -Key 'issue_torch_mismatch' -Tokens @{ actual = $probe.torch_version; expected = $Expected.Torch })) | Out-Null
    }
    if ($Expected.TorchVision -and $probe.torchvision_version -ne $Expected.TorchVision) {
        $issues.Add((Get-ConsoleText -Key 'issue_torchvision_mismatch' -Tokens @{ actual = $probe.torchvision_version; expected = $Expected.TorchVision })) | Out-Null
    }
    if ($Expected.SageAttention -and $probe.sageattention_version -ne $Expected.SageAttention) {
        $issues.Add((Get-ConsoleText -Key 'issue_sageattention_mismatch' -Tokens @{ actual = $probe.sageattention_version; expected = $Expected.SageAttention })) | Out-Null
    }
    if ($Expected.Triton -and $probe.triton_version -ne $Expected.Triton) {
        $issues.Add((Get-ConsoleText -Key 'issue_triton_mismatch' -Tokens @{ actual = $probe.triton_version; expected = $Expected.Triton })) | Out-Null
    }
    if (-not $probe.xpu_available) {
        $issues.Add("Intel XPU is not available to Torch.") | Out-Null
    }
    if (-not $probe.triton_import_ok) {
        $issues.Add("Triton is not importable in the Intel XPU Sage runtime.") | Out-Null
    }
    if (-not $probe.sageattention_import_ok -or -not $probe.sageattention_symbols_ok) {
        $issues.Add("SageAttention is not importable in the Intel XPU Sage runtime.") | Out-Null
    }
    if ($probe.runtime_error) {
        $issues.Add($probe.runtime_error) | Out-Null
    }

    if ($issues.Count -gt 0) {
        $Message.Value = ($issues -join '; ')
        return $false
    }

    $Message.Value = Format-IntelXpuSageRuntimeSummary -Probe $probe
    return $true
}

function Get-SelectedRuntimeValidationState {
    param (
        [string]$PythonExe,
        [string]$RuntimeName,
        [string[]]$MainModules,
        [hashtable]$BlackwellExpected,
        [hashtable]$SageAttentionExpected,
        [hashtable]$SageAttention2Expected,
        [hashtable]$SageAttentionBlackwellExpected,
        [hashtable]$IntelXpuExpected,
        [hashtable]$IntelXpuSageExpected,
        [hashtable]$ROCmAmdExpected,
        [hashtable]$ROCmAmdSageExpected
    )

    $state = @{
        MainModulesReady = Test-ModulesReady -PythonExe $PythonExe -Modules $MainModules
        BlackwellXformersReady = $true
        BlackwellRuntimeMessage = ""
        SageAttentionRuntimeReady = $true
        SageAttentionRuntimeMessage = ""
        IntelXpuRuntimeReady = $true
        IntelXpuRuntimeMessage = ""
        IntelXpuSageRuntimeReady = $true
        IntelXpuSageRuntimeMessage = ""
        ROCmAmdRuntimeReady = $true
        ROCmAmdRuntimeMessage = ""
        ROCmAmdSageRuntimeReady = $true
        ROCmAmdSageRuntimeMessage = ""
    }

    switch ($RuntimeName) {
        "blackwell" {
            $message = ""
            $state.BlackwellXformersReady = Test-BlackwellRuntimeReady -PythonExe $PythonExe -Expected $BlackwellExpected -Message ([ref]$message)
            $state.BlackwellRuntimeMessage = $message
        }
        "sageattention" {
            $message = ""
            $state.SageAttentionRuntimeReady = Test-SageAttentionRuntimeReady -PythonExe $PythonExe -Expected $SageAttentionExpected -RuntimeDirName $sageAttentionRuntimeDirName -Message ([ref]$message)
            $state.SageAttentionRuntimeMessage = $message
        }
        "sageattention2" {
            $message = ""
            $state.SageAttentionRuntimeReady = Test-SageAttentionRuntimeReady -PythonExe $PythonExe -Expected $SageAttention2Expected -RuntimeDirName $sageAttention2RuntimeDirName -Message ([ref]$message)
            $state.SageAttentionRuntimeMessage = $message
        }
        "sageattention-blackwell" {
            $message = ""
            $state.SageAttentionRuntimeReady = Test-SageAttentionRuntimeReady -PythonExe $PythonExe -Expected $SageAttentionBlackwellExpected -RuntimeDirName $sageAttentionBlackwellRuntimeDirName -Message ([ref]$message)
            $state.SageAttentionRuntimeMessage = $message
        }
        "intel-xpu" {
            $message = ""
            $state.IntelXpuRuntimeReady = Test-IntelXpuRuntimeReady -PythonExe $PythonExe -Expected $IntelXpuExpected -Message ([ref]$message)
            $state.IntelXpuRuntimeMessage = $message
        }
        "intel-xpu-sage" {
            $message = ""
            $state.IntelXpuSageRuntimeReady = Test-IntelXpuSageRuntimeReady -PythonExe $PythonExe -Expected $IntelXpuSageExpected -Message ([ref]$message)
            $state.IntelXpuSageRuntimeMessage = $message
        }
        "rocm-amd" {
            $message = ""
            $state.ROCmAmdRuntimeReady = Test-ROCmAmdRuntimeReady -PythonExe $PythonExe -Expected $ROCmAmdExpected -Message ([ref]$message)
            $state.ROCmAmdRuntimeMessage = $message
        }
        "rocm-amd-sage" {
            $message = ""
            $state.ROCmAmdSageRuntimeReady = Test-ROCmAmdSageRuntimeReady -PythonExe $PythonExe -Expected $ROCmAmdSageExpected -Message ([ref]$message)
            $state.ROCmAmdSageRuntimeMessage = $message
        }
    }

    return $state
}


function Test-SelectedRuntimeBootstrapReady {
    param (
        [string]$DepsMarker,
        [hashtable]$State
    )

    return (
        (Test-Path $DepsMarker) `
        -and $State.MainModulesReady `
        -and $State.BlackwellXformersReady `
        -and $State.SageAttentionRuntimeReady `
        -and $State.IntelXpuRuntimeReady `
        -and $State.IntelXpuSageRuntimeReady `
        -and $State.ROCmAmdRuntimeReady `
        -and $State.ROCmAmdSageRuntimeReady
    )
}


function Write-SelectedRuntimeNotReadyNotice {
    param (
        [string]$RuntimeName,
        [hashtable]$State
    )

    if ($RuntimeName -eq "blackwell" -and -not $State.BlackwellXformersReady -and $State.BlackwellRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_not_ready' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.BlackwellRuntimeMessage } -ForegroundColor 'Yellow'
    }
    elseif ($RuntimeName -in @("sageattention", "sageattention2", "sageattention-blackwell") -and -not $State.SageAttentionRuntimeReady -and $State.SageAttentionRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_not_ready' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.SageAttentionRuntimeMessage } -ForegroundColor 'Yellow'
    }
    elseif ($RuntimeName -eq "intel-xpu" -and -not $State.IntelXpuRuntimeReady -and $State.IntelXpuRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_not_ready' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.IntelXpuRuntimeMessage } -ForegroundColor 'Yellow'
    }
    elseif ($RuntimeName -eq "intel-xpu-sage" -and -not $State.IntelXpuSageRuntimeReady -and $State.IntelXpuSageRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_not_ready' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.IntelXpuSageRuntimeMessage } -ForegroundColor 'Yellow'
    }
    elseif ($RuntimeName -eq "rocm-amd" -and -not $State.ROCmAmdRuntimeReady -and $State.ROCmAmdRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_not_ready' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.ROCmAmdRuntimeMessage } -ForegroundColor 'Yellow'
    }
    elseif ($RuntimeName -eq "rocm-amd-sage" -and -not $State.ROCmAmdSageRuntimeReady -and $State.ROCmAmdSageRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_not_ready' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.ROCmAmdSageRuntimeMessage } -ForegroundColor 'Yellow'
    }
}

function Install-SelectedRuntimeDependencies {
    param (
        [string]$RuntimeName,
        [string]$BlackwellProfile,
        [string]$SageAttentionProfile,
        [string]$SageAttentionBlackwellProfile
    )

    if ($RuntimeName -eq "blackwell") {
        Write-ConsoleText -Key 'install_runtime_dependencies' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); script = 'install_blackwell.ps1' } -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot "install_blackwell.ps1") -TorchChannel $BlackwellProfile
    }
    elseif ($RuntimeName -eq "sageattention") {
        Write-ConsoleText -Key 'install_runtime_dependencies' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); script = 'install_sageattention.ps1' } -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot "install_sageattention.ps1") -Profile $SageAttentionProfile -RuntimeTarget general
    }
    elseif ($RuntimeName -eq "sageattention2") {
        Write-ConsoleText -Key 'install_runtime_dependencies' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); script = 'install_sageattention2.ps1' } -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot "install_sageattention2.ps1")
    }
    elseif ($RuntimeName -eq "sageattention-blackwell") {
        Write-ConsoleText -Key 'install_runtime_dependencies' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); script = 'install_sageattention.ps1' } -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot "install_sageattention.ps1") -Profile $SageAttentionBlackwellProfile -RuntimeTarget blackwell
    }
    elseif ($RuntimeName -eq "intel-xpu") {
        Write-ConsoleText -Key 'install_runtime_dependencies' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); script = 'install_intel_xpu.ps1' } -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot "install_intel_xpu.ps1")
    }
    elseif ($RuntimeName -eq "intel-xpu-sage") {
        Write-ConsoleText -Key 'install_runtime_dependencies' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); script = 'install_intel_xpu_sage.ps1' } -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot "install_intel_xpu_sage.ps1")
    }
    elseif ($RuntimeName -eq "rocm-amd") {
        Write-ConsoleText -Key 'install_runtime_dependencies' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); script = 'install_rocm_amd.ps1' } -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot "install_rocm_amd.ps1")
    }
    elseif ($RuntimeName -eq "rocm-amd-sage") {
        Write-ConsoleText -Key 'install_runtime_dependencies' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); script = 'install_rocm_amd_sage.ps1' } -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot "install_rocm_amd_sage.ps1")
    }
    else {
        Write-ConsoleText -Key 'install_main_dependencies' -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot "install.ps1")
    }
}

function Get-SelectedRuntimeInstallFailureMessage {
    param (
        [string]$RuntimeName,
        [hashtable]$State
    )

    if ($RuntimeName -eq "blackwell" -and $State.BlackwellRuntimeMessage) {
        return Get-ConsoleText -Key 'dependency_install_failed_with_runtime' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.BlackwellRuntimeMessage }
    }
    if ($RuntimeName -in @("sageattention", "sageattention2", "sageattention-blackwell") -and $State.SageAttentionRuntimeMessage) {
        return Get-ConsoleText -Key 'dependency_install_failed_with_runtime' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.SageAttentionRuntimeMessage }
    }
    if ($RuntimeName -eq "intel-xpu" -and $State.IntelXpuRuntimeMessage) {
        return Get-ConsoleText -Key 'dependency_install_failed_with_runtime' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.IntelXpuRuntimeMessage }
    }
    if ($RuntimeName -eq "intel-xpu-sage" -and $State.IntelXpuSageRuntimeMessage) {
        return Get-ConsoleText -Key 'dependency_install_failed_with_runtime' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.IntelXpuSageRuntimeMessage }
    }
    if ($RuntimeName -eq "rocm-amd" -and $State.ROCmAmdRuntimeMessage) {
        return Get-ConsoleText -Key 'dependency_install_failed_with_runtime' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.ROCmAmdRuntimeMessage }
    }
    if ($RuntimeName -eq "rocm-amd-sage" -and $State.ROCmAmdSageRuntimeMessage) {
        return Get-ConsoleText -Key 'dependency_install_failed_with_runtime' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.ROCmAmdSageRuntimeMessage }
    }
    return Get-ConsoleText -Key 'dependency_install_failed'
}

function Write-SelectedRuntimeReadyNotice {
    param (
        [string]$RuntimeName,
        [hashtable]$State
    )

    if ($RuntimeName -eq "blackwell" -and $State.BlackwellRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_check_passed' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.BlackwellRuntimeMessage } -ForegroundColor 'Green'
    }
    elseif ($RuntimeName -in @("sageattention", "sageattention2", "sageattention-blackwell") -and $State.SageAttentionRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_check_passed' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.SageAttentionRuntimeMessage } -ForegroundColor 'Green'
    }
    elseif ($RuntimeName -eq "intel-xpu" -and $State.IntelXpuRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_check_passed' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.IntelXpuRuntimeMessage } -ForegroundColor 'Green'
    }
    elseif ($RuntimeName -eq "intel-xpu-sage" -and $State.IntelXpuSageRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_check_passed' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.IntelXpuSageRuntimeMessage } -ForegroundColor 'Green'
    }
    elseif ($RuntimeName -eq "rocm-amd" -and $State.ROCmAmdRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_check_passed' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.ROCmAmdRuntimeMessage } -ForegroundColor 'Green'
    }
    elseif ($RuntimeName -eq "rocm-amd-sage" -and $State.ROCmAmdSageRuntimeMessage) {
        Write-ConsoleText -Key 'runtime_check_passed' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $State.ROCmAmdSageRuntimeMessage } -ForegroundColor 'Green'
    }
}

function Get-MainPythonSelection {
    if ($preferBlackwellRuntime -and -not (Test-Path $blackwellPython)) {
        throw (New-MissingDedicatedRuntimeMessage -RuntimeName 'blackwell' -ExpectedPath $blackwellPython -PythonMinor '3.12' -RuntimeDirName 'python_blackwell' -RerunScript 'run_For_Only_Blackwell.bat')
    }

    if ($preferSageAttentionRuntime -and -not (Test-Path $sageAttentionPython)) {
        throw (New-MissingDedicatedRuntimeMessage -RuntimeName 'sageattention' -ExpectedPath $sageAttentionPython -PythonMinor '3.11' -RuntimeDirName $sageAttentionRuntimeDirName -RerunScript 'run_For_SageAttention_Experimental.bat')
    }

    if ($preferSageAttention2Runtime -and -not (Test-Path $sageAttention2Python)) {
        throw (New-MissingDedicatedRuntimeMessage -RuntimeName 'sageattention2' -ExpectedPath $sageAttention2Python -PythonMinor '3.12' -RuntimeDirName $sageAttention2RuntimeDirName -RerunScript 'run_For_SageAttention2_Experimental.bat')
    }

    if ($preferSageAttentionBlackwellRuntime -and -not (Test-Path $sageAttentionBlackwellPython)) {
        throw (New-MissingDedicatedRuntimeMessage -RuntimeName 'sageattention-blackwell' -ExpectedPath $sageAttentionBlackwellPython -PythonMinor '3.11' -RuntimeDirName $sageAttentionBlackwellRuntimeDirName -RerunScript 'run_For_Only_Blackwell_SageAttention_Experimental.bat')
    }

    if ($preferIntelXpuRuntime -and -not (Test-Path $intelXpuPython)) {
        throw (New-MissingDedicatedRuntimeMessage -RuntimeName 'intel-xpu' -ExpectedPath $intelXpuPython -PythonMinor '3.10/3.11' -RuntimeDirName $intelXpuRuntimeDirName -RerunScript 'run_For_Intel_XPU_Experimental.bat')
    }

    if ($preferIntelXpuSageRuntime -and -not (Test-Path $intelXpuSagePython)) {
        throw (New-MissingDedicatedRuntimeMessage -RuntimeName 'intel-xpu-sage' -ExpectedPath $intelXpuSagePython -PythonMinor '3.10/3.11' -RuntimeDirName $intelXpuSageRuntimeDirName -RerunScript 'run_For_Intel_XPU_SageAttention_Experimental.bat')
    }

    if ($preferRocmAmdRuntime -and -not (Test-Path $rocmAmdPython)) {
        throw (New-MissingDedicatedRuntimeMessage -RuntimeName 'rocm-amd' -ExpectedPath $rocmAmdPython -PythonMinor '3.12' -RuntimeDirName $rocmAmdRuntimeDirName -RerunScript 'run_For_AMD_ROCm_Experimental.bat')
    }

    if ($preferRocmAmdSageRuntime -and -not (Test-Path $rocmAmdSagePython)) {
        throw (New-MissingDedicatedRuntimeMessage -RuntimeName 'rocm-amd-sage' -ExpectedPath $rocmAmdSagePython -PythonMinor '3.12' -RuntimeDirName $rocmAmdSageRuntimeDirName -RerunScript 'run_For_AMD_ROCm_SageAttention_Experimental.bat')
    }

    if ($preferBlackwellRuntime -and (Test-Path $blackwellPython)) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'blackwell' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $blackwellPython)) {
            Write-ConsoleText -Key 'runtime_python_not_initialized' -Tokens @{ runtime_dir = 'python_blackwell' } -ForegroundColor 'Yellow'
            & (Join-Path $repoRoot 'setup_embeddable_python.bat') --auto python_blackwell
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $blackwellPython)) {
                throw (Get-ConsoleText -Key 'runtime_python_incomplete' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'blackwell' -Kind 'python') })
            }
        }
        return @{
            PythonExe = $blackwellPython
            DepsMarker = $blackwellDepsMarker
            Runtime = 'blackwell'
        }
    }

    if ($preferSageAttentionRuntime -and (Test-Path $sageAttentionPython)) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'sageattention' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $sageAttentionPython)) {
            Write-ConsoleText -Key 'runtime_python_not_initialized' -Tokens @{ runtime_dir = $sageAttentionRuntimeDirName } -ForegroundColor 'Yellow'
            & (Join-Path $repoRoot 'setup_embeddable_python.bat') --auto $sageAttentionRuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $sageAttentionPython)) {
                throw (Get-ConsoleText -Key 'runtime_python_incomplete' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'sageattention' -Kind 'python') })
            }
        }
        return @{
            PythonExe = $sageAttentionPython
            DepsMarker = $sageAttentionDepsMarker
            Runtime = 'sageattention'
        }
    }

    if ($preferSageAttention2Runtime -and (Test-Path $sageAttention2Python)) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'sageattention2' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $sageAttention2Python)) {
            Write-ConsoleText -Key 'runtime_python_not_initialized' -Tokens @{ runtime_dir = $sageAttention2RuntimeDirName } -ForegroundColor 'Yellow'
            & (Join-Path $repoRoot 'setup_embeddable_python.bat') --auto $sageAttention2RuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $sageAttention2Python)) {
                throw (Get-ConsoleText -Key 'runtime_python_incomplete' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'sageattention2' -Kind 'python') })
            }
        }
        return @{
            PythonExe = $sageAttention2Python
            DepsMarker = $sageAttention2DepsMarker
            Runtime = 'sageattention2'
        }
    }

    if ($preferSageAttentionBlackwellRuntime -and (Test-Path $sageAttentionBlackwellPython)) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'sageattention-blackwell' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $sageAttentionBlackwellPython)) {
            Write-ConsoleText -Key 'runtime_python_not_initialized' -Tokens @{ runtime_dir = $sageAttentionBlackwellRuntimeDirName } -ForegroundColor 'Yellow'
            & (Join-Path $repoRoot 'setup_embeddable_python.bat') --auto $sageAttentionBlackwellRuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $sageAttentionBlackwellPython)) {
                throw (Get-ConsoleText -Key 'runtime_python_incomplete' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'sageattention-blackwell' -Kind 'python') })
            }
        }
        return @{
            PythonExe = $sageAttentionBlackwellPython
            DepsMarker = $sageAttentionBlackwellDepsMarker
            Runtime = 'sageattention-blackwell'
        }
    }

    if ($preferIntelXpuRuntime -and (Test-Path $intelXpuPython)) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'intel-xpu' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $intelXpuPython)) {
            Write-ConsoleText -Key 'runtime_python_not_initialized' -Tokens @{ runtime_dir = $intelXpuRuntimeDirName } -ForegroundColor 'Yellow'
            & (Join-Path $repoRoot 'setup_embeddable_python.bat') --auto $intelXpuRuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $intelXpuPython)) {
                throw (Get-ConsoleText -Key 'runtime_python_incomplete' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'intel-xpu' -Kind 'python') })
            }
        }
        return @{
            PythonExe = $intelXpuPython
            DepsMarker = $intelXpuDepsMarker
            Runtime = 'intel-xpu'
        }
    }

    if ($preferIntelXpuSageRuntime -and (Test-Path $intelXpuSagePython)) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'intel-xpu-sage' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $intelXpuSagePython)) {
            Write-ConsoleText -Key 'runtime_python_not_initialized' -Tokens @{ runtime_dir = $intelXpuSageRuntimeDirName } -ForegroundColor 'Yellow'
            & (Join-Path $repoRoot 'setup_embeddable_python.bat') --auto $intelXpuSageRuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $intelXpuSagePython)) {
                throw (Get-ConsoleText -Key 'runtime_python_incomplete' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'intel-xpu-sage' -Kind 'python') })
            }
        }
        return @{
            PythonExe = $intelXpuSagePython
            DepsMarker = $intelXpuSageDepsMarker
            Runtime = 'intel-xpu-sage'
        }
    }

    if ($preferRocmAmdRuntime -and (Test-Path $rocmAmdPython)) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'rocm-amd' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $rocmAmdPython)) {
            Write-ConsoleText -Key 'runtime_python_not_initialized' -Tokens @{ runtime_dir = $rocmAmdRuntimeDirName } -ForegroundColor 'Yellow'
            & (Join-Path $repoRoot 'setup_embeddable_python.bat') --auto $rocmAmdRuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $rocmAmdPython)) {
                throw (Get-ConsoleText -Key 'runtime_python_incomplete' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'rocm-amd' -Kind 'python') })
            }
        }
        return @{
            PythonExe = $rocmAmdPython
            DepsMarker = $rocmAmdDepsMarker
            Runtime = 'rocm-amd'
        }
    }

    if ($preferRocmAmdSageRuntime -and (Test-Path $rocmAmdSagePython)) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'rocm-amd-sage' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $rocmAmdSagePython)) {
            Write-ConsoleText -Key 'runtime_python_not_initialized' -Tokens @{ runtime_dir = $rocmAmdSageRuntimeDirName } -ForegroundColor 'Yellow'
            & (Join-Path $repoRoot 'setup_embeddable_python.bat') --auto $rocmAmdSageRuntimeDirName
            if ($LASTEXITCODE -ne 0 -or -not (Test-PipReady -PythonExe $rocmAmdSagePython)) {
                throw (Get-ConsoleText -Key 'runtime_python_incomplete' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'rocm-amd-sage' -Kind 'python') })
            }
        }
        return @{
            PythonExe = $rocmAmdSagePython
            DepsMarker = $rocmAmdSageDepsMarker
            Runtime = 'rocm-amd-sage'
        }
    }

    if (Test-Path $portablePython) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'portable' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $portablePython)) {
            throw (Get-ConsoleText -Key 'portable_python_incomplete')
        }
        return @{
            PythonExe = $portablePython
            DepsMarker = $portableDepsMarker
            Runtime = 'portable'
        }
    }

    if (Test-Path $venvPython) {
        Write-ConsoleText -Key 'using_runtime_python' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName 'venv' -Kind 'python') } -ForegroundColor 'Green'
        if (-not (Test-PipReady -PythonExe $venvPython)) {
            throw (Get-ConsoleText -Key 'venv_python_incomplete')
        }
        return @{
            PythonExe = $venvPython
            DepsMarker = $venvDepsMarker
            Runtime = 'venv'
        }
    }

    if ($allowExternalPython) {
        Write-ConsoleText -Key 'bootstrap_project_local_python' -ForegroundColor 'Yellow'
        & (Join-Path $repoRoot 'install.ps1')
        if ($LASTEXITCODE -ne 0) {
            throw (Get-ConsoleText -Key 'bootstrap_project_local_python_failed')
        }

        if (Test-Path $portablePython) {
            return @{
                PythonExe = $portablePython
                DepsMarker = $portableDepsMarker
                Runtime = 'portable'
            }
        }

        if (Test-Path $venvPython) {
            return @{
                PythonExe = $venvPython
                DepsMarker = $venvDepsMarker
                Runtime = 'venv'
            }
        }

        throw (Get-ConsoleText -Key 'bootstrap_project_local_python_missing_after_install')
    }

    throw (Get-ConsoleText -Key 'no_project_local_python_found' -Tokens @{ portable_path = $portablePython; venv_path = $venvPython })
}

$blackwellExpectedPackages = Get-BlackwellExpectedPackageVersions -Profile $blackwellPreferredProfile
$sageAttentionExpectedPackages = Get-SageAttentionExpectedPackageVersions -Profile $sageAttentionPreferredProfile
$sageAttention2ExpectedPackages = Get-SageAttentionExpectedPackageVersions -Profile $sageAttention2PreferredProfile
$sageAttentionBlackwellExpectedPackages = Get-SageAttentionExpectedPackageVersions -Profile $sageAttentionBlackwellPreferredProfile
$intelXpuExpectedPackages = Get-IntelXpuExpectedPackageVersions
$intelXpuSageExpectedPackages = Get-IntelXpuSageExpectedPackageVersions
$rocmAmdExpectedPackages = Get-ROCmAmdExpectedPackageVersions
$rocmAmdSageExpectedPackages = Get-ROCmAmdSageExpectedPackageVersions
$mainPython = Get-MainPythonSelection
$pythonExe = $mainPython.PythonExe
$depsMarker = $mainPython.DepsMarker
$runtimeName = $mainPython.Runtime
if ($runtimeName -eq "rocm-amd") {
    if (-not $Env:MIKAZUKI_STARTUP_ATTENTION_POLICY) {
        $Env:MIKAZUKI_STARTUP_ATTENTION_POLICY = "runtime_guarded"
    }
    if (-not $Env:MIKAZUKI_ALLOW_AMD_ROCM_SAGEATTN) {
        $Env:MIKAZUKI_ALLOW_AMD_ROCM_SAGEATTN = "1"
    }
    if (-not $Env:MIKAZUKI_ROCM_SDPA_SLICE_TRIGGER_GB) {
        $Env:MIKAZUKI_ROCM_SDPA_SLICE_TRIGGER_GB = "0.75"
    }
    if (-not $Env:MIKAZUKI_ROCM_SDPA_SLICE_GB) {
        $Env:MIKAZUKI_ROCM_SDPA_SLICE_GB = "0.35"
    }
    Write-ROCmAmdGraphicsDriverNotice -MinimumVersion $rocmAmdRecommendedGraphicsDriverVersion
    Write-ROCmAmdWindowsPrereqNotice
}
elseif ($runtimeName -eq "rocm-amd-sage") {
    if (-not $Env:MIKAZUKI_STARTUP_ATTENTION_POLICY) {
        $Env:MIKAZUKI_STARTUP_ATTENTION_POLICY = "runtime_guarded"
    }
    if (-not $Env:MIKAZUKI_ALLOW_AMD_ROCM_SAGEATTN) {
        $Env:MIKAZUKI_ALLOW_AMD_ROCM_SAGEATTN = "1"
    }
    if (-not $Env:MIKAZUKI_ROCM_SDPA_SLICE_TRIGGER_GB) {
        $Env:MIKAZUKI_ROCM_SDPA_SLICE_TRIGGER_GB = "0.75"
    }
    if (-not $Env:MIKAZUKI_ROCM_SDPA_SLICE_GB) {
        $Env:MIKAZUKI_ROCM_SDPA_SLICE_GB = "0.35"
    }
    $Env:MIKAZUKI_ROCM_AMD_SAGE_STARTUP = "1"
    Write-ROCmAmdGraphicsDriverNotice -MinimumVersion $rocmAmdRecommendedGraphicsDriverVersion
    Write-ROCmAmdWindowsPrereqNotice
}
elseif ($runtimeName -eq "intel-xpu") {
    if (-not $Env:MIKAZUKI_STARTUP_ATTENTION_POLICY) {
        $Env:MIKAZUKI_STARTUP_ATTENTION_POLICY = "runtime_guarded"
    }
    if (-not $Env:MIKAZUKI_ALLOW_INTEL_XPU_SAGEATTN) {
        $Env:MIKAZUKI_ALLOW_INTEL_XPU_SAGEATTN = "1"
    }
    if (-not $Env:IPEX_SDPA_SLICE_TRIGGER_RATE) {
        $Env:IPEX_SDPA_SLICE_TRIGGER_RATE = "0.75"
    }
    if (-not $Env:IPEX_ATTENTION_SLICE_RATE) {
        $Env:IPEX_ATTENTION_SLICE_RATE = "0.4"
    }
    Write-IntelXpuWindowsPrereqNotice
}
elseif ($runtimeName -eq "intel-xpu-sage") {
    if (-not $Env:MIKAZUKI_STARTUP_ATTENTION_POLICY) {
        $Env:MIKAZUKI_STARTUP_ATTENTION_POLICY = "runtime_guarded"
    }
    if (-not $Env:MIKAZUKI_ALLOW_INTEL_XPU_SAGEATTN) {
        $Env:MIKAZUKI_ALLOW_INTEL_XPU_SAGEATTN = "1"
    }
    Write-IntelXpuWindowsPrereqNotice
}
Set-DedicatedRuntimeCaches -RuntimeName $runtimeName -PythonExe $pythonExe
$selectedMainRuntimeModules = Get-MainRuntimeModulesForRuntime -RuntimeName $runtimeName
$runtimeState = Get-SelectedRuntimeValidationState `
    -PythonExe $pythonExe `
    -RuntimeName $runtimeName `
    -MainModules $selectedMainRuntimeModules `
    -BlackwellExpected $blackwellExpectedPackages `
    -SageAttentionExpected $sageAttentionExpectedPackages `
    -SageAttention2Expected $sageAttention2ExpectedPackages `
    -SageAttentionBlackwellExpected $sageAttentionBlackwellExpectedPackages `
    -IntelXpuExpected $intelXpuExpectedPackages `
    -IntelXpuSageExpected $intelXpuSageExpectedPackages `
    -ROCmAmdExpected $rocmAmdExpectedPackages `
    -ROCmAmdSageExpected $rocmAmdSageExpectedPackages
Write-SelectedRuntimeNotReadyNotice -RuntimeName $runtimeName -State $runtimeState
if (-not (Test-SelectedRuntimeBootstrapReady -DepsMarker $depsMarker -State $runtimeState)) {
    Install-SelectedRuntimeDependencies `
        -RuntimeName $runtimeName `
        -BlackwellProfile $blackwellPreferredProfile `
        -SageAttentionProfile $sageAttentionPreferredProfile `
        -SageAttentionBlackwellProfile $sageAttentionBlackwellPreferredProfile
    $mainPython = Get-MainPythonSelection
    $pythonExe = $mainPython.PythonExe
    $depsMarker = $mainPython.DepsMarker
    $runtimeName = $mainPython.Runtime
    Set-DedicatedRuntimeCaches -RuntimeName $runtimeName -PythonExe $pythonExe
    $selectedMainRuntimeModules = Get-MainRuntimeModulesForRuntime -RuntimeName $runtimeName
    $runtimeState = Get-SelectedRuntimeValidationState `
        -PythonExe $pythonExe `
        -RuntimeName $runtimeName `
        -MainModules $selectedMainRuntimeModules `
        -BlackwellExpected $blackwellExpectedPackages `
        -SageAttentionExpected $sageAttentionExpectedPackages `
        -SageAttention2Expected $sageAttention2ExpectedPackages `
        -SageAttentionBlackwellExpected $sageAttentionBlackwellExpectedPackages `
        -IntelXpuExpected $intelXpuExpectedPackages `
        -IntelXpuSageExpected $intelXpuSageExpectedPackages `
        -ROCmAmdExpected $rocmAmdExpectedPackages `
        -ROCmAmdSageExpected $rocmAmdSageExpectedPackages
    if ($LASTEXITCODE -ne 0 -or -not (Test-SelectedRuntimeBootstrapReady -DepsMarker $depsMarker -State $runtimeState)) {
        throw (Get-SelectedRuntimeInstallFailureMessage -RuntimeName $runtimeName -State $runtimeState)
    }
}
Write-SelectedRuntimeReadyNotice -RuntimeName $runtimeName -State $runtimeState

if ($Env:MIKAZUKI_BLACKWELL_STARTUP -eq "1") {
    $blackwellPatchScript = Join-Path $repoRoot "mikazuki\scripts\patch_xformers_blackwell.py"
    if (Test-Path $blackwellPatchScript) {
        Write-ConsoleText -Key 'runtime_startup_blackwell_patch_check' -ForegroundColor 'Yellow'
        & $pythonExe $blackwellPatchScript
        if ($LASTEXITCODE -ne 0) {
            Write-ConsoleText -Key 'runtime_startup_blackwell_patch_warning' -ForegroundColor 'Yellow'
        }
    }
}

if ($Env:MIKAZUKI_SAGEATTENTION_STARTUP -eq "1") {
    if ($Env:MIKAZUKI_SAGEATTENTION2_STARTUP -eq "1" -or $runtimeName -eq "sageattention2") {
        Write-ConsoleText -Key 'startup_mode_sageattention2' -ForegroundColor 'Yellow'
    }
    elseif ($runtimeName -eq "sageattention-blackwell") {
        Write-ConsoleText -Key 'startup_mode_blackwell_sageattention' -ForegroundColor 'Yellow'
    }
    else {
        Write-ConsoleText -Key 'startup_mode_sageattention' -ForegroundColor 'Yellow'
    }
}

if ($Env:MIKAZUKI_ROCM_AMD_STARTUP -eq "1" -or $runtimeName -eq "rocm-amd") {
    Write-Host -ForegroundColor Yellow "AMD ROCm startup mode enabled. This runtime prepares the dedicated ROCm environment and keeps the AMD experimental training route isolated from the main runtime."
    Write-Host -ForegroundColor Yellow "ROCm attention guard: startup policy=$($Env:MIKAZUKI_STARTUP_ATTENTION_POLICY); slice trigger=$($Env:MIKAZUKI_ROCM_SDPA_SLICE_TRIGGER_GB)GB; slice target=$($Env:MIKAZUKI_ROCM_SDPA_SLICE_GB)GB."
}

if ($Env:MIKAZUKI_INTEL_XPU_STARTUP -eq "1" -or $runtimeName -eq "intel-xpu") {
    switch (Get-ConsoleLanguage) {
        'zh' {
            Write-Host -ForegroundColor Yellow "已启用 Intel XPU 启动模式。这个运行时只负责准备 Intel XPU 专用环境，并保持 Intel 实验训练路线与主运行时隔离。"
            Write-Host -ForegroundColor Yellow "IPEX attention slicing：trigger=$($Env:IPEX_SDPA_SLICE_TRIGGER_RATE)，slice=$($Env:IPEX_ATTENTION_SLICE_RATE)。"
        }
        'ja' {
            Write-Host -ForegroundColor Yellow "Intel XPU 起動モードが有効です。このランタイムは Intel XPU 専用環境の準備のみを行い、Intel 実験学習ルートをメインランタイムから分離します。"
            Write-Host -ForegroundColor Yellow "IPEX attention slicing: trigger=$($Env:IPEX_SDPA_SLICE_TRIGGER_RATE), slice=$($Env:IPEX_ATTENTION_SLICE_RATE)."
        }
        default {
            Write-Host -ForegroundColor Yellow "Intel XPU startup mode enabled. This runtime prepares the dedicated Intel XPU environment and keeps the Intel experimental training route isolated from the main runtime."
            Write-Host -ForegroundColor Yellow "IPEX attention slicing: trigger=$($Env:IPEX_SDPA_SLICE_TRIGGER_RATE), slice=$($Env:IPEX_ATTENTION_SLICE_RATE)."
        }
    }
}

if ($Env:MIKAZUKI_INTEL_XPU_SAGE_STARTUP -eq "1" -or $runtimeName -eq "intel-xpu-sage") {
    switch (Get-ConsoleLanguage) {
        'zh' {
            Write-Host -ForegroundColor Yellow "已启用 Intel XPU Sage 启动模式。这个运行时会把 Intel Sage 实验链路隔离到单独的 python_xpu_intel_sage 环境，不影响现有 Intel 主线。"
            Write-Host -ForegroundColor Yellow "注意：这条路线会优先验证 Triton + SageAttention 1.0.6 的可导入性，不保证与现有 IPEX 稳定线兼容。"
        }
        'ja' {
            Write-Host -ForegroundColor Yellow "Intel XPU Sage 起動モードが有効です。このランタイムは Intel Sage 実験ルートを専用の python_xpu_intel_sage 環境へ分離し、既存の Intel 安定ルートには影響しません。"
            Write-Host -ForegroundColor Yellow "注意: このルートは Triton + SageAttention 1.0.6 の読み込み検証を優先します。既存の IPEX 安定ルートとの互換性は保証されません。"
        }
        default {
            Write-Host -ForegroundColor Yellow "Intel XPU Sage startup mode enabled. This runtime isolates the Intel Sage experiment in python_xpu_intel_sage and leaves the current Intel stable runtime untouched."
            Write-Host -ForegroundColor Yellow "Note: this route prioritizes Triton + SageAttention 1.0.6 importability checks and does not guarantee compatibility with the existing IPEX-based stable path."
        }
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
        if ($runtimeName -in @("blackwell", "sageattention", "sageattention2", "sageattention-blackwell", "intel-xpu", "intel-xpu-sage", "rocm-amd")) {
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
                throw (Get-ConsoleText -Key 'tag_editor_python_incomplete')
            }

            Write-ConsoleText -Key 'tag_editor_dependencies_installing' -ForegroundColor 'Yellow'
            & (Join-Path $repoRoot "install_tageditor.ps1")
            $tagEditorModulesReady = Test-ModulesReady -PythonExe $tagEditorPython -Modules @("gradio", "transformers", "timm", "print_color")
            $tagEditorVersionsReady = Test-PackageConstraints -PythonExe $tagEditorPython -Constraints $tagEditorPackageConstraints
            $tagEditorMarkerReady = (-not $tagEditorMarker) -or (Test-Path $tagEditorMarker)
            if ($LASTEXITCODE -ne 0 -or -not $tagEditorMarkerReady -or -not $tagEditorModulesReady -or -not $tagEditorVersionsReady) {
                throw (Get-ConsoleText -Key 'tag_editor_dependency_install_failed')
            }
        }
    }
}

$Env:MIKAZUKI_SKIP_REQUIREMENTS_VALIDATION = "1"
Set-Location $repoRoot
try {
    & $pythonExe "gui.py" @args
}
finally {
    if ($script:LaunchTranscriptPath) {
        Write-Host -ForegroundColor DarkGray "Launcher log saved to / 启动日志已保存到: $($script:LaunchTranscriptPath)"
    }
    Stop-LaunchTranscript
}
