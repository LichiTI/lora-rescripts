$moduleFiles = @(
    'experimental_runtime.common.ps1',
    'experimental_runtime.amd.ps1',
    'experimental_runtime.intel.ps1'
)

foreach ($moduleFile in $moduleFiles) {
    $modulePath = Join-Path $PSScriptRoot $moduleFile
    if (-not (Test-Path $modulePath)) {
        throw "Runtime helper module not found: $modulePath"
    }
    . $modulePath
}
