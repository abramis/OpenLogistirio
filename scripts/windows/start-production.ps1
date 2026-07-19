$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

. (Join-Path $PSScriptRoot "production-common.ps1")

try {
  $repositoryRoot = Get-OpenLogistirioRepositoryRoot
  $environmentFile = Get-OpenLogistirioEnvironmentFile

  Write-Host "Open Logistirio - Εκκίνηση" -ForegroundColor White
  Write-OpenLogistirioStep "Έλεγχος Docker Desktop"
  Assert-OpenLogistirioPrerequisites

  Write-OpenLogistirioStep "Εκκίνηση της εφαρμογής"
  Invoke-OpenLogistirioCompose -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile -ComposeArguments @(
    "up", "-d", "--no-build", "--pull", "never"
  )
  Wait-OpenLogistirioReady -RepositoryRoot $repositoryRoot -EnvironmentFile $environmentFile

  $port = Get-OpenLogistirioWebPort -EnvironmentFile $environmentFile
  Write-OpenLogistirioSuccess "Το Open Logistirio λειτουργεί στη διεύθυνση http://localhost:$port"
  Open-OpenLogistirioBrowser -EnvironmentFile $environmentFile
  exit 0
}
catch {
  Write-Host ""
  Write-Host "Η εφαρμογή δεν μπόρεσε να ξεκινήσει." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Αν λείπει κάποια έκδοση, εκτελέστε πρώτα το INSTALL-WINDOWS.cmd." -ForegroundColor Yellow
  exit 1
}
