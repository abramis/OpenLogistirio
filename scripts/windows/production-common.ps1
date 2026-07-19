Set-StrictMode -Version 2.0

$script:OpenLogistirioProjectName = "open-logistirio"
$script:OpenLogistirioDefaultPort = 8088
$script:OpenLogistirioLastPort = 8098

function Get-OpenLogistirioRepositoryRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-OpenLogistirioConfigDirectory {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw "Δεν βρέθηκε ο φάκελος LOCALAPPDATA των Windows."
  }

  return (Join-Path $env:LOCALAPPDATA "OpenLogistirio")
}

function Get-OpenLogistirioEnvironmentFile {
  return (Join-Path (Get-OpenLogistirioConfigDirectory) ".env.production")
}

function Write-OpenLogistirioStep {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host ""
  Write-Host ("==> " + $Message) -ForegroundColor Cyan
}

function Write-OpenLogistirioSuccess {
  param([Parameter(Mandatory = $true)][string]$Message)

  Write-Host $Message -ForegroundColor Green
}

function Test-DockerDaemon {
  $output = & docker info --format "{{.OSType}}" 2>$null
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    return $null
  }

  return ([string]$output).Trim().ToLowerInvariant()
}

function Start-DockerDesktopIfNeeded {
  if ((Test-DockerDaemon) -ne $null) {
    return
  }

  $candidates = @(
    (Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"),
    (Join-Path $env:LOCALAPPDATA "Docker\Docker Desktop.exe")
  )
  $desktopPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

  if ($desktopPath) {
    Write-OpenLogistirioStep "Εκκίνηση του Docker Desktop. Περιμένετε λίγο..."
    Start-Process -FilePath $desktopPath | Out-Null
  }

  $deadline = [DateTime]::UtcNow.AddMinutes(3)
  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Seconds 3
    if ((Test-DockerDaemon) -ne $null) {
      return
    }
  }

  throw "Το Docker Desktop δεν ξεκίνησε. Ανοίξτε το Docker Desktop, περιμένετε να εμφανίσει ότι εκτελείται και δοκιμάστε ξανά."
}

function Assert-OpenLogistirioPrerequisites {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Δεν βρέθηκε το Docker Desktop. Εγκαταστήστε το Docker Desktop για Windows με ενεργό το WSL 2 και δοκιμάστε ξανά."
  }

  Start-DockerDesktopIfNeeded

  $engineType = Test-DockerDaemon
  if ($engineType -ne "linux") {
    throw "Το Docker Desktop εκτελεί Windows containers. Επιλέξτε 'Switch to Linux containers' από το Docker Desktop και δοκιμάστε ξανά."
  }

  $null = & docker compose version 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "Δεν βρέθηκε το Docker Compose. Ενημερώστε το Docker Desktop και δοκιμάστε ξανά."
  }
}

function Test-OpenLogistirioDataVolume {
  $volumeName = $script:OpenLogistirioProjectName + "_mysql-data"
  $null = & docker volume inspect $volumeName 2>$null
  return $LASTEXITCODE -eq 0
}

function Invoke-OpenLogistirioCompose {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$EnvironmentFile,
    [Parameter(Mandatory = $true)][string[]]$ComposeArguments
  )

  $composeFile = Join-Path $RepositoryRoot "docker-compose.production.yml"
  if (-not (Test-Path -LiteralPath $composeFile)) {
    throw "Δεν βρέθηκε το docker-compose.production.yml. Αποσυμπιέστε ολόκληρο το release και εκτελέστε ξανά το αρχείο."
  }
  if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
    throw "Δεν βρέθηκαν οι ασφαλείς ρυθμίσεις της εγκατάστασης. Εκτελέστε πρώτα το INSTALL-WINDOWS.cmd."
  }

  $env:PRODUCTION_ENV_FILE = $EnvironmentFile
  $baseArguments = @(
    "compose",
    "--project-name", $script:OpenLogistirioProjectName,
    "--env-file", $EnvironmentFile,
    "--file", $composeFile
  )

  Push-Location $RepositoryRoot
  try {
    & docker @baseArguments @ComposeArguments
    $exitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }

  if ($exitCode -ne 0) {
    throw "Το Docker σταμάτησε με σφάλμα (κωδικός $exitCode). Δείτε το μήνυμα ακριβώς από πάνω και δοκιμάστε ξανά."
  }
}

