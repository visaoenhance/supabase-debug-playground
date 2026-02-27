/**
 * EP4 — verify.ts
 *
 * PASS criteria:
 *   ✔ Unauthenticated anon insert → BLOCKED (RLS working)
 *   ✔ Authenticated anon insert   → ALLOWED (INSERT policy present)
 *   ✔ service_role insert         → ALWAYS ALLOWED (bypasses RLS)
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { anonClient, serviceClient, requireEnv, c, log, hr, ok, fail, step, warn } from "../../utils.js";

async function main() {
hr();
log(c.bold(c.green("EP4 VERIFY — RLS policy check (3 scenarios)")));
hr();

// ── helper ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryInsert(label: string, client: any, minimal = false): Promise<boolean> {
  // minimal=true  → no .select() → PostgREST sends "Prefer: return=minimal"
  //                 (no RETURNING clause, so the SELECT read-policy is not evaluated)
  // minimal=false → chains .select() → INSERT…RETURNING (default for service_role tests)
  step("Insert", `[${label}]  receipts.insert(...)${minimal ? "" : ".select()"}`);

  let insertError: { message: string } | null = null;
  let insertedId: string | undefined;

  if (minimal) {
    const { error } = await client
      .from("receipts")
      .insert({ title: `EP4 verify — ${label}`, amount: 0.01 });
    insertError = error;
  } else {
    const { data, error } = await client
      .from("receipts")
      .insert({ title: `EP4 verify — ${label}`, amount: 0.01 })
      .select();
    insertError = error;
    insertedId = (data as Array<{ id: string }>)?.[0]?.id;
  }

  if (insertError) {
    fail(`[${label}] BLOCKED  →  ${insertError.message}`);
    return false;
  }
  ok(`[${label}] ALLOWED${insertedId ? `  →  id: ${insertedId}` : ""}`);
  return true;
}

// ── Ensure the fix is in place first ─────────────────────────────────────────

log("Applying fix SQL (ensures INSERT policy + RLS are both active)...");
const FIX_SQL = `
alter table public.receipts enable row level security;
drop policy if exists "receipts: authenticated insert" on public.receipts;
create policy "receipts: authenticated insert"
  on public.receipts
  for insert
  with check (auth.role() = 'authenticated');
`;
try {
  execSync(`docker exec -i supabase_db_supabase-debug-playground psql -U postgres`,
    { input: FIX_SQL, stdio: ["pipe", "pipe", "pipe"] });
  ok("INSERT policy confirmed present");
} catch (err) {
  fail(`Could not apply fix SQL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

log("");
let passed = true;

// ── Test 1: unauthenticated anon (must be BLOCKED) ────────────────────────────

log(c.bold("Test 1 — unauthenticated anon key"));
const anon = anonClient();
const t1Allowed = await tryInsert("anon (unauthed)", anon);
if (!t1Allowed) {
  ok("Correct — RLS blocked unauthenticated insert as expected");
} else {
  fail("Unauthenticated insert succeeded — RLS may be disabled or policy too permissive");
  passed = false;
}
log("");

// ── Test 2: authenticated anon (must be ALLOWED) ─────────────────────────────

log(c.bold("Test 2 — authenticated anon key (create + sign-in temp user)"));

const supabaseUrl   = requireEnv("SUPABASE_URL");
const anonKey       = requireEnv("SUPABASE_ANON_KEY");
const serviceKey    = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const testEmail    = `ep4-verify-${Date.now()}@example.com`;
const testPassword = "ep4-verify-password";

const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
  email: testEmail,
  password: testPassword,
  email_confirm: true,
});

if (createErr || !newUser?.user) {
  warn(`Could not create test user: ${createErr?.message ?? "unknown"}`);
  warn("Skipping authenticated insert test.");
} else {
  ok(`Temp user created: ${testEmail}`);

  const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (signInErr) {
    warn(`Sign-in failed: ${signInErr.message}`);
  } else {
    ok("Signed in as temp user");
    // Use minimal=true so PostgREST sends "Prefer: return=minimal" (no INSERT…RETURNING).
    // Without this, the chained .select() triggers a RETURNING that hits the owner-read
    // SELECT policy (user_id = auth.uid()), which fails because user_id is NULL here.
    const t2Allowed = await tryInsert("anon (authed)", userClient, true);
    if (t2Allowed) {
      ok("Correct — authenticated insert allowed by INSERT policy");
    } else {
      fail("Authenticated insert blocked — INSERT policy may be missing or wrong");
      passed = false;
    }
  }

  // clean up
  await admin.auth.admin.deleteUser(newUser.user.id);
  ok("Temp user deleted");
}

log("");

// ── Test 3: service_role (must ALWAYS be allowed) ─────────────────────────────

log(c.bold("Test 3 — service_role (bypasses RLS)"));
const service    = serviceClient();
const t3Allowed  = await tryInsert("service_role", service);
if (t3Allowed) {
  ok("Correct — service_role always bypasses RLS");
} else {
  fail("service_role insert blocked — check SUPABASE_SERVICE_ROLE_KEY in .env");
  passed = false;
}

hr();
if (passed) {
  log(c.bold(c.green("✔  EP4 PASSED")));
} else {
  log(c.bold(c.red("✘  EP4 FAILED — see issues above")));
  process.exit(1);
}
hr();
}

main();
