/**
 * Episode 6 — Local to Production
 * ─────────────────────────────────────────────────────────────────────────────
 * The `echo` edge function fixed in EP1 has been deployed to a real Supabase
 * project. This episode covers debugging production edge function failures
 * using `supabase functions logs` — the CLI equivalent of the Dashboard Logs
 * tab, and the only tool available to a coding agent.
 *
 * BREAK  : Deploys the broken version of echo (index.broken.ts) to production.
 *          Same bugs as EP1 — but now visible via `supabase functions logs`.
 *
 * RUN    : Calls the deployed production URL with a valid anon key JWT.
 *          Shows HTTP 500 + missing request_id when broken, 200 when fixed.
 *
 * VERIFY : Asserts HTTP 200, body.ok === true, body.request_id non-empty
 *          against the production URL.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  parseMode,
  c, log, hr, step, ok, fail, warn, labelledJson,
} from "./utils.js";

// ── Env ───────────────────────────────────────────────────────────────────────

const PROD_URL      = process.env.PROD_SUPABASE_URL;
const PROD_ANON_KEY = process.env.PROD_SUPABASE_ANON_KEY;
const PROJECT_REF   = process.env.SUPABASE_PROJECT_REF;

function assertProdEnv() {
  const missing: string[] = [];
  if (!PROD_URL)      missing.push("PROD_SUPABASE_URL");
  if (!PROD_ANON_KEY) missing.push("PROD_SUPABASE_ANON_KEY");
  if (!PROJECT_REF)   missing.push("SUPABASE_PROJECT_REF");
  if (missing.length) {
    fail("Missing required env vars for EP6 (production episode):");
    for (const v of missing) fail(`  ${v}`);
    log("");
    log("Add these to your .env file:");
    log("  SUPABASE_PROJECT_REF   — from your Supabase project settings");
    log("  SUPABASE_ACCESS_TOKEN  — personal access token from supabase.com/dashboard/account/tokens");
    log("  PROD_SUPABASE_URL      — https://<project-ref>.supabase.co");
    log("  PROD_SUPABASE_ANON_KEY — anon key from project API settings");
    process.exit(1);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function doRun() {
  assertProdEnv();

  const endpoint   = `${PROD_URL}/functions/v1/echo`;
  const requestId  = crypto.randomUUID();
  const payload    = { hello: "debug-playground", ts: new Date().toISOString() };

  hr();
  log(c.bold("▶ EP6 RUN — calling `echo` edge function (PRODUCTION)"));
  hr();
  log("");
  step("HTTP", `POST ${endpoint}`);
  log(c.grey(`  x-request-id: ${requestId}`));
  log(c.grey(`  Authorization: Bearer <PROD_SUPABASE_ANON_KEY>`));
  log("");
  log("Request payload:");
  log(JSON.stringify(payload, null, 2));
  log(c.bold("─".repeat(60)));
  log("");

  let status: number;
  let body: string;

  try {
    const res = await fetch(endpoint, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${PROD_ANON_KEY}`,
        "x-request-id":  requestId,
      },
      body: JSON.stringify(payload),
    });
    status = res.status;
    body   = await res.text();
  } catch (err) {
    fail(`fetch failed: ${String(err)}`);
    log("  Is PROD_SUPABASE_URL correct and the project reachable?");
    process.exit(1);
  }

  let parsed: unknown = null;
  try { parsed = JSON.parse(body); } catch { /* not JSON */ }

  log("Response body:");
  if (parsed) {
    log(JSON.stringify(parsed, null, 2));
  } else {
    log(`"${body}"`);
  }
  log("");
  log(`HTTP status: ${status === 200 ? c.green(String(status)) : c.red(String(status))}`);

  const rid =
    parsed && typeof parsed === "object" && "request_id" in parsed
      ? (parsed as { request_id: string }).request_id
      : null;

  if (rid) {
    log(c.green(`request_id echoed back: ${rid}`));
  } else {
    warn("No request_id in response — structured logging may be missing.");
  }

  hr();
  log(c.bold("What to check:"));
  log("  • Is the status 200?  If not, the deployed function is in broken mode.");
  log("  • Is request_id present in the response body?");
  log("  • Query production logs:");
  log(c.cyan(`    supabase functions logs echo --project-ref ${PROJECT_REF ?? "<SUPABASE_PROJECT_REF>"}`));
  log("    Look for:  TypeError / { \"level\": \"error\", ... }");
  log("  • Status 401? The Bearer token is missing or the wrong key was used.");
  hr();
}

// ── Entry ─────────────────────────────────────────────────────────────────────

const mode = parseMode();
if (mode === "run") {
  doRun().catch(err => { fail(String(err)); process.exit(1); });
}
