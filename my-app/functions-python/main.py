import json

import firebase_admin
from firebase_functions import https_fn, options, scheduler_fn
from firebase_admin import auth, firestore
from typing import Optional
from clustering import (
    cluster_deliveries_k_means,
    geocode_addresses_endpoint,
)

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

CLIENTS_COLLECTION = "client-profile2"

# Initialize Firebase Admin SDK only once
try:
    firebase_admin.initialize_app()
except ValueError:
    # App already initialized, ignore the error
    pass

# --- Define CORS options needed for user-management callables ---
_user_management_cors = options.CorsOptions(
    cors_origins=[
        r"^http://localhost:\d+$", # Local development
        r"^http://127\.0\.0\.1:\d+$", # Local development by IP
        r"^https://app\.foodforalldc\.org$", # Production custom domain
        r"^https://food-for-all-dc-caf23\.web\.app$", # Firebase Hosting URL 1
        r"^https://food-for-all-dc-caf23\.firebaseapp\.com$", # Firebase Hosting URL 2
    ],
    cors_methods=["post", "options"] # Allow POST and preflight OPTIONS requests
)

# Explicitly declare each function with region configuration
geocode_fn = https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)(geocode_addresses_endpoint)
k_means_fn = https_fn.on_request(region="us-central1", memory=512, timeout_sec=300)(cluster_deliveries_k_means)

# --- Callable functions for synchronized Auth + Firestore user management ---
def _normalize_role(raw_role: Optional[str]) -> Optional[str]:
    if not isinstance(raw_role, str):
        return None
    return raw_role.strip().lower().replace("_", " ")


def _role_from_claims(claims: Optional[dict]) -> Optional[str]:
    if not isinstance(claims, dict):
        return None

    for key in ("role", "userRole", "user_type", "type"):
        normalized = _normalize_role(claims.get(key))
        if normalized:
            return normalized
    return None


def _role_from_users_doc(db, uid: str) -> Optional[str]:
    doc_snapshot = db.collection("users").document(uid).get()
    if not doc_snapshot.exists:
        return None

    user_data = doc_snapshot.to_dict() or {}
    for key in ("role", "type", "userType"):
        normalized = _normalize_role(user_data.get(key))
        if normalized:
            return normalized
    return None


def _effective_role(db, uid: str, claims: Optional[dict] = None) -> Optional[str]:
    claim_role = _role_from_claims(claims)
    if claim_role:
        return claim_role
    return _role_from_users_doc(db, uid)


def _require_user_manager(req: https_fn.CallableRequest, db) -> str:
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Authentication required.",
        )

    caller_role = _effective_role(db, req.auth.uid, getattr(req.auth, "token", None))
    if caller_role not in ("admin", "manager"):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Only Admins or Managers can manage user accounts.",
        )
    return caller_role


def _managed_role(raw_role: Optional[str]) -> Optional[str]:
    normalized = _normalize_role(raw_role)
    return {
        "admin": "Admin",
        "manager": "Manager",
        "client intake": "Client Intake",
        "clientintake": "Client Intake",
    }.get(normalized)


def _can_create_managed_role(caller_role: str, target_role: str) -> bool:
    """Keep server authorization aligned with the existing create-user form."""
    return caller_role == "admin" or (
        caller_role == "manager" and target_role != "Admin"
    )


def _validated_create_user_data(raw_data) -> dict:
    if not isinstance(raw_data, dict):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="User details are required.",
        )

    name = raw_data.get("name")
    email = raw_data.get("email")
    password = raw_data.get("password")
    phone = raw_data.get("phone", "")
    role = _managed_role(raw_data.get("role"))

    if not isinstance(name, str) or not name.strip():
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="A user name is required.",
        )
    if not isinstance(email, str) or not email.strip():
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="A user email is required.",
        )
    if not isinstance(password, str) or len(password) < 8:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Password must be at least 8 characters long.",
        )
    if not isinstance(phone, str):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Phone number must be a string.",
        )
    if role is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="A valid user role is required.",
        )

    return {
        "name": name.strip(),
        "email": email.strip().lower(),
        "password": password,
        "phone": phone.strip(),
        "role": role,
    }