function Read-OpenLogistirioEnvironment {
  param([Parameter(Mandatory = $true)][string]$Path)

  $values = @{}
  foreach ($line in (Get-Content -LiteralPath $Path)) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) {
      continue
    }

    $separator = $line.IndexOf("=")
    if ($separator -le 0) {
      continue
    }

    $name = $line.Substring(0, $separator).Trim()
    $value = $line.Substring($separator + 1).Trim()
    $values[$name] = $value
  }

  return $values
}

function Assert-OpenLogistirioEnvironment {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Δεν βρέθηκε το αρχείο ασφαλών ρυθμίσεων: $Path"
  }

  $environment = Read-OpenLogistirioEnvironment -Path $Path
  $requiredNames = @(
    "NODE_ENV",
    "APP_VERSION",
    "MYSQL_DATABASE",
    "MYSQL_USER",
    "MYSQL_PASSWORD",
    "MYSQL_ROOT_PASSWORD",
    "REDIS_PASSWORD",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "INITIAL_SETUP_TOKEN",
    "FRONTEND_ORIGIN",
    "WEB_PORT"
  )
  foreach ($name in $requiredNames) {
    if (-not $environment.ContainsKey($name) -or
        [string]::IsNullOrWhiteSpace([string]$environment[$name])) {
      throw "Λείπει η απαραίτητη ρύθμιση $name από το ασφαλές αρχείο εγκατάστασης."
    }
  }

  if ([string]$environment["NODE_ENV"] -ne "production") {
    throw "Η εγκατάσταση Windows πρέπει να χρησιμοποιεί NODE_ENV=production."
  }
  if (([string]$environment["JWT_ACCESS_SECRET"]).Length -lt 32 -or
      ([string]$environment["JWT_REFRESH_SECRET"]).Length -lt 32 -or
      ([string]$environment["INITIAL_SETUP_TOKEN"]).Length -lt 32) {
    throw "Τα αποθηκευμένα κλειδιά ασφαλείας είναι πολύ μικρά."
  }

  $null = Get-OpenLogistirioWebPort -EnvironmentFile $Path
}

function Write-Utf8FileWithoutBom {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string[]]$Lines
  )

  $temporaryPath = $Path + ".tmp"
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($temporaryPath, $Lines, $encoding)
  Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
}

function Set-OpenLogistirioEnvironmentValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )

  $lines = [System.Collections.Generic.List[string]]::new()
  $updated = $false
  foreach ($line in (Get-Content -LiteralPath $Path)) {
    $separator = $line.IndexOf("=")
    if ($separator -gt 0 -and $line.Substring(0, $separator).Trim() -eq $Name) {
      $lines.Add($Name + "=" + $Value)
      $updated = $true
    }
    else {
      $lines.Add($line)
    }
  }

  if (-not $updated) {
    $lines.Add($Name + "=" + $Value)
  }
  Write-Utf8FileWithoutBom -Path $Path -Lines $lines.ToArray()
}

function New-OpenLogistirioSecret {
  param([int]$ByteCount = 32)

  $bytes = New-Object byte[] $ByteCount
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($bytes)
  }
  finally {
    $generator.Dispose()
  }

  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Test-LocalTcpPortAvailable {
  param([Parameter(Mandatory = $true)][int]$Port)

  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    return $true
  }
  catch {
    return $false
  }
  finally {
    if ($listener -ne $null) {
      $listener.Stop()
    }
  }
}

