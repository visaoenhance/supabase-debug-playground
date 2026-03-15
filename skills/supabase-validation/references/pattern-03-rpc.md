# Pattern 3 — RPC

**Episode:** EP2
**Trigger:** after any `CREATE OR REPLACE FUNCTION` or migration that modifies
an RPC.

---

## Validation Steps

1. Call via supabase-js: `supabase.rpc('<function_name>', { ...args })`
2. Assert `error` is null
3. Assert response data contains the expected fields

## Fail Signal

`error.code` is present — read `error.code`, `error.message`, `error.hint`
as a unit.

## Diagnostic

If error code is `42703` (undefined column), run:
```sql
SELECT pg_get_functiondef('<schema>.<function_name>(<arg_types>)'::regprocedure);
```

## Docs

- [Database Functions](https://supabase.com/docs/guides/database/functions)
- [JavaScript RPC](https://supabase.com/docs/reference/javascript/rpc)
- [PostgREST Error Codes](https://supabase.com/docs/guides/api/rest/postgrest-error-codes)

## Done When

RPC returns no error + response shape is correct.
