from math import cos, sin, atan2, sqrt
from collections import defaultdict
import googlemaps
from firebase_functions import https_fn
from k_means_constrained import KMeansConstrained
from pydantic import BaseModel, ValidationError
from typing import Dict, List, Tuple
import json
import logging
import numpy as np
import os
from google.cloud import secretmanager

# ===========================
# Configuration Constants
# ===========================

# Google Cloud Project ID - will be auto-detected from environment
GCP_PROJECT_ID = os.environ.get('GCP_PROJECT', os.environ.get('GCLOUD_PROJECT', '251910218620'))

# Secret Manager configuration
SECRET_ID = "MAPS_API_KEY"
SECRET_VERSION = "latest"

# Allowed CORS origins - can be overridden with ALLOWED_ORIGINS env var (comma-separated)
DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://food-for-all-dc-caf23.web.app",
    "https://food-for-all-dc-caf23.firebaseapp.com"
]

# Parse allowed origins from environment or use defaults
ALLOWED_ORIGINS = (
    os.environ.get('ALLOWED_ORIGINS', '').split(',')
    if os.environ.get('ALLOWED_ORIGINS')
    else DEFAULT_ALLOWED_ORIGINS
)

# ===========================
# Data Models
# ===========================

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

# ===========================
# Helper Functions
# ===========================

def geocode_addresses(addresses: List[str]) -> List[Tuple[float, float]]:
    """
    Convert a list of addresses to (lat, lon) tuples using Google Maps Geocoding API.

    Args:
        addresses: List of address strings to geocode

    Returns:
        List of (latitude, longitude) tuples. Returns (0.0, 0.0) for failed geocoding.
    """
    client = secretmanager.SecretManagerServiceClient()

    try:
        secret_name = f"projects/{GCP_PROJECT_ID}/secrets/{SECRET_ID}/versions/{SECRET_VERSION}"
        response = client.access_secret_version(request={"name": secret_name})
        api_key = response.payload.data.decode("UTF-8")
        gmaps = googlemaps.Client(key=api_key)
    except Exception as e:
        print(f"Failed to initialize Google Maps client: {e}")
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
    """Convert latitude/longitude to Cartesian coordinates for distance calculations."""
    x = radius * cos(lat) * cos(lon)
    y = radius * cos(lat) * sin(lon)
    z = radius * sin(lat)
    return x, y, z

def get_cors_headers(req: https_fn.Request) -> dict:
    """
    Return CORS headers, allowing only whitelisted origins.

    Args:
        req: The HTTP request object

    Returns:
        Dictionary of CORS headers. Includes Access-Control-Allow-Origin only for whitelisted origins.
    """
    origin = req.headers.get('origin', '')

    if origin in ALLOWED_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    else:
        # Return headers without origin for non-whitelisted requests
        return {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }

# ===========================
# Cloud Functions Endpoints
# ===========================

@https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)
def geocode_addresses_endpoint(req: https_fn.Request) -> https_fn.Response:
    """
    HTTP endpoint to geocode multiple addresses using Google Maps API.

    Security: CORS restricted to allowed origins only.
    """
    # Get CORS headers based on request origin
    headers = get_cors_headers(req)

    # Block requests from non-whitelisted origins
    if "Access-Control-Allow-Origin" not in headers and req.method != "OPTIONS":
        return https_fn.Response(
            response=json.dumps({"error": "Origin not allowed"}),
            status=403,
            content_type="application/json"
        )
    
    # Handle preflight OPTIONS request
    if req.method == "OPTIONS":
        return https_fn.Response(
            "",
            headers=headers,
            status=204,
            content_type="application/json"
        )
    
    try:
        # Get data from request
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
    """
    HTTP endpoint to cluster delivery locations using constrained K-means algorithm.

    Security: CORS restricted to allowed origins only.
    """
    # Get CORS headers based on request origin
    headers = get_cors_headers(req)

    # Block requests from non-whitelisted origins
    if "Access-Control-Allow-Origin" not in headers and req.method != "OPTIONS":
        return https_fn.Response(
            response=json.dumps({"error": "Origin not allowed"}),
            status=403,
            content_type="application/json"
        )

    # Handle preflight OPTIONS request
    if req.method == "OPTIONS":
        return https_fn.Response(
            "",
            headers=headers,
            status=204,
            content_type="application/json"
        )

    data = req.get_json()
    coords = np.array(data["coords"], dtype=object)
    coords = np.array([latlon_to_cartesian(lat, lon) for lat, lon in coords])
    drivers_count = data["drivers_count"]
    min_deliveries = data["min_deliveries"]
    max_deliveries = data["max_deliveries"]

    if drivers_count > len(coords):
        print("Warning: Number of drivers exceeds the number of deliveries. Adjusting drivers count to match deliveries.")
        drivers_count = len(coords)  # Limit clusters to the number of deliveries


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
        clusters[f"{label+1}"].append(index)

    data = ClusterDeliveriesResponse(clusters=clusters)

    return https_fn.Response(
        response=json.dumps(data.model_dump()),
        status=201,
        headers=headers,
        content_type="application/json"
    )

