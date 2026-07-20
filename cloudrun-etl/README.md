# cloudrun-etl

## Purpose
This folder is the Cloud Run operations workspace for Food For All DC. It includes:
- The `active-status-etl` service source and local run instructions.
- Recovered source snapshots for other deployed Cloud Run services under `services/`.
- Shared service configuration (for example, email settings) used by multiple services.
- Deployment scripts for common workflows (deploy all services, email-only services, or a single service).

Use this folder when you need to understand, run, or deploy Cloud Run components in this project.

## Folder Contents
- `main.py`: Main ETL entry point for Cloud Run.
- `update_active_status.py`: Script to update client active/inactive status nightly based on date ranges.
- `requirements.txt`: Python dependencies.
- `food-for-all-dc-caf23-firebase-adminsdk-*.json`: Firebase service account key.
- `Dockerfile`: Container build instructions for Cloud Run.

## Notes
- This folder is for automated, production-scale ETL jobs. For local, one-off, or audit ETL, see the `ETL` folder.
- The `update_active_status.py` script is designed to be run nightly and will keep the `activeStatus` field up to date for all clients.
- Make sure to keep secrets (service account keys) secure and do not commit them to public repositories.

## Cloud Run Services Overview

This repository now includes a snapshot of source code for the currently deployed Cloud Run services under `services/`.

### What can be deployed with the scripts in this folder?

The deploy scripts in this folder support only these Cloud Run services:
- `active-status-etl`
- `admin-notes-email`
- `check-remaining-deliveries`
- `tefap-email`
- `route-exports`

Other entries in this overview are included as source snapshots/reference and are not currently part of the deploy script targets.

### 1) active-status-etl
- **Purpose:** Updates each client `activeStatus` using `startDate` and `endDate`.
- **Trigger style:** HTTP endpoint (typically invoked by scheduler).
- **Local source:**
  - `main.py`
  - `update_active_status.py`

#### Nightly Active/Inactive Status Update
The main script (`update_active_status.py`) checks each client's `startDate` and `endDate`:

- If today's date is between `startDate` and `endDate` (inclusive), the client is marked as **active**.
- Otherwise, the client is marked as **inactive**.

This update is intended to run nightly (for example, from Cloud Scheduler) so `activeStatus` remains current.

### 2) admin-notes-email
- **Purpose:** Builds a weekly summary of recent admin-note updates and emails the report.
- **Trigger style:** HTTP Cloud Run service.
- **Local source:**
  - `services/admin-notes-email/index.js`

### 3) check-remaining-deliveries
- **Purpose:** Finds clients with exactly one future delivery remaining and emails a warning report.
- **Trigger style:** HTTP Cloud Run service.
- **Local source:**
  - `services/check-remaining-deliveries/index.js`

### 4) tefap-email
- **Purpose:** Reports TEFAP certifications that recently expired or will expire soon.
- **Trigger style:** HTTP Cloud Run service.
- **Local source:**
  - `services/tefap-email/index.js`

### 5) route-exports
- **Purpose:** Generates per-driver delivery CSV exports and emails them.
- **Trigger style:** HTTP Cloud Run service.
- **Local source:**
  - `services/route-exports/index.js`

### 6) cluster-deliveries-k-means
- **Purpose:** Clusters delivery coordinates into route groups using constrained k-means.
- **Trigger style:** HTTP endpoint logic (mapped from Firebase Functions source).
- **Local source:**
  - `services/cluster-deliveries-k-means/clustering.py`

### 7) geocode-addresses-endpoint
- **Purpose:** Converts client addresses into latitude/longitude coordinates.
- **Trigger style:** HTTP endpoint logic (mapped from Firebase Functions source).
- **Local source:**
  - `services/geocode-addresses-endpoint/clustering.py`

### 8) deleteuseraccount
- **Purpose:** Deletes user accounts (Auth + users document) with role/permission checks.
- **Trigger style:** Callable function logic (mapped from Firebase Functions source).
- **Local source:**
  - `services/deleteuseraccount/main.py`

### 9) updatedeliveriesdaily
- **Purpose:** Daily update that appends today's delivery marker for clients with events today.
- **Trigger style:** Scheduled function logic (mapped from Firebase Functions source).
- **Local source:**
  - `services/updatedeliveriesdaily/main.py`

### 10) calendar-email
- **Purpose:** Unknown from current deployment metadata.
- **Current status:** Deployed service points to `gcr.io/cloudrun/placeholder`, so no retrievable source package was available.
- **Reference:** `services/SYNC_MANIFEST.txt`

## Service Source Notes
- `services/` contains recovered snapshots for review and migration planning.
- Some entries are direct Cloud Run source exports, while others are mapped from `my-app/functions-python` where Cloud Run was backed by gcf artifacts.

## Deploy

This section covers full deployment workflows for Cloud Run components in this folder.

Use the helper script in `services/deploy-cloudrun-services.ps1` to deploy one Cloud Run component or all Cloud Run components.

The deploy scripts keep Cloud Run services private by passing `--no-allow-unauthenticated`. Manual callers and schedulers must invoke the services with an authenticated identity that has `roles/run.invoker` on the target service.

### Start Here (First Deployment)

If this is your first time, run these in order from the repo root:

1. `gcloud auth login`
2. `gcloud config set project food-for-all-dc-caf23`
3. `./cloudrun-etl/services/deploy.ps1 -Workflow all`

