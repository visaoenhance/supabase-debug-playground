/**
 * Episode 5 — Schema Drift / Types
 * ─────────────────────────────────────────────────────────────────────────────
 * When a Supabase table schema changes (new column, renamed column, dropped
 * column) without regenerating TypeScript types, the local types drift from
 * the real database schema.  This causes:
 *   - Silent runtime mismatches (extra fields just don't appear)
 *   - TypeScript compile errors when the generated types are stale
 *   - "Did I insert that column?" confusion
 *
 * BREAK  : Adds a `notes TEXT` column to `receipts` via SQL, then writes a
 *          stale `types.gen.ts` snapshot that does NOT include the column.
 *          This simulates forgetting to regenerate types after a migration.
 *
 * RUN    : Runs a "drift check" that compares the live schema columns to the
 *          columns declared in the stale types file and reports the diff.
 *
 * VERIFY : Regenerates types via `supabase gen types typescript`, then re-runs
 *          the drift check confirming no diff remains.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  parseMode,
  serviceClient,
  c, log, hr, step, ok, fail, warn, labelledJson,
} from "./utils.js";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const TYPES_FILE = join(process.cwd(), "supabase", "types.gen.ts");

// ── SQL ──────────────────────────────────────────────────────────────────────

const ADD_NOTES_COLUMN = `
alter table public.receipts
  add column if not exists notes text;
`;

const DROP_NOTES_COLUMN = `
alter table public.receipts
  drop column if exists notes;
`;

function applySql(sql: string, label: string) {
  step("SQL", label);
  log(c.grey(sql.trim()));
  try {
    execSync(
      `supabase db execute --local --sql ${JSON.stringify(sql)}`,
      { stdio: "inherit" }
    );
    ok("SQL applied");
  } catch (err) {
    fail(`SQL failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ── Types helpers ─────────────────────────────────────────────────────────────

/** Minimal stale snapshot — does NOT include the `notes` column */
const STALE_TYPES_SNAPSHOT = `// ⚠️  STALE — generated BEFORE the notes column was added
// This file is intentionally out of date for Episode 5 demo purposes.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      receipts: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          amount: number;
          created_at: string;
          // ← 'notes' column is missing here!
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          amount?: number;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      create_receipt: {
        Args: { title: string; amount: number };
        Returns: Database["public"]["Tables"]["receipts"]["Row"];
      };
    };
  };
}
`;

function writeStaleTypes() {
  writeFileSync(TYPES_FILE, STALE_TYPES_SNAPSHOT, "utf8");
  ok(`Stale types written to supabase/types.gen.ts`);
}

function regenerateTypes() {
  step("Generate", "supabase gen types typescript --local");
  try {
    const output = execSync(
      "supabase gen types typescript --local",
      { encoding: "utf8" }
    );
    writeFileSync(TYPES_FILE, output, "utf8");
    ok(`Types regenerated → supabase/types.gen.ts`);
  } catch (err) {
    fail(
      "supabase gen types failed: " +
      (err instanceof Error ? err.message : String(err))
    );
    process.exit(1);
  }
}

// ── Drift checker ─────────────────────────────────────────────────────────────

async function getLiveColumns(table: string): Promise<string[]> {
  const db = serviceClient();
  const { data, error } = await db
    .from("information_schema.columns" as never)
    .select("column_name")
    .eq("table_schema", "public")
    .eq("table_name", table)
    .order("ordinal_position");

  if (error) {
    fail(`Could not query information_schema: ${error.message}`);
    process.exit(1);
  }

  return (data as Array<{ column_name: string }>).map((r) => r.column_name);
}

function getTypesColumns(table: string): string[] {
  if (!existsSync(TYPES_FILE)) {
    warn("supabase/types.gen.ts does not exist — run `pnpm ep5:verify` to generate it.");
    return [];
  }

  const src = readFileSync(TYPES_FILE, "utf8");

  // Extract column names from the Row block for the given table
  // Looks for:   id: string;   amount: number;  notes: string | null;  etc.
  const tableRegex = new RegExp(
    `${table}:\\s*\\{[\\s\\S]*?Row:\\s*\\{([\\s\\S]*?)\\};`,
    "m"
  );
  const match = src.match(tableRegex);
  if (!match) {
    warn(`Could not find '${table}.Row' in types.gen.ts`);
    return [];
  }

  const rowBlock = match[1];
  const colRegex = /^\s{10,}(\w+)\s*[?]?\s*:/gm;
  const cols: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = colRegex.exec(rowBlock)) !== null) {
    cols.push(m[1]);
  }
  return cols;
}

