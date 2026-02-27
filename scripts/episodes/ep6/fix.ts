/**
 * EP6 — fix.ts
 *
 * What it does:
 *   Deploys the annotated fixed version of the `echo` edge function
 *   (index.fixed.ts) to the real Supabase project configured in .env.
 *
 *   Fixes applied (same as EP1):
 *     1. Removed unguarded Deno.env.get() + .length access
 *     2. Added request_id minted at top of every request
 *     3. Wrapped handler in try/catch → JSON error response
 *
 * Requires: SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN in .env
 */

import "dotenv/config";
import { join }      from "node:path";
import { execSync }  from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const ROOT      = process.cwd();
const ECHO_DIR  = join(ROOT, "supabase", "functions", "echo");
const FIXED_SRC = join(ECHO_DIR, "index.fixed.ts");
const TARGET    = join(ECHO_DIR, "index.ts");
const BACKUP    = join(ECHO_DIR, "index.ts.pre-ep6-fix");

const PROJECT_REF  = process.env.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

// ── Pre-flight ────────────────────────────────────────────────────────────────

hr();
log(c.bold(c.green("EP6 FIX — deploying fixed echo to production")));
hr();

const missing: string[] = [];
if (!PROJECT_REF)  missing.push("SUPABASE_PROJECT_REF");
if (!ACCESS_TOKEN) missing.push("SUPABASE_ACCESS_TOKEN");

if (missing.length) {
  fail("Missing required env vars:");
  for (const v of missing) fail(`  ${v}`);
  process.exit(1);
}

if (!existsSync(FIXED_SRC)) {
  fail(`Cannot find fixed source: ${FIXED_SRC}`);
  log("Run pnpm ep1:reset first to ensure supabase/functions/echo/ is intact.");
  process.exit(1);
}

// ── Swap & deploy ─────────────────────────────────────────────────────────────

step("FILE", "Backing up current index.ts");
copyFileSync(TARGET, BACKUP);
ok("Backup saved: index.ts.pre-ep6-fix");

step("FILE", "Copying index.fixed.ts → index.ts");
copyFileSync(FIXED_SRC, TARGET);
ok("index.ts overwritten with fixed version");

log("");
log("Fixes being deployed:");
log(c.green("  1. Removed unguarded Deno.env.get() + .length access  (was BUG 1 + 2)"));
log(c.green("  2. Added request_id minted at top of every request     (was BUG 3)"));
log(c.green("  3. Wrapped handler in try/catch → JSON error response  (was BUG 2)"));
log("");
log(c.grey("  Open supabase/functions/echo/index.ts to see inline comments explaining each change."));
log("");

step("DEPLOY", `supabase functions deploy echo --project-ref ${PROJECT_REF}`);

try {
  execSync(
    `supabase functions deploy echo --project-ref ${PROJECT_REF}`,
    { stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: ACCESS_TOKEN } }
  );
  ok("Fixed echo deployed to production");
} catch (err) {
  fail("Deploy failed");
  fail(`  ${err instanceof Error ? err.message : String(err)}`);
  log("");
  log("Restoring index.ts from backup...");
  copyFileSync(BACKUP, TARGET);
  process.exit(1);
}

// ── Restore local file ────────────────────────────────────────────────────────

step("FILE", "Restoring local index.ts from backup");
copyFileSync(BACKUP, TARGET);
ok("Local index.ts restored — production has the fixed version, local is unchanged");

log("");
log("Next steps:");
log("  1. pnpm ep6:run    — confirm HTTP 200 + request_id in response body");
log("  2. pnpm ep6:verify — run pass/fail assertions against production URL");
log("  3. pnpm ep6:reset  — redeploy known-good version and clean up");
hr();
