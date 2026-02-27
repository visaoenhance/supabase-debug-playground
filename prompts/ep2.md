# EP2 — RPC Debugging

**Pattern introduced:** RPC call validation — inspect PostgreSQL error objects + verify return shape

---

## What this episode covers

A Supabase RPC call returns PostgreSQL error code `42703` on every invocation. The error message names a column — but unless you know the PG error taxonomy you might chase the wrong thing. We read the error object, inspect the live function definition in Postgres, identify a one-character typo, fix it, and verify.

---

## What the viewer learns

- How to read RPC error objects — `code`, `message`, `hint` — instead of treating them as black boxes
- What PostgreSQL error code `42703` means and the class of bugs it covers
- How `pg_get_functiondef` lets you see exactly what SQL is running in your live database
- How `RAISE NOTICE` works as server-side logging for PL/pgSQL functions

---

## Command sequence

| # | Command | What it does | What to look for |
|---|---|---|---|
| 1 | `pnpm ep2:reset` | Re-runs migrations — known-good RPC | Output: `✔ reset complete` |
| 2 | `pnpm ep2:break` | Replaces `create_receipt` with broken version | Output: lists the typo being injected |
| 3 | `pnpm ep2:run` | Calls the RPC — reproduces the failure | **error code 42703, column "titl" does not exist** |
| 4 | `pg_get_functiondef` | Reads live function body from Postgres | Shows `titl` typo in the INSERT line |
| 5 | `pnpm ep2:fix` | Applies the corrected function | Output: confirms fix applied |
| 6 | `pnpm ep2:run` | Same call — confirms fix | **No error, receipt returned with id + title** |
| 7 | `pnpm ep2:verify` | Formal pass/fail assertion | `✔ EP2 PASSED` |
| 8 | `pnpm ep2:reset` | Restores known-good state | Clean repo |

---

## Recording flow

### 1 · Reset + Break

```bash
pnpm ep2:reset
pnpm ep2:break
```

**Say:** "`ep2:reset` re-runs all migrations — the RPC is correct. `ep2:break` replaces it with a broken version that has a one-character typo. The function exists in Postgres — it just crashes on every call."

---

### 2 · Reproduce

```bash
pnpm ep2:run
```

**Expected output:**
```
error:
  code    : 42703
  message : column "titl" of relation "receipts" does not exist
  hint    : null
```

**Say:** "PostgreSQL error 42703 — undefined column. The message tells us exactly which column name is wrong: `titl`. That's one character away from a valid column name. Notice there's no hint — Postgres can't suggest a correction for a typo inside a function body. Let's verify by reading the live function definition directly."

---

### 3 · Diagnose

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT pg_get_functiondef('public.create_receipt(text,numeric)'::regprocedure);"
```

**Expected:** shows the INSERT line as:
```sql
insert into public.receipts (titl, amount)
```

**Say:** "`pg_get_functiondef` reads the exact SQL running in your live database — not what you think you deployed, what's actually there. The typo is on the INSERT column list. One missing `e`."

Navigate to `supabase/migrations/20240101000001_create_rpc.sql` to show the source.

---

### 4 · Fix

```bash
pnpm ep2:fix
```

**Say:** "`ep2:fix` applies the corrected function directly to the running database. In production you'd do this via a migration — here we apply it immediately so we can confirm the fix without a full reset."

---

### 5 · Confirm

```bash
pnpm ep2:run
```

**Expected output:**
```
✔  RPC returned data with no error
Receipt: { id: "<uuid>", title: "...", amount: 9.99, ... }
```

**Say:** "No error. Receipt returned with an `id`. The RPC is working."

---

### 6 · Verify

```bash
pnpm ep2:verify
```

**Expected output:**
```
✔  RPC returned no error
✔  Response contains id
✔  Response contains title
✔  EP2 PASSED
```

**Say:** "`ep2:verify` asserts the RPC returns the correct shape — not just that it didn't error. This is the pattern your agent should run after any RPC change."

---

### 7 · Reset

```bash
pnpm ep2:reset
```

---

## Outro script

> "The pattern from this episode: when an RPC errors, read the full error object — code, message, hint. PostgreSQL error codes map directly to categories: 42703 is always a missing column reference. `pg_get_functiondef` gives you the ground truth on what SQL is actually running.
>
> If you want your agent to validate RPC calls automatically — checking the return shape before telling you it's done — here's the prompt."
>
> [show Replay Prompt on screen]
>
> "Next episode: CRUD — when `.insert()` returns null data and no error, and you have no idea if anything was actually saved."

---

## The bug (reference)

**Broken migration:** `supabase/migrations/20240101000001_create_rpc.sql` (broken version)

```sql
insert into public.receipts (titl, amount)  -- 'titl' should be 'title'
```

**Broken output:**
```
error:
  code    : 42703
  message : column "titl" of relation "receipts" does not exist
```

**Fixed output:**
```
✔  RPC returned data — { id: "<uuid>", title: "...", amount: 9.99 }
```

---

## Replay Prompt

> Paste this into Cursor, Claude Code, or Copilot agent mode to replay this episode autonomously.

```
You are debugging a Supabase RPC that returns PostgreSQL error 42703 on every call.

Available commands:
  pnpm ep2:reset    — re-run migrations, restore known-good create_receipt function
  pnpm ep2:break    — inject broken function (column typo)
  pnpm ep2:run      — call the RPC and print the full error or response
  pnpm ep2:fix      — apply the corrected function
  pnpm ep2:verify   — assert RPC returns no error + response contains id and title

Workflow:
1. Run ep2:reset, then ep2:break to reach a known broken state
2. Run ep2:run — confirm error code 42703 with column "titl" does not exist
3. Inspect the live function: docker exec supabase_db_supabase-debug-playground psql -U postgres -c "SELECT pg_get_functiondef('public.create_receipt(text,numeric)'::regprocedure);"
4. Run ep2:fix to apply the corrected function
5. Run ep2:run — confirm no error and receipt returned with id + title
6. Run ep2:verify — must exit 0 and print EP2 PASSED before you report done
7. Run ep2:reset to restore known-good state

Success criteria: ep2:verify exits 0.
Do not report the episode complete until ep2:verify passes.
Run ep2:reset as the final step.
```
