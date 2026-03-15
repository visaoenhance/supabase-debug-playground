/**
 * EP8 — fix.ts
 *
 * Adds `receipts` back to the `supabase_realtime` publication.
 * After this, INSERT change events will be emitted to subscribers again.
 */

import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

hr();
log(c.bold(c.green("EP8 FIX — adding receipts back to supabase_realtime publication")));
hr();

log("Fix applied:");
log(c.green("  1. ALTER PUBLICATION supabase_realtime ADD TABLE receipts"));
log(c.green("  2. INSERT events will now reach Realtime subscribers"));
log("");

step("SQL", "Adding receipts to supabase_realtime");

try {
  execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres`,
    {
      input: `alter publication supabase_realtime add table public.receipts;`,
      stdio: ["pipe", "inherit", "inherit"],
    }
  );
  ok("receipts added to supabase_realtime publication");
} catch (err) {
  fail(`docker exec psql failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

// ── Confirm via pg_publication_tables ────────────────────────────────────────

step("Verify", "Confirming via pg_publication_tables");

try {
  const result = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -tAc ` +
    `"SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='receipts';"`,
    { encoding: "utf-8" }
  ).trim();

  if (result === "receipts") {
    ok("Confirmed: receipts IS in supabase_realtime ✔");
  } else {
    fail("receipts not found in publication — check Docker and Supabase state");
    process.exit(1);
  }
} catch (err) {
  fail(`Publication check failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

log("");
log("Next steps:");
log("  • pnpm ep8:verify — confirm INSERT event received end-to-end");
hr();
