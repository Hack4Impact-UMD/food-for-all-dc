param(
  [ValidateSet('admin-notes-email', 'check-remaining-deliveries', 'tefap-email', 'all')]
  [string]$Service = 'all',
  [string]$ProjectId = 'food-for-all-dc-caf23',
  [string]$Region = 'us-central1'
)

$ErrorActionPreference = 'Stop'

$target = if ($Service -eq 'all') { 'all' } else { $Service }

& (Join-Path $PSScriptRoot 'deploy-cloudrun-services.ps1') `
  -Service $target `
  -ProjectId $ProjectId `
  -Region $Region
