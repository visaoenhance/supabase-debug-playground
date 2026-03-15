/**
 * Episode 8 — Realtime Subscription Lifecycle
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase Realtime delivers change events only for tables that are part of the
 * supabase_realtime publication. When a table is removed from the publication,
 * subscriptions silently time out with no error — the event never arrives.
 *
 * RUN: Opens a POSTGRES_CHANGES subscription for public.receipts, then
 *      inserts a row via service_role. If receipts is in the publication,
 *      the INSERT event arrives. If not (break state), it times out silently.
 *
 * The "silent timeout" is the core bug moment this episode captures.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  parseMode,
  c, log, hr, step, ok, fail, warn, labelledJson,
  requireEnv,
} from "./utils.js";
import { createClient, RealtimeChannel } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const TIMEOUT_MS = 6_000;
const DB_CONTAINER = "supabase_db_supabase-debug-playground";

async function main() {
  const mode = parseMode();

  if (mode === "break") {
    execSync("tsx scripts/episodes/ep8/break.ts", { stdio: "inherit" });
    return;
  }

  if (mode === "verify") {
    execSync("tsx scripts/episodes/ep8/verify.ts", { stdio: "inherit" });
    return;
  }

  // ── RUN mode: subscribe then insert, wait for event ─────────────────────

  hr();
  log(c.bold(c.cyan("▶ EP8 RUN — Realtime Subscription Lifecycle")));
  hr();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey     = requireEnv("SUPABASE_ANON_KEY");
  const serviceKey  = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // ── Preflight: is receipts in the publication? ───────────────────────────

  step("Preflight", "Checking supabase_realtime publication");

  const inPub = execSync(
    `docker exec ${DB_CONTAINER} psql -U postgres -tAc ` +
    `"SELECT count(*) FROM pg_publication_tables ` +
    `WHERE pubname='supabase_realtime' AND tablename='receipts';"`,
    { encoding: "utf-8" }
  ).trim();

  if (inPub === "1") {
    ok("receipts is in supabase_realtime publication ✔");
    log("  → You are in a FIXED state. Events should arrive.");
    log("  → Run `pnpm ep8:break` then `pnpm ep8:run` to see the silent timeout.");
  } else {
    warn("receipts is NOT in supabase_realtime publication");
    log("  → You are in a BROKEN state. Events will NOT arrive (silent timeout).");
    log("  → Run `pnpm ep8:fix` to restore the publication, then `pnpm ep8:run` again.");
  }

  // ── Subscribe ────────────────────────────────────────────────────────────

  step("Subscribe", "Opening POSTGRES_CHANGES subscription on public.receipts");

  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let channel: RealtimeChannel | null = null;
  let eventReceived = false;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      warn(`No event received within ${TIMEOUT_MS / 1000}s — subscription timed out silently.`);
      log("");
      if (inPub !== "1") {
        log(c.red("  Root cause: receipts table is not in the supabase_realtime publication."));
        log("  Fix: `ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts;`");
        log("  Or:  pnpm ep8:fix");
      } else {
        log("  The publication looks correct. Check that realtime is enabled for this project.");
      }
      resolve();
    }, TIMEOUT_MS);

    channel = client.channel("ep8-run-receipts", {
      config: { broadcast: { ack: true }, presence: { key: "" } },
    });

    channel
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "receipts" },
        (payload: any) => {
          clearTimeout(timer);
          eventReceived = true;
          ok("INSERT event received ✔");
          labelledJson("  payload.new", payload.new);
          resolve();
        }
      )
      .subscribe(async (status) => {
        log(`  Channel status: ${status}`);
        if (status === "SUBSCRIBED") {
          ok("Channel subscribed — now inserting a row via service_role");
          step("Insert", "Inserting test receipt via service_role");
          const { error } = await service
            .from("receipts")
            .insert({ title: "EP8 run receipt", amount: 8.08 });
          if (error) {
            clearTimeout(timer);
            fail(`Insert failed: ${error.message}`);
            reject(new Error(error.message));
          } else {
            ok("Row inserted — waiting for realtime event...");
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timer);
          fail(`Channel entered status: ${status}`);
          resolve();
        }
      });
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────

  if (channel) {
    await client.removeChannel(channel);
  }
  await client.realtime.disconnect();

  hr();
  log(c.bold("Result:"));
  if (eventReceived) {
    log(c.green("  Event received — Realtime is working correctly."));
    log("  Run `pnpm ep8:break` to reproduce the silent timeout.");
  } else {
    log(c.yellow("  No event received — silent timeout (this is the bug to debug)."));
    log("  Run `pnpm ep8:fix` to restore the publication, then re-run.");
  }
  hr();
}

main().catch(err => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
