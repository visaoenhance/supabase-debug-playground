/**
 * EP6 — break.ts
 *
 * What it does:
 *   Deploys the broken version of the `echo` edge function (index.broken.ts)
 *   to the real Supabase project configured in .env.
 *
 *   Bugs deployed (same as EP1):
 *     1. Reads REQUIRED_API_SECRET which is never set → undefined.length throws
 *     2. No try/catch → opaque 500 with empty body
 *     3. No request_id → impossible to correlate client error to function log
 *
 *   This simulates a regression: the broken version was accidentally deployed
 *   instead of the fixed version from EP1.
 *
 * Reset: `pnpm ep6:reset` → redeploys the known-good (fixed) version
 *
 * Requires: SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN in .env
 */

import "dotenv/config";
import { join }      from "node:path";
import { execSync }  from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { c, log, hr, ok, warn, fail, step } from "../../utils.js";

const ROOT       = process.cwd();
const ECHO_DIR   = join(ROOT, "supabase", "functions", "echo");
const BROKEN_SRC = join(ECHO_DIR, "index.broken.ts");
const TARGET     = join(ECHO_DIR, "index.ts");
const BACKUP     = join(ECHO_DIR, "index.ts.pre-ep6-break");

const PROJECT_REF      = process.env.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN     = process.env.SUPABASE_ACCESS_TOKEN;

// ── Pre-flight ────────────────────────────────────────────────────────────────

hr();
log(c.bold(c.yellow("EP6 BREAK — deploying broken echo to production")));
hr();

const missing: string[] = [];
if (!PROJECT_REF)  missing.push("SUPABASE_PROJECT_REF");
if (!ACCESS_TOKEN) missing.push("SUPABASE_ACCESS_TOKEN");

if (missing.length) {
  fail("Missing required env vars:");
  for (const v of missing) fail(`  ${v}`);
  log("");
  log("Add them to your .env file:");
  log("  SUPABASE_PROJECT_REF   — from Supabase project settings");
  log("  SUPABASE_ACCESS_TOKEN  — from supabase.com/dashboard/account/tokens");
  process.exit(1);
}

if (!existsSync(BROKEN_SRC)) {
  fail(`Cannot find broken source: ${BROKEN_SRC}`);
  log("Run pnpm ep1:reset first to ensure supabase/functions/echo/ is intact.");
  process.exit(1);
}

// ── Swap & deploy ─────────────────────────────────────────────────────────────

step("FILE", "Backing up current index.ts");
copyFileSync(TARGET, BACKUP);
ok(`Backup saved: index.ts.pre-ep6-break`);

step("FILE", "Copying index.broken.ts → index.ts");
copyFileSync(BROKEN_SRC, TARGET);
ok("index.ts overwritten with broken version");

log("");
log("Bugs being deployed:");
log(c.red("  1. Deno.env.get('REQUIRED_API_SECRET') → undefined"));
log(c.red("  2. undefined.length  → TypeError on every request"));
log(c.red("  3. No try/catch      → naked 500, no JSON body"));
log(c.red("  4. No request_id     → untrackable in logs"));
log("");

step("DEPLOY", `supabase functions deploy echo --no-verify-jwt --project-ref ${PROJECT_REF}`);

try {
  execSync(
    `supabase functions deploy echo --no-verify-jwt --project-ref ${PROJECT_REF}`,
    { stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: ACCESS_TOKEN } }
  );
  ok("Broken echo deployed to production");
} catch (err) {
  fail("Deploy failed");
  fail(`  ${err instanceof Error ? err.message : String(err)}`);
  log("");
  log("Restoring index.ts from backup...");
  copyFileSync(BACKUP, TARGET);
  log("Restored. Check that SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are correct.");
  process.exit(1);
}

// ── Restore local file ────────────────────────────────────────────────────────

step("FILE", "Restoring local index.ts from backup");
copyFileSync(BACKUP, TARGET);
ok("Local index.ts restored — production has the broken version, local is unchanged");

log("");
log("Next steps:");
log("  1. pnpm ep6:run    — reproduce the 500 failure against the production URL");
log("  2. Check production logs:");
log(c.cyan(`     supabase functions logs echo --project-ref ${PROJECT_REF}`));
log("  3. pnpm ep6:fix    — deploy the fixed version");
log("  4. pnpm ep6:run    — confirm HTTP 200 + request_id");
log("  5. pnpm ep6:verify");
hr();
