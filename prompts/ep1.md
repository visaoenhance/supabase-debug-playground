# EP1 — Edge Function Logging

**Pattern introduced:** Edge function deploy validation — HTTP 200 + structured response + request_id

---

## What this episode covers

The `echo` edge function returns HTTP 500 with an empty body. No message, no context, nothing to act on. We reproduce the failure, read the server log, identify three root causes, apply the fix, and verify it — entirely from the terminal.

**The usual workflow** is Supabase Dashboard → Edge Functions → Logs tab — 3–5 clicks, and a coding agent can't do any of it. This episode replaces that workflow with a repeatable command-line pattern an agent can run autonomously.

---

## What the viewer learns

- Why unguarded `Deno.env.get()` calls produce silent crashes
- Why missing `try/catch` leaves the client with an empty 500 and nothing to debug
- How to wire a `request_id` so every error is traceable across client and server
- How `pnpm ep1:verify` provides a pass/fail assertion instead of eyeballing the dashboard

---

## Command sequence

| # | Command | What it does | What to look for |
|---|---|---|---|
| 1 | `pnpm ep1:reset` | Restores `index.ts` from git — known-good state | Output: `✔ index.ts restored` |
| 2 | `pnpm ep1:break` | Overwrites `index.ts` with the broken version | Output: lists the 3 bugs being injected |
| 3 | `pnpm ep1:run` | POSTs to the local function — reproduces the failure | **HTTP 500, empty body, no request_id** |
| 4 | _(serve terminal)_ | Runtime error streams to `supabase functions serve` | `TypeError: Cannot read properties of undefined (reading 'length')` |
| 5 | `pnpm ep1:fix` | Swaps in the annotated fixed version | Output: lists the 3 fixes applied |
| 6 | `pnpm ep1:run` | Same call — confirms the fix | **HTTP 200, body.ok true, request_id present** |
| 7 | `pnpm ep1:verify` | Formal pass/fail assertion | `✔ EP1 PASSED` |
| 8 | `pnpm ep1:reset` | Restores known-good state for next run | Clean repo |

---

## Recording flow

### 1 · Reset + Break

```bash
pnpm ep1:reset
pnpm ep1:break
```

**Say:** "`ep1:reset` puts us in a known-good state — the function works. `ep1:break` injects the three bugs. The function is now broken, but we haven't called it yet."

---

### 2 · Reproduce

```bash
pnpm ep1:run
```

**Expected output:**
```
HTTP status: 500
Response body: ""
⚠  No request_id in response
```

**Say:** "HTTP 500, empty body, no request_id. In the real world this is all you'd see in your client logs. Three things are missing: a root cause, a body, and any way to trace this specific request."

---

### 3 · Diagnose

Switch to the `supabase functions serve` terminal. You should see:
```
TypeError: Cannot read properties of undefined (reading 'length')
```

**Say:** "The serve terminal is where local edge function logs stream. There's no `supabase functions logs` command for local dev — this terminal is the only place to look. The TypeError tells us the crash happens before any try/catch runs, which is why the client sees nothing."

Navigate to `supabase/functions/echo/index.ts` and show the bug on camera:

```ts
const secret = Deno.env.get("REQUIRED_API_SECRET");  // returns undefined in local dev
if (secret.length === 0) { ... }                       // TypeError: undefined.length
```

**Three root causes:**
1. `Deno.env.get()` returns `undefined` — the variable isn't set in local dev
2. `.length` on `undefined` throws before any handler logic runs
3. No `try/catch` and no `request_id` — the error is invisible and untrackable

---

### 4 · Fix

```bash
pnpm ep1:fix
```

**Say:** "`ep1:fix` applies a pre-annotated version of the correct `index.ts`. You can also apply it manually — the inline comments explain each change."

Show the three changes in the file:
1. Removed the unguarded env var access
2. `request_id` minted at the top of every request
3. `try/catch` wrapping the handler — returns JSON error body on failure

---

### 5 · Confirm

```bash
pnpm ep1:run
```

**Expected output:**
```
HTTP status: 200
request_id: <uuid>
Body: { ok: true, request_id: "...", echo: { ... } }
```

**Say:** "Same command, completely different result. The structured response means the client now has a request_id to search for in logs, and the server returns JSON on failure instead of an empty 500."

---

