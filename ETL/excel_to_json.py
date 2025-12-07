import pandas as pd
import json
import sys

# Usage: python excel_to_json.py <input_excel> <output_json>

import pandas as pd
import json
import sys

def main(excel_path, output_path):
    # Read all sheets
    xls = pd.ExcelFile(excel_path)
    main_df = pd.read_excel(xls, sheet_name='Clients Main Information')
    deliveries_df = pd.read_excel(xls, sheet_name='Current Deliveries')

    # Build a mapping from Client ID in Current Deliveries to its row
    deliveries_map = {}
    for _, row in deliveries_df.iterrows():
        client_id = str(row.get('Client ID', '')).strip()
        if client_id:
            deliveries_map[client_id] = row

    records = []
    for _, row in main_df.iterrows():
        id_val = str(row.iloc[0]).strip()
        first = str(row.get('FIRST', '')).strip()
        last = str(row.get('LAST', '')).strip()
        # Only include rows with valid ID, FIRST, and LAST
        if id_val and first and last:
            record = {col: row.get(col, '') for col in main_df.columns}
            record['ID'] = id_val
            record['final_name'] = f"{first} {last}"
            # If this ID is in Current Deliveries, map its Client ID to ClientID key
            if id_val in deliveries_map:
                record['ClientID'] = str(deliveries_map[id_val].get('Client ID', '')).strip()
            records.append(record)

    # Also add records from Current Deliveries that aren't in Clients Main Information
    for client_id, row in deliveries_map.items():
        if client_id not in [r['ID'] for r in records]:
            first = str(row.get('FIRST', '')).strip()
            last = str(row.get('LAST', '')).strip()
            if client_id and first and last:
                record = {col: row.get(col, '') for col in deliveries_df.columns}
                record['ID'] = client_id
                record['ClientID'] = client_id
                record['final_name'] = f"{first} {last}"
                records.append(record)

    with open(output_path, 'w', encoding='utf-8') as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False) + '\n')

