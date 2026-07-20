/**
 * prd-doctrine.ts — ADAPTER delegating PRD vNext doctrine to `@durante/prd/Doctrine`.
 *
 * Conway's law: the prd pack (`@durante/prd`) owns the PRD format; Sentinel
 * imports it (no cycle). This module DELEGATES the shared constants/functions to
 * `@durante/prd/Doctrine`, fail-soft, so the doctrine SoT lives in ONE place:
 *   1. `@durante/prd/Doctrine` workspace package FIRST — the maintainer repo and
 *      CI resolve it via the workspace symlink, so the conformance handlers run
 *      against the single canonical source.
 *   2. inline LOCAL fallback constants LAST — a fresh customer-installed skill has
 *      no `node_modules`; the `require` throws and the deployed Sentinel degrades
 *      to the local mirror (never crashes a handler — RFC-0112 fail-soft pattern).
 *
 * The mirror cannot silently drift: `prd-doctrine-parity.test.ts` asserts the
 * LOCAL fallback deep-equals `@durante/prd/Doctrine`. "A constant duplicated is a
 * constant that will diverge" (Parnas) — the parity test is the lock that makes
 * the fallback safe. PRDLint drifted precisely because the floor table and
 * required-field set lived in >=4 unsynced places; here they delegate, and the
 * one remaining copy (the fallback) is test-pinned to the SoT.
 *
 * The 3 effort-tier Sets (STANDARD_PLUS/ADVANCED_PLUS/DEEP_PLUS) stay LOCAL —
 * Sentinel-specific gate sets with no `@durante/prd` equivalent.
 *
 * Consumers (R17/R18/R44/R38/R45/R46/R65 handlers + PRDLint) import the same
 * names from here, so the delegation is transparent — no consumer edits.
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

// ─── LOCAL fallback (parity-locked to @durante/prd/Doctrine by the parity test) ───

const LOCAL_REQUIRED_FIELDS = [
  "task",
  "slug",
  "effort",
  "phase",
  "progress",
  "mode",
  "started",
  "updated",
] as const;

const LOCAL_TIER_FLOORS: Readonly<Record<string, number>> = {
  standard: 8,
  extended: 16,
  advanced: 24,
  deep: 40,
  xhigh: 50,
  comprehensive: 64,
};

const LOCAL_ISC_FLOOR_CUTOFF_MS = new Date("2026-05-05T00:00:00Z").getTime();

const SLUG_TS_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_/;

function localPrdSlugMs(prdPathOrSlug: string): number | null {
  const dir = prdPathOrSlug.includes("/")
    ? prdPathOrSlug.split("/").slice(-2, -1)[0] ?? ""
    : prdPathOrSlug;
  const m = SLUG_TS_RE.exec(dir);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function localIsPreIscFloorCutoff(prdPathOrSlug: string): boolean {
  const ms = localPrdSlugMs(prdPathOrSlug);
  return ms !== null && ms < LOCAL_ISC_FLOOR_CUTOFF_MS;
}

function localCountVNextIscs(body: string): number {
  const ISC_RE = /^\s*-\s*\[[ xX]\]\s*ISC-/gm;
  return (body.match(ISC_RE) ?? []).length;
}

function localListPrdPaths(workRoot: string): string[] {
  if (!existsSync(workRoot)) return [];
  const out: string[] = [];
  for (const layer of ["active", "archived", ""]) {
    const base = layer ? join(workRoot, layer) : workRoot;
    if (!existsSync(base)) continue;
    let entries: string[];
    try {
      entries = readdirSync(base);
    } catch {
      continue;
    }
    for (const dir of entries.sort()) {
      const prd = join(base, dir, "PRD.md");
      try {
        if (statSync(prd).isFile()) out.push(prd);
      } catch {
        // not a PRD dir — skip
      }
    }
  }
  return out;
}

/**
 * @internal — the inline fallback surface, exposed ONLY so
 * `prd-doctrine-parity.test.ts` can assert it deep-equals `@durante/prd/Doctrine`
 * (the drift lock). Not part of the consumer API.
 */
export const _LOCAL_FALLBACK = {
  REQUIRED_FIELDS: LOCAL_REQUIRED_FIELDS,
  TIER_FLOORS: LOCAL_TIER_FLOORS,
  ISC_FLOOR_CUTOFF_MS: LOCAL_ISC_FLOOR_CUTOFF_MS,
  prdSlugMs: localPrdSlugMs,
  isPreIscFloorCutoff: localIsPreIscFloorCutoff,
  countIscLines: localCountVNextIscs,
  listPrdPaths: localListPrdPaths,
} as const;

