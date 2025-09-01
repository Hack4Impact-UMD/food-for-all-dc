import os
import json
import sys
import logging
import firebase_admin
from firebase_admin import credentials, firestore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def parse_name(full_name):
    """
    Parse a full name so that:
    - All words except the last are the first name
    - The last word is the last name
    - Each word is capitalized (first letter uppercase, rest lowercase)
    """
    if not full_name or not full_name.strip():
        return "", ""
    words = [w.capitalize() for w in full_name.strip().split()]
    if len(words) == 1:
        return words[0], ""
    return " ".join(words[:-1]), words[-1]

def main():
    # Config
    SERVICE_ACCOUNT_PATH = "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-f985f354df.json"
    PROJECT_ID = "food-for-all-dc-caf23"
    COLLECTION_NAME = "client-profile2"
    JSON_FILE = "csv-one-line-client-database_w_referral.json"

    # Initialize Firebase Admin SDK
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Process each line in the JSON file
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception as e:
                logger.warning(f"Skipping invalid JSON line: {e}")
                continue

            doc_id = obj.get("ID")
            final_name = obj.get("final_name", "")
            if not doc_id or not final_name:
                logger.info(f"Skipping entry with missing ID or final_name: {obj.get('final_name','')}")
                continue

            first, last = parse_name(final_name)
            logger.info(f"ID: {doc_id} | Parsed FIRST: '{first}' LAST: '{last}'")

            # Update Firestore document
            try:
                doc_ref = db.collection(COLLECTION_NAME).document(doc_id)
                doc_ref.update({
                    "firstName": first,
                    "lastName": last
                })
                logger.info(f"Updated Firestore doc {doc_id} with FIRST_database='{first}', LAST_database='{last}'")
            except Exception as e:
                logger.error(f"Failed to update Firestore doc {doc_id}: {e}")

if __name__ == "__main__":
    main()
