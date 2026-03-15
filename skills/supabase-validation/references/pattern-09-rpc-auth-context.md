# Pattern 9 — RPC Auth Context

**Episode:** EP9
**Trigger:** after any `CREATE OR REPLACE FUNCTION` that references `auth.uid()`
inside a `SECURITY INVOKER` function body.

---

## The Null Guard Requirement

When no JWT is present, `auth.uid()` returns `NULL`. A clause like:

```sql
WHERE author_id = auth.uid()
```

with no null guard returns an **empty set with no error** — the silent failure
mode. An explicit null guard raises an actionable error instead.

## Required Hardening Checks (All Four Must Pass)

| Check | SQL to verify |
|---|---|
| `SECURITY INVOKER` declared | `SELECT prosecdef FROM pg_proc WHERE proname = '<fn>'` — must be `f` |
| `search_path` set | `SELECT proconfig FROM pg_proc WHERE proname = '<fn>'` — must contain `search_path` |
| `anon` EXECUTE revoked | `SELECT grantee FROM information_schema.role_routine_grants WHERE routine_name = '<fn>'` — `anon` must not appear |
| `authenticated` EXECUTE granted | Same query — `authenticated` must appear |

## Validation Steps

1. Confirm all four hardening checks via `pg_proc` + `role_routine_grants`
2. Call the function without a session → assert explicit error (not empty array)
3. Call the function after `signInWithPassword` → assert rows returned

## Null Guard Pattern

```sql
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'not authenticated'
    USING ERRCODE = 'PT401',
          HINT    = 'Call this function with an authenticated session';
END IF;
```

## Grant Pattern

```sql
REVOKE EXECUTE ON FUNCTION public.<fn>() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.<fn>() TO authenticated;
```

## Docs

- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Done When

Unauthenticated call returns explicit error + authenticated call returns data +
all 4 hardening checks pass.
