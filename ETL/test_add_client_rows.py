from unittest import TestCase
from unittest.mock import MagicMock

import pandas as pd

from add_client_rows import find_existing_client_ids, parse_row_numbers, select_rows


class ParseRowNumbersTests(TestCase):
    def test_accepts_numbers_commas_and_ranges(self) -> None:
        self.assertEqual(
            parse_row_numbers(["12", "15,18", "20-22"]),
            [12, 15, 18, 20, 21, 22],
        )

    def test_removes_duplicate_rows_without_reordering(self) -> None:
        self.assertEqual(parse_row_numbers(["12,12", "11-12"]), [12, 11])

    def test_rejects_header_row(self) -> None:
        with self.assertRaisesRegex(ValueError, "row 1 contains headers"):
            parse_row_numbers(["1"])

    def test_rejects_descending_range(self) -> None:
        with self.assertRaisesRegex(ValueError, "must be ascending"):
            parse_row_numbers(["12-10"])


class SelectRowsTests(TestCase):
    def test_preserves_requested_excel_row_order(self) -> None:
        dataframe = pd.DataFrame(
            [
                {"_excel_row_num": 8, "ID": "ID-8", "FIRST": "Eight"},
                {"_excel_row_num": 12, "ID": "ID-12", "FIRST": "Twelve"},
            ]
        )

        records = select_rows(dataframe, [12, 8])

        self.assertEqual([record["ID"] for record in records], ["ID-12", "ID-8"])

    def test_rejects_missing_rows(self) -> None:
        dataframe = pd.DataFrame([{"_excel_row_num": 8, "ID": "ID-8"}])

        with self.assertRaisesRegex(ValueError, "Workbook rows not found: 9"):
            select_rows(dataframe, [9])

    def test_rejects_rows_without_stable_ids(self) -> None:
        dataframe = pd.DataFrame([{"_excel_row_num": 8, "ID": None}])

        with self.assertRaisesRegex(ValueError, "Selected rows have no stable ID: 8"):
            select_rows(dataframe, [8])

    def test_normalizes_integral_excel_ids(self) -> None:
        dataframe = pd.DataFrame([{"_excel_row_num": 8, "ID": 2056.0}])

        records = select_rows(dataframe, [8])

        self.assertEqual(records[0]["ID"], "2056")

    def test_rejects_duplicate_client_ids(self) -> None:
        dataframe = pd.DataFrame(
            [
                {"_excel_row_num": 8, "ID": "ID-8"},
                {"_excel_row_num": 9, "ID": "ID-8"},
            ]
        )

        with self.assertRaisesRegex(ValueError, "duplicate IDs: ID-8"):
            select_rows(dataframe, [8, 9])


class ExistingClientTests(TestCase):
    def test_returns_only_existing_production_ids(self) -> None:
        database = MagicMock()
        existing = MagicMock(id="ID-8", exists=True)
        missing = MagicMock(id="ID-9", exists=False)
        database.get_all.return_value = [missing, existing]

        result = find_existing_client_ids(database, ["ID-8", "ID-9"])

        self.assertEqual(result, ["ID-8"])
        collection = database.collection
        collection.assert_any_call("client-profile2")
