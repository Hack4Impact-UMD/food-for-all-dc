import firebase_admin
from firebase_admin import credentials, firestore
import os
import sys

# Path to your Firebase service account key
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), 'food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json')

# Firestore collection names (from config)
CLIENTS_COLLECTION = 'client-profile2'
REFERRAL_COLLECTION = 'referral'

# Initialize Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
db = firestore.client()

def normalize_string(s):
    if not s:
        return ''
    return str(s).strip().lower()

def main():
    print('Loading all referrals...')
    referral_docs = db.collection(REFERRAL_COLLECTION).stream()
    referrals = []
    for doc in referral_docs:
        data = doc.to_dict()
        data['id'] = doc.id
        referrals.append(data)
    print(f'Loaded {len(referrals)} referrals.')

    print('Loading all clients...')
    client_docs = db.collection(CLIENTS_COLLECTION).stream()
    update_count = 0
    for client_doc in client_docs:
        client = client_doc.to_dict()
        client_id = client_doc.id
        referral_entity = client.get('referralEntity')
        if not referral_entity:
            continue
        # Only update if id is missing or empty
        if referral_entity.get('id'):
            continue
        name = normalize_string(referral_entity.get('name'))
        org = normalize_string(referral_entity.get('organization'))
        match = None
        # Try to match by both name and organization
        for ref in referrals:
            ref_name = normalize_string(ref.get('name'))
            ref_org = normalize_string(ref.get('organization'))
            if name and org and name == ref_name and org == ref_org:
                match = ref
                break
        # If not found, try to match by organization only
        if not match and org:
            for ref in referrals:
                ref_org = normalize_string(ref.get('organization'))
                if org == ref_org:
                    match = ref
                    break
        if match:
            # Update the client with the referral id
            referral_entity['id'] = match['id']
            db.collection(CLIENTS_COLLECTION).document(client_id).update({'referralEntity': referral_entity})
            update_count += 1
            print(f'Updated client {client_id} with referral id {match["id"]}')
    print(f'Update complete. {update_count} clients updated.')

if __name__ == '__main__':
    main()
