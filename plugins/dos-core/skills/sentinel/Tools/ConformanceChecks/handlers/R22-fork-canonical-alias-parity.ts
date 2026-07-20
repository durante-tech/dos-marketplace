/**
 * R22 — Every bridge.py ACTION is declared in KNOWN_BRIDGE_ACTIONS allowlist.
 *
 * conformance:R43-exempt R22 references mempalace_bridge.py as the alias
 * pair label only (documenting the sync-manifest entry); it does not grep
 * the bridge file for Python symbols. The V11.13 split co-location
 * invariant doesn't apply to alias-name-only references.
 *
 * The sync manifest (.dos-sync-manifest.json) declares named aliases for files
 * whose canonical name differs between the pack source and the live install.
 * The bridge is the primary fork case: `Packs/mem-palace/src/Tools/bridge.py`
 * (pack canonical) ↔ `~/.claude/DOS/Tools/mempalace_bridge.py` (live alias).
 *
 * Without this alias entry, sync-check.ts cannot verify the bridge is in parity
 * across copies — it would silently skip the most important MemPalace file.
 *
 * This check:
 *   1. Locates .dos-sync-manifest.json at ctx.repoRoot
 *   2. Reads the `aliases` block
 *   3. Verifies bridge.py ↔ mempalace_bridge.py is declared
 *
 * The "KNOWN_BRIDGE_ACTIONS allowlist" in the RFC-0059 manifest text refers to
 * the sync manifest aliases block — the declared set of known fork pairings.
 *
 * Failure modes:
 *   - .dos-sync-manifest.json not found → not_applicable
 *   - aliases block absent or empty → fail
 *   - bridge.py ↔ mempalace_bridge.py alias not present → fail
 *
 * Why R-class: an undeclared bridge fork makes sync-check.ts blind to bridge
 * drift. Silent drift in the bridge causes agent behavior divergence between
 * pack source and live install — the highest-impact single-file gap in the
 * four-copy architecture.
 */

import { existsSync, readFileSync } from "fs";
import { basename, join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "sync manifest (.dos-sync-manifest.json) must declare bridge.py ↔ mempalace_bridge.py alias in the aliases block";

/** Known alias pairs to verify. Each entry is [pack-canonical-basename, live-alias-basename]. */
const REQUIRED_ALIASES: Array<[string, string]> = [
  ["bridge.py", "mempalace_bridge.py"],
];

interface SyncManifest {
  aliases?: Array<Record<string, unknown>>;
}

/** Basenames of every string-valued field in an alias entry (any field naming). */
function entryBasenames(entry: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(entry)) {
    if (typeof v === "string" && v.length > 0) out.add(basename(v));
    // Map-form entries ({"<canonical path>": "<alias path>"}) carry the
    // canonical as the KEY — the old JSON.stringify check saw keys, so a
    // values-only walk would false-fail that legal shape (code-review
    // 2026-07-07). Only path-like keys count (contain a slash).
    if (k.includes("/")) out.add(basename(k));
  }
  return out;
}

/**
 * True when the manifest declares `canonical` and `alias` as a CO-LOCATED pair
 * — both basenames present in the SAME alias entry, compared by EXACT basename
 * equality.
 *
 * SENT-04: the old check was `JSON.stringify(aliases).includes(canonical) &&
 * …includes(alias)`. Because `"mempalace_bridge.py".includes("bridge.py")` is
 * true, the canonical clause auto-satisfied off ANY entry mentioning the alias,
 * and the two names did not have to live in the same entry — a mis-paired alias
 * passed. Exact-basename + same-entry closes both holes.
 */
function aliasPresent(aliases: SyncManifest["aliases"], canonical: string, alias: string): boolean {
  if (!aliases || aliases.length === 0) return false;
  return aliases.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const names = entryBasenames(entry as Record<string, unknown>);
    return names.has(canonical) && names.has(alias);
  });
}

export async function r22ForkCanonicalAliasParity(ctx: CheckContext): Promise<CheckResult> {
  const manifestPath = join(ctx.repoRoot, ".dos-sync-manifest.json");

  if (!existsSync(manifestPath)) {
    return {
      rId: "R22",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`.dos-sync-manifest.json not found at ${ctx.repoRoot} — sync manifest not present`],
    };
  }

  let manifest: SyncManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as SyncManifest;
  } catch (err) {
    return {
      rId: "R22",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `.dos-sync-manifest.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (!manifest.aliases || manifest.aliases.length === 0) {
    return {
      rId: "R22",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `.dos-sync-manifest.json has no aliases block — bridge.py fork is undeclared`,
        `Add an aliases entry mapping bridge.py → mempalace_bridge.py`,
      ],
    };
  }

  const missingAliases: string[] = [];

  for (const [canonical, alias] of REQUIRED_ALIASES) {
    if (!aliasPresent(manifest.aliases, canonical, alias)) {
      missingAliases.push(`${canonical} ↔ ${alias}`);
    }
  }

  if (missingAliases.length > 0) {
    return {
      rId: "R22",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `Missing alias declaration(s) in .dos-sync-manifest.json: ${missingAliases.join(", ")}`,
        `sync-check.ts cannot verify bridge parity without these aliases`,
      ],
    };
  }

  return {
    rId: "R22",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `bridge.py ↔ mempalace_bridge.py alias declared in .dos-sync-manifest.json`,
      `${manifest.aliases.length} total alias entry(ies) in manifest`,
    ],
  };
}
