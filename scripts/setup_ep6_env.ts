/**
 * setup:ep6:env
 *
 * Interactive setup for EP6 production env vars.
 *
 * You provide:
 *   1. SUPABASE_PROJECT_REF   — the short ID from your project URL
 *   2. SUPABASE_ACCESS_TOKEN  — personal access token from supabase.com/dashboard/account/tokens
 *
 * This script derives / fetches the rest:
 *   • PROD_SUPABASE_URL       — https://<project-ref>.supabase.co
 *   • PROD_SUPABASE_ANON_KEY  — fetched from the Supabase Management API automatically
 *
 * Then appends all 4 values to your .env file (skipping any already present).
 *
 * Usage:
 *   pnpm setup:ep6:env
 *   — or —
 *   SUPABASE_PROJECT_REF=xxx SUPABASE_ACCESS_TOKEN=yyy pnpm setup:ep6:env
 */

import { createInterface } from "node:readline/promises";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { c, log, hr, ok, fail, step, warn } from "./utils.js";

const ENV_FILE = join(process.cwd(), ".env");

// ── helpers ────────────────────────────────────────────────────────────────────

function readEnv(): string {
  return existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf-8") : "";
}

function envHas(content: string, key: string): boolean {
  return new RegExp(`^${key}=`, "m").test(content);
}

function appendToEnv(lines: string[]) {
  const current = readEnv();
  const toAdd   = lines.filter(l => !l.startsWith("#") && !envHas(current, l.split("=")[0]));

  if (toAdd.length === 0) {
    warn("All EP6 env vars already present in .env — nothing to add.");
    return false;
  }

  const separator = current.endsWith("\n") ? "" : "\n";
  const block = `\n# ── EP6: Production (auto-filled by setup:ep6:env) ──\n${toAdd.join("\n")}\n`;
  writeFileSync(ENV_FILE, current + separator + block, "utf-8");
  return true;
}

async function prompt(rl: Awaited<ReturnType<typeof createInterface>>, question: string): Promise<string> {
  const answer = (await rl.question(question)).trim();
  return answer;
}

// ── main ───────────────────────────────────────────────────────────────────────

async function main() {
  hr();
  log(c.bold("EP6 ENV SETUP — production Supabase project"));
  hr();
  log("This will add 4 values to your .env file:");
  log("  SUPABASE_PROJECT_REF    (you provide)");
  log("  SUPABASE_ACCESS_TOKEN   (you provide)");
  log("  PROD_SUPABASE_URL       (derived from project ref)");
  log("  PROD_SUPABASE_ANON_KEY  (fetched automatically via Management API)");
  log("");

  // ── 1. Get credentials (env or interactive) ──────────────────────────────────

  let projectRef   = process.env.SUPABASE_PROJECT_REF   ?? "";
  let accessToken  = process.env.SUPABASE_ACCESS_TOKEN  ?? "";

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  if (!projectRef) {
    log(c.grey("  Find this in your Supabase project URL:"));
    log(c.grey("  https://supabase.com/dashboard/project/<project-ref>/settings/general"));
    log("");
    projectRef = await prompt(rl, c.bold("  SUPABASE_PROJECT_REF: "));
  } else {
    ok(`SUPABASE_PROJECT_REF already set: ${projectRef}`);
  }

  if (!projectRef) {
    fail("Project ref cannot be empty.");
    rl.close();
    process.exit(1);
  }

  if (!accessToken) {
    log("");
    log(c.grey("  Create one at: https://supabase.com/dashboard/account/tokens"));
    log(c.grey("  Needs: read access to project API keys"));
    log("");
    accessToken = await prompt(rl, c.bold("  SUPABASE_ACCESS_TOKEN: "));
  } else {
    ok("SUPABASE_ACCESS_TOKEN already set");
  }

  rl.close();

  if (!accessToken) {
    fail("Access token cannot be empty.");
    process.exit(1);
  }

  // ── 2. Fetch anon key from Management API ────────────────────────────────────

  log("");
  step("API", `Fetching API keys for project ${projectRef}`);

  let anonKey: string;

  try {
    const res = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      fail(`Management API returned ${res.status}: ${body}`);
      log("");
      if (res.status === 401) {
        log("  → Token is invalid or expired. Generate a new one at:");
        log("    https://supabase.com/dashboard/account/tokens");
      } else if (res.status === 404) {
        log("  → Project not found. Check SUPABASE_PROJECT_REF.");
      }
      process.exit(1);
    }

    const keys = await res.json() as Array<{ name: string; api_key: string }>
    // Support both legacy key (name: 'anon') and new publishable key (name: 'publishable')
    const anon = keys.find(k => k.name === "anon") ?? keys.find(k => k.name === "publishable");

    if (!anon) {
      fail("Could not find anon or publishable key in API response.");
      log("  Keys returned: " + keys.map(k => k.name).join(", "));
      log("  Go to: https://supabase.com/dashboard/project/" + projectRef + "/settings/api-keys");
      process.exit(1);
    }

    anonKey = anon.api_key;
    ok(`${anon.name} key fetched (will be used as PROD_SUPABASE_ANON_KEY)`);
  } catch (err) {
    fail(`fetch failed: ${String(err)}`);
    process.exit(1);
  }

  // ── 3. Derive URL ─────────────────────────────────────────────────────────────

  const prodUrl = `https://${projectRef}.supabase.co`;
  ok(`Production URL: ${prodUrl}`);

  // ── 4. Write to .env ─────────────────────────────────────────────────────────

  log("");
  step(".env", "Writing EP6 vars to .env");

  const added = appendToEnv([
    `SUPABASE_PROJECT_REF=${projectRef}`,
    `SUPABASE_ACCESS_TOKEN=${accessToken}`,
    `PROD_SUPABASE_URL=${prodUrl}`,
    `PROD_SUPABASE_ANON_KEY=${anonKey}`,
  ]);

  if (added) {
    ok(".env updated");
    log("");
    log("EP6 env vars written:");
    log(c.green(`  SUPABASE_PROJECT_REF   = ${projectRef}`));
    log(c.green(`  SUPABASE_ACCESS_TOKEN  = ${accessToken.slice(0, 6)}...**hidden**`));
    log(c.green(`  PROD_SUPABASE_URL      = ${prodUrl}`));
    log(c.green(`  PROD_SUPABASE_ANON_KEY = ${anonKey.slice(0, 6)}...**hidden**`));
  }

  log("");
  log("Next steps:");
  log("  pnpm ep6:reset   — deploy known-good echo to production (confirms env works)");
  log("  pnpm ep6:break   — deploy broken version");
  log("  pnpm ep6:run     — reproduce the 500");
  hr();
}

main().catch(err => {
  fail(String(err));
  process.exit(1);
});
