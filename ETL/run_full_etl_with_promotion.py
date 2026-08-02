"""Run full ETL into sandbox, clean referrals, then promote to production.

Pipeline steps (in order):

1. Run firebase_migration_v2.main(), which is currently configured to
   write clients into "temp-profile2" and case workers into
   "temp-referral".
2. Run prune_temp_referrals_no_contact.main() to delete sandbox
   referrals with no contact info and reset linked sandbox clients'
   referralEntity to a neutral "None" organization.
3. Run cleanup_temp_referrals_name_from_org.main() to apply any
   name/organization cleanup heuristics to the sandbox "temp-referral"
   collection.
4. Run promote_temp_clients_and_referrals.main() to:
   - Delete all existing documents from "client-profile2" and
     "referral".
   - Copy all docs from "temp-profile2" -> "client-profile2" and
     from "temp-referral" -> "referral" using the same IDs.
   - Delete all docs from the sandbox collections.
5. If route-data deletion was selected before the pipeline started,
   delete all documents from both "events" and "clusters" so saved
   cluster assignments cannot outlive their source delivery events.

**WARNING: FINAL STEP IS DESTRUCTIVE**

- The last step permanently deletes all existing documents in
  "client-profile2" and "referral" and replaces them with the sandbox
  data.
- If route-data deletion is selected, the final cleanup also permanently
  deletes all documents in both "events" and "clusters".
- Use this only after you have validated the sandbox output of
  firebase_migration_v2 and are ready to refresh production.

Run from the repo root with the venv activated:

    .\\venv\\Scripts\\python.exe ETL\\run_full_etl_with_promotion.py

"""

from __future__ import annotations

import os

from rich import print as rprint
from rich.panel import Panel
from rich.console import Console
from firebase_admin import firestore

import firebase_migration_v2
import prune_temp_referrals_no_contact
import cleanup_temp_referrals_name_from_org
import promote_temp_clients_and_referrals


ROUTE_EVENTS_COLLECTION = "events"
ROUTE_CLUSTERS_COLLECTION = "clusters"
ROUTE_DATA_COLLECTIONS = (ROUTE_CLUSTERS_COLLECTION, ROUTE_EVENTS_COLLECTION)
ROUTE_DELETE_CONFIRMATION = "DELETE FULL ETL ROUTE DATA"


def _prompt_delete_routes(console: Console, *, add_only: bool = False) -> bool:
  """Ask about route deletion only for a full replacement ETL run."""
  if add_only:
    console.print(
      "\n[bold green]Add-only mode:[/bold green] Existing production data in "
      f"[bold]{ROUTE_EVENTS_COLLECTION}[/bold] and "
      f"[bold]{ROUTE_CLUSTERS_COLLECTION}[/bold] will be kept. "
      "Route-data deletion is disabled."
    )
    return False

  console.print(
    "\n[bold red]FULL ETL ONLY:[/bold red] Optionally delete all production route data in "
    f"[bold]{ROUTE_EVENTS_COLLECTION}[/bold] and "
    f"[bold]{ROUTE_CLUSTERS_COLLECTION}[/bold]?"
  )
  console.print(
    "[yellow]Do not delete this data when adding selected new workbook rows. "
    "Exit this full ETL and use add_client_rows.py for add-only imports.[/yellow]"
  )
  console.print(
    "[dim]For a full replacement ETL only, type "
    f"'[bold]{ROUTE_DELETE_CONFIRMATION}[/bold]' exactly. "
    "Any other response keeps route events and clusters.[/dim]"
  )
  response = input(
    "FULL ETL route-data deletion confirmation (default: keep): "
  ).strip()
  return response == ROUTE_DELETE_CONFIRMATION


def _delete_collection_documents(collection_name: str, console: Console) -> int:
  """Delete all documents in a Firestore collection and return count."""
  db = firestore.client()
  deleted = 0
  docs = db.collection(collection_name).stream()
  for doc in docs:
    doc.reference.delete()
    deleted += 1
  console.print(
    f"[green]✅ Deleted[/green] {deleted} document(s) from "
    f"[bold]{collection_name}[/bold]."
  )
  return deleted


