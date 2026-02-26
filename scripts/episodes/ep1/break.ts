/**
 * EP1 — break.ts
 *
 * What it does:
 *   Overwrites supabase/functions/echo/index.ts with the intentionally broken
 *   version (index.broken.ts).  Bugs introduced:
 *     1. Reads REQUIRED_API_SECRET which is never set → undefined.length throws
 *     2. No try/catch → opaque 500 with empty body
 *     3. No request_id → impossible to correlate client error to function log
 *
 * Reset: `pnpm ep1:reset` (git checkout restores index.ts)
 */

import { join } from "node:path";
import { swapFile } from "../_shared/patch.js";
import { c, log, hr, ok, warn } from "../../utils.js";

const ROOT         = process.cwd();
const ECHO_DIR     = join(ROOT, "supabase", "functions", "echo");
const BROKEN_SRC   = join(ECHO_DIR, "index.broken.ts");
const TARGET       = join(ECHO_DIR, "index.ts");

hr();
log(c.bold(c.yellow("EP1 BREAK — injecting broken edge function")));
hr();

const status = swapFile(BROKEN_SRC, TARGET);

if (status === "already-applied") {
  warn("index.ts already contains the broken version — skipping (idempotent).");
} else {
  ok("supabase/functions/echo/index.ts  ← overwritten with broken version");
  log("");
  log("Bugs injected:");
  log(c.red("  1. Deno.env.get('REQUIRED_API_SECRET') → undefined"));
  log(c.red("  2. undefined.length  → TypeError on every request"));
  log(c.red("  3. No try/catch      → naked 500, no JSON body"));
  log(c.red("  4. No request_id     → untrackable in logs"));
}

log("");
log("Next steps:");
log("  1. Restart the function server (Ctrl-C & re-run `supabase functions serve --no-verify-jwt`)");
log("  2. pnpm ep1:run  — see the failure");
log("  3. Fix index.ts in your IDE");
log("  4. pnpm ep1:run  — confirm it passes");
log("  5. pnpm ep1:verify");
hr();
