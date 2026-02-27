/**
 * EP1 — fix.ts
 *
 * What it does:
 *   Overwrites supabase/functions/echo/index.ts with the pre-built annotated
 *   fix (index.fixed.ts).  Each fix is commented inline so viewers can see
 *   exactly what changed and why.
 *
 *   Fixes applied:
 *     1. Removes the unguarded Deno.env.get() + .length access (BUG 1 + 2)
 *     2. Adds request_id minted from header or crypto.randomUUID() (BUG 3)
 *     3. Wraps handler in try/catch returning structured JSON errors (BUG 2)
 *
 * Usage:
 *   pnpm ep1:fix    — apply the fix (use during demo after showing the bugs)
 *   pnpm ep1:run    — confirm HTTP 200 + request_id in response
 *   pnpm ep1:verify — assert all pass criteria
 *   pnpm ep1:reset  — restore repo to known-good state
 */

import { join } from "node:path";
import { swapFile } from "../_shared/patch.js";
import { c, log, hr, ok, warn } from "../../utils.js";

const ROOT       = process.cwd();
const ECHO_DIR   = join(ROOT, "supabase", "functions", "echo");
const FIXED_SRC  = join(ECHO_DIR, "index.fixed.ts");
const TARGET     = join(ECHO_DIR, "index.ts");

hr();
log(c.bold(c.green("EP1 FIX — applying annotated fix to echo edge function")));
hr();

const status = swapFile(FIXED_SRC, TARGET);

if (status === "already-applied") {
  warn("index.ts already matches the fixed version — skipping (idempotent).");
} else {
  ok("supabase/functions/echo/index.ts  ← overwritten with fixed version");
  log("");
  log("Fixes applied:");
  log(c.green("  1. Removed unguarded Deno.env.get() + .length access  (was BUG 1 + 2)"));
  log(c.green("  2. Added request_id minted at top of every request     (was BUG 3)"));
  log(c.green("  3. Wrapped handler in try/catch → JSON error response  (was BUG 2)"));
  log("");
  log(c.grey("  Open supabase/functions/echo/index.ts to see inline comments explaining each change."));
}

log("");
log("Next steps:");
log("  1. pnpm ep1:run    — confirm HTTP 200 + request_id in response body");
log("  2. pnpm ep1:verify — run pass/fail assertions");
log("  3. pnpm ep1:reset  — restore repo to clean state");
hr();
