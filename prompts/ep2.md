# EP2 — RPC Debugging

## What this episode teaches

- How to read Supabase RPC error objects (`code`, `message`, `hint`) instead of ignoring them
- How to inspect the live Postgres function definition from the CLI to confirm a typo
- How `RAISE NOTICE` works as server-side logging visible via `supabase db logs`

---

## Recording loop

```bash
pnpm ep2:reset                                  # restore known-good RPC via supabase db reset
pnpm ep2:break                                  # inject broken create_receipt (column typo)
pnpm ep2:run                                    # reproduce the failure — paste output below

# run CLI visibility step (see below)

# apply minimal fix in your IDE (see Ask section)

pnpm ep2:run                                    # confirm error is gone
pnpm ep2:verify                                 # assert RPC returns a receipt with id + title
pnpm ep2:reset                                  # clean up for next run
```

---

## Symptom

```
▶ RPC  supabase.rpc('create_receipt', { title: '...', amount: 9.99 })

error:
  code    : 42703
  message : column "titl" of relation "receipts" does not exist
  hint    : null
```

---

## CLI visibility step

Inspect the **live** function definition directly in Postgres:

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT pg_get_functiondef('public.create_receipt(text,numeric)'::regprocedure);"
```

Look at the `INSERT` statement inside the function body — you will see
`titl` instead of `title`. That's the exact line to fix.

Also tail Postgres RAISE NOTICE output:

```bash
supabase db logs
```

---

## Ask

Paste the output of `pg_get_functiondef` above into this chat, then ask:

1. **Root cause**: what does PostgreSQL error code `42703` mean, and what
   exactly is wrong in the SQL function body?

2. **Quick diagnostic**: which specific line in the `INSERT` statement contains
   the typo, and how does the error message point directly to it?

3. **Minimal fix**: show only the corrected `INSERT` line inside the
   PL/pgSQL function body. No other changes needed.

4. **Re-run expectation**: after the fix (apply via `docker exec supabase_db_supabase-debug-playground psql -U postgres -c '<fixed sql>'`),
   `pnpm ep2:run` should print:
   ```
   ✔  RPC returned data with no error
   Receipt: { id: "<uuid>", title: "...", amount: 9.99, ... }
   ```

5. **Verify step**: `pnpm ep2:verify` asserts:
   - RPC returns no error
   - Response contains `id` (UUID)
   - Response contains the `title` we sent

6. **Replay commands**:
   ```bash
   pnpm ep2:reset && pnpm ep2:break
   ```

---

## Paste area

**`pnpm ep2:run` output:**
```
(paste here)
```

**`pg_get_functiondef` output:**
```sql
(paste here)
```
