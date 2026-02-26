/**
 * EP2 — verify.ts
 *
 * PASS criteria:
 *   ✔ rpc('create_receipt') returns no error
 *   ✔ returned object contains an `id` field (UUID)
 *   ✔ returned object contains the `title` we sent
 */

import { anonClient, c, log, hr, ok, fail, step, labelledJson } from "../../utils.js";

async function main() {
hr();
log(c.bold(c.green("EP2 VERIFY — create_receipt RPC")));
hr();

const supabase = anonClient();
const args     = { title: "EP2 verify receipt", amount: 9.99 };

step("RPC", "supabase.rpc('create_receipt', args)");
labelledJson("Arguments", args);

let passed = true;

const { data, error } = await supabase.rpc("create_receipt", args);

log("");
if (error) {
  fail("RPC returned an error:");
  log(`  code    : ${c.yellow(error.code ?? "(none)")}`);
  log(`  message : ${c.red(error.message)}`);
  log(`  hint    : ${error.hint ?? "(none)"}`);
  log("");
  log("  If code is 42703 — the broken SQL is still active.");
  log("  Fix: correct the column name then run `supabase db reset` or re-apply fixed SQL.");
  passed = false;
} else {
  ok("RPC returned data with no error");
  labelledJson("Receipt", data);
}

if (!error && data && typeof data === "object" && "id" in data) {
  ok(`id present: ${(data as { id: string }).id}`);
} else if (!error) {
  fail("Response missing `id` field");
  passed = false;
}

if (!error && data && typeof data === "object" && "title" in data) {
  ok(`title present: "${(data as { title: string }).title}"`);
} else if (!error) {
  fail("Response missing `title` field");
  passed = false;
}

hr();
if (passed) {
  log(c.bold(c.green("✔  EP2 PASSED")));
} else {
  log(c.bold(c.red("✘  EP2 FAILED — fix the RPC SQL then re-run pnpm ep2:verify")));
  process.exit(1);
}
hr();
}

main();
