import json
import sys
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed

BATCH_SIZE = 500  # Match Firestore batch size

# Clear the three fields in a single record
def clear_fields(record):
    if 'mentalHealthConditions' in record and isinstance(record['mentalHealthConditions'], dict):
        record['mentalHealthConditions']['otherText'] = ""
    if 'physicalAilments' in record and isinstance(record['physicalAilments'], dict):
        record['physicalAilments']['otherText'] = ""
    if 'physicalDisability' in record and isinstance(record['physicalDisability'], dict):
        record['physicalDisability']['otherText'] = ""
    return record

def process_batch(batch: List[dict]) -> List[dict]:
    return [clear_fields(record) for record in batch]

def main():
    if len(sys.argv) != 3:
        print("Usage: python clear_fields_batch.py <input_json_array_file> <output_json_array_file>")
        sys.exit(1)
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    with open(input_file, 'r', encoding='utf-8') as f:
        records = json.load(f)
    batches = [records[i:i+BATCH_SIZE] for i in range(0, len(records), BATCH_SIZE)]
    processed_records = []
    with ThreadPoolExecutor() as executor:
        futures = [executor.submit(process_batch, batch) for batch in batches]
        for future in as_completed(futures):
            processed_records.extend(future.result())
    # Preserve original order
    processed_records.sort(key=lambda r: records.index(r))
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(processed_records, f, indent=2, ensure_ascii=False)
    print(f"Processed {len(records)} records in batches of {BATCH_SIZE} and wrote to {output_file}")

if __name__ == "__main__":
    main()
