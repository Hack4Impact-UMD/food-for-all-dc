import firebase_admin
from firebase_admin import credentials, firestore
import os

SERVICE_ACCOUNT_PATH = "ETL/food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"

cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

print("[DEBUG] Firestore client initialized.")
print(f"[DEBUG] Project ID: {cred.project_id}")

# Try to write a test document to client-profile2
try:
    doc_ref = db.collection("client-profile2").document("testdoc")
    doc_ref.set({"test": 456, "status": "success"})
    print("[SUCCESS] Wrote test document to client-profile2 collection.")
except Exception as e:
    print(f"[ERROR] Failed to write test document to client-profile2: {e}")
