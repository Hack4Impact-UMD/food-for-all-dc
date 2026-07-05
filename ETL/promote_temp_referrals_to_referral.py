"""Promote cleaned case worker data from temp-new-referral into referral.

This script is intended to be run AFTER you are satisfied with the
cleaned/pruned documents in the temporary collection "temp-new-referral".

It performs the following steps:

1. Loads all documents from TEMP_REFERRAL_COLLECTION (temp-new-referral).
2. Deletes all existing documents in REFERRAL_COLLECTION (referral).
3. Writes each temp document into REFERRAL_COLLECTION using the SAME
   document ID and data.

Effects:
- The production "referral" collection is replaced with the cleaned
  dataset from "temp-new-referral".
- Any client whose referralEntity.id points to one of these IDs will now
  see the cleaned name/organization from "referral".

Safety:
- This mutates the production "referral" collection. Make sure you have
  a backup (for example, clone referral into a dated backup collection)
  before running this, or that you're comfortable with the replacement.

Run from the repo root so that the ETL/ path for the service account is
correct:

    pip install firebase-admin
    python ETL/promote_temp_referrals_to_referral.py
"""

import os

import firebase_admin
from firebase_admin import credentials, firestore

# Constants aligned with firebase_migration_v2.py and referral_cleanup.py
SERVICE_ACCOUNT_PATH = os.path.join(
    "ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
)
PROJECT_ID = "food-for-all-dc-caf23"
REFERRAL_COLLECTION = "referral"
TEMP_REFERRAL_COLLECTION = "temp-new-referral"


def _init_firestore() -> firestore.Client:
    """Initialize Firebase Admin SDK and return a Firestore client."""

    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})

    return firestore.client()


def promote_temp_to_referral() -> None:
    """Replace REFERRAL_COLLECTION contents with TEMP_REFERRAL_COLLECTION.

    - Reads all documents from temp-new-referral.
    - Deletes all existing documents in referral.
    - Writes each temp document into referral with the same document ID.
    """

    db = _init_firestore()

    temp_ref = db.collection(TEMP_REFERRAL_COLLECTION)
    referral_ref = db.collection(REFERRAL_COLLECTION)

    print(f"Loading documents from '{TEMP_REFERRAL_COLLECTION}'...")
    temp_docs = list(temp_ref.stream())
    print(f"Found {len(temp_docs)} documents in '{TEMP_REFERRAL_COLLECTION}'.")

    print(f"Loading existing documents from '{REFERRAL_COLLECTION}' to delete...")
    existing_referrals = list(referral_ref.stream())
    print(f"Found {len(existing_referrals)} existing documents in '{REFERRAL_COLLECTION}'.")

    # Delete existing referral docs so we have a clean slate.
    deleted_count = 0
    for doc in existing_referrals:
        doc.reference.delete()
        deleted_count += 1
    print(f"Deleted {deleted_count} documents from '{REFERRAL_COLLECTION}'.")

    # Write temp docs into referral using the same IDs.
    created_count = 0
    for doc in temp_docs:
        data = doc.to_dict() or {}
        referral_ref.document(doc.id).set(data)
        created_count += 1

    print(
        f"Promoted {created_count} documents from '{TEMP_REFERRAL_COLLECTION}' into "
        f"'{REFERRAL_COLLECTION}'."
    )
    print("Promotion completed.")


if __name__ == "__main__":
    promote_temp_to_referral()
