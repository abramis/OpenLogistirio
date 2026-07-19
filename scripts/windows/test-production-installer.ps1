$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$installer = Join-Path $PSScriptRoot "install-production.ps1"
$powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$testLocalAppData = Join-Path $env:TEMP ("open-logistirio-installer-test-" + [Guid]::NewGuid().ToString("N"))
$originalLocalAppData = $env:LOCALAPPDATA
$originalPath = $env:PATH
$originalDockerLog = $env:OPENLOG_DOCKER_LOG
$originalDockerVolumeExists = $env:OPENLOG_DOCKER_VOLUME_EXISTS
$serverJob = $null

function Invoke-InstallerCheck {
  param([Parameter(Mandatory = $true)][string[]]$InstallerArguments)

  & $powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File $installer @InstallerArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Windows installer $($InstallerArguments -join ' ') failed with exit code $LASTEXITCODE."
  }
}

function Read-TestEnvironment {
  param([Parameter(Mandatory = $true)][string]$Path)

  $values = @{}
  foreach ($line in (Get-Content -LiteralPath $Path)) {
    $separator = $line.IndexOf("=")
    if ($separator -gt 0) {
      $values[$line.Substring(0, $separator)] = $line.Substring($separator + 1)
    }
  }
  return $values
}

function Find-TestLogLine {
  param(
    [Parameter(Mandatory = $true)][string[]]$Lines,
    [Parameter(Mandatory = $true)][string]$Pattern
  )

  for ($index = 0; $index -lt $Lines.Count; $index++) {
    if ($Lines[$index] -match $Pattern) {
      return $index
    }
  }
  return -1
}

