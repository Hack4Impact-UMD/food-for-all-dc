# ETL Folder

## Overview
This folder contains scripts and resources for running the full ETL (Extract, Transform, Load) process for Food For All DC. The ETL process loads and normalizes client and referral/case worker data from spreadsheets into Firebase Firestore.

## Quick Start

### 1. Install Python and create a virtual environment (Windows)

1. Install Python 3.10+ from https://www.python.org/downloads/ and
  ensure that **“Add Python to PATH”** is checked.
2. From the repo root (`food-for-all-dc`), create a virtual
  environment and activate it:

  ```sh
  python -m venv venv
  .\venv\Scripts\activate
  ```

3. Install ETL dependencies into the venv (including `rich` for
   colorful terminal output during the ETL pipeline):

  ```sh
  pip install -r ETL/requirements.txt
  ```

### 1b. Install Python and create a virtual environment (Mac)

1. Install Python 3.10+.
2. From the repo root (`food-for-all-dc`), create a virtual
  environment and activate it:

  ```sh
  python3 -m venv venv
  source venv/bin/activate
  ```

3. Install ETL dependencies into the venv:

  ```sh
  pip install -r ETL/requirements.txt
  ```

### 1c. Firebase Service Account Key (Required)

The ETL scripts authenticate to Firestore using a Firebase Admin SDK service-account key file.

Current expected path in scripts:

- `ETL/food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json`

What this file is used for:

- Allows Python ETL scripts to connect to your Firebase/Firestore project.
- Required for reads/writes in `temp-profile2`, `temp-referral`, `client-profile2`, and `referral`.

How to create your own service-account key:

1. Open Firebase Console for your project.
2. Go to `Project settings` -> `Service accounts`.
3. Click `Generate new private key` (Admin SDK).
4. Download the JSON key file.
5. Place it in the repo `ETL` folder.

File naming options:

- Easiest: rename your downloaded file to exactly:
  - `food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json`
- Or keep your own filename and update the `SERVICE_ACCOUNT_PATH` constant in ETL scripts that use it.

Security requirements:

- Treat this JSON like a secret password.
- Never commit it to git or share in chat/email.
- `.gitignore` already excludes Firebase Admin SDK key patterns.
- If a key is ever exposed, revoke/delete it immediately and generate a new one.

### 2. Place the required Excel files

- `FFA_CLIENT_DATABASE_JULY2026.xlsx`: The main client database exported from Google Sheets as an Excel file.
- `Client Referral Form v.3_20_24 (Responses).xlsx`: Referral/case worker form responses exported from Google Sheets as an Excel file.

**Note:** Download/export the Google Sheets as `.xlsx` files and place
them in the `ETL` folder before running the ETL.

### 2a. Download Source Google Sheets (Required)

You must have Food For All access permissions to both Google Sheets below.
If you cannot open either link, request access before running ETL.

- Client Referral Form Google Sheet:
  https://docs.google.com/spreadsheets/d/18ZRe3-l3DpZ2Ipsr2sMChlRjYFow5r7ZPhfeEfX_3D8/edit?gid=2051848548#gid=2051848548
- FFA Clients Database Google Sheet:
  https://docs.google.com/spreadsheets/d/1MziKHGkmBkRm1ae2h5bWjIrRbNFczqh6cXwes7_9xOE/edit?pli=1&gid=264316916#gid=264316916

For each sheet:

1. Open the Google Sheet.
2. Click `File` -> `Download` -> `Microsoft Excel (.xlsx)`.
3. Save the files with these exact names:
   - `FFA_CLIENT_DATABASE_JULY2026.xlsx`
   - `Client Referral Form v.3_20_24 (Responses).xlsx`
4. Move both files into the `ETL` folder:
   - `food-for-all-dc/ETL/FFA_CLIENT_DATABASE_JULY2026.xlsx`
   - `food-for-all-dc/ETL/Client Referral Form v.3_20_24 (Responses).xlsx`

The ETL script expects those names and locations.

## ETL Workflow Options

The ETL system uses a **staging workflow** with temporary collections (`temp-profile2` and `temp-referral`) that you can review before promoting to production (`client-profile2` and `referral`). Choose the option that fits your needs:

### Mac/Linux command equivalents (after activating venv)

If you are using Mac (or Linux), use these equivalents:

