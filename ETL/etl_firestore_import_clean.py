import pandas as pd
import re
import os
import json
from firebase_admin import credentials, firestore
import firebase_admin

# --- FIELD MAP (insert your FIELD_MAP here) ---
FIELD_MAP = {
    "client-profile2": {
        "sheet": "Clients Main Information",
        "fields": {
            "uid": " ",
            "firstName": "FIRST",
            "lastName": "LAST",
            "address": "ADDRESS",
            "address2": "APT #",
            "zipCode": "ZIP",
            "city": "City",
            "state": "State",
            "quadrant": "Quadrant",
            "ward": "Ward",
            "phone": "Phone",
            "adults": "# Adults",
            "children": "# Children",
            "total": "HH Size",
            "startDate": "Start Date",
            "endDate": "End Date",
            "deliveryFreq": "Frequency",
            "notes": "Notes",
            "language": "Language",
            "deliveryDetails.deliveryInstructions": "Delivery Instructions",
        }
    },
    # Add other collections as needed
}

def force_clean_uid(val):
    if pd.isna(val):
        return ''
    s = str(val)
    s = re.sub(r"[\'\"]", '', s)
    s = s.strip()
    return s

def delete_firestore_records(collection, uid=None):
    if uid:
        docs = collection.where("uid", "==", uid).stream()
        for doc in docs:
            doc.reference.delete()
    else:
        docs = collection.stream()
        for doc in docs:
            doc.reference.delete()

def process_collection(collection_key, df, only_uid=None):
    mapping = FIELD_MAP[collection_key]["fields"]
    docs = []
    canonical_fields = None
    canonical_template = None
    canonical_path = os.path.join(os.path.dirname(__file__), "../ID-2218.json")
    if not os.path.exists(canonical_path):
        canonical_path = os.path.join(os.path.dirname(__file__), "ID-2218.json")
    if os.path.exists(canonical_path):
        with open(canonical_path, "r", encoding="utf-8") as f:
            canonical_template = json.load(f)
            canonical_fields = list(canonical_template.keys())
    else:
        raise RuntimeError("Canonical template (ID-0006.json) not found.")
    xls = pd.ExcelFile("ETL/FFA_CLIENT_DATABASE.xlsx")
    sheet_dfs = {sheet: pd.read_excel(xls, sheet) for sheet in xls.sheet_names}
    for _, row in df.iterrows():
        raw_uid = row.get("uid", "")
        cleaned_uid = force_clean_uid(raw_uid)
        cleaned_only_uid = force_clean_uid(only_uid) if only_uid is not None else None
        if cleaned_only_uid is not None and cleaned_uid != cleaned_only_uid:
            continue
        address_val = row.get('ADDRESS', '')
        address2_val = row.get('APT #', '')
        street_address = address_val
        apt_val = address2_val
        if isinstance(address_val, str):
            match = re.search(r"(.+?)(?:\s+(Apt|Unit|#)\s*([\w\-]+))$", address_val, re.IGNORECASE)
            if match:
                street_address = match.group(1).strip()
                apt_val = match.group(2) + ' ' + match.group(3)
        if not address2_val and apt_val:
            address2_val = apt_val
        quadrant_match = re.search(r'\b(NW|NE|SE|SW)\b', str(address_val).upper())
        inferred_city = None
        inferred_state = None
        if quadrant_match:
            inferred_city = 'Washington'
            inferred_state = 'DC'
        geocode_address = street_address
        active_val_raw = None
        for col in row.index:
            if col.strip().lower() == 'active':
                active_val_raw = row[col]
        is_active = False
        if isinstance(active_val_raw, (int, float)):
            is_active = float(active_val_raw) == 1.0
        else:
            active_val_str = str(active_val_raw).strip().lower() if active_val_raw is not None else ''
            is_active = active_val_str in ["1", "yes", "true", "y"]
        if not is_active:
            continue
        doc = {}
        for field in canonical_fields:
            value = None
            mapped_col = mapping.get(field)
            if field == 'address':
                value = street_address
            elif field == 'address2':
                value = address2_val
            elif field == 'city' and inferred_city:
                value = inferred_city
            elif field == 'state' and inferred_state:
                value = inferred_state
            elif field in ['startDate', 'endDate']:
                raw_val = None
                if mapped_col and mapped_col in row:
                    raw_val = row.get(mapped_col, None)
                if raw_val is None:
                    for sheet, sdf in sheet_dfs.items():
                        id_cols = [c for c in sdf.columns if isinstance(c, str) and c.strip().lower() in ['client id', 'uid', ' ']]
                        for id_col in id_cols:
                            match_df = sdf[sdf[id_col].astype(str).str.strip() == cleaned_uid]
                            if not match_df.empty and field in match_df.columns:
                                raw_val = match_df.iloc[0][field]
                                break
                        if raw_val is not None:
                            break
                value = raw_val
                if isinstance(raw_val, str):
                    m = re.match(r"(\d{4}-\d{2}-\d{2})", raw_val)
                    if m:
                        value = m.group(1)
                    else:
                        m2 = re.match(r"(\d{1,2}/\d{1,2}/\d{4})", raw_val)
                        if m2:
                            value = m2.group(1)
                elif hasattr(raw_val, 'date'):
                    value = str(raw_val.date())
            else:
                if mapped_col and mapped_col in row:
                    value = row.get(mapped_col, None)
                if value is None:
                    for sheet, sdf in sheet_dfs.items():
                        id_cols = [c for c in sdf.columns if isinstance(c, str) and c.strip().lower() in ['client id', 'uid', ' ']]
                        for id_col in id_cols:
                            match_df = sdf[sdf[id_col].astype(str).str.strip() == cleaned_uid]
                            if not match_df.empty and field in match_df.columns:
                                value = match_df.iloc[0][field]
                                break
                        if value is not None:
                            break
            if value is None and canonical_template is not None and field in canonical_template:
                value = canonical_template[field]
            doc[field] = value
        doc["uid"] = cleaned_uid
        doc["activeStatus"] = is_active
        docs.append(doc)
    return docs

