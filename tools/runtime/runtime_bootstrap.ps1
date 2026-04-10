$moduleFiles = @(
    'runtime_bootstrap.validation.ps1',
    'runtime_bootstrap.actions.ps1'
)

foreach ($moduleFile in $moduleFiles) {
    $modulePath = Join-Path $PSScriptRoot $moduleFile
    if (-not (Test-Path $modulePath)) {
        throw "Runtime bootstrap helper module not found: $modulePath"
    }
    . $modulePath
}