```sh
# Option 1: Single batch
export MIGRATION_LIMIT_RECORDS=250
python ETL/firebase_migration_v2.py

# Option 2: Full ETL to temp
unset MIGRATION_LIMIT_RECORDS
python ETL/firebase_migration_v2.py

# Option 3: Promote temp to production
python ETL/promote_temp_clients_and_referrals.py

# Option 4: Full pipeline
python ETL/run_full_etl_with_promotion.py
```

### Quick Reference

| Option | Command | Loads to Temp? | Promotes to Production? | Deletes Temp? | Cost (Geocoding + Firestore ops) |
|--------|---------|----------------|------------------------|---------------|------|
| **1. Single Batch** | `firebase_migration_v2.py` (with limit) | ✅ 250 records | ❌ | ❌ | ~ $1.25 geocoding + ~ $0.01 Firestore (total: ~ $1.26) |
| **2. Full to Temp** | `firebase_migration_v2.py` (no limit) | ✅ All records | ❌ | ❌ | ~ $15.75 geocoding + ~ $0.03 Firestore (total: ~ $15.78) |
| **3. Promote Only** | `promote_temp_clients_and_referrals.py` | ➖ (uses existing) | ✅ | ✅ | Firestore estimate: ~ $0.02 |
| **4. Full Pipeline** | `run_full_etl_with_promotion.py` | ✅ All records | ✅ | ✅ | ~ $15.75 geocoding + Firestore ops (total: ~$15.80) |
| **5. NPM Command** | `npm run etl` | ✅ All records | ✅ | ✅ | ~ $15.75 geocoding + Firestore ops (total: ~$15.80) |

---

### Option 1: Test with Single Batch (Recommended for Development)

**Use when:** Testing changes, validating transformations, or minimizing API costs

**What it does:** Loads only 250 records into temp collections

**Command:**
```powershell
$env:MIGRATION_LIMIT_RECORDS = "250"
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\firebase_migration_v2.py
```

**Result:**
- ✅ Creates documents in `temp-profile2` and `temp-referral` (250 records)
- ❌ Does NOT touch `client-profile2` or `referral` (production)
- ❌ Does NOT delete temp collections
- **Cost:** ~ $1.25 geocoding + ~ $0.01 Firestore (estimated total: ~ $1.26)

---

### Option 2: Full ETL to Temp Collections (Recommended for Review)

**Use when:** Loading all data for review before promoting to production

**What it does:** Loads ~3,150 records into temp collections

**Command:**
```powershell
# Make sure MIGRATION_LIMIT_RECORDS is NOT set
Remove-Item Env:\MIGRATION_LIMIT_RECORDS -ErrorAction SilentlyContinue
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\firebase_migration_v2.py
```

**Result:**
- ✅ Creates documents in `temp-profile2` and `temp-referral` (all records)
- ❌ Does NOT touch `client-profile2` or `referral` (production)
- ❌ Does NOT delete temp collections
- **Cost:** ~ $15.75 geocoding + ~ $0.03 Firestore (estimated total: ~ $15.78)

**Next step:** Review temp collections in Firestore, then use **Option 3** to promote

---

### Option 3: Promote Temp to Production (After Review)

**Use when:** You've already run Option 1 or 2 and reviewed the temp data

**What it does:** Copies validated temp data to production and cleans up

**Command:**
```powershell
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\promote_temp_clients_and_referrals.py
```

**Result:**
- ⚠️  **DESTRUCTIVE:** Deletes ALL existing docs in `client-profile2` and `referral`
- ✅ Copies `temp-profile2` → `client-profile2` (preserves document IDs)
- ✅ Copies `temp-referral` → `referral` (preserves document IDs)
- ✅ Deletes `temp-profile2` and `temp-referral` collections
- **Cost:** No geocoding cost; Firestore operations only (estimate: ~ $0.02)

---

### Option 4: Full Pipeline (ETL → Clean → Promote)

**Use when:** You want to run everything in one command without reviewing temp data

**What it does:** Runs all 4 steps automatically:
1. ETL into temp collections
2. Prune referrals with no contact info
3. Clean up referral name/organization fields
4. Promote to production and delete temp

**Command:**
```powershell
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\run_full_etl_with_promotion.py
```

**Result:**
- ⚠️  **DESTRUCTIVE:** Deletes ALL existing docs in `client-profile2` and `referral`
- ✅ Fresh data in production collections
- ✅ Temp collections deleted
- **Cost:** ~$15.75 for geocoding, plus Firestore operations from ETL + promotion

