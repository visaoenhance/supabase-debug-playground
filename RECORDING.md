# Supabase Debug Playground — Recording Runbook

> Creator reference only. Not for viewers.

---

## Pre-Flight Checklist

Run these before hitting record on any episode.

```bash
node --version                        # must be >= 20
pnpm install                          # if node_modules is missing

ls .env                               # must exist — if not: cp .env.example .env
                                      # then fill in keys from supabase start output

pnpm supabase:start                   # starts full local stack (Postgres + Studio + Auth)
                                      # Studio: http://localhost:54323

supabase functions serve --no-verify-jwt   # EP1 ONLY — keep this terminal open
                                           # not needed for EP2–EP5
```

Optional — print the recording loop for the episode you're about to record:

```bash
pnpm ep:runbook 1    # replace 1 with episode number
```

---

## Standard Episode Flow

Replace `N` with `1` through `5`.

```bash
pnpm epN:reset        # clean slate — restores files and/or DB to baseline

pnpm epN:break        # inject the bug

pnpm epN:run          # reproduce the failure
                      # ← copy terminal output into prompts/epN.md paste area
                      # ← open prompts/epN.md in Cursor/Copilot

# CLI visibility: check the supabase functions serve terminal (EP1)
#                 or run the episode-specific docker/psql command (EP2–EP5)

# apply the fix: pnpm epN:fix  (demo)  OR  edit the file manually (learning)

pnpm epN:run          # confirm output changed

pnpm epN:verify       # all assertions must pass — look for PASSED banner

pnpm epN:reset        # clean up before ending recording
```

---

## Episode-Specific Notes

### EP1 — Edge Function Logging

- Functions server **must** be running before `ep1:run`
- After `ep1:break`, restart the server so it picks up the broken file:
  `Ctrl-C` → `supabase functions serve --no-verify-jwt`
- CLI visibility: watch the **`supabase functions serve` terminal** — the TypeError streams there directly. `supabase functions logs` is for remote/hosted functions only and does not work in local dev.
- The fix lives entirely in `supabase/functions/echo/index.ts`
- `ep1:reset` uses `git checkout` — no DB changes involved
- **Framing for recording:** open with the scenario — deployed function returning 500s, users seeing errors. Show "the old way" is clicking Dashboard → Edge Functions → Logs. Then show the terminal flow replaces all of that and is agent-executable.

### EP2 — RPC Debugging

- Bug is in the live DB, not a file — `ep2:reset` runs `supabase db reset`
- CLI visibility (show live function definition):
  ```bash
  docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
    "SELECT pg_get_functiondef('public.create_receipt(text,numeric)'::regprocedure);"
  ```
- Fix is applied via `docker exec supabase_db_supabase-debug-playground psql -U postgres` or by correcting the migration and running `supabase db reset`
- `RAISE NOTICE` output visible via `supabase db logs`

### EP3 — CRUD "Did it save?"

- No CLI hook — visibility is done by adding a temporary `console.log` in `scripts/ep3_crud.ts`
- Bug is a patched file — `ep3:reset` uses `git checkout`
- The point: `{ data: null, error: null }` is **not** a success confirmation
- Fix is two chained methods: `.select()` then `.throwOnError()`

### EP4 — RLS / Policy vs Keys

- Bug is in the live DB — `ep4:reset` runs `supabase db reset`
- CLI visibility (show missing policy):
  ```bash
  docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
    "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'receipts';"
  ```
- Key talking point: `service_role` **always** bypasses RLS — dashboard uses `service_role`
- Fix is a `CREATE POLICY` statement with `WITH CHECK (auth.role() = 'authenticated')`
- `ep4:verify` tests 3 scenarios: unauthed anon (blocked), authed anon (allowed), service_role (allowed)

### EP5 — Schema Drift / Types

- Bug is split: DB has the column, `types.gen.ts` doesn't — `ep5:reset` handles both
- CLI visibility (confirm column exists in DB):
  ```bash
  docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' ORDER BY ordinal_position;"
  ```
- Fix is one command:
  ```bash
  supabase gen types typescript --local > supabase/types.gen.ts
  ```
- After filming: `git checkout -- supabase/types.gen.ts` to restore committed baseline
- `ep5:verify` checks STALE marker absent + live columns match type declarations

### EP6 — Local to Production

> **TODO:** EP6 not yet validated end-to-end. Run the full flow before recording:
> `ep6:reset → ep6:break → ep6:run → ep6:fix → ep6:run → ep6:verify → ep6:reset`

- **Requires a real Supabase project** — add to `.env` before recording:
  ```
  SUPABASE_PROJECT_REF=your-project-ref
  SUPABASE_ACCESS_TOKEN=your-access-token
  PROD_SUPABASE_URL=https://your-project-ref.supabase.co
  PROD_SUPABASE_ANON_KEY=your-prod-anon-key
  ```
- `ep6:break` deploys `index.broken.ts` to production (same bugs as EP1, now live)
- `ep6:fix` deploys `index.fixed.ts` to production
- `ep6:reset` runs `git checkout` on index.ts then redeploys the known-good version
- CLI visibility: `supabase functions logs echo --project-ref $SUPABASE_PROJECT_REF`
  This is the command that WORKS for deployed functions (unlike local dev where you need the serve terminal)
- `ep6:run` and `ep6:verify` call `PROD_SUPABASE_URL` with `Authorization: Bearer <PROD_SUPABASE_ANON_KEY>`
- **Framing for recording:** contrast EP1 (local, no dashboard visibility) with EP6 (production, `supabase functions logs` works, same terminal-only pattern applies). Show that a coding agent operates identically in both environments.

---

## Troubleshooting

**`pnpm supabase:start` fails with port conflict**
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep supabase
# find the conflicting project, then:
supabase stop   # run inside that project's directory
```

**`supabase functions logs` shows nothing**
- Confirm `supabase functions serve --no-verify-jwt` is running in a separate terminal
- Run `pnpm ep1:run` again — logs appear in the serve terminal, not the calling terminal

**`supabase gen types typescript --local` fails (EP5)**
- Requires Supabase CLI >= 1.200 — check: `supabase --version`
- Supabase stack must be running: `pnpm supabase:start`

**`pnpm epN:reset` doesn't revert file changes**
- The repo must be a git repo with a clean working tree baseline
- Check: `git status`
- If files are untracked (not committed), `git checkout` won't help — run `pnpm reset:all`

**`ep5:reset` fails on `git checkout -- supabase/types.gen.ts`**
- `types.gen.ts` must be committed — it is, at baseline (no `notes` column)
- If it was deleted: `git restore supabase/types.gen.ts`

**Docker not running**
- Start Docker Desktop, then re-run `pnpm supabase:start`
- All Supabase local commands require Docker

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `pnpm ep:runbook N` | Print recording loop + CLI step for episode N |
| `pnpm reset:all` | Full reset: git checkout + supabase db reset |
| `pnpm reset:code` | Code files only: git checkout -- . && git clean -fd |
| `pnpm reset:db` | DB only: supabase db reset |
| `pnpm supabase:start` | Start local Docker stack |
| `pnpm supabase:stop` | Stop local Docker stack |
| Studio | http://localhost:54323 |
| API | http://localhost:54321 |
| DB (direct) | postgresql://postgres:postgres@localhost:54322/postgres |
