import firebase_admin
from firebase_admin import credentials, firestore
import argparse
import json
import os

SERVICE_ACCOUNT_PATH = "ETL/food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"

def main():
    parser = argparse.ArgumentParser(description="Download a Firestore record as JSON")
    parser.add_argument("collection", type=str, help="Collection name (e.g. client-profile2)")
    parser.add_argument("uid", type=str, help="Document ID (e.g. ID-0004)")
    parser.add_argument("--out", type=str, default=None, help="Output file (optional, prints to stdout if not set)")
    args = parser.parse_args()

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    doc_ref = db.collection(args.collection).document(args.uid)
    doc = doc_ref.get()
    if not doc.exists:
        print(f"No document found for {args.collection}/{args.uid}")
        return
    def convert(obj):
        if isinstance(obj, dict):
            return {k: convert(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert(v) for v in obj]
        elif hasattr(obj, 'isoformat'):
            try:
                return obj.isoformat()
            except Exception:
                return str(obj)
        else:
            return obj

    data = convert(doc.to_dict())
    # Load canonical fields from ID-0006.json and ensure all are present
    canonical_path = os.path.join(os.path.dirname(__file__), "../ID-0006.json")
    if not os.path.exists(canonical_path):
        canonical_path = os.path.join(os.path.dirname(__file__), "../../ID-0006.json")
    if not os.path.exists(canonical_path):
        canonical_path = os.path.join(os.path.dirname(__file__), "ID-0006.json")
    canonical_fields = None
    if os.path.exists(canonical_path):
        with open(canonical_path, "r", encoding="utf-8") as f:
            canonical_fields = list(json.load(f).keys())
    if canonical_fields:
        for key in canonical_fields:
            if key not in data:
                data[key] = None
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Record saved to {args.out}")
    else:
        print(json.dumps(data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
