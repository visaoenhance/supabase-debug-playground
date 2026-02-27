/**
 * EP6 — reset.ts
 *
 * What it does:
 *   Restores supabase/functions/echo/index.ts to the committed baseline
 *   (git checkout) then deploys it to the production project, ensuring the
 *   known-good fixed version is live.
 *
 * Requires: SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN in .env
 */

import "dotenv/config";
import { execSync }  from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const PROJECT_REF  = process.env.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

hr();
log(c.bold(c.cyan("EP6 RESET — restoring known-good echo + redeploying")));
hr();

const missing: string[] = [];
if (!PROJECT_REF)  missing.push("SUPABASE_PROJECT_REF");
if (!ACCESS_TOKEN) missing.push("SUPABASE_ACCESS_TOKEN");

if (missing.length) {
  fail("Missing required env vars:");
  for (const v of missing) fail(`  ${v}`);
  process.exit(1);
}

// ── Restore local file ────────────────────────────────────────────────────────

step("GIT", "git checkout -- supabase/functions/echo/index.ts");
try {
  execSync("git checkout -- supabase/functions/echo/index.ts", { stdio: "inherit" });
  ok("supabase/functions/echo/index.ts restored from git");
} catch (err) {
  fail(`git checkout failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

// ── Deploy known-good ─────────────────────────────────────────────────────────

step("DEPLOY", `supabase functions deploy echo --project-ref ${PROJECT_REF}`);
try {
  execSync(
    `supabase functions deploy echo --project-ref ${PROJECT_REF}`,
    { stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: ACCESS_TOKEN } }
  );
  ok("Known-good echo deployed to production");
} catch (err) {
  fail(`Deploy failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

log("");
log("EP6 reset complete. Production is now running the known-good echo function.");
hr();
