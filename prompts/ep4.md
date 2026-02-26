# EP4 — RLS / Policy vs Keys

## What this episode teaches

- Why RLS with no INSERT policy silently blocks the `anon` key but not `service_role`
- Why "it works from the dashboard" is not proof your app will work (dashboard uses `service_role`)
- How to write a correct `WITH CHECK` INSERT policy for authenticated users

---

## Recording loop

```bash
pnpm ep4:reset                                  # restore baseline (RLS disabled, policy present)
pnpm ep4:break                                  # enable RLS + drop INSERT policy
pnpm ep4:run                                    # reproduce the failure — paste output below

# run CLI visibility step (see below)

# apply minimal fix in your IDE (see Ask section)

pnpm ep4:run                                    # confirm anon is no longer blocked
pnpm ep4:verify                                 # assert all 3 scenarios pass
pnpm ep4:reset                                  # clean up for next run
```

---

## Symptom

```
▶ Insert  [anon    ]  receipts.insert({ title, amount: 1.00 }).select()
✘  [anon    ]  BLOCKED  → new row violates row-level security policy

▶ Insert  [service ]  receipts.insert({ title, amount: 1.00 }).select()
✔  [service ]  ALLOWED  → id: <uuid>
```

The insert works from the dashboard (which uses `service_role`) but fails
from the app (which uses the `anon` key). Classic RLS confusion.

---

## CLI visibility step

List all current RLS policies on the `receipts` table:

```bash
supabase db execute --local --sql \
  "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'receipts';"
```

After `ep4:break` you will see policies for `SELECT` and `DELETE` but
**no INSERT policy** — that's what's blocking the anon key.

Also confirm RLS is enabled:

```bash
supabase db execute --local --sql \
  "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'receipts';"
```

---

## Ask

Paste the `pg_policies` output above into this chat, then ask:

1. **Root cause**: explain in 2–3 sentences why `service_role` bypasses RLS
   while the `anon` key is blocked. What is the Postgres mechanism behind this?

2. **Quick diagnostic**: looking at the `pg_policies` output, which policy
   command (`cmd`) is missing for the `receipts` table?

3. **Minimal fix**: show the `CREATE POLICY` statement that:
   - targets `INSERT` operations on `public.receipts`
   - allows only authenticated users (not anonymous)
   - uses `WITH CHECK (auth.role() = 'authenticated')` correctly

4. **Re-run expectation**: after adding the policy, `pnpm ep4:run` should show:
   ```
   ✘  [anon unauthed]  BLOCKED  ← expected: no session = no insert
   ✔  [anon authed  ]  ALLOWED  ← expected: authenticated session passes WITH CHECK
   ✔  [service      ]  ALLOWED  ← expected: service_role always bypasses RLS
   ```

5. **Verify step**: `pnpm ep4:verify` asserts all three scenarios above pass.

6. **Replay commands**:
   ```bash
   pnpm ep4:reset && pnpm ep4:break
   ```

---

## Paste area

**`pnpm ep4:run` output:**
```
(paste here)
```

**`pg_policies` output:**
```
(paste here)
```
