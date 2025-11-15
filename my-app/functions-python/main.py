import json
import firebase_admin
from firebase_functions import https_fn, options, scheduler_fn
from firebase_admin import auth, firestore
from clustering import (
    cluster_deliveries_k_means,
    geocode_addresses_endpoint,
)

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

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
k_means_fn = https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)(cluster_deliveries_k_means)

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
    if req.auth is None:
        print("Authentication failed: No auth context found.")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
                                  message="Authentication required.")

    caller_uid = req.auth.uid

    # TODO: Add role-based authorization check (Admin/Manager only)
    # Currently allows any authenticated user to delete users

    uid_to_delete = req.data.get('uid')
    if not uid_to_delete or not isinstance(uid_to_delete, str):
        print("Invalid input: 'uid' parameter missing or not a string.")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                                  message="Required parameter 'uid' is missing or invalid.")

    if caller_uid == uid_to_delete:
            print("Authorization failed: User attempted self-deletion.")
            raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                                    message="You cannot delete your own account.")

    print(f"Attempting to delete user with UID: {uid_to_delete}")
    db = firestore.client()

    try:
        auth.delete_user(uid_to_delete)
        print(f"Successfully deleted Firebase Auth user: {uid_to_delete}")

        try:
            user_doc_ref = db.collection('users').document(uid_to_delete)
            user_doc_ref.delete()
            print(f"Successfully deleted Firestore document for user: {uid_to_delete}")
        except Exception as fs_error:
            # Log Firestore deletion error but proceed as Auth deletion succeeded
            print(f"Warning: Failed to delete Firestore document for user {uid_to_delete}: {fs_error}")

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

def query_today_client_ids(tz_name: str = "America/New_York"):
    """Return clientIds for events whose deliveryDate is ‘today’ in the given timezone."""
    tz = ZoneInfo(tz_name)
    now_ny = datetime.now(tz)
    db = firestore.client()

    start_of_day_ny = datetime(
        year=now_ny.year, month=now_ny.month, day=now_ny.day,
        hour=0, minute=0, second=0, tzinfo=tz
    )
    start_of_next_day_ny = start_of_day_ny + timedelta(days=1)

    # Convert to UTC datetimes for Firestore timestamp comparisons
    start_utc = start_of_day_ny.astimezone(ZoneInfo("UTC"))
    end_utc = start_of_next_day_ny.astimezone(ZoneInfo("UTC"))

    q = (
        db.collection("events")
          .where(filter=firestore.FieldFilter("deliveryDate", ">=", start_utc))
          .where(filter=firestore.FieldFilter("deliveryDate", "<", end_utc))
    )

    client_ids = []
    event_count = 0
    for doc in q.stream():
        event_count += 1
        data = doc.to_dict() or {}
        cid = data.get("clientId")
        if cid:
            client_ids.append(cid)

    return {
        "success": True,
        "delivery_date": str(start_of_day_ny.date()),
        "event_count": event_count,
        "client_ids": client_ids,
        "unique_client_count": len(set(client_ids))
    }

def run_update(tz_name: str = "America/New_York") -> dict:
    """
    Core logic (no HTTP, no CORS). Returns a summary dict.
    """
    db = firestore.client()

    ny_tz = ZoneInfo(tz_name)
    current_date = datetime.now(ny_tz).strftime("%Y-%m-%d")

    result = query_today_client_ids(tz_name)
    updated_clients = []

    for client_id in result.get("client_ids", []):
        try:
            doc_ref = db.collection("clients").document(client_id)
            doc = doc_ref.get()

            if doc.exists:
                doc_data = doc.to_dict() or {}
                deliveries = doc_data.get("deliveries") or []
                if current_date not in deliveries:
                    deliveries.append(current_date)
                    doc_ref.update({"deliveries": deliveries})
                    updated_clients.append(client_id)
            else:
                doc_ref.set({"deliveries": [current_date]})
                updated_clients.append(client_id)

        except Exception as client_error:
            print(f"Error processing client {client_id}: {client_error}")
            continue

    summary = {
        "success": True,
        "date": current_date,
        "total_clients": len(result.get("client_ids", [])),
        "updated_clients": updated_clients,
        "updated_count": len(updated_clients),
    }
    print(f"updateDeliveries summary: {json.dumps(summary)}")
    return summary


@scheduler_fn.on_schedule(
    # Cron: minute hour day-of-month month day-of-week
    # This runs at 10:00 every day in America/New_York.
    schedule="every day 10:00",
    region="us-central1",
    memory=512,
    timeout_sec=300,
)
def updateDeliveriesDaily(event: scheduler_fn.ScheduledEvent) -> None:
    """
    Cron job to run every morning. No HTTP, no return value needed.
    """
    try:
        print("UPDATING USER DELIVERIES")
        run_update("America/New_York")
    except Exception as e:
        # Log the failure so it shows in Cloud Logging / Error Reporting
        print(f"updateDeliveriesDaily error: {e}")
        # Let it raise to mark the execution as failed (so retries/alerts can happen if configured)
        raise
