/**
 * scripts/episodes/_shared/patch.ts
 *
 * Tiny text-patch helper.  All break scripts use this so they are:
 *   - Deterministic  : same result no matter how many times you run them.
 *   - Idempotent     : running break twice does NOT double-corrupt a file.
 *   - Reversible     : `git checkout -- .` undoes every patch instantly.
 */

import { readFileSync, writeFileSync } from "node:fs";

export type PatchStatus = "applied" | "already-applied" | "not-applicable";

/**
 * Apply a single text patch to a file.
 *
 * @param filePath  Absolute path to the file to patch.
 * @param from      Exact string to find (must be unique in the file).
 * @param to        String to replace it with.
 * @returns         "applied"          – patch was applied successfully
 *                  "already-applied"  – `to` was already present, skipped
 *                  "not-applicable"   – `from` not found (file may be wrong state)
 */
export function applyPatch(
  filePath: string,
  from: string,
  to: string
): PatchStatus {
  const src = readFileSync(filePath, "utf8");

  if (src.includes(to)) return "already-applied";
  if (!src.includes(from)) return "not-applicable";

  writeFileSync(filePath, src.replace(from, to), "utf8");
  return "applied";
}

/**
 * Revert a patch (swap `to` back to `from`).
 * Usually you should prefer `git checkout -- <file>` over this.
 */
export function revertPatch(
  filePath: string,
  from: string,
  to: string
): PatchStatus {
  return applyPatch(filePath, to, from);
}

/**
 * Check whether a file currently contains a specific string.
 */
export function fileContains(filePath: string, needle: string): boolean {
  try {
    return readFileSync(filePath, "utf8").includes(needle);
  } catch {
    return false;
  }
}

/**
 * Overwrite a file completely (used when a whole-file swap is simpler
 * than a targeted patch — e.g. EP1 edge function).
 * Idempotency: reads `source` first; skips write if `target` already matches.
 */
export function swapFile(sourcePath: string, targetPath: string): PatchStatus {
  const src = readFileSync(sourcePath, "utf8");
  let cur: string;
  try { cur = readFileSync(targetPath, "utf8"); } catch { cur = ""; }
  if (cur === src) return "already-applied";
  writeFileSync(targetPath, src, "utf8");
  return "applied";
}
