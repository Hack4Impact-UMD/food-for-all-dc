# Coordinate Format Fix (Optional)

If the Routes page shows "invalid coordinates" after a full ETL, some
records may still use the old coordinate format. The app expects
coordinates as a Leaflet LatLngTuple array:

```
coordinates: [latitude, longitude]
```

Older records sometimes stored:

```
coordinates: {latitude: 38.91433, longitude: -77.036942}
```

## When to Run the Fix

Run the fix **only** if you see invalid coordinates in the UI.
New ETL runs already write the correct format.

## How to Run the Fix

```powershell
& "C:\localdev\UMD-Hackathon\food-for-all-dc\venv\Scripts\python.exe" ETL\fix_coordinate_format.py
```

## What It Does

- Scans `client-profile2` and `temp-profile2`
- Converts `{latitude, longitude}`, `{lat, lng}`, and GeoPoint values into `[latitude, longitude]`
- Updates documents in place
- Does **not** call the geocoding API (no extra cost)
- Prints a sample list of invalid records so you can identify missing or malformed coordinates
