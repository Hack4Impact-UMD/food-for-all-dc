import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Initialize Firebase Admin
cred = credentials.Certificate('food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json')
firebase_admin.initialize_app(cred)
db = firestore.client()

# Today's date
TODAY = datetime.now().date()

# Collection name (update if needed)
COLLECTION_NAME = 'client-profile2'

def parse_date(date_str):
    if not date_str:
        return None
    for fmt in ('%m/%d/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(date_str, fmt).date()
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
        else:
            is_active = False
        print(f"{doc.id}: startDate={start_date_raw}, endDate={end_date_raw}, parsed_start={start_date}, parsed_end={end_date}, today={TODAY}, is_active={is_active}, current_activeStatus={data.get('activeStatus')}")
        if data.get('activeStatus') != is_active:
            db.collection(COLLECTION_NAME).document(doc.id).update({'activeStatus': is_active})
            print(f"Updated {doc.id}: activeStatus set to {is_active}")
            updated_count += 1
    print(f"Total documents updated: {updated_count}")

if __name__ == "__main__":
    update_active_status()
