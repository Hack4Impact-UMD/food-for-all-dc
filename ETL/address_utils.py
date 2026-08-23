import re
from typing import Any


_DIRECTION_TO_ABBREVIATION = {
    "northeast": "NE",
    "northwest": "NW",
    "southeast": "SE",
    "southwest": "SW",
}


def _standardize_address_directions(value: Any) -> str:
    cleaned = str(value or "").strip()
    return re.sub(
        r"\b(northeast|northwest|southeast|southwest)\b",
        lambda match: _DIRECTION_TO_ABBREVIATION[match.group(1).lower()],
        cleaned,
        flags=re.IGNORECASE,
    )


def is_street_style_address(address: Any) -> bool:
    return bool(re.search(r"\d", str(address or "").strip()))


def canonicalize_dc_street_address(address: Any, quadrant: Any) -> str:
    """Use the street quadrant when present, otherwise append the separate quadrant field."""
    cleaned_address = _standardize_address_directions(address)
    cleaned_quadrant = _standardize_address_directions(quadrant)
    quadrant_match = re.search(
        r"\b(NE|NW|SE|SW)\b",
        cleaned_quadrant,
        flags=re.IGNORECASE,
    )
    if not cleaned_address or not quadrant_match or not is_street_style_address(cleaned_address):
        return cleaned_address

    normalized_quadrant = quadrant_match.group(1).upper()
    if re.search(r"\b(NE|NW|SE|SW)\b", cleaned_address, flags=re.IGNORECASE):
        return cleaned_address

    return f"{cleaned_address} {normalized_quadrant}"


def build_dc_geocoding_address(
    address: Any,
    quadrant: Any,
    city: Any,
    state: Any,
    zip_code: Any,
) -> str:
    street = canonicalize_dc_street_address(address, quadrant)
    has_quadrant = bool(re.search(r"\b(NE|NW|SE|SW)\b", street, flags=re.IGNORECASE))
    cleaned_city = str(city or "").strip() or ("Washington" if has_quadrant else "")
    cleaned_state = str(state or "").strip() or ("DC" if has_quadrant else "")
    parts = [street, cleaned_city, cleaned_state, str(zip_code or "").strip()]
    return ", ".join(part for part in parts if part)
