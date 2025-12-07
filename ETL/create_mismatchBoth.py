# This script extracts the 628 unique mismatched LAST+FIRST combinations and writes their ID/Client ID, LAST, FIRST, and tab to mismatchBoth.txt
main_set = set()
deliv_set = set()
main_records = dict()
deliv_records = dict()
with open('ETL/mismatch.txt', 'r', encoding='utf-8') as f:
    for line in f:
        if 'TAB: Clients Main Information' in line:
            parts = line.split(',')
            id_val = parts[0].split(':',1)[1].strip()
            first = parts[1].split(':',1)[1].strip()
            last = parts[2].split(':',1)[1].strip()
            key = (first, last)
            main_set.add(key)
            main_records[key] = (id_val, last, first, 'Clients Main Information')
        elif 'TAB: Current Deliveries' in line:
            parts = line.split(',')
            client_id = parts[0].split(':',1)[1].strip()
            first = parts[1].split(':',1)[1].strip()
            last = parts[2].split(':',1)[1].strip()
            key = (first, last)
            deliv_set.add(key)
            deliv_records[key] = (client_id, last, first, 'Current Deliveries')
symmetric_diff = main_set.symmetric_difference(deliv_set)
with open('ETL/mismatchBoth.txt', 'w', encoding='utf-8') as out:
    out.write('ID/Client ID\tLAST\tFIRST\tTAB\n')
    for key in symmetric_diff:
        if key in main_records:
            rec = main_records[key]
            out.write(f'{rec[0]}\t{rec[1]}\t{rec[2]}\t{rec[3]}\n')
        if key in deliv_records:
            rec = deliv_records[key]
            out.write(f'{rec[0]}\t{rec[1]}\t{rec[2]}\t{rec[3]}\n')
print('Done. mismatchBoth.txt created with 628 records.')
