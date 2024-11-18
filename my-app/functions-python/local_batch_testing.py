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


def test(coords):
    def chunk_coordinates(coords, chunk_size=10):
        for i in range(0, len(coords), chunk_size):
            yield coords[i:i + chunk_size]

    # Create a mock Google Maps Distance Matrix with non-uniform distances. We assign clusters linearly, 
    # but reassign distances based on cluster calculation to simulate low inter cluster dist and high intra cluster distance
    def mock_google_maps_distance_matrix(origins, destinations):
        n = len(coords)
        num_clusters = 15
        cluster_size = n // num_clusters

        response = {
            "rows": []
        }

        for o in origins:
            row = {"elements": []}
            for d in destinations:
                o_cluster = o // cluster_size
                d_cluster = d // cluster_size

                if o_cluster == d_cluster:
                    distance_value = np.random.randint(1, 10)
                else:
                    distance_value = np.random.randint(50, 100)

                row["elements"].append({
                    "status": "OK",
                    "duration": {"value": distance_value}
                })
            response["rows"].append(row)

        return response

    # construct complete distance matrix from a list of coordinates
    def construct_distance_matrix(coords):
        n = len(coords)

        distance_matrix = np.zeros((n, n))
        batches = list(chunk_coordinates(coords, 10))

        # Loop over each pair of origin and destination batches to fill the distance matrix
        for i, origin_batch in enumerate(batches):
            for j, destination_batch in enumerate(batches):
                response = mock_google_maps_distance_matrix(
                    origin_batch, destination_batch)
                for origin_index, row in enumerate(response["rows"]):
                    for destination_index, element in enumerate(row["elements"]):
                        if element["status"] == "OK":
                            global_origin_index = i * 10 + origin_index
                            global_destination_index = j * 10 + destination_index
                            distance_matrix[global_origin_index][global_destination_index] = element["duration"]["value"]
        return distance_matrix

    drivers_count = 15
    min_deliveries = 3
    max_deliveries = 10

    distance_matrix = construct_distance_matrix(coords)

    print(distance_matrix)

    # metric is the distance itself
    kmedoids = KMedoids(n_clusters=drivers_count, metric="precomputed", method="fasterpam").fit(
        distance_matrix
    )
    labels = kmedoids.labels_
    print(labels)


coords = [i for i in range(300)]
test(coords)
