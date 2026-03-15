/**
 * EP7 — break.ts
 *
 * Confirms the broken state for the Authentication episode:
 *   • user_notes has RLS enabled (set by migration — no DB change needed)
 *   • Seeds one test note via service_role so ep7:run has data to demonstrate
 *     the silent empty-result failure
 *
 * Reset: `pnpm ep7:reset`  →  `supabase db reset` re-applies migrations
 */

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { c, log, hr, ok, fail, step, requireEnv } from "../../utils.js";

async function main() {
  hr();
  log(c.bold(c.yellow("EP7 BREAK — confirm auth + RLS broken state")));
  hr();

  log("What this confirms:");
  log(c.red("  1. user_notes has RLS enabled (policy: author_id = auth.uid())"));
  log(c.red("  2. A note exists in the table (seeded here)"));
  log(c.red("  3. Querying WITHOUT a signed-in user returns empty array — no error"));
  log(c.red("  4. Developer cannot tell 'no data' from 'access denied'"));
  log("");

  // ── 1. Confirm RLS is enabled ────────────────────────────────────────────────

  step("SQL", "Confirming RLS enabled on user_notes");

  const DB_CONTAINER = "supabase_db_supabase-debug-playground";

  try {
    const result = execSync(
      `docker exec ${DB_CONTAINER} psql -U postgres -tAc ` +
      `"SELECT relrowsecurity FROM pg_class WHERE relname='user_notes' AND relnamespace='public'::regnamespace;"`,
      { encoding: "utf-8" }
    ).trim();

    if (result === "t") {
      ok("RLS is enabled on user_notes ✔");
    } else {
      fail("RLS is NOT enabled on user_notes — run `pnpm ep7:reset` to restore baseline");
      process.exit(1);
    }
  } catch (err) {
    fail(`psql check failed: ${err instanceof Error ? err.message : String(err)}`);
    log("  Is Supabase running?  Try: pnpm supabase:start");
    process.exit(1);
  }

  // ── 2. Seed a deterministic test note via service_role ───────────────────────
  // author_id is a deterministic UUID. A real auth user with this ID is created
  // during ep7:verify. For ep7:run (demonstrating silent failure), any UUID works —
  // the key point is that data EXISTS but the unauthenticated query returns nothing.

  step("Seed", "Upserting EP7 test note (id: e7000000-0000-0000-0000-000000000011)");

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceKey  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin
    .from("user_notes")
    .upsert(
      [{
        id:        "e7000000-0000-0000-0000-000000000011",
        author_id: "e7000000-0000-0000-0000-000000000001",
        content:   "EP7 test note — only visible when authenticated as the owner",
      }],
      { onConflict: "id" }
    );

  if (error) {
    fail(`Could not seed EP7 test note: ${error.message}`);
    process.exit(1);
  }

  ok("EP7 test note seeded");
  log("");
  log("Next steps:");
  log("  1. pnpm ep7:run    — see the silent empty response (no auth = no rows)");
  log("  2. Diagnose: confirm RLS is on, note exists, auth.uid() is NULL");
  log("  3. pnpm ep7:fix    — apply the sign-in fix (informational)");
  log("  4. pnpm ep7:verify — confirm all 3 auth states pass");
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
