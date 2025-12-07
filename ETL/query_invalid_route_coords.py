import os
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json")

# Helper: check if coordinates are valid
# Accepts [lat, lng] or {lat: ..., lng: ...}
def is_valid_coordinate(coord):
    if not coord:
        return False
    if isinstance(coord, list) and len(coord) == 2:
        try:
            lat, lng = float(coord[0]), float(coord[1])
            return lat != 0 and lng != 0 and abs(lat) <= 90 and abs(lng) <= 180
        except Exception:
            return False
    if isinstance(coord, dict):
        try:
            lat, lng = float(coord.get("lat", 0)), float(coord.get("lng", 0))
            return lat != 0 and lng != 0 and abs(lat) <= 90 and abs(lng) <= 180
        except Exception:
            return False
    return False

def main():
    # Set up Firestore
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Set the date to query (2025-11-20, America/New_York)
    tz = ZoneInfo("America/New_York")
    query_date = datetime(2025, 11, 20, 0, 0, 0, tzinfo=tz)
    next_day = query_date + timedelta(days=1)
    start_utc = query_date.astimezone(ZoneInfo("UTC"))
    end_utc = next_day.astimezone(ZoneInfo("UTC"))

    # Query events (routes) for that day
    events_ref = db.collection("events")
    events = events_ref.where("deliveryDate", ">=", start_utc).where("deliveryDate", "<", end_utc).stream()
    client_ids = set()
    for event in events:
        data = event.to_dict()
        cid = data.get("clientId")
        if cid:
            client_ids.add(cid)

    print(f"Found {len(client_ids)} clients assigned to routes on 2025-11-20.")

    # Now fetch client profiles and check coordinates
    invalid_coords = []
    clients_ref = db.collection("client-profile2")
    for cid in client_ids:
        doc = clients_ref.document(cid).get()
        if not doc.exists:
            continue
        data = doc.to_dict()
        coords = data.get("coordinates")
        if not is_valid_coordinate(coords):
            invalid_coords.append({
                "clientId": cid,
                "coordinates": coords,
                "address": data.get("address"),
                "name": data.get("name"),
            })

    print(f"Found {len(invalid_coords)} clients with invalid coordinates:")
    for entry in invalid_coords:
        print(entry)

if __name__ == "__main__":
    main()
