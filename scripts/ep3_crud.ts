/**
 * Episode 3 — CRUD "Did it save?"
 * ─────────────────────────────────────────────────────────────────────────────
 * A surprisingly common Supabase footgun: inserting data, getting no error
 * back, and assuming it worked — only to discover later that you ignored
 * a PostgREST error or that the row was never returned.
 *
 * BREAK  : Inserts without .select() and without throwOnError; swallows the
 *          error silently.  The "success" log line fires even when the insert
 *          actually failed.
 *
 * RUN    : Shows the ambiguous output: "Insert succeeded" printed, but data
 *          is null. Viewers can clearly see the confusion.
 *
 * VERIFY : Same insert with .select() + throwOnError; prints the row id and
 *          count, leaving no ambiguity.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  parseMode,
  anonClient, serviceClient,
  c, log, hr, step, ok, fail, warn, labelledJson, writeState, readState,
} from "./utils.js";
import { execSync } from "node:child_process";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Force a situation where no .select() is used and error is ignored */
async function brokenInsert(title: string, amount: number) {
  const supabase = serviceClient(); // use service role so RLS isn't the issue

  // ❌ BUG 1: no .select() → data will be null even on success
  // ❌ BUG 2: error is destructured but never checked
  const { data, error } = await supabase
    .from("receipts")
    .insert({ title, amount });

  // ❌ BUG 3: naive "success" check — data is null by design when no .select()
  if (!error) {
    // This fires even when the insert fails if we ignore the error!
    console.log("✔ Insert succeeded");
  }

  return { data, error };
}

/** Correct insert with .select() and explicit error handling */
async function goodInsert(title: string, amount: number) {
  const supabase = serviceClient();

  const { data, error } = await supabase
    .from("receipts")
    .insert({ title, amount })
    .select()          // ✅ FIX: returns the inserted row(s) — data will not be null
    .throwOnError();   // ✅ FIX: throws on any DB error — no more silent failures

  return { data, error };
}

// ── modes ────────────────────────────────────────────────────────────────────

async function doBreak() {
  hr();
  log(c.bold(c.yellow("▶ EP3 BREAK — enabling ambiguous CRUD pattern")));
  hr();

  log("  Bugs in the broken pattern:");
  log(c.red("    1. .insert() without .select()  → data is always null on success"));
  log(c.red("    2. error destructured but never acted upon"));
  log(c.red("    3. success printed based on !error, but error could be silently ignored"));
  log(c.red("    4. impossible to know if the row was actually saved or what its id is"));
  log("");

  // Save a flag so run knows to call the broken path
  writeState({ ep3_mode: "broken" });

  ok("Broken mode saved to .playground-state.json");
  warn("Run `pnpm ep3:run` to watch the ambiguous output.");
}

async function doRun() {
  hr();
  log(c.bold(c.cyan("▶ EP3 RUN — demonstrating ambiguous CRUD output")));
  hr();

  const state = readState();
  const isBroken = state["ep3_mode"] === "broken";

  if (isBroken) {
    warn("Running in BROKEN mode (no .select(), error ignored)");
    log("");

    step("Insert", "receipts.insert({ title, amount })  ← no .select()");

    const { data, error } = await brokenInsert("EP3 broken receipt", 0.01);

    hr();
    log(c.bold("Raw supabase-js response:"));
    log(`  data  : ${c.yellow(JSON.stringify(data))}`);
    log(`  error : ${error ? c.red(JSON.stringify(error)) : c.green("null")}`);
    log("");

    if (data === null && !error) {
      warn('data is null AND error is null — classic "did it save?" confusion');
      warn("You have no row id. You cannot confirm the insert. You are guessing.");
    }

    log("");
    log(c.bold("What happened?"));
    log("  PostgREST returns 204 No Content when no .select() is provided.");
    log("  supabase-js maps 204 → { data: null, error: null }.");
    log("  You can't tell success from failure without checking the database directly.");
    log("");
    warn("Fix: add .select() and .throwOnError() — then run `pnpm ep3:verify`.");
  } else {
    warn("Mode is not 'broken'. Run `pnpm ep3:break` first to see the bad pattern.");
    warn("Showing the GOOD pattern instead...");
    log("");
    await doVerify();
  }
  hr();
}

async function doVerify() {
  hr();
  log(c.bold(c.green("▶ EP3 VERIFY — explicit insert with .select() + throwOnError()")));
  hr();

  let passed = true;

  step("Insert", "receipts.insert().select().throwOnError()");

  let data: unknown = null;
  try {
    const result = await goodInsert("EP3 verified receipt", 42.00);
    data = result.data;
  } catch (err) {
    fail(`Insert threw: ${err instanceof Error ? err.message : String(err)}`);
    passed = false;
  }

  if (data && Array.isArray(data) && data.length > 0) {
    const row = data[0] as { id: string; title: string; amount: number };
    ok(`Row returned — id: ${row.id}`);
    ok(`Title: "${row.title}"`);
    ok(`Amount: ${row.amount}`);
    ok(`Affected rows: ${data.length}`);
    labelledJson("Full returned row", row);
  } else if (data !== null) {
    labelledJson("Returned data", data);
    ok("Data returned (non-array shape)");
  } else {
    fail("No data returned — .select() may not have been chained");
    passed = false;
  }

  // Reset the mode flag
  writeState({ ep3_mode: "verified" });

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP3 PASSED — insert confirmed with row id and .select().")));
  } else {
    log(c.bold(c.red("✘  EP3 FAILED — see issues above.")));
    process.exit(1);
  }
  hr();
}

// ── entry ────────────────────────────────────────────────────────────────────

const mode = parseMode();
if      (mode === "break")  doBreak();
else if (mode === "run")    doRun();
else if (mode === "verify") doVerify();
