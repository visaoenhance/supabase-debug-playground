# Pattern 1 — Edge Function (Local)

**Episode:** EP1
**Trigger:** after any change to a Supabase edge function running locally via
`supabase functions serve`.

---

## Validation Steps

1. POST to `http://localhost:54321/functions/v1/<name>`
2. Assert HTTP 200
3. Assert response body is valid JSON with `ok: true`
4. Assert `request_id` is present in the response body

## Fail Signal

HTTP 500, empty body, no `request_id`, or `Deno.env.get(...)` returning
`undefined`.

## Diagnostic

Errors stream to the `supabase functions serve` terminal — read them directly.
There is no `supabase functions logs` command for local dev.

## Docs

- [Environment Variables / Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Error Handling](https://supabase.com/docs/guides/functions/error-handling)
- [Logging](https://supabase.com/docs/guides/functions/logging)
- [Troubleshooting](https://supabase.com/docs/guides/functions/troubleshooting)

## Done When

HTTP 200 + `ok: true` + `request_id` confirmed.