try {
  Get-ChildItem (Join-Path $repositoryRoot "scripts\windows\*.ps1") | ForEach-Object {
    $tokens = $null
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
      $_.FullName,
      [ref]$tokens,
      [ref]$parseErrors
    ) | Out-Null
    if ($parseErrors.Count -gt 0) {
      $parseErrors | ForEach-Object { Write-Error $_.Message }
      throw "PowerShell parsing failed for $($_.Name)."
    }
  }

  @("INSTALL-WINDOWS.cmd", "START-WINDOWS.cmd", "STOP-WINDOWS.cmd") | ForEach-Object {
    $entryPoint = Join-Path $repositoryRoot $_
    if (-not (Test-Path -LiteralPath $entryPoint -PathType Leaf)) {
      throw "Missing Windows entry point: $_"
    }
    if ((Get-Content -LiteralPath $entryPoint -Raw) -notmatch "powershell") {
      throw "Windows entry point does not launch PowerShell: $_"
    }
  }

  $env:LOCALAPPDATA = $testLocalAppData
  Invoke-InstallerCheck -InstallerArguments @("-ValidateOnly")
  Invoke-InstallerCheck -InstallerArguments @("-PrepareOnly")

  $environmentFile = Join-Path $testLocalAppData "OpenLogistirio\.env.production"
  if (-not (Test-Path -LiteralPath $environmentFile -PathType Leaf)) {
    throw "The Windows installer did not create its production environment file."
  }

  $values = Read-TestEnvironment -Path $environmentFile
  $releaseVersion = (Get-Content (Join-Path $repositoryRoot "package.json") -Raw | ConvertFrom-Json).version
  if ($values["NODE_ENV"] -ne "production" -or $values["APP_VERSION"] -ne $releaseVersion) {
    throw "The Windows installer did not select the production release."
  }
  if ($values["WEB_BIND_ADDRESS"] -ne "127.0.0.1" -or
      $values["FRONTEND_ORIGIN"] -ne ("http://localhost:{0}" -f $values["WEB_PORT"])) {
    throw "The Windows installation is not restricted to the local PC."
  }

  $secretNames = @(
    "MYSQL_PASSWORD",
    "MYSQL_ROOT_PASSWORD",
    "REDIS_PASSWORD",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "INITIAL_SETUP_TOKEN"
  )
  $originalSecrets = @{}
  foreach ($name in $secretNames) {
    if (-not $values.ContainsKey($name) -or
        ([string]$values[$name]).Length -lt 32 -or
        ([string]$values[$name]) -notmatch "^[A-Za-z0-9_-]+$") {
      throw "The Windows installer did not generate a strong $name value."
    }
    $originalSecrets[$name] = [string]$values[$name]
  }
  if (($originalSecrets.Values | Select-Object -Unique).Count -ne $secretNames.Count) {
    throw "The Windows installer reused an infrastructure secret."
  }
  if ((Get-Content -LiteralPath $environmentFile -Raw) -match "admin@example|ChangeMe|replace-with") {
    throw "Development or placeholder credentials leaked into the Windows production installation."
  }

  $lines = Get-Content -LiteralPath $environmentFile
  $lines = $lines | ForEach-Object {
    if ($_.StartsWith("APP_VERSION=")) { "APP_VERSION=0.0.0-upgrade-test" } else { $_ }
  }
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($environmentFile, $lines, $encoding)

  Invoke-InstallerCheck -InstallerArguments @("-PrepareOnly")
  $updatedValues = Read-TestEnvironment -Path $environmentFile
  if ($updatedValues["APP_VERSION"] -ne $releaseVersion) {
    throw "The Windows installer did not update the stored release version."
  }
  foreach ($name in $secretNames) {
    if ($updatedValues[$name] -ne $originalSecrets[$name]) {
      throw "The Windows installer changed the existing $name value during an update."
    }
  }

  $before = (Get-FileHash -LiteralPath $environmentFile -Algorithm SHA256).Hash
  Invoke-InstallerCheck -InstallerArguments @("-PrepareOnly")
  $after = (Get-FileHash -LiteralPath $environmentFile -Algorithm SHA256).Hash
  if ($before -ne $after) {
    throw "Repeating the Windows installer changed existing secrets or settings."
  }

  $lines = Get-Content -LiteralPath $environmentFile
  $lines = $lines | ForEach-Object {
    if ($_.StartsWith("APP_VERSION=")) { "APP_VERSION=0.0.0-deployment-test" } else { $_ }
  }
  [System.IO.File]::WriteAllLines($environmentFile, $lines, $encoding)

  $fakeDockerDirectory = Join-Path $testLocalAppData "fake-docker"
  $dockerLog = Join-Path $testLocalAppData "docker-commands.log"
  New-Item -ItemType Directory -Path $fakeDockerDirectory -Force | Out-Null
  $fakeDocker = @(
    '@echo off',
    '>>"%OPENLOG_DOCKER_LOG%" echo %*',
    'if /I "%1"=="info" (',
    '  echo linux',
    '  exit /b 0',
    ')',
    'if /I "%1"=="compose" if /I "%2"=="version" (',
    '  echo Docker Compose version v2.test',
    '  exit /b 0',
    ')',
    'if /I "%1"=="volume" if /I "%2"=="inspect" (',
    '  if "%OPENLOG_DOCKER_VOLUME_EXISTS%"=="1" exit /b 0',
    '  1>&2 echo Error response from daemon: get %3: no such volume',
    '  exit /b 1',
    ')',
    'exit /b 0'
  )
  [System.IO.File]::WriteAllLines(
    (Join-Path $fakeDockerDirectory "docker.cmd"),
    $fakeDocker,
    [System.Text.Encoding]::ASCII
  )
  $env:OPENLOG_DOCKER_LOG = $dockerLog
  $env:PATH = $fakeDockerDirectory + ";" + $originalPath

  . (Join-Path $PSScriptRoot "production-common.ps1")
  $env:OPENLOG_DOCKER_VOLUME_EXISTS = ""
  if (Test-OpenLogistirioDataVolume) {
    throw "The Windows installer treated a missing first-install volume as existing."
  }
  $env:OPENLOG_DOCKER_VOLUME_EXISTS = "1"
  if (-not (Test-OpenLogistirioDataVolume)) {
    throw "The Windows installer did not detect an existing data volume."
  }

  $webPort = [int]$updatedValues["WEB_PORT"]
  $serverJob = Start-Job -ArgumentList $webPort -ScriptBlock {
    param($Port)
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    try {
      while ($true) {
        if (-not $listener.Pending()) {
          Start-Sleep -Milliseconds 50
          continue
        }
        $client = $listener.AcceptTcpClient()
        try {
          $stream = $client.GetStream()
          $reader = [System.IO.StreamReader]::new(
            $stream,
            [System.Text.Encoding]::ASCII,
            $false,
            1024,
            $true
          )
          $null = $reader.ReadLine()
          while (($header = $reader.ReadLine()) -ne $null -and $header.Length -gt 0) {}
          $body = '{"status":"ok"}'
          $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
          $response = "HTTP/1.1 200 OK`r`nContent-Type: application/json`r`nContent-Length: $($bodyBytes.Length)`r`nConnection: close`r`n`r`n"
          $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($response)
          $stream.Write($headerBytes, 0, $headerBytes.Length)
          $stream.Write($bodyBytes, 0, $bodyBytes.Length)
          $stream.Flush()
        }
        finally {
          $client.Dispose()
        }
      }
    }
    finally {
      $listener.Stop()
    }
  }
  Start-Sleep -Milliseconds 500

  Invoke-InstallerCheck -InstallerArguments @("-NoBrowser")

  $deploymentValues = Read-TestEnvironment -Path $environmentFile
  if ($deploymentValues["APP_VERSION"] -ne $releaseVersion) {
    throw "The Windows deployment did not update the stored release version."
  }
  foreach ($name in $secretNames) {
    if ($deploymentValues[$name] -ne $originalSecrets[$name]) {
      throw "The Windows deployment changed the existing $name value."
    }
  }

  $dockerCommands = @(Get-Content -LiteralPath $dockerLog)
  $safeStart = Find-TestLogLine -Lines $dockerCommands -Pattern "up -d --no-build --pull never --no-recreate mysql$"
  $backup = Find-TestLogLine -Lines $dockerCommands -Pattern "--profile maintenance run --rm --no-deps backup-before-update$"
  $pull = Find-TestLogLine -Lines $dockerCommands -Pattern "pull mysql redis migrate api backup files-backup web$"
  $deployment = Find-TestLogLine -Lines $dockerCommands -Pattern "up -d --no-build --pull never$"
  if ($safeStart -lt 0 -or $backup -le $safeStart -or $pull -le $backup -or $deployment -le $pull) {
    throw "The Windows updater did not back up the existing database before pulling and deploying images."
  }

  Write-Host "Windows PowerShell 5.1 installer checks passed." -ForegroundColor Green
}
finally {
  if ($serverJob -ne $null) {
    Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job -Job $serverJob -Force -ErrorAction SilentlyContinue
  }
  $env:LOCALAPPDATA = $originalLocalAppData
  $env:PATH = $originalPath
  $env:OPENLOG_DOCKER_LOG = $originalDockerLog
  $env:OPENLOG_DOCKER_VOLUME_EXISTS = $originalDockerVolumeExists
  Remove-Item -LiteralPath $testLocalAppData -Recurse -Force -ErrorAction SilentlyContinue
}
