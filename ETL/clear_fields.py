import json
import sys

# Usage: python clear_fields.py <input_file> <output_file>
# This script clears the 'otherText' field in mentalHealthConditions, physicalAilments, and physicalDisability.

def clear_fields(data):
    if 'mentalHealthConditions' in data and isinstance(data['mentalHealthConditions'], dict):
        data['mentalHealthConditions']['otherText'] = ""
    if 'physicalAilments' in data and isinstance(data['physicalAilments'], dict):
        data['physicalAilments']['otherText'] = ""
    if 'physicalDisability' in data and isinstance(data['physicalDisability'], dict):
        data['physicalDisability']['otherText'] = ""
    return data

def main():
    if len(sys.argv) != 3:
        print("Usage: python clear_fields.py <input_file> <output_file>")
        sys.exit(1)
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    data = clear_fields(data)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Cleared fields and wrote output to {output_file}")

if __name__ == "__main__":
    main()