---

### Option 5: NPM Command (Simplest)

**Use when:** You want the easiest command to run the full pipeline

**Command:**
```sh
cd my-app
npm run etl
```

**Result:** Same as Option 4 (runs `run_full_etl_with_promotion.py`)

---

### Which Option Should I Use?

| Scenario | Recommended Option |
|----------|-------------------|
| Testing code changes | Option 1 (single batch) |
| First-time ETL or major changes | Option 2 → review → Option 3 |
| Regular production refresh | Option 4 or 5 |
| Already have validated temp data | Option 3 only |

**Important Notes:**
- Options 3, 4, and 5 are **DESTRUCTIVE** - they delete production data
- Always backup production collections before promoting
- Review `temp-profile2` and `temp-referral` in Firestore console after Option 1/2
- Environment variable `MIGRATION_LIMIT_RECORDS` persists for entire terminal session

**For advanced, manual cleanup workflows, see the "Advanced: Manual Referral Cleanup & Promotion" section below.**


## Required Excel Files
- `FFA_CLIENT_DATABASE_JULY2026.xlsx`: The main client database exported from Google Sheets as an Excel file.
- `Client Referral Form v.3_20_24 (Responses).xlsx`: Referral/case worker form responses exported from Google Sheets as an Excel file.

**Note:** You must download/export the Google Sheets as `.xlsx` files and place them in this folder before running the ETL.

## Data Mapping
Below is the current mapping used by `ETL/firebase_migration_v2.py` for the new spreadsheet format.

### FFA_CLIENT_DATABASE_JULY2026.xlsx (sheet: `Current Deliveries`) -> `client-profile2`

| Excel Column(s) | Firestore Field |
|-----------------|-----------------|
| `ID` (also normalized from `CLIENT ID`, `ID#`, and blank/id-like first columns) | `uid` (document ID) |
| `FIRST_database` or `FIRST` | `firstName` |
| `LAST_database` or `LAST` | `lastName` |
| `ADDRESS` (street portion) | `address`, `streetName` |
| `APT` or `APT #` (or apartment suffix parsed from `ADDRESS`) | `address2` |
| `ZIPcode` or `ZIP` (with geocoder fallback) | `zipCode` |
| `City` (or inferred as `Washington` when quadrant/address indicates DC) | `city` |
| `State` (or inferred as `DC` when quadrant/address indicates DC) | `state` |
| `Quadrant_database` or `Quadrant` | `quadrant` |
| `Ward` | `ward` |
| `Phone` | `phone` (or `email` if value contains `@`) |
| `Ethnicity` or `Race/Ethnicity` or `Race` | `ethnicity` |
| `# Adults` or `Adults_database` | `adults` (adjusted when senior logic applies) |
| `# kids` or `kids` or `# Children` | `children` |
| Derived from adults/children/seniors | `total`, `seniors`, `headOfHousehold` |
| `Frequency` | `deliveryFreq`, `recurrence` |
| `Delivery Instructions` | `deliveryDetails.deliveryInstructions` |
| `Diet type`, `Dietary Restrictions`, `Dietary Preferences` | `deliveryDetails.dietaryRestrictions.*` |
| `MainVulnerability`, `Client's Main Vulnerability (Classification)`, `Eligibility_database`, `Eligibility`, `Unnamed: 29`, `further_information` | `lifeChallenges`, `physicalAilments`, `physicalDisability`, `mentalHealthConditions` |
| `Notes` (plus ETL-added notes) | `notes` |
| `Language` | `language` |
| `StartDate_database` or `StartDate_referral` or `Start Date` | `startDate` |
| `EndDate` or `End Date` (defaulted/validated by ETL) | `endDate` |
| `TEFAP_FY25` / `TEFAP FY25` / `TEFAP FY26` | `tefapCert` and `tags` (`TEFAPOnFile`) |
| `Active` and date-window logic | `activeStatus` and `tags` (`Active`) |

### Client Referral Form v.3_20_24 (Responses).xlsx (sheet: `Form Responses 1`) -> `referral`

| Excel Column(s) | Firestore Field |
|-----------------|-----------------|
| `First Name`, `Last Name`, `Address` | Used to match client row for referral enrichment |
| `Name (case manager)` (fallback: `Name`) | `name` |
| `Agency name` (fallback: `Organization`) | `organization` |
| `Email Address` (fallback: `Email`) | `email` |
| `Phone contact` (fallback: `Phone`) | `phone` |

