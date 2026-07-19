$ErrorActionPreference = "Stop"

Write-Host "DEVELOPMENT ONLY - starts source-mounted services and loads demo data." -ForegroundColor Yellow

Set-Location (Resolve-Path "$PSScriptRoot\..\..")

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker Desktop is not available in PATH. Install Docker Desktop for Windows first." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example. Review passwords/secrets before production use." -ForegroundColor Yellow
}

New-Item -ItemType Directory -Force -Path "backups" | Out-Null

docker compose up -d --build mysql redis
docker compose run --rm api npm run prisma:deploy -w "@open-logistirio/api"
docker compose run --rm api npm run seed -w "@open-logistirio/api"
docker compose up -d --build api web

Write-Host ""
Write-Host "Open Logistirio is starting." -ForegroundColor Green
Write-Host "Web: http://localhost:4200"
Write-Host "API: http://localhost:3000/api/health"
Start-Process "http://localhost:4200"
