/**
 * EP7 — verify.ts
 *
 * PASS criteria (all three must pass):
 *   ✔ Unauthenticated query → returns empty array, no error (silent block)
 *   ✔ Wrong-user authenticated → returns empty array, no error (RLS scoped)
 *   ✔ Owner authenticated → returns the owner's note row(s)
 *
 * Also confirms:
 *   ✔ RLS is enabled on user_notes (relrowsecurity = t)
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step, requireEnv } from "../../utils.js";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

async function main() {
  hr();
  log(c.bold(c.green("EP7 VERIFY — Authentication: 3-state RLS check")));
  hr();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey     = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let passed = true;

  // ── Preflight: confirm RLS is enabled ──────────────────────────────────────

  step("Preflight", "Confirm RLS is enabled on user_notes");

  const rlsResult = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -tAc ` +
    `"SELECT relrowsecurity FROM pg_class WHERE relname='user_notes' AND relnamespace='public'::regnamespace;"`,
    { encoding: "utf-8" }
  ).trim();

  if (rlsResult === "t") {
    ok("RLS enabled on user_notes ✔");
  } else {
    fail("RLS is NOT enabled — run `pnpm ep7:reset` then re-run verify");
    process.exit(1);
  }

  // ── Create two deterministic test users ────────────────────────────────────

  step("Setup", "Creating owner and other user via admin API");

  const ownerEmail    = `ep7-owner-${Date.now()}@example.com`;
  const ownerPassword = "password-ep7-owner";
  const otherEmail    = `ep7-other-${Date.now()}@example.com`;
  const otherPassword = "password-ep7-other";

  const { data: ownerData, error: ownerErr } = await admin.auth.admin.createUser({
    email: ownerEmail, password: ownerPassword, email_confirm: true,
  });
  const { data: otherData, error: otherErr } = await admin.auth.admin.createUser({
    email: otherEmail, password: otherPassword, email_confirm: true,
  });

  if (ownerErr || !ownerData?.user || otherErr || !otherData?.user) {
    fail(`Could not create test users: ${ownerErr?.message ?? otherErr?.message ?? "unknown"}`);
    process.exit(1);
  }

  ok(`Owner: ${ownerEmail}`);
  ok(`Other: ${otherEmail}`);

  const ownerId = ownerData.user.id;
  const otherId = otherData.user.id;

  // ── Seed one note owned by the owner ──────────────────────────────────────

  step("Seed", "Inserting note owned by owner via service_role");

  const { data: seedData, error: seedErr } = await admin
    .from("user_notes")
    .insert({ author_id: ownerId, content: "EP7 verify note — owner-only" })
    .select()
    .single();

  if (seedErr || !seedData) {
    fail(`Seed failed: ${seedErr?.message ?? "no row returned"}`);
    await cleanup(admin, ownerId, otherId);
    process.exit(1);
  }

  ok(`Note seeded with id: ${seedData.id}`);

  // ── Test 1: unauthenticated (must return empty — silent block) ────────────

  log("");
  log(c.bold("Test 1 — unauthenticated anon (must return empty, no error)"));

  const unauthClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  const { data: t1Data, error: t1Err } = await unauthClient
    .from("user_notes").select();

  if (t1Err) {
    // Explicit error is also acceptable — unauthenticated must not receive data
    ok("Unauthenticated: returned explicit error (access correctly denied)");
  } else if ((t1Data?.length ?? 0) === 0) {
    ok("Unauthenticated: returned empty array (silent block — auth.uid() is NULL)");
  } else {
    fail(`Unauthenticated returned ${t1Data?.length} row(s) — RLS may be disabled`);
    passed = false;
  }

  // ── Test 2: authenticated as wrong user (must return empty) ───────────────

  log("");
  log(c.bold("Test 2 — wrong-user authenticated (must return empty — RLS scoped)"));

  const otherClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: otherSignIn } = await otherClient.auth.signInWithPassword({
    email: otherEmail, password: otherPassword,
  });

  if (otherSignIn) {
    fail(`Could not sign in as other user: ${otherSignIn.message}`);
    await cleanup(admin, ownerId, otherId);
    process.exit(1);
  }

  const { data: t2Data, error: t2Err } = await otherClient
    .from("user_notes").select();

  if (t2Err) {
    ok("Wrong user: returned explicit error (RLS correctly blocked)");
  } else if ((t2Data?.length ?? 0) === 0) {
    ok("Wrong user: returned empty array (RLS scoped to author_id = auth.uid())");
  } else {
    fail(`Wrong user returned ${t2Data?.length} row(s) — RLS policy may be too permissive`);
    passed = false;
  }

  // ── Test 3: authenticated as owner (must return the note) ─────────────────

  log("");
  log(c.bold("Test 3 — owner authenticated (must return their note(s))"));

  const ownerClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: ownerSignIn } = await ownerClient.auth.signInWithPassword({
    email: ownerEmail, password: ownerPassword,
  });

  if (ownerSignIn) {
    fail(`Could not sign in as owner: ${ownerSignIn.message}`);
    await cleanup(admin, ownerId, otherId);
    process.exit(1);
  }

  const { data: t3Data, error: t3Err } = await ownerClient
    .from("user_notes").select();

  if (t3Err) {
    fail(`Owner query failed: ${t3Err.message}`);
    passed = false;
  } else if ((t3Data?.length ?? 0) > 0) {
    ok(`Owner: returned ${t3Data!.length} row(s) ✔`);
  } else {
    fail("Owner query returned empty — check seed data and RLS policy");
    passed = false;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  await cleanup(admin, ownerId, otherId);

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP7 PASSED")));
    log("  • Unauthenticated: no data leaked");
    log("  • Wrong user: no data leaked");
    log("  • Owner: data correctly returned");
  } else {
    log(c.bold(c.red("✘  EP7 FAILED — see above for details")));
    process.exit(1);
  }
  hr();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanup(admin: ReturnType<typeof createClient<any>>, ...userIds: string[]) {
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id);
  }
  ok("Test users cleaned up");
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
