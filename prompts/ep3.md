# EP3 — CRUD "Did it save?"

## What this episode teaches

- Why `.insert()` without `.select()` always returns `{ data: null, error: null }` on success
- Why checking `!error` is not a confirmation that a row was saved
- How `.select()` + `.throwOnError()` gives unambiguous insert confirmation

---

## Recording loop

```bash
pnpm ep3:reset                                  # restore known-good ep3_crud.ts
pnpm ep3:break                                  # patch goodInsert to remove .select() + .throwOnError()
pnpm ep3:run                                    # reproduce the failure — paste output below

# run CLI visibility step (see below)

# apply minimal fix in your IDE (see Ask section)

pnpm ep3:run                                    # confirm data is no longer null
pnpm ep3:verify                                 # assert row returned with id + title
pnpm ep3:reset                                  # clean up for next run
```

---

## Symptom

```
▶ Insert  goodInsert — .insert({ title, amount })

data  : null
error : null
✔ Insert succeeded    ← printed even though we have no confirmation the row saved
```

No row ID. No way to know if the insert ran or silently failed.

---

## CLI visibility step

This is an SDK behavior issue — no CLI hook exists for it. Add a temporary
`console.log` immediately after the insert call in `scripts/ep3_crud.ts`:

```ts
const { data, error } = await supabase
  .from("receipts")
  .insert({ title, amount });

// Temporary diagnostic — add this line:
console.log("RAW RESPONSE →", JSON.stringify({ data, error, rowCount: Array.isArray(data) ? data.length : null }, null, 2));
```

Re-run `pnpm ep3:run`. You will see `data: null` even on a successful insert —
confirming this is not an error state, just missing method chains.

Remove the `console.log` after diagnosing.

---

## Ask

Paste the `goodInsert` function from `scripts/ep3_crud.ts` into this chat, then ask:

1. **Root cause**: why does `supabase-js` return `{ data: null, error: null }`
   when `.select()` is not chained onto `.insert()`? Where in the PostgREST
   spec does this behaviour come from?

2. **Quick diagnostic**: which two method chains are missing from `goodInsert`
   that would make the response unambiguous?

3. **Minimal fix**: show the corrected `goodInsert` function with:
   - `.select()` chained after `.insert()`
   - `.throwOnError()` chained after `.select()`

4. **Re-run expectation**: after the fix, `pnpm ep3:run` should print:
   ```
   data  : [{ id: "<uuid>", title: "...", amount: ..., ... }]
   ✔  Row returned — id: <uuid>
   ```

5. **Verify step**: `pnpm ep3:verify` asserts:
   - Insert returns a non-null array
   - Row contains `id` and `title`
   - No uncaught error

6. **Replay commands**:
   ```bash
   pnpm ep3:reset && pnpm ep3:break
   ```

---

## Paste area

**`pnpm ep3:run` output:**
```
(paste here)
```

**`goodInsert` function from `scripts/ep3_crud.ts`:**
```ts
(paste here)
```
