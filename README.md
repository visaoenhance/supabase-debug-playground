# Supabase Debug Playground

![License](https://img.shields.io/badge/license-MIT-green)
![Built for Supabase](https://img.shields.io/badge/built%20for-Supabase-3ECF8E)
![Validation First](https://img.shields.io/badge/validation-No%20Evidence.%20Not%20done.-black)

A **6-episode video series** repo demonstrating common [Supabase](https://supabase.com/) debugging scenarios.  
Each episode has a **reset → break → run → fix → verify** workflow you can execute entirely from the terminal — no dashboard required.

> **Scope**: this repo runs entirely **locally** against a Docker-based Supabase stack — no cloud project or Supabase account required.  
> The debugging concepts (RLS, RPC errors, schema drift, CRUD footguns, edge function logging) apply equally to cloud projects. The Supabase Validation Skill (`skills/supabase-validation/SKILL.md`) is the portable component — see [Using the Validation Skill in Your Own Project](#using-the-validation-skill-in-your-own-project).

---

## ⚠ Disclaimer — No Warranty

This repository and its associated skill (`skills/supabase-validation/SKILL.md`) are provided as-is, without warranty of any kind.

- This code may modify databases, policies, migrations, or deployed functions.
- You are responsible for understanding the environment (local, staging, production) before executing any command.
- The authors are not responsible for data loss, downtime, misconfiguration, or security exposure resulting from use of this repository or its patterns.

Always test in a local or isolated environment before applying changes to shared or production systems.

This repository is intended for educational and debugging pattern demonstration purposes only.

---

## Why This Exists

Supabase failures are often silent. A policy change, a schema drift, or a misconfigured edge function can appear to succeed while breaking something else entirely. Validation is frequently skipped — or agents report success before anything has been verified.

This repo encodes a validation-first contract: every Supabase action has a defined pass condition, and done means the pass condition was confirmed — not that the code was written.

The episodes demonstrate real failure modes. The skill (`skills/supabase-validation/SKILL.md`) captures the patterns as an agent-enforceable standard you can drop into any project. See `docs-public/SKILLS_METHODOLOGY.md` for the full annotated reference.

---

## Episode Recording Loop

This is the exact loop to follow for every episode.  
Steps 1–3 are scripted. Step 4 is manual (that's the learning moment). Step 5 confirms success.

```bash
# 1. Return to a known-good baseline
pnpm epN:reset

# 2. Intentionally introduce the failure
pnpm epN:break

# 3. Reproduce the issue and read the output
pnpm epN:run

# 4. Fix the issue manually in your IDE
#    (read prompts/epN.md for context + diagnostic hints to paste into Copilot)

# 5. Re-run to confirm output changed
pnpm epN:run

# 6. Verify all assertions pass
pnpm epN:verify
```

Replace `N` with `1`, `2`, `3`, `4`, `5`, or `6`.

### Reset commands

| Command | What it resets |
|---------|---------------|
| `pnpm epN:reset` | Per-episode reset (code file or DB depending on episode) |
| `pnpm reset:code` | `git checkout -- . && git clean -fd` — reverts all code changes |
| `pnpm reset:db` | `supabase db reset` — re-runs all migrations + seed |
| `pnpm reset:all` | Both of the above |

---

## File Tree

```
supabase-debug-playground/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
│
├── skills/
│   └── supabase-validation/
│       └── SKILL.md              ← installable Supabase Validation Skill (Agent Skills standard)
│
├── docs-public/
│   └── SKILLS_METHODOLOGY.md    ← full annotated skill reference + playground methodology
│
├── prompts/                      ← episode briefs + replay prompts for each episode
│   ├── ep1.md
│   ├── ep2.md
│   ├── ep3.md
│   ├── ep4.md
│   ├── ep5.md
│   └── ep6.md
│
├── scripts/
│   ├── utils.ts                  ← shared helpers (clients, logging, state)
│   ├── ep1_edge_function.ts      ← ep1:run target
│   ├── ep2_rpc.ts                ← ep2:run target
│   ├── ep3_crud.ts               ← ep3:run target (also patched by ep3:break)
│   ├── ep4_rls.ts                ← ep4:run target
│   ├── ep5_schema_drift.ts       ← ep5:run target
    ├── reset.ts                  ← deep reset (restores files + drops ep5 column + db reset)
│   └── episodes/
│       ├── _shared/
│       │   └── patch.ts          ← text-patch helper (applyPatch, swapFile, …)
│       ├── ep1/
│       │   ├── break.ts          ← ep1:break
│       │   └── verify.ts         ← ep1:verify
│       ├── ep2/
│       │   ├── break.ts
│       │   └── verify.ts
│       ├── ep3/
│       │   ├── break.ts
│       │   └── verify.ts
│       ├── ep4/
│       │   ├── break.ts
│       │   └── verify.ts
│       └── ep5/
│           ├── break.ts
│           └── verify.ts
│
└── supabase/
    ├── seed.sql
    ├── types.gen.ts              ← committed baseline (no `notes`); ep5:break overwrites; fix = supabase gen types
    ├── config.toml
    ├── functions/
    │   ├── echo/

```
    │   │   ├── index.ts          ← active (good) version
    │   │   └── index.broken.ts   ← intentional bugs for ep1:break
    │   └── secure-write/
    │       └── index.ts          ← bonus reference: server-side service_role insert (not wired to an episode)
    └── migrations/
        ├── 20240101000000_create_tables.sql
        ├── 20240101000001_create_rpc.sql
        └── 20240101000002_rls_policies.sql
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | https://nodejs.org |
| pnpm | ≥ 9 | `npm i -g pnpm` |
| Supabase CLI | ≥ 1.200 | `brew install supabase/tap/supabase` |
| Docker Desktop | any | https://www.docker.com/products/docker-desktop |

> **Windows users**: the `epN:reset` and `ep5:reset` scripts use bash syntax (`2>/dev/null`, `&&`).  
> Run them inside **Git Bash**, **WSL**, or the Supabase CLI's built-in shell.  
> PowerShell / CMD are not supported.

---

## Quickstart

```bash
# 1. Clone and install
git clone https://github.com/your-org/supabase-debug-playground
cd supabase-debug-playground
pnpm install

# 2. Start local Supabase (requires Docker running)
pnpm supabase:start

# 3. Copy env and fill in values printed by the command above
cp .env.example .env
#   SUPABASE_URL=http://127.0.0.1:54321
#   SUPABASE_ANON_KEY=<anon key from output>
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key from output>

# 4. Seed the database
pnpm supabase:seed

# 5. Start the edge function server (keep this terminal open)
supabase functions serve --no-verify-jwt

# 6. In a new terminal — run any episode
pnpm ep1:break && pnpm ep1:run
# ... watch the failure, then:
pnpm ep1:verify

# 7. Reset everything back to baseline at any time
pnpm reset
```

---

## Episode Commands

### Episode 1 — Edge Function Logging

> **Concept**: Diagnose opaque 500 errors from edge functions using `request-id` and structured JSON logs.

| Command | What happens |
|---------|-------------|
| `pnpm ep1:break` | Overwrites `echo/index.ts` with a version that crashes on every request (missing env var, no try/catch, no request_id) |
| `pnpm ep1:run` | POSTs to the echo function, prints status code + response body |
| `pnpm ep1:verify` | Asserts HTTP 200 and `request_id` present in response |

**Fix guide** (after `ep1:run` shows failure):
1. Open `supabase/functions/echo/index.broken.ts` and read the `// ❌ BUG` comments
2. The bugs are: accessing `Deno.env.get(...)` that returns `undefined`, then calling `.length` on it
3. The fix is already in `index.ts` (the baseline): wrap everything in try/catch, guard env vars, always propagate `request-id`
4. Run `pnpm reset` to restore the good version, then `pnpm ep1:verify`

**Expected output (broken)**:
```
✘  Expected 200, got 500
✘  request_id missing from response body
```

**Expected output (verified)**:
```
✔  HTTP 200 received
✔  request_id present in response: <uuid>
✔  Response body contains { ok: true }
✔  EP1 PASSED
```

---

### Episode 2 — RPC Debugging

> **Concept**: Read Supabase RPC error objects (`code`, `message`, `hint`) and use `RAISE NOTICE` for server-side logging.

| Command | What happens |
|---------|-------------|
| `pnpm ep2:break` | Replaces `create_receipt` SQL function with a version that INSERT-s into a non-existent column (`titl`) |
| `pnpm ep2:run` | Calls the RPC and prints the complete Supabase error object |
| `pnpm ep2:verify` | Restores correct SQL + calls RPC + asserts returned receipt |

**Fix guide**:
1. `ep2:run` prints `error.code: 42703` (column does not exist) and the bad column name
2. Open `supabase/migrations/20240101000001_create_rpc.sql` and see the correct version
3. `ep2:verify` applies the fixed SQL automatically

**Expected output (broken)**:
```
✘  RPC returned an error
  code    : 42703
  message : column "titl" of relation "receipts" does not exist
```

---

### Episode 3 — CRUD "Did it save?"

> **Concept**: `.insert()` without `.select()` returns `{ data: null, error: null }` on success — this is not a confirmation.

| Command | What happens |
|---------|-------------|
| `pnpm ep3:break` | Saves a flag that activates the broken pattern |
| `pnpm ep3:run` | Runs the broken insert (no `.select()`) and shows `data: null` alongside "success" |
| `pnpm ep3:verify` | Runs the fixed insert (`.select().throwOnError()`) and prints the returned row id |

**Fix guide**:
```ts
// ❌ Broken: no way to confirm the row was saved
const { data, error } = await supabase
  .from("receipts")
  .insert({ title, amount });
// data is always null; error may be ignored

// ✔ Fixed: get the row back + throw on any error
const { data } = await supabase
  .from("receipts")
  .insert({ title, amount })
  .select()        // ← forces PostgREST to return the row
  .throwOnError(); // ← turns any error into a thrown exception
```

---

### Episode 4 — RLS / Policy vs Keys

> **Concept**: RLS + missing INSERT policy blocks anon inserts silently. Service role bypasses RLS. The fix is a `WITH CHECK` policy.

| Command | What happens |
|---------|-------------|
| `pnpm ep4:break` | Enables RLS on `receipts` AND drops the INSERT policy |
| `pnpm ep4:run` | Attempts the same insert with both anon key and service_role key; shows the difference |
| `pnpm ep4:verify` | Re-adds the INSERT policy; tests all three scenarios (unauthed anon, authed anon, service role) |

**Fix guide**:
```sql
-- ❌ No policy → anon key insert blocked
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- ✔ Fix: add INSERT policy for authenticated users
CREATE POLICY "receipts: authenticated insert"
  ON public.receipts
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

**Key insight**: `service_role` key always **bypasses RLS**. If service works but anon fails — check your policies, not your code.

---

### Episode 5 — Schema Drift / Types

> **Concept**: Adding a column without regenerating TypeScript types causes a silent mismatch — TS compiles fine but the column is invisible to your code.

| Command | What happens |
|---------|-------------|
| `pnpm ep5:break` | Adds `notes TEXT` column to `receipts` in the DB; writes a stale `types.gen.ts` that does NOT include it |
| `pnpm ep5:run` | Compares live DB columns to columns declared in `types.gen.ts`; reports drift |
| `pnpm ep5:verify` | Re-runs drift check; asserts `notes` is present in `types.gen.ts` |

> **Types contract**: `supabase/types.gen.ts` is **committed** as a baseline (correct schema, no `notes`).  
> `ep5:break` overwrites it with a stale snapshot. The fix is `supabase gen types typescript --local > supabase/types.gen.ts`.  
> `ep5:reset` restores the committed baseline via `git checkout`.

**Fix guide**:
```bash
# After any migration that adds/removes/renames columns:
supabase gen types typescript --local > supabase/types.gen.ts
# Then commit the updated types.gen.ts alongside the migration SQL.
# This repo commits types.gen.ts so ep5:reset can restore it via git checkout.
```

**Expected output (broken)**:
```
✘  Columns in DB but MISSING from types: notes
⚠  Drift detected!
```

**Expected output (verified)**:
```
✔  types.gen.ts is in sync with the live database schema.
✔  `notes` column is present in the regenerated types.
✔  EP5 PASSED
```

---

### Episode 6 — Local to Production

> **Concept**: A locally-fixed edge function is not fixed in production until deployed. Production log visibility is typically accessed via the Supabase dashboard. CLI log availability may vary by environment.

> **Pre-flight**: requires a real Supabase project. Run `pnpm setup:ep6:env` once to fill `.env` with `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `PROD_SUPABASE_URL`, `PROD_SUPABASE_ANON_KEY`.

| Command | What happens |
|---------|-------------|
| `pnpm ep6:break` | Deploys the broken `echo` function to your real Supabase project |
| `pnpm ep6:run` | POSTs to the production URL and prints status + response |
| `pnpm ep6:fix` | Deploys the fixed `echo` function to production |
| `pnpm ep6:verify` | Asserts HTTP 200 + `request_id` present — against the production URL |

**Diagnose production errors** (dashboard only):
```
https://supabase.com/dashboard/project/<PROJECT_REF>/functions/echo/logs
```

**Expected output (broken)**:
```
HTTP status: 500
Response body: "Internal Server Error"
⚠  No request_id in response
```

**Expected output (verified)**:
```
✔  HTTP 200
✔  Body contains { ok: true }
✔  request_id present
✔  EP6 PASSED
```

---

## Utility Commands

| Command | Description |
|---------|-------------|
| `pnpm supabase:start` | Start local Supabase stack (runs migrations automatically) |
| `pnpm supabase:stop` | Stop local Supabase stack |
| `pnpm supabase:reset` | Reset DB and re-run all migrations (`supabase db reset`) |
| `pnpm supabase:seed` | Alias for `supabase:reset` — `db reset` picks up `seed.sql` automatically |
| `pnpm reset` | **Deep reset** via `scripts/reset.ts`: restores `echo/index.ts`, drops ep5 column, clears `.playground-state.json`, removes stale `types.gen.ts`, then runs `supabase db reset`. Use this to recover from any broken state. |
| `pnpm reset:code` | Revert all code changes: `git checkout -- . && git clean -fd` |
| `pnpm reset:db` | Reset database only: `supabase db reset` |
| `pnpm reset:all` | **Shallow reset**: `reset:code` then `reset:db`. Faster than `pnpm reset` but does not clear playground state files. |

---

## Supabase Validation Skill

[`skills/supabase-validation/SKILL.md`](skills/supabase-validation/SKILL.md) is a standalone, installable agent skill encoding the principle: **before reporting any Supabase action as complete, run the appropriate validation and confirm it passes.**

Drop it into your project's agent context file:
- **Cursor**: `.cursorrules`
- **Claude Code**: `CLAUDE.md`
- **Copilot**: `.github/copilot-instructions.md`

Or install via the Agent Skills standard:
```bash
npx skills add visaoenhance/supabase-debug-playground
```

> This installs only the validation skill — not the playground scripts or reset/break commands.

The skill covers all 6 patterns introduced in this series: edge functions (local + prod), RPC, CRUD, RLS, and schema drift.

For the full annotated reference including playground methodology, see [`docs-public/SKILLS_METHODOLOGY.md`](docs-public/SKILLS_METHODOLOGY.md).

---

## Observability Without the Dashboard

All local observability in this repo uses CLI-only tools:

```bash
# View Postgres logs (RAISE NOTICE from ep2)
supabase db logs

# Query DB directly
docker exec supabase_db_supabase-debug-playground psql -U postgres -c "SELECT * FROM receipts LIMIT 5;"

# List policies
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'receipts';"

# Check RLS status
docker exec supabase_db_supabase-debug-playground psql -U postgres -c \
  "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('receipts','profiles');"
```

---

## Troubleshooting

### "Missing required env var: SUPABASE_URL"
Copy `.env.example` to `.env` and fill in the values from `pnpm supabase:start`.

### Docker exec psql fails
Make sure Supabase is running: `pnpm supabase:start`. The container `supabase_db_supabase-debug-playground` must be up.

### Edge function returns 404
Make sure `supabase functions serve --no-verify-jwt` is running in a separate terminal.

### EP4 verify fails on "authed anon insert"
This requires the local Supabase Auth service.  Make sure `pnpm supabase:start` completed without errors.

### EP5 gen types fails
The `supabase gen types typescript --local` command requires Supabase CLI 1.200+.  
Check version: `supabase --version`.

### Docker not running
All local Supabase commands require Docker Desktop to be running.

---

## Using the Validation Skill in Your Own Project

This repository is a local teaching harness. The portable component is the Supabase Validation Skill ([`skills/supabase-validation/SKILL.md`](skills/supabase-validation/SKILL.md)). Drop that file into your project's agent context to enforce validation discipline automatically.

For deeper context on the methodology and how the skill relates to the playground episodes, see [`docs-public/SKILLS_METHODOLOGY.md`](docs-public/SKILLS_METHODOLOGY.md).

The patterns, prompts, and verify scripts are also portable. Here is what maps across:

### Prompts → Cursor / Copilot rules

The files in `prompts/` are standalone — copy any of them into your project as:
- **Cursor**: `.cursor/rules/supabase-debug.md`
- **Copilot**: `.github/copilot-instructions.md` (append the relevant sections)

Each prompt is scoped to a single failure mode and tells the AI exactly which file to inspect and which CLI command to run.

### Verify scripts → VS Code tasks

The `scripts/episodes/epN/verify.ts` scripts are plain TypeScript with no playground-specific dependencies.  
You can copy a verify script alongside your own migration and register it as a VS Code task:

```jsonc
// .vscode/tasks.json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Supabase: check RLS policies",
      "type": "shell",
      "command": "tsx scripts/verify-rls.ts",
      "group": "test"
    },
    {
      "label": "Supabase: check schema drift",
      "type": "shell",
      "command": "supabase gen types typescript --local > supabase/types.gen.ts && echo 'Types regenerated'",
      "group": "test"
    }
  ]
}
```

### Cloud projects

The only two differences when targeting a cloud Supabase project:

| Local | Cloud |
|-------|-------|
| `supabase db execute --local --sql '...'` | `supabase db execute --sql '...'` (needs `SUPABASE_PROJECT_REF` + `SUPABASE_ACCESS_TOKEN` in env) |
| `supabase functions serve` | `supabase functions deploy <name>` |

Everything else — the SDK calls, RLS patterns, RPC debugging, type generation — is identical.

---

## Contributing

PRs welcome!  Each episode is isolated to one script file and one SQL change — keep it that way.

---

## License

MIT

---

## About

Built by Emilio Taylor (Visao LLC) — https://visaoenhance.com
