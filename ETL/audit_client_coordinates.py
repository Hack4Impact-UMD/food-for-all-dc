import argparse
import csv
import json
import math
import os
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import firebase_admin
import requests
from firebase_admin import credentials, firestore

from address_utils import build_dc_geocoding_address, is_street_style_address


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CREDENTIALS = ROOT / "ETL" / "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
DEFAULT_ENV_FILE = ROOT / "my-app" / ".env"
GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"
CSV_FIELDNAMES = [
    "client_id",
    "audit_status",
    "full_address",
    "stored_quadrant",
    "stored_zip",
    "stored_ward",
    "stored_latitude",
    "stored_longitude",
    "geocoded_latitude",
    "geocoded_longitude",
    "distance_meters",
    "geocoded_zip",
    "formatted_address",
    "location_type",
    "partial_match",
    "geocode_status",
    "geocode_error",
]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip(), value.strip().strip('"').strip("'"))


def normalize_coordinates(value: Any) -> Optional[tuple[float, float]]:
    if isinstance(value, (list, tuple)) and len(value) == 2:
        latitude, longitude = value
    elif isinstance(value, dict):
        latitude = value.get("lat", value.get("latitude"))
        longitude = value.get("lng", value.get("longitude"))
    else:
        return None
    if not all(isinstance(item, (int, float)) and math.isfinite(item) for item in (latitude, longitude)):
        return None
    if latitude == 0 or longitude == 0:
        return None
    return float(latitude), float(longitude)


def distance_meters(left: tuple[float, float], right: tuple[float, float]) -> float:
    earth_radius_meters = 6_371_000
    left_latitude, left_longitude = map(math.radians, left)
    right_latitude, right_longitude = map(math.radians, right)
    latitude_delta = right_latitude - left_latitude
    longitude_delta = right_longitude - left_longitude
    haversine = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(left_latitude)
        * math.cos(right_latitude)
        * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * earth_radius_meters * math.asin(math.sqrt(haversine))


def extract_postal_code(result: dict[str, Any]) -> str:
    for component in result.get("address_components", []):
        if "postal_code" in component.get("types", []):
            return str(component.get("long_name", ""))
    return ""


