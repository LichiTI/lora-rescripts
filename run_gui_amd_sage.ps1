$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeScript = Join-Path $repoRoot "run_gui_runtime.ps1"

if (-not (Test-Path $runtimeScript)) {
    throw "run_gui_runtime.ps1 was not found next to run_gui_amd_sage.ps1."
}

& $runtimeScript -PreferredRuntime "rocm-amd-sage" @args
exit $LASTEXITCODE
