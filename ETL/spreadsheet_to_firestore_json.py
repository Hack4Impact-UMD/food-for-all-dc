import pandas as pd
from datetime import datetime
import json

# Config
EXCEL_PATH = "ETL/FFA_CLIENT_DATABASE.xlsx"
OUTPUT_DIR = "ETL/output_json/"
DEFAULT_END_DATE = "12/31/2026"

# Helper to safely get and clean a value
def get_val(row, col, default=""):
    val = row.get(col, default)
    if pd.isna(val):
        return default
    return str(val).strip()

def process_clients(sheet):
    df = pd.read_excel(EXCEL_PATH, sheet_name=sheet)
    clients = []
    for _, row in df.iterrows():
        # Address: exclude apartment number
        address = get_val(row, "ADDRESS")
        # Apartment number is separate
        address2 = get_val(row, "APT #")
        # End date logic
        end_date = get_val(row, "End Date")
        if not end_date:
            end_date = DEFAULT_END_DATE
        # Health data: send to adminNotes, not to physical/mental fields
        admin_notes = []
        if get_val(row, "Physical Aliments Other"):
            admin_notes.append(f"Physical Ailments Other: {get_val(row, 'Physical Aliments Other')}")
        if get_val(row, "Mental Health Conditions Other"):
            admin_notes.append(f"Mental Health Conditions Other: {get_val(row, 'Mental Health Conditions Other')}")
        # Life Challenges should NOT be populated from health data
        client = {
            "uid": get_val(row, "Client ID"),
            "firstName": get_val(row, "FIRST"),
            "lastName": get_val(row, "LAST"),
            "address": address,
            "address2": address2,
            "zipCode": get_val(row, "ZIP"),
            "city": get_val(row, "City"),
            "state": get_val(row, "State"),
            "quadrant": get_val(row, "Quadrant"),
            "ward": get_val(row, "Ward"),
            "phone": get_val(row, "Phone"),
            "adults": int(row.get("# Adults", 0)),
            "children": int(row.get("# kids", 0)),
            "total": int(row.get("HH Size", 0)),
            "startDate": get_val(row, "Start Date"),
            "endDate": end_date,
            "deliveryFreq": get_val(row, "Frequency"),
            "deliveryDetails": {
                "deliveryInstructions": get_val(row, "Delivery Instructions"),
                "dietaryRestrictions": get_val(row, "Dietary Restrictions")
            },
            "notes": get_val(row, "Notes"),
            "adminNotes": admin_notes,
            # ...add other fields as needed...
        }
        clients.append(client)
    return clients

def main():
    import os
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    # Map each relevant sheet to its collection
    mapping = {
        "Clients Main Information": "client-profile2",
        "ALL Social Workers": "referral",
        "Drivers": "Drivers2",
        # Add more mappings as needed
    }
    for sheet, collection in mapping.items():
        print(f"Processing {sheet} -> {collection}")
        data = process_clients(sheet) if collection == "client-profile2" else []  # Add other processors as needed
        with open(f"{OUTPUT_DIR}{collection}.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Exported {len(data)} records to {collection}.json")

if __name__ == "__main__":
    main()
