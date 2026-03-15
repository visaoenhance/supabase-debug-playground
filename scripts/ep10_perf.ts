/**
 * Episode 10 — Query Performance & Indexing
 * ─────────────────────────────────────────────────────────────────────────────
 * Missing indexes cause full table scans that scale linearly with row count.
 * This episode demonstrates:
 *   • EXPLAIN plan shape changing from Seq Scan → Index Scan after adding an index
 *   • Timing difference on 10k rows with a date-range query
 *
 * BREAK  : Drops receipts_created_at_idx — query must Seq Scan.
 * RUN    : Runs EXPLAIN ANALYZE on the receipts date-range query and prints
 *          the plan, highlighting whether it's a Seq Scan or Index Scan.
 * VERIFY : Full check — index present, plan shape confirmed, timing captured.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  parseMode,
  c, log, hr, step, ok, fail, warn,
} from "./utils.js";
import { execSync } from "node:child_process";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

const QUERY =
  "SELECT id, title, amount, created_at FROM public.receipts " +
  "WHERE created_at > NOW() - INTERVAL '7 days' " +
  "ORDER BY created_at DESC LIMIT 25";

function psqlt(sql: string): string {
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
  const mode = parseMode();

  if (mode === "break") {
    execSync("tsx scripts/episodes/ep10/break.ts", { stdio: "inherit" });
    return;
  }

  if (mode === "verify") {
    execSync("tsx scripts/episodes/ep10/verify.ts", { stdio: "inherit" });
    return;
  }

  // ── RUN mode: EXPLAIN ANALYZE and show the current plan ─────────────────

  hr();
  log(c.bold(c.cyan("▶ EP10 RUN — Query Performance: EXPLAIN ANALYZE")));
  hr();

  // ── Context: row count and index state ───────────────────────────────────

  step("Preflight", "Checking table state");

  const rowCount = psqlt("SELECT COUNT(*) FROM public.receipts;");
  log(`  Rows in receipts: ${parseInt(rowCount, 10).toLocaleString()}`);

  if (parseInt(rowCount, 10) < 1000) {
    warn("Row count is low — run `pnpm supabase:reset` to seed 10k rows for a meaningful test.");
  } else {
    ok(`${parseInt(rowCount, 10).toLocaleString()} rows present ✔`);
  }

  const idxCount = psqlt(
    "SELECT COUNT(*) FROM pg_indexes " +
    "WHERE tablename = 'receipts' AND indexname = 'receipts_created_at_idx';"
  );

  if (idxCount === "1") {
    ok("receipts_created_at_idx EXISTS — in fixed state");
    log("  → Planner should choose Index Scan.");
    log("  → Run `pnpm ep10:break` to drop the index and see Seq Scan.");
  } else {
    warn("receipts_created_at_idx ABSENT — in broken state");
    log("  → Planner must use Seq Scan.");
    log("  → Run `pnpm ep10:fix` to restore the index.");
  }

  // ── Run EXPLAIN ANALYZE ───────────────────────────────────────────────────

  step("EXPLAIN ANALYZE", "Running query plan analysis");
  psqlt("ANALYZE public.receipts;");

  const plan = psqlFull(`EXPLAIN (ANALYZE, BUFFERS) ${QUERY}`);
  log(plan);

  // ── Interpret the plan ────────────────────────────────────────────────────

  const timeMatch = plan.match(/Execution Time:\s+([\d.]+) ms/);
  const isSeq   = plan.includes("Seq Scan");
  const isIndex = plan.includes("Index Scan") || plan.includes("Index Only Scan") || plan.includes("Bitmap Index Scan");

  hr();
  log(c.bold("Plan interpretation:"));

  if (isIndex) {
    log(c.green("  Plan shape : Index Scan ✔"));
    if (timeMatch) log(`  Exec time  : ${timeMatch[1]} ms`);
    log("");
    log("  The index is present and the planner is using it.");
    log("  Run `pnpm ep10:break` to drop the index and observe the Seq Scan.");
  } else if (isSeq) {
    log(c.yellow("  Plan shape : Seq Scan  ← full table scan"));
    if (timeMatch) log(`  Exec time  : ${timeMatch[1]} ms`);
    log("");
    log("  The query is doing a full table scan.");
    if (parseInt(rowCount, 10) < 1000) {
      log("  This is normal with a small table — planner prefers Seq Scan below threshold.");
      log("  Seed 10k rows with `pnpm supabase:reset` to see the real performance difference.");
    } else {
      log("  With 1k+ rows, this is the performance bug.");
      log("  Fix: `CREATE INDEX receipts_created_at_idx ON receipts(created_at DESC);`");
      log("  Or:  pnpm ep10:fix");
    }
  } else {
    log(c.grey("  Could not identify plan shape — inspect output above."));
  }
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
