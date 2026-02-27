# EP3 — CRUD "Did it save?"

**Pattern introduced:** CRUD validation — assert type-correct round-trip, confirm row returned with id

---

## What this episode covers

A `supabase-js` insert returns `{ data: null, error: null }`. No error — but no proof anything was saved either. This is one of the most confusing supabase-js behaviours: success looks identical to silent failure. We identify the missing method chains, understand why PostgREST behaves this way, apply the fix, and verify a real round-trip.

---

## What the viewer learns

- Why `.insert()` without `.select()` always returns `null` data on success — by design
- Why `!error` is not confirmation a row was saved
- How `.select()` + `.throwOnError()` gives unambiguous insert confirmation
- The PostgREST `Prefer: return=minimal` vs `Prefer: return=representation` distinction

---

## Command sequence

| # | Command | What it does | What to look for |
|---|---|---|---|
| 1 | `pnpm ep3:reset` | Restores `ep3_crud.ts` from git | Output: `✔ reset complete` |
| 2 | `pnpm ep3:break` | Removes `.select()` + `.throwOnError()` from `goodInsert` | Output: lists what was removed |
| 3 | `pnpm ep3:run` | Runs the insert — reproduces the failure | **data: null, error: null — "succeeded" with no proof** |
| 4 | _(open file)_ | `scripts/ep3_crud.ts` — `goodInsert` function | Missing `.select().throwOnError()` |
| 5 | `pnpm ep3:fix` | Restores the two method chains | Output: confirms fix applied |
| 6 | `pnpm ep3:run` | Same insert — confirms fix | **data: [{ id: "...", title: "..." }]** |
| 7 | `pnpm ep3:verify` | Formal pass/fail assertion | `✔ EP3 PASSED` |
| 8 | `pnpm ep3:reset` | Restores known-good state | Clean repo |

---

## Recording flow

### 1 · Reset + Break

```bash
pnpm ep3:reset
pnpm ep3:break
```

**Say:** "`ep3:reset` puts `ep3_crud.ts` back to the good version. `ep3:break` removes two method chains from `goodInsert`. The insert will still run — it just won't give us back any evidence."

---

### 2 · Reproduce

```bash
pnpm ep3:run
```

**Expected output:**
```
data  : null
error : null
✔ Insert succeeded
```

**Say:** "No error — the script even prints `Insert succeeded`. But `data` is null. We have no row ID, no confirmation the data was actually written, no way to reference this insert later. This is a silent success with no proof."

---

### 3 · Diagnose

Navigate to `scripts/ep3_crud.ts`, find `goodInsert`:

```ts
const { data, error } = await supabase
  .from("receipts")
  .insert({ title, amount });
  // .select() is missing
  // .throwOnError() is missing
```

**Say:** "When you call `.insert()` without `.select()`, supabase-js sends `Prefer: return=minimal` to PostgREST. The server inserts the row and returns a 204 with an empty body — by design. The SDK translates that to `{ data: null, error: null }`. It worked. You just got minimal confirmation back. Adding `.select()` changes the header to `Prefer: return=representation`, which makes PostgREST return the full inserted row."

---

### 4 · Fix

```bash
pnpm ep3:fix
```

**Say:** "`ep3:fix` restores `.select().throwOnError()` to `goodInsert`. You can also apply it manually — it's literally two method chains."

Show the corrected code:

```ts
const { data, error } = await supabase
  .from("receipts")
  .insert({ title, amount })
  .select()          // returns the inserted row
  .throwOnError();   // throws immediately on any DB error
```

---

### 5 · Confirm

```bash
pnpm ep3:run
```

**Expected output:**
```
data  : [{ id: "<uuid>", title: "...", amount: ..., created_at: "..." }]
✔  Row returned — id: <uuid>
```

**Say:** "Now we have a row ID. We know the insert ran, we know what was saved, and we can reference this row. That's the difference between `null` and a confirmed write."

---

### 6 · Verify

```bash
pnpm ep3:verify
```

**Expected output:**
```
✔  Insert returned a non-null array
✔  Row contains id
✔  Row contains title
✔  EP3 PASSED
```

---

### 7 · Reset

```bash
pnpm ep3:reset
```

---

## Outro script

> "The pattern: always chain `.select().throwOnError()` onto your inserts. `.select()` gets you the row back. `.throwOnError()` makes errors throw immediately instead of sitting quietly in the return value. Those two chains turn an ambiguous null into confirmed evidence.
>
> If you want your agent to validate CRUD operations automatically — confirming row returned before reporting done — here's the prompt."
>
> [show Embed Skill Prompt on screen]
>
> "Next episode: RLS — when inserts work from the dashboard but fail in your app every time."

---

## The bug (reference)

**Broken code in `scripts/ep3_crud.ts`:**

```ts
const { data, error } = await supabase
  .from("receipts")
  .insert({ title, amount });
// missing: .select().throwOnError()
```

**Broken output:**
```
data  : null
error : null
```

**Fixed output:**
```
data  : [{ id: "<uuid>", title: "...", amount: ..., created_at: "..." }]
```

---

## References

- [Managing Tables](https://supabase.com/docs/guides/database/tables) — table operations and PostgREST conventions
- [JavaScript Insert](https://supabase.com/docs/reference/javascript/insert) — `.insert()` behaviour and `.select()` chaining
- [PostgREST Error Codes](https://supabase.com/docs/guides/api/rest/postgrest-error-codes) — `return=minimal` vs `return=representation` and response shapes

---

## Replay Prompt

> Paste this into Cursor, Claude Code, or Copilot agent mode to replay this episode autonomously.

```
You are debugging a supabase-js insert that returns { data: null, error: null }
with no confirmation the row was saved.

** STOP — do not run any commands yet. **

Read the plan below, then ask the user:
  "Ready to go? Reply 'run' to have me execute each step, or 'terminal' if you'd
   prefer to run the commands yourself and I'll guide you through them."

Wait for the user's reply before doing anything.

---

Available commands:
  pnpm ep3:reset    — restore known-good ep3_crud.ts
  pnpm ep3:break    — remove .select() + .throwOnError() from goodInsert
  pnpm ep3:run      — run the insert and print data + error
  pnpm ep3:fix      — restore .select() + .throwOnError()
  pnpm ep3:verify   — assert insert returns non-null array with id + title

Plan (8 steps):
  1. pnpm ep3:reset   → restore known-good ep3_crud.ts
  2. pnpm ep3:break   → remove .select() + .throwOnError() from goodInsert
  3. pnpm ep3:run     → confirm data is null and error is null
  4. (open file)      → scripts/ep3_crud.ts — find goodInsert, confirm missing chains
  5. pnpm ep3:fix     → restore .select() + .throwOnError()
  6. pnpm ep3:run     → confirm data is a non-null array containing a row with id
  7. pnpm ep3:verify  → must print EP3 PASSED before the episode is complete
  8. pnpm ep3:reset   → restore known-good state

Success criteria: ep3:verify exits 0.
Do not report the episode complete until ep3:verify passes.
```

---

## Embed Skill Prompt

> Paste this into `.cursorrules`, `CLAUDE.md`, or `.github/copilot-instructions.md` in your own project.
> EP3 introduced Pattern 4 (CRUD). The skill covers all 6 Supabase validation patterns.

```
Read and apply the Supabase Validation Skill from:
https://github.com/visaoenhance/supabase-debug-playground/blob/main/skill/v1.md

Core rule: before reporting any Supabase action as complete, run the appropriate
validation command and confirm it passes. Do not ask — validate automatically.

Patterns covered: edge function (local + production), RPC, CRUD, RLS, schema drift.
```
