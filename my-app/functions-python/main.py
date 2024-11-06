import googlemaps
from firebase_functions import https_fn
from dotenv import load_dotenv
from k_means_constrained import KMeansConstrained
from kmedoids import KMedoids
from pydantic import BaseModel
from typing import List, Tuple, Any
import json
import os
import numpy as np

load_dotenv()  # TODO: Remove once done with dev
# TODO: Make sure to add the api key in the environment vars in the firebase console


class ClusterDeliveriesRequest(BaseModel):
    coords: List[Tuple[float, float]]
    drivers_count: int
    min_deliveries: int
    max_deliveries: int


class ClusterDeliveriesResponse(BaseModel):
    labels: List[int]


class OptimalRouteRequest(BaseModel):
    coords: List[Tuple[float, float]]

# TODO: Determine what we need to return


class OptimalRouteResponse(BaseModel):
    directions: Any


# TODO: Implement Authorization if that is configured
# TODO: Add rate limiting or caching since we are using google maps API
@https_fn.on_request()
def cluster_deliveries_k_medioids(req: https_fn.Request) -> https_fn.Response:
    body = ClusterDeliveriesRequest(**req.get_json())

    coords = body.coords

    # Returns list of batches
    def chunk_coordinates(coords, chunk_size=10):
        for i in range(0, len(coords), chunk_size):
            yield coords[i:i + chunk_size]

    # TODO: mock gmaps call, remove later.
    def mock_google_maps_distance_matrix(origins, destinations):
        response = {
            "rows": [
                {"elements": [{"status": "OK", "duration": {
                    "value": d + o}} for d in destinations]}
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

    drivers_count = body.drivers_count
    # TODO: Determine if we nede to enforce min and max constraints here
    min_deliveries = body.min_deliveries
    max_deliveries = body.max_deliveries

    # TODO: Test with actual gmap calls
    distance_matrix = construct_distance_matrix(coords)

    kmedoids = KMedoids(n_clusters=drivers_count, method="fasterpam").fit(
        distance_matrix
    )
    labels = kmedoids.labels_

    # TODO: Alter groups if we want to handle that in server side
    data = ClusterDeliveriesResponse(labels=labels)
    return https_fn.Response(
        response=json.dumps(data.model_dump()),
        status=201,
        content_type="application/json",
    )


# TODO: Convert to cartesian if need be
@https_fn.on_request()
def cluster_deliveries_k_means(req: https_fn.Request) -> https_fn.Response:
    body = ClusterDeliveriesRequest(**req.get_json())

    coords = body.coords
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

    data = ClusterDeliveriesResponse(labels=labels)

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
