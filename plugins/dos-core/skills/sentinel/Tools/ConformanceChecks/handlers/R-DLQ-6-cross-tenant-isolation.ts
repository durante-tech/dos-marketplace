/**
 * R-DLQ-6 (RFC-0062 §9 / F3) — every Save*ToStudio.ts producer that reads a
 * filesystem-anchored field (cwd / CLAUDE_PROJECT_DIR / payload.projectPath /
 * payload.filePath) MUST gate that field through the F3 cross-tenant scope
 * guard before queueing.
 *
 * The PRD defines "high-leverage" producers that are required to gate. Any
 * Save*ToStudio.ts file that imports `queueOrPost` AND references a
 * filesystem-anchored token MUST also import either `crossTenantGate` from
 * `dlq` or `isDosTenantPath` from `project-context`. Files that do neither
 * are rejected as a leak risk.
 *
 * Heuristic (regex-based, not full AST — same approach as R15):
 *   - File text contains an import from `dlq` (queueOrPost is present)
 *   - File text references at least one tenant-anchored token:
 *       payload.projectPath / payload.filePath / process.cwd() /
 *       CLAUDE_PROJECT_DIR / properties.path
 *   - File text does NOT import `crossTenantGate` AND does NOT import
 *     `isDosTenantPath`
 *
 * Files matching all three predicates fail R-DLQ-6.
 *
 * Scopes scanned (existsSync-gated — missing directories silently skip):
 *   - <repoRoot>/Packs/research/src/Tools/Save*ToStudio.ts
 *   - <repoRoot>/Releases/v*\/.claude/skills/research/Tools/Save*ToStudio.ts
 *     (only releases ≥ v0.0.6 — frozen v0.0.5 and earlier predate RFC-0062
 *     and are immutable snapshots; the rule cannot legally patch them.)
 *
 * Releases scopes are discovered at runtime so the scan auto-tracks frozen
 * release submodules ≥ v0.0.6.
 *
 * Cross-references:
 *   RFC-0062 §9 R-DLQ-6 (check: presence.dlq-cross-tenant-isolation)
 *   PRD MEMORY/WORK/20260505-154846_f3-cross-tenant-producer-guard/PRD.md ISC-E1
 *   hooks/lib/dlq.ts → crossTenantGate
 *   hooks/lib/project-context.ts → isDosTenantPath
 *
 * Enhancement notes:
 *   2026-05-05 — initial authorship (RFC-0062 F3 follow-up).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const R_ID = "R-DLQ-6";
const REQUIREMENT =
  "every Save*ToStudio.ts producer that reads cwd / CLAUDE_PROJECT_DIR / payload-path field MUST gate through isDosTenantPath() / crossTenantGate()";

/**
 * Tokens whose presence indicates a filesystem-anchored payload field — the
 * trigger condition for the gate requirement. If a producer file references
 * any of these, it's reading a path that may be foreign-tenant and MUST gate.
 */
const TENANT_ANCHORED_TOKENS = [
  "payload.projectPath",
  "payload.filePath",
  "payload.cwd",
  "process.cwd()",
  "CLAUDE_PROJECT_DIR",
  // KG entity field (SaveKgToStudio's entity properties.path)
  "properties.path",
  // Direct projectPath usage (e.g., body.projectPath)
  ".projectPath",
] as const;

/**
 * Additional path-field token enforced ONLY on the active development surface
 * (the pack source), NOT on frozen release snapshots. The artifacts producers
 * build `body` with a bare `filePath:` key that the `payload.filePath` token
 * above misses; that blind spot let 297 foreign-tenant (altyaa) envelopes leak
 * into ARTIFACTS/.pending (parked 2026-07-01). Enforcing it pack-side gates
 * every FUTURE freeze, while grandfathering the immutable frozen releases
 * (v0.0.6–v0.0.18) that shipped the un-gated producers before this
 * requirement existed — a frozen snapshot cannot be retro-fixed.
 */
const PACK_ONLY_ANCHORED_TOKENS = ["filePath:"] as const;

/**
 * Tokens that satisfy the gate-import requirement. Either suffices.
 */
const GATE_IMPORT_TOKENS = [
  "crossTenantGate",
  "isDosTenantPath",
] as const;

/**
 * Tokens that mark the file as a real producer (it queues into the DLQ).
 * Without this we'd false-positive on plain TypeScript helpers.
 */
const PRODUCER_TOKENS = ["queueOrPost"] as const;

interface ScanScope {
  label: string;
  absPath: string;
  /**
   * True only for the mutable pack source. Frozen release snapshots are
   * `false` — they are grandfathered from PACK_ONLY_ANCHORED_TOKENS because
   * they are immutable and predate that requirement.
   */
  activeSurface: boolean;
}

/**
 * Frozen release snapshots that predate RFC-0062 (the F3 contract). These
 * directories are immutable historical artifacts; the rule cannot demand a
 * crossTenantGate import in a release that shipped before the import existed.
 * Releases ≥ v0.0.6 are subject to R-DLQ-6.
 */
const FROZEN_PRE_F3_RELEASES = new Set(["v0.0.1", "v0.0.2", "v0.0.3", "v0.0.5"]);

/** Parse "v0.0.19" → [0, 0, 19]; a non-numeric segment sorts low (-1). */
function parseReleaseVersion(entry: string): number[] {
  return entry.replace(/^v/, "").split(".").map((n) => {
    const parsed = Number.parseInt(n, 10);
    return Number.isNaN(parsed) ? -1 : parsed;
  });
}

