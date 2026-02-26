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
import { c, log, hr, ok, warn } from "../../utils.js";

const TARGET = join(process.cwd(), "scripts", "ep3_crud.ts");

// ── exact strings to find / replace ──────────────────────────────────────────

const FROM = `  const { data, error } = await supabase
    .from("receipts")
    .insert({ title, amount })
    .select()          // ✔ returns the inserted row(s)
    .throwOnError();   // ✔ throws immediately on any DB error`;

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
} else if (status === "not-applicable") {
  warn("Target string not found in ep3_crud.ts — file may already be fixed or in unknown state.");
  warn("Run `pnpm ep3:reset` then retry.");
  process.exit(1);
} else {
  ok("scripts/ep3_crud.ts patched");
  log("");
  log("What changed in goodInsert:");
  log(c.red("  - .select()        // removed → data will be null"));
  log(c.red("  - .throwOnError()  // removed → errors silently swallowed"));
}

log("");
log("Next steps:");
log("  1. pnpm ep3:run  — see data: null with no error (the confusion)");
log("  2. Open scripts/ep3_crud.ts in your IDE and find goodInsert");
log("  3. Add back .select() and .throwOnError()");
log("  4. pnpm ep3:run  — confirm data now contains a row");
log("  5. pnpm ep3:verify");
hr();
