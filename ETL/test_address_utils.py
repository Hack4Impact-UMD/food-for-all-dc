from unittest import TestCase

from address_utils import (
    build_dc_geocoding_address,
    canonicalize_dc_street_address,
    is_street_style_address,
)


class GeocodingAddressTests(TestCase):
    def test_appends_separately_stored_quadrant(self) -> None:
        self.assertEqual(
            canonicalize_dc_street_address("201 I Street", "Southwest"),
            "201 I Street SW",
        )

    def test_treats_street_quadrant_as_authoritative(self) -> None:
        self.assertEqual(
            canonicalize_dc_street_address("201 I Street SW", "NW"),
            "201 I Street SW",
        )

    def test_standardizes_full_word_street_quadrant_without_duplicating_it(self) -> None:
        self.assertEqual(
            canonicalize_dc_street_address("1738 Massachusetts Avenue Southeast", "SE"),
            "1738 Massachusetts Avenue SE",
        )

    def test_full_word_street_quadrant_wins_when_fields_disagree(self) -> None:
        self.assertEqual(
            canonicalize_dc_street_address("201 I Street Southwest", "NW"),
            "201 I Street SW",
        )

    def test_does_not_append_quadrant_to_status_text(self) -> None:
        self.assertEqual(canonicalize_dc_street_address("MOVED", "SW"), "MOVED")

    def test_builds_complete_address_with_legacy_missing_locality(self) -> None:
        self.assertEqual(
            build_dc_geocoding_address("201 I Street", "SW", "", "", "20024"),
            "201 I Street SW, Washington, DC, 20024",
        )

    def test_distinguishes_street_addresses_from_status_text(self) -> None:
        self.assertTrue(is_street_style_address("201 I Street SW"))
        self.assertFalse(is_street_style_address("Moved out of the District"))
