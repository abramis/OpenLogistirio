$ErrorActionPreference = "Stop"

Write-Host "DEVELOPMENT ONLY - rebuilds the current source; it does not download a release." -ForegroundColor Yellow

Set-Location (Resolve-Path "$PSScriptRoot\..\..")
docker compose build --pull
docker compose run --rm api npm run prisma:deploy -w "@open-logistirio/api"
docker compose up -d api web

Write-Host "Open Logistirio updated and restarted." -ForegroundColor Green
