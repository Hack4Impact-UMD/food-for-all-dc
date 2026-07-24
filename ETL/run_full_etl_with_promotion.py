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

**WARNING: FINAL STEP IS DESTRUCTIVE**

- The last step permanently deletes all existing documents in
  "client-profile2" and "referral" and replaces them with the sandbox
  data.
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


def _prompt_delete_routes(console: Console) -> bool:
  """Ask whether to delete production route events after promotion."""
  console.print(
    "\n[yellow]Optional:[/yellow] Delete all production route events "
    f"in [bold]{ROUTE_EVENTS_COLLECTION}[/bold]?"
  )
  console.print("[dim]Type 'yes' to delete routes, or press Enter / type 'no' to keep them.[/dim]")
  response = input("Delete route events? [yes/no] (default: no): ").strip().lower()
  return response in {"y", "yes"}


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


def main() -> None:
  console = Console()

  rprint(Panel.fit("🚀 [bold]Food For All DC ETL[/bold]", subtitle="temp → cleaned → production"))

  delete_routes_after_promotion = _prompt_delete_routes(console)
  if delete_routes_after_promotion:
    rprint(
      "[yellow]ℹ️ Route events will be deleted as the final step "
      f"after successful promotion from [bold]{ROUTE_EVENTS_COLLECTION}[/bold].[/yellow]\n"
    )
  else:
    rprint(
      "[cyan]ℹ️ Route events will be kept. "
      f"No changes will be made to [bold]{ROUTE_EVENTS_COLLECTION}[/bold].[/cyan]\n"
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
      "[yellow]🗑️ Deleting production route events collection "
      f"[bold]{ROUTE_EVENTS_COLLECTION}[/bold]...[/yellow]"
    )
    _delete_collection_documents(ROUTE_EVENTS_COLLECTION, console)
  else:
    rprint(f"[cyan]ℹ️ Final step: kept [bold]{ROUTE_EVENTS_COLLECTION}[/bold].[/cyan]")

  rprint("[bold green]🎉 Full ETL + cleanup + promotion pipeline completed.[/bold green]")


if __name__ == "__main__":  # pragma: no cover
    main()