def _create_user_records(db, user_data: dict, auth_client=auth) -> str:
    created_user = auth_client.create_user(
        email=user_data["email"],
        password=user_data["password"],
        display_name=user_data["name"],
    )

    try:
        db.collection("users").document(created_user.uid).set({
            "name": user_data["name"],
            "email": user_data["email"],
            "phone": user_data["phone"],
            "role": user_data["role"],
        })
    except Exception:
        try:
            auth_client.delete_user(created_user.uid)
        except Exception as rollback_error:
            print(
                "Critical: failed to roll back Firebase Auth user "
                f"{created_user.uid} after Firestore creation failed: {rollback_error}"
            )
        raise

    return created_user.uid


def _delete_user_records(db, uid: str, auth_client=auth) -> dict:
    auth_deleted = True
    try:
        auth_client.delete_user(uid)
    except auth_client.UserNotFoundError:
        auth_deleted = False

    # Firestore delete is idempotent. Always attempt it after Auth is gone so a
    # retry repairs an earlier partial deletion instead of leaving a visible row.
    db.collection("users").document(uid).delete()
    return {"authDeleted": auth_deleted, "firestoreDeleted": True}


@https_fn.on_call(region="us-central1", cors=_user_management_cors)
def createUserAccount(req: https_fn.CallableRequest):
    db = firestore.client()
    caller_role = _require_user_manager(req, db)
    user_data = _validated_create_user_data(req.data)

    if not _can_create_managed_role(caller_role, user_data["role"]):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Managers cannot create Admin accounts.",
        )

    try:
        uid = _create_user_records(db, user_data)
        return {"status": "success", "uid": uid}
    except auth.EmailAlreadyExistsError:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.ALREADY_EXISTS,
            message="An account with this email already exists.",
        )
    except ValueError as validation_error:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=str(validation_error),
        )
    except Exception as creation_error:
        print(f"User creation failed: {creation_error}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="An internal error occurred while creating the user.",
        )


@https_fn.on_call(
    region="us-central1",
    cors=_user_management_cors
)
def deleteUserAccount(req: https_fn.CallableRequest):
    """
    Deletes a user's Firebase Auth account and their Firestore document.
    Expects {'uid': 'user-uid-to-delete'} in the request data.
    """
    db = firestore.client()
    caller_role = _require_user_manager(req, db)
    caller_uid = req.auth.uid

    uid_to_delete = req.data.get('uid')
    if not uid_to_delete or not isinstance(uid_to_delete, str):
        print("Invalid input: 'uid' parameter missing or not a string.")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                                  message="Required parameter 'uid' is missing or invalid.")

    if caller_uid == uid_to_delete:
        print("Authorization failed: User attempted self-deletion.")
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                                  message="You cannot delete your own account.")

    target_role = None
    try:
        target_auth_user = auth.get_user(uid_to_delete)
        target_role = _role_from_claims(target_auth_user.custom_claims)
    except auth.UserNotFoundError:
        # The Firestore-only case is repaired by the idempotent delete below.
        pass
    except Exception as user_lookup_error:
        print(f"Unable to inspect target user {uid_to_delete}: {user_lookup_error}")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Unable to verify the target account.",
        )

    if not target_role:
        target_role = _role_from_users_doc(db, uid_to_delete)

    if caller_role == "manager" and target_role == "admin":
        print(f"Authorization failed: manager {caller_uid} attempted to delete admin {uid_to_delete}.")
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Managers cannot delete Admin accounts.",
        )

    print(f"Attempting to delete user with UID: {uid_to_delete}")
    try:
        result = _delete_user_records(db, uid_to_delete)
        return {
            "status": "success",
            "message": f"Successfully deleted user {uid_to_delete}",
            **result,
        }
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
            doc_ref = db.collection(CLIENTS_COLLECTION).document(client_id)
            doc = doc_ref.get()

            if doc.exists:
                doc_data = doc.to_dict() or {}
                deliveries = doc_data.get("deliveries") or []
                if current_date not in deliveries:
                    deliveries.append(current_date)
                    doc_ref.update({
                        "deliveries": deliveries,
                        "updatedAt": firestore.SERVER_TIMESTAMP,
                        "updatedBy": {
                            "uid": "ETL",
                            "name": "ETL",
                        },
                    })
                    updated_clients.append(client_id)
            else:
                doc_ref.set({
                    "deliveries": [current_date],
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                    "updatedBy": {
                        "uid": "ETL",
                        "name": "ETL",
                    },
                })
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
