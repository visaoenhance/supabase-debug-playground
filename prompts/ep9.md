# EP9 — RPC Auth Context

**Pattern introduced:** RPC auth-context validation — assert that a function raises an explicit error on unauthenticated calls instead of returning an empty result

---

## What this episode covers

A PostgreSQL function using `auth.uid()` is called without an active session. It returns an empty array with no error — making it impossible to distinguish "no data" from "wrong caller". The root cause is a missing null guard: when no JWT is present, `auth.uid()` is null, and `WHERE author_id = auth.uid()` matches nothing. We add a null guard that raises `SQLSTATE 'PT401'` when `auth.uid()` is null, revoke execute from `anon`, and verify the explicit error path alongside the authenticated success path.

---

## What the viewer learns

- Why `auth.uid()` returns null inside a SECURITY INVOKER function when no JWT is present
- How a missing null guard causes silent empty returns instead of actionable errors
- How to write a null guard using `RAISE EXCEPTION … USING ERRCODE = 'PT401'`
- The difference between SECURITY INVOKER and SECURITY DEFINER and when each is appropriate
- Why REVOKE EXECUTE FROM anon is essential — without it, the silent failure is accessible to anyone

---

## Command sequence

| # | Command | What it does | What to look for |
|---|---|---|---|
| 1 | `pnpm ep9:reset` | Restores baseline — broken get_my_notes() with no null guard | Output: `✔ reset complete` |
| 2 | `pnpm ep9:break` | Seeds a note, calls get_my_notes() without session | **Returns `[]` — silent empty** |
| 3 | `pnpm ep9:run` | Calls get_my_notes() without session in broken state | **Silent `[]`** |
| 4 | `pg_proc` query | Inspect function body | No null guard on auth.uid() |
| 5 | `pnpm ep9:fix` | Applies hardened function with null guard + grant changes | Output: confirms changes |
| 6 | `pnpm ep9:run` | Same call without session | **Explicit PT401 error** |
| 7 | `pnpm ep9:verify` | Full verification: unauthed error + authed success + definition check | `✔ EP9 PASSED` |
| 8 | `pnpm ep9:reset` | Restores known-good state | Clean repo |

---

## Recording flow

### 1 · Reset + Break

```bash
pnpm ep9:reset
pnpm ep9:break
```

**Say:** "`ep9:break` seeds a note so we know there's data. Then it calls `get_my_notes()` without signing in. The function returns an empty array. No error, no hint. But a note definitely exists."

---

### 2 · Reproduce

```bash
pnpm ep9:run
```

**Expected output (broken state):**
```
⚠  Function body has no auth null guard (broken state)
  → This run will show a silent empty result.

State 1 — Unauthenticated call (no session)
  Result: []

⚠  Silent empty result — this is the bug (broken state).
   There IS a note seeded above, yet the function returns [].
   A developer would see this and assume there's just no data.

State 2 — Authenticated call (owner)
  Result: [{ id: "...", content: "EP9 run note", ... }]
✔ Authenticated call returned 1 row(s) ✔
```

**Say:** "Same function, two callers, two very different results — and only one of them tells you why. The unauthenticated call returns empty with no indication that the caller has no session. This is the worst kind of silent failure — it mimics genuine no-data."

---

### 3 · Diagnose

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT prosrc FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE p.proname = 'get_my_notes' AND n.nspname = 'public';"
```

**Expected:** Function body shows `WHERE author_id = auth.uid()` with no preceding null check.

**Say:** "The function body is the evidence. `WHERE author_id = auth.uid()` — when `auth.uid()` is null, this matches zero rows. In Postgres, `column = null` is never true. The function dutifully returns the empty set. It's not wrong — it's just missing the guard."

Check current grants:

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT grantee, privilege_type FROM information_schema.role_routine_grants
   WHERE routine_name = 'get_my_notes' AND routine_schema = 'public';"
```

**Say:** "And there's the second issue: `anon` has EXECUTE. Any unauthenticated client can call this function. It won't get data, but it can probe response timing and error shapes. The fix needs to revoke that grant."

---

### 4 · Fix

```bash
pnpm ep9:fix
```

**Say:** "`ep9:fix` replaces the function with a hardened version. Three changes: a null guard that raises PT401, explicit SECURITY INVOKER declaration, and a hardened search_path. Plus REVOKE EXECUTE FROM anon and public, and GRANT EXECUTE only to authenticated."

Show the null guard:

```sql
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'not authenticated'
    USING ERRCODE = 'PT401',
          HINT    = 'Call this function with an authenticated session';
END IF;
```

---

### 5 · Confirm

```bash
pnpm ep9:run
```

**Expected output (fixed state):**
```
✔ Function body contains auth null guard (fixed state)

State 1 — Unauthenticated call (no session)
  Error code   : PT401
  Error message: not authenticated
✔ Explicit error returned (fixed state behaviour)

State 2 — Authenticated call (owner)
  Result: [{ id: "...", content: "EP9 run note", ... }]
✔ Authenticated call returned 1 row(s) ✔

Side-by-side:
  Unauthenticated : ERROR ← explicit (fixed)
  Authenticated   : data returned ✔
```

**Say:** "Now the unauthenticated caller gets PT401 — 'not authenticated'. Actionable error, no ambiguity. The authenticated caller still gets their data. And the anon grant is gone, so unauthenticated callers can't even reach the function."

---

### 6 · Verify

```bash
pnpm ep9:verify
```

**Expected output:**
```
✔ Security invoker (SECURITY INVOKER) ✔
✔ search_path is explicitly set ✔
✔ EXECUTE granted to authenticated ✔
✔ EXECUTE revoked from anon ✔
✔ Unauthenticated call returned explicit error ✔
✔ Error message confirms 'not authenticated' ✔
✔ Authenticated call returned 1 row(s) ✔
✔  EP9 PASSED
```

---

### 7 · Reset

```bash
pnpm ep9:reset
```

---

## Outro script

> "The pattern: every function that uses `auth.uid()` needs a null guard at the top. Check for null, raise an explicit error. Then revoke execute from anon — there's no reason unauthenticated callers should reach a function that only makes sense with a session.
>
> SQLSTATE PT401 is a PostgREST convention for auth errors. Your frontend can key on it.
>
> Here's the prompt for your agent."
>
> [show Embed Skill Prompt on screen]
>
> "Next episode: query performance — when a missing index turns a 2ms query into a 400ms full table scan at 10k rows."

---

## The bug (reference)

**Root cause:** `get_my_notes()` runs `WHERE author_id = auth.uid()` with no null guard. When `auth.uid()` is null (no session), the condition matches zero rows — empty set returned, no error raised.

**Broken state confirmation:**
```
Unauthenticated call: [] (no error)
```

**Fix:**
```sql
CREATE OR REPLACE FUNCTION public.get_my_notes()
RETURNS SETOF public.user_notes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated'
      USING ERRCODE = 'PT401',
            HINT    = 'Call this function with an authenticated session';
  END IF;
  RETURN QUERY
    SELECT * FROM public.user_notes
    WHERE author_id = auth.uid()
    ORDER BY created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_notes() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_notes() TO authenticated;
```
