# This script compares records in chunks and saves mismatches to mismatch.txt
import pandas as pd

main_df = pd.read_excel('ETL/FFA_CLIENT_DATABASE.xlsx', sheet_name='Clients Main Information')
deliv_df = pd.read_excel('ETL/FFA_CLIENT_DATABASE.xlsx', sheet_name='Current Deliveries')

chunk_size = 200
main_len = len(main_df)
deliv_len = len(deliv_df)

main_records = set()
deliv_records = set()

for start in range(0, main_len, chunk_size):
    chunk = main_df.iloc[start:start+chunk_size]
    for _, row in chunk.iterrows():
        id_val = str(row.iloc[0]).strip()
        first = str(row.get('FIRST', '')).strip()
        last = str(row.get('LAST', '')).strip()
        if id_val:
            main_records.add((id_val, first, last))

for start in range(0, deliv_len, chunk_size):
    chunk = deliv_df.iloc[start:start+chunk_size]
    for _, row in chunk.iterrows():
        client_id = str(row.get('Client ID', '')).strip()
        first = str(row.get('FIRST', '')).strip()
        last = str(row.get('LAST', '')).strip()
        if client_id:
            deliv_records.add((client_id, first, last))

only_in_main = main_records - deliv_records
only_in_deliv = deliv_records - main_records

with open('ETL/mismatch.txt', 'w', encoding='utf-8') as f:
    f.write('Records only in Clients Main Information tab:\n')
    for rec in only_in_main:
        f.write(f'ID: {rec[0]}, FIRST: {rec[1]}, LAST: {rec[2]}, TAB: Clients Main Information\n')
    f.write('\nRecords only in Current Deliveries tab:\n')
    for rec in only_in_deliv:
        f.write(f'Client ID: {rec[0]}, FIRST: {rec[1]}, LAST: {rec[2]}, TAB: Current Deliveries\n')
print('Done. Mismatches saved to ETL/mismatch.txt')
