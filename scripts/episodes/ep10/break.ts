/**
 * EP10 — break.ts
 *
 * Staging state: index exists (from migration 000006).
 * Break: drop the index so the receipts query must Seq Scan.
 *
 * Also runs ANALYZE so planner stats are fresh, then prints EXPLAIN
 * output showing the Seq Scan (confirms the broken state).
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

async function main() {
  hr();
  log(c.bold(c.yellow("EP10 BREAK — Query Performance: dropping receipts_created_at_idx")));
  hr();

  // ── Confirm index exists before breaking ─────────────────────────────────

  step("Preflight", "Confirming index exists");

  const idxExists = psql(
    "SELECT COUNT(*) FROM pg_indexes " +
    "WHERE tablename = 'receipts' AND indexname = 'receipts_created_at_idx';"
  );

  if (idxExists === "0") {
    fail("Index receipts_created_at_idx not found — run `pnpm supabase:reset` first");
    process.exit(1);
  }

  ok("Index receipts_created_at_idx exists — ready to break");

  // ── Drop the index ────────────────────────────────────────────────────────

  step("Break", "Dropping index");

  psql("DROP INDEX IF EXISTS receipts_created_at_idx;");

  const gone = psql(
    "SELECT COUNT(*) FROM pg_indexes " +
    "WHERE tablename = 'receipts' AND indexname = 'receipts_created_at_idx';"
  );

  if (gone !== "0") {
    fail("Index still present — DROP failed");
    process.exit(1);
  }

  ok("Index dropped ✔");

  // ── Update stats ──────────────────────────────────────────────────────────

  step("Analyze", "Refreshing planner statistics");

  execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -c "ANALYZE public.receipts;"`,
    { stdio: ["pipe", "inherit", "pipe"] }
  );

  ok("ANALYZE complete");

  // ── Confirm Seq Scan ──────────────────────────────────────────────────────

  step("EXPLAIN", "Verifying planner chooses Seq Scan");

  const plan = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -c ` +
    `"EXPLAIN SELECT id, title, amount, created_at FROM public.receipts ` +
    `WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 25;"`,
    { encoding: "utf-8" }
  );

  log(plan);

  if (plan.includes("Seq Scan")) {
    ok("Seq Scan confirmed — broken state active ✔");
  } else {
    log(c.yellow("⚠  Seq Scan not confirmed — planner may still use another path with small data"));
    log("   This is expected if the table has fewer rows than the planner threshold.");
    log("   Seed with `pnpm supabase:reset` then re-run to populate 10k rows.");
  }

  hr();
  log(c.bold(c.yellow("EP10 BROKEN ✔")));
  log("Index removed — receipts queries now require full table scan.");
  log("Run `pnpm ep10:fix` to restore the index.");
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
