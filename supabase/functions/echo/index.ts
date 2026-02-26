/**
 * echo — Edge Function (GOOD / FIXED version)
 *
 * Demonstrates:
 *   - Structured JSON logging (visible in `supabase functions logs`)
 *   - request-id propagation
 *   - Proper try/catch so errors are returned as JSON, not naked 500s
 *
 * Episode 1 target function.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Propagate caller-supplied request id or mint a new one
  const requestId =
    req.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const payload = await req.json().catch(() => ({}));

    // Structured log — surfaced in `supabase functions logs`
    console.log(
      JSON.stringify({
        level: "info",
        request_id: requestId,
        message: "echo invoked",
        payload,
      })
    );

    return new Response(
      JSON.stringify({
        ok: true,
        request_id: requestId,
        echo: payload,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error(
      JSON.stringify({
        level: "error",
        request_id: requestId,
        message,
      })
    );

    return new Response(
      JSON.stringify({ ok: false, request_id: requestId, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
