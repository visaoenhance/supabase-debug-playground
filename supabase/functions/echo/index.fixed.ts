/**
 * echo — Edge Function (FIXED version)
 *
 * This file is applied by `pnpm ep1:fix` during recorded demos.
 * It shows the corrected version of the three bugs introduced in index.broken.ts.
 *
 * ─── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 *
 *   BUG 1 — Unguarded env var:
 *     Deno.env.get("REQUIRED_API_SECRET") returns `undefined` when the var is
 *     not set.  Accessing .length on undefined throws a TypeError immediately,
 *     before any other code runs.
 *
 *   BUG 2 — No try/catch:
 *     Without a try/catch around the handler body, Deno surfaces any unhandled
 *     error as an opaque HTTP 500 with an empty body — no JSON, no message,
 *     nothing the client can act on.
 *
 *   BUG 3 — No request_id:
 *     Without a unique ID on every request, you cannot correlate what the
 *     client reports ("I got a 500") to a specific line in the server log.
 *
 * ─── HOW IT WAS FIXED ────────────────────────────────────────────────────────
 *
 *   FIX 1 — Removed the env var entirely (not needed for echo).
 *            If a secret were genuinely required, guard it before use:
 *              const secret = Deno.env.get("MY_SECRET");
 *              if (!secret) throw new Error("MY_SECRET is not set");
 *
 *   FIX 2 — Wrapped the entire handler in try/catch.
 *            On error: returns a structured JSON body { ok: false, error, request_id }
 *            with status 500 — still an error, but now the client can read it.
 *
 *   FIX 3 — Minted a request_id at the top of every request.
 *            Reads x-request-id header first (so the client can inject its own),
 *            falls back to crypto.randomUUID().  Returned in every response so
 *            client logs and server logs can be correlated with one value.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  // ✅ FIX 3: mint a request_id at the very top — present in every response,
  //    success or failure, so client and server logs can always be correlated.
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  // ✅ FIX 2: wrap the entire handler in try/catch.
  //    Any exception now returns a structured JSON error instead of an empty 500.
  try {
    // ✅ FIX 1: unguarded env var removed entirely.
    //    The echo function does not need a secret — those lines are gone.
    //    If you need to read an env var, guard it:
    //      const secret = Deno.env.get("MY_SECRET");
    //      if (!secret) throw new Error("MY_SECRET is not configured");

    const payload = await req.json();

    // Structured log — request_id appears in supabase functions serve output
    console.log(JSON.stringify({ level: "info", request_id: requestId, payload }));

    return new Response(
      JSON.stringify({ ok: true, request_id: requestId, echo: payload }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    // ✅ FIX 2 (continued): structured error response — client gets JSON, not silence.
    console.error(JSON.stringify({ level: "error", request_id: requestId, error: String(err) }));

    return new Response(
      JSON.stringify({ ok: false, request_id: requestId, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
