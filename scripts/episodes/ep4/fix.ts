/**
 * EP4 — fix.ts
 *
 * What it does:
 *   Re-creates the dropped INSERT policy on `public.receipts`.
 *   RLS stays enabled — that's correct. The fix is not "disable RLS",
 *   it's "add the right policy so authenticated users can insert".
 *
 * ─── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 *
 *   BUG — INSERT policy dropped while RLS is enabled:
 *     `drop policy "receipts: authenticated insert" on public.receipts`
 *     Result: anon key inserts return 0 rows / 403 — no explicit error, just silence.
 *     service_role bypasses RLS entirely → still works, creating the classic
 *     "it works from the Supabase dashboard but not from my app" confusion.
 *
 * ─── HOW IT WAS FIXED ────────────────────────────────────────────────────────
 *
 *   FIX — Re-create the INSERT policy:
 *     `create policy "receipts: authenticated insert"` with
 *     `with check ((select auth.role()) = 'authenticated')`
 *     RLS stays enabled. The policy is what was missing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Reset: `pnpm ep4:reset` (supabase db reset) also restores the policy.
 */

import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

// ✅ FIX: re-create the INSERT policy (matches the baseline migration exactly)
const FIX_SQL = `
-- ✅ FIX: re-create the INSERT policy that was dropped by ep4:break
-- RLS stays enabled — the fix is the policy, not disabling RLS
create policy "receipts: authenticated insert"
  on public.receipts
  for insert
  with check ((select auth.role()) = 'authenticated');
`;

hr();
log(c.bold(c.green("EP4 FIX — re-creating INSERT policy on receipts")));
hr();

log("Fix applied:");
log(c.green("  1. CREATE POLICY 'receipts: authenticated insert'"));
log(c.green("  2. WITH CHECK (auth.role() = 'authenticated')"));
log(c.green("  3. RLS remains enabled — policy is the fix, not disabling RLS"));
log("");

step("SQL", "Applying INSERT policy via docker exec psql");
log(c.grey(FIX_SQL.trim()));
log("");

try {
  execSync(
    `docker exec -i supabase_db_supabase-debug-playground psql -U postgres`,
    { input: FIX_SQL, stdio: ["pipe", "inherit", "inherit"] }
  );
  ok("INSERT policy re-created on receipts");
} catch (err) {
  fail("docker exec psql failed — is Supabase running?");
  fail(`  ${err instanceof Error ? err.message : String(err)}`);
  log("  Run: pnpm supabase:start");
  process.exit(1);
}

log("");
log("Next steps:");
log("  1. pnpm ep4:run    — confirm anon + service_role behaviour has changed");
log("  2. pnpm ep4:verify — run pass/fail assertions");
log("  3. pnpm ep4:reset  — restore DB to clean state");
hr();
