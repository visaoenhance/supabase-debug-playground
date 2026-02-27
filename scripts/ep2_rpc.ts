/**
 * Episode 2 — RPC Debugging
 * ─────────────────────────────────────────────────────────────────────────────
 * The `create_receipt` function lives in the database.  This episode covers
 * diagnosing errors that come back from `.rpc()` calls.
 *
 * BREAK  : Replaces the function with a broken version that references a
 *          non-existent column (`titl` instead of `title`), causing a
 *          PG "column does not exist" error on every call.
 *
 * RUN    : Calls the RPC and prints every field of the Supabase error object
 *          so viewers see exactly where to look.
 *
 * VERIFY : Calls the correct RPC and asserts a receipt is returned.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  parseMode,
  anonClient,
  c, log, hr, step, ok, fail, warn, labelledJson,
} from "./utils.js";
import { execSync } from "node:child_process";

// ── SQL fragments ────────────────────────────────────────────────────────────

const BROKEN_RPC_SQL = `
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
  raise notice 'create_receipt (BROKEN) called with title=%, amount=%', title, amount;

  -- ❌ BUG: column name is "titl" — does not exist in receipts
  insert into public.receipts (titl, amount)
  values (title, amount)
  returning * into new_receipt;

  return new_receipt;
end;
$$;
`;

const FIXED_RPC_SQL = `
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

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

function applySql(sql: string, label: string) {
  step("SQL", label);
  log(c.grey(sql.trim()));
  try {
    execSync(
      `docker exec -i ${DB_CONTAINER} psql -U postgres`,
      { input: sql, stdio: ["pipe", "inherit", "inherit"] }
    );
    ok("SQL applied");
  } catch (err) {
    fail(`Failed to apply SQL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ── modes ────────────────────────────────────────────────────────────────────

function doBreak() {
  hr();
  log(c.bold(c.yellow("▶ EP2 BREAK — injecting broken RPC (bad column name)")));
  hr();

  log("  Bug introduced:");
  log(c.red("    INSERT uses column `titl` — column does not exist in receipts"));
  log(c.red("    Every call to create_receipt() will return PostgreSQL error 42703"));
  log("");

  applySql(BROKEN_RPC_SQL, "Replacing create_receipt with broken version");

  log("");
  warn("Run `pnpm ep2:run` to see the RPC error detail.");
}

async function doRun() {
  hr();
  log(c.bold(c.cyan("▶ EP2 RUN — calling create_receipt RPC")));
  hr();

  const supabase = anonClient();
  const args = { title: "Debug receipt", amount: 9.99 };

  step("RPC", "supabase.rpc('create_receipt', args)");
  labelledJson("Arguments", args);

  const { data, error } = await supabase.rpc("create_receipt", args);

  hr();
  if (error) {
    fail("RPC returned an error (this may be intentional in break mode)");
    log("");
    log(c.bold("Full error object from Supabase:"));
    log(`  ${c.bold("message")}  : ${c.red(error.message)}`);
    log(`  ${c.bold("code")}     : ${c.yellow(error.code ?? "(none)")}`);
    log(`  ${c.bold("details")}  : ${error.details ?? "(none)"}`);
    log(`  ${c.bold("hint")}     : ${error.hint ?? "(none)"}`);
    log("");
    log(c.bold("What to check:"));
    log("  1. error.code 42703  → column does not exist in INSERT");
    log("  2. error.message     → tells you the exact column name Postgres rejected");
    log("  3. Fix: look at the function SQL and correct the column name");
    log("  4. Then run: pnpm ep2:verify");
  } else {
    ok("RPC succeeded (function is in fixed state)");
    labelledJson("Returned receipt", data);
    log("  → Run `pnpm ep2:verify` to confirm fully.");
  }
  hr();
}

async function doVerify() {
  hr();
  log(c.bold(c.green("▶ EP2 VERIFY — applying fixed RPC and confirming success")));
  hr();

  applySql(FIXED_RPC_SQL, "Restoring correct create_receipt function");

  const supabase = anonClient();
  const args = { title: "Verify receipt", amount: 1.23 };

  step("RPC", "calling create_receipt with fixed SQL");
  const { data, error } = await supabase.rpc("create_receipt", args);

  let passed = true;

  if (error) {
    fail(`RPC still errors: ${error.message}`);
    passed = false;
  } else {
    ok("RPC returned data with no error");
  }

  if (data && typeof data === "object" && "id" in data) {
    ok(`Receipt created with id: ${(data as { id: string }).id}`);
  } else {
    fail("Response data missing expected `id` field");
    passed = false;
  }

  if (data && typeof data === "object" && "title" in data) {
    ok(`Title field present: "${(data as { title: string }).title}"`);
  } else {
    fail("Response data missing `title` field");
    passed = false;
  }

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP2 PASSED — RPC working correctly with RAISE NOTICE logging.")));
    log(c.grey("  Tip: run `supabase db logs` to see the RAISE NOTICE output."));
  } else {
    log(c.bold(c.red("✘  EP2 FAILED — see issues above.")));
    process.exit(1);
  }
  hr();
}

// ── entry ────────────────────────────────────────────────────────────────────

const mode = parseMode();
if      (mode === "break")  doBreak();
else if (mode === "run")    doRun();
else if (mode === "verify") doVerify();
