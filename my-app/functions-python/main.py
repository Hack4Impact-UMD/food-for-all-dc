import firebase_admin
from firebase_functions import https_fn, options
from firebase_admin import auth, firestore
from clustering import (
    cluster_deliveries_k_medoids,
    cluster_deliveries_k_means,
    calculate_optimal_cluster_route,
    geocode_addresses_endpoint
)

# Initialize Firebase Admin SDK only once
try:
    firebase_admin.initialize_app()
except ValueError:
    # App already initialized, ignore the error
    pass

# --- Define CORS options needed for deleteUserAccount ---
_delete_user_cors = options.CorsOptions(
    cors_origins=[
        r"http://localhost:3000", # Local development
        r"https://food-for-all-dc-caf23.web.app", # Firebase Hosting URL 1
        r"https://food-for-all-dc-caf23.firebaseapp.com", # Firebase Hosting URL 2
    ],
    cors_methods=["post", "options"] # Allow POST and preflight OPTIONS requests
)

# Explicitly declare each function with region configuration
geocode_fn = https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)(geocode_addresses_endpoint)
k_medoids_fn = https_fn.on_request(region="us-central1")(cluster_deliveries_k_medoids)
k_means_fn = https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)(cluster_deliveries_k_means)
optimal_route_fn = https_fn.on_request(region="us-central1")(calculate_optimal_cluster_route)

# --- New Callable Function for User Deletion ---
@https_fn.on_call(
    region="us-central1",
    cors=_delete_user_cors  # Apply specific CORS settings here
)
def deleteUserAccount(req: https_fn.CallableRequest):
    """
    Deletes a user's Firebase Auth account and their Firestore document.
    Expects {'uid': 'user-uid-to-delete'} in the request data.
    """
    # 1. Authentication/Authorization Check
    if req.auth is None:
        print("Authentication failed: No auth context found.")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                                  message="Authentication required.")

    caller_uid = req.auth.uid

    # 2. Input Validation
    uid_to_delete = req.data.get('uid')
    if not uid_to_delete or not isinstance(uid_to_delete, str):
        print("Invalid input: 'uid' parameter missing or not a string.")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                                  message="Required parameter 'uid' is missing or invalid.")

    # Prevent self-deletion
    if caller_uid == uid_to_delete:
            print("Authorization failed: User attempted self-deletion.")
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                                    message="You cannot delete your own account.")


    print(f"Attempting to delete user with UID: {uid_to_delete}")
    db = firestore.client()

    try:
        # 3. Delete Firebase Authentication User
        auth.delete_user(uid_to_delete)
        print(f"Successfully deleted Firebase Auth user: {uid_to_delete}")

        # 4. Delete Firestore User Document (Best effort after Auth deletion)
        try:
            user_doc_ref = db.collection('users').document(uid_to_delete)
            user_doc_ref.delete()
            print(f"Successfully deleted Firestore document for user: {uid_to_delete}")
        except Exception as fs_error:
            # Log Firestore deletion error but proceed as Auth deletion succeeded
            print(f"Warning: Failed to delete Firestore document for user {uid_to_delete}: {fs_error}")

        # 5. Return Success
        return {"status": "success", "message": f"Successfully deleted user {uid_to_delete}"}

    except auth.UserNotFoundError:
        print(f"Deletion failed: User not found in Firebase Auth: {uid_to_delete}")
        # Treat as 'Not Found' error
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.NOT_FOUND,
                                    message=f"User with UID {uid_to_delete} not found.")
    except Exception as e:
        print(f"An unexpected error occurred during deletion of user {uid_to_delete}: {e}")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INTERNAL,
                                    message="An internal error occurred while deleting the user.")