/**
 * R-ACL-1 (RFC-0061) — Every PAI-origin file in PAI_PORT_REGISTRY has a non-empty upstreamCommitSha.
 *
 * Context: RFC-0061 §2 treats PAI as a Port. The PAI_PORT_REGISTRY in Tools/pai-port.ts
 * enumerates every file lifted from upstream. R-ACL-1 enforces that each entry in the
 * registry carries its originating upstream commit SHA — the minimum provenance record
 * required for the ACL to be auditable. Entries with upstreamCommitSha = '' are
 * untracked borrows; 'unknown' is accepted for pre-fork lifts.
 *
 * Resolution chain:
 *   1. (ctx as ExtendedCheckContext).paiPortRegistry — test seam injection (bypasses disk)
 *   2. dynamic import({repoRoot}/Tools/pai-port.ts)  — production path
 *   3. registry file absent → not_applicable (Phase 1 not yet complete)
 *
 * Failure modes:
 *   - Registry entry with empty string upstreamCommitSha → fail
 *   - Tools/pai-port.ts not found → not_applicable
 *   - Registry empty → not_applicable
 *
 * Cross-references:
 *   RFC-0061 §13.1 R-ACL-1 (check: pai-acl.pai-origin-files-declared)
 *   Tools/pai-port.ts — PaiPortEntry shape + PAI_PORT_REGISTRY export
 *   Plans/Specs/RFC-0061-pai-as-port-acl.md §3.1 (upstream SHA population)
 *
 * Enhancement notes:
 *   2026-05-05 — initial authorship (Stream G, RFC-0061 delivery)
 */

import { existsSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const R_ID = "R-ACL-1";
const REQUIREMENT =
  "Every PAI-origin file in PAI_PORT_REGISTRY has a non-empty upstreamCommitSha";

/** Minimal shape — mirrors PaiPortEntry in Tools/pai-port.ts without coupling to that module at compile-time. */
interface PaiPortEntry {
  dosPath: string;
  paiPatternSlug: string;
  upstreamCommitSha: string;
  translationStatus: "verbatim" | "adapted" | "translated" | "verbatim_deliberate";
  dosNamespace: string;
}

/** Local extension of CheckContext for the test-seam injection — types.ts is NOT modified. */
type CheckContextWithRegistry = CheckContext & { paiPortRegistry?: PaiPortEntry[] };

/**
 * Registry load outcome. SENT-06: the old loader collapsed "file absent"
 * (Phase 1 not complete → not_applicable) and "file present but broken"
 * (a syntax-errored pai-port.ts → import throws → the ACL gate silently
 * disarms) into a single `null`. That let a broken registry read as
 * not_applicable, exactly disarming the gate it exists to enforce. We now
 * distinguish absent (NA) from load-error (FAIL, with the error as evidence).
 */
type RegistryLoad =
  | { kind: "absent"; path: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; registry: PaiPortEntry[] };

async function loadRegistry(ctx: CheckContextWithRegistry): Promise<RegistryLoad> {
  // Test-seam: injected registry takes precedence over disk.
  if (ctx.paiPortRegistry !== undefined) {
    // Preserve the old seam contract: a non-array injection (null = "registry
    // unavailable") is the NA path, not a crash (code-review 2026-07-07).
    if (!Array.isArray(ctx.paiPortRegistry)) return { kind: "absent" };
    return { kind: "ok", registry: ctx.paiPortRegistry };
  }

  const registryPath = join(ctx.repoRoot, "Tools", "pai-port.ts");
  if (!existsSync(registryPath)) {
    return { kind: "absent", path: registryPath };
  }

  try {
    const mod = await import(registryPath);
    const reg = mod.PAI_PORT_REGISTRY;
    if (!Array.isArray(reg)) {
      return { kind: "error", message: `Tools/pai-port.ts loaded but PAI_PORT_REGISTRY export is missing or not an array` };
    }
    return { kind: "ok", registry: reg as PaiPortEntry[] };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export async function rAcl1PaiOriginFilesDeclared(ctx: CheckContext): Promise<CheckResult> {
  const load = await loadRegistry(ctx as CheckContextWithRegistry);

  if (load.kind === "absent") {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        "PAI_PORT_REGISTRY not available (Tools/pai-port.ts absent — Phase 1 may not be complete)",
        `Looked for: ${load.path}`,
      ],
    };
  }

  if (load.kind === "error") {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        "Tools/pai-port.ts is present but could not be loaded — the ACL provenance gate cannot be evaluated (present-but-broken ≠ absent)",
        `load error: ${load.message}`,
        "fix: repair Tools/pai-port.ts so PAI_PORT_REGISTRY imports as an array, then re-run",
      ],
    };
  }

  const registry = load.registry;

  if (registry.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["PAI_PORT_REGISTRY is empty — no PAI-origin files declared, gate not applicable"],
    };
  }

  const missing = registry.filter(
    (e) => typeof e.upstreamCommitSha !== "string" || e.upstreamCommitSha.trim() === "",
  );

  if (missing.length > 0) {
    const preview = missing
      .slice(0, 5)
      .map((e) => e.dosPath)
      .join(", ");
    const overflow = missing.length > 5 ? ` (+${missing.length - 5} more)` : "";
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${missing.length} registry entry/entries have empty upstreamCommitSha: ${preview}${overflow}`,
        "fix: run `git log --follow --diff-filter=A -- <dosPath>` for each and populate upstreamCommitSha",
        "if pre-fork lift, set upstreamCommitSha: 'unknown' (non-empty placeholder is accepted per RFC-0061 §3)",
      ],
    };
  }

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `All ${registry.length} PAI_PORT_REGISTRY entries carry a non-empty upstreamCommitSha`,
    ],
  };
}