/** Semver-ish compare: >0 if a is higher, <0 if lower, 0 if equal. */
function compareReleaseVersions(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function discoverReleaseSkillScopes(repoRoot: string): ScanScope[] {
  const releasesDir = join(repoRoot, "Releases");
  if (!existsSync(releasesDir)) return [];
  let entries: string[];
  try {
    entries = readdirSync(releasesDir);
  } catch {
    return [];
  }
  // Eligible = versioned, post-F3, with a producer directory present.
  const eligible = entries.filter((entry) => {
    if (!entry.startsWith("v")) return false;
    if (FROZEN_PRE_F3_RELEASES.has(entry)) return false;
    return existsSync(join(releasesDir, entry, ".claude", "skills", "research", "Tools"));
  });
  // The ACTIVE release is the highest version — under symlink-mode it is the
  // live, mutable deploy target (~/.claude → Releases/vMax/.claude), NOT a
  // frozen snapshot. It MUST enforce PACK_ONLY_ANCHORED_TOKENS ('filePath:')
  // exactly like the pack source, so a producer edited directly in the live
  // tree can't slip the gate. Every LOWER release is a frozen, immutable ship
  // → grandfathered (it shipped before the requirement existed and can't be
  // retro-fixed).
  let activeEntry: string | null = null;
  for (const entry of eligible) {
    if (
      activeEntry === null ||
      compareReleaseVersions(parseReleaseVersion(entry), parseReleaseVersion(activeEntry)) > 0
    ) {
      activeEntry = entry;
    }
  }
  return eligible.map((entry) => ({
    label: `Releases/${entry}/.claude/skills/research/Tools/`,
    absPath: join(releasesDir, entry, ".claude", "skills", "research", "Tools"),
    activeSurface: entry === activeEntry, // active (highest) release enforces; frozen releases grandfathered
  }));
}

function listSaveStudioFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.startsWith("Save") || !entry.endsWith("ToStudio.ts")) continue;
    if (entry.endsWith(".test.ts")) continue;
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (!st.isFile()) continue;
    out.push(full);
  }
  return out;
}

interface FileFinding {
  file: string;
  reason: string;
}

function fileNeedsGate(
  content: string,
  activeSurface: boolean,
): { needs: boolean; matchedToken: string | null } {
  const tokens = activeSurface
    ? [...TENANT_ANCHORED_TOKENS, ...PACK_ONLY_ANCHORED_TOKENS]
    : TENANT_ANCHORED_TOKENS;
  for (const token of tokens) {
    if (content.includes(token)) return { needs: true, matchedToken: token };
  }
  return { needs: false, matchedToken: null };
}

function fileHasGateImport(content: string): boolean {
  return GATE_IMPORT_TOKENS.some((token) => content.includes(token));
}

function fileIsProducer(content: string): boolean {
  return PRODUCER_TOKENS.some((token) => content.includes(token));
}

export async function rDlq6CrossTenantIsolation(ctx: CheckContext): Promise<CheckResult> {
  const repoRoot = ctx.repoRoot;
  if (!repoRoot) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["repoRoot not set on CheckContext — cannot scope scan"],
    };
  }

  const scopes: ScanScope[] = [
    { label: "Packs/research/src/Tools/", absPath: join(repoRoot, "Packs", "research", "src", "Tools"), activeSurface: true },
    ...discoverReleaseSkillScopes(repoRoot),
  ];

  const livingScopes = scopes.filter((scope) => existsSync(scope.absPath));
  if (livingScopes.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["none of the expected DOS producer directories present at repoRoot"],
    };
  }

  const violations: FileFinding[] = [];
  let producersScanned = 0;
  let producersWithGate = 0;
  let producersWithoutGate = 0;
  let producersExempt = 0;

  for (const scope of livingScopes) {
    const files = listSaveStudioFiles(scope.absPath);
    for (const file of files) {
      let content: string;
      try {
        content = readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      // Only producers that actually queue are subject to R-DLQ-6.
      if (!fileIsProducer(content)) continue;
      producersScanned++;

      const trigger = fileNeedsGate(content, scope.activeSurface);
      if (!trigger.needs) {
        // No tenant-anchored field — exempt by D-2026-05-05-3 surgical scope.
        producersExempt++;
        continue;
      }

      if (fileHasGateImport(content)) {
        producersWithGate++;
        continue;
      }
      producersWithoutGate++;
      violations.push({
        file: relative(repoRoot, file),
        reason: `references ${trigger.matchedToken} but does not import crossTenantGate or isDosTenantPath`,
      });
    }
  }

  if (violations.length > 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${violations.length} producer file(s) read tenant-anchored fields without gating:`,
        ...violations.slice(0, 10).map((v) => `  ${v.file} — ${v.reason}`),
        ...(violations.length > 10 ? [`  (+${violations.length - 10} more)`] : []),
        `Fix: add \`import { crossTenantGate } from '../../../Lib/dlq';\` and call \`crossTenantGate({...})\` before queueOrPost.`,
        `See PRD MEMORY/WORK/20260505-154846_f3-cross-tenant-producer-guard/PRD.md and RFC-0062 §9.`,
      ],
    };
  }

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `scanned ${producersScanned} producer file(s) across ${livingScopes.length} scope(s)`,
      `${producersWithGate} gate-imported producers; ${producersExempt} producers exempt (no path field)`,
    ],
  };
}
