# Pattern 5 — RLS

**Episode:** EP4
**Trigger:** after any `CREATE POLICY`, `DROP POLICY`,
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, or migration touching RLS.

---

## The Three-Scenario Requirement

All three must pass — not just the happy path:

| Scenario | Key used | Expected result |
|---|---|---|
| Unauthenticated anon | Anon key, no JWT | Blocked — error `42501` |
| Authenticated user | Anon key + valid JWT | Allowed |
| service_role | service_role key | Allowed (bypasses RLS entirely) |

## Validation Steps

1. **Unauthenticated anon** — attempt the restricted operation with a plain anon
   key and no auth session → assert blocked (error `42501`)
2. **Authenticated user** — same operation with anon key + valid JWT → assert
   allowed
3. **service_role** — same operation with service_role key → assert allowed

## Diagnostic Commands

```sql
-- See all policies on a table
SELECT policyname, cmd, qual, with_check
FROM pg_policies WHERE tablename = '<table>';

-- Confirm RLS is enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname = '<table>';
```

## Key Insight

If something works from the Supabase dashboard but fails in the app, check
whether an INSERT policy exists for the role your app uses. `service_role` has
`BYPASSRLS` — it skips policy evaluation entirely.

## Docs

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Debugging and Monitoring](https://supabase.com/docs/guides/database/inspect)
- [Hardening the Data API](https://supabase.com/docs/guides/database/hardening-data-api)

## Done When

All three scenarios produce the expected result.
