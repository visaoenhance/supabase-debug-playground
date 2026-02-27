/**
 * reset.ts — Returns the entire playground to a known-good baseline
 *
 * Actions:
 *   1. Restore supabase/functions/echo/index.ts from baseline backup
 *   2. Apply the fixed RPC function (ep2 fix)
 *   3. Disable RLS on receipts (baseline state for ep4)
 *   4. Drop the `notes` column added by ep5
 *   5. Clear the playground state file
 *   6. Run `supabase db reset` to re-seed the database
 */

import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { c, log, hr, step, ok, fail, warn } from "./utils.js";

const FUNCTIONS_DIR = join(process.cwd(), "supabase", "functions", "echo");
const GOOD_SRC      = join(FUNCTIONS_DIR, "index.ts"); // kept for reference in log output
const STATE_FILE    = join(process.cwd(), ".playground-state.json");
const TYPES_FILE    = join(process.cwd(), "supabase", "types.gen.ts");

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

function runSql(sql: string, label: string) {
  step("SQL", label);
  try {
    execSync(
      `docker exec -i ${DB_CONTAINER} psql -U postgres`,
      { input: sql, stdio: ["pipe", "inherit", "inherit"] }
    );
    ok("done");
  } catch (err) {
    warn(`SQL step failed (continuing): ${err instanceof Error ? err.message : String(err)}`);
  }
}

function resetEchoFunction() {
  step("File", "Restoring echo/index.ts via git checkout");
  try {
    execSync("git checkout -- supabase/functions/echo/index.ts", { stdio: "inherit" });
    ok(`echo/index.ts restored to committed version: ${GOOD_SRC}`);
  } catch (err) {
    warn(
      `git checkout failed — is this a git repo?\n` +
      `  ${err instanceof Error ? err.message : String(err)}\n` +
      "  If the function file looks broken, manually compare it to index.broken.ts."
    );
  }
}

function resetRpc() {
  const sql = `
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
  raise notice 'create_receipt » title=%, amount=%', title, amount;
  insert into public.receipts (title, amount)
  values (title, amount)
  returning * into new_receipt;
  raise notice 'create_receipt » created id=%', new_receipt.id;
  return new_receipt;
end;
$$;
`;
  runSql(sql, "Restoring create_receipt RPC to fixed version (ep2)");
}

function resetRls() {
  const sql = `
-- Ensure INSERT policy exists
create policy if not exists "receipts: authenticated insert"
  on public.receipts
  for insert
  with check (auth.role() = 'authenticated');

-- Disable RLS to match baseline (episodes 1-3 don't need it)
alter table public.receipts disable row level security;
`;
  runSql(sql, "Restoring RLS baseline (disabled) on receipts (ep4)");
}

function resetSchema() {
  const sql = `alter table public.receipts drop column if exists notes;`;
  runSql(sql, "Dropping `notes` column if present (ep5)");
}

function clearStateFile() {
  step("File", "Clearing .playground-state.json");
  try {
    if (existsSync(STATE_FILE)) {
      unlinkSync(STATE_FILE);
      ok(".playground-state.json removed");
    } else {
      ok(".playground-state.json not present (already clean)");
    }
  } catch (err) {
    warn(`Could not remove state file: ${String(err)}`);
  }
}

function clearTypesFile() {
  step("File", "Removing stale supabase/types.gen.ts (if present)");
  try {
    if (existsSync(TYPES_FILE)) {
      unlinkSync(TYPES_FILE);
      ok("types.gen.ts removed");
    } else {
      ok("types.gen.ts not present (already clean)");
    }
  } catch (err) {
    warn(`Could not remove types file: ${String(err)}`);
  }
}

function dbReset() {
  step("CLI", "supabase db reset  (re-runs all migrations + seed)");
  try {
    execSync("supabase db reset", { stdio: "inherit" });
    ok("Database reset complete");
  } catch (err) {
    fail(
      "supabase db reset failed — is Supabase running?\n" +
      "  Run `pnpm supabase:start` first."
    );
    process.exit(1);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

hr();
log(c.bold(c.cyan("▶ RESET — returning playground to known-good baseline")));
hr();

resetEchoFunction();
resetRls();
resetSchema();
resetRpc();
clearStateFile();
clearTypesFile();
dbReset();

hr();
log(c.bold(c.green("✔  Reset complete.  All episodes are back to baseline.")));
log("");
log("Next steps:");
log("  1. Copy .env.example → .env and fill in keys from `pnpm supabase:start`");
log("  2. Start with Episode 1:  pnpm ep1:break  →  pnpm ep1:run  →  pnpm ep1:verify");
hr();
