# Pattern 7 — Auth-Gated Query

**Episode:** EP7
**Trigger:** after any change to a table's RLS policies that use `auth.uid()`,
or after any client-side code that queries such a table.

---

## The 3-State Requirement

`auth.uid()` policies create three distinct behaviours that **must all be
tested** — not just the happy path:

| State | Caller | Expected result |
|---|---|---|
| No session | Anon key, no JWT | Empty array (or explicit error if null guard configured) — no data leaked |
| Wrong user | Signed-in user who does not own the rows | Empty array — RLS scopes to `auth.uid()` |
| Owner | Signed-in user who owns the rows | Rows returned |

## Why States 1 and 2 Look Identical

Both return `[]` with no error — a developer cannot tell whether the table is
empty, RLS is blocking them, or they forgot to sign in. All three states must be
tested explicitly; the name applied to the symptom is not the diagnosis.

## Validation Steps

1. Confirm `relrowsecurity = t` via `pg_class`
2. Create two test users via `auth.admin.createUser`
3. State 1 — query with no session → assert empty array
4. State 2 — query signed in as the non-owner → assert empty array
5. State 3 — query signed in as the owner → assert rows returned
6. Delete test users after validation

## Diagnostic

```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = '<table>';
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = '<table>';
```

## Docs

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Auth Helpers](https://supabase.com/docs/guides/auth)

## Done When

All 3 auth states produce the expected result.
