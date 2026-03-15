/**
 * EP7 — fix.ts
 *
 * Demonstrates the correct client pattern: sign in before querying a
 * RLS-protected table. This is an informational/educational fix — it shows
 * the query working after sign-in rather than making a DB schema change.
 *
 * The fix is CLIENT-SIDE: add supabase.auth.signInWithPassword() before
 * calling .from('user_notes').select().
 */

import { createClient } from "@supabase/supabase-js";
import { c, log, hr, ok, fail, step, requireEnv } from "../../utils.js";

async function main() {
  hr();
  log(c.bold(c.green("EP7 FIX — demonstrating the sign-in pattern")));
  hr();

  log("Fix applied:");
  log(c.green("  1. supabase.auth.signInWithPassword({ email, password })"));
  log(c.green("  2. Re-issue .from('user_notes').select() — now returns rows"));
  log(c.green("  3. RLS policy (author_id = auth.uid()) is satisfied after sign-in"));
  log("");
  log(c.grey("  Note: This creates a temporary auth user, queries, then cleans up."));
  log(c.grey("  Run pnpm ep7:verify for the full 3-state assertion suite."));
  log("");

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey     = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Create a one-time demo user ─────────────────────────────────────────────

  step("Auth", "Creating temporary demo user via admin API");

  const email    = `ep7-fix-demo-${Date.now()}@example.com`;
  const password = "password-ep7-fix";

  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr || !newUser?.user) {
    fail(`Could not create demo user: ${createErr?.message ?? "unknown"}`);
    process.exit(1);
  }

  const userId = newUser.user.id;
  ok(`Demo user created: ${email}`);

  // ── Seed a note owned by this user ──────────────────────────────────────────

  step("Seed", "Inserting a note owned by demo user");

  const { error: seedErr } = await admin
    .from("user_notes")
    .insert({ author_id: userId, content: "EP7 fix demo note" });

  if (seedErr) {
    fail(`Could not seed demo note: ${seedErr.message}`);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  ok("Demo note inserted");

  // ── ❌ BROKEN: query without sign-in ───────────────────────────────────────

  step("Query", "❌ Without sign-in: .from('user_notes').select()");

  const unauthClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  const { data: unauthData, error: unauthErr } = await unauthClient
    .from("user_notes")
    .select();

  log(`  error : ${unauthErr?.message ?? "(none)"}`);
  log(`  rows  : ${unauthData?.length ?? 0}`);
  if (!unauthErr && (unauthData?.length ?? 0) === 0) {
    log(c.yellow("  ⚠ Silent empty result — this is the bug. No error, no data."));
  }

  // ── ✅ FIXED: query after sign-in ──────────────────────────────────────────

  step("Auth", "✅ With sign-in: signInWithPassword() then .select()");

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });

  const { error: signInErr } = await authClient.auth.signInWithPassword({ email, password });

  if (signInErr) {
    fail(`Sign-in failed: ${signInErr.message}`);
    await admin.auth.admin.deleteUser(userId);
    process.exit(1);
  }

  ok("Signed in");

  const { data: authData, error: authErr } = await authClient
    .from("user_notes")
    .select();

  if (authErr) {
    fail(`Authed query failed: ${authErr.message}`);
  } else {
    ok(`Authed query returned ${authData?.length ?? 0} row(s) ✔`);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  await admin.auth.admin.deleteUser(userId);
  ok("Demo user cleaned up");

  log("");
  log("Next steps:");
  log("  • pnpm ep7:verify — run the full 3-state assertion pass/fail check");
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
