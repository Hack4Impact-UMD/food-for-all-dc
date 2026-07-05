# Python Firebase Cloud Functions

Backend functions for Food For All DC: geocoding, clustering, user management, and delivery tracking.

## Quick Start

```bash
# Setup
cd my-app/functions-python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Test locally (from project root)
cd ../..
firebase emulators:start

# Deploy
firebase deploy --only functions
```

## Functions

| Function | Type | Purpose |
|----------|------|---------|
| `geocode_addresses_endpoint` | HTTP | Convert addresses to coordinates |
| `cluster_deliveries_k_means` | HTTP | Group delivery locations into clusters |
| `deleteUserAccount` | Callable | Delete user (Auth + Firestore) |
| `updateDeliveriesDaily` | Scheduled | Daily cron: update client delivery records (runs 10:00 AM ET) |

## File Structure

- `main.py` - User/delivery functions (`deleteUserAccount`, `updateDeliveriesDaily`)
- `clustering.py` - Geocoding + clustering endpoints

## Configuration

- **Maps API Key**: Stored in Secret Manager (`MAPS_API_KEY`)
- **CORS**: Configured for localhost:3000 and production domains

## Testing

Test HTTP functions locally:
```bash
curl -X POST http://localhost:5001/food-for-all-dc-caf23/us-central1/geocode_addresses_endpoint \
  -H "Content-Type: application/json" \
  -d '{"addresses": ["1600 Pennsylvania Ave NW, Washington, DC"]}'
```

View logs: `firebase functions:log`
