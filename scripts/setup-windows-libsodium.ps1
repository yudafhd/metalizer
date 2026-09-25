# Run this once in the same PowerShell session before building the Windows app.
$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
    throw 'This setup is only for Windows MSVC builds.'
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$defaultVcpkgRoot = Join-Path $projectRoot 'src-tauri\target\vcpkg'
$vcpkgRoot = if ($env:VCPKG_ROOT) { $env:VCPKG_ROOT } else { $defaultVcpkgRoot }

if (-not (Test-Path -LiteralPath $vcpkgRoot)) {
    git clone --depth 1 https://github.com/microsoft/vcpkg.git $vcpkgRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not download vcpkg.' }
}

$vcpkgRoot = (Resolve-Path -LiteralPath $vcpkgRoot).Path
$vcpkgExe = Join-Path $vcpkgRoot 'vcpkg.exe'
if (-not (Test-Path -LiteralPath $vcpkgExe)) {
    & (Join-Path $vcpkgRoot 'bootstrap-vcpkg.bat') -disableMetrics
    if ($LASTEXITCODE -ne 0) { throw 'Could not bootstrap vcpkg.' }
}

Push-Location $vcpkgRoot
try {
    & $vcpkgExe install libsodium:x64-windows-static-md
    if ($LASTEXITCODE -ne 0) { throw 'Could not install libsodium with the x64-windows-static-md triplet.' }
} finally {
    Pop-Location
}

$env:VCPKG_ROOT = $vcpkgRoot
$env:VCPKGRS_TRIPLET = 'x64-windows-static-md'
$env:SODIUM_USE_PKG_CONFIG = '1'
Write-Host 'Windows libsodium is ready. Run npm run tauri dev or npm run tauri build in this terminal.'
