import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from clustering import test_clustering

cred = credentials.Certificate("food-for-all-dc-caf23-firebase-adminsdk-65kzi-b8cfeb0d9a.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

collection_ref = db.collection("clients")

docs = collection_ref.stream()
for doc in docs:
    print(f"{doc.id} => {doc.to_dict()}")

