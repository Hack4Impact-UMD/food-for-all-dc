import firebase_admin
from firebase_admin import credentials, firestore
import os

# Path to your Firebase service account key (update if needed)
CRED_PATH = os.path.join("ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json")
COLLECTION_NAME = "client-profile2"  # Change if your collection name is different
BATCH_SIZE = 500

def clear_fields_in_doc(doc_data):
    updates = {}
    if "mentalHealthConditions" in doc_data and isinstance(doc_data["mentalHealthConditions"], dict):
        updates["mentalHealthConditions.otherText"] = ""
        updates["mentalHealthConditions.other"] = False
    if "physicalAilments" in doc_data and isinstance(doc_data["physicalAilments"], dict):
        updates["physicalAilments.otherText"] = ""
        updates["physicalAilments.other"] = False
    if "physicalDisability" in doc_data and isinstance(doc_data["physicalDisability"], dict):
        updates["physicalDisability.otherText"] = ""
        updates["physicalDisability.other"] = False
    return updates

def main():
    cred = credentials.Certificate(CRED_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    docs = db.collection(COLLECTION_NAME).stream()
    batch = db.batch()
    count = 0
    total = 0
    for doc in docs:
        doc_data = doc.to_dict()
        updates = clear_fields_in_doc(doc_data)
        if updates:
            batch.update(doc.reference, updates)
            count += 1
            total += 1
            if count == BATCH_SIZE:
                batch.commit()
                print(f"Committed batch of {BATCH_SIZE} updates.")
                batch = db.batch()
                count = 0
    if count > 0:
        batch.commit()
        print(f"Committed final batch of {count} updates.")
    print(f"Total records updated: {total}")

if __name__ == "__main__":
    main()
