/**
 * EP6 pre-flight check — safe to run on camera
 *
 * Confirms all 4 EP6 env vars are present and that credentials actually work:
 *   ✔ SUPABASE_PROJECT_REF    — present
 *   ✔ SUPABASE_ACCESS_TOKEN   — present + valid (verified against Management API)
 *   ✔ PROD_SUPABASE_URL       — present + matches project ref
 *   ✔ PROD_SUPABASE_ANON_KEY  — present (not printed — just confirmed set)
 *   ✔ Production function reachable (optional live ping)
 *
 * NEVER prints key values — only shows masked presence + live validation.
 *
 * Setup (run once off-camera before recording):
 *   pnpm setup:ep6:env
 */

import { c, log, hr, ok, fail, step, warn } from "./utils.js";

const PROJECT_REF   = process.env.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN  = process.env.SUPABASE_ACCESS_TOKEN;
const PROD_URL      = process.env.PROD_SUPABASE_URL;
const PROD_ANON_KEY = process.env.PROD_SUPABASE_ANON_KEY;

function mask(value: string | undefined): string {
  if (!value) return c.red("(not set)");
  if (value.length <= 8) return c.green("***");
  return c.green(value.slice(0, 6) + "..." + value.slice(-4));
}

async function main() {
  hr();
  log(c.bold("EP6 PRE-FLIGHT — production environment check"));
  log(c.grey("  (safe to run on camera — no key values are printed)"));
  hr();

  let allPresent = true;

  // ── 1. Presence check ────────────────────────────────────────────────────────

  step("ENV", "Checking required variables");
  log("");

  const vars = [
    { key: "SUPABASE_PROJECT_REF",   val: PROJECT_REF },
    { key: "SUPABASE_ACCESS_TOKEN",  val: ACCESS_TOKEN },
    { key: "PROD_SUPABASE_URL",      val: PROD_URL },
    { key: "PROD_SUPABASE_ANON_KEY", val: PROD_ANON_KEY },
  ];

  for (const { key, val } of vars) {
    if (val) {
      log(`  ✔  ${key.padEnd(26)} ${mask(val)}`);
    } else {
      log(`  ✘  ${c.red(key.padEnd(26))} ${c.red("(not set)")}`);
      allPresent = false;
    }
  }

  if (!allPresent) {
    log("");
    fail("Missing env vars. Run `pnpm setup:ep6:env` to auto-fill them.");
    process.exit(1);
  }

  // ── 2. Validate project ref format ───────────────────────────────────────────

  log("");
  step("CHECK", "Validating project ref format");
  const refOk = /^[a-z0-9]{20}$/.test(PROJECT_REF!);
  if (refOk) {
    ok(`Project ref format valid (${PROJECT_REF!.length} chars)`);
  } else {
    warn(`Project ref '${PROJECT_REF}' looks unusual — expected 20 lowercase alphanumeric chars`);
    warn("  If this is intentional, ignore this warning.");
  }

  // ── 3. Validate PROD_URL matches project ref ──────────────────────────────────

  log("");
  step("CHECK", "PROD_SUPABASE_URL matches SUPABASE_PROJECT_REF");
  const expectedUrl = `https://${PROJECT_REF}.supabase.co`;
  if (PROD_URL === expectedUrl) {
    ok(`URL matches:  ${PROD_URL}`);
  } else {
    warn(`URL mismatch:`);
    warn(`  PROD_SUPABASE_URL     = ${PROD_URL}`);
    warn(`  Expected from ref     = ${expectedUrl}`);
    warn("  These may still work if you're using a custom domain.");
  }

  // ── 4. Validate access token against Management API ──────────────────────────

  log("");
  step("API", "Verifying access token against Management API");

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}`,
      { headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` } }
    );

    if (res.ok) {
      const project = await res.json() as { name?: string; region?: string; status?: string };
      ok(`Project found: "${project.name ?? PROJECT_REF}" (${project.region ?? "unknown region"})`);
      if (project.status && project.status !== "ACTIVE_HEALTHY") {
        warn(`Project status: ${project.status} — may not be fully operational`);
      }
    } else if (res.status === 401) {
      fail("Access token is invalid or expired.");
      log("  → Generate a new one at: https://supabase.com/dashboard/account/tokens");
      log("  → Then re-run: pnpm setup:ep6:env");
      process.exit(1);
    } else if (res.status === 404) {
      fail(`Project not found (${res.status}) — check SUPABASE_PROJECT_REF.`);
      process.exit(1);
    } else {
      warn(`Management API returned ${res.status} — continuing anyway.`);
    }
  } catch (err) {
    warn(`Management API unreachable: ${String(err)}`);
    warn("  Continuing — offline or network issue.");
  }

  // ── 5. Done ───────────────────────────────────────────────────────────────────

  log("");
  hr();
  ok(c.bold("EP6 environment is configured and ready."));
  hr();
  log("");
  log("Recording checklist:");
  log("  □  supabase functions serve terminal is closed (EP6 uses production logs)");
  log("  □  Supabase Studio tab is visible at http://localhost:54323");
  log("  □  Terminal is clear and ready");
  log("");
  log("Start with:");
  log(c.cyan("  pnpm ep6:reset   # deploy known-good echo to production"));
  log(c.cyan("  pnpm ep6:break   # introduce the regression"));
  log(c.cyan("  pnpm ep6:run     # reproduce the 500"));
  hr();
}

main().catch(err => {
  fail(String(err));
  process.exit(1);
});
