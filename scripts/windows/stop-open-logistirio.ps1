$ErrorActionPreference = "Stop"

Write-Host "DEVELOPMENT ONLY - this is not the Windows production launcher." -ForegroundColor Yellow

Set-Location (Resolve-Path "$PSScriptRoot\..\..")
docker compose down

Write-Host "Open Logistirio containers stopped." -ForegroundColor Green
