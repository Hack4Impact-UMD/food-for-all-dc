param(
  [ValidateSet('active-status-etl', 'admin-notes-email', 'check-remaining-deliveries', 'tefap-email', 'route-exports', 'all')]
  [string]$Service = 'all',
  [string]$ProjectId = 'food-for-all-dc-caf23',
  [string]$Region = 'us-central1'
)

$ErrorActionPreference = 'Stop'

$servicesRoot = $PSScriptRoot
$cloudrunRoot = Split-Path -Parent $servicesRoot

$servicePaths = @{
  'active-status-etl' = $cloudrunRoot
  'admin-notes-email' = Join-Path $servicesRoot 'admin-notes-email'
  'check-remaining-deliveries' = Join-Path $servicesRoot 'check-remaining-deliveries'
  'tefap-email' = Join-Path $servicesRoot 'tefap-email'
  'route-exports' = Join-Path $servicesRoot 'route-exports'
}

$emailServices = @('admin-notes-email', 'check-remaining-deliveries', 'tefap-email')
$routeExportService = 'route-exports'
$emailConfigPath = Join-Path $servicesRoot 'email-config.json'
$sendgridApiKey = $env:SENDGRID_API_KEY
$sendgridApiKeySecret = $env:SENDGRID_API_KEY_SECRET

$fromEmail = $null
$toEmail = $null

if (Test-Path $emailConfigPath) {
  $emailConfig = Get-Content $emailConfigPath -Raw | ConvertFrom-Json
  if ($emailConfig.fromEmail) { $fromEmail = [string]$emailConfig.fromEmail }
  if ($emailConfig.toEmail) { $toEmail = [string]$emailConfig.toEmail }
}

if ($Service -eq 'all') {
  $targets = @('active-status-etl', 'admin-notes-email', 'check-remaining-deliveries', 'tefap-email', 'route-exports')
} else {
  $targets = @($Service)
}

Write-Host "Using project: $ProjectId"
Write-Host "Using region:  $Region"
Write-Host "Deploy target: $Service"
Write-Host ''

foreach ($svc in $targets) {
  $sourceDir = $servicePaths[$svc]

  if (-not (Test-Path $sourceDir)) {
    throw "Source directory not found for '$svc': $sourceDir"
  }

  Write-Host "=== Deploying $svc ===" -ForegroundColor Cyan

  $deployArgs = @(
    'run', 'deploy', $svc,
    '--source', $sourceDir,
    '--project', $ProjectId,
    '--region', $Region,
    '--platform', 'managed',
    '--allow-unauthenticated',
    '--quiet'
  )

  if ($emailServices -contains $svc) {
    if (-not $sendgridApiKey -and -not $sendgridApiKeySecret) {
      throw "Missing SendGrid credentials. Set SENDGRID_API_KEY or SENDGRID_API_KEY_SECRET before deploying email services."
    }

    if ($sendgridApiKeySecret) {
      $deployArgs += @('--set-secrets', "SENDGRID_API_KEY=$sendgridApiKeySecret:latest")
    }

    if ($fromEmail -or $toEmail) {
      $pairs = @()
      if ($fromEmail) { $pairs += "FROM_EMAIL=$fromEmail" }
      if ($toEmail) { $pairs += "TO_EMAIL=$toEmail" }
      if ($sendgridApiKey -and -not $sendgridApiKeySecret) {
        $pairs += "SENDGRID_API_KEY=$sendgridApiKey"
      }
      if ($pairs.Count -gt 0) {
        $deployArgs += @('--set-env-vars', ($pairs -join ','))
      }
    } elseif ($sendgridApiKey -and -not $sendgridApiKeySecret) {
      $deployArgs += @('--set-env-vars', "SENDGRID_API_KEY=$sendgridApiKey")
    }
  } elseif ($svc -eq $routeExportService -and $fromEmail) {
    $deployArgs += @('--set-env-vars', "FROM_EMAIL=$fromEmail")
  }

  & gcloud @deployArgs
  if ($LASTEXITCODE -ne 0) {
    throw "gcloud deploy failed for $svc with exit code $LASTEXITCODE"
  }

  Write-Host "Deployed $svc" -ForegroundColor Green
  Write-Host ''
}

Write-Host 'All requested deployments completed.' -ForegroundColor Green
