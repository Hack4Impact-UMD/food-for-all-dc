import json

# Compare two newline-delimited JSON files
file1 = 'ETL/csv-one-line-client-database_w_referral.json'
file2 = 'ETL/excel_output.json'

def load_json_lines(path):
    with open(path, 'r', encoding='utf-8') as f:
        return [json.loads(line) for line in f if line.strip()]

def compare_records(records1, records2):
    # Compare by keys only
    key_diffs = []
    for i, (rec1, rec2) in enumerate(zip(records1, records2)):
        keys1 = set(rec1.keys())
        keys2 = set(rec2.keys())
        if keys1 != keys2:
            key_diffs.append({
                'index': i,
                'file1_keys': sorted(list(keys1)),
                'file2_keys': sorted(list(keys2))
            })
    return key_diffs

def main():
    records1 = load_json_lines(file1)
    records2 = load_json_lines(file2)
    print(f"File 1 records: {len(records1)}")
    print(f"File 2 records: {len(records2)}")
    if len(records1) != len(records2):
        print("Record count mismatch!")
    key_diffs = compare_records(records1, records2)
    print(f"Found {len(key_diffs)} records with differing keys.")
    if key_diffs:
        print("Sample key difference:")
        print(json.dumps(key_diffs[0], indent=2, ensure_ascii=False))
    # Also compare the set of keys for all records
    all_keys1 = set()
    all_keys2 = set()
    for rec in records1:
        all_keys1.update(rec.keys())
    for rec in records2:
        all_keys2.update(rec.keys())
    print(f"File 1 total unique keys: {len(all_keys1)}")
    print(f"File 2 total unique keys: {len(all_keys2)}")
    if all_keys1 == all_keys2:
        print("All records have matching key sets.")
    else:
        print("Files have different key sets.")

if __name__ == "__main__":
    main()
