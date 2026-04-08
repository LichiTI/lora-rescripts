$script:RuntimeDirectoryAliases = @{
    "portable" = @("python")
    "flashattention" = @("python-flashattention", "python_flashattention")
    "blackwell" = @("python_blackwell")
    "intel-xpu" = @("python_xpu_intel")
    "intel-xpu-sage" = @("python_xpu_intel_sage")
    "rocm-amd" = @("python_rocm_amd")
    "rocm-amd-sage" = @("python_rocm_amd_sage")
    "sagebwd-nvidia" = @("python_sagebwd_nvidia", "python-sagebwd-nvidia")
    "sageattention" = @("python-sageattention", "python_sageattention")
    "tageditor" = @("python_tageditor")
    "venv" = @("venv")
    "venv-tageditor" = @("venv-tageditor")
}

function Get-RuntimeDirectoryNames {
    param(
        [string]$RuntimeName
    )

    $normalized = ([string]$RuntimeName).Trim().ToLowerInvariant()
    if ($script:RuntimeDirectoryAliases.ContainsKey($normalized)) {
        return @($script:RuntimeDirectoryAliases[$normalized])
    }

    if ([string]::IsNullOrWhiteSpace($RuntimeName)) {
        return @()
    }

    return @($RuntimeName)
}

function Get-RuntimeDirectoryCandidates {
    param(
        [string]$RepoRoot,
        [string]$RuntimeName,
        [string[]]$DirectoryNames
    )

    $repoRootPath = [System.IO.Path]::GetFullPath($RepoRoot)
    $envRoot = Join-Path $repoRootPath "env"
    $resolvedNames = @($DirectoryNames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if (-not $resolvedNames -or $resolvedNames.Count -eq 0) {
        $resolvedNames = Get-RuntimeDirectoryNames -RuntimeName $RuntimeName
    }

    $candidates = New-Object System.Collections.Generic.List[object]
    foreach ($dirName in $resolvedNames) {
        $candidates.Add([pscustomobject]@{
                RuntimeName = $RuntimeName
                DirectoryName = $dirName
                Scope = "env"
                DirectoryPath = Join-Path $envRoot $dirName
            }) | Out-Null
    }
    foreach ($dirName in $resolvedNames) {
        $candidates.Add([pscustomobject]@{
                RuntimeName = $RuntimeName
                DirectoryName = $dirName
                Scope = "root"
                DirectoryPath = Join-Path $repoRootPath $dirName
            }) | Out-Null
    }

    return $candidates
}

function Resolve-RuntimeDirectoryInfo {
    param(
        [string]$RepoRoot,
        [string]$RuntimeName,
        [string[]]$DirectoryNames,
        [string]$PreferredDirectoryName
    )

    $repoRootPath = [System.IO.Path]::GetFullPath($RepoRoot)
    $envRoot = Join-Path $repoRootPath "env"
    $resolvedNames = @($DirectoryNames | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if (-not $resolvedNames -or $resolvedNames.Count -eq 0) {
        $resolvedNames = Get-RuntimeDirectoryNames -RuntimeName $RuntimeName
    }
    if (-not $resolvedNames -or $resolvedNames.Count -eq 0) {
        throw "No runtime directory names were provided for '$RuntimeName'."
    }

    if ([string]::IsNullOrWhiteSpace($PreferredDirectoryName)) {
        $PreferredDirectoryName = $resolvedNames[0]
    }

    foreach ($candidate in (Get-RuntimeDirectoryCandidates -RepoRoot $repoRootPath -RuntimeName $RuntimeName -DirectoryNames $resolvedNames)) {
        if (Test-Path $candidate.DirectoryPath) {
            return [pscustomobject]@{
                RuntimeName = $RuntimeName
                DirectoryName = $candidate.DirectoryName
                DirectoryPath = $candidate.DirectoryPath
                Scope = $candidate.Scope
                Exists = $true
            }
        }
    }

    $preferEnv = Test-Path $envRoot
    $selectedScope = if ($preferEnv) { "env" } else { "root" }
    $selectedBase = if ($preferEnv) { $envRoot } else { $repoRootPath }

    return [pscustomobject]@{
        RuntimeName = $RuntimeName
        DirectoryName = $PreferredDirectoryName
        DirectoryPath = Join-Path $selectedBase $PreferredDirectoryName
        Scope = $selectedScope
        Exists = $false
    }
}

function Get-RuntimeFileCandidates {
    param(
        [string]$RepoRoot,
        [string]$RuntimeName,
        [string[]]$DirectoryNames,
        [string]$RelativeFilePath
    )

    foreach ($candidate in (Get-RuntimeDirectoryCandidates -RepoRoot $RepoRoot -RuntimeName $RuntimeName -DirectoryNames $DirectoryNames)) {
        [pscustomobject]@{
            RuntimeName = $candidate.RuntimeName
            DirectoryName = $candidate.DirectoryName
            Scope = $candidate.Scope
            Path = Join-Path $candidate.DirectoryPath $RelativeFilePath
        }
    }
}
