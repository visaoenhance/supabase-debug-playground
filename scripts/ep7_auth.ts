/**
 * Episode 7 — Authentication & Row Level Security
 * ─────────────────────────────────────────────────────────────────────────────
 * RLS with auth.uid() is only meaningful when a real JWT is present.
 * This episode demonstrates the 3-state auth reality:
 *   1. No session         → user_notes returns empty (data leaked via no session)
 *   2. Wrong user session → user_notes returns empty (RLS scoped to uid)
 *   3. Owner session      → user_notes returns the owner's rows
 *
 * RUN: Shows states 1 and 2 side-by-side using a seeded note.
 *      The "silent empty" from state 1 is the core bug moment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  parseMode,
  c, log, hr, step, ok, fail, warn, labelledJson,
  requireEnv,
} from "./utils.js";
import { createClient } from "@supabase/supabase-js";

// ── helpers ───────────────────────────────────────────────────────────────────

const NOTE_ID = "e7000000-0000-0000-0000-000000000011";

async function main() {
  const mode = parseMode();

  if (mode === "break") {
    // Delegate to subcommand
    const { execSync } = await import("node:child_process");
    execSync("tsx scripts/episodes/ep7/break.ts", { stdio: "inherit" });
    return;
  }

  if (mode === "verify") {
    const { execSync } = await import("node:child_process");
    execSync("tsx scripts/episodes/ep7/verify.ts", { stdio: "inherit" });
    return;
  }

  // ── RUN mode: demonstrate the 3-state auth problem ──────────────────────────

  hr();
  log(c.bold(c.cyan("▶ EP7 RUN — Authentication & RLS: 3-state demo")));
  hr();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey     = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Create two users (owner + other) ─────────────────────────────────────

  step("Setup", "Creating owner and other test users");

  const ts = Date.now();
  const ownerEmail = `ep7-owner-${ts}@example.com`;
  const otherEmail = `ep7-other-${ts}@example.com`;
  const pass = "password-ep7";

  const { data: ownerUser, error: e1 } = await admin.auth.admin.createUser({
    email: ownerEmail, password: pass, email_confirm: true,
  });
  const { data: otherUser, error: e2 } = await admin.auth.admin.createUser({
    email: otherEmail, password: pass, email_confirm: true,
  });

  if (e1 || !ownerUser?.user || e2 || !otherUser?.user) {
    fail(`Could not create test users: ${e1?.message ?? e2?.message ?? "unknown"}`);
    process.exit(1);
  }

  ok(`Owner: ${ownerEmail}`);
  ok(`Other: ${otherEmail}`);

  // ── Seed a note for the owner ─────────────────────────────────────────────

  step("Seed", "Inserting note for owner via service_role");

  await admin.from("user_notes").delete().eq("author_id", ownerUser.user.id);

  const { error: seedErr } = await admin
    .from("user_notes")
    .insert({ author_id: ownerUser.user.id, content: "EP7 run note" });

  if (seedErr) {
    fail(`Seed failed: ${seedErr.message}`);
    await cleanup(admin, ownerUser.user.id, otherUser.user.id);
    process.exit(1);
  }

  ok("Note seeded");

  // ── State 1: No session (unauthenticated) ────────────────────────────────

  log("");
  log(c.bold("State 1 — No session (unauthenticated)"));
  log(c.grey("  Uses anon key with no JWT. RLS returns empty — no error, no data."));

  const noSessionClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: d1, error: err1 } = await noSessionClient.from("user_notes").select("*");

  if (err1) {
    log(`  Error: ${err1.message}`);
  } else {
    labelledJson("  Result", d1);
  }

  if (!err1 && Array.isArray(d1) && d1.length === 0) {
    warn("State 1: Empty result — silent failure (the bug). No error, no indication of why.");
  } else if (err1) {
    ok("State 1: Error returned — explicit failure");
  }

  // ── State 2: Wrong user session ──────────────────────────────────────────

  log("");
  log(c.bold("State 2 — Wrong user session (other user)"));
  log(c.grey("  Signed in as the *other* user. RLS scopes to their uid — owner's note hidden."));

  const otherClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await otherClient.auth.signInWithPassword({ email: otherEmail, password: pass });

  const { data: d2, error: err2 } = await otherClient.from("user_notes").select("*");

  if (err2) {
    log(`  Error: ${err2.message}`);
  } else {
    labelledJson("  Result", d2);
  }

  if (!err2 && Array.isArray(d2) && d2.length === 0) {
    ok("State 2: Empty result — correct (other user's notes not visible to this user)");
  }

  // ── State 3 hint ─────────────────────────────────────────────────────────

  log("");
  log(c.bold("State 3 — Owner session (see ep7:fix for the full demo)"));
  log(c.grey("  Run `pnpm ep7:fix` to see the owner's authenticated state."));
  log(c.grey("  Run `pnpm ep7:verify` for the full 3-assertion verification."));

  // ── Summary───────────────────────────────────────────────────────────────

  hr();
  log(c.bold("3-State Summary:"));
  log(`  State 1 (no session) : ${err1 ? c.red("ERROR") : d1?.length === 0 ? c.yellow("empty (silent)") : c.green("data returned")}`);
  log(`  State 2 (wrong user) : ${err2 ? c.red("ERROR") : d2?.length === 0 ? c.green("empty (correct)") : c.yellow("unexpected data")}`);
  log(`  State 3 (owner)      : run \`pnpm ep7:fix\` or \`pnpm ep7:verify\``);
  log("");
  log("The confusion: States 1 and 2 both return empty with no error.");
  log("Without understanding auth context, both look identical to a developer.");

  // ── Cleanup ───────────────────────────────────────────────────────────────

  await cleanup(admin, ownerUser.user.id, otherUser.user.id);

  hr();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanup(admin: any, ...userIds: string[]) {
  for (const id of userIds) {
    await admin.auth.admin.deleteUser(id);
  }
  ok("Test users cleaned up");
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
