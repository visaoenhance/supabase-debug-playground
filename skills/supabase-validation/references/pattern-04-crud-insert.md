# Pattern 4 — CRUD / Insert

**Episode:** EP3
**Trigger:** after any insert, update, or delete via supabase-js.

---

## Validation Steps

1. Always chain `.select().throwOnError()` onto the operation
2. Assert returned `data` is a non-null array
3. Assert the array contains a row with `id`

## Why This Matters

`.insert()` without `.select()` sends `Prefer: return=minimal` — PostgREST
returns 204 with empty body. supabase-js translates this to
`{ data: null, error: null }`. This is **not** confirmation the row was saved.

## Correct Pattern

```ts
const { data } = await supabase
  .from("table")
  .insert({ ...values })
  .select()
  .throwOnError();
// data is a non-null array if the insert succeeded
```

## Docs

- [Managing Tables](https://supabase.com/docs/guides/database/tables)
- [JavaScript Insert](https://supabase.com/docs/reference/javascript/insert)
- [PostgREST Error Codes](https://supabase.com/docs/guides/api/rest/postgrest-error-codes)

## Done When

Insert returns a non-null array containing a row with `id`.
