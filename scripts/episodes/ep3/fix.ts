/**
 * EP3 — fix.ts
 *
 * What it does:
 *   Reverses the EP3 break patch in `scripts/ep3_crud.ts` — restores
 *   `.select()` and `.throwOnError()` to the `goodInsert` helper.
 *
 * ─── WHAT WAS WRONG ──────────────────────────────────────────────────────────
 *
 *   BUG — `.select()` and `.throwOnError()` removed from the insert chain:
 *     • `.insert()` without `.select()` always returns `{ data: null, error: null }`
 *       on success — you cannot tell if the row was actually saved
 *     • Without `.throwOnError()`, errors are silently swallowed into the
 *       error object — a plain `!error` check will pass even on DB failure
 *
 * ─── HOW IT WAS FIXED ────────────────────────────────────────────────────────
 *
 *   FIX 1 — Chain `.select()` after `.insert()` to get the inserted row(s) back
 *   FIX 2 — Chain `.throwOnError()` so any DB error throws immediately
 *            rather than being silently captured in `error`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Reset: `pnpm ep3:reset` (git checkout) also restores ep3_crud.ts.
 */

import { join } from "node:path";
import { applyPatch } from "../_shared/patch.js";
import { c, log, hr, ok, fail, step, warn, writeState } from "../../utils.js";

const TARGET = join(process.cwd(), "scripts", "ep3_crud.ts");

// ── patch direction: broken → fixed ──────────────────────────────────────────

const FROM = `  // ❌ BREAK: .select() and .throwOnError() removed — spot the bug!
  const { data, error } = await supabase
    .from("receipts")
    .insert({ title, amount });`;

const TO = `  const { data, error } = await supabase
    .from("receipts")
    .insert({ title, amount })
    .select()          // ✅ FIX: returns the inserted row(s) — data will not be null
    .throwOnError();   // ✅ FIX: throws on any DB error — no more silent failures`;

// ── apply ─────────────────────────────────────────────────────────────────────

hr();
log(c.bold(c.green("EP3 FIX — restoring .select() + .throwOnError() in goodInsert")));
hr();

log("Fix applied:");
log(c.green("  1. .select() restored    — insert now returns the saved row (data ≠ null)"));
log(c.green("  2. .throwOnError() restored — DB errors now throw instead of being silently captured"));
log("");

step("Patch", "Restoring goodInsert in scripts/ep3_crud.ts");

const status = applyPatch(TARGET, FROM, TO);

if (status === "already-applied") {
  warn("Fix patch already applied — ep3_crud.ts is already in the fixed state.");
  writeState({ ep3_mode: "fixed" });
} else if (status === "not-applicable") {
  fail("Target string not found in ep3_crud.ts — file may be in an unknown state.");
  fail("Run: pnpm ep3:reset  then retry.");
  process.exit(1);
} else {
  ok("scripts/ep3_crud.ts restored");
  writeState({ ep3_mode: "fixed" });
}

log("");
log("Next steps:");
log("  1. pnpm ep3:run    — confirm data now contains the inserted row");
log("  2. pnpm ep3:verify — run pass/fail assertions");
log("  3. pnpm ep3:reset  — restore ep3_crud.ts to known-good state");
hr();
