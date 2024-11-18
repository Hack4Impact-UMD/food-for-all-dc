from math import cos, sin
import googlemaps
from firebase_functions import https_fn
from dotenv import load_dotenv
from collections import defaultdict
from k_means_constrained import KMeansConstrained
from sklearn.neighbors import LocalOutlierFactor
from kmedoids import KMedoids
from pydantic import BaseModel, ValidationError
from typing import Dict, List, Tuple, Any
import json
import os
import numpy as np

load_dotenv()  # TODO: Remove once done with dev
# TODO: Make sure to add the api key in the environment vars in the firebase console


class KMeansClusterDeliveriesRequest(BaseModel):
    coords: List[Tuple[float, float]]
    drivers_count: int
    min_deliveries: int
    max_deliveries: int

class KMedoidsClusterDeliveriesRequest(BaseModel):
    coords: List[Tuple[float, float]]
    drivers_count: int


class ClusterDeliveriesResponse(BaseModel):
    clusters: Dict[str, List[int]]


class OptimalRouteRequest(BaseModel):
    coords: List[Tuple[float, float]]

# TODO: Determine what we need to return


class OptimalRouteResponse(BaseModel):
    directions: Any

class FieldError(BaseModel):
    field: str
    message: str

class ValidationErrorResponse(BaseModel):
    error: str = "Validation Error"
    details: List[FieldError]

def parse_error_fields(e: ValidationError):
    return [
        FieldError(field=".".join(map(str, error["loc"])), message=error["msg"])
        for error in e.errors()
    ]

# Returns list of batches
def chunk_coordinates(coords, chunk_size=10):
    for i in range(0, len(coords), chunk_size):
        yield coords[i:i + chunk_size]

# TODO: mock gmaps call, remove later.
def mock_google_maps_distance_matrix(origins, destinations):
    response = {
        "rows": [
            {"elements": [{"status": "OK", "duration": {
                "value": abs(d[0] + o[0])}} for d in destinations]}
            for o in origins
        ]
    }
    return response

# construct complete distance matrix from a list of coordinates
def construct_distance_matrix(coords):
    n = len(coords)

    distance_matrix = np.zeros((n, n))
    batches = list(chunk_coordinates(coords, 10))

    # Loop over each pair of origin and destination batches to fill the distance matrix
    for i, origin_batch in enumerate(batches):
        for j, destination_batch in enumerate(batches):

            # TODO: Replace with call to gmaps distance API.
            response = mock_google_maps_distance_matrix(
                origin_batch, destination_batch)
            
            # gmaps = googlemaps.Client(key=os.environ["MAPS_API_KEY"])
            # distance_matrix = gmaps.distance_matrix(
            #     origins=coords, destinations=coords, mode="driving"
            # )

            for origin_index, row in enumerate(response["rows"]):
                for destination_index, element in enumerate(row["elements"]):
                    if element["status"] == "OK":
                        global_origin_index = i * 10 + origin_index
                        global_destination_index = j * 10 + destination_index
                        distance_matrix[global_origin_index][global_destination_index] = element["duration"]["value"]

    return distance_matrix

def latlon_to_cartesian(lat, lon, radius=6371):
    x = radius * cos(lat) * cos(lon)
    y = radius * cos(lat) * sin(lon)
    z = radius * sin(lat)
    return x, y, z

# TODO: Implement Authorization if that is configured
@https_fn.on_request()
def cluster_deliveries_k_medoids(req: https_fn.Request) -> https_fn.Response:
    try:
        body = KMedoidsClusterDeliveriesRequest(**req.get_json())
    except ValidationError as e:
        errors = parse_error_fields(e)
        return https_fn.Response(
            response=json.dumps(ValidationErrorResponse(details=errors)),
            status=422,
            content_type="application/json",
        )

    coords = body.coords

    drivers_count = body.drivers_count

    # TODO: Test with actual gmap calls
    distance_matrix = construct_distance_matrix(coords)

    kmedoids = KMedoids(n_clusters=drivers_count, method="fasterpam").fit(
        distance_matrix
    )
    labels = kmedoids.labels_

    clusters = defaultdict(list)
    for index, label in enumerate(labels):
        clusters[f"cluster-{label+1}"].append(index)

    # TODO: Alter groups if we want to handle that in server side
    data = ClusterDeliveriesResponse(clusters=clusters)
    return https_fn.Response(
        response=json.dumps(data.model_dump()),
        status=201,
        content_type="application/json",
    )


# TODO: Convert to cartesian if need be
@https_fn.on_request()
def cluster_deliveries_k_means(req: https_fn.Request) -> https_fn.Response:
    try:
        body = KMeansClusterDeliveriesRequest(**req.get_json())
    except ValidationError as e:
        errors = parse_error_fields(e)
        return https_fn.Response(
            response=json.dumps(ValidationErrorResponse(details=errors)),
            status=422,
            content_type="application/json",
        )

    coords = body.coords
    coords = [latlon_to_cartesian(lat, lon) for lat, lon in coords]
    drivers_count = body.drivers_count
    min_deliveries = body.min_deliveries
    max_deliveries = body.max_deliveries

    kmeans = KMeansConstrained(
        n_clusters=drivers_count,
        size_min=min_deliveries,
        size_max=max_deliveries,
        random_state=42,
    ).fit(coords)
    labels = kmeans.labels_

    clusters = defaultdict(list)
    for index, label in enumerate(labels):
        clusters[f"cluster-{label+1}"].append(index)
    
    clusters["doordash"] = []
    for key in clusters.keys():
        cluster = clusters[key]
        if len(cluster) <= 1:
            continue
        distance_matrix = construct_distance_matrix(coords=[coords[index] for index in cluster])
        clf = LocalOutlierFactor(n_neighbors=len(cluster), metric="precomputed")
        predictions = clf.fit_predict(distance_matrix)
        outliers = [index for index, prediction in zip(cluster, predictions) if prediction == -1]
        clusters[key] = list(set(clusters[key]) - set(outliers))
        clusters["doordash"].extend(outliers)

    data = ClusterDeliveriesResponse(clusters=clusters)

    return https_fn.Response(
        response=json.dumps(data.model_dump()),
        status=201,
        content_type="application/json",
    )

@https_fn.on_request()
def calculate_optimal_cluster_route(req: https_fn.Request) -> https_fn.Response: 
    body = OptimalRouteRequest(**req.get_json())

    waypoints = [f"{lat},{lng}" for lat, lng in body.coords]

    gmaps = googlemaps.Client(key=os.environ["MAPS_API_KEY"])

    # TODO: Start and destination may be determined by the client. For now pick any waypoint and form a loop
    directions_result = gmaps.directions(
        origin=waypoints[0],
        destination=waypoints[0], 
        waypoints=waypoints[1:],  
        optimize_waypoints=True,
        mode="driving"
    )

    data = OptimalRouteResponse(directions=directions_result)

    return https_fn.Response(
        response=json.dumps(data.model_dump()),
        status=201,
        content_type="application/json",
    )
