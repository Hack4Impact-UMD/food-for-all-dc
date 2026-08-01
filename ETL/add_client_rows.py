"""Add selected workbook rows to production without updating existing clients.

This command is intentionally add-only. Existing client document IDs cause the
entire run to abort. Use the application to update existing client data.
"""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path
from typing import Iterable

import firebase_admin
import pandas as pd
from firebase_admin import credentials, firestore


SERVICE_ACCOUNT_PATH = os.path.join(
    "ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
)
PROJECT_ID = "food-for-all-dc-caf23"
DEFAULT_WORKBOOK = os.path.join("ETL", "FFA_CLIENT_DATABASE_JULY2026.xlsx")
DEFAULT_SHEET = "Current Deliveries"
PRODUCTION_CLIENTS_COLLECTION = "client-profile2"
PRODUCTION_REFERRALS_COLLECTION = "referral"
CONFIRMATION_PHRASE = "ADD ONLY"


def parse_row_numbers(values: Iterable[str]) -> list[int]:
    """Parse comma/space-separated Excel row numbers and inclusive ranges."""
    row_numbers: list[int] = []
    seen: set[int] = set()

    for token in re.split(r"[\s,]+", " ".join(values).strip()):
        if not token:
            continue
        if re.fullmatch(r"\d+-\d+", token):
            start, end = (int(value) for value in token.split("-", 1))
            if start > end:
                raise ValueError(f"Row range must be ascending: {token}")
            candidates = range(start, end + 1)
        elif token.isdigit():
            candidates = (int(token),)
        else:
            raise ValueError(f"Invalid row number or range: {token}")

        for row_number in candidates:
            if row_number < 2:
                raise ValueError("Excel row numbers must be 2 or greater; row 1 contains headers.")
            if row_number not in seen:
                seen.add(row_number)
                row_numbers.append(row_number)

    if not row_numbers:
        raise ValueError("At least one Excel row number is required.")
    return row_numbers


def select_rows(dataframe: pd.DataFrame, row_numbers: list[int]) -> list[dict]:
    """Return normalized workbook records in the requested row order."""
    if "_excel_row_num" not in dataframe.columns:
        raise ValueError("Workbook data is missing Excel row-number metadata.")
    if "ID" not in dataframe.columns:
        raise ValueError("Workbook sheet does not contain an ID column.")

    records_by_row = {
        int(record["_excel_row_num"]): record
        for record in dataframe.to_dict(orient="records")
    }
    missing_rows = [row_number for row_number in row_numbers if row_number not in records_by_row]
    if missing_rows:
        raise ValueError(f"Workbook rows not found: {', '.join(map(str, missing_rows))}")

    records = [records_by_row[row_number] for row_number in row_numbers]
    invalid_rows = []
    client_ids = []
    for record in records:
        raw_id = record.get("ID")
        if pd.isna(raw_id):
            client_id = ""
        elif isinstance(raw_id, float) and raw_id.is_integer():
            client_id = str(int(raw_id))
        else:
            client_id = str(raw_id).strip()
        if client_id.lower() in {"", "nan", "none", "null"}:
            invalid_rows.append(int(record["_excel_row_num"]))
        record["ID"] = client_id
        client_ids.append(client_id)
    if invalid_rows:
        raise ValueError(f"Selected rows have no stable ID: {', '.join(map(str, invalid_rows))}")

    duplicate_ids = sorted(
        client_id for client_id in set(client_ids) if client_ids.count(client_id) > 1
    )
    if duplicate_ids:
        raise ValueError(f"Selected rows contain duplicate IDs: {', '.join(duplicate_ids)}")
    return records


def find_existing_client_ids(db: firestore.Client, client_ids: Iterable[str]) -> list[str]:
    """Return selected IDs that already exist in production."""
    references = [
        db.collection(PRODUCTION_CLIENTS_COLLECTION).document(client_id)
        for client_id in client_ids
    ]
    return sorted(snapshot.id for snapshot in db.get_all(references) if snapshot.exists)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Add new FFA client workbook rows to production. ADD ONLY: use the app "
            "to update clients that already exist."
        )
    )
    parser.add_argument(
        "--rows",
        nargs="+",
        required=True,
        help=(
            "Excel row numbers, comma-separated values, or ranges "
            "(for example: 120 125,130 140-142)."
        ),
    )
    parser.add_argument(
        "--workbook",
        default=DEFAULT_WORKBOOK,
        help="Path to FFA_CLIENT_DATABASE_[DATE].xlsx.",
    )
    parser.add_argument(
        "--sheet",
        default=DEFAULT_SHEET,
        help="Workbook sheet containing client rows.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    try:
        row_numbers = parse_row_numbers(args.rows)
    except ValueError as error:
        print(f"ERROR: {error}")
        return 2

    workbook = Path(args.workbook)
    if not workbook.exists():
        print(f"ERROR: Workbook not found: {workbook}")
        return 2

    import firebase_migration_v2 as migration_module

    try:
        dataframe = pd.read_excel(workbook, sheet_name=args.sheet, dtype=object)
        dataframe = migration_module.normalize_client_database_dataframe(dataframe)
        records = select_rows(dataframe, row_numbers)
    except Exception as error:
        print(f"ERROR: Unable to load selected workbook rows: {error}")
        return 2

    api_key = os.getenv("REACT_APP_GOOGLE_MAPS_API_KEY") or os.getenv(
        "GOOGLE_MAPS_API_KEY", ""
    )
    if not api_key:
        print(
            "ERROR: Set REACT_APP_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY "
            "before running add-only ETL."
        )
        return 2

    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            credentials.Certificate(SERVICE_ACCOUNT_PATH),
            {"projectId": PROJECT_ID},
        )
    db = firestore.client()

    client_ids = [record["ID"] for record in records]
    existing_ids = find_existing_client_ids(db, client_ids)
    if existing_ids:
        print("ERROR: Add-only ETL cannot overwrite existing clients:")
        for client_id in existing_ids:
            print(f"  - {client_id}")
        print("Use the Food For All application to update existing client data.")
        return 1

    print("\nADD-ONLY PRODUCTION IMPORT")
    print("This command creates new clients only. It never updates existing client documents.")
    print("Use the Food For All application for updates to existing clients.\n")
    print("Existing events and clusters will be kept; route-data deletion is disabled.\n")
    for record in records:
        first_name = record.get("FIRST_database") or record.get("FIRST", "")
        last_name = record.get("LAST_database") or record.get("LAST", "")
        name = f"{first_name} {last_name}".strip()
        print(f"  Excel row {int(record['_excel_row_num'])}: {record['ID']} - {name}")

    confirmation = input(
        f"\nType {CONFIRMATION_PHRASE} to create these clients: "
    ).strip()
    if confirmation != CONFIRMATION_PHRASE:
        print("Cancelled. No client data was written.")
        return 1

    migration = migration_module.FirestoreMigration(
        service_account_path=SERVICE_ACCOUNT_PATH,
        project_id=PROJECT_ID,
        collection_name=PRODUCTION_CLIENTS_COLLECTION,
        referral_collection_name=PRODUCTION_REFERRALS_COLLECTION,
        create_only=True,
    )
    stats = migration.migrate_data(
        file_path=None,
        batch_size=min(250, len(records)),
        max_workers=1,
        use_threading=False,
        records_override=records,
    )

    if stats.failed_imports or stats.successful_imports != len(records):
        print(
            f"ERROR: Add-only import created {stats.successful_imports}/{len(records)} clients "
            f"with {stats.failed_imports} failure(s). Review ETL error logs."
        )
        return 1

    print(f"Successfully added {stats.successful_imports} new production client(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