def geocode_full_address(
    session: requests.Session,
    full_address: str,
    api_key: str,
) -> dict[str, Any]:
    try:
        response = session.get(
            GEOCODING_URL,
            params={"address": full_address, "key": api_key},
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
    except requests.exceptions.RequestException as error:
        return {
            "status": "REQUEST_ERROR",
            "error": f"{type(error).__name__}: Google Maps request failed",
        }

    status = str(payload.get("status", "UNKNOWN"))
    results = payload.get("results") or []
    if status != "OK" or not results:
        return {"status": status, "error": payload.get("error_message", "")}

    result = results[0]
    location = result.get("geometry", {}).get("location", {})
    return {
        "status": status,
        "coordinates": (float(location["lat"]), float(location["lng"])),
        "formatted_address": result.get("formatted_address", ""),
        "postal_code": extract_postal_code(result),
        "location_type": result.get("geometry", {}).get("location_type", ""),
        "partial_match": bool(result.get("partial_match", False)),
    }


def load_geocode_cache(report_path: Optional[Path]) -> dict[str, dict[str, Any]]:
    if report_path is None:
        return {}
    cache: dict[str, dict[str, Any]] = {}
    with report_path.open(newline="", encoding="utf-8") as input_file:
        for row in csv.DictReader(input_file):
            if row.get("geocode_status") != "OK" or not row.get("full_address"):
                continue
            cache[row["full_address"]] = {
                "status": "OK",
                "coordinates": (
                    float(row["geocoded_latitude"]),
                    float(row["geocoded_longitude"]),
                ),
                "formatted_address": row.get("formatted_address", ""),
                "postal_code": row.get("geocoded_zip", ""),
                "location_type": row.get("location_type", ""),
                "partial_match": row.get("partial_match", "").lower() == "true",
            }
    return cache


def finite_non_negative_float(value: str) -> float:
    try:
        parsed = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError("must be a finite non-negative number") from error
    if not math.isfinite(parsed) or parsed < 0:
        raise argparse.ArgumentTypeError("must be a finite non-negative number")
    return parsed


def escape_csv_cell(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    if value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r", "\n")):
        return f"'{value}"
    return value


def write_csv_report(csv_path: Path, rows: list[dict[str, Any]]) -> None:
    with csv_path.open("w", newline="", encoding="utf-8") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(
            {field: escape_csv_cell(row.get(field, "")) for field in CSV_FIELDNAMES}
            for row in rows
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Audit saved client coordinates using full addresses.")
    parser.add_argument("--threshold-meters", type=finite_non_negative_float, default=250.0)
    parser.add_argument("--request-delay", type=float, default=0.1)
    parser.add_argument("--collection", default="client-profile2")
    parser.add_argument("--credentials", type=Path, default=DEFAULT_CREDENTIALS)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "ETL" / "audit_reports")
    parser.add_argument("--seed-report", type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    load_env_file(DEFAULT_ENV_FILE)
    api_key = os.getenv("REACT_APP_GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise RuntimeError("Google Maps API key is not configured.")

    if not firebase_admin._apps:
        firebase_admin.initialize_app(credentials.Certificate(str(args.credentials)))
    database = firestore.client()
    profiles = list(database.collection(args.collection).stream())
    cache = load_geocode_cache(args.seed_report)
    api_request_count = 0
    geocodable_addresses: set[str] = set()
    rows: list[dict[str, Any]] = []
    session = requests.Session()

    for index, snapshot in enumerate(profiles, start=1):
        profile = snapshot.to_dict() or {}
        full_address = build_dc_geocoding_address(
            profile.get("address"),
            profile.get("quadrant"),
            profile.get("city"),
            profile.get("state"),
            profile.get("zipCode"),
        )
        if not is_street_style_address(profile.get("address")):
            result = {"status": "NOT_GEOCODABLE"}
        else:
            geocodable_addresses.add(full_address)
            if full_address not in cache:
                cache[full_address] = geocode_full_address(session, full_address, api_key)
                api_request_count += 1
                if args.request_delay > 0:
                    time.sleep(args.request_delay)
            result = cache[full_address]
        stored_coordinates = normalize_coordinates(profile.get("coordinates"))
        geocoded_coordinates = result.get("coordinates")
        distance = (
            distance_meters(stored_coordinates, geocoded_coordinates)
            if stored_coordinates and geocoded_coordinates
            else None
        )
        if result.get("status") == "NOT_GEOCODABLE":
            audit_status = "not_geocodable"
        elif result.get("status") != "OK":
            audit_status = "geocode_error"
        elif stored_coordinates is None:
            audit_status = "missing_coordinates"
        elif distance is not None and distance >= args.threshold_meters:
            audit_status = "coordinate_mismatch"
        else:
            audit_status = "match"

        rows.append(
            {
                "client_id": snapshot.id,
                "audit_status": audit_status,
                "full_address": full_address,
                "stored_quadrant": profile.get("quadrant", ""),
                "stored_zip": profile.get("zipCode", ""),
                "stored_ward": profile.get("ward", ""),
                "stored_latitude": stored_coordinates[0] if stored_coordinates else "",
                "stored_longitude": stored_coordinates[1] if stored_coordinates else "",
                "geocoded_latitude": geocoded_coordinates[0] if geocoded_coordinates else "",
                "geocoded_longitude": geocoded_coordinates[1] if geocoded_coordinates else "",
                "distance_meters": round(distance, 1) if distance is not None else "",
                "geocoded_zip": result.get("postal_code", ""),
                "formatted_address": result.get("formatted_address", ""),
                "location_type": result.get("location_type", ""),
                "partial_match": result.get("partial_match", ""),
                "geocode_status": result.get("status", ""),
                "geocode_error": result.get("error", ""),
            }
        )
        if index % 100 == 0 or index == len(profiles):
            print(f"Audited {index}/{len(profiles)} profiles ({len(cache)} unique addresses)")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    date_stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    csv_path = args.output_dir / f"client_coordinate_audit_{date_stamp}.csv"
    summary_path = args.output_dir / f"client_coordinate_audit_{date_stamp}.json"
    write_csv_report(csv_path, rows)

    status_counts = Counter(row["audit_status"] for row in rows)
    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "collection": args.collection,
        "threshold_meters": args.threshold_meters,
        "profiles_audited": len(rows),
        "unique_geocodable_addresses": len(geocodable_addresses),
        "api_requests": api_request_count,
        "status_counts": dict(sorted(status_counts.items())),
        "csv_report": str(csv_path),
    }
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    print(f"Summary: {summary_path}")


if __name__ == "__main__":
    main()
