"""Cleanup script for referral (case worker) documents and client referralEntity links.

This script performs the following steps:

1. Finds all referral documents in the "referral" collection that do NOT have at least
   one contact method (email or phone with a non-empty value).
2. Creates a single canonical "None" referral entity document if one does not already
   exist.
3. For every client document in the "client-profile2" collection whose
   referralEntity.id points to one of the referral documents from step 1,
   updates referralEntity to point to the canonical "None" entity.
4. Deletes the referral documents from step 1.

Collections (from my-app/src/config/dataSources.config.json):
- Clients       : client-profile2
- Case workers  : "referral"

Run this from the repo root (so that ETL/ is the working directory for the
service account path used below):

    pip install firebase-admin
    python ETL/referral_cleanup.py

Use with care: this mutates production Firestore data.
"""

import os
from typing import List

import firebase_admin
from firebase_admin import credentials, firestore

# Constants aligned with firebase_migration_v2.py and dataSources.config.json
SERVICE_ACCOUNT_PATH = os.path.join(
    "ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
)
PROJECT_ID = "food-for-all-dc-caf23"
CLIENTS_COLLECTION = "client-profile2"
REFERRAL_COLLECTION = "referral"

# New, safe target collection for experimenting with cleaned-up case worker data.
# We clone all documents from REFERRAL_COLLECTION into this collection without
# modifying or deleting anything in production collections.
TEMP_REFERRAL_COLLECTION = "temp-new-referral"


def _init_firestore() -> firestore.Client:
    """Initialize Firebase Admin SDK and return a Firestore client."""

    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})

    return firestore.client()


