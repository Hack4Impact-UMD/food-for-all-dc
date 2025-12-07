import json
excel_ids = set()
excel_records = dict()
with open('ETL/excel_output.json', 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
            id_val = obj.get('ID', '').strip()
            final_name = obj.get('final_name', '').strip()
            if id_val:
                excel_ids.add(id_val)
                excel_records[id_val] = final_name
        except Exception:
            pass
csv_ids = set()
csv_records = dict()
with open('ETL/csv-one-line-client-database_w_referral.json', 'r', encoding='utf-8') as f:
    for line in f:
        try:
            obj = json.loads(line)
            id_val = obj.get('ID', '').strip()
            final_name = obj.get('final_name', '').strip()
            if id_val:
                csv_ids.add(id_val)
                csv_records[id_val] = final_name
        except Exception:
            pass
diff_ids = excel_ids - csv_ids
with open('ETL/diff_12_records.txt', 'w', encoding='utf-8') as out:
    out.write('ID\tfinal_name\n')
    for id_val in diff_ids:
        out.write(f'{id_val}\t{excel_records[id_val]}\n')
print('Done. 12 records written to diff_12_records.txt')
