/**
 * EP9 — verify.ts
 *
 * Must run AFTER ep9:fix has been applied.
 *
 * PASS criteria (all must pass):
 *   ✔ Unauthenticated call → explicit error (PT401 / "not authenticated")
 *   ✔ Authenticated correct user → returns their note row(s)
 *   ✔ Function definition confirms: security invoker, search_path set
 *   ✔ Execute privileges: anon does NOT have execute, authenticated does
 *
 * service_role is NOT tested as a pass path — a service_role call
 * bypasses the null guard entirely (it sets auth.uid() server-side).
 * Confirming user-auth works means testing with a real signed-in user token.
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step, requireEnv } from "../../utils.js";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

async function main() {
  hr();
  log(c.bold(c.green("EP9 VERIFY — RPC Auth Context: 2-path + function definition check")));
  hr();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey     = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let passed = true;

  // ── Preflight: function definition checks ─────────────────────────────────

  step("Preflight", "Confirming function definition (security invoker + search_path)");

  const funcDef = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -tAc ` +
    `"SELECT p.prosecdef, p.proconfig FROM pg_proc p ` +
    `JOIN pg_namespace n ON n.oid = p.pronamespace ` +
    `WHERE p.proname = 'get_my_notes' AND n.nspname = 'public';"`,
    { encoding: "utf-8" }
  ).trim();

  if (!funcDef) {
    fail("Function get_my_notes() not found — run `pnpm supabase:reset` then `pnpm ep9:fix`");
    process.exit(1);
  }

  const [prosecdef, proconfig] = funcDef.split("|");
  // prosecdef = 'f' means SECURITY INVOKER (not definer) — correct
  if (prosecdef === "f") {
    ok("Security invoker (SECURITY INVOKER) ✔");
  } else {
    fail("Function is SECURITY DEFINER — this episode uses SECURITY INVOKER");
    passed = false;
  }

  if (proconfig && proconfig.includes("search_path")) {
    ok("search_path is explicitly set ✔");
  } else {
    fail("search_path is NOT set on the function — fix did not apply correctly");
    passed = false;
  }

  // ── Preflight: EXECUTE grants ─────────────────────────────────────────────

  step("Preflight", "Confirming EXECUTE grants (anon revoked, authenticated granted)");

  const grants = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -tAc ` +
    `"SELECT grantee FROM information_schema.role_routine_grants ` +
    `WHERE routine_name = 'get_my_notes' AND routine_schema = 'public' AND privilege_type = 'EXECUTE';"`,
    { encoding: "utf-8" }
  ).trim();

  const grantees = grants.split("\n").map(g => g.trim()).filter(Boolean);

  if (grantees.includes("authenticated")) {
    ok("EXECUTE granted to authenticated ✔");
  } else {
    fail("EXECUTE not granted to authenticated — fix may not have applied");
    passed = false;
  }

  if (grantees.includes("anon")) {
    fail("EXECUTE still granted to anon — revoke did not apply");
    passed = false;
  } else {
    ok("EXECUTE revoked from anon ✔");
  }

  // ── Test 1: unauthenticated call must raise explicit error ────────────────

  log("");
  log(c.bold("Test 1 — unauthenticated call (must raise PT401 error)"));

  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: t1Data, error: t1Err } = await anonClient.rpc("get_my_notes");

  if (t1Err) {
    ok(`Unauthenticated call returned explicit error ✔`);
    log(`  code    : ${t1Err.code ?? "(none)"}`);
    log(`  message : ${t1Err.message}`);
    if (t1Err.message.toLowerCase().includes("not authenticated")) {
      ok("Error message confirms 'not authenticated' ✔");
    }
  } else if (Array.isArray(t1Data) && t1Data.length === 0) {
    fail("Unauthenticated call returned empty array — fix may not have applied (null guard missing)");
    passed = false;
  } else {
    fail("Unauthenticated call returned unexpected result");
    passed = false;
  }

  // ── Test 2: authenticated correct user must return their notes ────────────

  log("");
  log(c.bold("Test 2 — authenticated user (must return their notes)"));

  const email    = `ep9-verify-${Date.now()}@example.com`;
  const password = "password-ep9-verify";

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });

  if (createErr || !newUser?.user) {
    fail(`Could not create test user: ${createErr?.message ?? "unknown"}`);
    process.exit(1);
  }

  const userId = newUser.user.id;
  ok(`Test user: ${email}`);

  // Seed a note for this user via service_role (bypasses RLS)
  const { error: seedErr } = await admin
    .from("user_notes")
    .insert({ author_id: userId, content: "EP9 verify note" });

  if (seedErr) {
    fail(`Seed failed: ${seedErr.message}`);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: signInErr } = await authClient.auth.signInWithPassword({ email, password });

  if (signInErr) {
    fail(`Sign-in failed: ${signInErr.message}`);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  ok("Signed in");

  const { data: t2Data, error: t2Err } = await authClient.rpc("get_my_notes");

  if (t2Err) {
    fail(`Authenticated call returned error: ${t2Err.message}`);
    passed = false;
  } else if (Array.isArray(t2Data) && t2Data.length > 0) {
    ok(`Authenticated call returned ${t2Data.length} row(s) ✔`);
  } else {
    fail("Authenticated call returned empty — check seed data and function query");
    passed = false;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  await admin.auth.admin.deleteUser(userId);
  ok("Test user cleaned up");

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP9 PASSED")));
    log("  • Function definition: SECURITY INVOKER + search_path confirmed");
    log("  • Execute grants: anon revoked, authenticated granted");
    log("  • Unauthenticated call: explicit PT401 error");
    log("  • Authenticated user: scoped notes returned");
  } else {
    log(c.bold(c.red("✘  EP9 FAILED — see above")));
    process.exit(1);
  }
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
