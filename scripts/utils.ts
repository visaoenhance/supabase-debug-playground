/**
 * scripts/utils.ts — shared helpers used by every episode script
 */

import "dotenv/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Env helpers ──────────────────────────────────────────────────────────────

export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    bail(`Missing required env var: ${key}\nCopy .env.example → .env and fill in values from \`pnpm supabase:start\``);
  }
  return val;
}

// ── Pretty-print helpers ──────────────────────────────────────────────────────

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const RED    = "\x1b[31m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const GREY   = "\x1b[90m";

export const c = {
  bold:   (s: string) => `${BOLD}${s}${RESET}`,
  red:    (s: string) => `${RED}${s}${RESET}`,
  green:  (s: string) => `${GREEN}${s}${RESET}`,
  yellow: (s: string) => `${YELLOW}${s}${RESET}`,
  cyan:   (s: string) => `${CYAN}${s}${RESET}`,
  grey:   (s: string) => `${GREY}${s}${RESET}`,
};

export function log(msg: string)   { console.log(msg); }
export function hr()               { log(c.grey("─".repeat(60))); }

export function step(label: string, msg: string) {
  log(`\n${c.bold(c.cyan(`▶ ${label}`))}  ${msg}`);
}

export function ok(msg: string) {
  log(`${c.green("✔")}  ${msg}`);
}

export function fail(msg: string) {
  log(`${c.red("✘")}  ${msg}`);
}

export function warn(msg: string) {
  log(`${c.yellow("⚠")}  ${msg}`);
}

export function bail(msg: string): never {
  fail(msg);
  process.exit(1);
}

export function labelledJson(label: string, val: unknown) {
  log(`\n${c.bold(label)}:\n${c.grey(JSON.stringify(val, null, 2))}`);
}

// ── Supabase client factories ─────────────────────────────────────────────────

export function anonClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    { auth: { persistSession: false } }
  );
}

export function serviceClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
}

// ── Playground state (persisted to .playground-state.json) ───────────────────

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const STATE_FILE = join(process.cwd(), ".playground-state.json");

type State = Record<string, unknown>;

export function readState(): State {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as State;
  } catch {
    return {};
  }
}

export function writeState(patch: State): void {
  const current = readState();
  writeFileSync(STATE_FILE, JSON.stringify({ ...current, ...patch }, null, 2));
}

// ── SQL helper via docker exec psql ──────────────────────────────────────────
// `supabase db execute --local` was removed in CLI ≥ v2.x; docker exec is the
// reliable cross-version alternative (Docker is already required to run this).
// SQL is passed via stdin (not -c) to avoid shell escaping issues with multi-line
// SQL containing $$ function bodies.

import { execSync } from "node:child_process";
import { unlinkSync as _unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as _joinTmp } from "node:path";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

export function runSQL(sql: string, label = "SQL"): void {
  step("SQL", label);
  log(c.grey(sql.trim()));
  // Write SQL to a temp file inside the container via docker exec + stdin pipe
  try {
    execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres`, {
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
    });
    ok("SQL executed successfully");
  } catch (err) {
    bail(`SQL execution failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export { DB_CONTAINER };

// ── CLI argument parser ───────────────────────────────────────────────────────

export type Mode = "break" | "run" | "verify";

export function parseMode(): Mode {
  const arg = process.argv[2] as Mode | undefined;
  if (!arg || !["break", "run", "verify"].includes(arg)) {
    bail(
      `Usage: tsx scripts/<episode>.ts <break|run|verify>\nGot: ${JSON.stringify(arg)}`
    );
  }
  return arg as Mode;
}
