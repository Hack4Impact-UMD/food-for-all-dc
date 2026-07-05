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

from typing import NoReturn

from rich import print as rprint
from rich.panel import Panel
from rich.console import Console

import firebase_migration_v2
import prune_temp_referrals_no_contact
import cleanup_temp_referrals_name_from_org
import promote_temp_clients_and_referrals


def main() -> None:
  console = Console()

  rprint(Panel.fit("🚀 [bold]Food For All DC ETL[/bold]", subtitle="temp → cleaned → production"))

  rprint("[cyan]Step 1/4[/cyan] ▶️ ETL into [bold]temp-profile2[/bold] / [bold]temp-referral[/bold]...")
  firebase_migration_v2.main()
  rprint("[green]✅ Completed[/green] firebase_migration_v2.\n")

  rprint("[cyan]Step 2/4[/cyan] 🧹 Pruning sandbox referrals with no contact info (temp-referral / temp-profile2)...")
  prune_temp_referrals_no_contact.main()
  rprint("[green]✅ Completed[/green] prune_temp_referrals_no_contact.\n")

  rprint("[cyan]Step 3/4[/cyan] 🧩 Cleaning sandbox case worker name/organization fields (temp-referral)...")
  cleanup_temp_referrals_name_from_org.main()
  rprint("[green]✅ Completed[/green] cleanup_temp_referrals_name_from_org.\n")

  rprint("[cyan]Step 4/4[/cyan] 🔁 Promoting sandbox clients/referrals into production collections...")
  promote_temp_clients_and_referrals.main()
  rprint("[bold green]🎉 Full ETL + cleanup + promotion pipeline completed.[/bold green]")


if __name__ == "__main__":  # pragma: no cover
    main()
