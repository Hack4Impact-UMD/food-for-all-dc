import re
from datetime import date, datetime, timezone
from pathlib import Path
from unittest import TestCase
from zoneinfo import ZoneInfo

from client_dates import (
    CLIENT_DATE_FIELDS,
    EASTERN,
    normalize_client_dates,
    parse_client_date,
    to_calendar_date,
    to_eastern_noon,
)

PACIFIC = ZoneInfo("America/Los_Angeles")


class CalendarDateTests(TestCase):
    def test_parses_iso_form_written_by_the_app(self) -> None:
        self.assertEqual(to_calendar_date("2026-07-23"), date(2026, 7, 23))

    def test_parses_legacy_slash_form(self) -> None:
        self.assertEqual(to_calendar_date("07/23/2026"), date(2026, 7, 23))

    def test_parses_excel_datetime_values(self) -> None:
        self.assertEqual(to_calendar_date(datetime(2026, 7, 23, 9, 30)), date(2026, 7, 23))

    def test_recovers_a_flattened_timestamp_map(self) -> None:
        flattened = {"seconds": 1784844095, "nanoseconds": 293000000}
        self.assertEqual(to_calendar_date(flattened), date(2026, 7, 23))

    def test_returns_none_for_sentinels(self) -> None:
        for value in (None, "", "   ", "nan", "N/A", "not a date"):
            with self.subTest(value=value):
                self.assertIsNone(to_calendar_date(value))


class EasternNoonTests(TestCase):
    def test_anchors_at_noon_eastern_during_daylight_saving(self) -> None:
        result = to_eastern_noon(date(2026, 7, 23))
        self.assertEqual(result.astimezone(timezone.utc).isoformat(), "2026-07-23T16:00:00+00:00")

    def test_anchors_at_noon_eastern_outside_daylight_saving(self) -> None:
        result = to_eastern_noon(date(2026, 12, 31))
        self.assertEqual(result.astimezone(timezone.utc).isoformat(), "2026-12-31T17:00:00+00:00")

    def test_zeroes_the_time_below_the_hour(self) -> None:
        result = to_eastern_noon(date(2026, 7, 23))
        self.assertEqual((result.minute, result.second, result.microsecond), (0, 0, 0))

    def test_calendar_day_survives_a_western_timezone(self) -> None:
        result = to_eastern_noon(date(2026, 7, 23))
        self.assertEqual(result.astimezone(PACIFIC).date(), date(2026, 7, 23))
        self.assertEqual(result.astimezone(EASTERN).date(), date(2026, 7, 23))

    def test_midnight_would_have_rolled_back_a_day_in_pacific(self) -> None:
        # Guards the reason this convention exists rather than using midnight.
        midnight = datetime(2026, 7, 23, 0, 0, tzinfo=EASTERN)
        self.assertEqual(midnight.astimezone(PACIFIC).date(), date(2026, 7, 22))


class NormalizeClientDatesTests(TestCase):
    def test_converts_present_fields_and_leaves_others_alone(self) -> None:
        result = normalize_client_dates(
            {
                "firstName": "Carol",
                "startDate": "07/23/2026",
                "endDate": date(2027, 7, 23),
                "tefapCertDate": "",
                "adults": 2,
            }
        )

        self.assertEqual(result["firstName"], "Carol")
        self.assertEqual(result["adults"], 2)
        self.assertEqual(result["startDate"], to_eastern_noon(date(2026, 7, 23)))
        self.assertEqual(result["endDate"], to_eastern_noon(date(2027, 7, 23)))
        self.assertIsNone(result["tefapCertDate"])

    def test_does_not_add_absent_fields(self) -> None:
        result = normalize_client_dates({"startDate": "2026-07-23"})
        self.assertNotIn("endDate", result)
        self.assertNotIn("dob", result)

    def test_is_idempotent(self) -> None:
        once = normalize_client_dates({"startDate": "07/23/2026"})
        twice = normalize_client_dates(once)
        self.assertEqual(once["startDate"], twice["startDate"])

    def test_matches_the_frontend_funnel_field_list(self) -> None:
        """Parity guard: the two funnels must cover exactly the same fields.

        Reads CLIENT_DATE_FIELDS out of my-app/src/utils/clientDate.ts rather than
        restating it, so adding a field on one side and not the other fails here.
        """
        source = (
            Path(__file__).resolve().parent.parent
            / "my-app"
            / "src"
            / "utils"
            / "clientDate.ts"
        ).read_text(encoding="utf-8")

        declaration = re.search(
            r"export const CLIENT_DATE_FIELDS = \[(.*?)\] as const;", source, re.DOTALL
        )
        self.assertIsNotNone(declaration, "Could not locate CLIENT_DATE_FIELDS in clientDate.ts")

        frontend_fields = tuple(re.findall(r'"([^"]+)"', declaration.group(1)))
        self.assertEqual(frontend_fields, CLIENT_DATE_FIELDS)


class ParseClientDateTests(TestCase):
    def test_returns_none_rather_than_guessing(self) -> None:
        self.assertIsNone(parse_client_date(""))
        self.assertIsNone(parse_client_date("garbage"))

    def test_round_trips_its_own_output(self) -> None:
        first = parse_client_date("07/23/2026")
        self.assertEqual(parse_client_date(first), first)
