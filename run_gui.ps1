$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$coreScript = Join-Path $repoRoot "run_gui_core.ps1"

if (-not (Test-Path $coreScript)) {
    throw "run_gui_core.ps1 was not found next to run_gui.ps1."
}

& $coreScript @args
exit $LASTEXITCODE
