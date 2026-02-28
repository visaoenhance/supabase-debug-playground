# EP6 — Local to Production

**Pattern introduced:** Production deploy validation — HTTP 200 + request_id against the real project URL

---

## What this episode covers

The `echo` edge function works perfectly in local dev — we fixed it in EP1. Now it's deployed to a real Supabase project, but the broken version was pushed instead of the fixed one. Users are hitting 500s on the production URL. We reproduce, diagnose via the dashboard (the only log visibility tool for production edge functions), apply the fix, and verify against the real URL.

**The key contrast with EP1:** locally, errors stream to the `supabase functions serve` terminal. In production, that terminal doesn't exist — and there is no `supabase functions logs` CLI command. The dashboard is the only window into what went wrong.

---

## What the viewer learns

- How to deploy an edge function from the CLI: `supabase functions deploy`
- Why the dashboard is currently the only visibility tool for production edge function errors
- How `request_id` lets you correlate a client error to a server log entry in production
- How `pnpm ep6:verify` asserts correctness against the real URL — the pattern for a CI post-deploy health check

---

## Pre-flight

EP6 requires a real Supabase project. Run once to fill `.env`:

```bash
pnpm setup:ep6:env
```

Needs: your project ref + a personal access token (`sbp_...` from supabase.com/dashboard/account/tokens).

Writes 4 vars: `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `PROD_SUPABASE_URL`, `PROD_SUPABASE_ANON_KEY`.

---

## Command sequence

| # | Command | What it does | What to look for |
|---|---|---|---|
| 1 | `pnpm ep6:reset` | Deploys known-good echo to production | Output: `✔ Known-good echo deployed` |
| 2 | `pnpm ep6:break` | Deploys broken echo to production | Output: lists 4 bugs being deployed |
| 3 | `pnpm ep6:run` | POSTs to production URL — reproduces failure | **HTTP 500, "Internal Server Error", no request_id** |
| 4 | _(dashboard)_ | Production function logs | `TypeError: Cannot read properties of undefined (reading 'length')` |
| 5 | `pnpm ep6:fix` | Deploys fixed echo to production | Output: lists 3 fixes, confirms deploy |
| 6 | `pnpm ep6:run` | Same POST to production — confirms fix | **HTTP 200, body.ok true, request_id present** |
| 7 | `pnpm ep6:verify` | Formal pass/fail against production URL | `✔ EP6 PASSED` |
| 8 | `pnpm ep6:reset` | Redeploys known-good version | Clean state |

---

## Recording flow

### 1 · Reset + Break

```bash
pnpm ep6:reset
pnpm ep6:break
```

**Say:** "`ep6:reset` deploys the known-good echo function to your real Supabase project — we're starting from a working baseline. `ep6:break` deploys the broken version: unguarded `Deno.env.get`, no `try/catch`, no `request_id`. Production is now broken."

---

### 2 · Reproduce

```bash
pnpm ep6:run
```

**Expected output:**
```
HTTP status: 500
Response body: "Internal Server Error"
⚠  No request_id in response
```

**Say:** "Same symptom as EP1 — 500, no structured body, no request_id. But we're not in local dev anymore. There's no `supabase functions serve` terminal to look at. And there's no `supabase functions logs` CLI command either. The dashboard is the only place the errors went."

---

### 3 · Diagnose

Open in browser:
```
https://supabase.com/dashboard/project/<your-project-ref>/functions/echo/logs
```

**Expected:**
```json
{
  "event_message": "TypeError: Cannot read properties of undefined (reading 'length')",
  "metadata": [{ "level": "error" }]
}
```

**Say:** "Same TypeError as EP1. This is important: the bug in production is identical to the bug we fixed locally — the broken version was what got deployed. Navigate to `supabase/functions/echo/index.ts` — the local file is still the fixed version. It's the deploy that was wrong."

---

### 4 · Fix

```bash
pnpm ep6:fix
```

**Say:** "`ep6:fix` swaps in the annotated fixed version of `index.ts` and runs `supabase functions deploy echo --no-verify-jwt`. It's the same fix as EP1, but this time it's going to production. Watch for the deploy confirmation in the output."

---

### 5 · Confirm

```bash
pnpm ep6:run
```

**Expected output:**
```
HTTP status: 200
request_id: <uuid>
Body: { ok: true, request_id: "...", echo: { ... } }
```

**Say:** "HTTP 200 against the real production URL. `request_id` in the body — if anything goes wrong later, we can find this specific request in the dashboard logs."

---

### 6 · Verify

```bash
pnpm ep6:verify
```

**Expected output:**
```
✔  HTTP 200
✔  Body contains { ok: true }
✔  request_id present
✔  EP6 PASSED
```

**Say:** "`ep6:verify` asserts against the real production URL — not localhost. This is the pattern for a CI post-deploy health check: deploy, then run verify. If verify fails, the deploy is rolled back."

---

### 7 · Reset

```bash
pnpm ep6:reset
```

---

## Outro script

> "Six episodes, six debugging patterns. Each one is a command your agent can run to validate a Supabase action before telling you it's done.
>
> Here's the EP6 replay prompt — then the embed skill prompt to give your agent production deploy validation permanently."
>
> [show Replay Prompt on screen]
>
> [show Embed Skill Prompt on screen]
>
> "The full 6-pattern Supabase Validation Skill is in `skill/v1.md` — drop the entire file into your `.cursorrules`, `CLAUDE.md`, or Copilot instructions. Your agent will validate before it reports done."

---

## The bug (reference)

**What `ep6:break` deploys:** `supabase/functions/echo/index.broken.ts` — same three bugs as EP1, to production.

**Broken output:**
```
HTTP status : 500
Response body: "Internal Server Error"
request_id  : (missing)
```

**Log visibility:** dashboard only — `https://supabase.com/dashboard/project/<ref>/functions/echo/logs`

