[CmdletBinding()]
param(
  [string]$ImportFile,
  [switch]$EnableProductionWrites,
  [switch]$EnableScheduledSync,
  [switch]$NoRestart
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

. (Join-Path $PSScriptRoot "production-common.ps1")
. (Join-Path $PSScriptRoot "aade-configuration.ps1")

try {
  $repositoryRoot = Get-OpenLogistirioRepositoryRoot
  $environmentFile = Get-OpenLogistirioEnvironmentFile
  Assert-OpenLogistirioEnvironment -Path $environmentFile

  Write-Host "Open Logistirio - Ρύθμιση πραγματικής σύνδεσης ΑΑΔΕ" -ForegroundColor White
  if ([string]::IsNullOrWhiteSpace($ImportFile)) {
    Initialize-OpenLogistirioAadeConfiguration -EnvironmentFile $environmentFile -Force
  }
  else {
    Import-OpenLogistirioAadeConfiguration `
      -EnvironmentFile $environmentFile `
      -ImportFile $ImportFile `
      -EnableProductionWrites:$EnableProductionWrites `
      -EnableScheduledSync:$EnableScheduledSync
    Write-OpenLogistirioSuccess "Τα credentials ΑΑΔΕ εισήχθησαν χωρίς να αντιγραφούν στο repository."
  }

  Protect-OpenLogistirioEnvironmentFile -Path $environmentFile
  Assert-OpenLogistirioEnvironment -Path $environmentFile

  if (-not $NoRestart) {
    Write-OpenLogistirioStep "Εφαρμογή ρυθμίσεων"
    Assert-OpenLogistirioPrerequisites
    Invoke-OpenLogistirioCompose `
      -RepositoryRoot $repositoryRoot `
      -EnvironmentFile $environmentFile `
      -ComposeArguments @("up", "-d", "--no-build", "--pull", "never", "--no-deps", "--force-recreate", "api")
    Wait-OpenLogistirioReady -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile
  }

  Write-OpenLogistirioSuccess "Η πραγματική σύνδεση ΑΑΔΕ είναι ρυθμισμένη."
  exit 0
}
catch {
  Write-Host ""
  Write-Host "Η ρύθμιση ΑΑΔΕ δεν ολοκληρώθηκε." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
