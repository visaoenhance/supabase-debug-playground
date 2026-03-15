/**
 * EP10 — fix.ts
 *
 * Restores receipts_created_at_idx and refreshes planner statistics.
 * Then prints an EXPLAIN to confirm Index Scan is chosen.
 *
 * Note: CREATE INDEX CONCURRENTLY is suitable for production (it doesn't
 * hold a table lock) but cannot be used inside a transaction block.
 * In this harness we use a plain CREATE INDEX; CONCURRENTLY is called out
 * in the prompts as the production-safe variant.
 */

import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step } from "../../utils.js";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

function psql(sql: string): string {
  return execSync(
    `docker exec -i ${DB_CONTAINER} psql -U postgres -tAc`,
    { encoding: "utf-8", input: sql }
  ).trim();
}

async function main() {
  hr();
  log(c.bold(c.green("EP10 FIX — Query Performance: restoring receipts_created_at_idx")));
  hr();

  // ── Preflight: no index yet ───────────────────────────────────────────────

  step("Preflight", "Confirming index is absent");

  const before = psql(
    "SELECT COUNT(*) FROM pg_indexes " +
    "WHERE tablename = 'receipts' AND indexname = 'receipts_created_at_idx';"
  );

  if (before !== "0") {
    log(c.yellow("⚠  Index already exists — run `pnpm ep10:break` first, then retry."));
    process.exit(0);
  }

  ok("Index absent — ready to fix");

  // ── Create the index ──────────────────────────────────────────────────────

  step("Create index", "receipts(created_at DESC)");

  execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -c ` +
    `"CREATE INDEX IF NOT EXISTS receipts_created_at_idx ON public.receipts (created_at DESC);"`,
    { stdio: ["pipe", "inherit", "pipe"] }
  );

  const after = psql(
    "SELECT COUNT(*) FROM pg_indexes " +
    "WHERE tablename = 'receipts' AND indexname = 'receipts_created_at_idx';"
  );

  if (after !== "1") {
    fail("Index still absent after CREATE — check permissions");
    process.exit(1);
  }

  ok("Index receipts_created_at_idx created ✔");

  // ── Update stats ──────────────────────────────────────────────────────────

  step("Analyze", "Refreshing planner statistics");

  execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -c "ANALYZE public.receipts;"`,
    { stdio: ["pipe", "inherit", "pipe"] }
  );

  ok("ANALYZE complete");

  // ── Confirm Index Scan ────────────────────────────────────────────────────

  step("EXPLAIN", "Verifying planner uses index");

  const plan = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -c ` +
    `"EXPLAIN SELECT id, title, amount, created_at FROM public.receipts ` +
    `WHERE created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC LIMIT 25;"`,
    { encoding: "utf-8" }
  );

  log(plan);

  if (plan.includes("Index Scan") || plan.includes("Bitmap Index Scan") || plan.includes("Index Only Scan")) {
    ok("Index Scan confirmed — fix applied ✔");
  } else if (plan.includes("Seq Scan")) {
    log(c.yellow("⚠  Planner still chose Seq Scan — data volume may be below planner threshold."));
    log("   This is expected on an empty or small dataset.");
    log("   Run `pnpm supabase:reset` to seed 10k rows, then check again.");
  } else {
    log(c.yellow("⚠  Unexpected plan — inspect the output above manually."));
  }

  hr();
  log(c.bold(c.green("EP10 FIXED ✔")));
  log("Index restored — run `pnpm ep10:verify` to validate.");
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
