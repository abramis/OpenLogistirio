$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0
. (Join-Path $PSScriptRoot "production-common.ps1")
$root = Get-OpenLogistirioRepositoryRoot
$environmentFile = Get-OpenLogistirioEnvironmentFile
if (-not (Test-Path -LiteralPath $environmentFile)) { throw "Open Logistirio is not installed." }
New-Item -ItemType Directory -Path (Join-Path $root "restore-drills") -Force | Out-Null
Invoke-OpenLogistirioCompose -RepositoryRoot $root -EnvironmentFile $environmentFile -ComposeArguments @(
  "--profile", "offsite-restore-drill", "up", "--abort-on-container-exit", "--exit-code-from", "offsite-restore-drill", "offsite-restore-drill"
)
Invoke-OpenLogistirioCompose -RepositoryRoot $root -EnvironmentFile $environmentFile -ComposeArguments @(
  "--profile", "offsite-restore-drill", "down", "--remove-orphans"
)
Write-OpenLogistirioSuccess "The off-site restore drill passed. The report is in restore-drills."
