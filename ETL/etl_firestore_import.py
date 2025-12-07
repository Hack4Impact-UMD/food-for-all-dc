import re
import os
import json
import datetime
import pandas as pd
import requests
from firebase_admin import credentials, firestore
import firebase_admin

# Load environment variables from .env if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print('[WARN] python-dotenv not installed; .env file will not be loaded.')

def geocode_address_google(address, city, state, zip_code):
    parts = [address, city, state, str(zip_code)]
    full_addr = ', '.join([str(p) for p in parts if p and not pd.isnull(p)])
    url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(full_addr)}"
    try:
        resp = requests.get(url, headers={"User-Agent": "food-for-all-dc-etl-script"}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data:
                loc = data[0]
                return [float(loc['lat']), float(loc['lon'])]
            else:
                print(f"[WARN] No coordinates found for address: {full_addr}")
        else:
            print(f"[WARN] Nominatim API error: {resp.status_code}")
    except Exception as e:
        print(f"[WARN] Nominatim geocoding failed for {full_addr}: {e}")
    return None

def delete_firestore_records(collection, uid=None):
    if uid:
        docs = collection.where("uid", "==", uid).stream()
        for doc in docs:
            doc.reference.delete()
    else:
        docs = collection.stream()
        for doc in docs:
            doc.reference.delete()

def build_doc_from_template(row, template, referral_docs=None):
    col_map = {
        'uid': ' ',
        'firstName': 'FIRST',
        'lastName': 'LAST',
        'address': 'ADDRESS',
        'address2': 'APT #',
        'zipCode': 'ZIP',
        'city': 'City',
        'state': 'State',
        'quadrant': 'Quadrant',
        'ward': 'Ward',
        'phone': 'Phone',
        'adults': '# Adults',
        'children': '# Children',
        'total': 'HH Size',
        'startDate': 'Start Date',
        'endDate': 'End Date',
        'deliveryFreq': 'Frequency',
        'notes': 'Notes',
        'language': 'Language',
        'deliveryDetails.deliveryInstructions': 'Delivery Instructions',
        'deliveryInstructions': 'Delivery Instructions',
        'tags': 'Tags',
        'gender': 'Gender',
        'lifestyleGoals': 'Lifestyle Goals',
        'recurrence': 'Recurrence',
        'lifeChallengesTimestamp': 'Life Challenges Timestamp',
        'lifestyleGoalsTimestamp': 'Lifestyle Goals Timestamp',
        'dob': 'DOB',
        'seniors': '# Seniors',
        'physicalDisability.other': 'Physical Disability Other',
        'physicalDisability.otherText': 'Physical Disability Other Text',
        'mentalHealthConditions.other': 'Mental Health Other',
        'mentalHealthConditions.otherText': 'Mental Health Other Text',
        'physicalAilments.cancer': 'Cancer',
        'physicalAilments.other': 'Physical Ailments Other',
        'physicalAilments.diabetes': 'Diabetes',
        'physicalAilments.kidneyDisease': 'Kidney Disease',
        'physicalAilments.hypertension': 'Hypertension',
        'physicalAilments.otherText': 'Physical Ailments Other Text',
        'physicalAilments.heartDisease': 'Heart Disease',
        'createdAt': 'Created At',
        'updatedAt': 'Updated At',
        'deliveryInstructionsTimestamp': 'Delivery Instructions Timestamp',
        'ethnicity': 'Ethnicity',
        'headOfHousehold': 'Head of Household',
        'lifeChallenges': 'Life Challenges',
        'tefapCert': 'TEFAP FY25',
        'email': 'Email',
        'alternativePhone': 'Alternative Phone',
        'notesTimestamp': 'Notes Timestamp',
        # Additional mappings from spreadsheet scan
        'referralEntity.organization': 'REFERRAL ENTITY',
        'referralEntity.name': 'REFERRAL ENTITY',
        'referralEntity.id': None,
        'deliveryDetails.dietaryRestrictions.lowSodium': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.vegetarian': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.softFood': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.otherText': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.heartFriendly': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.kidneyFriendly': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.halal': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.other': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.noCookingEquipment': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.lowSugar': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.vegan': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.foodAllergens': 'Dietary Restrictions',
        'deliveryDetails.dietaryRestrictions.microwaveOnly': 'Dietary Restrictions',
        # Add more as needed from spreadsheet scan
    }
    doc = {}
    import re
    for key, val in template.items():
        if key == 'coordinates':
            raw_address = row.get('ADDRESS', '')
            # Remove apartment/unit info (e.g., 'Apt 207', 'Unit 1', '#2', etc.)
            address = re.split(r'\b(?:Apt|Apartment|Unit|#)\b', raw_address, flags=re.IGNORECASE)[0].strip()
            # If address contains NE, NW, SE, or SW, set city/state accordingly
            if re.search(r'\b(NW|NE|SE|SW)\b', address, re.IGNORECASE):
                city = 'Washington'
                state = 'DC'
            else:
                city = row.get('City', '')
                state = row.get('State', '')
            zip_code = row.get('ZIP', '')
            coords = geocode_address_google(address, city, state, zip_code)
            doc[key] = coords if coords else None
        elif isinstance(val, dict):
            if key == 'referralEntity':
                ref_entity_raw = str(row.get('REFERRAL ENTITY', '')).strip()
                ref_name, ref_org = None, None
                if ref_entity_raw:
                    parts = [p.strip() for p in ref_entity_raw.split(',') if p.strip()]
                    if len(parts) >= 2:
                        ref_name = parts[0]
                        ref_org = parts[1]
                    elif len(parts) == 1:
                        ref_org = parts[0]
                matched = None
                if referral_docs and ref_name and ref_org:
                    ref_id = referral_docs.get((ref_name.lower(), ref_org.lower()))
                    if ref_id:
                        matched = {"name": ref_name, "organization": ref_org, "id": ref_id}
                if not matched and referral_docs and ref_org:
                    for (n, o), rid in referral_docs.items():
                        if o == ref_org.lower():
                            matched = {"name": n.title(), "organization": ref_org, "id": rid}
                            break
                doc[key] = matched if matched else None
            else:
                nested_doc = {}
                for subkey, subval in val.items():
                    nested_doc[subkey] = build_doc_from_template(row, {subkey: subval}, referral_docs).get(subkey)
                doc[key] = nested_doc if any(v is not None for v in nested_doc.values()) else None
        elif isinstance(val, list):
            doc[key] = []
        else:
            col = col_map.get(key, key)
            if key == 'address':
                # Strip apartment/unit info for the address field as well
                raw_address = row.get(col, '')
                address = re.split(r'\b(?:Apt|Apartment|Unit|#)\b', raw_address, flags=re.IGNORECASE)[0].strip()
                # If address contains NE, NW, SE, or SW, set city/state accordingly
                if re.search(r'\b(NW|NE|SE|SW)\b', address, re.IGNORECASE):
                    doc['city'] = 'Washington'
                    doc['state'] = 'DC'
                doc[key] = address if address else None
            elif key == 'createdAt':
                from datetime import datetime, timedelta, timezone
                utc_minus_4 = timezone(timedelta(hours=-4))
                dt = datetime.now(utc_minus_4)
                doc[key] = dt.isoformat()
            elif key == 'firstName' and col in row:
                val_from_row = row[col]
                if pd.isnull(val_from_row):
                    doc[key] = None
                else:
                    doc[key] = str(val_from_row).strip().capitalize() if len(str(val_from_row)) > 0 else None
            elif key == 'lastName' and col in row:
                val_from_row = row[col]
                if pd.isnull(val_from_row):
                    doc[key] = None
                else:
                    doc[key] = str(val_from_row).strip().capitalize() if len(str(val_from_row)) > 0 else None
            elif key == 'deliveryInstructions' and col in row:
                val_from_row = row[col]
                if pd.isnull(val_from_row) or str(val_from_row).strip() == '':
                    doc[key] = ""
                else:
                    doc[key] = str(val_from_row)
            elif key in ['startDate', 'endDate'] and col in row:
                val_from_row = row[col]
                from datetime import datetime
                date_format = "%m/%d/%Y"
                if pd.isnull(val_from_row) or str(val_from_row).strip() == '':
                    if key == 'endDate':
                        doc[key] = "12/31/2026"
                    else:
                        doc[key] = ""
                else:
                    # Try to parse and reformat as date only
                    try:
                        dt = pd.to_datetime(val_from_row)
                        doc[key] = dt.strftime(date_format)
                    except Exception:
                        doc[key] = str(val_from_row)
            elif col in row:
                val_from_row = row[col]
                doc[key] = None if pd.isnull(val_from_row) else val_from_row
            else:
                doc[key] = None
    return doc

if __name__ == "__main__":
    # Print Firestore client config and check for emulator
    import os
    print(f"[DEBUG] FIRESTORE_EMULATOR_HOST: {os.environ.get('FIRESTORE_EMULATOR_HOST')}")
    print(f"[DEBUG] GOOGLE_APPLICATION_CREDENTIALS: {os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}")
    try:
        print(f"[DEBUG] Firestore client _target: {getattr(db, '_target', None)}")
    except Exception as e:
        print(f"[DEBUG] Could not print Firestore client _target: {e}")
    import argparse
    parser = argparse.ArgumentParser(description="Config-driven ETL Firestore Import")
    parser.add_argument("collection", type=str, help="Collection to process (e.g. client-profile2, referral, Drivers2)")
    parser.add_argument("uid", type=str, nargs="?", help="Optional: Client ID to process (if only one)")
    args = parser.parse_args()

    SERVICE_ACCOUNT_PATH = "ETL/food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
    # Print project ID from service account
    try:
        with open(SERVICE_ACCOUNT_PATH, 'r', encoding='utf-8') as f:
            sa_data = json.load(f)
        print(f"[DEBUG] Using Firebase project_id: {sa_data.get('project_id')}")
        print(f"[DEBUG] Service account client_email: {sa_data.get('client_email')}")
    except Exception as e:
        print(f"[ERROR] Could not read service account JSON: {e}")
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    try:
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("[DEBUG] Firestore client initialized successfully.")
        # Print Firestore client config and check for emulator
        import os
        print(f"[DEBUG] FIRESTORE_EMULATOR_HOST: {os.environ.get('FIRESTORE_EMULATOR_HOST')}")
        print(f"[DEBUG] GOOGLE_APPLICATION_CREDENTIALS: {os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}")
        try:
            print(f"[DEBUG] Firestore client _target: {getattr(db, '_target', None)}")
        except Exception as e:
            print(f"[DEBUG] Could not print Firestore client _target: {e}")
    except Exception as e:
        print(f"[FATAL] Firestore initialization failed: {e}")
        raise

    EXCEL_PATH = "ETL/FFA_CLIENT_DATABASE.xlsx"
    all_dfs = pd.read_excel(EXCEL_PATH, sheet_name=None)

    template_path = os.path.join(os.path.dirname(__file__), '../ID-2218.json')
    if not os.path.exists(template_path):
        template_path = os.path.join(os.path.dirname(__file__), 'ID-2218.json')
    with open(template_path, 'r', encoding='utf-8') as f:
        canonical_template = json.load(f)

    referral_docs = {}
    try:
        referral_collection = db.collection("referral")
        for ref_doc in referral_collection.stream():
            data = ref_doc.to_dict()
            name = str(data.get("name", "")).strip().lower()
            org = str(data.get("organization", "")).strip().lower()
            if name and org:
                referral_docs[(name, org)] = ref_doc.id
    except Exception as e:
        print(f"[WARN] Could not load referral docs: {e}")

    docs = []
    record_id = args.uid if hasattr(args, 'uid') else None
    # Use the intended collection name
    collection_key = args.collection
    collection = db.collection(collection_key)
    print(f"[DEBUG] Using Firestore collection: {collection_key}")
    processed = 0
    for idx, row in all_dfs['Clients Main Information'].iterrows():
        if processed >= 5:
            print('[EXIT] Processed 5 active records, exiting import as requested.')
            break
        if str(row.get(' ', '')).strip() == 'ID-2216':
            print('[EXIT] Reached ID-2216, exiting import as requested.')
            break
        log_path = 'etl_row_scan.log'
        uid_val = str(row.get(' ', '')).strip()
        active_val = str(row.get('Active', '')).strip().lower()
        with open(log_path, 'a', encoding='utf-8') as logf:
            logf.write(f"{datetime.datetime.now().isoformat()} | RowIdx={idx} | UID={uid_val} | Active={str(row.get('Active', '')).strip()}\n")
        if idx == 0:
            first_uid = uid_val
            print(f"[INFO] First row UID in spreadsheet: {first_uid}")
        # Handle TRUE/FALSE and other active values
        is_active = active_val in ['1', '1.0', 'yes', 'true', 'y', 't'] or active_val is True
        if active_val == 'true':
            is_active = True
        elif active_val == 'false':
            is_active = False
        if record_id:
            if uid_val != record_id:
                continue
        if not is_active and not record_id:
            print(f"[SKIP] UID={uid_val} is inactive, skipping.")
            with open(log_path, 'a', encoding='utf-8') as logf:
                logf.write(f"[SKIP] UID={uid_val} is inactive, skipping.\n")
            continue
        print(f"[ACTIVE] UID={uid_val} is active. Data:")
        print(row)
        doc = build_doc_from_template(row, canonical_template, referral_docs)
        doc['uid'] = uid_val
        doc['activeStatus'] = is_active
        with open(log_path, 'a', encoding='utf-8') as logf:
            logf.write(f"[DOCS] Appending UID={uid_val} to docs.\n")
        docs.append(doc)
        processed += 1

    # Firestore write with detailed error logging
    success_count = 0
    fail_count = 0
    try:
        if record_id:
            if docs:
                doc = docs[0]
                try:
                    print(f"[DEBUG] Writing to Firestore: {collection_key}/{doc['uid']} -> {doc}")
                    result = collection.document(doc['uid']).set(doc, merge=False)
                    print(f"[DEBUG] Firestore set() result: {result}")
                    print(f"Inserted {doc['uid']}")
                    success_count += 1
                except Exception as e:
                    print(f"[ERROR] Failed to insert {doc['uid']}: {e}")
                    fail_count += 1
            else:
                print(f"[TRACE] No record found in spreadsheet for uid '{record_id}'")
        else:
            for doc in docs:
                try:
                    print(f"[DEBUG] Writing to Firestore: {collection_key}/{doc['uid']} -> {doc}")
                    result = collection.document(doc['uid']).set(doc, merge=False)
                    print(f"[DEBUG] Firestore set() result: {result}")
                    print(f"Inserted {doc['uid']}")
                    success_count += 1
                except Exception as e:
                    print(f"[ERROR] Failed to insert {doc['uid']}: {e}")
                    fail_count += 1
            print(f"Inserted {success_count} active records. {fail_count} failed.")
    except Exception as e:
        print(f'[FATAL ERROR] Uncaught exception: {e}')


def build_doc_from_template(uid, template, all_dfs, referral_docs=None):
    doc = {}
    def norm(s):
        return str(s).replace(' ', '').replace('_', '').lower()

    # Helper: for a given key, scan all tabs for a matching column and value for this uid
    def find_value_for_key(key, uid):
        for tab_name, df in all_dfs.items():
            # Try to find the UID column
            uid_col = None
            for c in df.columns:
                if norm(c) in [' ', 'clientid', 'uid']:
                    uid_col = c
                    break
            if uid_col is None:
                continue
            # Find the row for this uid
            row = df[df[uid_col].astype(str).str.strip() == uid]
            if row.empty:
                continue
            # Try to find the column for this key
            for c in df.columns:
                if norm(c) == norm(key):
                    val = row.iloc[0][c]
                    if pd.notnull(val):
                        return val
        return None

    # Only reorder keys at the top level (when template has both address and address2)
    if 'address' in template and 'address2' in template and len(template) > 2:
        ordered_keys = list(template.keys())
        for special in ['address', 'address2']:
            if special in ordered_keys:
                ordered_keys.remove(special)
        ordered_keys = ['address', 'address2'] + ordered_keys
    else:
        ordered_keys = list(template.keys())
    for key in ordered_keys:
        val = template[key]
        if key == 'coordinates':
            continue  # skip for now, do after address fields
        elif isinstance(val, dict):
            if key == 'referralEntity':
                # Special handling for referralEntity
                ref_entity_val = find_value_for_key('REFERRAL ENTITY', uid)
                ref_name, ref_org = None, None
                if ref_entity_val:
                    parts = [p.strip() for p in str(ref_entity_val).split(',') if p.strip()]
                    if len(parts) >= 2:
                        ref_name = parts[0]
                        ref_org = parts[1]
                    elif len(parts) == 1:
                        ref_org = parts[0]
                matched = None
                if referral_docs:
                    if ref_name and ref_org:
                        ref_id = referral_docs.get((ref_name.lower(), ref_org.lower()))
                        if ref_id:
                            matched = {"name": ref_name, "organization": ref_org, "id": ref_id}
                    if not matched and ref_org:
                        for (n, o), rid in referral_docs.items():
                            if o == ref_org.lower():
                                matched = {"name": n.title(), "organization": ref_org, "id": rid}
                                break
                doc[key] = matched if matched else {k: '' for k in val}
            else:
                nested_doc = {}
                for subkey, subval in val.items():
                    # Checkbox/text defaults for known nested fields
                    if key in ['foodAllergens', 'physicalAilments', 'physicalDisability', 'mentalHealthConditions']:
                        if subkey == 'otherText':
                            nested_doc[subkey] = find_value_for_key(subkey, uid) or ''
                        elif subkey == 'other':
                            v = find_value_for_key(subkey, uid)
                            nested_doc[subkey] = bool(v) if v is not None else False
                        else:
                            v = find_value_for_key(subkey, uid)
                            nested_doc[subkey] = bool(v) if v is not None else False
                    else:
                        nested_doc[subkey] = build_doc_from_template(uid, {subkey: subval}, all_dfs, referral_docs).get(subkey, '')
                doc[key] = nested_doc
        elif isinstance(val, list):
            doc[key] = []
        else:
            # Special handling for address and address2
            if key == 'address':
                raw_addr = find_value_for_key('ADDRESS', uid)
                if raw_addr:
                    # Remove apartment/unit from address if present
                    addr = str(raw_addr)
                    # Remove common patterns like 'Apt 207', '#207', 'Unit 207', etc.
                    addr = re.sub(r'(Apt|#|Unit)\s*\w+', '', addr, flags=re.IGNORECASE).strip()
                    doc[key] = addr
                else:
                    doc[key] = ''
            elif key == 'address2':
                # Only use the APT # column, do not extract from address
                apt = find_value_for_key('APT #', uid)
                doc[key] = apt if apt else ''
            elif key == 'city':
                val_found = find_value_for_key(key, uid)
                if val_found:
                    doc[key] = val_found
                else:
                    addr = doc.get('address', '')
                    match = re.search(r'(NE|NW|SE|SW)\s*$', addr)
                    print(f"[DEBUG] Address for city inference: '{addr}', regex match: {match}")
                    if match:
                        doc[key] = 'Washington'
                    else:
                        doc[key] = ''
            elif key == 'state':
                val_found = find_value_for_key(key, uid)
                if val_found:
                    doc[key] = val_found
                else:
                    addr = doc.get('address', '')
                    match = re.search(r'(NE|NW|SE|SW)\s*$', addr)
                    print(f"[DEBUG] Address for state inference: '{addr}', regex match: {match}")
                    if match:
                        doc[key] = 'DC'
                    else:
                        doc[key] = ''
            elif key == 'deliveryInstructions':
                val_found = find_value_for_key('Delivery Instructions', uid)
                if val_found is None or str(val_found).strip() == '':
                    doc[key] = ""
                else:
                    doc[key] = str(val_found)
            elif key in ['startDate', 'endDate']:
                val_found = find_value_for_key(key, uid)
                date_format = "%m/%d/%Y"
                if val_found is None or str(val_found).strip() == '':
                    if key == 'endDate':
                        doc[key] = "12/31/2026"
                    else:
                        doc[key] = ""
                else:
                    try:
                        dt = pd.to_datetime(val_found)
                        doc[key] = dt.strftime(date_format)
                    except Exception:
                        doc[key] = str(val_found)
            else:
                # Special handling for zipCode: always use ZIP column
                if key == 'zipCode':
                    val_found = find_value_for_key('ZIP', uid)
                    print(f"[DEBUG] zipCode for UID {uid}: '{val_found}'")
                    doc[key] = val_found if val_found is not None else ''
                else:
                    val_found = find_value_for_key(key, uid)
                    if val_found is not None:
                        doc[key] = val_found
                    elif isinstance(val, bool):
                        doc[key] = False
                    elif isinstance(val, list):
                        doc[key] = []
                    else:
                        doc[key] = ''
    # Now run geocoding after address fields are set
    if 'coordinates' in template:
        address = doc.get('address', '')
        city = doc.get('city', '')
        state = doc.get('state', '')
        zip_code = doc.get('zipCode', '')
        if address and city and state and zip_code:
            coords = geocode_address_google(address, city, state, zip_code)
            doc['coordinates'] = coords if coords else None
        else:
            doc['coordinates'] = None
    return doc

if __name__ == "__main__":
    print('[TOP-DEBUG] Starting main()')
    import argparse
    # Constants
    EXCEL_PATH = "ETL/FFA_CLIENT_DATABASE.xlsx"
    SERVICE_ACCOUNT_PATH = "ETL/food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
    parser = argparse.ArgumentParser(description="Config-driven ETL Firestore Import")
    parser.add_argument("collection", type=str, help="Collection to process (e.g. client-profile2, referral, Drivers2)")
    parser.add_argument("uid", type=str, nargs="?", help="Optional: Client ID to process (if only one)")
    args = parser.parse_args()

    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()


    # Load all sheets into all_dfs
    all_dfs = pd.read_excel(EXCEL_PATH, sheet_name=None)

    # Load canonical template for structure
    template_path = os.path.join(os.path.dirname(__file__), '../ID-2218.json')
    if not os.path.exists(template_path):
        template_path = os.path.join(os.path.dirname(__file__), 'ID-2218.json')
    with open(template_path, 'r', encoding='utf-8') as f:
        canonical_template = json.load(f)

    # Load referral docs once and pass to build_doc_from_template
    referral_docs = {}
    try:
        referral_collection = db.collection("referral")
        for ref_doc in referral_collection.stream():
            data = ref_doc.to_dict()
            name = str(data.get("name", "")).strip().lower()
            org = str(data.get("organization", "")).strip().lower()
            if name and org:
                referral_docs[(name, org)] = ref_doc.id
    except Exception as e:
        print(f"[WARN] Could not load referral docs: {e}")

    # Use only the row scan/insert logic with break at ID-2216
    docs = []
    collection_key = args.collection
    record_id = args.uid if hasattr(args, 'uid') else None
    try:
        if record_id:
            if docs:
                doc = docs[0]
                with open('etl_row_scan.log', 'a', encoding='utf-8') as logf:
                    logf.write(f"[INSERT] Attempting insert for UID={doc['uid']} (single record)\n")
                collection.document(doc['uid']).set(doc, merge=False)
                print(f"Inserted record for uid={doc['uid']}")
            else:
                print(f"[TRACE] No record found in spreadsheet for uid '{record_id}'")
        else:
            for doc in docs:
                print(f"Inserting record for uid={doc['uid']}")
                with open('etl_row_scan.log', 'a', encoding='utf-8') as logf:
                    logf.write(f"[INSERT] Attempting insert for UID={doc['uid']}\n")
                collection.document(doc['uid']).set(doc, merge=False)
            print(f"Inserted {len(docs)} active records.")
    except Exception as e:
        print(f'[FATAL ERROR] Uncaught exception: {e}')
        pass