// ─── fail-soft @durante/prd/Doctrine resolution (RFC-0112 pattern) ───

type Doctrine = typeof import("@durante/prd/Doctrine");

function loadDoctrine(): Partial<Doctrine> {
  try {
    // Workspace package — resolves in the maintainer repo + CI (single source).
    // A fresh customer-installed skill has no node_modules; the require throws
    // and we fall through to the LOCAL mirror below. The try/catch wraps ONLY
    // module resolution — never the gate logic — so a handler degrades to the
    // (parity-locked) local doctrine rather than crashing.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@durante/prd/Doctrine") as Doctrine;
  } catch {
    return {};
  }
}

const D = loadDoctrine();

// ─── Exported surface — delegate the 7 shared symbols, LOCAL mirror as fallback ───

/** vNext PRD frontmatter required base fields (Algorithm §2.2 / RFC-0059 R17). */
export const REQUIRED_FIELDS_VNEXT: readonly string[] = D.REQUIRED_FIELDS ?? LOCAL_REQUIRED_FIELDS;

/** TierConfig ISC floors keyed by vNext effort name (Algorithm §0 TierConfig). */
export const TIER_FLOORS_VNEXT: Readonly<Record<string, number>> = D.TIER_FLOORS ?? LOCAL_TIER_FLOORS;

/** ISC-floor gate cutoff — PRDs scaffolded before this date are exempt (R18). */
export const ISC_FLOOR_CUTOFF_MS: number = D.ISC_FLOOR_CUTOFF_MS ?? LOCAL_ISC_FLOOR_CUTOFF_MS;

/** Parse the leading `YYYYMMDD-HHMMSS_` slug timestamp (ms); null if unparseable. */
export const prdSlugMs: (prdPathOrSlug: string) => number | null = D.prdSlugMs ?? localPrdSlugMs;

/** True when a PRD predates the ISC-floor cutoff (exempt from the count gate). */
export const isPreIscFloorCutoff: (prdPathOrSlug: string) => boolean =
  D.isPreIscFloorCutoff ?? localIsPreIscFloorCutoff;

/** Count ISC criteria as vNext checkbox lines: `- [ ] ISC-N:` / `- [x] ISC-N:`. */
export const countVNextIscs: (body: string) => number = D.countIscLines ?? localCountVNextIscs;

/** Enumerate PRD.md paths under a `MEMORY/WORK` root (active/ + archived/ + flat). */
export const listPrdPaths: (workRoot: string) => string[] = D.listPrdPaths ?? localListPrdPaths;

// ─── Shared GFM checkbox state classes (route the 5 PRD handlers through ONE copy) ───

/**
 * GFM checkbox inner state class — matches an UNCHECKED (` `) or CHECKED (`x`/`X`)
 * box. GitHub-flavored markdown accepts uppercase `[X]`; the doctrine ISC regex
 * (`localCountVNextIscs` above) and R65 already use `[ xX]`. Consumers interpolate
 * this into `new RegExp(\`^- \\[${CHECKBOX_STATE_CLASS}\\] ...\`)` so R45/R46/R49/R70
 * accept the same checkbox forms instead of five drifting inline `[ x]` copies
 * that silently dropped `- [X] ISC-N` completions (SENT-09).
 */
export const CHECKBOX_STATE_CLASS = "[ xX]";

/** GFM CHECKED-checkbox inner state class — `x` or `X` (the completed box; used by R51). */
export const CHECKBOX_CHECKED_CLASS = "[xX]";

// ─── Sentinel-only effort-tier gate sets (no @durante/prd equivalent — kept local) ───

/** Effort tiers at Standard and above — the "standard+" gate set. */
export const STANDARD_PLUS_EFFORT: ReadonlySet<string> = new Set([
  "standard",
  "extended",
  "advanced",
  "deep",
  "xhigh",
  "comprehensive",
]);

/** Effort tiers at Advanced and above — the E3+ gate set (test-coverage, council). */
export const ADVANCED_PLUS_EFFORT: ReadonlySet<string> = new Set([
  "advanced",
  "deep",
  "xhigh",
  "comprehensive",
]);

/** Effort tiers at Deep and above — the memory-health PRD-section gate (R38). */
export const DEEP_PLUS_EFFORT: ReadonlySet<string> = new Set([
  "deep",
  "advanced",
  "xhigh",
  "comprehensive",
]);
