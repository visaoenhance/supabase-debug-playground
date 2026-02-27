/**
 * EP6 — verify.ts
 *
 * PASS criteria (against PRODUCTION URL):
 *   ✔ HTTP 200
 *   ✔ body.ok === true
 *   ✔ body.request_id is a non-empty string
 *   ✔ body.echo contains the payload we sent
 *
 * Requires: PROD_SUPABASE_URL + PROD_SUPABASE_ANON_KEY in .env
 */

import "dotenv/config";
import { c, log, hr, ok, fail, step, labelledJson } from "../../utils.js";

const PROD_URL      = process.env.PROD_SUPABASE_URL;
const PROD_ANON_KEY = process.env.PROD_SUPABASE_ANON_KEY;

async function main() {
  hr();
  log(c.bold(c.green("EP6 VERIFY — echo function health check (PRODUCTION)")));
  hr();

  const missing: string[] = [];
  if (!PROD_URL)      missing.push("PROD_SUPABASE_URL");
  if (!PROD_ANON_KEY) missing.push("PROD_SUPABASE_ANON_KEY");

  if (missing.length) {
    fail("Missing required env vars:");
    for (const v of missing) fail(`  ${v}`);
    process.exit(1);
  }

  const endpoint = `${PROD_URL}/functions/v1/echo`;
  const payload  = { hello: "ep6-verify", ts: new Date().toISOString() };

  step("HTTP", `POST ${endpoint}`);
  log("");
  log("Payload:");
  log(JSON.stringify(payload, null, 2));
  log("");

  let status: number;
  let body: string;

  try {
    const res = await fetch(endpoint, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${PROD_ANON_KEY}`,
        "x-request-id":  crypto.randomUUID(),
      },
      body: JSON.stringify(payload),
    });
    status = res.status;
    body   = await res.text();
  } catch (err) {
    fail(`fetch failed: ${String(err)}`);
    process.exit(1);
  }

  let parsed: unknown = null;
  try { parsed = JSON.parse(body); } catch { /* not JSON */ }

  log(`HTTP status : ${status === 200 ? c.green(String(status)) : c.red(String(status))}`);
  log("");
  log("Response body:");
  log(JSON.stringify(parsed ?? body, null, 2));
  log("");

  let passed = true;

  if (status === 200) {
    ok("HTTP 200");
  } else {
    fail(`HTTP ${status} — expected 200. Is the fixed version deployed?`);
    if (status === 401) {
      log("  401 = JWT verification failed. Check PROD_SUPABASE_ANON_KEY.");
    }
    passed = false;
  }

  if (parsed && typeof parsed === "object" && "ok" in parsed && (parsed as { ok: boolean }).ok === true) {
    ok("Body contains { ok: true }");
  } else {
    fail("Body missing { ok: true } — function may be in broken mode");
    passed = false;
  }

  const rid =
    parsed && typeof parsed === "object" && "request_id" in parsed
      ? (parsed as { request_id: string }).request_id
      : null;

  if (rid && typeof rid === "string" && rid.length > 0) {
    ok(`request_id present: ${rid}`);
  } else {
    fail("request_id missing or empty — structured logging not wired up");
    passed = false;
  }

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP6 PASSED")));
  } else {
    log(c.bold(c.red("✘  EP6 FAILED — run pnpm ep6:fix then pnpm ep6:verify")));
  }
  hr();

  process.exit(passed ? 0 : 1);
}

main().catch(err => { fail(String(err)); process.exit(1); });
