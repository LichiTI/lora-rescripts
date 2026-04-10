param(
    [switch]$Visible,
    [string[]]$RuntimeNames
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
. (Join-Path $PSScriptRoot "runtime_paths.ps1")

function Set-PathHiddenState {
    param(
        [string]$Path,
        [bool]$Hidden = $true
    )

    $item = Get-Item -LiteralPath $Path -Force
    $attributesValue = [int]$item.Attributes
    $hiddenFlag = [int][IO.FileAttributes]::Hidden
    if ($Hidden) {
        $attributesValue = $attributesValue -bor $hiddenFlag
    }
    else {
        $attributesValue = $attributesValue -band (-bnot $hiddenFlag)
    }

    [System.IO.File]::SetAttributes($item.FullName, [IO.FileAttributes]$attributesValue)
}

function Add-UniqueAlias {
    param(
        [System.Collections.Generic.HashSet[string]]$AliasSet,
        [string]$Alias
    )

    if ([string]::IsNullOrWhiteSpace($Alias)) {
        return
    }

    [void]$AliasSet.Add($Alias)
}

$aliasSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
if ($RuntimeNames -and $RuntimeNames.Count -gt 0) {
    foreach ($runtimeName in $RuntimeNames) {
        foreach ($alias in (Get-RuntimeDirectoryNames -RuntimeName $runtimeName)) {
            Add-UniqueAlias -AliasSet $aliasSet -Alias $alias
        }
    }
}
else {
    foreach ($entry in $script:RuntimeDirectoryAliases.GetEnumerator()) {
        foreach ($alias in @($entry.Value)) {
            Add-UniqueAlias -AliasSet $aliasSet -Alias $alias
        }
    }
}

$hideLinks = -not $Visible
$stateLabel = if ($hideLinks) { "hidden" } else { "visible" }
Write-Host -ForegroundColor Cyan "Root runtime junction visibility: $stateLabel"

$handled = 0
foreach ($alias in @($aliasSet | Sort-Object)) {
    $path = Join-Path $repoRoot $alias
    if (-not (Test-Path $path)) {
        continue
    }

    $item = Get-Item -LiteralPath $path -Force
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        Write-Host -ForegroundColor DarkGray "skip non-junction: $alias"
        continue
    }

    Set-PathHiddenState -Path $item.FullName -Hidden:$hideLinks
    Write-Host -ForegroundColor Green "[$stateLabel] $alias -> $($item.Target)"
    $handled += 1
}

if ($handled -eq 0) {
    Write-Host -ForegroundColor Yellow "No root runtime junctions matched."
}
