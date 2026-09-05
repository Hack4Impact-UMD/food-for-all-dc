"""Read-only audit of date field formats on client-profile2.

Classifies every stored value for each client date field so the Timestamp
migration can be sized and the backfill's parsing rules validated up front.
Writes nothing back to Firestore.
"""

import argparse
import csv
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CREDENTIALS = ROOT / "ETL" / "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"

# Calendar-date fields currently stored as strings; these are the migration targets.
DATE_FIELDS = [
    "dob",
    "startDate",
    "endDate",
    "tefapCertDate",
    "famStartDate",
    "referredDate",
    "autoInactivePreviousEndDate",
    "autoInactiveStrikeDate",
]

# Already Timestamps; audited to confirm nothing has regressed to strings.
INSTANT_FIELDS = ["createdAt", "updatedAt"]

CSV_FIELDNAMES = ["client_id", "field", "classification", "raw_type", "raw_value"]

# Classifications that need no conversion work.
CLEAN = {"iso", "timestamp", "absent", "null", "empty"}

MISSING = object()


def classify(value: Any) -> str:
    if value is MISSING:
        return "absent"
    if value is None:
        return "null"
    # Firestore returns DatetimeWithNanoseconds, a datetime subclass.
    if isinstance(value, (datetime, date)):
        return "timestamp"
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, (int, float)):
        return "number"
    if not isinstance(value, str):
        return "other"

    text = value.strip()
    if not text:
        return "empty"
    if text.lower() in ("nan", "none", "null", "n/a"):
        return "sentinel_text"

    parts = text.split("-")
    if len(parts) == 3 and len(parts[0]) == 4 and all(part.isdigit() for part in parts):
        try:
            datetime.strptime(text, "%Y-%m-%d")
            return "iso"
        except ValueError:
            return "iso_shaped_invalid"

    if "/" in text:
        for fmt in ("%m/%d/%Y", "%m/%d/%y"):
            try:
                datetime.strptime(text, fmt)
                return "us_slash"
            except ValueError:
                continue
        return "slash_unparseable"

    if "T" in text or ":" in text:
        return "datetime_string"

    return "unparseable"


def summarize(counts: dict[str, Counter], fields: list[str], total_docs: int) -> None:
    for field in fields:
        field_counts = counts[field]
        if not field_counts:
            continue
        print(f"\n{field}")
        for classification, count in field_counts.most_common():
            share = (count / total_docs * 100) if total_docs else 0
            marker = "   " if classification in CLEAN else " * "
            print(f"{marker}{classification:<22} {count:>7}  ({share:5.1f}%)")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collection", default="client-profile2")
    parser.add_argument("--credentials", type=Path, default=DEFAULT_CREDENTIALS)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "ETL" / "audit_reports")
    parser.add_argument(
        "--all-values",
        action="store_true",
        help="Write every value to the CSV, not just the ones needing conversion.",
    )
    parser.add_argument("--limit", type=int, help="Only read the first N documents.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(args.credentials)))
    database = firestore.client()

    stream = database.collection(args.collection).stream()
    all_fields = DATE_FIELDS + INSTANT_FIELDS
    counts: dict[str, Counter] = defaultdict(Counter)
    samples: dict[tuple[str, str], str] = {}
    rows: list[dict[str, Any]] = []
    docs_needing_work: set[str] = set()
    total_docs = 0

    for snapshot in stream:
        if args.limit and total_docs >= args.limit:
            break
        total_docs += 1
        profile = snapshot.to_dict() or {}

        for field in all_fields:
            raw = profile.get(field, MISSING)
            classification = classify(raw)
            counts[field][classification] += 1

            needs_work = classification not in CLEAN
            if needs_work:
                docs_needing_work.add(snapshot.id)
                samples.setdefault((field, classification), repr(raw))

            if needs_work or args.all_values:
                rows.append(
                    {
                        "client_id": snapshot.id,
                        "field": field,
                        "classification": classification,
                        "raw_type": type(raw).__name__ if raw is not MISSING else "absent",
                        "raw_value": "" if raw is MISSING else str(raw),
                    }
                )

    print(f"Collection: {args.collection}")
    print(f"Documents scanned: {total_docs}")
    print("\n'*' marks values a backfill would have to convert.")

    print("\n--- calendar date fields ---")
    summarize(counts, DATE_FIELDS, total_docs)
    print("\n--- instant fields (expected: timestamp) ---")
    summarize(counts, INSTANT_FIELDS, total_docs)

    if samples:
        print("\n--- sample of each non-clean value ---")
        for (field, classification), sample in sorted(samples.items()):
            print(f"  {field}.{classification}: {sample}")

    print(
        f"\nDocuments with at least one value needing conversion: "
        f"{len(docs_needing_work)} of {total_docs}"
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = args.output_dir / f"client_date_format_audit_{stamp}.csv"
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output_path}")


if __name__ == "__main__":
    main()
