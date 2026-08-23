[CmdletBinding()]
param(
  [string]$Repository,
  [string]$AccessKey,
  [string]$SecretKey,
  [string]$Region = "eu-central-1",
  [string]$FailureWebhook,
  [switch]$SkipScheduledDrill
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0
. (Join-Path $PSScriptRoot "production-common.ps1")

function Read-PlainSecret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$root = Get-OpenLogistirioRepositoryRoot
$environmentFile = Get-OpenLogistirioEnvironmentFile
if (-not (Test-Path -LiteralPath $environmentFile)) {
  throw "Run INSTALL-WINDOWS.cmd first."
}
if ([string]::IsNullOrWhiteSpace($Repository)) {
  $Repository = Read-Host "Restic repository (example: s3:https://s3.eu-central-1.amazonaws.com/bucket/openlogistirio)"
}
if ([string]::IsNullOrWhiteSpace($Repository)) { throw "The off-site repository is required." }
if ([string]::IsNullOrWhiteSpace($AccessKey)) { $AccessKey = Read-Host "S3 access key (blank for SFTP/rest server)" }
if (-not [string]::IsNullOrWhiteSpace($AccessKey) -and [string]::IsNullOrWhiteSpace($SecretKey)) {
  $SecretKey = Read-PlainSecret "S3 secret key"
}

$values = Read-OpenLogistirioEnvironment -Path $environmentFile
if (-not $values.ContainsKey("OFFSITE_BACKUP_PASSWORD") -or
    [string]::IsNullOrWhiteSpace([string]$values["OFFSITE_BACKUP_PASSWORD"])) {
  Set-OpenLogistirioEnvironmentValue -Path $environmentFile -Name "OFFSITE_BACKUP_PASSWORD" -Value (New-OpenLogistirioSecret -ByteCount 48)
}
Set-OpenLogistirioEnvironmentValue -Path $environmentFile -Name "OFFSITE_BACKUP_REPOSITORY" -Value $Repository
Set-OpenLogistirioEnvironmentValue -Path $environmentFile -Name "OFFSITE_BACKUP_ACCESS_KEY" -Value $AccessKey
Set-OpenLogistirioEnvironmentValue -Path $environmentFile -Name "OFFSITE_BACKUP_SECRET_KEY" -Value $SecretKey
Set-OpenLogistirioEnvironmentValue -Path $environmentFile -Name "OFFSITE_BACKUP_REGION" -Value $Region
Set-OpenLogistirioEnvironmentValue -Path $environmentFile -Name "OFFSITE_BACKUP_FAILURE_WEBHOOK" -Value $FailureWebhook

Invoke-OpenLogistirioCompose -RepositoryRoot $root -EnvironmentFile $environmentFile -ComposeArguments @(
  "up", "-d", "--no-build", "--pull", "never", "offsite-backup"
)

if (-not $SkipScheduledDrill) {
  $runner = Join-Path $PSScriptRoot "run-offsite-restore-drill.ps1"
  $taskCommand = 'powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $runner
  & schtasks.exe /Create /F /SC WEEKLY /D SUN /ST 03:30 /TN "OpenLogistirio Offsite Restore Drill" /TR $taskCommand | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "The weekly Scheduled Task was not created. Run RUN-BACKUP-DRILL-WINDOWS.cmd manually."
  }
}

Write-OpenLogistirioSuccess "Encrypted off-site backup is enabled."
