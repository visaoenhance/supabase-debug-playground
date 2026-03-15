# Pattern 6 — Schema Migration / Type Drift

**Episode:** EP5
**Trigger:** after any migration that adds, removes, or renames a column.

---

## Validation Steps

1. Run: `supabase gen types typescript --local > supabase/types.gen.ts`
2. Run: `git diff supabase/types.gen.ts`
3. If diff is non-empty → expected (new column). Commit the updated file.
4. If diff is empty and you added a column → migration may not have run — check.

## Drift Detection

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<table>'
ORDER BY ordinal_position;
```

## Why This Matters

TypeScript compiles cleanly against stale types. A column that exists in the DB
but not in `types.gen.ts` is simply invisible to your code — no compile error,
silent bugs.

## CI Gate

```sh
supabase gen types typescript --local > supabase/types.gen.ts \
  && git diff --exit-code supabase/types.gen.ts
```

Fail the build if the diff is non-empty (schema changed but types were not
regenerated and committed).

## Docs

- [Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types)
- [Debugging and Monitoring](https://supabase.com/docs/guides/database/inspect)
- [Local Development](https://supabase.com/docs/guides/cli/local-development)

## Done When

`types.gen.ts` reflects the current live schema and the file is committed.
