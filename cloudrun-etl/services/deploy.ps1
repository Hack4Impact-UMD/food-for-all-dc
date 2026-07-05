param(
  [ValidateSet('all', 'email-all', 'single')]
  [string]$Workflow,

  [ValidateSet('active-status-etl', 'admin-notes-email', 'check-remaining-deliveries', 'tefap-email', 'route-exports')]
  [string]$Service,

  [string]$ProjectId = 'food-for-all-dc-caf23',
  [string]$Region = 'us-central1'
)

$ErrorActionPreference = 'Stop'

if (-not $Workflow) {
  throw "Provide -Workflow with one of: all, email-all, single"
}

if ($Workflow -eq 'single' -and -not $Service) {
  throw "Workflow 'single' requires -Service."
}

if ($Workflow -ne 'single' -and $Service) {
  Write-Host "Ignoring -Service because workflow is '$Workflow'." -ForegroundColor Yellow
}

$deployAllScript = Join-Path $PSScriptRoot 'deploy-cloudrun-services.ps1'
$deployEmailScript = Join-Path $PSScriptRoot 'deploy-email-services.ps1'

switch ($Workflow) {
  'all' {
    & $deployAllScript -Service all -ProjectId $ProjectId -Region $Region
    break
  }
  'email-all' {
    & $deployEmailScript -Service all -ProjectId $ProjectId -Region $Region
    break
  }
  'single' {
    & $deployAllScript -Service $Service -ProjectId $ProjectId -Region $Region
    break
  }
}