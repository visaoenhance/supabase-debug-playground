---
name: supabase-validation
description: "Supabase validation skill. Use when writing, deploying, or modifying any Supabase resource — edge functions, RPC functions, CRUD operations, RLS policies, or schema migrations. Adds mandatory pass/fail verification to every Supabase action before reporting completion."
license: MIT
compatibility: "Compatible with Cursor, Claude Code, and GitHub Copilot agent mode. Requires supabase CLI and Node >= 20 for local validation commands. Works with any project using Supabase (local or remote)."
metadata:
  author: visaoenhance
  version: "1.1.0"
references:
  - references/pattern-01-edge-function-local.md
  - references/pattern-02-edge-function-production.md
  - references/pattern-03-rpc.md
  - references/pattern-04-crud-insert.md
  - references/pattern-05-rls.md
  - references/pattern-06-schema-migration.md
  - references/pattern-07-auth-gated-query.md
  - references/pattern-08-realtime-subscription.md
  - references/pattern-09-rpc-auth-context.md
  - references/pattern-10-query-performance.md
---

> **This skill is safe for use in any project.**
> It never runs reset/break loops or destructive commands.
> Those exist only in the supabase-debug-playground teaching harness and are
> not part of this skill.

---

## Normative Principle

**No Evidence. Not done.**

Every action this skill governs — write, deploy, migrate, fix — is incomplete
until observable, raw output confirms it. This is not a style preference; it is
the contract this skill enforces.

**Two-tier action classification:**
- **Destructive actions** require environment classification (Rule A) + explicit
  confirmation before execution.
- **High-sensitivity file edits** (any file under `supabase/`) require showing
  a diff + confirmation before applying — even if the operation is not
  destructive by the definition below.

---

## Destructive Operations — Definition

Destructive operations are defined here so the term is not interpreted loosely.
Any rule that gates on "destructive" applies to all items in this list:

- Dropping tables or columns
- Resetting the database (`supabase db reset`)
- Replaying migrations against any live project (local, staging, or production —
  even local, unless explicitly confirmed disposable)
- Deleting rows or truncating tables
- Overwriting a deployed edge function
- Modifying or dropping RLS policies
- Any write using `service_role` key

If an operation is not on this list, it is still subject to Rules B and A
(evidence and environment classification) but does not require the full
destructive-operation confirmation protocol.

---

## Global Clause — Non-Interactive Mode

**Treat as non-interactive if any of the following are true:**
- No active chat session is available to receive a reply
- Running inside a CI job, automated workflow, or scheduled script
- Agent mode with `autoApprove`, `--yes`, or equivalent flag set
- The agent cannot determine whether a reply is possible

If uncertain, treat as non-interactive.

**Rule:** If user confirmation is required (by any rule below) but the agent is
running in a non-interactive context, the agent must:
1. Output the exact command, query, or SQL that would be executed
2. Explain what it does and why confirmation is required
3. Not execute it

A rule requiring confirmation does not become optional because the agent cannot
ask. It becomes a manual handoff.

---

## Global Clause — Never Disclose Secrets

**Never print, paste, log, or include in a diff:**
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (or any `service_role` key)
- JWTs or bearer tokens of any kind
- Any value that begins with `eyJ` (base64-encoded JWT)
- Any secret from `.env`, `.env.local`, or equivalent files

**If the agent needs to confirm a key is present:** state "I can see a value is
set for `SUPABASE_ANON_KEY`." If identity confirmation is needed, ask the user
to confirm the last 4 characters — do not print them.

**Showing `SUPABASE_URL` is permitted** — host portion only (e.g.,
`https://xyz.supabase.co`). Do not include query strings or path segments that
may carry tokens.

This rule applies even in local development.

---

## Rule A — Environment Classification Gate

Before any write, migration, RLS change, or function deploy, the agent must
classify the environment and surface evidence to the user. It must not proceed
until the environment type is confirmed.

**Classification levels:**
- `local` — `SUPABASE_URL` is `http://localhost:*`, or `supabase status` shows
  local instance
- `staging` — known non-production remote ref, explicitly confirmed by user
- `production` — any `*.supabase.co` URL or unrecognised project ref

