# EP4 — RLS / Policy vs Keys

## Context

I'm recording a Supabase debugging tutorial.  I have a local Supabase
instance with a `receipts` table that uses Row Level Security (RLS).

I ran `pnpm ep4:break` which enabled RLS on `receipts` and dropped the
INSERT policy.

## Symptom

When I run `pnpm ep4:run`, I see two different results for the same insert:

```
[anon    ]  ✘  BLOCKED  → new row violates row-level security policy
[service ]  ✔  ALLOWED  → id: <uuid>
```

The insert works from the Supabase dashboard (which uses `service_role`)
but fails from my app (which uses the `anon` key).

## Ask

1. **Root cause**: explain in 2-3 sentences why the `service_role` key
   bypasses RLS while the `anon` key is blocked.

2. **Quick diagnostic**: what SQL query can I run to list the current RLS
   policies on the `receipts` table, and what will be missing?

3. **Minimal fix**: show me the SQL `CREATE POLICY` statement that:
   - applies to `INSERT` operations
   - allows only authenticated users (not anonymous)
   - uses `WITH CHECK` correctly

4. **How to verify**: what command do I run after adding the policy?
   What three scenarios should pass?

---

> Paste the output of:
> ```sql
> SELECT policyname, cmd, qual, with_check
> FROM pg_policies
> WHERE tablename = 'receipts';
> ```
> then ask the AI what policy is missing and how to add it.
