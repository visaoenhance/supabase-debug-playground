# EP2 — RPC Debugging

## Context

I'm recording a Supabase debugging tutorial.  I have a Postgres RPC function
`create_receipt(title text, amount numeric)` in my local Supabase instance.

I ran `pnpm ep2:break` which applied a broken version of the SQL function to
the database.

## Symptom

When I call `supabase.rpc('create_receipt', { title: '...', amount: 9.99 })`, 
I get an error object back:

```
{
  code: "42703",
  message: "column \"titl\" of relation \"receipts\" does not exist",
  hint: null
}
```

## Ask

1. **Root cause**: what does PostgreSQL error code `42703` mean, and what
   exactly is wrong in the SQL function?

2. **Quick diagnostic**: where in the function body should I look to confirm
   the typo?  What SQL query can I run to inspect the live function definition?

3. **Minimal fix**: show me only the corrected `INSERT` statement inside the
   PL/pgSQL function body.

4. **How to verify**: what command do I run after applying the fix to confirm
   the RPC works and returns a receipt with an `id`?

---

> Paste the broken SQL function definition below (get it from
> `supabase/migrations/20240101000001_create_rpc.sql`), then ask the AI to
> diagnose and fix it.