### 6 · Verify

```bash
pnpm ep1:verify
```

**Expected output:**
```
✔  HTTP 200
✔  Body contains { ok: true }
✔  request_id present
✔  EP1 PASSED
```

**Say:** "`ep1:verify` is the assertion layer — not eyeballing the dashboard, not reading JSON manually. Pass/fail. This is the pattern we'll use in every episode and the pattern your agent should apply after every edge function deploy."

---

### 7 · Reset

```bash
pnpm ep1:reset
```

Restore known-good state before closing.

---

## Outro script

> "The pattern from this episode: guard env vars, catch all errors, propagate a request_id. Those three changes are the minimum for a debuggable edge function.
>
> If you want your Cursor, Claude Code, or Copilot agent to run this validation automatically after every edge function deploy — so it confirms HTTP 200 and request_id before telling you it's done — here's the prompt. Paste it into your project instructions."
>
> [show Embed Skill Prompt on screen]
>
> "Next episode: RPC debugging — when your database function exists but returns the wrong shape and the client sees nothing useful."

---

## The bug (reference)

**File:** `supabase/functions/echo/index.broken.ts`

```ts
const secret = Deno.env.get("REQUIRED_API_SECRET");
if (secret.length === 0) {          // ← TypeError: undefined.length
  throw new Error("missing secret");
}
// no try/catch, no request_id
```

**Broken output:**
```
HTTP status : 500
Response body: ""
request_id  : (missing)
```

**Fixed output:**
```
HTTP status : 200
request_id  : <uuid>
Body        : { ok: true, request_id: "...", echo: { ... } }
```

---

## References

- [Environment Variables / Secrets](https://supabase.com/docs/guides/functions/secrets) — `Deno.env.get()` and local dev secrets
- [Error Handling](https://supabase.com/docs/guides/functions/error-handling) — structured try/catch and error responses
- [Logging](https://supabase.com/docs/guides/functions/logging) — reading the `supabase functions serve` output
- [Troubleshooting](https://supabase.com/docs/guides/functions/troubleshooting) — common edge function errors

---

## Replay Prompt

> Paste this into Cursor, Claude Code, or Copilot agent mode to replay this episode autonomously.

```
You are helping debug a Supabase edge function that returns HTTP 500 with an empty body.
The functions server is already running locally (supabase functions serve --no-verify-jwt).

** STOP — do not run any commands yet. **

Read the plan below, then ask the user:
  "Ready to go? Reply 'run' to have me execute each step, or 'terminal' if you'd
   prefer to run the commands yourself and I'll guide you through them."

Wait for the user's reply before doing anything.

---

Available commands:
  pnpm ep1:reset    — restore known-good index.ts from git
  pnpm ep1:break    — inject the broken version
  pnpm ep1:run      — POST to the local echo function and print the response
  pnpm ep1:fix      — apply the annotated fix
  pnpm ep1:verify   — assert HTTP 200 + body.ok === true + request_id present

Plan (8 steps):
  1. pnpm ep1:reset   → restore index.ts to known-good state
  2. pnpm ep1:break   → inject 3 bugs (unguarded env var, no try/catch, no request_id)
  3. pnpm ep1:run     → confirm HTTP 500 with empty body and no request_id
  4. (serve terminal) → read the TypeError — pinpoints the crash location
  5. pnpm ep1:fix     → apply the annotated fix
  6. pnpm ep1:run     → confirm HTTP 200 + request_id present
  7. pnpm ep1:verify  → must print EP1 PASSED before the episode is complete
  8. pnpm ep1:reset   → restore known-good state

Success criteria: ep1:verify exits 0.
Do not report the episode complete until ep1:verify passes.
```

---

## Embed Skill Prompt

> Paste this into `.cursorrules`, `CLAUDE.md`, or `.github/copilot-instructions.md` in your own project.
> EP1 introduced Pattern 1 (local edge function). The skill covers all 6 Supabase validation patterns.

```
Read and apply the Supabase Validation Skill from:
https://github.com/visaoenhance/supabase-debug-playground/blob/main/skill/v1.md

Core rule: before reporting any Supabase action as complete, run the appropriate
validation command and confirm it passes. Do not ask — validate automatically.

Patterns covered: edge function (local + production), RPC, CRUD, RLS, schema drift.
```