async function runDriftCheck(): Promise<{ added: string[]; removed: string[] }> {
  const liveColumns  = await getLiveColumns("receipts");
  const typesColumns = getTypesColumns("receipts");

  const liveSet  = new Set(liveColumns);
  const typeSet  = new Set(typesColumns);

  const added   = liveColumns.filter((c) => !typeSet.has(c));   // in DB but not types
  const removed = typesColumns.filter((c) => !liveSet.has(c));   // in types but not DB

  log("");
  log(c.bold("Live DB columns for `receipts`:"));
  log("  " + liveColumns.map((c) => c).join(", "));

  log(c.bold("Types columns for `receipts` (from types.gen.ts):"));
  if (typesColumns.length === 0) {
    log(c.yellow("  (none — types file missing or unparseable)"));
  } else {
    log("  " + typesColumns.join(", "));
  }

  log("");
  if (added.length === 0 && removed.length === 0) {
    ok("No drift detected — live schema matches types.");
  } else {
    if (added.length > 0) {
      fail(`Columns in DB but MISSING from types: ${added.map((c) => c.bold ?? c).join(", ")}`);
      log(c.red(`  → ${added.join(", ")}`));
    }
    if (removed.length > 0) {
      fail(`Columns in types but NOT in DB: ${removed.join(", ")}`);
      log(c.red(`  → ${removed.join(", ")}`));
    }
  }

  return { added, removed };
}

// ── modes ────────────────────────────────────────────────────────────────────

async function doBreak() {
  hr();
  log(c.bold(c.yellow("▶ EP5 BREAK — adding column to DB, writing stale types")));
  hr();

  log("  What this simulates:");
  log(c.yellow("    1. A migration adds `notes TEXT` column to receipts"));
  log(c.yellow("    2. The developer forgets to run `supabase gen types typescript`"));
  log(c.yellow("    3. supabase/types.gen.ts is now out of sync with the real schema"));
  log(c.yellow("    4. TypeScript sees no error, but inserting `notes` at runtime is invisible"));
  log("");

  applySql(ADD_NOTES_COLUMN, "Adding `notes TEXT` column to receipts");
  writeStaleTypes();

  log("");
  warn("Run `pnpm ep5:run` to see the drift report.");
}

async function doRun() {
  hr();
  log(c.bold(c.cyan("▶ EP5 RUN — drift detection: live schema vs types.gen.ts")));
  hr();

  const { added, removed } = await runDriftCheck();

  hr();
  if (added.length > 0 || removed.length > 0) {
    log(c.bold(c.red("⚠  Drift detected!")));
    log("");
    log("What to do:");
    log("  1. Run: supabase gen types typescript --local > supabase/types.gen.ts");
    log("  2. Or:  pnpm ep5:verify  (does it automatically)");
    log("  3. Commit the updated types.gen.ts alongside any migration");
    log("");
    log("Why this matters:");
    log("  • You can insert a `notes` field in code but TypeScript won't complain");
    log("  • The value is silently dropped if the type says the column doesn't exist");
    log("  • Drift grows silently until you hit a runtime mismatch in production");
  } else {
    ok("No drift — types are in sync with the database.");
    log(c.grey("  (Run `pnpm ep5:break` to introduce drift, then re-run.)"));
  }
  hr();
}

async function doVerify() {
  hr();
  log(c.bold(c.green("▶ EP5 VERIFY — regenerating types + confirming no drift")));
  hr();

  // First ensure the notes column exists (it may not if reset was run)
  applySql(ADD_NOTES_COLUMN, "Ensure `notes TEXT` column exists");

  regenerateTypes();

  const { added, removed } = await runDriftCheck();

  hr();
  let passed = true;
  if (added.length > 0 || removed.length > 0) {
    fail("Drift still present after regeneration — please investigate.");
    passed = false;
  } else {
    ok("types.gen.ts is in sync with the live database schema.");
  }

  if (passed) {
    // Also check the notes column IS now in the types file
    const cols = getTypesColumns("receipts");
    if (cols.includes("notes")) {
      ok("`notes` column is present in the regenerated types.");
    } else {
      warn("`notes` column not found in parsed types — check types.gen.ts manually.");
    }
  }

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP5 PASSED — schema and types are in sync.")));
  } else {
    log(c.bold(c.red("✘  EP5 FAILED — see issues above.")));
    process.exit(1);
  }
  hr();
}

// ── entry ────────────────────────────────────────────────────────────────────

const mode = parseMode();
if      (mode === "break")  doBreak();
else if (mode === "run")    doRun();
else if (mode === "verify") doVerify();
