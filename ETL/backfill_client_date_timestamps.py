"""Backfill client-profile2 calendar dates from strings to Firestore Timestamps.

Mirrors the app-side funnel in my-app/src/utils/clientDate.ts: every calendar
date is stored at noon America/New_York so the day survives being rendered in
any US timezone. Also repairs `createdAt` values that were flattened into plain
{seconds, nanoseconds} maps.

Dry run by default. Writing requires --apply and a typed confirmation.
"""

import argparse
import csv
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

import firebase_admin
from firebase_admin import credentials, firestore

from client_dates import CLIENT_DATE_FIELDS, EASTERN, to_calendar_date, to_eastern_noon

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CREDENTIALS = ROOT / "ETL" / "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"

DATE_FIELDS = list(CLIENT_DATE_FIELDS)

APPLY_CONFIRMATION = "MIGRATE CLIENT DATES"
BATCH_SIZE = 400

CSV_FIELDNAMES = [
    "client_id",
    "field",
    "action",
    "old_type",
    "old_value",
    "new_value_utc",
    "new_value_eastern_day",
]


def parse_calendar_value(value: Any) -> tuple[Optional[datetime], str]:
    """Return (converted, action). `converted` is None when nothing should be written."""
    if value is None:
        return None, "skip_null"
    if isinstance(value, datetime):
        # Already a Timestamp; only rewrite if it is not sitting at Eastern noon.
        eastern = value.astimezone(EASTERN)
        if (eastern.hour, eastern.minute, eastern.second) == (12, 0, 0):
            return None, "skip_already_normalized"
        return to_eastern_noon(eastern.date()), "renormalize_timestamp"
    if isinstance(value, date):
        return to_eastern_noon(value), "convert_date"

    was_flattened_map = isinstance(value, dict)
    calendar_date = to_calendar_date(value)
    if calendar_date is None:
        if isinstance(value, str) and not value.strip():
            return None, "skip_empty"
        return None, "unparseable"

    return (
        to_eastern_noon(calendar_date),
        "repair_flattened_map" if was_flattened_map else "convert_string",
    )


def parse_created_at(value: Any) -> tuple[Optional[datetime], str]:
    """createdAt is an instant, not a calendar day - repair type only, preserve the moment."""
    if isinstance(value, datetime):
        return None, "skip_already_normalized"
    if isinstance(value, dict) and isinstance(value.get("seconds"), (int, float)):
        seconds = value["seconds"]
        nanoseconds = value.get("nanoseconds") or 0
        return (
            datetime.fromtimestamp(seconds + nanoseconds / 1_000_000_000, tz=timezone.utc),
            "repair_flattened_map",
        )
    if value is None:
        return None, "skip_null"
    return None, "unparseable"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collection", default="client-profile2")
    parser.add_argument("--credentials", type=Path, default=DEFAULT_CREDENTIALS)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "ETL" / "audit_reports")
    parser.add_argument("--limit", type=int, help="Only process the first N documents.")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write to Firestore. Without this the script only reports.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(args.credentials)))
    database = firestore.client()

    rows: list[dict[str, Any]] = []
    actions: Counter = Counter()
    unparseable: list[tuple[str, str, Any]] = []
    pending: list[tuple[str, dict[str, Any]]] = []
    total_docs = 0

    for snapshot in database.collection(args.collection).stream():
        if args.limit and total_docs >= args.limit:
            break
        total_docs += 1
        profile = snapshot.to_dict() or {}
        updates: dict[str, Any] = {}

        for field in DATE_FIELDS + ["createdAt"]:
            if field not in profile:
                continue

            raw = profile[field]
            if field == "createdAt":
                converted, action = parse_created_at(raw)
            else:
                converted, action = parse_calendar_value(raw)

            actions[f"{field}:{action}"] += 1

            if action == "unparseable":
                unparseable.append((snapshot.id, field, raw))
            if converted is None:
                continue

            updates[field] = converted
            rows.append(
                {
                    "client_id": snapshot.id,
                    "field": field,
                    "action": action,
                    "old_type": type(raw).__name__,
                    "old_value": str(raw),
                    "new_value_utc": converted.astimezone(timezone.utc).isoformat(),
                    "new_value_eastern_day": converted.astimezone(EASTERN).date().isoformat(),
                }
            )

        if updates:
            pending.append((snapshot.id, updates))

    print(f"Collection: {args.collection}")
    print(f"Documents scanned:  {total_docs}")
    print(f"Documents to write: {len(pending)}")
    print(f"Field values to change: {len(rows)}")

    print("\n--- action counts ---")
    for key, count in sorted(actions.items()):
        if key.endswith(":skip_null") or key.endswith(":skip_empty"):
            continue
        print(f"  {key:<48} {count:>6}")

    if unparseable:
        print(f"\n--- UNPARSEABLE ({len(unparseable)}) - these would be left untouched ---")
        for client_id, field, raw in unparseable[:20]:
            print(f"  {client_id} {field} = {raw!r}")
        if len(unparseable) > 20:
            print(f"  ... and {len(unparseable) - 20} more")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    mode = "apply" if args.apply else "dryrun"
    output_path = args.output_dir / f"client_date_backfill_{mode}_{stamp}.csv"
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nWrote proposed changes to {output_path}")

    if not args.apply:
        print("\nDRY RUN - nothing was written. Re-run with --apply to commit these changes.")
        return

    print(f"\nAbout to write {len(pending)} documents in '{args.collection}'.")
    print("Take a Firestore backup first if you have not already.")
    response = input(f"Type '{APPLY_CONFIRMATION}' exactly to proceed: ").strip()
    if response != APPLY_CONFIRMATION:
        print("Confirmation did not match. Nothing was written.")
        return

    written = 0
    for index in range(0, len(pending), BATCH_SIZE):
        batch = database.batch()
        for client_id, updates in pending[index : index + BATCH_SIZE]:
            batch.update(database.collection(args.collection).document(client_id), updates)
        batch.commit()
        written += len(pending[index : index + BATCH_SIZE])
        print(f"  committed {written}/{len(pending)}")

    print(f"Done. Updated {written} documents.")


if __name__ == "__main__":
    main()
