from unittest import TestCase
from unittest.mock import MagicMock, patch

import pandas as pd

from add_client_rows import (
    find_existing_client_ids,
    get_row_numbers,
    parse_row_numbers,
    select_rows,
)
from firebase_migration_v2 import FirestoreMigration, MigrationStats


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

    def test_prompts_for_rows_when_cli_option_is_omitted(self) -> None:
        with patch("builtins.input", return_value="12,15-16") as prompt:
            result = get_row_numbers(None)

        self.assertEqual(result, [12, 15, 16])
        prompt.assert_called_once()

    def test_cli_rows_bypass_interactive_prompt(self) -> None:
        with patch("builtins.input") as prompt:
            result = get_row_numbers(["12", "15-16"])

        self.assertEqual(result, [12, 15, 16])
        prompt.assert_not_called()


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


class CreateOnlyReferralTests(TestCase):
    def _build_migration(self, transformed_records: list[dict]) -> FirestoreMigration:
        migration = FirestoreMigration.__new__(FirestoreMigration)
        migration.db = MagicMock()
        migration.collection_name = "client-profile2"
        migration.referral_collection_name = "referral"
        migration.create_only = True
        migration.stats = MigrationStats()
        migration.processed_names = set()
        migration.failed_geocoding_clients = []
        migration.load_referral_form = MagicMock(return_value=[])
        migration.check_recent_deliveries = MagicMock(return_value=False)
        migration._advance_progress = MagicMock()
        migration.transform_record = MagicMock(side_effect=transformed_records)
        return migration

    def test_contactless_referral_is_not_created_in_production(self) -> None:
        migration = self._build_migration(
            [
                {
                    "firstName": "No",
                    "lastName": "Referral",
                    "referralEntity": {"id": "", "name": "None", "organization": "None"},
                    "_referralContactEmail": "",
                    "_referralContactPhone": "",
                }
            ]
        )

        successful, failed = migration.import_batch(
            [{"ID": "NEW-1", "FIRST": "No", "LAST": "Referral", "Active": "Yes"}]
        )

        self.assertEqual((successful, failed), (1, 0))
        batch = migration.db.batch.return_value
        batch.create.assert_called_once()
        self.assertEqual(
            batch.create.call_args.args[1]["referralEntity"],
            {"id": "", "name": "", "organization": "None"},
        )
        self.assertEqual(
            [call.args[0] for call in migration.db.collection.call_args_list],
            ["client-profile2"],
        )

    def test_contactless_internet_search_rows_do_not_create_duplicate_referrals(self) -> None:
        migration = self._build_migration(
            [
                {
                    "firstName": first_name,
                    "lastName": "Client",
                    "referralEntity": {
                        "id": "",
                        "name": "",
                        "organization": "Internet Search",
                    },
                    "_referralContactEmail": "",
                    "_referralContactPhone": "",
                }
                for first_name in ("One", "Two")
            ]
        )

        successful, failed = migration.import_batch(
            [
                {"ID": "NEW-1", "FIRST": "One", "LAST": "Client", "Active": "Yes"},
                {"ID": "NEW-2", "FIRST": "Two", "LAST": "Client", "Active": "Yes"},
            ]
        )

        self.assertEqual((successful, failed), (2, 0))
        batch = migration.db.batch.return_value
        self.assertEqual(batch.create.call_count, 2)
        self.assertEqual(
            [call.args[0] for call in migration.db.collection.call_args_list],
            ["client-profile2", "client-profile2"],
        )

    def test_contactful_referral_is_created_with_its_client(self) -> None:
        migration = self._build_migration(
            [
                {
                    "firstName": "Has",
                    "lastName": "Referral",
                    "referralEntity": {
                        "id": "",
                        "name": "Case Worker",
                        "organization": "Community Center",
                    },
                    "_referralContactEmail": "worker@example.org",
                    "_referralContactPhone": "",
                }
            ]
        )

        successful, failed = migration.import_batch(
            [{"ID": "NEW-1", "FIRST": "Has", "LAST": "Referral", "Active": "Yes"}]
        )

        self.assertEqual((successful, failed), (1, 0))
        writes = [call.args[1] for call in migration.db.batch.return_value.create.call_args_list]
        self.assertEqual(len(writes), 2)
        self.assertEqual(writes[0]["email"], "worker@example.org")
        self.assertEqual(writes[1]["referralEntity"]["organization"], "Community Center")
