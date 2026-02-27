/**
 * scripts/runbook.ts — per-episode command printer
 *
 * Usage:
 *   pnpm ep:runbook <episode>       # e.g. pnpm ep:runbook 3
 *   tsx scripts/runbook.ts 1
 *
 * Prints the exact recording-loop commands and the CLI visibility step
 * for the requested episode so you can follow along on camera without
 * switching windows.
 */

import { c, log, hr } from "./utils.js";

// ── episode data ─────────────────────────────────────────────────────────────

interface EpisodeRunbook {
  title: string;
  teaches: string[];
  loop: string[];
  visibility: { label: string; commands: string[] };
}

const RUNBOOKS: Record<number, EpisodeRunbook> = {
  1: {
    title: "Edge Function Logging",
    teaches: [
      "How to diagnose an opaque HTTP 500 from a Supabase edge function",
      "Why missing try/catch and unguarded env vars produce empty error responses",
      "How to wire request_id and structured JSON logging so errors are traceable",
    ],
    loop: [
      "pnpm ep1:reset          # restore known-good index.ts",
      "pnpm ep1:break          # inject broken version",
      "pnpm ep1:run            # reproduce the failure",
      "",
      "# ── run CLI visibility step (see below) ──",
      "# ── apply minimal fix in your IDE ──",
      "",
      "pnpm ep1:run            # confirm output changed",
      "pnpm ep1:verify         # assert HTTP 200 + request_id present",
      "pnpm ep1:reset          # clean up",
    ],
    visibility: {
      label: "Tail edge function server logs",
      commands: [
        "supabase functions logs echo --scroll 20",
      ],
    },
  },

  2: {
    title: "RPC Debugging",
    teaches: [
      "How to read Supabase RPC error objects (code, message, hint)",
      "How to inspect the live Postgres function definition from the CLI",
      "How RAISE NOTICE works as server-side logging via supabase db logs",
    ],
    loop: [
      "pnpm ep2:reset          # restore known-good RPC (supabase db reset)",
      "pnpm ep2:break          # inject broken create_receipt (column typo)",
      "pnpm ep2:run            # reproduce the failure",
      "",
      "# ── run CLI visibility step (see below) ──",
      "# ── apply minimal fix in your IDE ──",
      "",
      "pnpm ep2:run            # confirm error is gone",
      "pnpm ep2:verify         # assert RPC returns receipt with id + title",
      "pnpm ep2:reset          # clean up",
    ],
    visibility: {
      label: "Inspect live Postgres function definition",
      commands: [
        `docker exec supabase_db_supabase-debug-playground psql -U postgres -c "SELECT pg_get_functiondef('public.create_receipt(text,numeric)'::regprocedure);"`,
        "",
        "# Also tail RAISE NOTICE output:",
        "supabase db logs",
      ],
    },
  },

  3: {
    title: "CRUD — Did it save?",
    teaches: [
      "Why .insert() without .select() returns { data: null, error: null } on success",
      "Why checking !error is not a confirmation the row was saved",
      "How .select() + .throwOnError() gives unambiguous insert confirmation",
    ],
    loop: [
      "pnpm ep3:reset          # restore known-good ep3_crud.ts",
      "pnpm ep3:break          # patch goodInsert to remove .select() + .throwOnError()",
      "pnpm ep3:run            # reproduce the failure",
      "",
      "# ── run CLI visibility step (see below) ──",
      "# ── apply minimal fix in your IDE ──",
      "",
      "pnpm ep3:run            # confirm data is no longer null",
      "pnpm ep3:verify         # assert row returned with id + title",
      "pnpm ep3:reset          # clean up",
    ],
    visibility: {
      label: "Add temporary console.log in scripts/ep3_crud.ts",
      commands: [
        "# This is an SDK behavior issue — no CLI hook.",
        "# In scripts/ep3_crud.ts, after the insert call add:",
        "",
        `console.log("RAW RESPONSE →", JSON.stringify({ data, error, rowCount: Array.isArray(data) ? data.length : null }, null, 2));`,
        "",
        "# Re-run pnpm ep3:run — you will see data: null even on success.",
        "# Remove the console.log after diagnosing.",
      ],
    },
  },

  4: {
    title: "RLS / Policy vs Keys",
    teaches: [
      "Why RLS with no INSERT policy blocks the anon key but not service_role",
      "Why 'it works from the dashboard' does not prove your app will work",
      "How to write a correct WITH CHECK INSERT policy for authenticated users",
    ],
    loop: [
      "pnpm ep4:reset          # restore baseline (RLS disabled, policy present)",
      "pnpm ep4:break          # enable RLS + drop INSERT policy",
      "pnpm ep4:run            # reproduce the failure",
      "",
      "# ── run CLI visibility step (see below) ──",
      "# ── apply minimal fix in your IDE ──",
      "",
      "pnpm ep4:run            # output looks identical — anon still blocked, that's expected",
      "pnpm ep4:verify         # assert all 3 scenarios pass",
      "pnpm ep4:reset          # clean up",
    ],
    visibility: {
      label: "List live RLS policies + RLS status",
      commands: [
        `docker exec supabase_db_supabase-debug-playground psql -U postgres -c "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'receipts';"`,
        "",
        `docker exec supabase_db_supabase-debug-playground psql -U postgres -c "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'receipts';"`,
      ],
    },
  },

  5: {
    title: "Schema Drift / Types",
    teaches: [
      "Why adding a DB column without regenerating types is a silent mismatch",
      "How to detect drift by comparing live columns to types.gen.ts from the CLI",
      "Where supabase gen types should run in CI to prevent drift in production",
    ],
    loop: [
      "pnpm ep5:reset          # restore committed types.gen.ts + drop notes column",
      "pnpm ep5:break          # add notes column to DB + write stale types.gen.ts",
      "pnpm ep5:run            # reproduce the drift report",
      "",
      "# ── run CLI visibility step (see below) ──",
      "# ── apply minimal fix: one command (see below) ──",
      "",
      "pnpm ep5:run            # confirm drift is gone",
      "pnpm ep5:verify         # assert types match live DB + notes present",
      "pnpm ep5:reset          # clean up",
    ],
    visibility: {
      label: "Confirm column in DB + regenerate types",
      commands: [
        `docker exec supabase_db_supabase-debug-playground psql -U postgres -c "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receipts' ORDER BY ordinal_position;"`,
        "",
        "# Fix command (entire fix is this one line):",
        "supabase gen types typescript --local > supabase/types.gen.ts",
      ],
    },
  },
};