def _delete_route_data(console: Console) -> dict[str, int]:
  """Delete route events and their corresponding cluster assignments."""
  return {
    collection_name: _delete_collection_documents(collection_name, console)
    for collection_name in ROUTE_DATA_COLLECTIONS
  }


def main() -> None:
  console = Console()

  rprint(Panel.fit("🚀 [bold]Food For All DC ETL[/bold]", subtitle="temp → cleaned → production"))

  delete_routes_after_promotion = _prompt_delete_routes(console)
  if delete_routes_after_promotion:
    rprint(
      "[yellow]ℹ️ Route events and clusters will be deleted as the final step "
      "after successful promotion from "
      f"[bold]{ROUTE_EVENTS_COLLECTION}[/bold] and "
      f"[bold]{ROUTE_CLUSTERS_COLLECTION}[/bold].[/yellow]\n"
    )
  else:
    rprint(
      "[cyan]ℹ️ Route events and clusters will be kept. "
      f"No changes will be made to [bold]{ROUTE_EVENTS_COLLECTION}[/bold] or "
      f"[bold]{ROUTE_CLUSTERS_COLLECTION}[/bold].[/cyan]\n"
    )

  rprint("[cyan]Step 1/4[/cyan] ▶️ ETL into [bold]temp-profile2[/bold] / [bold]temp-referral[/bold]...")
  if os.getenv("MIGRATION_LIMIT_RECORDS"):
    raise RuntimeError("Refusing production promotion while MIGRATION_LIMIT_RECORDS is set.")
  migration_stats = firebase_migration_v2.main()
  if migration_stats is None:
    raise RuntimeError("ETL did not complete; refusing production promotion.")
  intended_imports = (
    migration_stats.total_records
    - migration_stats.skipped_inactive
    - migration_stats.skipped_duplicates
  )
  if migration_stats.failed_imports or migration_stats.successful_imports != intended_imports:
    raise RuntimeError(
      "ETL imported only "
      f"{migration_stats.successful_imports}/{intended_imports} intended records "
      f"({migration_stats.skipped_inactive} inactive and "
      f"{migration_stats.skipped_duplicates} duplicate skipped; "
      f"{migration_stats.failed_imports} failed); "
      "refusing production promotion."
    )
  rprint("[green]✅ Completed[/green] firebase_migration_v2.\n")

  rprint("[cyan]Step 2/4[/cyan] 🧹 Pruning sandbox referrals with no contact info (temp-referral / temp-profile2)...")
  prune_temp_referrals_no_contact.main()
  rprint("[green]✅ Completed[/green] prune_temp_referrals_no_contact.\n")

  rprint("[cyan]Step 3/4[/cyan] 🧩 Cleaning sandbox case worker name/organization fields (temp-referral)...")
  cleanup_temp_referrals_name_from_org.main()
  rprint("[green]✅ Completed[/green] cleanup_temp_referrals_name_from_org.\n")

  rprint("[cyan]Step 4/4[/cyan] 🔁 Promoting sandbox clients/referrals into production collections...")
  promote_temp_clients_and_referrals.main()

  if delete_routes_after_promotion:
    rprint(
      "[yellow]🗑️ Deleting production route data from "
      f"[bold]{ROUTE_EVENTS_COLLECTION}[/bold] and "
      f"[bold]{ROUTE_CLUSTERS_COLLECTION}[/bold]...[/yellow]"
    )
    _delete_route_data(console)
  else:
    rprint(
      "[cyan]ℹ️ Final step: kept "
      f"[bold]{ROUTE_EVENTS_COLLECTION}[/bold] and "
      f"[bold]{ROUTE_CLUSTERS_COLLECTION}[/bold].[/cyan]"
    )

  rprint("[bold green]🎉 Full ETL + cleanup + promotion pipeline completed.[/bold green]")


if __name__ == "__main__":  # pragma: no cover
    main()
