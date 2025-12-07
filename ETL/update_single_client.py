
import sys
import json
import os
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
import requests
import re

# Usage: python update_single_client.py <ID>
if len(sys.argv) != 2:
    print("Usage: python update_single_client.py <ID>")
    sys.exit(1)

TARGET_ID = sys.argv[1]

# Firestore setup
SERVICE_ACCOUNT_PATH = os.path.join("ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json")
PROJECT_ID = "food-for-all-dc-caf23"
COLLECTION_NAME = "client-profile2"
cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

# Load JSON lines file
input_path = 'ETL/csv-one-line-client-database_w_referral.json'
with open(input_path, encoding='utf-8') as f:
    records = [json.loads(line) for line in f if line.strip()]

row = next((rec for rec in records if str(rec.get('ID')) == TARGET_ID), None)
if not row:
    print(f"No record found for ID {TARGET_ID}")
    sys.exit(1)

# --- Migration logic (mirrors transform_record from firebase_migration_v2.py) ---
def geocode_address_openmap(address, city, state, zip_code):
    parts = [address, city, state, str(zip_code)]
    full_addr = ', '.join([str(p) for p in parts if p and str(p).strip() and str(p).lower() != 'nan'])
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(full_addr)}"
    try:
        resp = requests.get(url, headers={"User-Agent": "food-for-all-dc-etl-script"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                loc = data[0]
                return [float(loc['lat']), float(loc['lon'])]
    except Exception:
        pass
    return None

def parse_frequency(frequency_str):
    if not frequency_str or not str(frequency_str).strip():
        return "None"
    freq = str(frequency_str).strip().lower()
    emergency_keywords = ["emergency", "only", "two time only", "one time only", "emerg"]
    if any(keyword in freq for keyword in emergency_keywords):
        return "Emergency"
    if "periodic" in freq or "perodic" in freq:
        return "Periodic"
    if freq in ["none", "n/a", "na", ""]:
        return "None"
    elif "weekly" in freq or "week" in freq or freq in ["1x/week", "once/week", "every week"]:
        return "Weekly"
    elif any(pattern in freq for pattern in ["2x", "twice", "two", "bi-monthly", "bimonthly", "2/month", "2x/month", "twice/month"]):
        return "2x-Monthly"
    elif any(pattern in freq for pattern in ["monthly", "month", "1x/month", "once/month", "every month", "one/month"]):
        return "Monthly"
    else:
        return "Periodic"

# --- Address handling: use main address up to quadrant for geocoding ---
raw_address = row.get("ADDRESS", "")
quadrant_match = re.search(r"\b(NE|NW|SE|SW)\b", raw_address)
if quadrant_match:
    end_idx = quadrant_match.end()
    address_for_coords = raw_address[:end_idx].strip()
else:
    address_for_coords = re.split(r",|\b(?:Apt|Apartment|Unit|#)\b", raw_address, flags=re.IGNORECASE)[0].strip()
address = address_for_coords
city = row.get("City", "")
state = row.get("State", "")
zip_in_data = row.get("ZIPcode", "") or row.get("ZIP", "")
if any(q in address_for_coords for q in [" NE", " NW", " SE", " SW"]):
    city = "Washington"
    state = "DC"

# --- Use API for ZIP first, fallback to Zipcode from JSON ---
zip_code = ""
coordinates = geocode_address_openmap(address_for_coords, city, state, zip_in_data)
if coordinates:
    # Try to extract ZIP from geocoding result
    base_addr = ', '.join([str(x) for x in [address_for_coords, city, state] if x and str(x).strip() and str(x).lower() != 'nan'])
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(base_addr)}"
    try:
        resp = requests.get(url, headers={"User-Agent": "food-for-all-dc-etl-script"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                loc = data[0]
                zip_code = loc.get('postcode', '')
    except Exception:
        pass
if not zip_code:
    zip_code = str(row.get("Zipcode", ""))

# Quadrant from Quadrant_database
quadrant = row.get("Quadrant_database", "")

# Frequency
delivery_freq = parse_frequency(row.get("Frequency", ""))

# Name fields
first_name = row.get("FIRST_database", "").strip().capitalize()
last_name = row.get("LAST_database", "").strip().capitalize()


# Map recurrence using the same logic as parse_frequency
def map_recurrence(frequency_str):
    if not frequency_str or not str(frequency_str).strip():
        return "None"
    freq = str(frequency_str).strip().lower()
    emergency_keywords = ["emergency", "only", "two time only", "one time only", "emerg"]
    if any(keyword in freq for keyword in emergency_keywords):
        return "Periodic"
    if "periodic" in freq or "perodic" in freq:
        return "Periodic"
    if freq in ["none", "n/a", "na", ""]:
        return "None"
    elif "weekly" in freq or "week" in freq or freq in ["1x/week", "once/week", "every week"]:
        return "Weekly"
    elif any(pattern in freq for pattern in ["2x", "twice", "two", "bi-monthly", "bimonthly", "2/month", "2x/month", "twice/month"]):
        return "2x-Monthly"
    elif any(pattern in freq for pattern in ["monthly", "month", "1x/month", "once/month", "every month", "one/month"]):
        return "Monthly"
    else:
        return "Periodic"

recurrence = map_recurrence(row.get("Frequency", ""))

# Build Firestore document (mirrors main migration)
client_profile = {
    "uid": str(row.get("ID", "")),
    "firstName": first_name,
    "lastName": last_name,
    "streetName": address,
    "address": address,
    "address2": row.get("APT", ""),
    "zipCode": zip_code,
    "city": city,
    "state": state,
    "quadrant": quadrant,
    "dob": "",
    "deliveryFreq": delivery_freq,
    "phone": row.get("Phone", ""),
    "email": row.get("Email", ""),
    "alternativePhone": "",
    "adults": int(row.get("Adults_database", 0)) if row.get("Adults_database") else 0,
    "children": int(row.get("kids", 0)) if row.get("kids") else 0,
    "total": (int(row.get("Adults_database", 0)) if row.get("Adults_database") else 0) + (int(row.get("kids", 0)) if row.get("kids") else 0),
    "gender": "Other",
    "ethnicity": "",
    "deliveryDetails": {
        "deliveryInstructions": row.get("DeliveryInstructions", ""),
        "dietaryRestrictions": row.get("DietaryRestrictions", "")
    },
    "lifeChallenges": row.get("lifeChallenges", ""),
    "physicalAilments": row.get("physicalAilments", ""),
    "physicalDisability": row.get("physicalDisability", ""),
    "mentalHealthConditions": row.get("mentalHealthConditions", ""),
    "notes": row.get("Notes", ""),
    "language": row.get("Language", ""),
    "createdAt": datetime.utcnow(),
    "updatedAt": datetime.utcnow(),
    "tags": row.get("tags", []),
    "ward": row.get("Ward", ""),
    "coordinates": coordinates,
    "seniors": int(row.get("seniors", 0)) if row.get("seniors") else 0,
    "headOfHousehold": row.get("headOfHousehold", ""),
    "startDate": row.get("StartDate_database") if row.get("StartDate_database") and str(row.get("StartDate_database")).strip() else row.get("StartDate_referral", ""),
    "endDate": row.get("EndDate", "") if row.get("EndDate", "") else "12/31/2026",
    "recurrence": recurrence,
    "tefapCert": row.get("TEFAP_FY25", ""),
    "notesTimestamp": None,
    "deliveryInstructionsTimestamp": None,
    "lifeChallengesTimestamp": None,
    "lifestyleGoalsTimestamp": None,
    "lifestyleGoals": "",
    "activeStatus": str(row.get("Active", "")).lower() in ['yes', 'true', '1', 'active']
}

# Write to Firestore (overwrite)
doc_ref = db.collection(COLLECTION_NAME).document(client_profile["uid"])
doc_ref.set(client_profile, merge=False)
print(f"Updated Firestore for ID {TARGET_ID} with zipCode={zip_code} and quadrant={quadrant}")
