/**
 * EP9 — fix.ts
 *
 * Replaces get_my_notes() with a hardened version that includes:
 *   1. auth.uid() null guard — raises explicit PT401 when unauthenticated
 *   2. Explicit search_path — prevents search path injection
 *   3. Schema-qualified object references
 *   4. EXECUTE revoked from anon, granted only to authenticated role
 */

import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

const FIX_SQL = `
-- ✅ FIX: hardened get_my_notes() function
create or replace function public.get_my_notes()
returns setof public.user_notes
language plpgsql
security invoker
set search_path = public, auth
as $$
begin
  -- ✅ GUARD: raise explicit error when caller has no session
  if auth.uid() is null then
    raise exception 'not authenticated'
      using errcode = 'PT401',
            hint    = 'Sign in before calling get_my_notes()';
  end if;

  return query
    select *
    from public.user_notes
    where author_id = auth.uid();
end;
$$;

-- ✅ GRANTS: revoke from anon, allow only authenticated callers
revoke execute on function public.get_my_notes() from public, anon;
grant  execute on function public.get_my_notes() to authenticated;
`;

hr();
log(c.bold(c.green("EP9 FIX — hardening get_my_notes() RPC")));
hr();

log("Fix applied:");
log(c.green("  1. auth.uid() null guard  → raises PT401 when unauthenticated"));
log(c.green("  2. search_path = public, auth  → prevents search path injection"));
log(c.green("  3. REVOKE EXECUTE FROM anon  → enforces caller must be authenticated"));
log(c.green("  4. GRANT EXECUTE TO authenticated  → explicit, scoped permission"));
log("");

step("SQL", "Applying hardened function via docker exec psql");

try {
  execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres`,
    { input: FIX_SQL, stdio: ["pipe", "inherit", "inherit"] }
  );
  ok("Hardened get_my_notes() applied");
} catch (err) {
  fail(`SQL failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

log("");
log("Next steps:");
log("  • pnpm ep9:verify — run the full assertion suite");
hr();
