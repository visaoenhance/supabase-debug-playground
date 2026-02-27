# EP5 — Schema Drift / Types

## What this episode teaches

- Why adding a DB column without regenerating types causes a silent mismatch (no TS error, just missing data)
- How to detect schema drift from the CLI by comparing live columns to `types.gen.ts`
- Where in the development workflow `supabase gen types` should run to prevent drift in production

---

## Recording loop

```bash
pnpm ep5:reset                                  # restore committed types.gen.ts + drop notes column
pnpm ep5:break                                  # add notes column to DB + write stale types.gen.ts
pnpm ep5:run                                    # reproduce the drift report — paste output below

# run CLI visibility step (see below)

# apply minimal fix (single command — see Ask section)

pnpm ep5:run                                    # confirm drift is gone
pnpm ep5:verify                                 # assert types match live DB + notes present
pnpm ep5:reset                                  # clean up for next run
```

---

## Symptom

```
▶ Check  Live DB columns vs types.gen.ts declarations

  Live DB columns : id, user_id, title, amount, created_at, notes
  Type columns    : id, user_id, title, amount, created_at

✘  Columns in DB but MISSING from types: notes
⚠  Drift detected!
```

TypeScript compiles without errors — the types are simply missing the field.
No IDE autocomplete for `notes`, no type-checker validation on insert.

---

## CLI visibility step

Confirm the `notes` column exists in the live database:

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT column_name, data_type, is_nullable \
   FROM information_schema.columns \
   WHERE table_schema = 'public' AND table_name = 'receipts' \
   ORDER BY ordinal_position;"
```

You will see `notes | text | YES` in the results — the column is real,
but `supabase/types.gen.ts` doesn't know about it yet.

Fix command (this is the entire fix):

```bash
supabase gen types typescript --local > supabase/types.gen.ts
```

---

## Ask

Paste the `receipts.Row` interface from `supabase/types.gen.ts` and the
`pnpm ep5:run` output into this chat, then ask:

1. **Root cause**: explain why TypeScript does not raise an error when a DB
   column exists but is absent from the generated types. Why is this
   dangerous in production?

2. **Quick diagnostic**: what is the single CLI command that confirms the
   `notes` column is live in the DB? (See CLI visibility step above.)

3. **Minimal fix**: what single command regenerates `types.gen.ts` from the
   live schema? (No file edits needed.)

4. **Re-run expectation**: after regeneration, `pnpm ep5:run` should print:
   ```
   ✔  No drift detected — types.gen.ts matches live schema
   ```

5. **Verify step**: `pnpm ep5:verify` asserts:
   - `types.gen.ts` exists and does not contain the STALE marker
   - Live DB columns match columns declared in `types.gen.ts`
   - `notes` column is present in both

6. **Best practice**: where in a CI/CD pipeline should `supabase gen types`
   run to prevent this drift reaching production?

7. **Replay commands**:
   ```bash
   pnpm ep5:reset && pnpm ep5:break
   ```

---

## Paste area

**`pnpm ep5:run` output:**
```
(paste here)
```

**`receipts.Row` from `supabase/types.gen.ts`:**
```ts
(paste here)
```

**`information_schema.columns` output:**
```
(paste here)
```