**Evidence the agent must display before acting:**
- The value of `SUPABASE_URL` (host portion only — no keys)
- Output of `supabase status` or `supabase projects list` showing the project ref
- For production: the ref + any branch/context information available

**Enforcement:**
- `local` — agent may proceed with non-destructive validation commands
  autonomously. Non-destructive examples: `SELECT` schema inspection queries,
  `supabase functions logs`, `curl` / HTTP request replays, `git diff`,
  `supabase gen types typescript --local`.
- `staging` — agent must state the environment and confirm intent before writing
- `production` — agent must surface the full command for user review and require
  explicit "yes, proceed" before executing anything that writes or modifies schema
- If environment cannot be determined — treat as production; do not execute

**No Environment Assumptions (see also Rule G):** The agent must never infer
environment type from file presence alone — the existence of `.env`,
`supabase/config.toml`, or a `supabase/` directory does not confirm the
environment is local. Environment classification must be based only on runtime
evidence: the `SUPABASE_URL` value, output of `supabase status`, or an explicit
user statement. Rule G extends this constraint to all tasks, including read-only
inspection — not only pre-action gates.

---

## Rule B — No Silent Writes

An agent must never perform a write operation and report completion without
returning observable evidence that the write succeeded.

**Required evidence by operation type:**

| Operation | Required evidence |
|---|---|
| `INSERT` | Returned row with `id` from `.insert().select()` |
| `UPDATE` / `DELETE` | Row count or returned rows confirming the change |
| RLS policy change | Output of `SELECT policyname, cmd FROM pg_policies WHERE tablename = '...'` |
| Edge function deploy | HTTP response payload containing `request_id` and `ok: true` |
| Migration | `supabase db diff` or `information_schema.columns` query confirming column/table exists |
| Schema type regen | `git diff supabase/types.gen.ts` output (even if empty — show it) |

If the operation produces no returnable evidence (e.g., `Prefer: return=minimal`),
re-run the operation with `.select()` chained, or run a follow-up read query.

**Surface the raw output. Do not summarise before showing it.**
Return the actual payload — row object, JSON body, query result, diff — so the
user can verify directly. You may summarise after showing raw output.

```
// Bad
"Insert successful."

// Good
{ id: 42, created_at: "2026-02-28T20:14:22Z" }
// (then) "Insert confirmed — row id 42 returned."
```

---

## Rule C — `service_role` Restricted Use

`service_role` bypasses all RLS policies. Its use must be explicitly bounded.

**Permitted without user confirmation:**
- Read-only diagnostics only — `SELECT` queries to inspect schema, policies,
  or data for debugging purposes

**Require explicit user confirmation before use:**
- Any write, insert, update, or delete using `service_role`
- Any operation that modifies schema or policies using `service_role`

**Confirmation protocol:**
1. State clearly: "This operation requires `service_role` which bypasses RLS."
2. Display the environment classification (Rule A) as part of the request
3. Show the exact command or query that will be run
4. Wait for explicit "yes" — do not infer consent from prior approval of a
   related step
5. If non-interactive: output the command for manual review, do not execute

---

## Rule D — Safe Fallback When Tooling Is Unavailable

The agent must not hallucinate access it doesn't have.

**If a required tool is unavailable:**
1. State the missing capability explicitly
2. Propose a non-destructive alternative:
   - Instead of CLI logs → capture `error.code`, `error.message`, `error.hint`
     from the client SDK response
   - Instead of `supabase status` → ask user to run it and paste the output
   - Instead of DB introspection → provide the exact SQL for the user to run
     in the dashboard SQL editor
3. Never invent log output, query results, or command output
4. Never report a validation as passed unless the agent itself received and
   parsed the response

**Prohibited:**
- "I checked the logs and there are no errors" without having received log output
- "The migration ran successfully" without confirmed evidence
- "The policy is in place" without `pg_policies` output showing it

---

## Rule E — Minimal File Mutations

**Required behaviour:**
- Prefer the smallest diff that achieves the fix
- Before applying any file change, show a diff or describe line-level changes
- Never use a "replace entire file" pattern unless the user explicitly requests it
- For Supabase-specific files (`supabase/functions/**`, `supabase/migrations/**`,
  `supabase/types.gen.ts`): treat all changes as high-sensitivity and show the
  diff before applying

