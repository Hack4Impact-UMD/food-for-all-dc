# Cloud Run ETL and Service Guide

This document explains everything under `cloudrun-etl/`, including what each folder/file does, how deployments work, and how the email services are configured.

## 1) What this area contains

`cloudrun-etl/` contains:

- A Python Cloud Run ETL service (`active-status-etl`) that updates client active/inactive status.
- Multiple Node.js Cloud Run services for operational emails.
- Deployment scripts used to deploy one, many, or all services.
- Snapshots/reference code for related Python Firebase/HTTP functions.

## 2) Directory map

```text
cloudrun-etl/
  Dockerfile
  main.py
  README.md
  requirements.txt
  update_active_status.py
  cloudrun_readme.md
  services/
    deploy-cloudrun-services.ps1
    deploy-email-services.ps1
    deploy.ps1
    email-config.json
    SYNC_MANIFEST.txt
    admin-notes-email/
      index.js
      package.json
    check-remaining-deliveries/
      index.js
      package.json
    cluster-deliveries-k-means/
      clustering.py
      requirements.txt
    deleteuseraccount/
      main.py
      requirements.txt
    functions-python/
      clustering.py
      main.py
      README.md
      requirements.txt
    geocode-addresses-endpoint/
      clustering.py
      requirements.txt
    route-exports/
      index.js
      package.json
    tefap-email/
      index.js
      package.json
    updatedeliveriesdaily/
      main.py
      requirements.txt
```

## 3) Root service: active-status-etl

### Files

- `main.py`
  - Flask HTTP service entrypoint.
  - `GET /` triggers ETL execution.
- `update_active_status.py`
  - Core ETL logic.
  - Reads `client-profile2` in Firestore.
  - Sets `activeStatus` true/false using current date against `startDate`/`endDate`.
- `Dockerfile`
  - Builds the container image for Cloud Run.
  - Starts `main.py` on port 8080.
- `requirements.txt`
  - Python dependencies for this service.
- `README.md`
  - Existing notes for this ETL service.

### Runtime behavior

1. Cloud Run receives HTTP request.
2. `main.py` calls `update_active_status()`.
3. Firestore documents are updated in place.
4. API returns success/failure JSON.

## 4) Service deployment scripts

### `services/deploy.ps1`

Top-level workflow router:

- `-Workflow all`: deploy all supported Cloud Run services.
- `-Workflow email-all`: deploy only email services.
- `-Workflow single -Service <name>`: deploy one service.

### `services/deploy-email-services.ps1`

Convenience wrapper to deploy only:

- `admin-notes-email`
- `check-remaining-deliveries`
- `tefap-email`

### `services/deploy-cloudrun-services.ps1`

Core deployment script. For each target service it runs `gcloud run deploy` with:

- `--source` path for the service folder.
- `--project`, `--region`, `--platform managed`.
- `--allow-unauthenticated`.
- Email config and secrets/env var injection for mailers.

Important behavior:

- For email services, it requires one of:
  - `SENDGRID_API_KEY` (plain env var), or
  - `SENDGRID_API_KEY_SECRET` (Secret Manager secret name).
- It reads `fromEmail` and `toEmail` from `services/email-config.json` and injects them as Cloud Run env vars.

### `services/email-config.json`

Shared defaults for email sender/recipient:

- `fromEmail`
- `toEmail`

Used by email service code and by deployment scripts.

### `services/SYNC_MANIFEST.txt`

Tracking/notes file for how/when service code was synced.

## 5) Email services (Node.js Cloud Run)

All email services are HTTP handlers via `@google-cloud/functions-framework`, use Firestore via `firebase-admin`, and send via `@sendgrid/mail`.

### `services/admin-notes-email/`

- `index.js`
  - Generates weekly admin-note change summary from `clients` data.
  - Sends formatted report email.
- `package.json`
  - Node runtime and dependencies.

### `services/check-remaining-deliveries/`

- `index.js`
  - Finds clients with exactly one future delivery remaining.
  - Sends warning/report email.
- `package.json`
  - Node runtime and dependencies.

### `services/tefap-email/`

