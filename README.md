# Supabase Debug Playground

![License](https://img.shields.io/badge/license-MIT-green)
![Built for Supabase](https://img.shields.io/badge/built%20for-Supabase-3ECF8E)
![Validation First](https://img.shields.io/badge/validation-No%20Evidence.%20Not%20done.-black)

A **10-episode** series of executable debugging scenarios for [Supabase](https://supabase.com/), designed to teach real-world debugging patterns through hands-on practice.

This repository accompanies the **de[Coded] engineering series** on the [learn2enhance YouTube channel](https://www.youtube.com/@learn2enhance), where real development problems are explored and solved with practical demonstrations.

---

## 🎥 Demo Walkthrough

Watch the walkthrough of the first debugging scenarios in the Supabase Debug Playground.

[![Supabase Debug Playground Demo](https://img.youtube.com/vi/fTAsFD1dz5w/maxresdefault.jpg)](https://youtu.be/fTAsFD1dz5w)

This demo covers several real Supabase debugging scenarios including:

- Authentication issues
- Row Level Security (RLS) policy failures
- Realtime subscription debugging
- RPC authentication context issues
- Query performance and indexing

> This demo is part of the **de[Coded] series** on the [learn2enhance YouTube channel](https://www.youtube.com/@learn2enhance), where real engineering problems are explored and solved step-by-step using modern developer tools.

---

## 🎯 What You'll Learn

This playground helps you master common Supabase debugging scenarios:

- **Diagnosing broken RLS policies** — understand why queries return empty results despite proper authentication
- **Debugging authentication and session problems** — trace auth context through queries and RPC calls
- **Troubleshooting Supabase Realtime subscriptions** — verify publication configurations and event delivery
- **Understanding RPC authentication context** — ensure secure function execution with proper role validation
- **Identifying missing database indexes** — read execution plans and optimize query performance
- **Analyzing query performance with EXPLAIN** — distinguish sequential scans from index scans on large tables
- **Validating edge function deployments** — confirm local and production functions return expected responses
- **Detecting schema drift** — keep TypeScript types in sync with database migrations

Each episode demonstrates a **broken state → the fix → verification → reusable debugging patterns** you can apply to your own projects.

---

## 📚 Repository Purpose

Supabase failures are often silent. A policy change, a schema drift, or a misconfigured edge function can appear to succeed while breaking something else entirely. Validation is frequently skipped — or agents report success before anything has been verified.

This repository serves as a **reproducible debugging playground** for common Supabase issues. Each episode:

- Introduces a realistic failure mode
- Provides diagnostic steps to identify root causes
- Demonstrates the fix with observable validation
- Encodes the pattern as a reusable skill

The validation patterns are extracted into a portable agent skill (see below) that you can install in any project to enforce evidence-based confirmation of Supabase operations.

---

## Supabase Validation Skill

> **The portable component. Install it once; it works in any project.**

The [`SKILL.md`](SKILL.md) in this repo is a standalone agent skill encoding a single principle:

**No Evidence. Not done.**

Every Supabase action — write, deploy, migrate, fix — is incomplete until observable output confirms it.

Install via the [Agent Skills](https://agentskills.io) standard:

```bash
npx skills add visaoenhance/supabase-debug-playground
```

This installs `SKILL.md` and loads all 10 pattern reference files on demand. It does **not** install the playground scripts or reset/break commands.

Drop it into your project's agent context file directly:
- **Cursor**: `.cursorrules`
- **Claude Code**: `CLAUDE.md`
- **GitHub Copilot**: `.github/copilot-instructions.md`

### The 10 Validation Patterns

| # | Pattern | Episode | Done when |
|---|---------|---------|-----------|
| 1 | [Edge Function (Local)](references/pattern-01-edge-function-local.md) | EP1 | HTTP 200 + `ok: true` + `request_id` present |
| 2 | [Edge Function (Production)](references/pattern-02-edge-function-production.md) | EP6 | Same checks against live URL |
| 3 | [RPC](references/pattern-03-rpc.md) | EP2 | No error + response contains expected data shape |
| 4 | [CRUD / Insert](references/pattern-04-crud-insert.md) | EP3 | Non-null array with `id` returned (not just exit 0) |
| 5 | [RLS](references/pattern-05-rls.md) | EP4 | All 3 roles pass: unauthed blocked, authed allowed, service_role allowed |
| 6 | [Schema Migration / Type Drift](references/pattern-06-schema-migration.md) | EP5 | `types.gen.ts` matches live DB after every migration |
| 7 | [Auth-Gated Query](references/pattern-07-auth-gated-query.md) | EP7 | All 3 auth states: no session → empty, wrong user → empty, owner → rows |
| 8 | [Realtime Subscription](references/pattern-08-realtime-subscription.md) | EP8 | `pg_publication_tables` membership confirmed + INSERT event received |
| 9 | [RPC Auth Context](references/pattern-09-rpc-auth-context.md) | EP9 | Unauthenticated call → explicit error + `anon` execute revoked |
| 10 | [Query Performance](references/pattern-10-query-performance.md) | EP10 | EXPLAIN shows Index Scan (not Seq Scan) on ≥ 1,000 row table |

Each reference file contains the full trigger definition, step-by-step validation procedure, fail signals, diagnostic SQL, and "done when" gate.

---

## The Playground

A **10-episode** series of executable debugging scenarios for [Supabase](https://supabase.com/).  
Each episode has a **reset → break → run → fix → verify** workflow you can run entirely from the terminal — no dashboard required.

> **Scope**: runs entirely **locally** against a Docker-based Supabase stack — no cloud project or account required.  
> The debugging concepts apply equally to cloud projects. The skill above is the portable component.

---

## ⚠ Disclaimer — No Warranty

This repository and its associated skill are provided as-is, without warranty of any kind.

- This code may modify databases, policies, migrations, or deployed functions.
- You are responsible for understanding the environment (local, staging, production) before executing any command.
- The authors are not responsible for data loss, downtime, misconfiguration, or security exposure resulting from use of this repository or its patterns.

Always test in a local or isolated environment before applying changes to shared or production systems.

This repository is intended for educational and debugging pattern demonstration purposes only.

---

## Core Principle: No Evidence. Not done.

This repo encodes a **validation-first contract**: every Supabase action has a defined pass condition, and "done" means the pass condition was confirmed — not just that the code was written.

The episodes demonstrate real failure modes. The skill captures the patterns as an agent-enforceable standard you can drop into any project. 

See [`docs-public/SKILLS_METHODOLOGY.md`](docs-public/SKILLS_METHODOLOGY.md) for the full annotated reference.

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

Replace `N` with `1` through `10`.

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
├── SKILL.md                      ← installable Supabase Validation Skill (Agent Skills standard)
├── references/                   ← one file per pattern, loaded on demand by npx skills add
│   ├── pattern-01-edge-function-local.md
│   ├── pattern-02-edge-function-production.md
│   ├── pattern-03-rpc.md
│   ├── pattern-04-crud-insert.md
│   ├── pattern-05-rls.md
│   ├── pattern-06-schema-migration.md
│   ├── pattern-07-auth-gated-query.md
│   ├── pattern-08-realtime-subscription.md
│   ├── pattern-09-rpc-auth-context.md
│   └── pattern-10-query-performance.md
│
├── .env.example
├── package.json
├── tsconfig.json
│
├── docs-public/
│   └── SKILLS_METHODOLOGY.md    ← full annotated skill reference + playground methodology
│
├── prompts/                      ← episode briefs + replay prompts
│   ├── ep1.md  through  ep10.md
│
├── scripts/
│   ├── utils.ts                  ← shared helpers (clients, logging, state)
│   ├── ep1_edge_function.ts      ← ep1:run
│   ├── ep2_rpc.ts                ← ep2:run
│   ├── ep3_crud.ts               ← ep3:run
│   ├── ep4_rls.ts                ← ep4:run
│   ├── ep5_schema_drift.ts       ← ep5:run
│   ├── ep7_auth.ts               ← ep7:run
│   ├── ep8_realtime.ts           ← ep8:run
│   ├── ep9_rpc_auth.ts           ← ep9:run
│   ├── ep10_perf.ts              ← ep10:run
│   ├── reset.ts                  ← deep reset
│   └── episodes/
│       ├── ep1/ … ep10/
│       │   ├── break.ts
│       │   ├── fix.ts
│       │   └── verify.ts
│       └── _shared/
│           └── patch.ts
│
└── supabase/
    ├── seed.sql                  ← includes 10k receipts rows for EP10 EXPLAIN plans
    ├── types.gen.ts
    ├── config.toml
    ├── functions/
    │   ├── echo/                 ← EP1 + EP6
    │   └── secure-write/
    └── migrations/
        ├── 20240101000000_create_tables.sql
        ├── 20240101000001_create_rpc.sql
        ├── 20240101000002_rls_policies.sql
        ├── 20240101000003_user_notes.sql       ← EP7: user_notes + RLS
        ├── 20240101000004_get_my_notes_rpc.sql ← EP9: get_my_notes RPC
        ├── 20240101000005_realtime_publication.sql ← EP8: realtime publication
        └── 20240101000006_receipts_ep10_index.sql  ← EP10: created_at index
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
git clone https://github.com/visaoenhance/supabase-debug-playground
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

### Episode 7 — Auth-Gated Queries

> **Concept**: RLS policies using `auth.uid()` produce 3 distinct states (no session / wrong user / owner) that all return `[]` with no error — silent failures unless you test each one.

> **Validation skill**: [Pattern 7](references/pattern-07-auth-gated-query.md)

| Command | What happens |
|---------|-------------|
| `pnpm ep7:break` | Drops the `user_notes` RLS select policy so no authenticated user gets rows |
| `pnpm ep7:run` | Tests all 3 auth states and shows which pass/fail |
| `pnpm ep7:verify` | Restores policy and asserts all 3 states produce expected results |

**The 3 states you must always test:**

| State | Caller | Expected |
|-------|--------|---------|
| No session | Anon key, no JWT | `[]` — no data leaked |
| Wrong user | Signed-in but doesn't own rows | `[]` — RLS scoped |
| Owner | Signed-in and owns rows | Rows returned |

**Key insight**: states 1 and 2 look identical (both return `[]`). The only way to know RLS is working correctly — not just silently empty — is to test the owner state too.

---

### Episode 8 — Realtime Subscription

> **Concept**: Realtime events require the table to be in `pg_publication_tables`. A missing entry causes silent event timeout — subscription status shows `SUBSCRIBED`, inserts succeed, but events never arrive.

> **Validation skill**: [Pattern 8](references/pattern-08-realtime-subscription.md)

| Command | What happens |
|---------|-------------|
| `pnpm ep8:break` | Removes `receipts` from the `supabase_realtime` publication |
| `pnpm ep8:run` | Sets up a subscription, inserts a row, waits for the event — times out silently |
| `pnpm ep8:verify` | Re-adds the table to the publication, confirms event is received |

**Diagnostic SQL**:
```sql
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

**Fix**:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;
```

**CRITICAL**: register your `.on()` listener **before** calling `.subscribe()` — adding it after silently drops the callback.

---

### Episode 9 — RPC Auth Context

> **Concept**: `auth.uid()` returns `NULL` when no JWT is present. Without a null guard, `WHERE col = NULL` silently returns an empty set instead of raising an error.

> **Validation skill**: [Pattern 9](references/pattern-09-rpc-auth-context.md)

| Command | What happens |
|---------|-------------|
| `pnpm ep9:break` | Replaces `get_my_notes` with a version missing the `auth.uid()` null guard |
| `pnpm ep9:run` | Calls the RPC without authentication — shows silent empty result instead of error |
| `pnpm ep9:verify` | Restores null guard, confirms unauthenticated call raises error, authenticated returns data |

**Required null guard pattern**:
```sql
IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'not authenticated'
    USING ERRCODE = 'PT401',
          HINT    = 'Call this function with an authenticated session';
END IF;
```

**Grant hardening** (also verified):
```sql
REVOKE EXECUTE ON FUNCTION public.get_my_notes() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.get_my_notes() TO authenticated;
```

---

### Episode 10 — Query Performance

> **Concept**: Missing indexes on filter/sort columns cause Seq Scans that scale linearly. EXPLAIN plan shape (Index Scan vs Seq Scan) is the correct assertion — not timing alone.

> **Validation skill**: [Pattern 10](references/pattern-10-query-performance.md)

| Command | What happens |
|---------|-------------|
| `pnpm ep10:break` | Drops the `created_at DESC` index from `receipts` |
| `pnpm ep10:run` | Runs EXPLAIN ANALYZE on a date-range + ORDER BY query — shows Seq Scan |
| `pnpm ep10:verify` | Recreates index, runs ANALYZE, asserts EXPLAIN shows Index Scan |

**Seed**: `supabase/seed.sql` inserts 10,000 rows via `generate_series` so the planner chooses Index Scan when the index is present.

**Expected EXPLAIN (broken)**:
```
Seq Scan on receipts  (rows=10000 ...)
  → Sort
    → Limit
```

**Expected EXPLAIN (verified)**:
```
Limit
  → Index Scan Backward using receipts_created_at_desc_idx on receipts
```

**Production note**: use `CREATE INDEX CONCURRENTLY` to avoid table-level locks. Cannot be used inside a transaction block.

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

## Using the Validation Skill in Your Own Project

The portable component is the Supabase Validation Skill — [`SKILL.md`](SKILL.md) at the repo root, with 10 reference files in [`references/`](references/).

Install via the Agent Skills standard:

```bash
npx skills add visaoenhance/supabase-debug-playground
```

Or drop [`SKILL.md`](SKILL.md) into your project's agent context file:
- **Cursor**: `.cursorrules`
- **Claude Code**: `CLAUDE.md`
- **GitHub Copilot**: `.github/copilot-instructions.md`

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

## Prompts and Verify Scripts in Your Own Project

The patterns, prompts, and verify scripts are also portable without installing the full skill.

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
