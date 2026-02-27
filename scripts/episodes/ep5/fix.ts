/**
 * EP5 — fix.ts
 *
 * What it does:
 *   Regenerates `supabase/types.gen.ts` from the live local database schema.
 *   This brings the TypeScript types back in sync with the actual DB columns.
 *
 * ─── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 *
 *   BUG — Schema drift: `types.gen.ts` is stale:
 *     ep5:break adds a `notes TEXT` column to the DB, then writes a
 *     `types.gen.ts` that doesn't include it.
 *     Result: TypeScript compiles fine (it only knows what the types say),
 *     but any code inserting `notes` works at runtime while the type says it
 *     doesn't exist — or vice versa if you trust the type and skip the column.
 *
 * ─── HOW IT WAS FIXED ────────────────────────────────────────────────────────
 *
 *   FIX — Regenerate types from the live schema:
 *     `supabase gen types typescript --local > supabase/types.gen.ts`
 *     One command. Types now match the DB. Drift resolved.
 *
 *   The lesson: `gen types` produces a snapshot — it must be re-run after
 *   every migration. Add it to your CI pipeline before any deploy that
 *   includes a migration.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Reset: `pnpm ep5:reset` drops the column + git checkout restores types.gen.ts
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const TYPES_FILE = join(process.cwd(), "supabase", "types.gen.ts");

hr();
log(c.bold(c.green("EP5 FIX — regenerating types from live local schema")));
hr();

log("Fix applied:");
log(c.green("  1. supabase gen types typescript --local > supabase/types.gen.ts"));
log(c.green("  2. types.gen.ts now reflects the live DB including the `notes` column"));
log(c.green("  3. Schema drift resolved — TypeScript types match database schema"));
log("");

step("Gen", "Running type regeneration command");
log("");
log(c.bold(c.cyan("  supabase gen types typescript --local > supabase/types.gen.ts")));
log("");

try {
  // ✅ FIX: regenerate types from the live local Supabase schema
  const output = execSync("supabase gen types typescript --local", {
    encoding: "utf-8",
  });
  writeFileSync(TYPES_FILE, output);
  ok(`types.gen.ts regenerated → ${TYPES_FILE}`);
} catch (err) {
  fail("supabase gen types failed — is Supabase running?");
  fail(`  ${err instanceof Error ? err.message : String(err)}`);
  log("  Run: pnpm supabase:start");
  process.exit(1);
}

log("");
log("Next steps:");
log("  1. pnpm ep5:run    — confirm drift is gone");
log("  2. pnpm ep5:verify — run pass/fail assertions");
log("  3. pnpm ep5:reset  — drop the notes column + restore committed types.gen.ts");
hr();
