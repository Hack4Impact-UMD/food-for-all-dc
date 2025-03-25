import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError
from testing import test_clustering
import time

cred = credentials.Certificate("food-for-all-dc-caf23-firebase-adminsdk-65kzi-b8cfeb0d9a.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

collection_ref = db.collection("clients")
docs = collection_ref.stream()
geolocator = Nominatim(user_agent="food-for-all-dc", timeout=10)
coords = []

def geocode_with_retry(address, retries=3):
    for i in range(retries):
        try:
            return geolocator.geocode(address)
        except (GeocoderTimedOut, GeocoderServiceError) as e:
            print(f"Geocoding error: {e}. Retrying ({i+1}/{retries})...")
            time.sleep(2)  # Wait for 2 seconds before retrying
    return None

for doc in docs:
    address = doc.to_dict().get("address")
    if address:
        location = geocode_with_retry(address)
        if location:
            coords.append((location.latitude, location.longitude))
            print(f"{doc.id} => {address} => ({location.latitude}, {location.longitude})")
        else:
            print(f"{doc.id} => {address} => Coordinates not found")
    else:
        print(f"{doc.id} => Address not found")

print("Coordinates:", coords)
test_clustering(coords)