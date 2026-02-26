/**
 * EP5 — break.ts
 *
 * What it does:
 *   1. Adds a `notes TEXT` column to `receipts` in the live DB
 *   2. Writes a stale supabase/types.gen.ts that does NOT include the column
 *
 *   Result: DB schema and TypeScript types are out of sync ("schema drift").
 *   `pnpm ep5:run` detects and reports the drift.
 *   Fix: run `supabase gen types typescript --local > supabase/types.gen.ts`
 *
 * Idempotency: `ADD COLUMN IF NOT EXISTS` + file hash check make re-runs safe.
 * Reset: `pnpm ep5:reset`  →  drops column + git checkout removes types.gen.ts
 */

import { execSync } from "node:child_process";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { c, log, hr, ok, fail, step, warn } from "../../utils.js";

const TYPES_FILE = join(process.cwd(), "supabase", "types.gen.ts");

// ── 1. Add `notes` column to DB ───────────────────────────────────────────────

const ADD_COLUMN_SQL = `alter table public.receipts add column if not exists notes text;`;

hr();
log(c.bold(c.yellow("EP5 BREAK — adding column + writing stale types")));
hr();

step("SQL", "Adding `notes TEXT` column to receipts");
try {
  execSync(`supabase db execute --local --sql ${JSON.stringify(ADD_COLUMN_SQL)}`, {
    stdio: "inherit",
  });
  ok("Column added");
} catch (err) {
  fail("supabase db execute failed — is Supabase running?");
  fail(`  ${err instanceof Error ? err.message : String(err)}`);
  log("  Run: pnpm supabase:start");
  process.exit(1);
}

// ── 2. Write stale types.gen.ts (notes column missing) ───────────────────────

const STALE_TYPES = `// ⚠️  STALE — generated BEFORE the \`notes\` column was added.
// This file is intentionally out of date for EP5 demo purposes.
// Fix: supabase gen types typescript --local > supabase/types.gen.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
          // ← 'notes' column is intentionally missing here
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
        Insert: { id?: string; email: string; created_at?: string };
        Update: { id?: string; email?: string; created_at?: string };
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

step("File", "Writing stale supabase/types.gen.ts (notes column absent)");

// Idempotency: only write if different from current content
let current = "";
try { current = readFileSync(TYPES_FILE, "utf8"); } catch { /* file may not exist */ }

if (current === STALE_TYPES) {
  warn("types.gen.ts already contains the stale version — skipping (idempotent).");
} else {
  writeFileSync(TYPES_FILE, STALE_TYPES, "utf8");
  ok("supabase/types.gen.ts written (stale — missing notes column)");
}

log("");
log("What's broken:");
log(c.red("  • DB has:    id, user_id, title, amount, created_at, notes"));
log(c.red("  • Types say: id, user_id, title, amount, created_at        ← notes missing"));
log(c.red("  • TypeScript compiles fine but inserting `notes` is invisible to the type system"));
log("");
log("Next steps:");
log("  1. pnpm ep5:run  — see the drift report");
log("  2. Fix: supabase gen types typescript --local > supabase/types.gen.ts");
log("  3. pnpm ep5:verify");
hr();
