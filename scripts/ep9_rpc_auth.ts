/**
 * Episode 9 — RPC Auth Context
 * ─────────────────────────────────────────────────────────────────────────────
 * PostgreSQL functions run in a specific security context. When auth.uid() is
 * used inside a SECURITY INVOKER function but no null guard is present, an
 * unauthenticated caller silently gets an empty result set instead of an error.
 *
 * BREAK  : Confirms the baseline get_my_notes() function has no null guard.
 *          Calls the function without a session — shows the silent empty result.
 *
 * RUN    : Calls get_my_notes() without signing in (silent empty in break state;
 *          explicit PT401 error in fixed state). Shows the caller's perspective.
 *
 * VERIFY : Full check — unauthenticated call must raise PT401, authenticated
 *          call returns scoped rows, function definition confirmed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  parseMode,
  c, log, hr, step, ok, fail, warn, labelledJson,
  requireEnv,
} from "./utils.js";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

async function main() {
  const mode = parseMode();

  if (mode === "break") {
    execSync("tsx scripts/episodes/ep9/break.ts", { stdio: "inherit" });
    return;
  }

  if (mode === "verify") {
    execSync("tsx scripts/episodes/ep9/verify.ts", { stdio: "inherit" });
    return;
  }

  // ── RUN mode: call get_my_notes() without a session ─────────────────────

  hr();
  log(c.bold(c.cyan("▶ EP9 RUN — RPC Auth Context: unauthenticated call demo")));
  hr();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey     = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // ── Detect current function state ────────────────────────────────────────

  step("Preflight", "Inspecting get_my_notes() function definition");

  let hasPT401 = false;

  try {
    const prosrc = execSync(
      `docker exec ${DB_CONTAINER} psql -U postgres -tAc ` +
      `"SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace ` +
      `WHERE p.proname = 'get_my_notes' AND n.nspname = 'public';"`,
      { encoding: "utf-8" }
    ).trim();

    hasPT401 = prosrc.includes("PT401") || prosrc.includes("not authenticated");

    if (hasPT401) {
      ok("Function body contains auth null guard (fixed state)");
      log("  → This run will show an explicit error on unauthenticated call.");
    } else {
      warn("Function body has no auth null guard (broken state)");
      log("  → This run will show a silent empty result.");
      log("  → Run `pnpm ep9:fix` to add the null guard, then `pnpm ep9:run` again.");
    }
  } catch {
    warn("Could not inspect function definition — continuing");
  }

  // ── Seed a note so there is something to find ────────────────────────────

  step("Seed", "Inserting a note via service_role (to confirm there IS data)");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Create a temp user and seed a note for them
  const ts    = Date.now();
  const email = `ep9-run-${ts}@example.com`;
  const pass  = "password-ep9-run";

  const { data: userdata, error: createErr } = await admin.auth.admin.createUser({
    email, password: pass, email_confirm: true,
  });

  if (createErr || !userdata?.user) {
    fail(`Could not create test user: ${createErr?.message ?? "unknown"}`);
    process.exit(1);
  }

  const userId = userdata.user.id;

  await admin.from("user_notes").insert({ author_id: userId, content: "EP9 run note" });
  ok(`Seeded note for user ${email}`);

  // ── State 1: call without signing in ────────────────────────────────────

  log("");
  log(c.bold("State 1 — Unauthenticated call (no session)"));
  log(c.grey("  Uses anon key, no JWT. auth.uid() returns NULL."));

  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: d1, error: err1 } = await anonClient.rpc("get_my_notes");

  if (err1) {
    log(`  Error code   : ${err1.code}`);
    log(`  Error message: ${err1.message}`);
    ok("Explicit error returned (fixed state behaviour)");
  } else {
    labelledJson("  Result", d1);
    if (Array.isArray(d1) && d1.length === 0) {
      warn("Silent empty result — this is the bug (broken state).");
      log("  There IS a note seeded above, yet the function returns [].");
      log("  A developer would see this and assume there's just no data.");
    }
  }

  // ── State 2: call after signing in ──────────────────────────────────────

  log("");
  log(c.bold("State 2 — Authenticated call (owner)"));
  log(c.grey("  Signs in as the note owner. auth.uid() returns their real UUID."));

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  await authClient.auth.signInWithPassword({ email, password: pass });

  const { data: d2, error: err2 } = await authClient.rpc("get_my_notes");

  if (err2) {
    log(`  Error: ${err2.message}`);
    fail("Authenticated call returned error — check function definition");
  } else {
    labelledJson("  Result", d2);
    if (Array.isArray(d2) && d2.length > 0) {
      ok(`Authenticated call returned ${d2.length} row(s) ✔`);
    } else {
      warn("Authenticated call returned empty — unexpected");
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  hr();
  log(c.bold("Side-by-side:"));
  log(`  Unauthenticated : ${err1 ? c.red("ERROR ← explicit (fixed)") : c.yellow("empty ← silent bug (broken)")}`);
  log(`  Authenticated   : ${err2 ? c.red("ERROR") : Array.isArray(d2) && d2.length > 0 ? c.green("data returned ✔") : c.yellow("empty")}`);
  log("");
  if (!hasPT401) {
    log("Root cause: get_my_notes() has no null guard on auth.uid().");
    log("Fix: RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'PT401' when auth.uid() IS NULL.");
    log("Run: pnpm ep9:fix");
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  await (admin.auth.admin as any).deleteUser(userId);
  ok("Test user cleaned up");

  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
