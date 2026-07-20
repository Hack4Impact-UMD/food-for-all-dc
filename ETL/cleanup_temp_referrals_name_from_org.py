"""Cleanup script for temp-referral: pull person name out of organization.

This script makes *targeted* edits to the sandbox case worker collection
"temp-referral" only. It looks for documents where:

    - "name" is empty or missing, and
    - "organization" looks like it contains a leading person name followed by
        the organization text. Examples:

            "Donika Hardy SOME ( So Others Might Eat)"
            "caseworker Jennifer Djanison Kinara Mental Health Services"
            "Person Name, Organization Name"

When that pattern is detected, it will:

    - Move the detected "Person Name" portion into the "name" field.
    - Leave the remainder (the likely organization text) in the
        "organization" field.

Production collections (e.g. "referral", "client-profile2") are not touched.

Run from the repo root with the venv activated:

    .\\venv\\Scripts\\python.exe ETL\\cleanup_temp_referrals_name_from_org.py
"""

import os
import logging
from typing import List

import firebase_admin
from firebase_admin import credentials, firestore


SERVICE_ACCOUNT_PATH = os.path.join(
    "ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
)
PROJECT_ID = "food-for-all-dc-caf23"
TEMP_REFERRAL_COLLECTION = "temp-referral"


# Per-step error log configuration for this ETL phase.
_etl_root = os.path.join("ETL")
_error_log_dir = os.path.join(_etl_root, "error_logs")
os.makedirs(_error_log_dir, exist_ok=True)
_error_log_path = os.path.join(_error_log_dir, "cleanup-temp-referrals-errors.log")

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


ORG_KEYWORDS: List[str] = [
    "hospital",
    "clinic",
    "center",
    "centre",
    "university",
    "school",
    "health",
    "healthcare",
    "services",
    "service",
    "solutions",
    "resources",
    "inc",
    "llc",
    "corp",
    "company",
    "department",
    "office",
    "coalition",
    "mission",
    "cancer",
    "housing",
    "ministry",
    "church",
    "foundation",
    "program",
    "behavioral",
    "mental",
    "collaborative",
    "network",
    "some",
]


def _init_firestore() -> firestore.Client:
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
    return firestore.client()


def _is_org_like(value: str) -> bool:
    v = (value or "").strip().lower()
    if not v:
        return False
    return any(k in v for k in ORG_KEYWORDS)


def _looks_person_like(value: str) -> bool:
    v = (value or "").strip()
    if not v:
        return False

    # Very short or numeric-only fragments are unlikely to be names.
    if len(v) < 3:
        return False
    if v.replace(" ", "").isdigit():
        return False

    # Require at least one space (first + last, or similar).
    if " " not in v:
        return False

    # If it contains obvious org keywords, treat as not person-like.
    if _is_org_like(v):
        return False

    return True


def _looks_two_word_person_name(value: str) -> bool:
    """Heuristic: value is exactly two capitalized words that don't look org-like.

    Example match: "Debra Burton".
    Example non-match: "Food and" (second word not capitalized) or
    "Mary Center" (second word contains org keyword "center").
    """

    tokens = (value or "").strip().split()
    if len(tokens) != 2:
        return False

    first, last = tokens
    if not (first and last):
        return False

    # Both start with uppercase letters.
    if not (first[0].isalpha() and first[0].isupper()):
        return False
    if not (last[0].isalpha() and last[0].isupper()):
        return False

    # Last name shouldn't look like an org keyword (e.g., "Center").
    if _is_org_like(last):
        return False

    return True


def _is_mostly_numeric(value: str) -> bool:
    """Return True if the value is effectively just numbers/punctuation.

    Used to detect cases like a numeric-only name or organization that
    should not be treated as meaningful text.
    """

    v = (value or "").strip()
    if not v:
        return False

    digits_and_punct = "-() +"
    stripped = "".join(ch for ch in v if ch not in digits_and_punct)
    if not stripped:
        return True
    return stripped.isdigit()


