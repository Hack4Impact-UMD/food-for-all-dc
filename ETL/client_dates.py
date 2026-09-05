"""Canonical client date handling for Python-side writes to client-profile2.

Mirrors my-app/src/utils/clientDate.ts. Calendar dates are stored at noon
America/New_York so the day survives being rendered in any US timezone -
midnight Eastern would roll back a day for anyone west of Eastern.

Instant fields (createdAt/updatedAt) are NOT calendar dates and must not be
passed through here; they keep their real time-of-day.
"""

from __future__ import annotations

from datetime import date, datetime, time
from typing import Any, Optional
from zoneinfo import ZoneInfo

EASTERN = ZoneInfo("America/New_York")

# Keep in sync with CLIENT_DATE_FIELDS in my-app/src/utils/clientDate.ts.
CLIENT_DATE_FIELDS = (
    "dob",
    "startDate",
    "endDate",
    "tefapCertDate",
    "famStartDate",
    "referredDate",
    "autoInactivePreviousEndDate",
    "autoInactiveStrikeDate",
)

ACCEPTED_FORMATS = ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d %H:%M:%S")

# Values the source spreadsheets use to mean "no date".
SENTINEL_TEXT = {"", "nan", "none", "null", "n/a"}


def to_eastern_noon(value: date) -> datetime:
    """Anchor a calendar date at noon Eastern."""
    return datetime.combine(value, time(12, 0), tzinfo=EASTERN)


def to_calendar_date(value: Any) -> Optional[date]:
    """Extract a calendar date from any of the shapes the ETL sources produce."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(EASTERN).date() if value.tzinfo else value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, dict):
        # A Timestamp flattened into {seconds, nanoseconds} by a structural copy.
        seconds = value.get("seconds")
        if isinstance(seconds, (int, float)):
            return datetime.fromtimestamp(seconds, tz=EASTERN).date()
        return None

    text = str(value).strip()
    if text.lower() in SENTINEL_TEXT:
        return None

    for fmt in ACCEPTED_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    return None


def parse_client_date(value: Any) -> Optional[datetime]:
    """Convert any client date input into the canonical stored value, or None."""
    calendar_date = to_calendar_date(value)
    return to_eastern_noon(calendar_date) if calendar_date else None


def normalize_client_dates(profile: dict) -> dict:
    """Normalize every calendar-date field present on a client payload.

    The single write funnel for Python: any script writing to client-profile2
    should pass its payload through this before calling set()/update().
    """
    normalized = dict(profile)
    for field in CLIENT_DATE_FIELDS:
        if field in normalized:
            normalized[field] = parse_client_date(normalized[field])
    return normalized
