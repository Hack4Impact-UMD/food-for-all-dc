"""Promote sandbox client/referral data into production collections.

This script copies all documents from the sandbox collections

    - temp-profile2  (clients)
    - temp-referral  (case workers)

into the production collections

    - client-profile2
    - referral

using the same document IDs, then optionally deletes the sandbox
collections' documents.

**WARNING: DESTRUCTIVE OPERATION**

- All existing documents in `client-profile2` and `referral` will be
  deleted before the sandbox data is copied in.
- Run this ONLY after you have thoroughly validated the data in
  `temp-profile2` and `temp-referral`.
- Consider creating an external backup (e.g., Firestore export) of the
  current production collections before running this.

Run from the repo root with the venv activated:

    .\\venv\\Scripts\\python.exe ETL\\promote_temp_clients_and_referrals.py
"""

import os
import logging

import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import credentials, firestore


SERVICE_ACCOUNT_PATH = os.path.join(
    "ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
)
PROJECT_ID = "food-for-all-dc-caf23"

PROD_CLIENTS_COLLECTION = "client-profile2"
PROD_REFERRAL_COLLECTION = "referral"
TEMP_CLIENTS_COLLECTION = "temp-profile2"
TEMP_REFERRAL_COLLECTION = "temp-referral"


# Per-step error log configuration for this ETL phase.
_etl_root = os.path.join("ETL")
_error_log_dir = os.path.join(_etl_root, "error_logs")
os.makedirs(_error_log_dir, exist_ok=True)
_error_log_path = os.path.join(_error_log_dir, "promote-temp-clients-and-referrals-errors.log")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_has_step_handler = any(
    isinstance(h, logging.FileHandler)
    and getattr(h, "_ffa_error_log_path", None) == _error_log_path
    for h in logger.handlers
)

if not _has_step_handler:
    _step_handler = logging.FileHandler(_error_log_path, mode="w", encoding="utf-8")
    _step_handler.setLevel(logging.WARNING)
    _step_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    _step_handler._ffa_error_log_path = _error_log_path  # type: ignore[attr-defined]
    logger.addHandler(_step_handler)


def _init_firestore() -> firestore.Client:
    """Initialize Firebase Admin SDK and return a Firestore client."""

    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})

    return firestore.client()


def _delete_all_docs(db: firestore.Client, collection_name: str) -> int:
    """Delete all documents from the given collection.

    Returns the number of documents deleted.
    """

    col_ref = db.collection(collection_name)
    snaps = list(col_ref.stream())
    deleted = 0

    print(f"🗑️ Deleting {len(snaps)} docs from '{collection_name}'...")

    # Use a Rich progress bar when available for a clean, per-doc status.
    try:
        from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn
        use_progress = True
    except Exception:
        use_progress = False

    if use_progress and snaps:
        with Progress(
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TextColumn("• {task.completed}/{task.total}"),
            TimeElapsedColumn(),
            TextColumn(" | {task.fields[current_label]}"),
        ) as progress:
            task = progress.add_task(
                f"Deleting {collection_name}",
                total=len(snaps),
                current_label="Starting...",
            )
            for snap in snaps:
                label = snap.id
                snap.reference.delete()
                deleted += 1
                progress.update(
                    task,
                    advance=1,
                    current_label=f"Deleted: {label}",
                )
    else:
        for snap in snaps:
            snap.reference.delete()
            deleted += 1

    print(f"🗑️ Deleted {deleted} docs from '{collection_name}'.")
    return deleted


def _copy_collection(
    db: firestore.Client, source_collection: str, target_collection: str
) -> int:
    """Copy all documents from source_collection into target_collection.

    Documents are written with the same document IDs.
    Returns the number of documents written.
    """

    source_ref = db.collection(source_collection)
    target_ref = db.collection(target_collection)

    snaps = list(source_ref.stream())
    print(
        f"📤 Copying {len(snaps)} docs from '{source_collection}' to "
        f"'{target_collection}'..."
    )

    # Use a Rich progress bar when available for a clean, per-doc status.
    try:
        from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn
        use_progress = True
    except Exception:
        use_progress = False

    written = 0
    if use_progress and snaps:
        with Progress(
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TextColumn("• {task.completed}/{task.total}"),
            TimeElapsedColumn(),
            TextColumn(" | {task.fields[current_label]}"),
        ) as progress:
            task = progress.add_task(
                f"Copying {source_collection}",
                total=len(snaps),
                current_label="Starting...",
            )
            for snap in snaps:
                data = snap.to_dict() or {}
                target_ref.document(snap.id).set(data)
                written += 1
                label = snap.id
                progress.update(
                    task,
                    advance=1,
                    current_label=f"Copied: {label}",
                )
    else:
        for snap in snaps:
            data = snap.to_dict() or {}
            target_ref.document(snap.id).set(data)
            written += 1

    print(
        f"✅ Copied {written} docs from '{source_collection}' into "
        f"'{target_collection}'."
    )
    return written


def _run() -> None:
    db = _init_firestore()

    # Show counts for sandbox collections so the operator has context.
    temp_clients_count = len(list(db.collection(TEMP_CLIENTS_COLLECTION).stream()))
    temp_referrals_count = len(list(db.collection(TEMP_REFERRAL_COLLECTION).stream()))

    print("📊 Sandbox collection sizes before promotion:")
    print(f"  📁 {TEMP_CLIENTS_COLLECTION}:  {temp_clients_count} docs")
    print(f"  📁 {TEMP_REFERRAL_COLLECTION}: {temp_referrals_count} docs")
    print()

    # 1. Delete existing production docs.
    print("🧹 Step 1/3: Delete existing production docs (client-profile2, referral)...")
    _delete_all_docs(db, PROD_CLIENTS_COLLECTION)
    _delete_all_docs(db, PROD_REFERRAL_COLLECTION)
    print()

    # 2. Copy sandbox docs into production collections using the same IDs.
    print("🔁 Step 2/3: Copy sandbox docs into production collections...")
    _copy_collection(db, TEMP_CLIENTS_COLLECTION, PROD_CLIENTS_COLLECTION)
    _copy_collection(db, TEMP_REFERRAL_COLLECTION, PROD_REFERRAL_COLLECTION)
    print()

    # 3. Optionally, clear sandbox collections so there is no confusion
    # between old and new.
    print("🧹 Step 3/3: Delete sandbox docs from temp-profile2 and temp-referral...")
    _delete_all_docs(db, TEMP_CLIENTS_COLLECTION)
    _delete_all_docs(db, TEMP_REFERRAL_COLLECTION)

    print("🎉 Promotion completed.")


def main() -> None:
    """Entry point with error logging to a per-step log file.

    Any unhandled exception during this promotion phase will be logged to
    ETL/error_logs/promote-temp-clients-and-referrals-errors.log before
    being re-raised.
    """

    logger.info("Starting promote_temp_clients_and_referrals ETL step.")
    try:
        _run()
        logger.info("Completed promote_temp_clients_and_referrals ETL step.")
    except Exception:
        logger.exception("Unhandled error during promote_temp_clients_and_referrals ETL step.")
        raise
    finally:
        try:
            if os.path.exists(_error_log_path) and os.path.getsize(_error_log_path) > 0:
                print(f"⚠️ Detailed warnings/errors for this step were written to {_error_log_path}.")
        except Exception:
            logger.debug("Unable to inspect promote-temp-clients-and-referrals error log.")


if __name__ == "__main__":
    main()
