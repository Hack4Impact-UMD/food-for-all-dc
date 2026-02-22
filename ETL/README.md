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

### 2. Place the required Excel files

- `FFA_CLIENT_DATABASE.xlsx`: The main client database exported from Google Sheets as an Excel file.
- `Client Referral Form v.3_20_24 (Responses).xlsx`: Referral/case worker form responses exported from Google Sheets as an Excel file.

**Note:** Download/export the Google Sheets as `.xlsx` files and place
them in the `ETL` folder before running the ETL.

## ETL Workflow Options

The ETL system uses a **staging workflow** with temporary collections (`temp-profile2` and `temp-referral`) that you can review before promoting to production (`client-profile2` and `referral`). Choose the option that fits your needs:

### Quick Reference

| Option | Command | Loads to Temp? | Promotes to Production? | Deletes Temp? | Cost |
|--------|---------|----------------|------------------------|---------------|------|
| **1. Single Batch** | `firebase_migration_v2.py` (with limit) | ✅ 250 records | ❌ | ❌ | ~$1.25 |
| **2. Full to Temp** | `firebase_migration_v2.py` (no limit) | ✅ All records | ❌ | ❌ | ~$15.75 |
| **3. Promote Only** | `promote_temp_clients_and_referrals.py` | ➖ (uses existing) | ✅ | ✅ | $0 |
| **4. Full Pipeline** | `run_full_etl_with_promotion.py` | ✅ All records | ✅ | ✅ | ~$15.75 |
| **5. NPM Command** | `npm run etl` | ✅ All records | ✅ | ✅ | ~$15.75 |

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
- **Cost:** ~$1.25 for geocoding

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
- **Cost:** ~$15.75 for geocoding

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
- **Cost:** $0 (no geocoding)

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
- **Cost:** ~$15.75 for geocoding

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
- `FFA_CLIENT_DATABASE.xlsx`: The main client database exported from Google Sheets as an Excel file.
- `Client Referral Form v.3_20_24 (Responses).xlsx`: Referral/case worker form responses exported from Google Sheets as an Excel file.

**Note:** You must download/export the Google Sheets as `.xlsx` files and place them in this folder before running the ETL.

## Data Mapping
Below is a mapping of the key fields from the Excel files to Firestore document stores and fields:

### FFA_CLIENT_DATABASE.xlsx → Firestore
| Excel Column                | Firestore Collection   | Firestore Field           |
|-----------------------------|-----------------------|---------------------------|
| ID                          | client-profile2       | uid                       |
| First Name                  | client-profile2       | firstName                 |
| Last Name                   | client-profile2       | lastName                  |
| Address                     | client-profile2       | address                   |
| Address 2                   | client-profile2       | address2 (from APT column; if APT is empty, ETL will try to pull an "Apt/Unit" suffix from ADDRESS) |
| Zip Code                    | client-profile2       | zipCode                   |
| City                        | client-profile2       | city                      |
| State                       | client-profile2       | state                     |
| Quadrant                    | client-profile2       | quadrant                  |
| DOB                         | client-profile2       | dob                       |
| Phone                       | client-profile2       | phone                     |
| Email                       | client-profile2       | email                     |
| Alternative Phone           | client-profile2       | alternativePhone          |
| Adults                      | client-profile2       | adults                    |
| Children                    | client-profile2       | children                  |
| Total                       | client-profile2       | total                     |
| Gender                      | client-profile2       | gender                    |
| Ethnicity                   | client-profile2       | ethnicity                 |
| Delivery Frequency          | client-profile2       | deliveryFreq              |
| Delivery Instructions       | client-profile2       | deliveryDetails.deliveryInstructions |
| Dietary Restrictions        | client-profile2       | deliveryDetails.dietaryRestrictions  |
| Life Challenges             | client-profile2       | lifeChallenges            |
| Physical Ailments           | client-profile2       | physicalAilments          |
| Physical Disability         | client-profile2       | physicalDisability        |
| Referral/Case Worker        | referral              | referralEntity on client-profile2 is linked to a doc in `referral`; the referral doc holds name, organization, email, phone |

### Client Referral Form v.3_20_24 (Responses).xlsx → Firestore
| Excel Column                | Firestore Collection   | Firestore Field           |
|-----------------------------|-----------------------|---------------------------|
| Name                        | referral              | name                      |
| Organization                | referral              | organization               |
| Email                       | referral              | email                     |
| Phone                       | referral              | phone                     |

## Geocoding and Google Maps API Key

The ETL uses the Google Maps Geocoding API to convert addresses to latitude/longitude coordinates. The API key is automatically loaded from `my-app/.env` (as `REACT_APP_GOOGLE_MAPS_API_KEY`).

**Important:** The API key must be set in `my-app/.env` before running the ETL. If the key is missing, the ETL will abort and clean up any temporary collections.

**Note:** The ETL no longer uses OpenStreetMap/Nominatim for geocoding. All address lookups are now performed via Google Maps.

### Cost Estimates
- **Single batch (250 records):** ~$1.25
- **Full ETL (~3,150 records, ~191 active):** ~$15.75

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

### Processing Limited Records (Testing)

To process only a specific number of records (useful for testing):

```powershell
# Set limit to 250 records
$env:MIGRATION_LIMIT_RECORDS = "250"

# Run ETL (processes only first 250 records)
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\firebase_migration_v2.py
```

**Important:** Environment variables persist for the entire terminal session. If you set `MIGRATION_LIMIT_RECORDS` for testing, you **must** clear it before running the full ETL:

```powershell
# Option 1: Clear then run (two commands)
Remove-Item Env:\MIGRATION_LIMIT_RECORDS
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\firebase_migration_v2.py

# Option 2: Clear and run in one command
Remove-Item Env:\MIGRATION_LIMIT_RECORDS; & "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\firebase_migration_v2.py
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
