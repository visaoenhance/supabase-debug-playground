/**
 * EP3 — break.ts
 *
 * What it does:
 *   Patches `scripts/ep3_crud.ts` — specifically the `goodInsert` helper —
 *   to remove `.select()` and `.throwOnError()`.
 *
 *   After the patch:
 *     • `goodInsert` behaves identically to the broken anti-pattern
 *     • `pnpm ep3:run` shows:  data: null, error: null  ← ambiguous
 *     • The user's fix: restore .select().throwOnError() in goodInsert
 *
 * Reset: `pnpm ep3:reset`  →  git checkout restores ep3_crud.ts
 */

import { join } from "node:path";
import { applyPatch } from "../_shared/patch.js";
import { c, log, hr, ok, warn, writeState } from "../../utils.js";

const TARGET = join(process.cwd(), "scripts", "ep3_crud.ts");

// ── exact strings to find / replace ──────────────────────────────────────────

const FROM = `  const { data, error } = await supabase
    .from("receipts")
    .insert({ title, amount })
    .select()          // ✅ FIX: returns the inserted row(s) — data will not be null
    .throwOnError();   // ✅ FIX: throws on any DB error — no more silent failures`;

const TO = `  // ❌ BREAK: .select() and .throwOnError() removed — spot the bug!
  const { data, error } = await supabase
    .from("receipts")
    .insert({ title, amount });`;

// ── apply ─────────────────────────────────────────────────────────────────────

hr();
log(c.bold(c.yellow("EP3 BREAK — patching goodInsert to remove .select()")));
hr();

const status = applyPatch(TARGET, FROM, TO);

if (status === "already-applied") {
  warn("Patch already applied — skipping (idempotent).");
  writeState({ ep3_mode: "broken" }); // ensure state is correct even if already patched
} else if (status === "not-applicable") {
  warn("Target string not found in ep3_crud.ts — file may already be fixed or in unknown state.");
  warn("Run `pnpm ep3:reset` then retry.");
  process.exit(1);
} else {
  ok("scripts/ep3_crud.ts patched");
  writeState({ ep3_mode: "broken" });
  log("");
  log("What changed in goodInsert:");
  log(c.red("  - .select()        // removed → data will be null"));
  log(c.red("  - .throwOnError()  // removed → errors silently swallowed"));
}

log("");
log("Next steps:");
log("  1. pnpm ep3:run  — see data: null with no error (the confusion)");
log("  2. Open scripts/ep3_crud.ts and restore .select() + .throwOnError() in goodInsert");
log("     — or run `pnpm ep3:fix` for the pre-built annotated fix");
log("  3. pnpm ep3:run    — confirm data now contains a row");
log("  4. pnpm ep3:verify");
hr();
