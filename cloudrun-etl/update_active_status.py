import os
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import date, datetime
from zoneinfo import ZoneInfo

# Initialize Firebase Admin
SERVICE_ACCOUNT_FILE = 'food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json'
if not firebase_admin._apps:
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        cred = credentials.Certificate(SERVICE_ACCOUNT_FILE)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
db = firestore.client()

# Collection name (update if needed)
COLLECTION_NAME = 'client-profile2'

EASTERN = ZoneInfo('America/New_York')

# Cloud Run runs in UTC; active status is an Eastern-calendar decision.
TODAY = datetime.now(EASTERN).date()

# Must match ACCEPTED_FORMATS/SENTINEL_TEXT in ETL/client_dates.py. A format
# accepted there but not here would silently deactivate a client.
ACCEPTED_FORMATS = ('%Y-%m-%d', '%m/%d/%Y', '%m/%d/%y', '%Y-%m-%d %H:%M:%S')
SENTINEL_TEXT = {'', 'nan', 'none', 'null', 'n/a'}


def parse_date(value):
    """Read a client date as a calendar day.

    Accepts Firestore Timestamps, the {seconds, nanoseconds} maps left by a
    structural copy, and the legacy MM/DD/YYYY and YYYY-MM-DD strings, so this
    keeps working either side of the Timestamp migration.
    Mirrors ETL/client_dates.py, which cannot be imported across the deploy boundary.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        # Timestamps come back tz-aware; compare on the Eastern calendar day.
        return value.astimezone(EASTERN).date() if value.tzinfo else value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, dict):
        seconds = value.get('seconds')
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

def update_active_status():
    docs = db.collection(COLLECTION_NAME).stream()
    updated_count = 0
    for doc in docs:
        data = doc.to_dict()
        start_date_raw = data.get('startDate')
        end_date_raw = data.get('endDate')
        start_date = parse_date(start_date_raw)
        end_date = parse_date(end_date_raw)
        if start_date and end_date:
            is_active = start_date <= TODAY <= end_date
        elif start_date:
            is_active = start_date <= TODAY
        else:
            is_active = False
        print(f"{doc.id}: startDate={start_date_raw}, endDate={end_date_raw}, parsed_start={start_date}, parsed_end={end_date}, today={TODAY}, is_active={is_active}, current_activeStatus={data.get('activeStatus')}")
        if data.get('activeStatus') != is_active:
            db.collection(COLLECTION_NAME).document(doc.id).update({
                'activeStatus': is_active,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                'updatedBy': {
                    'uid': 'ETL',
                    'name': 'ETL',
                },
            })
            print(f"Updated {doc.id}: activeStatus set to {is_active}")
            updated_count += 1
    print(f"Total documents updated: {updated_count}")

if __name__ == "__main__":
    update_active_status()