**Why Supabase files are high-sensitivity:**
- Overwriting a migration file that has already run creates drift — it does not
  undo the migration
- Overwriting `types.gen.ts` with stale content breaks TypeScript without a
  compile error
- Overwriting an edge function's `index.ts` with an earlier version silently
  reverts a fix

**Permitted without confirmation:** adding new files where no existing file is
displaced.
**Requires confirmation:** modifying or deleting any existing file under
`supabase/`.

---

## Rule G — No Hidden Context Assumption

The agent must not infer Supabase project configuration from local file presence
alone. The existence of `.env`, `supabase/config.toml`, or a `supabase/`
directory does not confirm which project is active, whether it is local or
remote, or whether the configuration applies to the current task.

**Environment classification must be based only on runtime evidence:**
- The resolved value of `SUPABASE_URL` (from the active shell environment — not
  a `.env` file the agent reads in isolation)
- Output of `supabase status` or `supabase projects list`
- An explicit user statement (e.g., "I'm working against our staging project")

**What this prevents:**
- A skill applied inside a monorepo where a `supabase/` folder exists but
  belongs to a different sub-project
- An agent assuming `local` because it sees `http://localhost` in a `.env` file
  that may be stale or inactive
- Hallucinated project context: "this looks like a local project" based on file
  presence alone

**Required agent phrasing:** "I can see a `supabase/` directory and a `.env`
file. To classify the environment I need to confirm the active `SUPABASE_URL`.
Running `supabase status`…" — not "This looks like a local project."

**Relationship to Rule A:** Rule G governs what the agent may *assume* at any
point, including read-only tasks. Rule A governs what the agent must *confirm
before acting*. Rule G is the precondition; Rule A is the gate.

---

## Activation Rule — When This Skill Applies

This skill MUST activate automatically whenever any of the following signals
appear in code, config, or commands:

- `supabase-js` is imported or used
- `supabase.rpc()` is called
- `.from(...).insert()`, `.update()`, or `.delete()` is used
- `CREATE FUNCTION`, `CREATE POLICY`, or `ALTER TABLE` appears in SQL
- `supabase functions deploy` is run
- `supabase gen types` is relevant to the task
- Any migration touches schema or RLS
- Any file under `supabase/functions/` is modified
- Any file under `supabase/migrations/` or `supabase/seed.sql` is modified
- Any `supabase db *` command is run (push/reset/diff)
- `auth.uid()` is used in any SQL function or RLS policy
- A `supabase_realtime` publication is modified (`ALTER PUBLICATION`)
- An index is created or dropped on a table with significant row count
- `supabase.auth.signInWithPassword()` or `auth.admin.createUser()` is used in validation code

**When activated:**
- Add a validation step to the task plan before execution begins
- Execute that validation step before reporting completion
- Do not ask the user whether to validate — validate automatically
- If execution is not possible, state that explicitly and provide the exact
  commands for the user to run

---

## Validation Contract

A Supabase task is not complete when code compiles or a command exits 0.
It is complete only when the validation step passes.

**Definition of done:**
1. Failure or baseline confirmed (run the current behaviour first)
2. Fix applied
3. Validation executed
4. Validation produces a binary pass result

**Required plan shape:**
1. Run current behaviour — confirm failure if fixing, baseline if building
2. Diagnose — read the actual error (code, message, hint)
3. Apply minimal fix
4. Verify — binary pass/fail, not eyeballing
5. Report completion

**Hard gates — none of these are optional:**
- "Looks correct" is not a valid success signal
- "Exit code 0" alone is not a valid success signal
- Never skip verification because the code looks right — run the check
- If a verify step fails, diagnose before retrying — do not loop without
  reading the error

---

## Pattern Index