ETL inserts/updates referral documents in `referral` and writes linked values into `client-profile2.referralEntity` (`id`, `name`, `organization`).

## Geocoding and Google Maps API Key

The ETL uses the Google Maps Geocoding API to convert addresses to latitude/longitude coordinates. The API key is automatically loaded from `my-app/.env` (as `REACT_APP_GOOGLE_MAPS_API_KEY`).

**Important:** The API key must be set in `my-app/.env` before running the ETL. If the key is missing, the ETL will abort and clean up any temporary collections.

**Note:** The ETL no longer uses OpenStreetMap/Nominatim for geocoding. All address lookups are now performed via Google Maps.

### Temporary Daily Quota Increase for ETL Runs

Large ETL runs can hit `OVER_QUERY_LIMIT` if the Geocoding API daily quota is too low.

Before a full ETL run:

1. Open the Geocoding quota page for this project:
  - https://console.cloud.google.com/apis/api/geocoding-backend.googleapis.com/quotas?project=food-for-all-dc-caf23
2. Select **v3 requests per day**.
3. Click **Edit** and temporarily raise the daily limit high enough for the run.
4. Save changes, wait 1-2 minutes, then start ETL.

After ETL completes:

1. Return to the same quota page.
2. Set **v3 requests per day** back to the normal daily limit for regular operations.

Why reset it after the run:

- Helps prevent accidental high-volume usage outside ETL windows.
- Keeps cost controls tight for day-to-day operation.
- Makes quota spikes easier to notice in monitoring.

### Troubleshooting: Invalid Coordinates

If the Routes page shows a small number of "invalid coordinates" after a full ETL, older records may still be using the legacy `{latitude, longitude}` object format.

Run this one-time fix **only if you see invalid coordinates**:

```powershell
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\fix_coordinate_format.py
```

Mac/Linux equivalent:

```sh
python ETL/fix_coordinate_format.py
```

This converts existing records to the `[latitude, longitude]` array format and does **not** call the geocoding API.

### Cost Estimates
- **Single batch (250 records):** ~ $1.25 geocoding + ~ $0.01 Firestore (estimated total: ~ $1.26)
- **Full ETL (~3,150 records, ~191 active):** ~ $15.75 geocoding + Firestore ops (total: ~$15.80)

### Cost Breakdown (Geocoding + Firestore)

The total ETL cost has two parts:

1. **Google Maps Geocoding API**
2. **Firestore operations** (reads, writes, deletes)

Geocoding is usually the dominant cost.

Use this estimate model:

- **Geocoding cost** ≈ `(number_of_geocode_requests / 1000) * geocoding_rate_per_1000`
- **Firestore write cost** ≈ `(number_of_writes / 100000) * firestore_write_rate_per_100k`
- **Firestore read cost** ≈ `(number_of_reads / 100000) * firestore_read_rate_per_100k`
- **Firestore delete cost** ≈ `(number_of_deletes / 100000) * firestore_delete_rate_per_100k`

Approximate rates commonly used for planning (verify in your billing region/project):

- Geocoding API: about **$5.00 per 1,000 requests**
- Firestore writes: about **$0.18 per 100,000 writes**
- Firestore reads: about **$0.06 per 100,000 reads**
- Firestore deletes: about **$0.02 per 100,000 deletes**

Example for a full run around 3,150 geocode attempts:

- Geocoding: `3150/1000 * $5.00 ≈ $15.75`
- Firestore ops: typically only a small add-on (often cents to low dollars depending on retries/promotions)

For exact monthly spend, use Cloud Billing reports and filter by:

- **Service:** Google Maps Platform (Geocoding)
- **Service:** Firestore

## Controlling Batch Size with MIGRATION_LIMIT_RECORDS

The `MIGRATION_LIMIT_RECORDS` environment variable controls how many records are processed during an ETL run.

### Processing All Records (Default)

By default, the ETL processes **all records** in the Excel file. Simply ensure the variable is not set:

```powershell
# Clear the variable if it was previously set
Remove-Item Env:\MIGRATION_LIMIT_RECORDS -ErrorAction SilentlyContinue

# Run ETL (processes all records)
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\firebase_migration_v2.py
```

Mac/Linux equivalent:

```sh
unset MIGRATION_LIMIT_RECORDS
python ETL/firebase_migration_v2.py
```

