$ErrorActionPreference = 'Stop'
$version = (Get-Content "$PSScriptRoot/../package.json" -Raw | ConvertFrom-Json).version
$compiler = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6/ISCC.exe'
if (!(Test-Path $compiler)) { $compiler = (Get-Command ISCC.exe -ErrorAction Stop).Source }
& $compiler "/DAppVersion=$version" "$PSScriptRoot/windows.iss"
exit $LASTEXITCODE
