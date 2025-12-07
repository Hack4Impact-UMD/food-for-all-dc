import pandas as pd
import json

# Load spreadsheet
excel_path = 'ETL/FFA_CLIENT_DATABASE.xlsx'
sheet_name = 'Current Deliveries'
df = pd.read_excel(excel_path, sheet_name=sheet_name, dtype=str)

# Load JSON lines file
data = []
with open('ETL/csv-one-line-client-database_w_referral.json', encoding='utf-8') as f:
    for line in f:
        try:
            data.append(json.loads(line))
        except Exception:
            pass

# Build address to record mapping for JSON (normalize whitespace/case)
json_addr_map = {rec.get('ADDRESS', '').strip().lower(): rec for rec in data}

zipcode_matches = 0
ZIPcode_matches = 0
no_match = 0
rows = 0

for idx, row in df.iterrows():
    addr = str(row.get('ADDRESS', '')).strip().lower()
    sheet_zip = str(row.get('ZIP', '')).strip()
    if not addr or not sheet_zip:
        continue
    rows += 1
    rec = json_addr_map.get(addr)
    if not rec:
        no_match += 1
        continue
    zip_zipcode = str(rec.get('Zipcode', '')).strip()
    zip_ZIPcode = str(rec.get('ZIPcode', '')).strip()
    if sheet_zip == zip_zipcode:
        zipcode_matches += 1
    if sheet_zip == zip_ZIPcode:
        ZIPcode_matches += 1

print(f"Rows checked: {rows}")
print(f"No address match in JSON: {no_match}")
print(f"Spreadsheet ZIP matches Zipcode: {zipcode_matches}")
print(f"Spreadsheet ZIP matches ZIPcode: {ZIPcode_matches}")
if zipcode_matches > ZIPcode_matches:
    print("Zipcode is a better match.")
elif ZIPcode_matches > zipcode_matches:
    print("ZIPcode is a better match.")
else:
    print("Both fields match equally or neither matches well.")
