import os
import firebase_admin
from firebase_admin import credentials, firestore

SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json")

def main():
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    ids = ["ID-0180", "ID-0033"]
    clients_ref = db.collection("client-profile2")
    for cid in ids:
        doc = clients_ref.document(cid).get()
        if not doc.exists:
            print(f"{cid}: not found")
            continue
        data = doc.to_dict()
        print(f"{cid}: {data.get('name')}")

if __name__ == "__main__":
    main()