| Pattern | Trigger | Passes when |
|---|---|---|
| 1 — Edge function (local) | Change to a function running via `supabase functions serve` | HTTP 200 + `body.ok === true` + `request_id` present |
| 2 — Edge function (production) | `supabase functions deploy <name>` to a real project | HTTP 200 + `body.ok === true` + `request_id` present |
| 3 — RPC | `CREATE OR REPLACE FUNCTION` or migration modifying an RPC | No error + response contains expected fields |
| 4 — CRUD / Insert | Any `.insert()`, `.update()`, `.delete()` via supabase-js | Non-null array with `id` present |
| 5 — RLS | `CREATE POLICY`, `DROP POLICY`, `ENABLE ROW LEVEL SECURITY` | All 3 roles pass: unauthed blocked + authed allowed + service_role allowed |
| 6 — Schema migration | Migration adding, removing, or renaming a column | `types.gen.ts` reflects live schema + file committed |
| 7 — Auth-gated query | Any query on a table with `auth.uid()` RLS policies | All 3 auth states pass: no session → empty, wrong user → empty, owner → rows |
| 8 — Realtime subscription | Any change to Realtime publication membership | `pg_publication_tables` confirms table is in publication + INSERT event received |
| 9 — RPC auth context | RPC using `auth.uid()` without a null guard | Error raised (not empty result) on unauthenticated call + `anon` execute revoked |
| 10 — Query performance | Migration adding or dropping an index on a frequently queried column | EXPLAIN shows Index Scan (not Seq Scan) on representative query |

---

## Pattern 1 — Edge Function (Local)

> Full detail: [`references/pattern-01-edge-function-local.md`](references/pattern-01-edge-function-local.md)

**Trigger:** change to a function running via `supabase functions serve`
**Done when:** HTTP 200 + `ok: true` + `request_id` confirmed

---

## Pattern 2 — Edge Function (Production)

> Full detail: [`references/pattern-02-edge-function-production.md`](references/pattern-02-edge-function-production.md)

**Trigger:** `supabase functions deploy <name>` to a real project
**Done when:** HTTP 200 + `ok: true` + `request_id` confirmed against production URL

---

## Pattern 3 — RPC

> Full detail: [`references/pattern-03-rpc.md`](references/pattern-03-rpc.md)

**Trigger:** `CREATE OR REPLACE FUNCTION` or migration modifying an RPC
**Done when:** RPC returns no error + response shape is correct

---

## Pattern 4 — CRUD / Insert

> Full detail: [`references/pattern-04-crud-insert.md`](references/pattern-04-crud-insert.md)

**Trigger:** any `.insert()`, `.update()`, `.delete()` via supabase-js
**Done when:** insert returns a non-null array containing a row with `id`

---

## Pattern 5 — RLS

> Full detail: [`references/pattern-05-rls.md`](references/pattern-05-rls.md)

**Trigger:** `CREATE POLICY`, `DROP POLICY`, `ENABLE ROW LEVEL SECURITY`
**Done when:** all 3 scenarios pass — unauthed blocked + authed allowed + service_role allowed

---

## Pattern 6 — Schema Migration / Type Drift

> Full detail: [`references/pattern-06-schema-migration.md`](references/pattern-06-schema-migration.md)

**Trigger:** migration adding, removing, or renaming a column
**Done when:** `types.gen.ts` reflects live schema + file committed

---

## Pattern 7 — Auth-Gated Query

> Full detail: [`references/pattern-07-auth-gated-query.md`](references/pattern-07-auth-gated-query.md)

**Trigger:** any query on a table with `auth.uid()` RLS policies
**Done when:** all 3 auth states pass — no session → empty, wrong user → empty, owner → rows

---

## Pattern 8 — Realtime Subscription

> Full detail: [`references/pattern-08-realtime-subscription.md`](references/pattern-08-realtime-subscription.md)

**Trigger:** any change to Realtime publication membership or `postgres_changes` subscription
**Done when:** `pg_publication_tables` confirms membership AND INSERT event received within timeout

---

## Pattern 9 — RPC Auth Context

> Full detail: [`references/pattern-09-rpc-auth-context.md`](references/pattern-09-rpc-auth-context.md)

**Trigger:** `CREATE OR REPLACE FUNCTION` referencing `auth.uid()` in a SECURITY INVOKER body
**Done when:** unauthenticated call → explicit error + authenticated call → data + all 4 hardening checks pass

---

## Pattern 10 — Query Performance

> Full detail: [`references/pattern-10-query-performance.md`](references/pattern-10-query-performance.md)

**Trigger:** migration adding or dropping an index, or report of a slow query
**Done when:** EXPLAIN shows Index Scan (not Seq Scan) on a ≥ 1,000 row table
