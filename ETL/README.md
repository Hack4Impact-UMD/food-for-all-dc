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

3. Install ETL dependencies into the venv:

  ```sh
  pip install -r ETL/requirements.txt
  ```

### 2. Place the required Excel files

- `FFA_CLIENT_DATABASE.xlsx`: The main client database exported from Google Sheets as an Excel file.
- `Client Referral Form v.3_20_24 (Responses).xlsx`: Referral/case worker form responses exported from Google Sheets as an Excel file.

**Note:** Download/export the Google Sheets as `.xlsx` files and place
them in the `ETL` folder before running the ETL.

### 3. Run the ETL (npm, recommended)

From the repo root:

```sh
cd my-app
npm run etl
```

This command:

- Changes to the repo root,
- Uses `venv\Scripts\python.exe`, and
- Runs `ETL/run_full_etl_with_promotion.py`, which:
  - Loads data into `temp-profile2` / `temp-referral`,
  - Runs the sandbox referral cleanup steps, then
  - Promotes the cleaned data into `client-profile2` / `referral` and
   deletes the temp collections.

### 4. Run the ETL directly with Python (alternative)

With the venv activated at the repo root:

1. To run just the core ETL into the currently configured collections
  (for example, the sandbox collections `temp-profile2` and
  `temp-referral`), run:

  ```sh
  python ETL/firebase_migration_v2.py
  ```

2. To run the **full pipeline** (ETL into sandbox → sandbox referral
  cleanup → promotion into `client-profile2` / `referral` and deletion
  of temps) in one shot, run:

  ```sh
  python ETL/run_full_etl_with_promotion.py
  ```

After the ETL completes (either via the standalone script or the full
pipeline), see **Post‑ETL Referral Cleanup & Promotion** below for how
to review and finalize referral/case worker data.

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
| Address 2                   | client-profile2       | address2                  |
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

## Business Logic & Data Cleaning
- **Referral Deduplication:**
  - Referrals are deduplicated by email, or by name + organization.
  - The script also checks for swapped or ambiguous name/organization fields and uses heuristics to match existing referrals.
  - Multi-value and ambiguous fields are split and normalized.
- **Data Normalization:**
  - All string fields are stripped and type-checked to avoid errors.
  - Organization/person keywords are used to help assign ambiguous referral fields.
- **Error Logging:**
  - Failed inserts are logged to text files with a date-stamped filename for auditability.
- **Geocoding:**
  - Addresses are geocoded where possible; failures are logged but do not halt the ETL.

## Post‑ETL Referral Cleanup & Promotion

After a full migration (running `firebase_migration_v2.py`), there is an optional but recommended referral cleanup flow to normalize case worker data and prune unusable entries.

### Recommended Run Order (sandbox first)

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

### 4b. Promote temp-profile2 and temp-referral into production (alternative)

If you have validated both sandbox collections `temp-profile2` (clients)
and `temp-referral` (case workers) and want to replace the live
collections in one step, you can use:

```sh
python ETL/promote_temp_clients_and_referrals.py
```

This script will:

- Delete all existing documents from `client-profile2` and `referral`.
- Copy all documents from `temp-profile2` into `client-profile2` using
  the same document IDs.
- Copy all documents from `temp-referral` into `referral` using the
  same document IDs.
- Delete the documents from `temp-profile2` and `temp-referral` once
  the promotion is complete.

Because document IDs are preserved, any `referralEntity.id` references
on clients will continue to point at the matching referral documents
after the promotion.

### 5. Frontend Configuration (caseWorkersCollection)

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
