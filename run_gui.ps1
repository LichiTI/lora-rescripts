$Env:HF_HOME = "huggingface"
$Env:PYTHONUTF8 = "1"
$Env:PIP_DISABLE_PIP_VERSION_CHECK = "1"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$portablePython = Join-Path $repoRoot "python\python.exe"
$venvPython = Join-Path $repoRoot "venv\Scripts\python.exe"
$portableDepsMarker = Join-Path $repoRoot "python\.deps_installed"
$venvDepsMarker = Join-Path $repoRoot "venv\.deps_installed"
$portableTagEditorPython = Join-Path $repoRoot "python_tageditor\python.exe"
$venvTagEditorPython = Join-Path $repoRoot "venv-tageditor\Scripts\python.exe"
$allowExternalPython = $Env:MIKAZUKI_ALLOW_SYSTEM_PYTHON -eq "1"

function Test-PipReady {
    param (
        [string]$PythonExe
    )

    & $PythonExe -m pip --version 1>$null 2>$null
    return $LASTEXITCODE -eq 0
}

function Test-ModulesReady {
    param (
        [string]$PythonExe,
        [string[]]$Modules
    )

    if (-not $Modules -or $Modules.Count -eq 0) {
        return $true
    }

    & $PythonExe -c "import importlib.util, sys; missing=[m for m in sys.argv[1:] if importlib.util.find_spec(m) is None]; raise SystemExit(1 if missing else 0)" @Modules 1>$null 2>$null
    return $LASTEXITCODE -eq 0
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

    & $PythonExe -c $script @pairs 1>$null 2>$null
    return $LASTEXITCODE -eq 0
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

function Get-MainPythonSelection {
    if (Test-Path $portablePython) {
        Write-Host -ForegroundColor Green "Using portable Python..."
        if (-not (Test-PipReady -PythonExe $portablePython)) {
            throw "Portable Python is incomplete: pip is not available. Repair or replace the bundled python folder first."
        }
        return @{
            PythonExe = $portablePython
            DepsMarker = $portableDepsMarker
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
            }
        }

        if (Test-Path $venvPython) {
            return @{
                PythonExe = $venvPython
                DepsMarker = $venvDepsMarker
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

$mainPython = Get-MainPythonSelection
$pythonExe = $mainPython.PythonExe
$depsMarker = $mainPython.DepsMarker
$mainModulesReady = Test-ModulesReady -PythonExe $pythonExe -Modules @("accelerate", "torch", "fastapi", "toml")
if (-not (Test-Path $depsMarker) -or -not $mainModulesReady) {
    Write-Host -ForegroundColor Yellow "Dependencies are not installed yet. Running install.ps1..."
    & (Join-Path $repoRoot "install.ps1")
    $mainPython = Get-MainPythonSelection
    $pythonExe = $mainPython.PythonExe
    $depsMarker = $mainPython.DepsMarker
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $depsMarker) -or -not (Test-ModulesReady -PythonExe $pythonExe -Modules @("accelerate", "torch", "fastapi", "toml"))) {
        throw "Dependency installation failed."
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
        $mainPythonVersion = Get-PythonMinorVersion -PythonExe $pythonExe
        if ($mainPythonVersion -and $mainPythonVersion -ne "3.13") {
            $tagEditorPython = $pythonExe
            if (Test-Path $portablePython) {
                $tagEditorMarker = Join-Path $repoRoot "python\.tageditor_installed"
            }
            elseif (Test-Path $venvPython) {
                $tagEditorMarker = Join-Path $repoRoot "venv\.tageditor_installed"
            }
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

Set-Location $repoRoot
& $pythonExe "gui.py" @args
