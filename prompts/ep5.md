# EP5 — Schema Drift

**Pattern introduced:** Schema drift validation — diff live DB columns against `types.gen.ts`

---

## What this episode covers

A column exists in the live Postgres database but not in `supabase/types.gen.ts`. TypeScript compiles cleanly — it simply doesn't know the column exists. No autocomplete, no type error on insert, and any value written to the column passes through the type system silently. We detect the drift, understand why TypeScript can't catch it, regenerate the types, and verify the diff is clean.

---

## What the viewer learns

- Why adding a DB column without regenerating types causes a silent mismatch
- Why TypeScript gives you zero signal when `types.gen.ts` is stale
- How to detect drift from the terminal by comparing live schema to `types.gen.ts`
- Where `supabase gen types` belongs in your development and CI workflow

---

## Command sequence

| # | Command | What it does | What to look for |
|---|---|---|---|
| 1 | `pnpm ep5:reset` | Drops `notes` column + restores committed `types.gen.ts` | Output: `✔ reset complete` |
| 2 | `pnpm ep5:break` | Adds `notes TEXT` column to DB + writes stale `types.gen.ts` | Output: confirms column added, types marked stale |
| 3 | `pnpm ep5:run` | Diffs live columns vs `types.gen.ts` — reproduces drift | **`notes` in DB but MISSING from types** |
| 4 | `information_schema` query | Confirms `notes` column in live DB | `notes \| text \| YES` in results |
| 5 | `pnpm ep5:fix` | Regenerates `types.gen.ts` from live schema | Runs `supabase gen types typescript --local` |
| 6 | `pnpm ep5:run` | Same diff — confirms no drift | **`✔ No drift detected`** |
| 7 | `pnpm ep5:verify` | Formal pass/fail assertion | `✔ EP5 PASSED` |
| 8 | `pnpm ep5:reset` | Restores known-good state | Clean repo |

---

## Recording flow

### 1 · Reset + Break

```bash
pnpm ep5:reset
pnpm ep5:break
```

**Say:** "`ep5:reset` drops the `notes` column and restores the committed `types.gen.ts` — both in sync. `ep5:break` adds the column to the live database and writes a stale `types.gen.ts` that doesn't know about it. The database and the types are now out of sync."

---

### 2 · Reproduce

```bash
pnpm ep5:run
```

**Expected output:**
```
Live DB columns for `receipts`:
  id, user_id, title, amount, created_at, notes

Types columns for `receipts` (from types.gen.ts):
  id, user_id, title, amount, created_at

✘  Columns in DB but MISSING from types: notes
⚠  Drift detected!
```

**Say:** "The drift detector found it — `notes` is in the live database but not in the types. TypeScript compiled without a single error. It simply wasn't told the column exists."

---

### 3 · Diagnose

```bash
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' ORDER BY ordinal_position;"
```

**Expected:** `notes | text | YES` in the column list.

**Say:** "The column is real and live. TypeScript doesn't know about it because `types.gen.ts` is a snapshot — it captures the schema at the moment it was generated. The moment any migration runs after that, the snapshot is stale. TypeScript has no way to know."

Navigate to `supabase/types.gen.ts` and show the `receipts.Row` interface — `notes` is absent.

---

### 4 · Fix

```bash
pnpm ep5:fix
```

**Say:** "`ep5:fix` runs `supabase gen types typescript --local` and writes the output to `supabase/types.gen.ts`. That's the entire fix — one command. In your real workflow this belongs after every local migration, and as a CI step before any deploy."

The command is the fix:
```bash
supabase gen types typescript --local > supabase/types.gen.ts
```

---

### 5 · Confirm

```bash
pnpm ep5:run
```

**Expected output:**
```
✔  No drift detected — live schema matches types.
```

---

### 6 · Verify

```bash
pnpm ep5:verify
```

**Expected output:**
```
✔  types.gen.ts exists and is not stale
✔  Live DB columns match types
✔  notes column present in both
✔  EP5 PASSED
```

---

### 7 · Reset

```bash
pnpm ep5:reset
```

---

## Outro script

> "The pattern: after every migration, regenerate your types. `supabase gen types typescript --local > supabase/types.gen.ts` — one command, and your TypeScript knows what's in the database. In CI, run it before any deploy that includes a migration and fail the build if the diff is non-empty.
>
> Here's the prompt to give your agent so it detects and resolves schema drift automatically."
>
> [show Embed Skill Prompt on screen]
>
> "Next episode: Local to Production — when the fix that works locally is the broken version in production."

---

## The bug (reference)

**What `ep5:break` does:**
1. Runs `ALTER TABLE receipts ADD COLUMN notes TEXT;` against the live DB
2. Writes a stale `supabase/types.gen.ts` that does not include `notes`

**Broken output:**
```
✘  Columns in DB but MISSING from types: notes
⚠  Drift detected!
```

**Fix command:**
```bash
supabase gen types typescript --local > supabase/types.gen.ts
```

**Fixed output:**
```
✔  No drift detected — live schema matches types.
```

---

## References

- [Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types) — `supabase gen types` CLI usage and CI setup
- [Debugging and Monitoring](https://supabase.com/docs/guides/database/inspect) — `information_schema` queries for live DB inspection
- [Local Development](https://supabase.com/docs/guides/cli/local-development) — managing migrations and local/remote schema sync

---

## Replay Prompt

> Paste this into Cursor, Claude Code, or Copilot agent mode to replay this episode autonomously.

```
You are debugging a Supabase schema drift issue where a database column exists
in Postgres but is missing from supabase/types.gen.ts.

** STOP — do not run any commands yet. **

Read the plan below, then ask the user:
  "Ready to go? Reply 'run' to have me execute each step, or 'terminal' if you'd
   prefer to run the commands yourself and I'll guide you through them."

Wait for the user's reply before doing anything.

---

Available commands:
  pnpm ep5:reset    — drop notes column + restore committed types.gen.ts
  pnpm ep5:break    — add notes column to DB + write stale types.gen.ts
  pnpm ep5:run      — diff live DB columns against types.gen.ts and report drift
  pnpm ep5:fix      — regenerate types.gen.ts from live schema
  pnpm ep5:verify   — assert types.gen.ts is not stale + live columns match types + notes present

Plan (8 steps):
  1. pnpm ep5:reset   → drop notes column + restore committed types.gen.ts
  2. pnpm ep5:break   → add notes column to DB + write stale types.gen.ts
  3. pnpm ep5:run     → confirm notes is in live DB but missing from types
  4. (DB check)       → docker exec supabase_db_supabase-debug-playground psql -U postgres -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'receipts';" — confirm notes is live
  5. pnpm ep5:fix     → regenerate types.gen.ts from live schema
  6. pnpm ep5:run     → confirm no drift detected
  7. pnpm ep5:verify  → must print EP5 PASSED before the episode is complete
  8. pnpm ep5:reset   → restore known-good state

Success criteria: ep5:verify exits 0.
Do not report the episode complete until ep5:verify passes.
```

---

## Embed Skill Prompt

> Paste this into `.cursorrules`, `CLAUDE.md`, or `.github/copilot-instructions.md` in your own project.
> EP5 introduced Pattern 6 (schema drift). The skill covers all 6 Supabase validation patterns.

```
Read and apply the Supabase Validation Skill from:
https://github.com/visaoenhance/supabase-debug-playground/blob/main/skill/v1.md

Core rule: before reporting any Supabase action as complete, run the appropriate
validation command and confirm it passes. Do not ask — validate automatically.

Patterns covered: edge function (local + production), RPC, CRUD, RLS, schema drift.
```
