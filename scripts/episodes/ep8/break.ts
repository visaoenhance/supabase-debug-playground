/**
 * EP8 — break.ts
 *
 * Removes `receipts` from the `supabase_realtime` publication.
 * After this, INSERT events on receipts will never reach Realtime subscribers
 * even though the inserts themselves succeed.
 *
 * Reset: `pnpm ep8:reset`  →  `supabase db reset` re-applies migration 000005
 *        which adds receipts back to the publication.
 */

import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

hr();
log(c.bold(c.yellow("EP8 BREAK — removing receipts from supabase_realtime publication")));
hr();

log("What this does:");
log(c.red("  1. ALTER PUBLICATION supabase_realtime DROP TABLE receipts"));
log(c.red("  2. Inserts on receipts will succeed, but Realtime emits no events"));
log(c.red("  3. Subscribers receive no events — silent failure"));
log("");

step("SQL", "Removing receipts from publication");

try {
  execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres`,
    {
      input: `alter publication supabase_realtime drop table public.receipts;`,
      stdio: ["pipe", "inherit", "inherit"],
    }
  );
  ok("receipts removed from supabase_realtime publication");
} catch (err) {
  fail(`docker exec psql failed: ${err instanceof Error ? err.message : String(err)}`);
  log("  Is Supabase running?  Try: pnpm supabase:start");
  process.exit(1);
}

log("");
log("Verify broken state:");

try {
  const result = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -tAc ` +
    `"SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='receipts';"`,
    { encoding: "utf-8" }
  ).trim();

  if (!result) {
    ok("Confirmed: receipts is NOT in supabase_realtime publication ✔");
  } else {
    fail("receipts is still in the publication — break may not have applied");
    process.exit(1);
  }
} catch (err) {
  fail(`Publication check failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

log("");
log("Next steps:");
log("  1. pnpm ep8:run    — open subscription, insert, observe no event");
log("  2. Check pg_publication_tables to confirm receipts is missing");
log("  3. pnpm ep8:fix    — add receipts back to the publication");
log("  4. pnpm ep8:verify — confirm INSERT event received end-to-end");
hr();
