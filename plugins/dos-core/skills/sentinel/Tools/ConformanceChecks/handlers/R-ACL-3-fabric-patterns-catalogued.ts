/**
 * R-ACL-3 (RFC-0061) — Every directory under Packs/utilities/src/Fabric/Patterns/ has a
 * verbatim or verbatim_deliberate entry in PAI_PORT_REGISTRY.
 *
 * The Fabric pattern corpus is a verbatim lift from the PAI upstream (18 patterns per
 * RFC-0061 §3.1 inventory). Each pattern directory must be explicitly declared in the
 * registry with translationStatus 'verbatim' or 'verbatim_deliberate' so the ACL
 * boundary is fully enumerated — silent drift (a new pattern directory without a
 * registry entry) is a Phase-4 readiness gap.
 *
 * NOT_APPLICABLE conditions:
 *   - Packs/utilities/src/Fabric/Patterns/ does not exist
 *     (this install may not include Fabric patterns, or Stream R is not complete)
 *   - PAI_PORT_REGISTRY unavailable
 *   - Patterns/ has no subdirectories (empty corpus)
 *
 * Matching logic:
 *   A pattern directory {name} is considered "catalogued" when at least one registry entry
 *   satisfies ALL of the following:
 *     (a) entry.dosPath contains the pattern directory name (slug match)
 *     (b) entry.translationStatus is 'verbatim' or 'verbatim_deliberate'
 *
 * Resolution chain:
 *   1. (ctx as ExtendedCheckContext).paiPortRegistry — test seam
 *   2. dynamic import({repoRoot}/Tools/pai-port.ts)  — production
 *   3. registry unavailable → not_applicable
 *
 * Cross-references:
 *   RFC-0061 §13.1 R-ACL-3 (check: pai-acl.fabric-patterns-catalogued)
 *   RFC-0061 §3.1 — 18 verbatim Fabric patterns inventory
 *   Packs/utilities/src/Fabric/Patterns/ — pattern corpus
 *
 * Enhancement notes:
 *   2026-05-05 — initial authorship (Stream G, RFC-0061 delivery)
 */

import { existsSync, readdirSync, statSync } from "fs";
import { basename, join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const R_ID = "R-ACL-3";
const REQUIREMENT =
  "Every directory under Packs/utilities/src/Fabric/Patterns/ has a verbatim entry in PAI_PORT_REGISTRY";

const FABRIC_PATTERNS_SUBPATH = join("Packs", "utilities", "src", "Fabric", "Patterns");

const VERBATIM_STATUSES = new Set(["verbatim", "verbatim_deliberate"]);

/** Minimal shape mirroring PaiPortEntry in Tools/pai-port.ts. */
interface PaiPortEntry {
  dosPath: string;
  paiPatternSlug: string;
  upstreamCommitSha: string;
  translationStatus: string;
  dosNamespace: string;
}

/** Local context extension for test-seam injection — types.ts is NOT modified. */
type CheckContextWithRegistry = CheckContext & { paiPortRegistry?: PaiPortEntry[] };

/**
 * Registry load outcome. SENT-06: distinguish "file absent" (Phase 1 not
 * complete → not_applicable) from "file present but broken" (import throws or
 * malformed export → FAIL). Collapsing both to `null` let a syntax-errored
 * pai-port.ts silently disarm the ACL gate.
 */
type RegistryLoad =
  | { kind: "absent" }
  | { kind: "error"; message: string }
  | { kind: "ok"; registry: PaiPortEntry[] };

async function loadRegistry(ctx: CheckContextWithRegistry): Promise<RegistryLoad> {
  if (ctx.paiPortRegistry !== undefined) {
    // Non-array injection (null = "registry unavailable") is NA, not a crash.
    if (!Array.isArray(ctx.paiPortRegistry)) return { kind: "absent" };
    return { kind: "ok", registry: ctx.paiPortRegistry };
  }

  const registryPath = join(ctx.repoRoot, "Tools", "pai-port.ts");
  if (!existsSync(registryPath)) return { kind: "absent" };

  try {
    const mod = await import(registryPath);
    const reg = mod.PAI_PORT_REGISTRY;
    if (!Array.isArray(reg)) {
      return { kind: "error", message: "Tools/pai-port.ts loaded but PAI_PORT_REGISTRY export is missing or not an array" };
    }
    return { kind: "ok", registry: reg as PaiPortEntry[] };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

function listPatternDirs(patternsDir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(patternsDir);
  } catch {
    return [];
  }
  const dirs: string[] = [];
  for (const entry of entries) {
    const full = join(patternsDir, entry);
    try {
      if (statSync(full).isDirectory()) {
        dirs.push(entry);
      }
    } catch {
      // skip unreadable entries
    }
  }
  return dirs.sort();
}

/** Returns true if the registry has a verbatim entry covering this pattern directory name. */
function isCatalogued(patternName: string, registry: PaiPortEntry[]): boolean {
  return registry.some(
    (e) =>
      VERBATIM_STATUSES.has(e.translationStatus) &&
      (e.dosPath.includes(`/${patternName}`) ||
        e.dosPath.includes(`\\${patternName}`) ||
        basename(e.dosPath) === patternName),
  );
}

export async function rAcl3FabricPatternsCatalogued(ctx: CheckContext): Promise<CheckResult> {
  const patternsDir = join(ctx.repoRoot, FABRIC_PATTERNS_SUBPATH);

  if (!existsSync(patternsDir)) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `Fabric/Patterns corpus not found at ${FABRIC_PATTERNS_SUBPATH} — check not applicable`,
        "Either this install does not include Fabric patterns, or Stream R (registry) is incomplete",
      ],
    };
  }

  const load = await loadRegistry(ctx as CheckContextWithRegistry);

  if (load.kind === "absent") {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        "PAI_PORT_REGISTRY not available (Tools/pai-port.ts absent)",
        "Cannot verify pattern catalogue without the registry — Phase 1 may not be complete",
      ],
    };
  }

  if (load.kind === "error") {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        "Fabric/Patterns exists but Tools/pai-port.ts is present-and-unloadable — the ACL catalogue gate cannot be evaluated (present-but-broken ≠ absent)",
        `load error: ${load.message}`,
        "fix: repair Tools/pai-port.ts so PAI_PORT_REGISTRY imports as an array, then re-run",
      ],
    };
  }

  const registry = load.registry;

  const patternDirs = listPatternDirs(patternsDir);

  if (patternDirs.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${patternsDir} exists but has no subdirectories — empty corpus, gate not applicable`],
    };
  }

  const uncatalogued = patternDirs.filter((name) => !isCatalogued(name, registry));

  if (uncatalogued.length > 0) {
    const preview = uncatalogued.slice(0, 5).join(", ");
    const overflow = uncatalogued.length > 5 ? ` (+${uncatalogued.length - 5} more)` : "";
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${uncatalogued.length} Fabric pattern director(y/ies) missing from PAI_PORT_REGISTRY: ${preview}${overflow}`,
        `Registry has ${registry.filter((e) => VERBATIM_STATUSES.has(e.translationStatus)).length} verbatim/verbatim_deliberate entries`,
        "fix: add a PaiPortEntry with translationStatus: 'verbatim' for each missing pattern to Tools/pai-port.ts",
      ],
    };
  }

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `All ${patternDirs.length} Fabric pattern director(y/ies) are catalogued in PAI_PORT_REGISTRY as verbatim`,
      `Patterns dir: ${patternsDir}`,
    ],
    loc: patternsDir,
  };
}