- `index.js`
  - Reports TEFAP certs recently expired and soon to expire.
  - Sends email summary.
- `package.json`
  - Node runtime and dependencies.

### `services/route-exports/`

- `index.js`
  - Generates route export CSV data and emails it.
- `package.json`
  - Node runtime and dependencies.

## 6) Email API key setup (PowerShell and Bash)

These snippets set the Cloud Run email API key input used by `deploy-cloudrun-services.ps1`.

### Option A: Direct env var (`SENDGRID_API_KEY`)

#### PowerShell

```powershell
$env:SENDGRID_API_KEY = "SG.xxxxx"
powershell -ExecutionPolicy Bypass -File .\cloudrun-etl\services\deploy-cloudrun-services.ps1 -Service admin-notes-email
```

#### Bash

```bash
export SENDGRID_API_KEY="SG.xxxxx"
pwsh -ExecutionPolicy Bypass -File ./cloudrun-etl/services/deploy-cloudrun-services.ps1 -Service admin-notes-email
```

### Option B: Secret Manager reference (`SENDGRID_API_KEY_SECRET`)

Use this when you already have a secret in GCP Secret Manager.

#### PowerShell

```powershell
$env:SENDGRID_API_KEY_SECRET = "SENDGRID_API_KEY"
powershell -ExecutionPolicy Bypass -File .\cloudrun-etl\services\deploy-cloudrun-services.ps1 -Service admin-notes-email
```

#### Bash

```bash
export SENDGRID_API_KEY_SECRET="SENDGRID_API_KEY"
pwsh -ExecutionPolicy Bypass -File ./cloudrun-etl/services/deploy-cloudrun-services.ps1 -Service admin-notes-email
```

Notes:

- If both variables are set, the deploy script prefers secret-based wiring for `SENDGRID_API_KEY`.
- The service code reads `process.env.SENDGRID_API_KEY` at runtime.

## 7) Python service snapshots/reference folders under services

These directories contain related Python function code used for geocoding, clustering, account deletion, and daily delivery updates:

- `services/cluster-deliveries-k-means/`
  - `clustering.py`, `requirements.txt`
  - K-means constrained clustering logic.
- `services/geocode-addresses-endpoint/`
  - `clustering.py`, `requirements.txt`
  - Geocode endpoint logic using Maps API.
- `services/functions-python/`
  - `main.py`, `clustering.py`, `requirements.txt`, `README.md`
  - Consolidated Firebase/Python function definitions and docs.
- `services/deleteuseraccount/`
  - `main.py`, `requirements.txt`
  - Callable function to delete Auth + Firestore user data with auth/role checks.
- `services/updatedeliveriesdaily/`
  - `main.py`, `requirements.txt`
  - Scheduled function to append completed daily deliveries.

These are important for operational context and recovery/sync history even if they are not all deployed through the current Cloud Run deployment scripts.

## 8) Service-by-service environment expectations

### Email services

Expected env vars:

- `SENDGRID_API_KEY` (required for sending)
- `FROM_EMAIL` (from `email-config.json` or service fallback)
- `TO_EMAIL` (from `email-config.json` or service fallback)

### active-status-etl

- Uses Firebase Admin credentials from Cloud Run runtime identity in deployed environment.

### Geocode/clustering references

- Depend on Google Maps API key secret for geocoding flow.

## 9) End-to-end flow summary

1. Deploy script chooses services and source folders.
2. Cloud Run revisions are deployed with configured env vars/secrets.
3. Scheduler or manual HTTP calls trigger service endpoints.
4. Services read Firestore and run business logic.
5. Email services attempt SendGrid sends; ETL service updates Firestore state.

## 10) Operational checks

Useful checks after deploy:

```bash
gcloud run services describe admin-notes-email --region us-central1 --format=json
gcloud run services describe check-remaining-deliveries --region us-central1 --format=json
gcloud run services describe tefap-email --region us-central1 --format=json
```

Look under:

- `spec.template.spec.containers[0].env`

to verify `SENDGRID_API_KEY`, `FROM_EMAIL`, and `TO_EMAIL` are present as expected.