def _chunk_list(values: List[str], size: int) -> List[List[str]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def clone_referrals_to_temp() -> None:
    """Clone all documents from REFERRAL_COLLECTION into TEMP_REFERRAL_COLLECTION.

    This is a non-destructive operation used to safely experiment with
    case worker cleanup. It:

    - Reads every document in the existing "referral" collection.
    - Writes each document into the "temp-new-referral" collection using the
      same document ID and data.

    No client documents are touched, and no referral documents are deleted.
    """

    db = _init_firestore()

    source_ref = db.collection(REFERRAL_COLLECTION)
    target_ref = db.collection(TEMP_REFERRAL_COLLECTION)

    print(f"📥 Cloning referral documents from '{REFERRAL_COLLECTION}' to '{TEMP_REFERRAL_COLLECTION}'...")
    referral_docs = list(source_ref.stream())
    print(f"📄 Found {len(referral_docs)} referral documents to clone.")

    cloned_count = 0
    for doc in referral_docs:
        data = doc.to_dict() or {}
        # Use the same document ID in the temp collection so any references
        # you inspect manually are easier to correlate.
        target_ref.document(doc.id).set(data)
        cloned_count += 1

    print(f"✅ Cloned {cloned_count} referral documents into '{TEMP_REFERRAL_COLLECTION}'.")


def main() -> None:
    db = _init_firestore()

    referrals_ref = db.collection(REFERRAL_COLLECTION)
    clients_ref = db.collection(CLIENTS_COLLECTION)

    print("📥 Loading referral (case worker) documents...")
    referral_docs = list(referrals_ref.stream())

    bad_referral_ids: List[str] = []

    for doc in referral_docs:
        data = doc.to_dict() or {}
        email = str(data.get("email") or "").strip()
        phone = str(data.get("phone") or "").strip()

        # Keep only referrals that lack BOTH email and phone
        if not email and not phone:
            bad_referral_ids.append(doc.id)
    print(f"📵 Found {len(bad_referral_ids)} referral documents without contact info.")

    # Create or reuse a single canonical "None" referral entity.
    # First, attempt to find an existing one with name='None' and organization='None'.
    existing_none = list(
        referrals_ref.where("name", "==", "None").where("organization", "==", "None").limit(1).stream()
    )

    if existing_none:
        none_doc_ref = existing_none[0].reference
        existing_data = existing_none[0].to_dict() or {}
        none_payload = {
            "name": existing_data.get("name", "None"),
            "organization": existing_data.get("organization", "None"),
        }
        print(f"♻️ Reusing existing 'None' referral with id={none_doc_ref.id}.")
    else:
        none_payload = {
            "name": "None",
            "organization": "None",
            "email": "",
            "phone": "",
        }

        print("✨ Creating canonical 'None' referral entity...")
        none_doc_ref = referrals_ref.document()
        none_doc_ref.set(none_payload)
        print(f"✅ Created 'None' referral with id={none_doc_ref.id}.")

    none_id = none_doc_ref.id

    # Update clients whose referralEntity.id points to any of the soon-to-be-deleted
    # referral documents so that they now point to the new "None" entity.
    updated_clients_by_id = 0

    if bad_referral_ids:
        print("🧩 Updating client referralEntity references (by id) to point to 'None'...")
        for id_chunk in _chunk_list(bad_referral_ids, 10):  # Firestore 'in' limit is 10
            query = clients_ref.where("referralEntity.id", "in", id_chunk)
            for client_snap in query.stream():
                client_ref = client_snap.reference
                client_ref.update(
                    {
                        "referralEntity": {
                            "id": none_id,
                            "name": none_payload["name"],
                            "organization": none_payload["organization"],
                        }
                    }
                )
                updated_clients_by_id += 1

    print(f"🧑‍🤝‍🧑 Updated {updated_clients_by_id} client documents by referralEntity.id.")

    # Also ensure that any clients with a missing/null referralEntity are explicitly
    # set to point to the canonical "None" referral.
    print("🧼 Normalizing clients with missing referralEntity to 'None'...")
    updated_missing_referral = 0
    for client_snap in clients_ref.stream():
        data = client_snap.to_dict() or {}
        referral_entity = data.get("referralEntity")
        # Treat completely missing or null/empty referralEntity as "None".
        if not referral_entity:
            client_ref = client_snap.reference
            client_ref.update(
                {
                    "referralEntity": {
                        "id": none_id,
                        "name": none_payload["name"],
                        "organization": none_payload["organization"],
                    },
                }
            )
            updated_missing_referral += 1

    print(f"🧑‍🤝‍🧑 Updated {updated_missing_referral} client documents with missing referralEntity to 'None'.")

    # Additionally, normalize inline "Internet Search" referralEntity objects (which may
    # have an empty or missing id but organization set to "Internet Search"). These do
    # not correspond to a referral doc anymore and should map to the canonical 'None'.
    print("🌐 Normalizing inline 'Internet Search' referralEntity objects to 'None'...")
    updated_internet_clients = 0
    internet_query = clients_ref.where("referralEntity.organization", "==", "Internet Search")
    for client_snap in internet_query.stream():
        client_ref = client_snap.reference
        client_ref.update(
            {
                "referralEntity": {
                    "id": none_id,
                    "name": none_payload["name"],
                    "organization": none_payload["organization"],
                }
            }
        )
        updated_internet_clients += 1

    print(f"🧑‍🤝‍🧑 Updated {updated_internet_clients} client documents with 'Internet Search' inline referrals.")

    # Finally, normalize any remaining client referralEntity objects that have
    # no contact information (no email AND no phone). These correspond to the
    # same class of case workers we deleted (no contact info) and should also
    # be mapped to the canonical 'None' entry so that the Clients spreadsheet
    # shows only "None" instead of legacy free-text sources.
    print("🧼 Normalizing all client referralEntity objects without contact info to 'None'...")
    updated_no_contact_clients = 0
    for client_snap in clients_ref.stream():
        data = client_snap.to_dict() or {}
        referral_entity = data.get("referralEntity")
        if not isinstance(referral_entity, dict):
            continue

        email = str(referral_entity.get("email") or "").strip()
        phone = str(referral_entity.get("phone") or "").strip()

        # Only touch records that truly have no contact info
        if email or phone:
            continue

        # If this client is already pointing at the canonical None entry, skip
        if referral_entity.get("id") == none_id and referral_entity.get("organization") == none_payload["organization"]:
            continue

        client_ref = client_snap.reference
        client_ref.update(
            {
                "referralEntity": {
                    "id": none_id,
                    "name": none_payload["name"],
                    "organization": none_payload["organization"],
                }
            }
        )
        updated_no_contact_clients += 1

    print(f"🧑‍🤝‍🧑 Updated {updated_no_contact_clients} client documents with no-contact referralEntity to 'None'.")

    # Finally, delete the bad referral documents
    print("🗑️ Deleting referral documents without contact info...")
    deleted_referrals = 0
    for ref_id in bad_referral_ids:
        referrals_ref.document(ref_id).delete()
        deleted_referrals += 1

    print(f"🗑️ Deleted {deleted_referrals} referral documents.")
    print("✅ Referral cleanup completed.")


if __name__ == "__main__":
    # For safety, running this script now performs only a non-destructive
    # clone of the referral collection into TEMP_REFERRAL_COLLECTION.
    # The original cleanup logic remains in main() but is not invoked.
    clone_referrals_to_temp()
