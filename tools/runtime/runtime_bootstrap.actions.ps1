function Get-SelectedRuntimeStateProjection {
    param (
        [string]$RuntimeName,
        [hashtable]$State
    )

    switch ($RuntimeName) {
        "flashattention" {
            return [pscustomobject]@{
                Ready = [bool]$State.FlashAttentionRuntimeReady
                Message = [string]$State.FlashAttentionRuntimeMessage
            }
        }
        "blackwell" {
            return [pscustomobject]@{
                Ready = [bool]$State.BlackwellXformersReady
                Message = [string]$State.BlackwellRuntimeMessage
            }
        }
        "sageattention" {
            return [pscustomobject]@{
                Ready = [bool]$State.SageAttentionRuntimeReady
                Message = [string]$State.SageAttentionRuntimeMessage
            }
        }
        "intel-xpu" {
            return [pscustomobject]@{
                Ready = [bool]$State.IntelXpuRuntimeReady
                Message = [string]$State.IntelXpuRuntimeMessage
            }
        }
        "intel-xpu-sage" {
            return [pscustomobject]@{
                Ready = [bool]$State.IntelXpuSageRuntimeReady
                Message = [string]$State.IntelXpuSageRuntimeMessage
            }
        }
        "rocm-amd" {
            return [pscustomobject]@{
                Ready = [bool]$State.ROCmAmdRuntimeReady
                Message = [string]$State.ROCmAmdRuntimeMessage
            }
        }
        "rocm-amd-sage" {
            return [pscustomobject]@{
                Ready = [bool]$State.ROCmAmdSageRuntimeReady
                Message = [string]$State.ROCmAmdSageRuntimeMessage
            }
        }
    }

    return $null
}

function Get-SelectedRuntimeInstallPlan {
    param (
        [string]$RuntimeName,
        [string]$BlackwellProfile,
        [string]$SageAttentionProfile
    )

    switch ($RuntimeName) {
        "flashattention" {
            return [pscustomobject]@{
                UsesDedicatedRuntimeNotice = $true
                Script = 'install_flashattention.ps1'
                Arguments = @()
            }
        }
        "blackwell" {
            return [pscustomobject]@{
                UsesDedicatedRuntimeNotice = $true
                Script = 'install_blackwell.ps1'
                Arguments = @('-TorchChannel', $BlackwellProfile)
            }
        }
        "sageattention" {
            return [pscustomobject]@{
                UsesDedicatedRuntimeNotice = $true
                Script = 'install_sageattention.ps1'
                Arguments = @('-Profile', $SageAttentionProfile)
            }
        }
        "intel-xpu" {
            return [pscustomobject]@{
                UsesDedicatedRuntimeNotice = $true
                Script = 'install_intel_xpu.ps1'
                Arguments = @()
            }
        }
        "intel-xpu-sage" {
            return [pscustomobject]@{
                UsesDedicatedRuntimeNotice = $true
                Script = 'install_intel_xpu_sage.ps1'
                Arguments = @()
            }
        }
        "rocm-amd" {
            return [pscustomobject]@{
                UsesDedicatedRuntimeNotice = $true
                Script = 'install_rocm_amd.ps1'
                Arguments = @()
            }
        }
        "rocm-amd-sage" {
            return [pscustomobject]@{
                UsesDedicatedRuntimeNotice = $true
                Script = 'install_rocm_amd_sage.ps1'
                Arguments = @()
            }
        }
        default {
            return [pscustomobject]@{
                UsesDedicatedRuntimeNotice = $false
                Script = 'install.ps1'
                Arguments = @()
            }
        }
    }
}

function Write-SelectedRuntimeNotReadyNotice {
    param (
        [string]$RuntimeName,
        [hashtable]$State
    )

    $projection = Get-SelectedRuntimeStateProjection -RuntimeName $RuntimeName -State $State
    if (-not $projection -or $projection.Ready -or [string]::IsNullOrWhiteSpace($projection.Message)) {
        return
    }

    Write-ConsoleText -Key 'runtime_not_ready' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $projection.Message } -ForegroundColor 'Yellow'
}

function Install-SelectedRuntimeDependencies {
    param (
        [string]$RuntimeName,
        [string]$BlackwellProfile,
        [string]$SageAttentionProfile
    )

    $plan = Get-SelectedRuntimeInstallPlan `
        -RuntimeName $RuntimeName `
        -BlackwellProfile $BlackwellProfile `
        -SageAttentionProfile $SageAttentionProfile

    if ($plan.UsesDedicatedRuntimeNotice) {
        Write-ConsoleText -Key 'install_runtime_dependencies' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); script = $plan.Script } -ForegroundColor 'Yellow'
    }
    else {
        Write-ConsoleText -Key 'install_main_dependencies' -ForegroundColor 'Yellow'
    }

    & (Join-Path $repoRoot $plan.Script) @($plan.Arguments)
}

function Get-SelectedRuntimeInstallFailureMessage {
    param (
        [string]$RuntimeName,
        [hashtable]$State
    )

    $projection = Get-SelectedRuntimeStateProjection -RuntimeName $RuntimeName -State $State
    if ($projection -and -not [string]::IsNullOrWhiteSpace($projection.Message)) {
        return Get-ConsoleText -Key 'dependency_install_failed_with_runtime' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $projection.Message }
    }

    return Get-ConsoleText -Key 'dependency_install_failed'
}

function Write-SelectedRuntimeReadyNotice {
    param (
        [string]$RuntimeName,
        [hashtable]$State
    )

    $projection = Get-SelectedRuntimeStateProjection -RuntimeName $RuntimeName -State $State
    if (-not $projection -or [string]::IsNullOrWhiteSpace($projection.Message)) {
        return
    }

    Write-ConsoleText -Key 'runtime_check_passed' -Tokens @{ runtime = (Get-ConsoleRuntimeDisplayName -RuntimeName $RuntimeName); detail = $projection.Message } -ForegroundColor 'Green'
}