### Processing Limited Records (Testing)

To process only a specific number of records (useful for testing):

```powershell
# Set limit to 250 records
$env:MIGRATION_LIMIT_RECORDS = "250"

# Run ETL (processes only first 250 records)
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\firebase_migration_v2.py
```

Mac/Linux equivalent:

```sh
export MIGRATION_LIMIT_RECORDS=250
python ETL/firebase_migration_v2.py
```

**Important:** Environment variables persist for the entire terminal session. If you set `MIGRATION_LIMIT_RECORDS` for testing, you **must** clear it before running the full ETL:

```powershell
# Option 1: Clear then run (two commands)
Remove-Item Env:\MIGRATION_LIMIT_RECORDS
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\firebase_migration_v2.py

# Option 2: Clear and run in one command
Remove-Item Env:\MIGRATION_LIMIT_RECORDS; & "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\firebase_migration_v2.py
```

Mac/Linux equivalents:

```sh
# Option 1: Clear then run (two commands)
unset MIGRATION_LIMIT_RECORDS
python ETL/firebase_migration_v2.py

# Option 2: Clear and run in one command
unset MIGRATION_LIMIT_RECORDS; python ETL/firebase_migration_v2.py
```

### Verifying Spreadsheet Mappings Before Running ETL

Before each migration run, confirm that the spreadsheet layouts still match the expectations in this table:

- In **FFA_CLIENT_DATABASE.xlsx**:
  - The **Referral/Case Worker** column should contain the same style of free‑text entries (case worker name / org) used when the mapping was last validated.
  - If new columns are added, ensure `firebase_migration_v2.py` is updated if those columns should be loaded.
- In **Client Referral Form v.3_20_24 (Responses).xlsx**:
  - Columns must still be named **Name**, **Organization**, **Email**, **Phone**.
  - If the referral form is versioned or column names change, update the field access in `firebase_migration_v2.py` accordingly.
- If Excel column order or names change, re‑run a small test ETL against a copy of the spreadsheets and confirm:
  - New clients appear in `client-profile2` with correct demographics and address.
  - New case workers appear in `referral` with the expected `name`, `organization`, `email`, and `phone`.
  - Clients show a `referralEntity` that either points at a real `referral` doc or uses the neutral "None" organization when no valid referral exists.

## Business Logic, Data Cleaning, and Logs
- **Referral Deduplication:**
  - Referrals are deduplicated by email, or by name + organization.
  - The script also checks for swapped or ambiguous name/organization fields and uses heuristics to match existing referrals.
  - Multi-value and ambiguous fields are split and normalized.
- **Data Normalization:**
  - All string fields are stripped and type-checked to avoid errors.
  - Organization/person keywords are used to help assign ambiguous referral fields.
- **Error Logging & Diagnostics:**
  - High-level ETL activity (batches, counts, timing) is written to `ETL/migration.log`.
  - Warnings and errors (for example, geocoding issues or records that could not be prepared/inserted) are written to `ETL/error_logs/migration-errors.log`.
  - In the console, you will see a compact progress bar with:
    - Overall percent and record counts,
    - A running `Errors: N` counter, and
    - The current batch/record being processed.
  - Detailed warning/error messages **do not** print to the console during the run to keep the output readable; instead, review `ETL/error_logs/migration-errors.log` after the run if the error counter is non‑zero.
  - At the end of the ETL, the script prints a short summary line telling you whether any warnings/errors were logged and, if so, that you can inspect `ETL/error_logs/migration-errors.log` for full details.
- **Geocoding:**
  - Addresses are geocoded where possible; failures are logged but do not halt the ETL.

## Advanced: Manual Referral Cleanup & Promotion

**Note:** Most users should use the workflow options described in the **ETL Workflow Options** section above. This section covers advanced, manual cleanup steps for special cases.

After running the basic ETL (`firebase_migration_v2.py`), you can optionally perform additional cleanup and validation on referral data before promoting to production. This is useful when:

- You need granular control over each cleanup step
- You want to inspect and manually fix referral data
- The automated cleanup in `run_full_etl_with_promotion.py` isn't sufficient

**For most cases, use Option 4 or 5 from the ETL Workflow Options above, which automates these steps.**

### Manual Cleanup Workflow (When Using Temp Collections)

When `firebase_migration_v2.py` is configured to write into the sandbox
collections (`temp-profile2` for clients and `temp-referral` for case
workers), the typical order is:

