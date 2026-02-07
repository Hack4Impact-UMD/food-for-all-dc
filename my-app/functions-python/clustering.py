from math import cos, sin
from collections import defaultdict
import googlemaps
from firebase_functions import https_fn
from k_means_constrained import KMeansConstrained
from pydantic import BaseModel, ValidationError
from typing import Dict, List, Tuple, Optional
import json
import logging
import numpy as np
from google.cloud import secretmanager
import firebase_admin
from firebase_admin import auth as admin_auth, app_check as admin_app_check


try:
    firebase_admin.initialize_app()
except ValueError:
    pass

ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "https://food-for-all-dc-caf23.web.app",
    "https://food-for-all-dc-caf23.firebaseapp.com",
}


class KMeansClusterDeliveriesRequest(BaseModel):
    coords: List[Tuple[float, float]]
    drivers_count: int
    min_deliveries: int
    max_deliveries: int


class ClusterDeliveriesResponse(BaseModel):
    clusters: Dict[str, List[int]]


class FieldError(BaseModel):
    field: str
    message: str


# Convert a list of addresses to (lat, lon) using Google Maps Geocoding API.
def geocode_addresses(addresses: List[str]) -> List[Tuple[float, float]]:
    client = secretmanager.SecretManagerServiceClient()
    project_id = "251910218620"
    secret_id = "MAPS_API_KEY"
    version = "latest"
    try:
        secret_name = f"projects/{project_id}/secrets/{secret_id}/versions/{version}"
        response = client.access_secret_version(request={"name": secret_name})
        api_key = response.payload.data.decode("UTF-8")
        gmaps = googlemaps.Client(key=api_key)
    except Exception as e:
        print(e)
        return [str(e)]

    logging.info("got gmaps")
    coords = []

    for address in addresses:
        try:
            geocode_result = gmaps.geocode(address)
            if geocode_result:
                location = geocode_result[0]["geometry"]["location"]
                coords.append((location["lat"], location["lng"]))
            else:
                print(f"Warning: Address not found: {address}")
                coords.append((0.0, 0.0))
        except Exception as e:
            logging.error(f"Error occurred: {str(e)}", exc_info=True)
            print(f"Geocoding failed for {address}: {str(e)}")
            coords.append((0.0, 0.0))

    return coords


def parse_error_fields(e: ValidationError):
    return [
        FieldError(field=".".join(map(str, error["loc"])), message=error["msg"])
        for error in e.errors()
    ]


def latlon_to_cartesian(lat, lon, radius=6371):
    x = radius * cos(lat) * cos(lon)
    y = radius * cos(lat) * sin(lon)
    z = radius * sin(lat)
    return x, y, z


def _cors_headers(req: https_fn.Request) -> dict:
    origin = req.headers.get("Origin", "")
    allow_origin = origin if origin in ALLOWED_ORIGINS else ""

    headers = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Vary": "Origin",
    }
    if allow_origin:
        headers["Access-Control-Allow-Origin"] = allow_origin
    return headers


def _extract_bearer_token(req: https_fn.Request) -> Optional[str]:
    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip() or None


def _extract_app_check_token(req: https_fn.Request) -> Optional[str]:
    token = req.headers.get("X-Firebase-AppCheck", "")
    return token.strip() or None


def _require_authenticated_request(req: https_fn.Request, headers: dict) -> Optional[https_fn.Response]:
    token = _extract_bearer_token(req)
    if not token:
        return https_fn.Response(
            response=json.dumps({"error": "Authentication required."}),
            status=401,
            headers=headers,
            content_type="application/json",
        )

    try:
        admin_auth.verify_id_token(token)
    except Exception:
        return https_fn.Response(
            response=json.dumps({"error": "Invalid or expired authentication token."}),
            status=401,
            headers=headers,
            content_type="application/json",
        )

    return None


def _require_app_check_request(req: https_fn.Request, headers: dict) -> Optional[https_fn.Response]:
    app_check_token = _extract_app_check_token(req)
    if not app_check_token:
        return https_fn.Response(
            response=json.dumps({"error": "App Check token required."}),
            status=401,
            headers=headers,
            content_type="application/json",
        )

    try:
        admin_app_check.verify_token(app_check_token)
    except Exception:
        return https_fn.Response(
            response=json.dumps({"error": "Invalid App Check token."}),
            status=401,
            headers=headers,
            content_type="application/json",
        )

    return None


@https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)
def geocode_addresses_endpoint(req: https_fn.Request) -> https_fn.Response:
    headers = _cors_headers(req)

    if req.method == "OPTIONS":
        return https_fn.Response("", headers=headers, status=204, content_type="application/json")

    auth_error = _require_authenticated_request(req, headers)
    if auth_error:
        return auth_error

    app_check_error = _require_app_check_request(req, headers)
    if app_check_error:
        return app_check_error

    try:
        data = req.get_json()
        addresses = data["addresses"]
        coordinates = geocode_addresses(addresses)

        return https_fn.Response(
            response=json.dumps({"coordinates": coordinates}),
            status=200,
            headers=headers,
            content_type="application/json",
        )
    except ValidationError as e:
        return https_fn.Response(
            response=json.dumps({"error": "Validation error", "details": parse_error_fields(e)}),
            status=400,
            headers=headers,
            content_type="application/json",
        )
    except Exception as e:
        return https_fn.Response(
            response=json.dumps({"error": str(e)}),
            status=500,
            headers=headers,
            content_type="application/json",
        )


@https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)
def cluster_deliveries_k_means(req: https_fn.Request) -> https_fn.Response:
    headers = _cors_headers(req)

    if req.method == "OPTIONS":
        return https_fn.Response("", headers=headers, status=204, content_type="application/json")

    auth_error = _require_authenticated_request(req, headers)
    if auth_error:
        return auth_error

    app_check_error = _require_app_check_request(req, headers)
    if app_check_error:
        return app_check_error

    data = req.get_json()
    coords = np.array(data["coords"], dtype=object)
    coords = np.array([latlon_to_cartesian(lat, lon) for lat, lon in coords])
    drivers_count = data["drivers_count"]
    min_deliveries = data["min_deliveries"]
    max_deliveries = data["max_deliveries"]

    if drivers_count > len(coords):
        print("Warning: Number of drivers exceeds the number of deliveries. Adjusting drivers count to match deliveries.")
        drivers_count = len(coords)

    size_max = max(max_deliveries, (len(coords) + drivers_count - 1) // drivers_count)

    kmeans = KMeansConstrained(
        n_clusters=drivers_count,
        size_min=min_deliveries,
        size_max=size_max,
        random_state=42,
    ).fit(coords)
    labels = kmeans.labels_

    clusters = defaultdict(list)
    for index, label in enumerate(labels):
        clusters[f"{label + 1}"].append(index)

    response_data = ClusterDeliveriesResponse(clusters=clusters)

    return https_fn.Response(
        response=json.dumps(response_data.model_dump()),
        status=201,
        headers=headers,
        content_type="application/json",
    )
