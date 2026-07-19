$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

. (Join-Path $PSScriptRoot "production-common.ps1")

try {
  $repositoryRoot = Get-OpenLogistirioRepositoryRoot
  $environmentFile = Get-OpenLogistirioEnvironmentFile

  Write-Host "Open Logistirio - Διακοπή" -ForegroundColor White
  Write-OpenLogistirioStep "Ασφαλής διακοπή της εφαρμογής"
  Assert-OpenLogistirioPrerequisites
  Invoke-OpenLogistirioCompose -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeArguments @("stop")
  Write-OpenLogistirioSuccess "Η εφαρμογή σταμάτησε. Τα δεδομένα και τα backups παραμένουν αποθηκευμένα."
  exit 0
}
catch {
  Write-Host ""
  Write-Host "Η εφαρμογή δεν μπόρεσε να σταματήσει." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}
