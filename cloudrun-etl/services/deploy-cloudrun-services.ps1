param(
  [ValidateSet(
    'active-status-etl',
    'admin-notes-email',
    'check-remaining-deliveries',
    'tefap-email',
    'route-exports',
    'all'
  )]
  [string]$Service = 'all',

  [ValidateSet('food-for-all-dc-ffa')]
  [string]$ProjectId = 'food-for-all-dc-ffa',

  [string]$Region = 'us-central1',

  [string]$FromEmail = 'info@foodforalldc.org',

  # Keep reports directed to Jamie during migration testing.
  [string]$ReportToEmail = 'jamiebrs@gmail.com',

  [string]$SendGridSecretVersion = '2'
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

$reportServices = @(
  'admin-notes-email',
  'check-remaining-deliveries',
  'tefap-email'
)

$targets = if ($Service -eq 'all') {
  @(
    'active-status-etl',
    'admin-notes-email',
    'check-remaining-deliveries',
    'tefap-email',
    'route-exports'
  )
} else {
  @($Service)
}

if ([string]::IsNullOrWhiteSpace($FromEmail) -or
    [string]::IsNullOrWhiteSpace($ReportToEmail)) {
  throw 'Sender and report recipient must be configured.'
}

# gcloud uses commas to separate environment-variable assignments.
if ($FromEmail.Contains(',') -or $ReportToEmail.Contains(',')) {
  throw 'Specify one sender and one report recipient.'
}

foreach ($svc in $targets) {
  $sourceDir = $servicePaths[$svc]

  if (-not (Test-Path $sourceDir -PathType Container)) {
    throw "Source directory not found: $sourceDir"
  }
}

foreach ($svc in $targets) {
  Write-Host "Deploying $svc to $ProjectId"

  $runtimeAccount = if ($svc -eq 'active-status-etl') {
    "ffa-etl-runtime@$ProjectId.iam.gserviceaccount.com"
  } else {
    "ffa-email-runtime@$ProjectId.iam.gserviceaccount.com"
  }

  $deployArgs = @(
    'run', 'deploy', $svc,
    '--source', $servicePaths[$svc],
    '--project', $ProjectId,
    '--region', $Region,
    '--platform', 'managed',
    '--service-account', $runtimeAccount,
    '--no-allow-unauthenticated',
    '--quiet'
  )

  if ($svc -eq 'active-status-etl') {
    $deployArgs += @(
      '--update-env-vars', 'PYTHONUNBUFFERED=1'
    )
  } else {
    $deployArgs += @(
      '--update-secrets',
      "SENDGRID_API_KEY=sendgrid-api-key:${SendGridSecretVersion}"
    )

    $envPairs = @("FROM_EMAIL=$FromEmail")

    if ($reportServices -contains $svc) {
      $envPairs += "TO_EMAIL=$ReportToEmail"
    }

    $deployArgs += @(
      '--update-env-vars', ($envPairs -join ',')
    )
  }

  & gcloud @deployArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Deployment failed for $svc"
  }
}

Write-Host 'Cloud Run deployments completed.'