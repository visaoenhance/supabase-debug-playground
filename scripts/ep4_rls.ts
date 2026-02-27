/**
 * Episode 4 — RLS / Policy vs Keys
 * ─────────────────────────────────────────────────────────────────────────────
 * Row Level Security (RLS) is one of the top sources of Supabase confusion.
 * This episode demonstrates:
 *   • RLS enabled with no INSERT policy  → anon insert blocked, service role works
 *   • Same insert with service_role key  → bypasses RLS, always works
 *   • Correct INSERT policy with WITH CHECK → anon insert allowed when authenticated
 *
 * BREAK  : Enables RLS on receipts AND drops the INSERT policy, so anon
 *          inserts are silently blocked (or return empty data, depending on version).
 *
 * RUN    : Attempts the same insert with BOTH anon key AND service role key;
 *          shows the difference side-by-side.
 *
 * VERIFY : Adds back the correct INSERT policy (authenticated only), signs in
 *          a test user with the service role admin API, then confirms anon-authed
 *          insert works while unauthenticated anon insert is blocked.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  parseMode,
  anonClient, serviceClient, requireEnv,
  c, log, hr, step, ok, fail, warn, labelledJson,
} from "./utils.js";
import { execSync } from "node:child_process";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── SQL fragments ────────────────────────────────────────────────────────────

const ENABLE_RLS_DROP_POLICY = `
-- ❌ BREAK: enable RLS but drop the INSERT policy
alter table public.receipts enable row level security;

drop policy if exists "receipts: authenticated insert" on public.receipts;
`;

const RESTORE_POLICY = `
-- ✔ FIX: re-create the INSERT policy that allows authenticated users to insert
create policy if not exists "receipts: authenticated insert"
  on public.receipts
  for insert
  with check ((select auth.role()) = 'authenticated');
`;

const DISABLE_RLS = `
alter table public.receipts disable row level security;
`;

const DB_CONTAINER = "supabase_db_supabase-debug-playground";

function applySql(sql: string, label: string) {
  step("SQL", label);
  log(c.grey(sql.trim()));
  try {
    execSync(
      `docker exec -i ${DB_CONTAINER} psql -U postgres`,
      { input: sql, stdio: ["pipe", "inherit", "inherit"] }
    );
    ok("SQL applied");
  } catch (err) {
    fail(`SQL failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ── insert attempt helper ────────────────────────────────────────────────────

async function attemptInsert(
  clientLabel: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  title: string
) {
  step("Insert", `[${clientLabel}] receipts.insert({ title, amount: 1.00 })`);

  const { data, error } = await client
    .from("receipts")
    .insert({ title, amount: 1.00 })
    .select();

  if (error) {
    fail(`[${clientLabel}] Insert FAILED`);
    log(`  code    : ${c.yellow(error.code ?? "(none)")}`);
    log(`  message : ${c.red(error.message)}`);
    log(`  hint    : ${error.hint ?? "(none)"}`);
  } else {
    ok(`[${clientLabel}] Insert SUCCEEDED`);
    labelledJson("  data", data);
  }

  return { data, error };
}

// ── modes ────────────────────────────────────────────────────────────────────

function doBreak() {
  hr();
  log(c.bold(c.yellow("▶ EP4 BREAK — enabling RLS, dropping INSERT policy")));
  hr();

  log("  What this does:");
  log(c.red("    1. ALTER TABLE receipts ENABLE ROW LEVEL SECURITY"));
  log(c.red("    2. DROP POLICY 'receipts: authenticated insert'"));
  log(c.red("    3. Result: no role can INSERT via the anon key — not even authenticated users"));
  log(c.red("    4. Service role bypasses RLS and still works — creates a confusing discrepancy"));
  log("");

  applySql(ENABLE_RLS_DROP_POLICY, "Enable RLS + drop INSERT policy");

  log("");
  warn("Run `pnpm ep4:run` to see the anon vs service_role difference.");
}

async function doRun() {
  hr();
  log(c.bold(c.cyan("▶ EP4 RUN — comparing anon key vs service_role insert")));
  hr();

  const anon    = anonClient();
  const service = serviceClient();

  log(c.bold("Test 1 — unauthenticated anon key (should be blocked by RLS)"));
  log(c.grey("  This simulates a client-side insert with no logged-in user."));
  const r1 = await attemptInsert("anon   ", anon,    "EP4 anon insert");

  log("");
  log(c.bold("Test 2 — service_role key (bypasses RLS entirely)"));
  log(c.grey("  This simulates a server-side / admin operation."));
  const r2 = await attemptInsert("service", service, "EP4 service insert");

  hr();
  log(c.bold("Side-by-side summary:"));
  log(`  anon insert     : ${r1.error ? c.red("BLOCKED") : c.green("ALLOWED")}`);
  log(`  service insert  : ${r2.error ? c.red("BLOCKED") : c.green("ALLOWED")}`);
  log("");
  log(c.bold("What to check:"));
  log("  • anon BLOCKED + service ALLOWED  → RLS is on, but INSERT policy is missing");
  log("  • Both ALLOWED                     → RLS is off (baseline state)");
  log("  • Both BLOCKED                     → service_role key may be wrong in .env");
  log("");
  log("Fix: Add the INSERT policy:  `WITH CHECK (auth.role() = 'authenticated')`");
  log("Then run `pnpm ep4:verify` to confirm.");
  hr();
}

async function doVerify() {
  hr();
  log(c.bold(c.green("▶ EP4 VERIFY — restoring INSERT policy + confirming behavior")));
  hr();

  // Step 1: Ensure RLS is on + restore correct INSERT policy
  applySql(ENABLE_RLS_DROP_POLICY, "Re-enable RLS (ensure clean state)");
  applySql(RESTORE_POLICY,          "Restore authenticated INSERT policy");

  let passed = true;

  // Step 2: Unauthenticated anon insert MUST fail
  log("");
  log(c.bold("Test 1 — unauthenticated anon insert (must be BLOCKED)"));
  const anon = anonClient();
  const r1 = await attemptInsert("anon (unauthed)", anon, "EP4 unauth verify");
  if (r1.error) {
    ok("Unauthenticated anon insert correctly BLOCKED by RLS");
  } else {
    fail("Unauthenticated anon insert succeeded — policy may be wrong");
    passed = false;
  }

  // Step 3: Sign in a user and test authenticated insert
  log("");
  log(c.bold("Test 2 — authenticated anon insert (must be ALLOWED)"));
  log(c.grey("  Creating a test user via service role admin API..."));

  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl    = requireEnv("SUPABASE_URL");

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testEmail    = `ep4-test-${Date.now()}@example.com`;
  const testPassword = "password-ep4-test";

  // Create the test user
  const { data: newUser, error: createErr } = await adminClient.auth.admin
    .createUser({ email: testEmail, password: testPassword, email_confirm: true });

  if (createErr || !newUser?.user) {
    warn(`Could not create test user: ${createErr?.message ?? "unknown"}`);
    warn("Skipping authenticated insert test (requires auth.admin API).");
  } else {
    ok(`Test user created: ${testEmail}`);

    // Sign in as that user with the anon client
    const userClient = createClient(supabaseUrl, requireEnv("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false },
    });

    const { error: signInErr } = await userClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInErr) {
      warn(`Sign-in failed: ${signInErr.message}`);
      warn("Skipping authenticated insert test.");
    } else {
      ok("Signed in as test user");

      const r2 = await attemptInsert("anon (authed)", userClient, "EP4 auth verify");
      if (!r2.error) {
        ok("Authenticated anon insert correctly ALLOWED by policy");
      } else {
        fail(`Authenticated insert blocked when it should be allowed: ${r2.error.message}`);
        passed = false;
      }
    }

    // Clean up test user
    await adminClient.auth.admin.deleteUser(newUser.user.id);
    ok("Test user cleaned up");
  }

  // Step 4: Service role always works
  log("");
  log(c.bold("Test 3 — service_role insert (must always be ALLOWED)"));
  const service = serviceClient();
  const r3 = await attemptInsert("service_role", service, "EP4 service verify");
  if (!r3.error) {
    ok("Service role insert ALLOWED (bypasses RLS as expected)");
  } else {
    fail(`Service role insert unexpectedly blocked: ${r3.error.message}`);
    passed = false;
  }

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP4 PASSED — RLS + INSERT policy working correctly.")));
  } else {
    log(c.bold(c.red("✘  EP4 FAILED — see issues above.")));
    process.exit(1);
  }
  hr();
}

// ── entry ────────────────────────────────────────────────────────────────────

const mode = parseMode();
if      (mode === "break")  doBreak();
else if (mode === "run")    doRun();
else if (mode === "verify") doVerify();
