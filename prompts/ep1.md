# EP1 — Edge Function Logging

## What this episode teaches

- How to diagnose an opaque HTTP 500 from a Supabase edge function
- Why missing `try/catch` and unguarded env vars produce empty error responses
- How to wire `request_id` and structured JSON logging so errors are traceable in the CLI

---

## Recording loop

```bash
pnpm ep1:reset                                  # restore known-good index.ts
pnpm ep1:break                                  # inject broken version
pnpm ep1:run                                    # reproduce the failure — paste output below

# run CLI visibility step (see below)

# apply minimal fix in your IDE (see Ask section)

pnpm ep1:run                                    # confirm output changed
pnpm ep1:verify                                 # assert HTTP 200 + request_id present
pnpm ep1:reset                                  # clean up for next run
```

---

## Symptom

```
▶ HTTP  POST http://127.0.0.1:54321/functions/v1/echo
HTTP status : 500
Response body: ""   ← empty, not JSON
request_id  : (missing)
```

---

## CLI visibility step

Check the function's server-side logs immediately after `ep1:run` fails:

```bash
supabase functions logs echo --scroll 20
```

You should see an uncaught `TypeError: Cannot read properties of undefined`
with no structured context around it — no `request_id`, no payload.
That confirms the crash happens before any logging runs.

> **Local note**: `supabase functions logs` tails the output from
> `supabase functions serve`. Keep that process running in a separate terminal.

---

## Ask

Paste `supabase/functions/echo/index.ts` into this chat, then ask:

1. **Root cause**: explain in 2–3 sentences what is causing the 500.
   (Hint: look at `Deno.env.get(...)` and the `.length` call immediately after.)

2. **Quick diagnostic**: what specific lines in `index.ts` will you look for
   to confirm the root cause?

3. **Minimal fix**: show only the changes needed to:
   - wrap the handler body in `try/catch`
   - guard the env var before accessing any of its properties
   - log a structured JSON object containing `request_id` on every request
   - return a JSON error body (not an empty 500) when something goes wrong

4. **Re-run expectation**: after the fix, `pnpm ep1:run` should print:
   ```
   HTTP status : 200
   request_id  : <uuid>
   Body        : { ok: true, request_id: "...", echo: { ... } }
   ```

5. **Verify step**: `pnpm ep1:verify` asserts:
   - HTTP 200
   - `body.ok === true`
   - `body.request_id` is a non-empty string

6. **Replay commands**:
   ```bash
   pnpm ep1:reset && pnpm ep1:break
   ```

---

## Paste area

**`pnpm ep1:run` output:**
```
(paste here)
```

**`supabase functions logs echo --scroll 20` output:**
```
(paste here)
```

**`supabase/functions/echo/index.ts` contents:**
```ts
(paste here)
```
