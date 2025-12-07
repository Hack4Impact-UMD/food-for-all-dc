import os
import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json")

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
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    clients_ref = db.collection("client-profile2")
    docs = clients_ref.stream()
    missing_coords = []
    for doc in docs:
        data = doc.to_dict()
        coords = data.get("coordinates")
        if not is_valid_coordinate(coords):
            missing_coords.append({
                "clientId": doc.id,
                "coordinates": coords,
                "address": data.get("address"),
                "city": data.get("city"),
                "state": data.get("state"),
                "name": data.get("name"),
            })
    print(f"Found {len(missing_coords)} client-profile2 records with missing or invalid coordinates:")
    for entry in missing_coords:
        print(entry)

if __name__ == "__main__":
    main()
