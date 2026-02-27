/**
 * EP4 — break.ts
 *
 * What it does:
 *   1. Enables RLS on the `receipts` table
 *   2. Drops the INSERT policy — so no role except service_role can insert
 *
 *   Result: anon key inserts → 403/empty; service_role → still works.
 *   This is the classic "it works from the dashboard but not from my app" bug.
 *
 * Idempotency: `CREATE OR REPLACE` / `DROP IF EXISTS` make re-runs safe.
 * Reset: `pnpm ep4:reset`  →  `supabase db reset` re-applies migrations (restores policy)
 */

import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const BREAK_SQL = `
-- ❌ BREAK: enable RLS but drop the INSERT policy
alter table public.receipts enable row level security;
drop policy if exists "receipts: authenticated insert" on public.receipts;
`;

hr();
log(c.bold(c.yellow("EP4 BREAK — enabling RLS, dropping INSERT policy")));
hr();

log("What this does:");
log(c.red("  1. ALTER TABLE receipts ENABLE ROW LEVEL SECURITY"));
log(c.red("  2. DROP POLICY 'receipts: authenticated insert'"));
log(c.red("  3. Result: anon key inserts are silently blocked"));
log(c.red("  4. service_role bypasses RLS → still works (confusing discrepancy!)"));
log("");

step("SQL", "Applying break via docker exec psql");

try {
  execSync(
    `docker exec -i supabase_db_supabase-debug-playground psql -U postgres`,
    { input: BREAK_SQL, stdio: ["pipe", "inherit", "inherit"] }
  );
  ok("RLS enabled and INSERT policy dropped");
} catch (err) {
  fail("docker exec psql failed — is Supabase running?");
  fail(`  ${err instanceof Error ? err.message : String(err)}`);
  log("  Run: pnpm supabase:start");
  process.exit(1);
}

log("");
log("Next steps:");
log("  1. pnpm ep4:run  — see anon blocked, service_role succeeds");
log("  2. Fix: run `pnpm ep4:fix` to re-create the INSERT policy");
log("     — or apply manually via docker exec psql");
log("  3. pnpm ep4:run    — confirm the state (anon still blocked — see notes)");
log("  4. pnpm ep4:verify — see all 3 scenarios");
hr();