// ── main ─────────────────────────────────────────────────────────────────────

function printRunbook(ep: number) {
  const rb = RUNBOOKS[ep];
  if (!rb) {
    console.error(`Unknown episode: ${ep}. Valid values: 1 2 3 4 5`);
    process.exit(1);
  }

  hr();
  log(c.bold(c.cyan(`  EP${ep} — ${rb.title}`)));
  hr();

  log(c.bold("\nWhat this episode teaches:"));
  for (const t of rb.teaches) {
    log(`  ${c.green("•")}  ${t}`);
  }

  log(c.bold("\n── Recording loop ─────────────────────────────────────────────"));
  log("");
  for (const line of rb.loop) {
    if (line === "") {
      log("");
    } else if (line.startsWith("#")) {
      log(c.grey(`  ${line}`));
    } else {
      log(`  ${c.cyan(line.split("#")[0].trimEnd())}  ${c.grey("#" + (line.split("#")[1] ?? ""))}`);
    }
  }

  log(c.bold("\n── CLI visibility step ────────────────────────────────────────"));
  log(`\n  ${c.yellow(rb.visibility.label)}\n`);
  for (const cmd of rb.visibility.commands) {
    if (cmd === "") {
      log("");
    } else if (cmd.startsWith("#")) {
      log(c.grey(`  ${cmd}`));
    } else {
      log(`  ${c.cyan(cmd)}`);
    }
  }

  log("");
  hr();
  log(c.grey(`  Prompt file: prompts/ep${ep}.md`));
  log(c.grey(`  Run pnpm ep${ep}:prompt to copy the episode prompt to your clipboard, then paste into a new Cursor/Copilot chat.`));
  hr();
}

const raw = process.argv[2];
const ep  = parseInt(raw ?? "", 10);

if (!raw || isNaN(ep) || ep < 1 || ep > 5) {
  console.error("Usage: pnpm ep:runbook <1|2|3|4|5>");
  console.error("Example: pnpm ep:runbook 3");
  process.exit(1);
}

printRunbook(ep);
