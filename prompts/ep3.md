# EP3 — CRUD "Did it save?"

## Context

I'm recording a Supabase debugging tutorial.  I have a Node.js TypeScript
script that inserts a receipt into a Supabase table.

I ran `pnpm ep3:break` which patched `scripts/ep3_crud.ts` to remove
`.select()` and `.throwOnError()` from the insert call.

## Symptom

When I call `pnpm ep3:run`, the output shows:

```
data  : null
error : null
✔ Insert succeeded
```

But I have no row ID, no confirmation the row was actually saved, and I can't
tell success from a silent failure.

## Ask

1. **Root cause**: why does `supabase-js` return `{ data: null, error: null }`
   when `.select()` is not chained onto an `.insert()` call?

2. **Quick diagnostic**: look at the `goodInsert` function in
   `scripts/ep3_crud.ts` and identify the missing method chains.

3. **Minimal fix**: show me the corrected `goodInsert` function with:
   - `.select()` chained after `.insert()`
   - `.throwOnError()` chained after `.select()`

4. **How to verify**: after the fix, what should the output of `pnpm ep3:run`
   show that proves the insert was confirmed?

---

> Paste the `goodInsert` function from `scripts/ep3_crud.ts` below, then ask
> the AI to diagnose and fix it.
