[CmdletBinding()]
param(
  [switch]$ValidateOnly,
  [switch]$PrepareOnly,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

. (Join-Path $PSScriptRoot "production-common.ps1")

$previousVersion = $null
$restoreVersionOnFailure = $false
$deploymentStarted = $false
$environmentAlreadyExisted = $false

try {
  $repositoryRoot = Get-OpenLogistirioRepositoryRoot
  $configDirectory = Get-OpenLogistirioConfigDirectory
  $environmentFile = Get-OpenLogistirioEnvironmentFile
  $releaseVersion = Get-OpenLogistirioReleaseVersion -RepositoryRoot $repositoryRoot

  Write-Host "Open Logistirio - Εγκατάσταση / Ενημέρωση για Windows" -ForegroundColor White
  Write-Host "Δεν χρειάζεται να πληκτρολογήσετε καμία εντολή." -ForegroundColor Gray

  if ($ValidateOnly) {
    if (-not (Test-Path -LiteralPath (Join-Path $repositoryRoot "docker-compose.production.yml"))) {
      throw "Δεν βρέθηκε το production Compose του release."
    }
    if ((New-OpenLogistirioSecret -ByteCount 48).Length -lt 32) {
      throw "Απέτυχε ο έλεγχος της ασφαλούς παραγωγής κλειδιών."
    }
    if (Test-Path -LiteralPath $environmentFile) {
      Assert-OpenLogistirioEnvironment -Path $environmentFile
    }
    Write-OpenLogistirioSuccess "Ο έλεγχος του Windows installer ολοκληρώθηκε χωρίς αλλαγές. Έκδοση: $releaseVersion"
    exit 0
  }

  if (-not $PrepareOnly) {
    Write-OpenLogistirioStep "Έλεγχος Docker Desktop"
    Assert-OpenLogistirioPrerequisites
  }

  $environmentAlreadyExisted = Test-Path -LiteralPath $environmentFile
  if (-not $PrepareOnly -and -not $environmentAlreadyExisted -and
      (Test-OpenLogistirioDataVolume)) {
    throw "Βρέθηκαν υπάρχοντα δεδομένα Open Logistirio, αλλά λείπουν οι ασφαλείς ρυθμίσεις αυτού του λογαριασμού Windows. Μην συνεχίσετε με νέα εγκατάσταση· επαναφέρετε τον φάκελο %LOCALAPPDATA%\OpenLogistirio ή χρησιμοποιήστε τον ίδιο λογαριασμό Windows."
  }

  if (-not (Test-Path -LiteralPath $configDirectory)) {
    New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
  }

  if (-not (Test-Path -LiteralPath $environmentFile)) {
    Write-OpenLogistirioStep "Δημιουργία ασφαλών τοπικών ρυθμίσεων"
    $webPort = Select-OpenLogistirioWebPort
    $mysqlPassword = New-OpenLogistirioSecret
    $mysqlRootPassword = New-OpenLogistirioSecret
    $redisPassword = New-OpenLogistirioSecret
    $jwtAccessSecret = New-OpenLogistirioSecret -ByteCount 48
    $jwtRefreshSecret = New-OpenLogistirioSecret -ByteCount 48
    $setupToken = New-OpenLogistirioSecret -ByteCount 48
    $restorePassword = New-OpenLogistirioSecret

    $lines = @(
      "NODE_ENV=production",
      "APP_VERSION=$releaseVersion",
      "API_DOCS_ENABLED=false",
      "OPEN_LOGISTIRIO_API_IMAGE=ghcr.io/abramis/openlogistirio-api",
      "OPEN_LOGISTIRIO_WEB_IMAGE=ghcr.io/abramis/openlogistirio-web",
      "MYSQL_DATABASE=open_logistirio",
      "MYSQL_USER=openlog",
      "MYSQL_PASSWORD=$mysqlPassword",
      "MYSQL_ROOT_PASSWORD=$mysqlRootPassword",
      "REDIS_PASSWORD=$redisPassword",
      "DATABASE_URL=mysql://openlog:$mysqlPassword@mysql:3306/open_logistirio",
      "REDIS_URL=redis://:$redisPassword@redis:6379",
      "JWT_ACCESS_SECRET=$jwtAccessSecret",
      "JWT_REFRESH_SECRET=$jwtRefreshSecret",
      "JWT_ACCESS_EXPIRES_IN=15m",
      "JWT_REFRESH_EXPIRES_IN=7d",
      "INITIAL_SETUP_TOKEN=$setupToken",
      "API_PORT=3000",
      "WEB_BIND_ADDRESS=127.0.0.1",
      "WEB_PORT=$webPort",
      "FRONTEND_ORIGIN=http://localhost:$webPort",
      "BACKUP_DIR=/workspace/backups",
      "SUPPORTING_DOCUMENTS_DIR=/workspace/storage/supporting-documents",
      "BACKUP_INTERVAL_SECONDS=86400",
      "BACKUP_RETENTION_DAYS=30",
      "BACKUP_MAX_AGE_HOURS=36",
      "RESTORE_DRILL_MYSQL_ROOT_PASSWORD=$restorePassword",
      "RATE_LIMIT_WINDOW_MS=60000",
      "RATE_LIMIT_MAX=240",
      "TRUST_PROXY=true",
      "AADE_MYDATA_ENV=test",
      "AADE_MYDATA_PRODUCTION_READ_ENABLED=false",
      "AADE_MYDATA_PRODUCTION_ENABLED=false",
      "MYDATA_SCHEDULED_SYNC_ENABLED=false",
      "MYDATA_SCHEDULED_SYNC_CRON=0 2 * * *",
      "MYDATA_SCHEDULED_SYNC_MAX_PAGES=10"
    )
    Write-Utf8FileWithoutBom -Path $environmentFile -Lines $lines
    Write-OpenLogistirioSuccess "Οι κωδικοί υποδομής δημιουργήθηκαν αυτόματα και αποθηκεύτηκαν μόνο σε αυτόν τον υπολογιστή."
  }
  else {
    $environment = Read-OpenLogistirioEnvironment -Path $environmentFile
    if ($environment.ContainsKey("APP_VERSION")) {
      $previousVersion = [string]$environment["APP_VERSION"]
    }
    if (-not $environment.ContainsKey("INITIAL_SETUP_TOKEN") -or
        [string]::IsNullOrWhiteSpace([string]$environment["INITIAL_SETUP_TOKEN"])) {
      Set-OpenLogistirioEnvironmentValue -Path $environmentFile -Name "INITIAL_SETUP_TOKEN" -Value (New-OpenLogistirioSecret -ByteCount 48)
    }

    Assert-OpenLogistirioEnvironment -Path $environmentFile
    if (-not $PrepareOnly -and (Test-OpenLogistirioDataVolume)) {
      Write-OpenLogistirioStep "Δημιουργία backup πριν από την ενημέρωση"
      Invoke-OpenLogistirioCompose -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeArguments @(
        "up", "-d", "--no-build", "--pull", "never", "--no-recreate", "mysql"
      )
      Invoke-OpenLogistirioCompose -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeArguments @(
        "--profile", "maintenance", "run", "--rm", "--no-deps", "backup-before-update"
      )
      Write-OpenLogistirioSuccess "Το backup πριν από την ενημέρωση ολοκληρώθηκε."
    }

    Set-OpenLogistirioEnvironmentValue -Path $environmentFile -Name "APP_VERSION" -Value $releaseVersion
    $restoreVersionOnFailure = -not [string]::IsNullOrWhiteSpace($previousVersion) -and $previousVersion -ne $releaseVersion
    Write-OpenLogistirioSuccess "Βρέθηκε η υπάρχουσα εγκατάσταση. Τα δεδομένα και οι κωδικοί της διατηρούνται."
  }

  Assert-OpenLogistirioEnvironment -Path $environmentFile

  if ($PrepareOnly) {
    Write-OpenLogistirioSuccess "Οι ασφαλείς ρυθμίσεις προετοιμάστηκαν χωρίς εκκίνηση ή αλλαγή Docker containers."
    exit 0
  }

  Write-OpenLogistirioStep "Λήψη της έκδοσης $releaseVersion"
  Invoke-OpenLogistirioCompose -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeArguments @(
    "pull", "mysql", "redis", "migrate", "api", "backup", "files-backup", "web"
  )

  Write-OpenLogistirioStep "Εκκίνηση βάσης, migrations και εφαρμογής"
  $deploymentStarted = $true
  Invoke-OpenLogistirioCompose -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeArguments @(
    "up", "-d", "--no-build", "--pull", "never"
  )

  Write-OpenLogistirioStep "Έλεγχος ότι όλα λειτουργούν σωστά"
  Wait-OpenLogistirioReady -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile

  $port = Get-OpenLogistirioWebPort -EnvironmentFile $environmentFile
  Write-OpenLogistirioSuccess "Το Open Logistirio είναι έτοιμο στη διεύθυνση http://localhost:$port"
  if (-not $NoBrowser) {
    Open-OpenLogistirioBrowser -EnvironmentFile $environmentFile
  }
  exit 0
}
catch {
  $installationError = $_
  if ($restoreVersionOnFailure -and -not $deploymentStarted -and
      -not [string]::IsNullOrWhiteSpace($previousVersion) -and
      (Test-Path -LiteralPath $environmentFile)) {
    try {
      Set-OpenLogistirioEnvironmentValue -Path $environmentFile -Name "APP_VERSION" -Value $previousVersion
    }
    catch {
      # Keep the original installation error below; no secret is changed here.
    }
  }
  Write-Host ""
  Write-Host "Η εγκατάσταση δεν ολοκληρώθηκε." -ForegroundColor Red
  Write-Host $installationError.Exception.Message -ForegroundColor Red
  Write-Host "Μπορείτε να διορθώσετε το πρόβλημα και να εκτελέσετε ξανά το INSTALL-WINDOWS.cmd χωρίς να χαθούν δεδομένα." -ForegroundColor Yellow
  exit 1
}
