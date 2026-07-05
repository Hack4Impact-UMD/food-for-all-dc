"""Run the migration for a single client (e.g., Lily Foglio) to verify
that referral email/phone from the client referral form are populated
correctly in Firestore.

Usage (from repo root, with venv activated):

    python ETL/run_single_client.py
"""

import os
from typing import List, Dict, Any

import pandas as pd

from firebase_migration_v2 import (
    CLIENT_COLLECTION_NAME,
    CLIENT_DATABASE_FILE_PATH,
    CLIENT_DATABASE_SHEET_NAME,
    FirestoreMigration,
    normalize_client_database_dataframe,
)

SERVICE_ACCOUNT_PATH = os.path.join(
    "ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
)
PROJECT_ID = "food-for-all-dc-caf23"
EXCEL_FILE_PATH = CLIENT_DATABASE_FILE_PATH
EXCEL_SHEET_NAME = CLIENT_DATABASE_SHEET_NAME


def load_target_records() -> List[Dict[str, Any]]:
    """Load just the row(s) for the target client from the Excel sheet.

    We currently identify the target by last name "Foglio" and then
    optionally filter by first name variants that might appear.
    """

    if not os.path.exists(EXCEL_FILE_PATH):
        raise FileNotFoundError(f"Excel file not found at {EXCEL_FILE_PATH}")

    df = pd.read_excel(EXCEL_FILE_PATH, sheet_name=EXCEL_SHEET_NAME, dtype=object)
    df = normalize_client_database_dataframe(df)

    # Normalize ID to string and drop blank IDs, mirroring the main ETL.
    if "ID" not in df.columns:
        raise RuntimeError(
            f"Sheet '{EXCEL_SHEET_NAME}' missing an ID column after normalization"
        )

    df["ID"] = df["ID"].astype(str)
    df = df[df["ID"].str.strip() != ""]

    def norm(val: Any) -> str:
        return str(val).strip().lower() if val is not None else ""

    last_candidates = {"foglio"}
    first_candidates = {"lily", "litly", "lilly"}

    rows: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        first = norm(row.get("FIRST_database") or row.get("FIRST"))
        last = norm(row.get("LAST_database") or row.get("LAST"))
        if last in last_candidates and (not first_candidates or first in first_candidates):
            rows.append(row.to_dict())

    return rows


def main() -> None:
    records = load_target_records()
    if not records:
        print("⚠️ No records found for last name 'Foglio' (with Lily/Litly/Lilly variants).")
        return

    print(f"📄 Loaded {len(records)} record(s) for target client; IDs: {[r.get('ID') for r in records]}")

    migration = FirestoreMigration(
        service_account_path=SERVICE_ACCOUNT_PATH,
        project_id=PROJECT_ID,
        collection_name=CLIENT_COLLECTION_NAME,
    )

    # Run migrate_data on just these records (no limit, small batch size).
    stats = migration.migrate_data(
        file_path=None,
        batch_size=len(records) or 1,
        max_workers=1,
        use_threading=False,
        limit=None,
        records_override=records,
    )

    print(
        f"✅ Single-client migration completed: {stats.successful_imports}/"
        f"{stats.total_records} successful"
    )


if __name__ == "__main__":
    main()
