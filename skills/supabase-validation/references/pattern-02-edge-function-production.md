# Pattern 2 — Edge Function (Production)

**Episode:** EP6
**Trigger:** after `supabase functions deploy <name>` to a real Supabase project.

---

## Validation Steps

1. POST to `$SUPABASE_URL/functions/v1/<name>` with
   `Authorization: Bearer $SUPABASE_ANON_KEY` (do not print the key value)
2. Assert HTTP 200
3. Assert response body is valid JSON with `ok: true`
4. Assert `request_id` is present in the response body

## Fail Signal

HTTP 500 or unstructured body.

## Diagnostic

Dashboard function logs:
`https://supabase.com/dashboard/project/<PROJECT_REF>/functions/<name>/logs`

## Docs

- [Deploy to Production](https://supabase.com/docs/guides/functions/deploy)
- [Environment Variables / Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Logging](https://supabase.com/docs/guides/functions/logging)
- [Troubleshooting](https://supabase.com/docs/guides/functions/troubleshooting)

## Done When

HTTP 200 + `ok: true` + `request_id` confirmed against the production URL.