function Select-OpenLogistirioWebPort {
  for ($port = $script:OpenLogistirioDefaultPort; $port -le $script:OpenLogistirioLastPort; $port++) {
    if (Test-LocalTcpPortAvailable -Port $port) {
      return $port
    }
  }

  throw "Δεν βρέθηκε ελεύθερη θύρα από 8088 έως 8098. Κλείστε την εφαρμογή που χρησιμοποιεί αυτές τις θύρες και δοκιμάστε ξανά."
}

function Get-OpenLogistirioReleaseVersion {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  $packageFile = Join-Path $RepositoryRoot "package.json"
  if (-not (Test-Path -LiteralPath $packageFile)) {
    throw "Δεν βρέθηκε το package.json του release."
  }

  $package = Get-Content -LiteralPath $packageFile -Raw | ConvertFrom-Json
  $version = ([string]$package.version).Trim()
  if ($version -notmatch "^[0-9A-Za-z][0-9A-Za-z._-]*$") {
    throw "Το release δεν έχει έγκυρη έκδοση για Docker image."
  }

  return $version
}

function Get-OpenLogistirioWebPort {
  param([Parameter(Mandatory = $true)][string]$EnvironmentFile)

  $environment = Read-OpenLogistirioEnvironment -Path $EnvironmentFile
  $port = 0
  if (-not $environment.ContainsKey("WEB_PORT") -or
      -not [int]::TryParse([string]$environment["WEB_PORT"], [ref]$port) -or
      $port -lt 1 -or $port -gt 65535) {
    throw "Η αποθηκευμένη WEB_PORT δεν είναι έγκυρη. Εκτελέστε ξανά το INSTALL-WINDOWS.cmd."
  }

  return $port
}

function Wait-OpenLogistirioReady {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$EnvironmentFile,
    [int]$TimeoutSeconds = 300
  )

  $port = Get-OpenLogistirioWebPort -EnvironmentFile $EnvironmentFile
  $healthUrl = "http://localhost:$port/api/health/ready"
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)

  while ([DateTime]::UtcNow -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -eq 200) {
        return
      }
    }
    catch {
      # MySQL initialization and migrations can take a few minutes on first use.
    }
    Start-Sleep -Seconds 3
  }

  Write-Host ""
  Write-Host "Κατάσταση containers:" -ForegroundColor Yellow
  try {
    Invoke-OpenLogistirioCompose -RepositoryRoot $RepositoryRoot -EnvironmentFile $EnvironmentFile -ComposeArguments @("ps")
  }
  catch {
    Write-Host $_.Exception.Message -ForegroundColor Yellow
  }
  throw "Η εφαρμογή δεν έγινε έτοιμη μέσα σε $TimeoutSeconds δευτερόλεπτα. Δεν χάθηκαν δεδομένα· δοκιμάστε ξανά το INSTALL-WINDOWS.cmd."
}

function Get-OpenLogistirioLaunchUrl {
  param([Parameter(Mandatory = $true)][string]$EnvironmentFile)

  $environment = Read-OpenLogistirioEnvironment -Path $EnvironmentFile
  $port = Get-OpenLogistirioWebPort -EnvironmentFile $EnvironmentFile
  $baseUrl = "http://localhost:$port"

  try {
    $status = Invoke-RestMethod -Uri ($baseUrl + "/api/setup/status") -TimeoutSec 10
    if ([bool]$status.required) {
      $setupToken = [string]$environment["INITIAL_SETUP_TOKEN"]
      if ([string]::IsNullOrWhiteSpace($setupToken)) {
        throw "Λείπει το ασφαλές κλειδί αρχικής ρύθμισης."
      }
      return ($baseUrl + "/setup#token=" + [Uri]::EscapeDataString($setupToken))
    }
  }
  catch {
    throw "Δεν ήταν δυνατό να ελεγχθεί η αρχική ρύθμιση: $($_.Exception.Message)"
  }

  return $baseUrl
}

function Open-OpenLogistirioBrowser {
  param([Parameter(Mandatory = $true)][string]$EnvironmentFile)

  $launchUrl = Get-OpenLogistirioLaunchUrl -EnvironmentFile $EnvironmentFile
  Start-Process $launchUrl | Out-Null
}
