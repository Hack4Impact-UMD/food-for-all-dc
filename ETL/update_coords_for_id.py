
import os
import firebase_admin
from firebase_admin import credentials, firestore
import requests

SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json")

def geocode_address_with_zip(address):
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(address)}"
    try:
        resp = requests.get(url, headers={"User-Agent": "food-for-all-dc-etl-script"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                loc = data[0]
                return {
                    "lat": float(loc['lat']),
                    "lon": float(loc['lon']),
                    "zip": loc.get('postcode')
                }
    except Exception as e:
        print(f"Geocoding error: {e}")
    return None

def build_address(data):
    address = data.get("address", "")
    city = data.get("city", "")
    state = data.get("state", "")
    return ", ".join([str(x) for x in [address, city, state] if x and str(x).strip() and str(x).lower() != 'nan'])


def main():
    import sys
    if len(sys.argv) < 2:
        print("Usage: python update_coords_for_id.py <CLIENT_ID>")
        return
    client_id = sys.argv[1]
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    clients_ref = db.collection("client-profile2")
    doc_ref = clients_ref.document(client_id)
    doc = doc_ref.get()
    if not doc.exists:
        print(f"Client ID {client_id} not found.")
        return
    data = doc.to_dict()
    got_zip = False
    got_coords = False
    # Step 1: Get zipCode using OpenMaps API if missing or invalid
    zipCode = data.get("zipCode") or data.get("zipcode") or data.get("zip")
    if not zipCode or str(zipCode).lower() == 'nan' or len(str(zipCode)) < 5:
        base_addr = build_address(data)
        geo = geocode_address_with_zip(base_addr)
        if geo and geo.get("zip"):
            zipCode = geo["zip"]
            doc_ref.update({"zipCode": zipCode})
            got_zip = True
            print(f"{client_id}: Updated zipCode to {zipCode}")
        else:
            print(f"{client_id}: Could not determine zipCode ({base_addr})")
            # continue to next step, but zip will be missing
    address = data.get("address", "")
    city = data.get("city", "")
    state = data.get("state", "")
    # Try with zip first
    full_addr = ", ".join([str(x) for x in [address, city, state, zipCode] if x and str(x).strip() and str(x).lower() != 'nan'])
    geo = geocode_address_with_zip(full_addr)
    # If failed, try without zip
    if not (geo and geo.get("lat") and geo.get("lon")):
        quadrant = None
        for q in [" NW", " NE", " SE", " SW"]:
            if q in address:
                quadrant = q.strip()
                break
        addr_parts = [address, city, state]
        if quadrant and quadrant not in address:
            addr_parts.insert(1, quadrant)
        alt_addr = ", ".join([str(x) for x in addr_parts if x and str(x).strip() and str(x).lower() != 'nan'])
        geo = geocode_address_with_zip(alt_addr)
        if geo and geo.get("lat") and geo.get("lon"):
            print(f"{client_id}: Geocoded with alt address: {alt_addr}")
    if geo and geo.get("lat") and geo.get("lon"):
        coords = [geo["lat"], geo["lon"]]
        doc_ref.update({"coordinates": coords})
        got_coords = True
        print(f"{client_id}: Updated coordinates to {coords}")
    else:
        print(f"{client_id}: Could not geocode full address ({full_addr})")
    # Summary per record
    if got_zip and got_coords:
        print(f"{client_id}: Got both zip and coordinates.")
    elif got_zip:
        print(f"{client_id}: Got zip only.")
    elif got_coords:
        print(f"{client_id}: Got coordinates only.")
    else:
        print(f"{client_id}: Got neither zip nor coordinates.")
if __name__ == "__main__":
    main()