**Fixed output:**
```
HTTP status : 200
request_id  : <uuid>
Body        : { ok: true, request_id: "...", echo: { ... } }
```

---

## References

- [Deploy to Production](https://supabase.com/docs/guides/functions/deploy) — `supabase functions deploy` steps and CI/CD setup
- [Environment Variables / Secrets](https://supabase.com/docs/guides/functions/secrets) — production secrets management
- [Logging](https://supabase.com/docs/guides/functions/logging) — dashboard log access for production functions
- [Troubleshooting](https://supabase.com/docs/guides/functions/troubleshooting) — production error patterns

---

## Replay Prompt

> Paste this into Cursor, Claude Code, or Copilot agent mode to replay this episode autonomously.

```
You are debugging a Supabase edge function deployed to production that returns HTTP 500.
The .env file contains SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, PROD_SUPABASE_URL, PROD_SUPABASE_ANON_KEY.

** STOP — do not run any commands yet. **

Read the plan below, then ask the user:
  "Ready to go? Reply 'run' to have me execute each step, or 'terminal' if you'd
   prefer to run the commands yourself and I'll guide you through them."

Wait for the user's reply before doing anything.

---

Available commands:
  pnpm ep6:reset    — deploy known-good echo to production
  pnpm ep6:break    — deploy broken echo to production
  pnpm ep6:run      — POST to production URL and print response
  pnpm ep6:fix      — deploy fixed echo to production
  pnpm ep6:verify   — assert HTTP 200 + body.ok === true + request_id present (against production URL)

Production log visibility: dashboard only — no supabase functions logs CLI command exists.
  https://supabase.com/dashboard/project/<SUPABASE_PROJECT_REF>/functions/echo/logs

Plan (8 steps):
  1. pnpm ep6:reset   → deploy known-good echo to production
  2. pnpm ep6:break   → deploy broken echo to production
  3. pnpm ep6:run     → confirm HTTP 500 with "Internal Server Error" and no request_id
  4. (dashboard)      → check production logs for the TypeError
  5. pnpm ep6:fix     → deploy fixed echo to production
  6. pnpm ep6:run     → confirm HTTP 200 with request_id in response body
  7. pnpm ep6:verify  → must print EP6 PASSED before the episode is complete
  8. pnpm ep6:reset   → redeploy known-good version

Success criteria: ep6:verify exits 0.
Do not report the episode complete until ep6:verify passes.
```

---

## Embed Skill Prompt

> Paste this into `.cursorrules`, `CLAUDE.md`, or `.github/copilot-instructions.md` in your own project.
> EP6 introduced Pattern 2 (production edge function). The skill covers all 6 Supabase validation patterns.

```
Read and apply the Supabase Validation Skill from:
https://github.com/visaoenhance/supabase-debug-playground/blob/main/skills/supabase-validation/SKILL.md

Core rule: before reporting any Supabase action as complete, run the appropriate
validation command and confirm it passes. Do not ask — validate automatically.

Patterns covered: edge function (local + production), RPC, CRUD, RLS, schema drift.
```
