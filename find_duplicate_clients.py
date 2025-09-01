import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict
import json

def load_json_map(json_path):
    id_map = {}
    with open(json_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line)
                id_val = obj.get("ID")
                if id_val:
                    id_map[id_val] = obj
            except Exception:
                continue
    return id_map

def main():
    SERVICE_ACCOUNT_PATH = "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-f985f354df.json"
    COLLECTION_NAME = "client-profile2"
    OUTPUT_JSON = "deleted_no_startdate_clients.json"
    JSON_PATH = "csv-one-line-client-database_w_referral.json"

    # Initialize Firebase Admin SDK
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Load all JSON objects by ID
    json_map = load_json_map(JSON_PATH)

    docs = list(db.collection(COLLECTION_NAME).stream())

    deleted_docs = []
    for doc in docs:
        doc_id = doc.id
        json_obj = json_map.get(doc_id)
        if json_obj is not None:
            start_date = json_obj.get("StartDate_database", "")
            if not start_date or not str(start_date).strip():
                # Delete from Firestore and save data
                data = doc.to_dict()
                data_with_id = dict(data)
                data_with_id["_deleted_doc_id"] = doc_id
                deleted_docs.append(data_with_id)
                db.collection(COLLECTION_NAME).document(doc_id).delete()
                print(f"Deleted doc with no StartDate_database: Doc ID: {doc_id}")

    # Write deleted docs to JSON file, one object per line
    if deleted_docs:
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            for obj in deleted_docs:
                f.write(json.dumps(obj) + "\n")
        print(f"Deleted {len(deleted_docs)} docs with no StartDate_database. Saved to {OUTPUT_JSON}")
    else:
        print("No docs deleted (all had StartDate_database).")

    # Check for remaining duplicates in Firestore based on firstName and lastName
    docs_remaining = list(db.collection(COLLECTION_NAME).stream())
    name_map = defaultdict(list)
    for doc in docs_remaining:
        data = doc.to_dict()
        first = data.get("firstName", "")
        last = data.get("lastName", "")
        if first and last:
            key = (first.strip().lower(), last.strip().lower())
            name_map[key].append(doc.id)

    duplicates = []
    for key, doc_ids in name_map.items():
        if len(doc_ids) > 1:
            duplicates.append({
                "name": f"{key[0].title()} {key[1].title()}",
                "doc_ids": doc_ids
            })

    if duplicates:
        print("\nClients that still have duplicate IDs in Firestore (by firstName/lastName):")
        for entry in duplicates:
            print(f"{entry['name']} -> Doc IDs: {entry['doc_ids']}")
    else:
        print("\nNo clients with duplicate IDs remain in Firestore.")

if __name__ == "__main__":
    main()
