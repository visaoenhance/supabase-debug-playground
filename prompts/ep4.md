# EP4 — RLS / Policy vs Keys

**Pattern introduced:** RLS validation — assert policy enforcement for both anon and authenticated users

---

## What this episode covers

An insert works from the Supabase dashboard but fails in the app every time. RLS is enabled on the table and the INSERT policy was dropped. The `anon` key is blocked. `service_role` bypasses RLS and works fine — which is exactly why the dashboard always succeeds. We inspect the live policies, understand the Postgres bypass mechanism, add the correct INSERT policy, and verify all three scenarios.

---

## What the viewer learns

- Why RLS enabled + no INSERT policy silently blocks the `anon` key with error 42501
- Why `service_role` bypasses RLS entirely — and why the Supabase dashboard always works
- How to read `pg_policies` to see exactly what policies are (and aren't) applied
- How to write the correct `WITH CHECK` INSERT policy for authenticated users
- Why anon still being blocked *after* the fix is correct and expected

---

## Command sequence

| # | Command | What it does | What to look for |
|---|---|---|---|
| 1 | `pnpm ep4:reset` | Restores baseline — RLS off, policy present | Output: `✔ reset complete` |
| 2 | `pnpm ep4:break` | Enables RLS + drops INSERT policy | Output: lists what was changed |
| 3 | `pnpm ep4:run` | Tests anon + service_role inserts | **anon BLOCKED (42501), service_role ALLOWED** |
| 4 | `pg_policies` query | Lists live RLS policies on receipts | No INSERT row — confirms missing policy |
| 5 | `pnpm ep4:fix` | Re-creates the INSERT policy | Output: confirms policy added |
| 6 | `pnpm ep4:run` | Same test — anon still blocked (correct) | **anon BLOCKED, service_role ALLOWED — expected** |
| 7 | `pnpm ep4:verify` | Tests all 3 scenarios incl. authenticated | `✔ EP4 PASSED` |
| 8 | `pnpm ep4:reset` | Restores known-good state | Clean repo |

---

## Recording flow

### 1 · Reset + Break

```bash
pnpm ep4:reset
pnpm ep4:break
```

**Say:** "`ep4:reset` disables RLS and puts the INSERT policy back — the table is open. `ep4:break` enables RLS and drops the INSERT policy. From this point, any unauthenticated insert will be blocked."

---

### 2 · Reproduce

```bash
pnpm ep4:run
```

**Expected output:**
```
Test 1 — anon key (unauthenticated):
✘  [anon] Insert FAILED
   code    : 42501
   message : new row violates row-level security policy for table "receipts"

Test 2 — service_role key:
✔  [service] Insert SUCCEEDED
```

**Say:** "This is the exact symptom: blocked in the app, works from the dashboard. The dashboard uses `service_role`. Your app uses `anon`. Error 42501 means RLS default-deny — no applicable policy was found."

---

### 3 · Diagnose

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'receipts';"

docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'receipts';"
```

**Expected:** `relrowsecurity = t` and no row with `cmd = a` (INSERT) in `pg_policies`.

**Say:** "`relrowsecurity = t` means RLS is on. The policy list has SELECT and DELETE — but no INSERT. In Postgres, RLS is default-deny: if no policy matches an operation, it's blocked. `service_role` has the `BYPASSRLS` attribute in Supabase — it skips policy evaluation entirely. That's why the dashboard always works."

---

### 4 · Fix

```bash
pnpm ep4:fix
```

**Say:** "`ep4:fix` adds the INSERT policy back. The policy uses `WITH CHECK (auth.role() = 'authenticated')` — it only unlocks authenticated users, not unauthenticated anon."

Show the policy:

```sql
CREATE POLICY "receipts: authenticated insert"
  ON public.receipts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

---

### 5 · Confirm

```bash
pnpm ep4:run
```

**Expected output — same as broken:**
```
✘  [anon] Insert FAILED  (unauthenticated)
✔  [service] Insert SUCCEEDED
```

**Say:** "This looks identical to the broken output — anon is still blocked. That's correct. `ep4:run` uses an unauthenticated anon key. The INSERT policy helps *authenticated* users, not unauthenticated ones. We need `ep4:verify` to see the full picture."

---

### 6 · Verify

```bash
pnpm ep4:verify
```

**Expected output:**
```
✔  [anon unauthed]  BLOCKED  — correct: no session, policy denies
✔  [anon authed  ]  ALLOWED  — correct: authenticated session passes WITH CHECK
✔  [service_role ]  ALLOWED  — correct: service_role bypasses RLS
✔  EP4 PASSED
```

**Say:** "Three scenarios, all correct. An agent validating an RLS change needs to test all three — not just the happy path."

---

### 7 · Reset

```bash
pnpm ep4:reset
```

---

## Outro script

> "The pattern: after any RLS change, test all three cases — unauthenticated blocked, authenticated allowed, service_role allowed. If you only test one you'll miss the other two. And remember: if it works from the dashboard but fails in the app, the first thing to check is whether RLS has an INSERT policy for the role your app actually uses.
>
> Here's the prompt to give your agent so it runs this validation automatically."
>
> [show Embed Skill Prompt on screen]
>
> "Next episode: schema drift — when TypeScript has no idea a database column exists."

---

## The bug (reference)

**What `ep4:break` does:**
1. Enables RLS on `receipts`
2. Drops the `receipts: authenticated insert` policy

**Resulting error (anon key):**
```
code    : 42501
message : new row violates row-level security policy for table "receipts"
```

**Fix:**
```sql
CREATE POLICY "receipts: authenticated insert"
  ON public.receipts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

---

## References

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — policies, roles, and `service_role` bypass behaviour
- [Debugging and Monitoring](https://supabase.com/docs/guides/database/inspect) — `pg_policies` and live schema inspection
- [Hardening the Data API](https://supabase.com/docs/guides/database/hardening-data-api) — securing public vs private schemas

---

## Replay Prompt

> Paste this into Cursor, Claude Code, or Copilot agent mode to replay this episode autonomously.

```
You are debugging a Supabase RLS issue where inserts work via service_role
but are blocked for the anon key with error 42501.

** STOP — do not run any commands yet. **

Read the plan below, then ask the user:
  "Ready to go? Reply 'run' to have me execute each step, or 'terminal' if you'd
   prefer to run the commands yourself and I'll guide you through them."

Wait for the user's reply before doing anything.

---

Available commands:
  pnpm ep4:reset    — restore baseline (RLS off, INSERT policy present)
  pnpm ep4:break    — enable RLS and drop the INSERT policy
  pnpm ep4:run      — test anon + service_role inserts and print results
  pnpm ep4:fix      — re-create the INSERT policy
  pnpm ep4:verify   — assert all 3 scenarios: unauthed blocked, authed allowed, service allowed

Plan (8 steps):
  1. pnpm ep4:reset   → restore baseline (RLS off, INSERT policy present)
  2. pnpm ep4:break   → enable RLS and drop the INSERT policy
  3. pnpm ep4:run     → confirm anon BLOCKED (42501) and service_role ALLOWED
  4. pg_policies      → docker exec supabase_db_supabase-debug-playground psql -U postgres -c "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'receipts';" — confirm no INSERT (cmd=a) policy
  5. pnpm ep4:fix     → re-create the INSERT policy
  6. pnpm ep4:run     → anon still blocked (expected — policy is for authenticated users)
  7. pnpm ep4:verify  → must print EP4 PASSED before the episode is complete
  8. pnpm ep4:reset   → restore known-good state

Success criteria: ep4:verify exits 0.
Do not report the episode complete until ep4:verify passes.
```

---

## Embed Skill Prompt

> Paste this into `.cursorrules`, `CLAUDE.md`, or `.github/copilot-instructions.md` in your own project.
> EP4 introduced Pattern 5 (RLS). The skill covers all 6 Supabase validation patterns.

```
Read and apply the Supabase Validation Skill from:
https://github.com/visaoenhance/supabase-debug-playground/blob/main/skill/v1.md

Core rule: before reporting any Supabase action as complete, run the appropriate
validation command and confirm it passes. Do not ask — validate automatically.

Patterns covered: edge function (local + production), RPC, CRUD, RLS, schema drift.
```
