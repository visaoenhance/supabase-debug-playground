/**
 * echo — Edge Function (BROKEN version)
 *
 * Intentional bugs introduced for Episode 1:
 *
 *   BUG 1 — Missing env var access throws unconditionally:
 *     REQUIRED_API_SECRET is never set in local dev, so every request throws
 *     before any logic runs.
 *
 *   BUG 2 — No try/catch, so Deno lets the error propagate into a naked 500
 *     with no useful JSON body — just an empty response or an HTML error page.
 *
 *   BUG 3 — No request_id logged, so you can't correlate client errors to
 *     function logs.
 *
 * Run `pnpm ep1:run` to see the failure, then inspect what the client receives.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  // ❌ BUG 1: reads a required secret that is never set.
  //    Throws: TypeError: Cannot read properties of undefined
  const secret = Deno.env.get("REQUIRED_API_SECRET");

  // ❌ BUG 2: no null-guard — accessing .length on undefined crashes immediately.
  if (secret.length === 0) {
    throw new Error("Secret is empty");
  }

  // ❌ BUG 3: no try/catch — the crash above turns into an opaque 500.
  //    The function never reaches here.
  const payload = await req.json();
  console.log("payload", payload); // never logged → no request_id

  return new Response(JSON.stringify({ ok: true, echo: payload }), {
    status: 200,
  });
});
