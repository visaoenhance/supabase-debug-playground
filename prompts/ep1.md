# EP1 — Edge Function Logging

## Context

I'm recording a Supabase debugging tutorial.  I have a local Supabase edge
function called `echo` in `supabase/functions/echo/index.ts`.

I ran `pnpm ep1:break` which swapped `index.ts` with a broken version. The
function now throws on every request and returns a 500 with no JSON body.

## Symptom

```
HTTP status: 500
Response body: ""   ← empty, not JSON
request_id: (missing)
```

## Ask

1. **Root cause**: explain in 2-3 sentences what is causing the 500.

2. **Quick diagnostic**: what should I look for in
   `supabase/functions/echo/index.ts` to confirm the root cause?

3. **Minimal fix**: show me only the changes needed to make `index.ts`:
   - wrap the handler in `try/catch`
   - guard against undefined env vars before accessing their properties
   - log a structured JSON object with `request_id` on every request

4. **How to verify**: what command do I run to confirm it's fixed?

---

> Paste the full contents of `supabase/functions/echo/index.ts` below,
> then ask the AI to diagnose and fix it.
