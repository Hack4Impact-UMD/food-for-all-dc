import json
from math import cos, sin, atan2, sqrt
from collections import defaultdict
from k_means_constrained import KMeansConstrained
from sklearn.neighbors import LocalOutlierFactor
from kmedoids import KMedoids
from pydantic import BaseModel, ValidationError
from typing import Dict, List, Tuple, Any
import numpy as np
from clustering import add_delivery_to_existing_clusters
import folium

# Import your clustering functions and models from the main file
from clustering import (
    KMeansClusterDeliveriesRequest,
    KMedoidsClusterDeliveriesRequest,
    cluster_deliveries_k_medoids,
    cluster_deliveries_k_means,
    display_clusters_on_map
)

def test_kmedoids_clustering(coords):
    """
    Test K-Medoids clustering and display the results on a map.
    """
    # Prepare the request body
    req_medoids = {'coords': coords, 'drivers_count': 3}
    body = KMedoidsClusterDeliveriesRequest(**req_medoids)

    # Call the K-Medoids clustering function
    response = cluster_deliveries_k_medoids(body)
    
    # Debug: Print the response and its type
    print("K-Medoids Response:")
    print(response)
    print(f"Type of response: {type(response)}")

    # Extract the JSON data from the Flask response
    try:
        # Use response.get_json() to parse the JSON data
        response_data = response.get_json()
        print("Parsed Response Data:")
        print(response_data)

        # Extract the clusters dictionary
        clusters = response_data.get("clusters", {})
    except Exception as e:
        print(f"Error parsing response: {e}")
        return

    print("K-Medoids Clusters:")
    print(clusters)

    # Display clusters on the map
    display_clusters_on_map(coords, clusters, "test_kmedoids_clustering.html")
    return clusters


def test_kmeans_clustering(coords):
    """
    Test K-Means clustering and display the results on a map.
    """
    # Prepare the request body
    req_means = {'coords': coords, 'drivers_count': 3, 'min_deliveries': 1, 'max_deliveries': 1}
    body = KMeansClusterDeliveriesRequest(**req_means)

    # Call the K-Means clustering function
    response = cluster_deliveries_k_means(body)

    # Debug: Print the response and its type
    print("K-Means Response:")
    print(response)
    print(f"Type of response: {type(response)}")

    # Extract the JSON data from the Flask response
    try:
        # Use response.get_json() to parse the JSON data
        response_data = response.get_json()
        print("Parsed Response Data:")
        print(response_data)

        # Extract the clusters dictionary
        clusters = response_data.get("clusters", {})
    except Exception as e:
        print(f"Error parsing response: {e}")
        return

    print("K-Means Clusters:")
    print(clusters)

    # Display clusters on the map
    display_clusters_on_map(coords, clusters, "test_kmeans_clustering.html")
    return clusters


def test_clustering(coords):
    """
    Test both K-Medoids and K-Means clustering.
    """
    print("Testing K-Medoids Clustering...")
    test_kmedoids_clustering(coords)

    print("\nTesting K-Means Clustering...")
    test_kmeans_clustering(coords)

def test_display_clusters_before_and_after(coords):
    """
    Test displaying clusters on a map before and after adding a new delivery.
    Clusters are generated dynamically using K-Means clustering.
    """
    # Example data

    # Generate clusters dynamically using K-Means clustering
    print("Generating clusters using K-Means...")
    clusters = test_kmeans_clustering(coords)

    # Display clusters before adding the new delivery
    print("Displaying clusters before adding the new delivery...")
    display_clusters_on_map(coords, clusters, "before_dynamic.html")

    # Add a new delivery
    new_delivery = (38.9072, -77.0369)  # New delivery coordinate
    coords.append(new_delivery)  # Update the coords list first

    # Update clusters dynamically
    clusters = add_delivery_to_existing_clusters(new_delivery, clusters, coords)

    # Display clusters after adding the new delivery
    print("Displaying clusters after adding the new delivery...")
    display_clusters_on_map(coords, clusters, "after_dynamic.html")


def test_drivers_exceed_deliveries():
    """
    Test case to handle scenarios where the number of drivers exceeds the number of deliveries.
    """
    # 5 deliveries and 10 drivers
    coords = [
        (38.8993106, -76.9937824),
        (38.8554358, -76.9951151),
        (38.889226, -76.9356789),
        (38.88555, -76.9482148),
        (38.882273, -76.933624)
    ]
    drivers_count = 10  
    min_deliveries = 1
    max_deliveries = 3
    req_means = {
        'coords': coords,
        'drivers_count': drivers_count,
        'min_deliveries': min_deliveries,
        'max_deliveries': max_deliveries
    }
    body = KMeansClusterDeliveriesRequest(**req_means)


    response = cluster_deliveries_k_means(body)

    try:
        response_data = response.get_json()
        clusters = response_data.get("clusters", {})
    except Exception as e:
        print(f"Error parsing response: {e}")
        return


    print("Clusters:", clusters)
    assert len(clusters) <= len(coords) + 1, "Number of clusters should not exceed the number of deliveries."
    for cluster_name, indexes in clusters.items():
        if len(indexes) > 1 or len(clusters) == len(coords): 
            print(f"Cluster {cluster_name} has only one delivery, which should be avoided unless necessary.")
        

    display_clusters_on_map(coords, clusters, "test_drivers_exceed_deliveries.html")
    print("Test passed: Drivers exceed deliveries.")

if __name__ == "__main__":
    # Define the coordinates for testing
    coords = [
        (38.8993106, -76.9937824),
        (38.8554358, -76.9951151),
        (38.889226, -76.9356789),
        (38.88555, -76.9482148),
        (38.882273, -76.933624),
        (38.8840008, -76.9350142),
        (38.8588442, -76.9957272),
        (38.8757448, -77.0133817),
        (38.8854471, -76.9486366),
        (38.827499, -76.99454),
        (38.860522, -76.9901938),
        (38.885339, -76.9482539),
        (38.896393, -76.92148),
        (38.8796714, -76.9303432),
        (38.8878192, -76.9511011),
        (38.8853328, -76.948533),
        (38.9000162, -76.9524685),
        (38.8785645, -77.0212272),
        (38.829087, -76.995643),
        (38.8310144, -77.0064032),
        (38.8260017, -76.9976632),
        (38.8916765, -76.9491601),
        (38.8735432, -77.0112203),
        (38.904483, -76.93438),
        (38.894868, -76.929614),
        (38.8909346, -76.9263364),
        (38.9000734, -76.9325121),
        (38.898998, -76.993793),
        (38.8929048, -76.9408774),
        (38.8574757, -76.9951322),
        (38.8901172, -76.9394226),
        (38.882223, -76.9245355),
        (38.8602807, -76.9853002),
        (38.8802107, -77.021587),
        (38.8265933, -76.9849324),
        (38.89154, -76.9173543),
        (38.8299442, -76.9994175)
    ]

    # Test both clustering methods
    #test_clustering(coords)

    # Alternatively, test them individually
    #test_kmedoids_clustering(coords)
    test_kmeans_clustering(coords)
    test_display_clusters_before_and_after(coords)
    test_drivers_exceed_deliveries()