/**
 * EP8 — verify.ts
 *
 * PASS criteria (strict ordering, all must pass):
 *   ✔ pg_publication_tables confirms receipts is in supabase_realtime
 *   ✔ Subscription acknowledged (SUBSCRIBED status) before any INSERT
 *   ✔ INSERT performed after subscription is confirmed ready
 *   ✔ INSERT event received on the channel within timeout (5 seconds)
 *   ✔ Channel unsubscribed and client removed (cleanup in finally)
 */

import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { c, log, hr, ok, fail, step, requireEnv } from "../../utils.js";

const DB_CONTAINER  = "supabase_db_supabase-debug-playground";
const EVENT_TIMEOUT = 5_000; // ms

async function main() {
  hr();
  log(c.bold(c.green("EP8 VERIFY — Realtime: end-to-end INSERT event")));
  hr();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey     = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  let passed = false;
  let channel: RealtimeChannel | null = null;
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  // ── Preflight: pg_publication_tables ─────────────────────────────────────

  step("Preflight", "Confirm receipts is in supabase_realtime");

  const pubResult = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -tAc ` +
    `"SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='receipts';"`,
    { encoding: "utf-8" }
  ).trim();

  if (pubResult !== "receipts") {
    fail("receipts is NOT in supabase_realtime — run `pnpm ep8:fix` first");
    process.exit(1);
  }

  ok("receipts confirmed in supabase_realtime ✔");

  // ── Main verify: subscription + insert + event ────────────────────────────

  try {
    // 1. Set up the channel with the INSERT listener and subscription ack
    //    Both listeners are registered before subscribe() is called — this is required.
    step("Realtime", "Opening channel subscription — waiting for SUBSCRIBED ack");

    let resolveEvent!: (row: Record<string, unknown>) => void;
    let rejectEvent!:  (err: Error) => void;

    const eventReceived = new Promise<Record<string, unknown>>((res, rej) => {
      resolveEvent = res;
      rejectEvent  = rej;
    });

    const insertedTitle = `EP8 verify ${Date.now()}`;

    let subscribeResolve!: () => void;
    let subscribeReject!:  (e: Error) => void;

    const subscribeAck = new Promise<void>((res, rej) => {
      subscribeResolve = res;
      subscribeReject  = rej;
    });

    channel = client
      .channel("ep8-verify")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "receipts" },
        payload => resolveEvent(payload.new as Record<string, unknown>)
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          ok("Subscription acknowledged ✔");
          subscribeResolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscribeReject(new Error(`Subscription failed: ${status}`));
        }
      });

    // Await subscription ack with timeout
    await Promise.race([
      subscribeAck,
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Subscription ack timed out after 5s")), 5_000)
      ),
    ]);

    // 2. Set up the event timeout now that we are subscribed
    const eventTimeout = setTimeout(
      () => rejectEvent(new Error(`No INSERT event received within ${EVENT_TIMEOUT}ms`)),
      EVENT_TIMEOUT
    );

    // 3. Insert via service_role after subscription is ready
    step("Realtime", "Waiting for INSERT event");
    step("Insert", "Inserting receipt via service_role");

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: insertData, error: insertErr } = await admin
      .from("receipts")
      .insert({ title: insertedTitle, amount: 8.00 })
      .select()
      .single();

    if (insertErr) {
      throw new Error(`Insert failed: ${insertErr.message}`);
    }

    ok(`Receipt inserted: id ${insertData.id}`);

    // 4. Wait for the Realtime event
    const event = await eventReceived;
    clearTimeout(eventTimeout);
    ok(`INSERT event received ✔`);
    log(`  event.id    : ${(event as { id?: string }).id}`);
    log(`  event.title : ${(event as { title?: string }).title}`);

    passed = true;

  } finally {
    // 5. Always unsubscribe and clean up — success or failure
    if (channel) {
      await client.removeChannel(channel);
    }
    await client.realtime.disconnect();
    ok("Channel unsubscribed + client disconnected");
  }

  hr();
  if (passed) {
    log(c.bold(c.green("✔  EP8 PASSED")));
    log("  • Publication membership confirmed");
    log("  • Subscription acknowledged before insert");
    log("  • INSERT event received end-to-end");
    log("  • Cleanup completed");
  } else {
    log(c.bold(c.red("✘  EP8 FAILED — see above")));
    process.exit(1);
  }
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
