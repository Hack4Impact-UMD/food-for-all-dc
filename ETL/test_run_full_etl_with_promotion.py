import sys
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, call, patch

for module_name in (
  "firebase_migration_v2",
  "prune_temp_referrals_no_contact",
  "cleanup_temp_referrals_name_from_org",
  "promote_temp_clients_and_referrals",
):
  sys.modules.setdefault(module_name, Mock())

import run_full_etl_with_promotion as pipeline


class DeleteRouteDataTests(TestCase):
  def test_add_only_mode_disables_route_deletion_without_prompting(self) -> None:
    console = Mock()

    with patch("builtins.input") as prompt:
      result = pipeline._prompt_delete_routes(console, add_only=True)

    self.assertFalse(result)
    prompt.assert_not_called()
    self.assertIn("Route-data deletion is disabled", console.print.call_args.args[0])

  def test_plain_yes_does_not_enable_full_etl_route_deletion(self) -> None:
    with patch("builtins.input", return_value="yes"):
      result = pipeline._prompt_delete_routes(Mock())

    self.assertFalse(result)

  def test_exact_full_etl_phrase_enables_route_deletion(self) -> None:
    with patch("builtins.input", return_value=pipeline.ROUTE_DELETE_CONFIRMATION):
      result = pipeline._prompt_delete_routes(Mock())

    self.assertTrue(result)

  def test_deletes_events_and_clusters(self) -> None:
    console = Mock()

    with patch.object(
      pipeline,
      "_delete_collection_documents",
      side_effect=[4, 12],
    ) as delete_collection:
      result = pipeline._delete_route_data(console)

    self.assertEqual(result, {"events": 12, "clusters": 4})
    self.assertEqual(
      delete_collection.call_args_list,
      [call("clusters", console), call("events", console)],
    )

  def test_main_deletes_route_data_after_successful_promotion(self) -> None:
    migration_stats = SimpleNamespace(
      total_records=10,
      skipped_inactive=1,
      skipped_duplicates=1,
      failed_imports=0,
      successful_imports=8,
    )

    with (
      patch.dict("os.environ", {"MIGRATION_LIMIT_RECORDS": ""}),
      patch.object(pipeline, "_prompt_delete_routes", return_value=True),
      patch.object(pipeline.firebase_migration_v2, "main", return_value=migration_stats),
      patch.object(pipeline.prune_temp_referrals_no_contact, "main"),
      patch.object(pipeline.cleanup_temp_referrals_name_from_org, "main"),
      patch.object(pipeline.promote_temp_clients_and_referrals, "main"),
      patch.object(pipeline, "_delete_route_data") as delete_route_data,
      patch.object(pipeline, "rprint"),
    ):
      pipeline.main()

    delete_route_data.assert_called_once()