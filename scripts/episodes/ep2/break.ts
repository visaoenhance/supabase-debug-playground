/**
 * EP2 — break.ts
 *
 * What it does:
 *   Replaces the `create_receipt` Postgres function with a broken version that
 *   INSERTs into a non-existent column (`titl` instead of `title`).
 *   Every call to the RPC will return PostgreSQL error code 42703.
 *
 * Reset: `pnpm ep2:reset`  →  `supabase db reset` re-runs migrations (restores good function)
 */

import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step, warn } from "../../utils.js";

const BROKEN_SQL = `
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
  -- ❌ BREAK: column is "titl" — does not exist → PostgreSQL error 42703
  insert into public.receipts (titl, amount)
  values (title, amount)
  returning * into new_receipt;

  return new_receipt;
end;
$$;
`;

hr();
log(c.bold(c.yellow("EP2 BREAK — injecting broken create_receipt RPC")));
hr();

log("Bug injected:");
log(c.red('  INSERT uses column `titl` (missing the e) → PostgreSQL 42703 on every call'));
log("");

step("SQL", "Applying broken create_receipt via docker exec psql");
log(c.grey(BROKEN_SQL.trim()));

try {
  execSync(
    `docker exec -i supabase_db_supabase-debug-playground psql -U postgres`,
    { input: BROKEN_SQL, stdio: ["pipe", "inherit", "inherit"] }
  );
  ok("Broken RPC applied to local DB");
} catch (err) {
  fail("docker exec psql failed — is Supabase running?");
  fail(`  ${err instanceof Error ? err.message : String(err)}`);
  log("  Run: pnpm supabase:start");
  process.exit(1);
}

log("");
log("Next steps:");
log("  1. pnpm ep2:run  — observe the 42703 error");
log("  2. Fix the RPC SQL in the migration file");
  log("  3. Apply the fix:  docker exec supabase_db_supabase-debug-playground psql -U postgres -c '<fixed sql>'  (or supabase db reset)");
log("  4. pnpm ep2:verify");
hr();
