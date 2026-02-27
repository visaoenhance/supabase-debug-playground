/**
 * Episode 1 — Edge Function Logging
 * ─────────────────────────────────────────────────────────────────────────────
 * BREAK  : Swaps index.ts with the broken version (index.broken.ts) that
 *          throws on every request due to a missing env var, with no
 *          try/catch and no request-id logging.
 *
 * RUN    : Invokes the `echo` function and shows exactly what the client
 *          receives (status, body, headers).  Works whether broken or fixed.
 *
 * VERIFY : Invokes the function and asserts status 200 + request_id present.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  parseMode,
  requireEnv,
  c, log, hr, step, ok, fail, warn, labelledJson,
} from "./utils.js";

const FUNCTIONS_DIR = join(process.cwd(), "supabase", "functions", "echo");
const GOOD_SRC   = join(FUNCTIONS_DIR, "index.ts");
const BROKEN_SRC = join(FUNCTIONS_DIR, "index.broken.ts");

// ── helpers ──────────────────────────────────────────────────────────────────

function activateVersion(source: "good" | "broken") {
  if (source === "broken") {
    const broken = readFileSync(BROKEN_SRC, "utf8");
    writeFileSync(GOOD_SRC, broken);
  } else {
    // Restore from .baseline if it exists, else remind user to reset
    const baseline = join(FUNCTIONS_DIR, "index.baseline.ts");
    try {
      const src = readFileSync(baseline, "utf8");
      writeFileSync(GOOD_SRC, src);
    } catch {
      warn(
        "No index.baseline.ts found.  " +
        "Run `pnpm reset` to restore the baseline, then try again."
      );
      process.exit(1);
    }
  }
}

function backupBaseline() {
  const dest = join(FUNCTIONS_DIR, "index.baseline.ts");
  try { readFileSync(dest); } catch {
    // First time — save the current good version as baseline
    copyFileSync(GOOD_SRC, dest);
  }
}

async function callEchoFunction(): Promise<{
  status: number;
  body: unknown;
  requestId: string | null;
}> {
  const base = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const url = `${base}/functions/v1/echo`;
  const requestId = crypto.randomUUID();

  step("HTTP", `POST ${url}`);
  log(c.grey(`  x-request-id: ${requestId}`));

  const payload = { hello: "debug-playground", ts: new Date().toISOString() };
  labelledJson("Request payload", payload);

  let status: number;
  let body: unknown;
  let responseRequestId: string | null = null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "x-request-id": requestId,
      },
      body: JSON.stringify(payload),
    });

    status = res.status;
    const text = await res.text();
    try {
      body = JSON.parse(text);
      if (typeof body === "object" && body !== null && "request_id" in body) {
        responseRequestId = (body as { request_id: string }).request_id;
      }
    } catch {
      body = text;
    }
  } catch (err) {
    fail(`Network error — is Supabase running? (pnpm supabase:start)`);
    throw err;
  }

  return { status, body, requestId: responseRequestId };
}

// ── modes ────────────────────────────────────────────────────────────────────

async function doBreak() {
  hr();
  log(c.bold(c.yellow("▶ EP1 BREAK — injecting broken edge function")));
  hr();

  backupBaseline();
  activateVersion("broken");

  step("Action", "Overwriting index.ts with index.broken.ts");
  log("");
  log("  Bugs introduced:");
  log(c.red("    1. Reads REQUIRED_API_SECRET env var which is never set"));
  log(c.red("    2. Accesses .length on undefined → TypeError at the first line"));
  log(c.red("    3. No try/catch → Deno turns it into an opaque 500 with no body"));
  log(c.red("    4. No request_id logged → impossible to correlate client error to logs"));
  log("");

  step("Restart required",
    "Re-serving the edge function with the broken code...");
  try {
    execSync("supabase functions serve echo --no-verify-jwt &", {
      stdio: "ignore",
      shell: "/bin/sh",
    });
    // Give the server a moment to restart
    await new Promise((r) => setTimeout(r, 3000));
    ok("Function re-served (broken version active)");
  } catch {
    warn("Could not auto-restart supabase functions serve.");
    warn("If you have a `supabase functions serve` terminal open, restart it.");
  }

  log("");
  warn("Run `pnpm ep1:run` to see the failure.");
}

async function doRun() {
  hr();
  log(c.bold(c.cyan("▶ EP1 RUN — calling `echo` edge function")));
  hr();

  const { status, body, requestId } = await callEchoFunction();

  hr();
  labelledJson("Response body", body);
  log(`\n${c.bold("HTTP status:")} ${status >= 200 && status < 300 ? c.green(String(status)) : c.red(String(status))}`);

  if (requestId) {
    log(`${c.bold("request_id echoed back:")} ${c.green(requestId)}`);
  } else {
    warn("No request_id in response — structured logging may be missing.");
  }

  hr();
  log(c.bold("What to check:"));
  log("  • Is the status 200?  If not, the function is in broken mode.");
  log("  • Is request_id present in the response body?");
  log("  • Check the terminal where `supabase functions serve` is running");
  log('    and look for  TypeError / { "level": "error", ... } in that output.');
  hr();
}

async function doVerify() {
  hr();
  log(c.bold(c.green("▶ EP1 VERIFY — confirming echo function is healthy")));
  hr();

  const { status, body, requestId } = await callEchoFunction();

  let passed = true;

  if (status === 200) {
    ok(`HTTP 200 received`);
  } else {
    fail(`Expected 200, got ${status}`);
    passed = false;
  }

  if (requestId) {
    ok(`request_id present in response: ${requestId}`);
  } else {
    fail("request_id missing from response body");
    passed = false;
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "ok" in body &&
    (body as { ok: boolean }).ok === true
  ) {
    ok('Response body contains { ok: true }');
  } else {
    fail('Response body does not contain { ok: true }');
    passed = false;
  }

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP1 PASSED — edge function is healthy and logging correctly.")));
  } else {
    log(c.bold(c.red("✘  EP1 FAILED — see issues above.")));
    log("  Tip: run `pnpm reset` to restore the good function, then `pnpm ep1:verify`.");
    process.exit(1);
  }
  hr();
}

// ── entry ────────────────────────────────────────────────────────────────────

const mode = parseMode();
if      (mode === "break")  doBreak();
else if (mode === "run")    doRun();
else if (mode === "verify") doVerify();
