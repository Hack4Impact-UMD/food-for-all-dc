import pandas as pd
import json

# Load spreadsheet
excel_path = 'ETL/FFA_CLIENT_DATABASE.xlsx'
sheet_name = 'Current Deliveries'
df = pd.read_excel(excel_path, sheet_name=sheet_name, dtype=str)

# Build address to ZIP mapping
address_zip_map = {}
for idx, row in df.iterrows():
    addr = str(row.get('ADDRESS', '')).strip().lower()
    zip_val = str(row.get('ZIP', '')).strip()
    if addr and zip_val:
        address_zip_map[addr] = zip_val

# Read and update JSON lines
input_path = 'ETL/csv-one-line-client-database_w_referral.json'
output_lines = []
with open(input_path, encoding='utf-8') as f:
    for line in f:
        try:
            rec = json.loads(line)
            addr = str(rec.get('ADDRESS', '')).strip().lower()
            if addr in address_zip_map:
                rec['Zipcode'] = address_zip_map[addr]
            output_lines.append(json.dumps(rec, ensure_ascii=False))
        except Exception:
            output_lines.append(line.strip())

# Overwrite the original file
with open(input_path, 'w', encoding='utf-8') as f:
    for line in output_lines:
        f.write(line + '\n')

print('Zipcode fields updated from spreadsheet ZIPs where matched.')
