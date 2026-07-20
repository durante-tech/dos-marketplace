/**
 * R64 (RFC-0098 §13.6) — Every canonical predicate in PREDICATES.md should
 * appear in the live KG at least once, OR be marked `[deprecated]` in
 * PREDICATES.md.
 *
 * Background: complementary to R19 (`presence.predicate-vocab-parity`) which
 * checks the inverse direction (live-KG ⊆ canonical-or-alias). R64 catches
 * canonical predicates that have been authored but never used — typically a
 * sign of (a) drift between doctrine and runtime, (b) renamed predicate where
 * the old canonical was not deprecated, or (c) speculative authoring without
 * implementation. Warning-tier surfacer; no hard fail.
 *
 * Pass: every canonical predicate has ≥1 occurrence in triples table OR is
 * marked `[deprecated]` in PREDICATES.md OR is inside the 30-day adoption window.
 * Fail: canonical predicate has zero occurrences AND not deprecated AND outside
 * the 30-day adoption window (post-A8) — OR a legacy row with no `introduced_at`
 * entry (preserves pre-A8 behavior; fail-as-before).
 * Not_applicable: PREDICATES.md missing OR KG sqlite3 missing.
 *
 * A8 adoption-window enhancement (2026-05-25, RFC-0098 §15.1 SPEC-BS-4):
 * Each canonical predicate carries an `introduced_at` ISO-8601 date via the
 * §1.10 register in PREDICATES.md (per-row bullet) OR via a pre-A8 collective
 * backfill marker (`pre_window_backfill_date: YYYY-MM-DD`). Predicates younger
 * than `ADOPTION_WINDOW_DAYS` AND unused are emitted as *warnings* in the
 * evidence list (no fail-tier escalation), absorbing early-life churn. The
 * §Glossary definition of `introduced_at` lives in
 * `MEMORY/CANONICAL/upcaster-contract.md` §Glossary (Evans Round 3 AMEND).
 *
 * Tier: warning per RFC-0085 council default. Note: this is a SURFACER rule —
 * its "fail" indicates predicates worth reviewing, not necessarily a doctrine
 * violation.
 *
 * Test seam: `ctx.nowMs` overrides Date.now() for deterministic age tests
 * (same pattern as R18/R30/R38).
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every canonical predicate in PREDICATES.md has ≥1 occurrence in the live KG, OR is marked [deprecated], OR is inside the 30-day adoption window (post-A8)";

/** A8: adoption window length in days. RFC-0098 §15.1 SPEC-BS-4 Cato disposition. */
export const ADOPTION_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function resolveKgPath(): string | null {
  const home = homedir();
  const candidates = [
    join(home, ".claude", "MEMORY", "MEMPALACE", "knowledge_graph.sqlite3"),
    join(home, ".claude", "MEMORY", "MEMPALACE", "knowledge_graph.db"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function resolvePredicatesPath(ctx: CheckContext): string | null {
  const home = homedir();
  const candidates = [
    join(ctx.repoRoot, "Packs", "mem-palace", "PREDICATES.md"),
    join(ctx.repoRoot, "Packs", "mem-palace", "src", "PREDICATES.md"),
    join(home, ".claude", "skills", "mem-palace", "PREDICATES.md"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

interface CanonicalEntry {
  predicate: string;
  deprecated: boolean;
  /** ISO-8601 calendar date the predicate was authored into PREDICATES.md.
   *  Resolved from §1.10 register (per-row bullet first; pre-window backfill
   *  fallback). Null when no register entry exists at all (legacy row).
   */
  introducedAt: string | null;
}

/** Parse §1.10 register: pre-window backfill + per-row bullets.
 *  Returns (preWindowDate, perRowDates).
 */
export function parseIntroducedAtRegister(content: string): {
  preWindowDate: string | null;
  perRow: Map<string, string>;
} {
  const perRow = new Map<string, string>();
  let preWindowDate: string | null = null;

  // Pre-window backfill: `pre_window_backfill_date: YYYY-MM-DD`
  const backfillRe = /pre_window_backfill_date:\s*(\d{4}-\d{2}-\d{2})/;
  const backfillMatch = content.match(backfillRe);
  if (backfillMatch) preWindowDate = backfillMatch[1];

  // Per-row bullets: `- `predicate_name`: YYYY-MM-DD`
  const bulletRe = /^-\s*`([a-z_][a-z0-9_]*)`\s*:\s*(\d{4}-\d{2}-\d{2})/gm;
  let m: RegExpExecArray | null;
  while ((m = bulletRe.exec(content)) !== null) {
    perRow.set(m[1], m[2]);
  }
  return { preWindowDate, perRow };
}

export function parseCanonicalPredicates(content: string): CanonicalEntry[] {
  const { preWindowDate, perRow } = parseIntroducedAtRegister(content);
  const out: CanonicalEntry[] = [];
  // Match table rows: `| `predicate_name` | meaning | aliases |`
  const lineRe = /^\|\s*`([a-z_][a-z0-9_]*)`\s*\|([^|]*)\|/gm;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(content)) !== null) {
    const predicate = m[1];
    const meaning = m[2];
    const deprecated = /\[deprecated\]/i.test(meaning);
    // Skip duplicates (parser tolerance for stray rows; first wins)
    if (out.some((e) => e.predicate === predicate)) continue;
    // Resolve introduced_at: per-row bullet wins; pre-window backfill is fallback;
    // null means no register entry whatsoever (legacy row → fail-as-before).
    const explicit = perRow.get(predicate);
    const introducedAt = explicit ?? preWindowDate ?? null;
    out.push({ predicate, deprecated, introducedAt });
  }
  return out;
}

/** Compute age in whole days; null when introducedAt is missing or unparseable.
 *  Floors fractional days to integer (28.9 days → 28, not 29) — boundary
 *  test cases (exactly 30 days) land on the fail side, as documented.
 */
export function ageInDays(introducedAt: string | null, nowMs: number): number | null {
  if (!introducedAt) return null;
  const ts = Date.parse(introducedAt + "T00:00:00Z");
  if (Number.isNaN(ts)) return null;
  return Math.floor((nowMs - ts) / MS_PER_DAY);
}

export async function r64PredicateCanonical(ctx: CheckContext): Promise<CheckResult> {
  const kgPath = resolveKgPath();
  if (!kgPath) {
    return { rId: "R64", requirement: REQUIREMENT, status: "not_applicable", evidence: ["KG sqlite3 not found"] };
  }
  const predicatesPath = resolvePredicatesPath(ctx);
  if (!predicatesPath) {
    return { rId: "R64", requirement: REQUIREMENT, status: "not_applicable", evidence: ["PREDICATES.md not found"] };
  }

  let canonical: CanonicalEntry[];
  try {
    const content = readFileSync(predicatesPath, "utf-8");
    canonical = parseCanonicalPredicates(content);
  } catch (e) {
    return { rId: "R64", requirement: REQUIREMENT, status: "not_applicable", evidence: [`could not parse PREDICATES.md: ${(e as Error).message}`] };
  }
  if (canonical.length === 0) {
    return { rId: "R64", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no canonical predicates parsed from PREDICATES.md"] };
  }

  let db: Database;
  try { db = new Database(kgPath, { readonly: true }); }
  catch (e) {
    return { rId: "R64", requirement: REQUIREMENT, status: "not_applicable", evidence: [`could not open KG: ${(e as Error).message}`] };
  }

  let livePredicates: Set<string>;
  try {
    const rows = db.query("SELECT DISTINCT predicate FROM triples").all() as { predicate: string }[];
    livePredicates = new Set(rows.map((r) => r.predicate));
  } catch (e) {
    db.close();
    return { rId: "R64", requirement: REQUIREMENT, status: "not_applicable", evidence: [`could not query triples table: ${(e as Error).message}`] };
  }
  db.close();

  const nowMs = ctx.nowMs ?? Date.now();
  const unusedHardFail: string[] = []; // legacy (no register entry) OR ≥30 days
  const unusedInWindow: string[] = []; // <30 days; A8 absorbs as warning-only
  let usedOrDeprecated = 0;
  for (const entry of canonical) {
    if (entry.deprecated) {
      usedOrDeprecated++;
      continue;
    }
    if (livePredicates.has(entry.predicate)) {
      usedOrDeprecated++;
      continue;
    }
    // Unused + not deprecated → consult adoption window
    const age = ageInDays(entry.introducedAt, nowMs);
    if (age === null) {
      // Legacy row: no register entry at all → fail-as-before (backward compat)
      unusedHardFail.push(entry.predicate);
    } else if (age < ADOPTION_WINDOW_DAYS) {
      // A8 adoption window: warn-not-fail
      unusedInWindow.push(entry.predicate);
    } else {
      // Outside window + unused: hard fail (existing behavior, correctly scoped)
      unusedHardFail.push(entry.predicate);
    }
  }

  if (unusedHardFail.length === 0) {
    const evidence = [
      `${usedOrDeprecated}/${canonical.length} canonical predicates either used in KG or marked deprecated`,
    ];
    if (unusedInWindow.length > 0) {
      evidence.push(
        `${unusedInWindow.length} unused predicates inside ${ADOPTION_WINDOW_DAYS}-day adoption window (warn-not-fail per A8):`,
        ...unusedInWindow.slice(0, 5).map((p) => `  - ${p}`),
      );
    }
    return {
      rId: "R64",
      requirement: REQUIREMENT,
      status: "pass",
      evidence,
    };
  }
  const evidence: string[] = [
    `${unusedHardFail.length}/${canonical.length} canonical predicates have zero KG occurrences, are not deprecated, and are outside the ${ADOPTION_WINDOW_DAYS}-day adoption window:`,
    ...unusedHardFail.slice(0, 10).map((p) => `  - ${p}`),
  ];
  if (unusedInWindow.length > 0) {
    evidence.push(
      `Additionally, ${unusedInWindow.length} predicates are unused but inside the adoption window (not counted as failures):`,
      ...unusedInWindow.slice(0, 3).map((p) => `  - ${p}`),
    );
  }
  return {
    rId: "R64",
    requirement: REQUIREMENT,
    status: "fail",
    evidence,
  };
}
