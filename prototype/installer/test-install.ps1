param([Parameter(Mandatory)][string]$Installer)
$ErrorActionPreference = 'Stop'
$root = Join-Path ([IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
$dest = Join-Path $root 'Installed Castiel'
$env:CASTIEL_DATA_DIR = Join-Path $root 'Test Data'
try {
  $setup = Start-Process $Installer -ArgumentList '/VERYSILENT','/NORESTART',("/DIR=`"$dest`"") -Wait -PassThru
  if ($setup.ExitCode -ne 0) { throw "Install failed: $($setup.ExitCode)" }
  $doc = Join-Path $env:CASTIEL_DATA_DIR 'workbench.json'
  foreach ($launch in 1..2) {
    $app = Start-Process (Join-Path $dest 'Castiel.exe') -PassThru
    $deadline = (Get-Date).AddSeconds(60)
    do {
      Start-Sleep -Milliseconds 500
      $app.Refresh()
      if ($app.HasExited) { throw 'Early app exit' }
    } until (($app.MainWindowTitle -like 'Castiel*' -and (Test-Path $doc)) -or (Get-Date) -gt $deadline)
    if (!$app.MainWindowHandle -or !(Test-Path $doc)) { throw 'Window or saved document missing' }
    if (!$app.CloseMainWindow() -or !$app.WaitForExit(30000)) { throw 'Normal shutdown failed' }
    $data = Get-Content $doc -Raw -Encoding UTF8 | ConvertFrom-Json
    if (!$data.data.spaces) { throw 'Renderer did not persist workspace state' }
  }
  $uninstall = Start-Process (Join-Path $dest 'unins000.exe') -ArgumentList '/VERYSILENT','/NORESTART' -Wait -PassThru
  if ($uninstall.ExitCode -ne 0 -or (Test-Path "$dest/Castiel.exe") -or !(Test-Path $doc)) { throw 'Uninstall verification failed' }
} finally {
  if ($app -and !$app.HasExited) { $app.Kill() }
  if (Test-Path $root) { Remove-Item $root -Recurse -Force }
}
