import json
import os

# Paths to the relevant files
FAILED_ACTIVE_PATH = 'failed_active_records.json'
FAILED_GEOCODING_PATH = 'failed_geocoding_records.json'
MAIN_DATA_PATH = os.path.join('ETL', 'csv-one-line-client-database_w_referral.json')
OUTPUT_PATH = 'retry_failed_records.json'

def load_json_lines(path):
    records = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except Exception:
                    pass
    return records

def load_json_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def main():
    # Load failed active records (full records)
    with open(FAILED_ACTIVE_PATH, 'r', encoding='utf-8') as f:
        failed_active = json.load(f)
    # Load failed geocoding records (minimal info)
    with open(FAILED_GEOCODING_PATH, 'r', encoding='utf-8') as f:
        failed_geocoding = json.load(f)
    # Load main data file (one JSON object per line)
    main_records = []
    with open(MAIN_DATA_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    main_records.append(json.loads(line))
                except Exception:
                    pass
    # Build lookup by ID for main records
    main_by_id = {str(r.get('ID', '')).strip(): r for r in main_records if 'ID' in r}
    # Collect all IDs from failed active and failed geocoding
    failed_ids = set()
    for r in failed_active:
        if 'ID' in r:
            failed_ids.add(str(r['ID']).strip())
    for r in failed_geocoding:
        if 'ID' in r:
            failed_ids.add(str(r['ID']).strip())
    # Build deduplicated list of full records for retry
    retry_records = []
    for id_ in failed_ids:
        rec = main_by_id.get(id_)
        if rec:
            retry_records.append(rec)
    print(f"Found {len(retry_records)} unique failed records for retry.")
    # Write to output file (one JSON object per line)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        for rec in retry_records:
            f.write(json.dumps(rec, ensure_ascii=False) + '\n')
    print(f"Wrote {len(retry_records)} records to {OUTPUT_PATH}")

if __name__ == '__main__':
    main()
