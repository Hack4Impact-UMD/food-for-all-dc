"""Prune temp-referral docs with no contact info and reset clients.

Rules (as requested):

- In the temporary case worker collection "temp-referral":
  - Any document that has NEITHER a phone number NOR an email (both empty)
    should be deleted.

- In the "temp-profile2" collection:
  - For every client whose referralEntity.id matches one of the deleted
    referral IDs, update referralEntity to:

        {
            "id": "",
            "name": "",
            "organization": "None",
        }

  - That is, there should be no corresponding referral id on the client if
    the temp referral record has been deleted, and only the organization
    field should show "None" (person name empty).

This script ONLY touches:
    - Collection: "temp-referral"
    - Collection: "temp-profile2"

The original "client-profile2" and "referral" collections are NOT modified.

Run from the repo root with the venv activated:

    .\\venv\\Scripts\\python.exe ETL\\prune_temp_referrals_no_contact.py
"""

import os
import sys
import logging
import warnings
from typing import List

import firebase_admin
from firebase_admin import credentials, firestore


SERVICE_ACCOUNT_PATH = os.path.join(
    "ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
)
PROJECT_ID = "food-for-all-dc-caf23"
CLIENTS_COLLECTION = "temp-profile2"
TEMP_REFERRAL_COLLECTION = "temp-referral"


# Per-step error log configuration for this ETL phase.
_etl_root = os.path.join("ETL")
_error_log_dir = os.path.join(_etl_root, "error_logs")
os.makedirs(_error_log_dir, exist_ok=True)
_error_log_path = os.path.join(_error_log_dir, "prune-temp-referrals-errors.log")

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

# Suppress noisy Firestore positional-arguments warning from the console
warnings.filterwarnings(
    "ignore",
    category=UserWarning,
    message=r"Detected filter using positional arguments\. Prefer using the 'filter' keyword argument instead\.",
)


def _init_firestore() -> firestore.Client:
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
    return firestore.client()


def _chunk_list(values: List[str], size: int) -> List[List[str]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def _run() -> None:
    db = _init_firestore()

    referrals_ref = db.collection(TEMP_REFERRAL_COLLECTION)
    clients_ref = db.collection(CLIENTS_COLLECTION)

    print(f"📥 Loading referral (case worker) documents from '{TEMP_REFERRAL_COLLECTION}'...")
    referral_docs = list(referrals_ref.stream())
    print(f"📄 Loaded {len(referral_docs)} referral documents.\n")

    to_delete_ids: List[str] = []

    for doc in referral_docs:
        data = doc.to_dict() or {}
        email = str(data.get("email") or "").strip()
        phone = str(data.get("phone") or "").strip()

        # Mark for deletion only if BOTH email and phone are empty.
        if not email and not phone:
            to_delete_ids.append(doc.id)

    print(f"📵 Referral docs with NO phone AND NO email: {len(to_delete_ids)}")

    # Update matching clients' referralEntity first, then delete the referrals.
    updated_clients = 0

    if to_delete_ids:
        print("🧩 Updating temp-profile2.referralEntity for affected clients...")

        # Keep this phase simple: just perform updates and report a
        # summary count, relying on the deletion phase for a visual
        # progress bar.
        for id_chunk in _chunk_list(to_delete_ids, 10):  # Firestore 'in' limit is 10
            query = clients_ref.where("referralEntity.id", "in", id_chunk)
            for snap in query.stream():
                before = snap.to_dict() or {}
                ref_entity = before.get("referralEntity") or {}

                if os.getenv("ETL_VERBOSE"):
                    print(
                        "Client",
                        snap.id,
                        "had referralEntity:",
                        {
                            "id": ref_entity.get("id"),
                            "name": ref_entity.get("name"),
                            "organization": ref_entity.get("organization"),
                        },
                    )

                snap.reference.update(
                    {
                        "referralEntity": {
                            "id": "",
                            "name": "",
                            "organization": "None",
                        }
                    }
                )
                updated_clients += 1

    print(f"🧑‍🤝‍🧑 Total client documents updated: {updated_clients}")

    # Now delete the temp referral docs with no contact info.
    deleted_referrals = 0
    if to_delete_ids:
        print("🗑️ Deleting temp-referral documents with no contact info...")

        try:
            from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn
            use_progress = True
        except Exception:
            use_progress = False

        if use_progress:
            with Progress(
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TextColumn("• {task.completed}/{task.total}"),
                TimeElapsedColumn(),
                TextColumn(" | {task.fields[current_label]}"),
            ) as progress:
                task = progress.add_task(
                    "Deleting referrals",
                    total=len(to_delete_ids),
                    current_label="Starting...",
                )
                for ref_id in to_delete_ids:
                    referrals_ref.document(ref_id).delete()
                    deleted_referrals += 1
                    progress.update(
                        task,
                        advance=1,
                        current_label=f"Deleted referral {ref_id}",
                    )
        else:
            for ref_id in to_delete_ids:
                referrals_ref.document(ref_id).delete()
                deleted_referrals += 1

    print(f"🗑️ Total referral documents deleted from '{TEMP_REFERRAL_COLLECTION}': {deleted_referrals}")


def main() -> None:
    """Entry point with error logging to a per-step log file.

    Any unhandled exception during this pruning phase will be logged to
    ETL/error_logs/prune-temp-referrals-errors.log before being re-raised.
    """

    logger.info("Starting prune_temp_referrals_no_contact ETL step.")
    try:
        _run()
        logger.info("Completed prune_temp_referrals_no_contact ETL step.")
    except Exception:
        logger.exception("Unhandled error during prune_temp_referrals_no_contact ETL step.")
        # Re-raise so callers (e.g., the full pipeline runner) can fail fast.
        raise
    finally:
        try:
            # Always tell the operator where this step's log file lives,
            # even if it ends up empty.
            print(
                "ℹ️ If this step logged any warnings/errors, "
                f"they will be in {_error_log_path}."
            )
        except Exception:
            # Avoid crashing the script if log inspection fails.
            logger.debug("Unable to inspect prune-temp-referrals error log.")


if __name__ == "__main__":
    main()
