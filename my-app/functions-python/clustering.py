from math import cos, sin, radians
from collections import defaultdict
import googlemaps
from firebase_functions import https_fn
from k_means_constrained import KMeansConstrained
from pydantic import BaseModel, ValidationError
from typing import Dict, List, Tuple, Optional
import json
import logging
import numpy as np
import os
from google.cloud import secretmanager
import firebase_admin
from firebase_admin import auth as admin_auth


try:
    firebase_admin.initialize_app()
except ValueError as e:
    # firebase_admin may already be initialized in some environments (e.g., local dev or tests).
    logging.warning("firebase_admin.initialize_app() failed: %s", e)

ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "https://food-for-all-dc-caf23.web.app",
    "https://food-for-all-dc-caf23.firebaseapp.com",
}

def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return value if value > 0 else default


MAX_GEOCODE_ADDRESSES = _env_int("MAX_GEOCODE_ADDRESSES", 1000)
MAX_ADDRESS_LENGTH = _env_int("MAX_ADDRESS_LENGTH", 500)
MAX_CLUSTER_COORDS = _env_int("MAX_CLUSTER_COORDS", 5000)
MAX_CLUSTER_DRIVERS = _env_int("MAX_CLUSTER_DRIVERS", 500)


class KMeansClusterDeliveriesRequest(BaseModel):
    coords: List[Tuple[float, float]]
    drivers_count: int
    min_deliveries: int
    max_deliveries: int


class GeocodeAddressesRequest(BaseModel):
    addresses: List[str]


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
        logging.error("Failed to initialize Google Maps client or access secret: %s", e, exc_info=True)
        raise

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
    lat_rad = radians(lat)
    lon_rad = radians(lon)
    x = radius * cos(lat_rad) * cos(lon_rad)
    y = radius * cos(lat_rad) * sin(lon_rad)
    z = radius * sin(lat_rad)
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


@https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)
def geocode_addresses_endpoint(req: https_fn.Request) -> https_fn.Response:
    headers = _cors_headers(req)

    if req.method == "OPTIONS":
        return https_fn.Response("", headers=headers, status=204, content_type="application/json")

    if req.method != "POST":
        return https_fn.Response(
            response=json.dumps({"error": "Method not allowed."}),
            status=405,
            headers=headers,
            content_type="application/json",
        )

    auth_error = _require_authenticated_request(req, headers)
    if auth_error:
        return auth_error

    try:
        data = req.get_json()
        request_body = GeocodeAddressesRequest(**data)
        if len(request_body.addresses) > MAX_GEOCODE_ADDRESSES:
            return https_fn.Response(
                response=json.dumps({"error": "Too many addresses in request."}),
                status=400,
                headers=headers,
                content_type="application/json",
            )
        for address in request_body.addresses:
            if not isinstance(address, str) or len(address) > MAX_ADDRESS_LENGTH:
                return https_fn.Response(
                    response=json.dumps({"error": "Invalid address entry."}),
                    status=400,
                    headers=headers,
                    content_type="application/json",
                )
        coordinates = geocode_addresses(request_body.addresses)

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
        logging.error("geocode_addresses_endpoint failed: %s", e, exc_info=True)
        return https_fn.Response(
            response=json.dumps({"error": "Internal server error."}),
            status=500,
            headers=headers,
            content_type="application/json",
        )


@https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)
def cluster_deliveries_k_means(req: https_fn.Request) -> https_fn.Response:
    headers = _cors_headers(req)

    if req.method == "OPTIONS":
        return https_fn.Response("", headers=headers, status=204, content_type="application/json")

    if req.method != "POST":
        return https_fn.Response(
            response=json.dumps({"error": "Method not allowed."}),
            status=405,
            headers=headers,
            content_type="application/json",
        )

    auth_error = _require_authenticated_request(req, headers)
    if auth_error:
        return auth_error

    try:
        data = req.get_json()
        request_body = KMeansClusterDeliveriesRequest(**data)
    except ValidationError as e:
        return https_fn.Response(
            response=json.dumps({"error": "Validation error", "details": parse_error_fields(e)}),
            status=400,
            headers=headers,
            content_type="application/json",
        )
    except Exception as e:
        logging.error("cluster_deliveries_k_means invalid json: %s", e, exc_info=True)
        return https_fn.Response(
            response=json.dumps({"error": "Invalid request payload."}),
            status=400,
            headers=headers,
            content_type="application/json",
        )

    if len(request_body.coords) > MAX_CLUSTER_COORDS:
        return https_fn.Response(
            response=json.dumps({"error": "Too many coordinates in request."}),
            status=400,
            headers=headers,
            content_type="application/json",
        )
    if request_body.drivers_count > MAX_CLUSTER_DRIVERS:
        return https_fn.Response(
            response=json.dumps({"error": "Too many drivers requested."}),
            status=400,
            headers=headers,
            content_type="application/json",
        )
    if request_body.drivers_count <= 0 or request_body.min_deliveries <= 0 or request_body.max_deliveries <= 0:
        return https_fn.Response(
            response=json.dumps({"error": "Invalid clustering parameters."}),
            status=400,
            headers=headers,
            content_type="application/json",
        )
    if request_body.min_deliveries > request_body.max_deliveries:
        return https_fn.Response(
            response=json.dumps({"error": "min_deliveries cannot exceed max_deliveries."}),
            status=400,
            headers=headers,
            content_type="application/json",
        )

    coords = np.array(request_body.coords, dtype=object)
    coords = np.array([latlon_to_cartesian(lat, lon) for lat, lon in coords])
    drivers_count = request_body.drivers_count
    min_deliveries = request_body.min_deliveries
    max_deliveries = request_body.max_deliveries

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