def _run() -> None:
    db = _init_firestore()
    col_ref = db.collection(TEMP_REFERRAL_COLLECTION)

    print(f"📥 Loading documents from '{TEMP_REFERRAL_COLLECTION}'...")
    docs = list(col_ref.stream())
    print(f"📄 Loaded {len(docs)} documents.\n")

    # Optional Rich progress bar so the console shows a clean
    # per-referral status line rather than lots of JSON-style output.
    try:
        from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn
        use_progress = True
    except Exception:
        use_progress = False

    progress = None
    task = None
    if use_progress and docs:
        progress = Progress(
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TextColumn("• {task.completed}/{task.total}"),
            TimeElapsedColumn(),
            TextColumn(" | {task.fields[current_label]}"),
        )
        task = progress.add_task(
            "Cleaning referrals",
            total=len(docs),
            current_label="Starting...",
        )
        progress.__enter__()

    updated = 0

    for snap in docs:
        # Update the progress bar first for this document (if enabled).
        if progress is not None and task is not None:
            data_preview = snap.to_dict() or {}
            label_name = str(data_preview.get("name") or "").strip()
            label_org = str(data_preview.get("organization") or "").strip()
            label = label_name or label_org or snap.id
            progress.update(
                task,
                advance=1,
                current_label=f"Checking: {label}",
            )

        data = snap.to_dict() or {}
        name = str(data.get("name") or "").strip()
        org = str(data.get("organization") or "").strip()

        before_name = name
        before_org = org

        # ------------------------------------------------------------------
        # Manual, high-confidence fixes for a few known messy patterns.
        # These are very specific to the examples we've inspected.
        # ------------------------------------------------------------------
        combined_lower = f"{name} {org}".lower()

        # Monica Davalos Children’s National Shaw Metro
        if "monica davalos" in combined_lower and "children" in combined_lower:
            new_name = "Monica Davalos"
            new_org = "Children's National Shaw Metro"
        # caseworker Jennifer Djanison Kinara Mental Health Services
        elif "jennifer djanison" in combined_lower and "kinara" in combined_lower:
            new_name = "Jennifer Djanison"
            new_org = "Kinara Mental Health Services"
        # Donika Hardy SOME ( So Others Might Eat)
        elif "donika hardy" in combined_lower:
            new_name = "Donika Hardy"
            new_org = "SOME ( So Others Might Eat)"
        # Obirapu Respurce Solution- Ms. Joyce Obirapu 6
        elif "obirapu respurce" in combined_lower or "obirapu resource" in combined_lower:
            new_name = "Ms. Joyce Obirapu"
            new_org = "Obirapu Respurce Solution"
        # George Takam Priority Health
        elif "george takam" in combined_lower and "health" in combined_lower:
            new_name = "George Takam"
            new_org = "Priority Health"
        # Adeline Benovil Children's National
        elif "adeline benovil" in combined_lower and "children" in combined_lower:
            new_name = "Adeline Benovil"
            new_org = "Children's National"
        # Lindsey-United Family Assistance
        elif "lindsey-united family assistance" in combined_lower:
            new_name = "Lindsey"
            new_org = "United Family Assistance"
        # Ashwaq Hussein Friendship Place
        elif "ashwaq hussein friendship place" in combined_lower:
            new_name = "Ashwaq Hussein"
            new_org = "Friendship Place"
        # Angela Liddie Medstar Family Choice
        elif "angela liddie medstar family choice" in combined_lower:
            new_name = "Angela Liddie"
            new_org = "Medstar Family Choice"
        # Barbara Jordan N Street Village/Erna’s House
        elif "barbara jordan n street village/erna" in combined_lower:
            new_name = "Barbara Jordan"
            new_org = "N Street Village/Erna's House"
        # Julia Elliott Optum Care Service
        elif "julia elliott optum care service" in combined_lower:
            new_name = "Julia Elliott"
            new_org = "Optum Care Service"
        # Masazew Mba Preventive Measures Ext. 235
        elif "masazew mba preventive measures" in combined_lower:
            new_name = "Masazew Mba"
            new_org = "Preventive Measures"
        # Francesco Yepez Coello Mary's Center (cell)
        elif "francesco yepez coello mary" in combined_lower:
            new_name = "Francesco Yepez Coello"
            new_org = "Mary's Center"
        # Debra Burton (person name mistakenly stored as organization)
        elif "debra burton" in combined_lower:
            new_name = "Debra Burton"
            new_org = ""
        # Winston - (single-name person stored as organization with trailing dash)
        elif "winston -" in combined_lower:
            new_name = "Winston"
            new_org = ""
        # Lindsey-United Family Assistance
        else:
            new_name = None
            new_org = None

        if new_name is not None and new_org is not None:
            if new_name != before_name or new_org != before_org:
                snap.reference.update({
                    "name": new_name,
                    "organization": new_org,
                })
                updated += 1
            continue

        # ------------------------------------------------------------------
        # Pattern: organization is clearly a person name (and name is empty).
        # Example: "Debra Burton", "Miss Tyler".
        # ------------------------------------------------------------------
        if not name and org:
            tokens = org.split()
            lowered_first = tokens[0].rstrip(".").lower()
            title_prefixes = {"mr", "mrs", "ms", "miss", "dr"}

            title_match = lowered_first in title_prefixes
            two_word_name_match = _looks_two_word_person_name(org)

            if title_match or two_word_name_match:
                new_name = org.strip()
                new_org = ""

                if new_name != before_name or new_org != before_org:
                    snap.reference.update({
                        "name": new_name,
                        "organization": new_org,
                    })
                    updated += 1
                continue

        # ------------------------------------------------------------------
        # Generic heuristics – *very conservative* pattern-based cleanup.
        # Only operate when there are digits present (likely a phone number)
        # and we clearly have a combined "Name Org (phone)" situation.
        # ------------------------------------------------------------------
        combined_source = None

        # Example: name is numeric-only noise and org holds the combined text,
        # e.g. name='3322', org='Jasmine Morales Network ... (202) 296'.
        if _is_mostly_numeric(name) and org and any(ch.isdigit() for ch in org):
            combined_source = org

        if not combined_source:
            continue

        value = combined_source
        new_name = None
        new_org = None

        tokens = value.split()
        if len(tokens) >= 3:
            candidate_name = " ".join(tokens[:2]).strip()
            candidate_org = " ".join(tokens[2:]).strip()

            # Trim trailing numeric/phone fragments from org.
            org_tokens = candidate_org.split()
            while org_tokens and _is_mostly_numeric(org_tokens[-1]):
                org_tokens.pop()
            candidate_org = " ".join(org_tokens).strip()

            if _looks_person_like(candidate_name) and candidate_org:
                new_name = candidate_name
                new_org = candidate_org

        if new_name is not None and new_org is not None:
            # Skip no-op cases.
            if new_name != before_name or new_org != before_org:
                snap.reference.update({
                    "name": new_name,
                    "organization": new_org,
                })
                updated += 1
            continue

        # ------------------------------------------------------------------
        # Final pass: clear organization values that are effectively numeric
        # garbage (e.g., just "235" or a phone) when we already have a name.
        # ------------------------------------------------------------------
        if name and org and _is_mostly_numeric(org):
            snap.reference.update({
                "name": name,
                "organization": "",
            })
            updated += 1

    # Close progress display cleanly if it was started.
    if progress is not None:
        progress.__exit__(None, None, None)

    print(f"\n✅ Total documents updated: {updated}")


def main() -> None:
    """Entry point with error logging to a per-step log file.

    Any unhandled exception during this cleanup phase will be logged to
    ETL/error_logs/cleanup-temp-referrals-errors.log before being re-raised.
    """

    logger.info("Starting cleanup_temp_referrals_name_from_org ETL step.")
    try:
        _run()
        logger.info("Completed cleanup_temp_referrals_name_from_org ETL step.")
    except Exception:
        logger.exception("Unhandled error during cleanup_temp_referrals_name_from_org ETL step.")
        raise
    finally:
        try:
            if os.path.exists(_error_log_path) and os.path.getsize(_error_log_path) > 0:
                print(f"⚠️ Detailed warnings/errors for this step were written to {_error_log_path}.")
        except Exception:
            logger.debug("Unable to inspect cleanup-temp-referrals error log.")


if __name__ == "__main__":
    main()
