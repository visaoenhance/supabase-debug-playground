/**
 * EP3 — verify.ts
 *
 * PASS criteria:
 *   ✔ Insert with .select().throwOnError() returns a row (non-null data)
 *   ✔ Returned row contains `id` and `title`
 *   ✔ No uncaught error
 *
 * This script also checks whether scripts/ep3_crud.ts still has the broken
 * patch, and reports it as a warning.
 */

import { join } from "node:path";
import { fileContains } from "../_shared/patch.js";
import { serviceClient, c, log, hr, ok, fail, step, warn, labelledJson } from "../../utils.js";

async function main() {
hr();
log(c.bold(c.green("EP3 VERIFY — CRUD insert with .select() + throwOnError()")));
hr();

// ── 1. Check whether the break patch is still in ep3_crud.ts ─────────────────

const crudScript = join(process.cwd(), "scripts", "ep3_crud.ts");
const BREAK_MARKER = "❌ BREAK: .select() and .throwOnError() removed";

if (fileContains(crudScript, BREAK_MARKER)) {
  warn("scripts/ep3_crud.ts still contains the break patch.");
  warn("Fix goodInsert: restore .select() and .throwOnError(), then re-run.");
  log("");
}

// ── 2. Run the correct insert pattern directly ────────────────────────────────

const supabase = serviceClient();

step("Insert", ".insert({ title, amount }).select().throwOnError()");

let passed = true;
let data: unknown = null;

try {
  const result = await supabase
    .from("receipts")
    .insert({ title: "EP3 verify receipt", amount: 42.00 })
    .select()
    .throwOnError();

  data = result.data;
} catch (err) {
  fail(`Insert threw: ${err instanceof Error ? err.message : String(err)}`);
  passed = false;
}

log("");

if (data && Array.isArray(data) && data.length > 0) {
  const row = data[0] as { id: string; title: string; amount: number };
  ok(`Row returned — id: ${row.id}`);
  ok(`Title: "${row.title}"`);
  ok(`Amount: ${row.amount}`);
  labelledJson("Full row", row);
} else if (data !== null) {
  labelledJson("Returned data", data);
  ok("Data returned");
} else {
  fail("data is null — .select() may not have been chained");
  passed = false;
}

// ── 3. Extra: confirm ep3_crud.ts is clean ───────────────────────────────────

if (!fileContains(crudScript, BREAK_MARKER)) {
  ok("scripts/ep3_crud.ts is clean (break patch not present)");
} else {
  fail("scripts/ep3_crud.ts still has the break patch — fix goodInsert");
  passed = false;
}

hr();
if (passed) {
  log(c.bold(c.green("✔  EP3 PASSED")));
} else {
  log(c.bold(c.red("✘  EP3 FAILED — fix goodInsert in scripts/ep3_crud.ts then re-run")));
  process.exit(1);
}
hr();
}

main();
