from firebase_functions import https_fn
from clustering import (
    cluster_deliveries_k_medoids,
    cluster_deliveries_k_means,
    calculate_optimal_cluster_route,
    geocode_addresses_endpoint
)

# Explicitly declare each function with region configuration
geocode_fn = https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)(geocode_addresses_endpoint)
k_medoids_fn = https_fn.on_request(region="us-central1")(cluster_deliveries_k_medoids)
k_means_fn = https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)(cluster_deliveries_k_means)
optimal_route_fn = https_fn.on_request(region="us-central1")(calculate_optimal_cluster_route)