/**
 * EP9 — break.ts
 *
 * The baseline broken state for EP9 is the migration itself:
 * - get_my_notes() returns WHERE author_id = auth.uid()
 * - No null guard on auth.uid()
 * - Calling without a session → empty result, no error
 *
 * This script confirms the broken state is active by calling the RPC
 * without signing in and asserting the silent empty response.
 */

import { c, log, hr, ok, fail, step, requireEnv } from "../../utils.js";
import { createClient } from "@supabase/supabase-js";

async function main() {
  hr();
  log(c.bold(c.yellow("EP9 BREAK — confirm get_my_notes() silent auth failure")));
  hr();

  log("What this confirms:");
  log(c.red("  1. get_my_notes() has no auth.uid() null guard"));
  log(c.red("  2. Called without a session → auth.uid() is NULL"));
  log(c.red("  3. WHERE author_id = NULL matches nothing → empty result, no error"));
  log(c.red("  4. Caller cannot tell 'no notes' from 'not authenticated'"));
  log("");

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey     = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // ── Seed a note so we can prove data EXISTS but won't return ───────────────

  step("Seed", "Inserting a test note via service_role");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // author_id matches neither an auth user nor NULL — data exists in the table
  const { error: seedErr } = await admin
    .from("user_notes")
    .upsert(
      [{
        id:        "e9000000-0000-0000-0000-000000000001",
        author_id: "e9000000-0000-0000-0000-000000000099",
        content:   "EP9 test note — will never appear via unauthenticated RPC",
      }],
      { onConflict: "id" }
    );

  if (seedErr) {
    fail(`Seed failed: ${seedErr.message}`);
    process.exit(1);
  }

  ok("Test note seeded");

  // ── Call get_my_notes() without signing in ─────────────────────────────────

  step("RPC", "Calling get_my_notes() with no session");

  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });

  const { data, error } = await anonClient.rpc("get_my_notes");

  log(`  error : ${error?.message ?? "(none)"}`);
  log(`  rows  : ${Array.isArray(data) ? data.length : "n/a"}`);

  if (!error && Array.isArray(data) && data.length === 0) {
    ok("Confirmed broken state: silent empty result (no error, no rows)");
    log(c.yellow("  ⚠ This is the bug — developer cannot tell if auth failed or data is empty."));
  } else if (error) {
    log(c.grey("  Note: RPC returned an error — function may already be in fixed state."));
    log(c.grey("  Run `pnpm ep9:reset` to restore the unguarded baseline."));
  } else if (Array.isArray(data) && data.length > 0) {
    fail("Unexpected: RPC returned rows without a session — something is very wrong");
    process.exit(1);
  }

  log("");
  log("Next steps:");
  log("  1. pnpm ep9:run    — reproduce the silent failure pattern");
  log("  2. pnpm ep9:fix    — apply the hardened RPC with null guard");
  log("  3. pnpm ep9:verify — confirm all assertions pass");
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
