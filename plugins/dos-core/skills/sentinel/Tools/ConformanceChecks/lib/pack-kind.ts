/**
 * pack-kind — canonical resolver for DOS Pack class taxonomy.
 *
 * Spec: RFC-0107 (Curated-Pointer Pack Class) §3 A1.
 *
 * Three pack classes:
 *   - "capability"      — standard skill (vendored body); the default when
 *                         `plugin.json.kind` is absent (backward compat per
 *                         Q1) or unrecognized (defensive default per Beck T3).
 *   - "extension-only"  — operator-competitive skill where SKILL.md body is
 *                         excluded from public-submodule sync via
 *                         `.dos-sync-manifest.json` patterns (RFC-0026
 *                         precedent: AXDeepScan, Bdr, Compliance, Investigation,
 *                         Sales).
 *   - "curated-pointer" — vendor-by-reference pack (RFC-0107). The pack POINTS
 *                         at upstream via `plugin.json.upstream` (Aggregate
 *                         identity, top-level required field); the SKILL.md
 *                         body is CURATED guidance about WHEN to consult that
 *                         pointer. No upstream code is vendored.
 *
 * Why this seam exists (Evans + Feathers + Beck convergent finding, 2026-05-19
 * council): all downstream consumers (R11, R73, sync-check, scaffold-pack-docs)
 * route through this resolver — no string-matching of `kind` field in N places.
 *
 * Backward compatibility:
 *   - `kind` field absent           → "capability"
 *   - `kind: "capability"`          → "capability"
 *   - `kind: "extension-only"`      → "extension-only"
 *   - `kind: "curated-pointer"`     → "curated-pointer"
 *   - `kind: "<anything else>"`     → "capability" (defensive default — never throw
 *                                     on unrecognized; caller is responsible for
 *                                     auditing unrecognized values via R-rules)
 *
 * Errors:
 *   - Throws Error if plugin.json is missing or malformed JSON. Callers should
 *     ensure pack passes R11 (required-files check) before invoking packKind().
 *
 * Test seam: see pack-kind.test.ts (co-located, T1-T3 + extension-only completeness).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PackKind = "capability" | "extension-only" | "curated-pointer";

const RECOGNIZED_KINDS = new Set<PackKind>([
  "capability",
  "extension-only",
  "curated-pointer",
]);

/**
 * Resolve the kind of a DOS Pack from its plugin.json.
 *
 * @param packPath Absolute path to the pack directory (the parent of
 *                 `plugin.json`, NOT the path to plugin.json itself).
 * @returns The resolved PackKind. Never null/undefined.
 * @throws Error if plugin.json is missing or not valid JSON.
 */
export function packKind(packPath: string): PackKind {
  const pluginJsonPath = join(packPath, "plugin.json");
  if (!existsSync(pluginJsonPath)) {
    throw new Error(
      `pack-kind: plugin.json not found at ${pluginJsonPath} (caller responsibility — pack should pass R11 first)`,
    );
  }
  let raw: string;
  try {
    raw = readFileSync(pluginJsonPath, "utf-8");
  } catch (err) {
    throw new Error(
      `pack-kind: cannot read ${pluginJsonPath}: ${(err as Error).message}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `pack-kind: malformed JSON in ${pluginJsonPath}: ${(err as Error).message}`,
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `pack-kind: ${pluginJsonPath} must be a JSON object`,
    );
  }
  const obj = parsed as Record<string, unknown>;
  const rawKind = obj["kind"];

  // Backward compat per RFC-0107 Q1: absent → "capability".
  if (rawKind === undefined || rawKind === null) {
    return "capability";
  }

  // Defensive default per Beck T3: unrecognized value → "capability".
  if (typeof rawKind !== "string") {
    return "capability";
  }
  if (!RECOGNIZED_KINDS.has(rawKind as PackKind)) {
    return "capability";
  }
  return rawKind as PackKind;
}
