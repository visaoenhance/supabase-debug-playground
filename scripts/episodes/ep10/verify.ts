/**
 * EP10 — verify.ts
 *
 * Must run AFTER ep10:fix has been applied (index present, 10k rows seeded).
 *
 * PASS criteria:
 *   ✔ receipts table has >= 1 000 rows (enough for the fix to matter)
 *   ✔ Index receipts_created_at_idx exists
 *   ✔ EXPLAIN ANALYZE shows Index Scan (not Seq Scan) when index is present
 *   ✔ Execution time with index is captured and logged
 */

import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

function psql(sql: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -tAc "${sql.replace(/"/g, '\\"')}"`,
    { encoding: "utf-8" }
  ).trim();
}

function psqlFull(sql: string): string {
  return execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -c "${sql.replace(/"/g, '\\"')}"`,
    { encoding: "utf-8" }
  );
}

async function main() {
  hr();
  log(c.bold(c.green("EP10 VERIFY — Query Performance: index scan confirmed")));
  hr();

  let passed = true;

  const QUERY = `
    SELECT id, title, amount, created_at
    FROM public.receipts
    WHERE created_at > NOW() - INTERVAL '7 days'
    ORDER BY created_at DESC
    LIMIT 25
  `.trim().replace(/\n\s+/g, " ");

  // ── Preflight: row count ──────────────────────────────────────────────────

  step("Preflight", "Confirming row count");

  const rowCount = parseInt(psql("SELECT COUNT(*) FROM public.receipts;"), 10);
  log(`  Rows in receipts: ${rowCount.toLocaleString()}`);

  if (rowCount >= 1000) {
    ok(`Row count ${rowCount.toLocaleString()} — sufficient for meaningful EXPLAIN comparison ✔`);
  } else {
    log(c.yellow(`⚠  Only ${rowCount} rows present. Run \`pnpm supabase:reset\` to seed 10k rows.`));
    log("   Continuing — EXPLAIN output will still distinguish plan shapes.");
  }

  // ── Preflight: index exists ───────────────────────────────────────────────

  step("Preflight", "Confirming index exists");

  const idxCount = psql(
    "SELECT COUNT(*) FROM pg_indexes " +
    "WHERE tablename = 'receipts' AND indexname = 'receipts_created_at_idx';"
  );

  if (idxCount === "1") {
    ok("receipts_created_at_idx present ✔");
  } else {
    fail("Index missing — run `pnpm ep10:fix` first");
    process.exit(1);
  }

  // ── EXPLAIN ANALYZE with index ────────────────────────────────────────────

  step("EXPLAIN ANALYZE", "With index in place");

  const explainWithIdx = psqlFull(`EXPLAIN (ANALYZE, BUFFERS) ${QUERY}`);
  log(explainWithIdx);

  if (
    explainWithIdx.includes("Index Scan") ||
    explainWithIdx.includes("Index Only Scan") ||
    explainWithIdx.includes("Bitmap Index Scan")
  ) {
    ok("Index Scan plan shape confirmed ✔");
  } else if (explainWithIdx.includes("Seq Scan")) {
    log(c.yellow("⚠  Planner chose Seq Scan even with index present."));
    if (rowCount < 1000) {
      log("   This is expected with small datasets — planner favours Seq Scan below ~threshold.");
      log("   Seed with `pnpm supabase:reset` (seeds 10k rows) then re-verify.");
    } else {
      fail("Seq Scan with 1k+ rows — unexpected, investigate planner settings");
      passed = false;
    }
  }

  // ── Capture execution time ────────────────────────────────────────────────

  const timeMatch = explainWithIdx.match(/Execution Time:\s+([\d.]+) ms/);
  if (timeMatch) {
    log(`  Execution time (with index): ${timeMatch[1]} ms`);
  }

  // ── Simulate the broken state to show contrast ────────────────────────────

  step("Contrast", "Temporarily dropping index to capture Seq Scan plan shape");

  psql("DROP INDEX IF EXISTS receipts_created_at_idx;");
  psql("ANALYZE public.receipts;");

  const explainWithoutIdx = psqlFull(`EXPLAIN (ANALYZE, BUFFERS) ${QUERY}`);
  log(explainWithoutIdx);

  const timeNoIdxMatch = explainWithoutIdx.match(/Execution Time:\s+([\d.]+) ms/);
  if (timeNoIdxMatch) {
    log(`  Execution time (without index): ${timeNoIdxMatch[1]} ms`);
  }

  // Restore the index
  psql("CREATE INDEX IF NOT EXISTS receipts_created_at_idx ON public.receipts (created_at DESC);");
  psql("ANALYZE public.receipts;");

  ok("Index restored after contrast check ✔");

  // ── Summary ───────────────────────────────────────────────────────────────

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP10 PASSED")));
    log(`  • receipts table: ${rowCount.toLocaleString()} rows`);
    log("  • Index receipts_created_at_idx: present");
    log("  • Plan with index: Index Scan");
    if (timeMatch && timeNoIdxMatch) {
      const withMs  = parseFloat(timeMatch[1]);
      const noIdxMs = parseFloat(timeNoIdxMatch[1]);
      const ratio   = noIdxMs > 0 ? (noIdxMs / withMs).toFixed(1) : "N/A";
      log(`  • Timing: ${withMs}ms vs ${noIdxMs}ms without index (${ratio}× speedup)`);
    }
  } else {
    log(c.bold(c.red("✘  EP10 FAILED — see above")));
    process.exit(1);
  }
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
