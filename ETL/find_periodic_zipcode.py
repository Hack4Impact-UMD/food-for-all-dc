import json

def is_periodic(freq):
    freq = freq.lower()
    if freq in ['none', 'n/a', 'na', '']:
        return False
    if 'weekly' in freq or 'week' in freq:
        return False
    if any(p in freq for p in ['2x', 'twice', 'two', 'bi-monthly', 'bimonthly', '2/month', '2x/month', 'twice/month']):
        return False
    if any(p in freq for p in ['monthly', 'month', '1x/month', 'once/month', 'every month', 'one/month']):
        return False
    return True

with open('ETL/csv-one-line-client-database_w_referral.json', encoding='utf-8') as f:
    for line in f:
        rec = json.loads(line)
        freq = str(rec.get('Frequency', ''))
        if rec.get('Zipcode') and freq and is_periodic(freq):
            print(f"ID: {rec.get('ID')}, Zipcode: {rec.get('Zipcode')}, Frequency: {rec.get('Frequency')}")
            break
