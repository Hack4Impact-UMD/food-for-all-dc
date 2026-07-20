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
- `--no-allow-unauthenticated`, so callers must authenticate with `roles/run.invoker`.
- Email config and Secret Manager wiring for mailers.

Important behavior:

- For email services, prefer `SENDGRID_API_KEY_SECRET=sendgrid-api-key` so Cloud Run receives `SENDGRID_API_KEY` from Secret Manager.
- Avoid deploying real SendGrid keys as plain environment variables.
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

## 6) SendGrid setup with Secret Manager

The email services use SendGrid through `@sendgrid/mail`. The deployed Cloud Run services should not store the API key as a plain environment variable. Use this Secret Manager setup instead:

- Secret Manager secret name: `sendgrid-api-key`
- Cloud Run env var name: `SENDGRID_API_KEY`
- Cloud Run secret reference: `sendgrid-api-key:latest`
- Sender: `FROM_EMAIL=info@foodforalldc.org`
- Recipient: `TO_EMAIL=database@foodforalldc.org`

The current email services that use this setup are:

- `admin-notes-email`
- `check-remaining-deliveries`
- `tefap-email`

### Create or update the SendGrid secret

Create the secret once if it does not exist:

```bash
gcloud secrets create sendgrid-api-key --replication-policy="automatic"
```

Add a new secret version from the Google Cloud Console Secret Manager UI, or from a shell that will not echo the key. If using Git Bash:

```bash
read -s -p "Paste SendGrid API key: " SENDGRID_KEY
printf "%s" "$SENDGRID_KEY" | gcloud secrets versions add sendgrid-api-key --data-file=-
unset SENDGRID_KEY
```

After adding a new working version, disable old/bad versions so `latest` resolves to the intended key. Do not paste SendGrid keys into chat, source files, commit history, or terminal commands that will be saved in shell history.

### Attach the secret to Cloud Run services

Run these after creating a new secret version or when repairing service configuration:

```bash
gcloud run services update admin-notes-email --region us-central1 --set-secrets SENDGRID_API_KEY=sendgrid-api-key:latest
gcloud run services update check-remaining-deliveries --region us-central1 --set-secrets SENDGRID_API_KEY=sendgrid-api-key:latest
gcloud run services update tefap-email --region us-central1 --set-secrets SENDGRID_API_KEY=sendgrid-api-key:latest
```

Set or repair sender/recipient env vars:

```bash
gcloud run services update admin-notes-email --region us-central1 --update-env-vars "FROM_EMAIL=info@foodforalldc.org,TO_EMAIL=database@foodforalldc.org"
gcloud run services update check-remaining-deliveries --region us-central1 --update-env-vars "FROM_EMAIL=info@foodforalldc.org,TO_EMAIL=database@foodforalldc.org"
gcloud run services update tefap-email --region us-central1 --update-env-vars "FROM_EMAIL=info@foodforalldc.org,TO_EMAIL=database@foodforalldc.org"
```

Remove obsolete Mailjet/SMTP env vars if they appear on a service:

```bash
gcloud run services update check-remaining-deliveries --region us-central1 --remove-env-vars SMTP_HOST,SMTP_PORT,SMTP_USER,SMTP_PASS,MAILJET_API_KEY,MAILJET_SECRET_KEY
gcloud run services update tefap-email --region us-central1 --remove-env-vars MAILJET_API_KEY,MAILJET_SECRET_KEY
```

### Deploy email services using the script

When deploying with `deploy-cloudrun-services.ps1`, pass the Secret Manager secret name through `SENDGRID_API_KEY_SECRET`:

```powershell
$env:SENDGRID_API_KEY_SECRET = "sendgrid-api-key"
powershell -ExecutionPolicy Bypass -File .\cloudrun-etl\services\deploy-cloudrun-services.ps1 -Service admin-notes-email
```

```bash
export SENDGRID_API_KEY_SECRET="sendgrid-api-key"
pwsh -ExecutionPolicy Bypass -File ./cloudrun-etl/services/deploy-cloudrun-services.ps1 -Service admin-notes-email
```

The service code reads `process.env.SENDGRID_API_KEY` at runtime. Cloud Run resolves that value from Secret Manager.

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

- `SENDGRID_API_KEY` (required for sending; should come from `sendgrid-api-key:latest` Secret Manager reference)
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
gcloud run services describe admin-notes-email --region us-central1 --format="value(spec.template.spec.containers[0].env)"
gcloud run services describe check-remaining-deliveries --region us-central1 --format="value(spec.template.spec.containers[0].env)"
gcloud run services describe tefap-email --region us-central1 --format="value(spec.template.spec.containers[0].env)"
```

Expected email env shape:

```text
FROM_EMAIL=info@foodforalldc.org
TO_EMAIL=database@foodforalldc.org
SENDGRID_API_KEY -> secretKeyRef: sendgrid-api-key:latest
```

There should be no `MAILJET_*`, `SMTP_*`, or plaintext `SENDGRID_API_KEY` values on these services.

### Send test emails

The services are private Cloud Run endpoints, so use an identity token when invoking them manually:

```powershell
$token = gcloud auth print-identity-token; curl.exe -sS -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{}" https://admin-notes-email-251910218620.us-central1.run.app
$token = gcloud auth print-identity-token; curl.exe -sS -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{}" https://check-remaining-deliveries-251910218620.us-central1.run.app
$token = gcloud auth print-identity-token; curl.exe -sS -X POST -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{}" https://tefap-email-251910218620.us-central1.run.app
```

Expected behavior:

- `admin-notes-email`: sends only when there are recent client note changes. If no changes exist, it returns `No recent client note changes to report.` and does not send.
- `check-remaining-deliveries`: sends the weekly one-delivery-left report.
- `tefap-email`: sends the TEFAP certification expiration report.

If SendGrid returns `Unauthorized`, verify that the `sendgrid-api-key` latest enabled secret version contains the exact working SendGrid key and that older invalid versions are disabled. The key must have Mail Send permission.
