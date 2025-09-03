import firebase_admin
from firebase_admin import credentials, firestore
from collections import defaultdict
import json

def delete_clients_from_file(db, collection_name, file_path):
    """Deletes documents from Firestore based on a list of IDs in a file."""
    try:
        with open(file_path, "r") as f:
            ids_to_delete = {line.strip() for line in f if line.strip()}
    except FileNotFoundError:
        print(f"Error: Deletion file not found at {file_path}")
        return

    if not ids_to_delete:
        print("No IDs to delete in the file.")
        return

    print(f"Attempting to delete documents for {len(ids_to_delete)} IDs from {file_path}...")
    
    docs_to_delete = []
    all_docs = list(db.collection(collection_name).stream())
    for doc in all_docs:
        data = doc.to_dict()
        id_val = data.get("uid")
        if id_val in ids_to_delete:
            docs_to_delete.append(doc)

    if not docs_to_delete:
        print("No matching documents found in Firestore for the given IDs.")
        return

    for doc in docs_to_delete:
        data = doc.to_dict()
        data["_deleted_doc_id"] = doc.id
        print(f"Deleting document: {doc.id}")
        print(json.dumps(data, default=str))
        doc.reference.delete()
    
    print(f"\nSuccessfully deleted {len(docs_to_delete)} documents.")


def main():
    SERVICE_ACCOUNT_PATH = "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-f985f354df.json"
    COLLECTION_NAME = "client-profile2"
    DELETION_FILE_PATH = "need-to-be-deleted.txt"

    # Initialize Firebase Admin SDK
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Delete clients based on the file
    delete_clients_from_file(db, COLLECTION_NAME, DELETION_FILE_PATH)

    print("\n--- Starting Duplicate Check ---")
    docs = list(db.collection(COLLECTION_NAME).stream())

    id_map = defaultdict(list)
    name_map = defaultdict(list)

    for doc in docs:
        data = doc.to_dict()
        doc_id = doc.id

        # Check for ID duplicates
        id_val = data.get("ID")
        if id_val:
            id_map[id_val].append(doc_id)

        # Check for name duplicates
        first = data.get("firstName", "")
        last = data.get("lastName", "")
        if first and last:
            key = (first.strip().lower(), last.strip().lower())
            name_map[key].append(doc_id)

    # Log duplicates based on ID
    id_duplicates = []
    for id_val, doc_ids in id_map.items():
        if len(doc_ids) > 1:
            id_duplicates.append({"ID": id_val, "doc_ids": doc_ids})

    if id_duplicates:
        print("\nClients with duplicate 'ID' field in Firestore:")
        for entry in id_duplicates:
            print(f"ID: {entry['ID']} -> Doc IDs: {entry['doc_ids']}")
    else:
        print("\nNo clients with duplicate 'ID' field found in Firestore.")

    # Log duplicates based on name
    name_duplicates = []
    for key, doc_ids in name_map.items():
        if len(doc_ids) > 1:
            name_duplicates.append(
                {"name": f"{key[0].title()} {key[1].title()}", "doc_ids": doc_ids}
            )

    if name_duplicates:
        print("\nClients with duplicate 'firstName'/'lastName' in Firestore:")
        for entry in name_duplicates:
            print(f"{entry['name']} -> Doc IDs: {entry['doc_ids']}")
    else:
        print("\nNo clients with duplicate names found in Firestore.")


if __name__ == "__main__":
    main()
