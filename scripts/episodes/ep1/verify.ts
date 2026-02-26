/**
 * EP1 — verify.ts
 *
 * PASS criteria:
 *   ✔ HTTP 200 from the echo function
 *   ✔ response body contains { ok: true }
 *   ✔ response body echoes back the request_id we sent
 */

import { requireEnv, c, log, hr, ok, fail, step, labelledJson } from "../../utils.js";

async function main() {
hr();
log(c.bold(c.green("EP1 VERIFY — echo function health check")));
hr();

const base     = requireEnv("SUPABASE_URL");
const anonKey  = requireEnv("SUPABASE_ANON_KEY");
const url      = `${base}/functions/v1/echo`;
const reqId    = crypto.randomUUID();
const payload  = { hello: "ep1-verify", ts: new Date().toISOString() };

step("HTTP", `POST ${url}`);
labelledJson("Payload", payload);

let passed = true;

try {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
      "x-request-id": reqId,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(text); } catch { /* ignore */ }

  log("");
  log(`HTTP status : ${res.status}`);
  labelledJson("Response body", body);
  log("");

  // ── assertions ──────────────────────────────────────────────────────────

  if (res.status === 200) {
    ok("HTTP 200");
  } else {
    fail(`Expected 200, got ${res.status}`);
    passed = false;
  }

  if (body["ok"] === true) {
    ok('Body contains { ok: true }');
  } else {
    fail("Body missing { ok: true }");
    passed = false;
  }

  if (typeof body["request_id"] === "string" && body["request_id"].length > 0) {
    ok(`request_id echoed: ${body["request_id"]}`);
  } else {
    fail("request_id missing from response — structured logging not wired up");
    passed = false;
  }

} catch (err) {
  fail(`Network error — is Supabase running and function server active?`);
  fail(`  ${err instanceof Error ? err.message : String(err)}`);
  log("");
  log("  Run: pnpm supabase:start");
  log("  Run: supabase functions serve --no-verify-jwt");
  passed = false;
}

hr();
if (passed) {
  log(c.bold(c.green("✔  EP1 PASSED")));
} else {
  log(c.bold(c.red("✘  EP1 FAILED — fix index.ts then re-run pnpm ep1:verify")));
  process.exit(1);
}
hr();
}

main();
