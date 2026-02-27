/**
 * EP5 — verify.ts
 *
 * PASS criteria:
 *   ✔ supabase/types.gen.ts exists
 *   ✔ types.gen.ts was NOT written by the break script (no STALE marker)
 *   ✔ Live DB columns for `receipts` match the columns declared in types.gen.ts
 *   ✔ `notes` column is present in types.gen.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

async function main() {
hr();
log(c.bold(c.green("EP5 VERIFY — schema drift detection")));
hr();

const TYPES_FILE    = join(process.cwd(), "supabase", "types.gen.ts");
const STALE_MARKER  = "STALE — generated BEFORE the `notes` column was added";

let passed = true;

// ── 1. File must exist ────────────────────────────────────────────────────────

step("Check", "supabase/types.gen.ts exists");
if (!existsSync(TYPES_FILE)) {
  fail("supabase/types.gen.ts not found");
  fail("  Fix: supabase gen types typescript --local > supabase/types.gen.ts");
  passed = false;
} else {
  ok("types.gen.ts found");
}

// ── 2. Must not be the stale version ─────────────────────────────────────────

if (passed) {
  step("Check", "types.gen.ts is not the stale break version");
  const src = readFileSync(TYPES_FILE, "utf8");

  if (src.includes(STALE_MARKER)) {
    fail("types.gen.ts still contains the STALE marker — types have not been regenerated");
    fail("  Fix: supabase gen types typescript --local > supabase/types.gen.ts");
    passed = false;
  } else {
    ok("Stale marker not present");
  }
}

// ── 3. Live DB columns vs types ───────────────────────────────────────────────

step("Check", "Live DB columns vs types.gen.ts declarations");

let liveColumns: string[];
try {
  const sql = `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' ORDER BY ordinal_position;`;
  const out = execSync(`docker exec -i ${DB_CONTAINER} psql -U postgres -At`, { input: sql, encoding: "utf8" });
  liveColumns = out.trim().split("\n").filter(Boolean);
} catch (err) {
  fail(`Could not query live columns: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

log(`\n  Live DB columns : ${liveColumns.join(", ")}`);

if (passed) {
    const src = readFileSync(TYPES_FILE, "utf8");

    // Extract column names from the receipts Row block
    // handles both }; (interface style) and } (type style from supabase gen types)
    const tableMatch = src.match(/receipts:\s*\{[\s\S]*?Row:\s*\{([\s\S]*?)\}/m);
    const typeColumns: string[] = [];
    if (tableMatch) {
      const rowBlock = tableMatch[1];
      const colRegex = /^\s{10,}(\w+)\s*[?]?\s*:/gm;
      let m: RegExpExecArray | null;
      while ((m = colRegex.exec(rowBlock)) !== null) typeColumns.push(m[1]);
    }
    log(`  Types columns   : ${typeColumns.length ? typeColumns.join(", ") : "(none found)"}`);

    const liveSet  = new Set(liveColumns);
    const typeSet  = new Set(typeColumns);
    const added    = liveColumns.filter((c) => !typeSet.has(c));
    const removed  = typeColumns.filter((c) => !liveSet.has(c));

    log("");
    if (added.length === 0 && removed.length === 0) {
      ok("No drift — live schema matches types");
    } else {
      if (added.length > 0) {
        fail(`In DB but missing from types : ${added.join(", ")}`);
        passed = false;
      }
      if (removed.length > 0) {
        fail(`In types but not in DB       : ${removed.join(", ")}`);
        passed = false;
      }
    }

    // ── 4. notes must be present ─────────────────────────────────────────────
    step("Check", "`notes` column present in types.gen.ts");
    if (typeColumns.includes("notes")) {
      ok("`notes` column found in regenerated types");
    } else {
      fail("`notes` column not found in types.gen.ts — types may not have been regenerated");
      passed = false;
    }
  }

hr();
if (passed) {
  log(c.bold(c.green("✔  EP5 PASSED — schema and types are in sync")));
} else {
  log(c.bold(c.red("✘  EP5 FAILED — regenerate types then re-run pnpm ep5:verify")));
  log(c.grey("  Fix: supabase gen types typescript --local > supabase/types.gen.ts"));
  process.exit(1);
}
hr();
}

main();
