/**
 * secure-write — Edge Function
 *
 * Writes a receipt to the `receipts` table using the SERVICE ROLE key,
 * bypassing RLS entirely.  Demonstrates the contrast between anon-key
 * inserts (Episode 4) and service-role inserts from a secure server context.
 *
 * Expected request body: { title: string; amount: number }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId =
    req.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    // Use SERVICE_ROLE key — available to edge functions via env injection
    const supabaseUrl       = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured"
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { title, amount } = body as { title?: string; amount?: number };

    if (!title || amount == null) {
      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          error: "title and amount are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      JSON.stringify({
        level: "info",
        request_id: requestId,
        message: "secure-write invoked",
        title,
        amount,
      })
    );

    const { data, error } = await admin
      .from("receipts")
      .insert({ title, amount })
      .select()
      .single();

    if (error) throw error;

    console.log(
      JSON.stringify({
        level: "info",
        request_id: requestId,
        message: "receipt created",
        receipt_id: data.id,
      })
    );

    return new Response(
      JSON.stringify({ ok: true, request_id: requestId, receipt: data }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({ level: "error", request_id: requestId, message })
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
