"""Analyze temp-referral collection for messy name/organization values.

This is a read-only script that helps us understand where the
case worker "name" and "organization" fields look combined,
swapped, or otherwise suspicious.

By default this points at the sandbox case-worker collection
"temp-referral" so that analysis does not touch production.

Run from the repo root with the venv activated:

    .\\venv\\Scripts\\python.exe ETL\\analyze_temp_referrals.py
"""

import os
from collections import Counter
from typing import Dict, List

import firebase_admin
from firebase_admin import credentials, firestore


SERVICE_ACCOUNT_PATH = os.path.join(
    "ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json"
)
PROJECT_ID = "food-for-all-dc-caf23"
TEMP_REFERRAL_COLLECTION = "temp-referral"


def _init_firestore() -> firestore.Client:
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
        firebase_admin.initialize_app(cred, {"projectId": PROJECT_ID})
    return firestore.client()


ORG_KEYWORDS = [
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
]


def is_org_like(value: str) -> bool:
    v = (value or "").strip().lower()
    if not v:
        return False
    return any(k in v for k in ORG_KEYWORDS)


def looks_combined(value: str) -> bool:
    v = (value or "").strip()
    if not v:
        return False
    # Heuristics: multiple commas, parentheses, or " at " often
    # indicate combined name + org.
    if "," in v or "(" in v or ")" in v or " at " in v.lower():
        return True
    return False


def main() -> None:
    db = _init_firestore()
    col_ref = db.collection(TEMP_REFERRAL_COLLECTION)

    print(f"📥 Loading documents from '{TEMP_REFERRAL_COLLECTION}' for analysis...")
    docs = list(col_ref.stream())
    print(f"📄 Loaded {len(docs)} documents.\n")

    empty_name = 0
    empty_org = 0
    both_empty = 0

    suspicious: List[Dict[str, str]] = []

    for snap in docs:
        data = snap.to_dict() or {}
        name = str(data.get("name") or "").strip()
        org = str(data.get("organization") or "").strip()

        if not name:
            empty_name += 1
        if not org:
            empty_org += 1
        if not name and not org:
            both_empty += 1

        # Suspicious if:
        # - name looks like an org and org does not, or vice versa
        # - either field looks combined (commas/parentheses/" at ")
        if (
            (is_org_like(name) and not is_org_like(org))
            or (not is_org_like(name) and is_org_like(org))
            or looks_combined(name)
            or looks_combined(org)
        ):
            suspicious.append({
                "id": snap.id,
                "name": name,
                "organization": org,
            })

    print("📊 Basic counts:")
    print(f"  ⚪ Empty name:  {empty_name}")
    print(f"  ⚪ Empty org:   {empty_org}")
    print(f"  ⚪ Both empty:  {both_empty}\n")

    print("🕵️ Suspicious records (potentially combined or swapped name/org).")
    print("Showing up to 100 examples:\n")

    for entry in suspicious[:100]:
        print(
            f"- id={entry['id']!s}\n"
            f"    name         = {entry['name']!r}\n"
            f"    organization = {entry['organization']!r}\n"
        )

    print(f"\n✅ Total suspicious records flagged by heuristics: {len(suspicious)}")


if __name__ == "__main__":
    main()
