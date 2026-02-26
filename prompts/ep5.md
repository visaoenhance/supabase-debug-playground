# EP5 — Schema Drift / Types

## Context

I'm recording a Supabase debugging tutorial.  I have a local Supabase
instance and a `supabase/types.gen.ts` file generated from the schema.

I ran `pnpm ep5:break` which:
1. Added a `notes TEXT` column to the `receipts` table in the database
2. Wrote a stale `supabase/types.gen.ts` that does NOT include the new column

## Symptom

When I run `pnpm ep5:run`, the drift checker reports:

```
✘  Columns in DB but MISSING from types: notes
⚠  Drift detected!
```

TypeScript compiles without errors because the types are simply missing the
field — no error, just a silent mismatch.  If I try to insert a `notes` value,
my IDE won't autocomplete it and the type checker won't validate it.

## Ask

1. **Root cause**: explain why TypeScript doesn't report an error when a DB
   column exists but is absent from the generated types.

2. **Quick diagnostic**: how can I confirm the `notes` column exists in the
   live DB without leaving the terminal?

3. **Minimal fix**: what single command regenerates `types.gen.ts` from the
   live schema?

4. **How to verify**: after regeneration, what does `pnpm ep5:verify` check?
   What should the output show to confirm types are in sync?

5. **Best practice**: where in the CI/CD workflow should type generation run
   to prevent this drift in production?

---

> Paste the `receipts.Row` interface from `supabase/types.gen.ts` and the
> output of `pnpm ep5:run`, then ask the AI to explain the drift and fix it.
