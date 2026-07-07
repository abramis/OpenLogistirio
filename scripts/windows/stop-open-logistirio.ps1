$ErrorActionPreference = "Stop"

Set-Location (Resolve-Path "$PSScriptRoot\..\..")
docker compose down

Write-Host "Open Logistirio containers stopped." -ForegroundColor Green
