import googlemaps
from firebase_functions import https_fn
from dotenv import load_dotenv
from k_means_constrained import KMeansConstrained
from kmedoids import KMedoids
from pydantic import BaseModel
from typing import List, Tuple
import json
import os

load_dotenv()  # TODO: Remove once done with dev
# TODO: Make sure to add the api key in the environment vars in the firebase console


class ClusterDeliveriesRequest(BaseModel):
    coords: List[Tuple[float, float]]
    drivers_count: int
    min_deliveries: int
    max_deliveries: int


class ClusterDeliveriesResponse(BaseModel):
    labels: List[int]


# TODO: Implement Authorization if that is configured
# TODO: Add rate limiting or caching since we are using google maps API
@https_fn.on_request()
def cluster_deliveries_k_medioids(req: https_fn.Request) -> https_fn.Response:
    body = ClusterDeliveriesRequest(**req.get_json())

    coords = body.coords
    drivers_count = body.drivers_count
    # TODO: Determine if we nede to enforce min and max constraints here
    min_deliveries = body.min_deliveries
    max_deliveries = body.max_deliveries

    # TODO: Fix such that it can handle for that 10 locations
    gmaps = googlemaps.Client(key=os.environ["MAPS_API_KEY"])
    distance_matrix = gmaps.distance_matrix(
        origins=coords, destinations=coords, mode="driving"
    )
    distance_matrix = [
        [element["duration"]["value"] for element in row["elements"]]
        for row in distance_matrix["rows"]
    ]

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
