from datetime import date, datetime
from zoneinfo import ZoneInfo

import firebase_admin
from firebase_admin import firestore


# Use the Cloud Run runtime service account.
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()

COLLECTION_NAME = "client-profile2"
EASTERN = ZoneInfo("America/New_York")

# Keep these aligned with ETL/client_dates.py.
ACCEPTED_FORMATS = (
    "%Y-%m-%d",
    "%m/%d/%Y",
    "%m/%d/%y",
    "%Y-%m-%d %H:%M:%S",
)
SENTINEL_TEXT = {"", "nan", "none", "null", "n/a"}


def parse_date(value):
    """Read a client date as an Eastern calendar day."""
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.astimezone(EASTERN).date() if value.tzinfo else value.date()

    if isinstance(value, date):
        return value

    if isinstance(value, dict):
        seconds = value.get("seconds")
        if isinstance(seconds, (int, float)):
            return datetime.fromtimestamp(seconds, tz=EASTERN).date()
        return None

    text = str(value).strip()
    if text.lower() in SENTINEL_TEXT:
        return None

    for fmt in ACCEPTED_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    return None


def compute_active_status(start_date, end_date, inactive_reason, today):
    """Match the app's current-day active-status rules."""
    if inactive_reason == "three-strikes":
        return False

    if start_date is None:
        return False

    if end_date is not None:
        return start_date <= today <= end_date

    return start_date <= today


def update_active_status():
    # Calculate this on every invocation because Cloud Run reuses containers.
    today = datetime.now(EASTERN).date()
    updated_count = 0

    for doc in db.collection(COLLECTION_NAME).stream():
        data = doc.to_dict() or {}

        start_date = parse_date(data.get("startDate"))
        end_date = parse_date(data.get("endDate"))
        inactive_reason = data.get("autoInactiveReason")

        is_active = compute_active_status(
            start_date,
            end_date,
            inactive_reason,
            today,
        )

        if data.get("activeStatus") != is_active:
            doc.reference.update({
                "activeStatus": is_active,
                "updatedAt": firestore.SERVER_TIMESTAMP,
                "updatedBy": {
                    "uid": "ETL",
                    "name": "ETL",
                },
            })
            updated_count += 1
            print(f"Updated {doc.id}: activeStatus={is_active}")

    print(f"Active-status ETL: date={today}, updated_count={updated_count}")


if __name__ == "__main__":
    update_active_status()