if __name__ == "__main__":
    import traceback
    try:
        print('[TOP-DEBUG] Starting main()')
        import argparse
        parser = argparse.ArgumentParser(description="Config-driven ETL Firestore Import")
        parser.add_argument("collection", type=str, help="Collection to process (e.g. client-profile2, referral, Drivers2)")
        parser.add_argument("uid", type=str, nargs="?", help="Optional: Client ID to process (if only one)")
        args = parser.parse_args()
        cred = credentials.Certificate("ETL/food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json")
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        collection_key = args.collection
        sheet_name = FIELD_MAP[collection_key]["sheet"]
        df = pd.read_excel("ETL/FFA_CLIENT_DATABASE.xlsx", sheet_name=sheet_name)
        record_id = args.uid if hasattr(args, 'uid') else None
        docs = process_collection(collection_key, df, only_uid=record_id)
        collection = db.collection(collection_key)
        if record_id:
            found = False
            def normalize_uid(val):
                return str(val).replace("'", "").replace('"', "").strip().lower()
            record_id_clean = normalize_uid(record_id)
            for doc in docs:
                doc_uid = doc.get("uid", "")
                doc_uid_clean = normalize_uid(doc_uid)
                if doc_uid and doc_uid_clean == record_id_clean:
                    try:
                        delete_firestore_records(collection, doc_uid)
                        collection.document(doc_uid).set(doc, merge=False)
                    except Exception as e:
                        print(f"[ERROR] Exception while inserting document for uid={doc_uid}: {e}")
                        traceback.print_exc()
                    found = True
                    break
            if not found:
                print(f"[TRACE] No record found in spreadsheet for uid '{record_id}'")
        else:
            delete_firestore_records(collection)
            for doc in docs:
                uid = doc.get('uid', '')
                if uid:
                    collection.document(uid).set(doc)
                else:
                    collection.add(doc)
        print("Done.")
    except Exception as e:
        print(f'[FATAL ERROR] Uncaught exception: {e}')
        traceback.print_exc()
