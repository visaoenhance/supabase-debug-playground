/**
 * EP2 — fix.ts
 *
 * What it does:
 *   Applies the corrected create_receipt Postgres function directly to the
 *   local database via docker exec psql.
 *
 * ─── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 *
 *   BUG — Column typo in INSERT:
 *     `insert into public.receipts (titl, amount)` — `titl` does not exist.
 *     PostgreSQL error code 42703 ("undefined column") on every RPC call.
 *     The error message names the bad column exactly — but you need to know
 *     where to look (RPC error object → code + message, then pg_get_functiondef
 *     to confirm the live SQL).
 *
 * ─── HOW IT WAS FIXED ────────────────────────────────────────────────────────
 *
 *   FIX — Correct the column name in the INSERT statement:
 *     `insert into public.receipts (title, amount)` — one character restored.
 *
 *   Also adds RAISE NOTICE for server-side logging (visible via supabase db logs)
 *   so future calls are traceable without a full pg_get_functiondef lookup.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Reset: `pnpm ep2:reset` (supabase db reset) also restores the good function.
 */

import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

// ✅ FIX: correct column name `title` (was `titl` — missing the final 'e')
const FIXED_SQL = `
create or replace function public.create_receipt(
  title  text,
  amount numeric
)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  new_receipt public.receipts;
begin
  -- ✅ FIX: RAISE NOTICE added — server-side log visible via \`supabase db logs\`
  raise notice 'create_receipt called with title=%, amount=%', title, amount;

  -- ✅ FIX: corrected column name from \`titl\` to \`title\`
  insert into public.receipts (title, amount)
  values (title, amount)
  returning * into new_receipt;

  return new_receipt;
end;
$$;
`;

hr();
log(c.bold(c.green("EP2 FIX — applying corrected create_receipt RPC")));
hr();

log("Fix applied:");
log(c.green("  1. INSERT column corrected: `titl` → `title`  (was BUG: PostgreSQL 42703)"));
log(c.green("  2. RAISE NOTICE added — server-side logging now visible via `supabase db logs`"));
log("");

step("SQL", "Applying fixed create_receipt via docker exec psql");
log(c.grey(FIXED_SQL.trim()));
log("");

try {
  execSync(
    `docker exec -i supabase_db_supabase-debug-playground psql -U postgres`,
    { input: FIXED_SQL, stdio: ["pipe", "inherit", "inherit"] }
  );
  ok("Fixed RPC applied to local DB");
} catch (err) {
  fail("docker exec psql failed — is Supabase running?");
  fail(`  ${err instanceof Error ? err.message : String(err)}`);
  log("  Run: pnpm supabase:start");
  process.exit(1);
}

log("");
log("Next steps:");
log("  1. pnpm ep2:run    — confirm no error + receipt returned");
log("  2. pnpm ep2:verify — run pass/fail assertions");
log("  3. pnpm ep2:reset  — restore DB to clean state");
hr();