1. Run the full ETL into sandbox collections:

  ```sh
  python ETL/firebase_migration_v2.py
  ```

2. Prune sandbox referrals with no contact info and reset linked sandbox
  clients:

  ```sh
  python ETL/prune_temp_referrals_no_contact.py
  ```

3. (Optional) Inspect and refine sandbox case‑worker name/organization
  values:

  ```sh
  python ETL/analyze_temp_referrals.py
  python ETL/cleanup_temp_referrals_name_from_org.py
  ```

Once the sandbox data looks correct, you can decide whether to run the
**production** cleanup/promotion flow below to replace the live
`referral` collection.

### 1. Clone Referral Data to a Temporary Collection (Safe Sandbox)

This step creates a non‑destructive copy of the current `referral` collection into `temp-new-referral` so you can review and clean case workers without touching production data.

```sh
python ETL/referral_cleanup.py
```

Current behavior of `referral_cleanup.py` when run directly:

- Calls `clone_referrals_to_temp()`.
- Reads all docs from `referral`.
- Writes them into `temp-new-referral` with the same document IDs.
- Does **not** modify `client-profile2` or delete any `referral` docs.

### 2. (Optional) Analyze and Clean Name/Organization in temp-new-referral

These scripts operate **only** on `temp-new-referral` and are meant for one‑off cleanup passes:

- `analyze_temp_referrals.py` (read‑only):
  - Scans `temp-new-referral` and prints statistics and sample records where `name`/`organization` look suspicious (combined or swapped).
- `cleanup_temp_referrals_name_from_org.py` (mutating on temp):
  - Applies a set of conservative rules and hand‑tuned fixes to split human names from organizations and normalize obvious problems in `temp-new-referral`.

Run these from the repo root as needed:

```sh
python ETL/analyze_temp_referrals.py
python ETL/cleanup_temp_referrals_name_from_org.py
```

### 3. Prune Temp Referrals with No Contact Info

To remove temp referrals that have **no** phone and **no** email, and to
reset affected **sandbox** client records to a neutral "None"
organization, run:

```sh
python ETL/prune_temp_referrals_no_contact.py
```

This script is currently wired to operate only on the sandbox
collections `temp-referral` (case workers) and `temp-profile2`
(clients); it does **not** touch `referral` or `client-profile2`.

This script will:

- Find all docs in `temp-referral` where both `email` and `phone` are
  empty.
- For each client in `temp-profile2` whose `referralEntity.id` points to
  one of those temp referrals, set:
  - `referralEntity.id = ""`
  - `referralEntity.name = ""`
  - `referralEntity.organization = "None"`
- Delete the matching temp referral docs from `temp-referral`.

At this point, `temp-referral` should contain only referral/case workers
that have at least one contact method.

### 4. Promote Cleaned Temp Referrals Back into referral

Once you are satisfied with the data in `temp-new-referral`, you can rebuild the production `referral` collection from this cleaned dataset:

```sh
python ETL/promote_temp_referrals_to_referral.py
```

What this script does:

- Loads all docs from `temp-new-referral`.
- Deletes any existing docs in `referral`.
- Writes each temp doc into `referral` with the same document ID.

Because client `referralEntity.id` values reference document IDs, preserving IDs during promotion ensures that live clients now point at the cleaned referral entries.

### Promoting Both Clients and Referrals from Temp to Production

See **Option 3** in the **ETL Workflow Options** section above for details on running `promote_temp_clients_and_referrals.py`.

This script is the final step if you've validated both `temp-profile2` (clients) and `temp-referral` (case workers) and want to replace the production collections.

### Frontend Configuration (caseWorkersCollection)

The React app determines which collection to use for case workers via `caseWorkersCollection` in:

- `my-app/src/config/dataSources.config.json`

Typical flow during cleanup:

1. Point the app to the temp collection while reviewing fixes:
   - Set `"caseWorkersCollection": "temp-new-referral"`.
2. After promotion back to `referral`, point the app to the real collection again:
   - Set `"caseWorkersCollection": "referral"`.

This allows safe, iterative cleanup in `temp-new-referral` without impacting production users until you are ready.

## Notes
- This folder is for local, one-off, or audit ETL jobs. For production/automated ETL, see the `cloudrun-etl` folder.
- Always verify the mapping and normalization logic if the spreadsheet format changes.
