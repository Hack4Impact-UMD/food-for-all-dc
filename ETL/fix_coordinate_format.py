"""Fix coordinate format in existing Firestore documents.

This script converts coordinates from the old format:
    coordinates: {latitude: X, longitude: Y}

To the Leaflet LatLngTuple format used by the app:
    coordinates: [latitude, longitude]

Run this ONLY if the Routes page shows "invalid coordinates" after a
full ETL. New ETL runs already write the correct format.

Usage:
    python ETL/fix_coordinate_format.py
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT_PATH = os.path.join(
    "ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
)
PROJECT_ID = "food-for-all-dc-caf23"

COLLECTIONS_TO_FIX = ["client-profile2", "temp-profile2"]


def init_firestore():
    """Initialize Firebase Admin SDK and return a Firestore client."""
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
    return firestore.client()


def fix_coordinates_in_collection(db, collection_name):
    """Fix coordinate format in a single collection."""
    print(f"\nProcessing collection: {collection_name}")

    collection_ref = db.collection(collection_name)
    docs = collection_ref.stream()

    fixed_count = 0
    skipped_count = 0
    error_count = 0
    invalid_count = 0
    total_count = 0
    invalid_samples = []

    def _coerce_number(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _normalize_coordinates(raw):
        if raw is None:
            return None
        if isinstance(raw, list) and len(raw) == 2:
            lat = _coerce_number(raw[0])
            lng = _coerce_number(raw[1])
            return [lat, lng] if lat is not None and lng is not None else None
        if isinstance(raw, list) and len(raw) == 1:
            return _normalize_coordinates(raw[0])
        if isinstance(raw, dict):
            if "lat" in raw and "lng" in raw:
                lat = _coerce_number(raw.get("lat"))
                lng = _coerce_number(raw.get("lng"))
                return [lat, lng] if lat is not None and lng is not None else None
            if "latitude" in raw and "longitude" in raw:
                lat = _coerce_number(raw.get("latitude"))
                lng = _coerce_number(raw.get("longitude"))
                return [lat, lng] if lat is not None and lng is not None else None
        if hasattr(raw, "latitude") and hasattr(raw, "longitude"):
            lat = _coerce_number(getattr(raw, "latitude", None))
            lng = _coerce_number(getattr(raw, "longitude", None))
            return [lat, lng] if lat is not None and lng is not None else None
        return None

    def _is_valid_coordinate(raw):
        normalized = _normalize_coordinates(raw)
        if not normalized:
            return False
        lat, lng = normalized
        return abs(lat) <= 90 and abs(lng) <= 180

    for doc in docs:
        total_count += 1
        doc_id = doc.id
        data = doc.to_dict()

        coordinates = data.get("coordinates")

        if not _is_valid_coordinate(coordinates):
            invalid_count += 1
            if len(invalid_samples) < 25:
                name = f"{data.get('firstName', '')} {data.get('lastName', '')}".strip()
                address = data.get("address", "")
                invalid_samples.append({
                    "id": doc_id,
                    "name": name,
                    "address": address,
                    "coordinates": coordinates,
                })
            skipped_count += 1
            continue

        normalized = _normalize_coordinates(coordinates)
        if normalized is None:
            skipped_count += 1
            continue

        if not (isinstance(coordinates, list) and len(coordinates) == 2):
            try:
                collection_ref.document(doc_id).update({
                    "coordinates": normalized
                })
                fixed_count += 1
            except Exception as exc:
                print(f"Error fixing {doc_id}: {exc}")
                error_count += 1
        else:
            skipped_count += 1

    print(f"\nResults for {collection_name}:")
    print(f"  Total documents: {total_count}")
    print(f"  Fixed: {fixed_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Invalid: {invalid_count}")
    print(f"  Errors: {error_count}")
    if invalid_samples:
        print("\n  Sample invalid records (up to 25):")
        for sample in invalid_samples:
            print(
                f"  - {sample['id']} | {sample['name']} | {sample['address']} | {sample['coordinates']}"
            )

    return fixed_count, skipped_count, error_count


def main():
    print("Coordinate Format Migration Tool")
    print("=" * 60)
    print("Converting coordinates from {latitude, longitude} to [lat, lng]")
    print("=" * 60)

    db = init_firestore()

    total_fixed = 0
    total_skipped = 0
    total_errors = 0

    for collection_name in COLLECTIONS_TO_FIX:
        try:
            fixed, skipped, errors = fix_coordinates_in_collection(
                db, collection_name
            )
            total_fixed += fixed
            total_skipped += skipped
            total_errors += errors
        except Exception as exc:
            print(f"Error processing collection {collection_name}: {exc}")

    print("\n" + "=" * 60)
    print("Migration complete")
    print("=" * 60)
    print(f"Total fixed: {total_fixed}")
    print(f"Total skipped: {total_skipped}")
    print(f"Total errors: {total_errors}")


if __name__ == "__main__":
    main()