If step 3 succeeds, you are fully set up.

### If You Are Running On A Mac

These deploy scripts are PowerShell (`.ps1`) scripts. They work on macOS if you run them with PowerShell 7.

1. Install Homebrew if needed:

```sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. Install PowerShell 7 and Google Cloud CLI:

```sh
brew install --cask powershell
brew install --cask google-cloud-sdk
```

3. Reload your shell so new commands are available:

```sh
exec -l $SHELL
```

4. Verify both tools are installed:

```sh
pwsh --version
gcloud --version
```

5. Authenticate and set project:

```sh
gcloud auth login
gcloud config set project food-for-all-dc-caf23
```

6. Run the deploy workflow script with `pwsh`:

```sh
pwsh -File ./cloudrun-etl/services/deploy.ps1 -Workflow all
pwsh -File ./cloudrun-etl/services/deploy.ps1 -Workflow email-all
pwsh -File ./cloudrun-etl/services/deploy.ps1 -Workflow single -Service tefap-email
```

If `pwsh` is not found, install PowerShell 7 first and restart your terminal.

### First-Time GCP Setup (Required Before Deploy)

Run these steps once on your machine:

1. Install and initialize Google Cloud CLI (`gcloud`) if you have not already.
2. Log in to your Google account:

```powershell
gcloud auth login
```

3. Set the active project:

```powershell
gcloud config set project food-for-all-dc-caf23
```

4. (Recommended) Set application default credentials:

```powershell
gcloud auth application-default login
```

5. Verify everything is ready:

```powershell
gcloud auth list
gcloud config get-value project
gcloud run services list --region us-central1
```

If these commands work, you are ready to run the deploy scripts below.

### Common Errors And Quick Fixes

1. Error: `You do not currently have an active account selected`
  Fix:

```powershell
gcloud auth login
gcloud auth list
```

2. Error: `The caller does not have permission` or `PERMISSION_DENIED`
  Fix:
- Ask a project admin to grant Cloud Run deploy permissions (Cloud Run Admin, Cloud Build permissions, and Service Account User on the runtime service account).
- Confirm you are in the right project:

```powershell
gcloud config get-value project
gcloud config set project food-for-all-dc-caf23
```

3. Error: Deployed to the wrong project
  Fix:

```powershell
gcloud config set project food-for-all-dc-caf23
```

4. Error: `gcloud: command not found`
  Fix:
- Install Google Cloud CLI.
- Restart your terminal after install.
- Verify:

```powershell
gcloud --version
```

5. Error: Build/deploy hangs or fails due to stale auth
  Fix:

```powershell
gcloud auth login
gcloud auth application-default login
```

If you want one script with the three common workflows, use `services/deploy.ps1`.

### Workflow Commands

```powershell
# 1) Deploy all cloud run components
./cloudrun-etl/services/deploy.ps1 -Workflow all

# 2) Deploy all email cloud run components
./cloudrun-etl/services/deploy.ps1 -Workflow email-all

# 3) Deploy a single cloud run component
./cloudrun-etl/services/deploy.ps1 -Workflow single -Service tefap-email
```

Optional project and region override:

```powershell
./cloudrun-etl/services/deploy.ps1 -Workflow all -ProjectId food-for-all-dc-caf23 -Region us-central1
```

`-Workflow single` supports these values for `-Service`:
- `active-status-etl`
- `admin-notes-email`
- `check-remaining-deliveries`
- `tefap-email`
- `route-exports`

From the repo root (`food-for-all-dc`):

```powershell
# Deploy all Cloud Run components
./cloudrun-etl/services/deploy-cloudrun-services.ps1

# Deploy only one Cloud Run service
./cloudrun-etl/services/deploy-cloudrun-services.ps1 -Service route-exports
```

Optional flags:

```powershell
./cloudrun-etl/services/deploy-cloudrun-services.ps1 -Service all -ProjectId food-for-all-dc-caf23 -Region us-central1
```

Supported `-Service` values:
- `active-status-etl`
- `admin-notes-email`
- `check-remaining-deliveries`
- `tefap-email`
- `route-exports`
- `all`

For email-only deploys, `services/deploy-email-services.ps1` is still available as a shortcut.

### Optional: Run active-status-etl locally

1. **Set up your environment:**
   - Ensure you have Python 3.9+ and `pip` installed.
   - Install dependencies:
     ```sh
     pip install -r requirements.txt
     ```
   - Make sure you have the required Firebase service account key JSON file in this folder.

2. **Run ETL scripts locally:**
   - To run the main ETL process:
     ```sh
     python main.py
     ```
   - To update client active/inactive status based on date ranges:
     ```sh
     python update_active_status.py
     ```
   - Make sure your terminal's working directory is this folder and the service account key is present.

### Optional: Manual Docker Deploy (active-status-etl only)

If you want to deploy only `active-status-etl` manually (without deploy scripts), use:

```sh
docker build -t gcr.io/[PROJECT-ID]/cloudrun-etl .
docker push gcr.io/[PROJECT-ID]/cloudrun-etl
gcloud run deploy active-status-etl --image gcr.io/[PROJECT-ID]/cloudrun-etl --platform managed
```

Replace `[PROJECT-ID]` with your GCP project ID.

To keep the manual deploy private, include `--no-allow-unauthenticated` or remove any `allUsers` / `allAuthenticatedUsers` Cloud Run Invoker IAM bindings after deployment.
