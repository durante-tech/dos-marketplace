/**
 * R71 — PRDs in a terminal phase MUST have all ISCs checked (X == Y AND body
 * `[x]` count == X). Closes the silent-verification-debt loophole that the
 * 2026-05-18 framework audit identified: 69 PRDs (639 unchecked ISCs) had been
 * closed despite incomplete ISC verification, undetected by existing R-rules.
 *
 * Differs from R65 (which validates denominator == body ISC-line count) by
 * ALSO validating that the numerator X equals the body `[x]` count — closing
 * the gap where an operator could stamp `progress: 10/10` on a body with zero
 * `[x]` boxes and pass R65.
 *
 * Differs from R17 (which validates frontmatter field presence) by ALSO
 * recursing into MEMORY/WORK/active/ and MEMORY/WORK/archived/ subdirectories
 * (R17 only scans direct children of MEMORY/WORK/, missing vNext-split layout).
 *
 * Terminal-set sourced from Packs/prd/src/lifecycle/terminal-phases.json
 * (R-FW-6 canonical file). Excludes `superseded` and `retired` — those take
 * the `closure_reason:` exemption path (R-FW-2 placeholder; this handler
 * recognizes the field but does not require it).
 *
 * Exemption: any PRD with `closure_reason:` ≥ 20 chars in frontmatter is
 * exempt from this rule (still surfaced in evidence as "exempt" rather than
 * "pass" so the operator sees the count).
 *
 * Grandfather: PRDs already flagged in MEMORY/STATE/closure-debt-baseline.json
 * (R-FW-7) are routed to a separate `legacy` advisory bucket and do NOT cause
 * the rule to fail — they're reported as a separate count for backlog
 * drainage. PRDs NOT in the baseline (new silent debt since baseline
 * generation) cause the rule to fail.
 *
 * Tier: warning (default for new presence checks; Phase 2 may promote to block
 * once warning-mode data accrues per Council ratification 2026-05-18).
 *
 * Spec: MEMORY/RESEARCH/2026-05/unchecked-isc-rootcause-framework-audit.md §6
 *       PRD 20260518-030140_ship-rfw-phase1-framework
 */

import { existsSync, readFileSync, readdirSync, statSync, type Stats } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "PRDs in a terminal phase (terminal-phases.json) must have all ISCs checked (X == Y AND body [x] count == X), unless exempt via closure_reason: ≥20 chars";

const HOME = homedir();
// RFC-0136 follow-up: terminal-phases.json IS committed at this repo-relative
// path, so resolve it from the checkout under test FIRST (worktree / fresh
// clone / CI safe); the old `${HOME}/Durante/...` hardcode read the maintainer's
// MAIN checkout from inside a worktree. The homedir path stays as a fallback for
// callers whose repoRoot lacks the file. Resolution in loadTerminalSet(repoRoot).
const TERMINAL_PHASES_REL = "Packs/prd/src/lifecycle/terminal-phases.json";
const TERMINAL_PHASES_FALLBACK = `${HOME}/Durante/${TERMINAL_PHASES_REL}`;
const DEFAULT_TERMINAL_PHASES = ["done", "complete", "learn", "ship", "phase-a-complete"];
// Grandfather baseline is a gitignored MEMORY/STATE runtime artifact — there is
// no committed copy, so it stays homedir-resolved. It only SHRINKS the
// legacy-debt bucket (grandfathers known debt); it never flips a NEW-debt fail,
// so its absence in a worktree/clone cannot change R71's dominant verdict
// (verified worktree-safe, RFC-0136).
const BASELINE_PATH = `${HOME}/.claude/MEMORY/STATE/closure-debt-baseline.json`;

const PROGRESS_RE = /^progress:\s*(\d+)\/(\d+)\s*$/m;
const PHASE_RE = /^phase:\s*([^\s'"]+)/m;
const CLOSURE_REASON_RE = /^closure_reason:\s*(.+)$/m;
const ISC_CHECKED_RE = /^- \[x\] ISC-/;
// R-FW-3 (2026-05-18) — anti-criteria split. Positive ISCs (`ISC-\d`) MUST
// always be checked at terminal phase. Anti-criteria (`ISC-A\d`) MAY be
// left unchecked if the PRD body declares opt-in verification via section
// header `## Anti-Criteria (default-unchecked)`. This recognizes the
// audit-finding Mode D: anti-criteria are systematically under-checked
// because they require explicit evaluation ("must NOT happen" doesn't
// flip automatically). Bulk-checking them at close time is the compliance
// theater Council warned against.
const ISC_POSITIVE_CHECKED_RE = /^- \[x\] ISC-\d/;
const ISC_POSITIVE_TOTAL_RE = /^- \[[ x]\] ISC-\d/;
const ISC_ANTI_CHECKED_RE = /^- \[x\] ISC-A/;
const ISC_ANTI_TOTAL_RE = /^- \[[ x]\] ISC-A/;
const ANTI_DEFAULT_UNCHECKED_RE = /^##\s+Anti-Criteria\s*\(default-unchecked\)\s*$/m;

interface TerminalPhasesFile {
  terminal: string[];
}

interface BaselineFile {
  legacy_prd_paths?: string[];
}

interface PrdParse {
  path: string;
  phase: string | null;
  num: number;
  den: number;
  hasClosureReason: boolean;
  bodyCheckedCount: number;
  // R-FW-3 split-accounting
  positiveChecked: number;
  positiveTotal: number;
  antiChecked: number;
  antiTotal: number;
  antiDefaultUnchecked: boolean;
}

function loadTerminalSet(repoRoot: string): Set<string> {
  // repoRoot-relative (checkout under test) first, then maintainer-homedir
  // fallback, then the hardcoded default. RFC-0136 worktree-safety fix.
  for (const file of [join(repoRoot, TERMINAL_PHASES_REL), TERMINAL_PHASES_FALLBACK]) {
    if (!existsSync(file)) continue;
    try {
      const data = JSON.parse(readFileSync(file, "utf-8")) as TerminalPhasesFile;
      return new Set(data.terminal);
    } catch {
      // malformed candidate — fall through to the next candidate / default
    }
  }
  return new Set(DEFAULT_TERMINAL_PHASES);
}

function loadBaseline(): Set<string> {
  if (!existsSync(BASELINE_PATH)) return new Set();
  try {
    const data = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as BaselineFile;
    return new Set(data.legacy_prd_paths ?? []);
  } catch {
    return new Set();
  }
}

function walkPrds(root: string): string[] {
  const out: string[] = [];
  for (const base of ["MEMORY/WORK", "MEMORY/ARCHIVE"]) {
    const start = join(root, base);
    if (!existsSync(start)) continue;
    const stack = [start];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }
      for (const e of entries) {
        const full = join(dir, e);
        let st: Stats;
        try {
          st = statSync(full);
        } catch {
          continue;
        }
        if (st.isDirectory()) {
          stack.push(full);
        } else if (st.isFile() && e === "PRD.md") {
          out.push(full);
        }
      }
    }
  }
  return out;
}

function parsePrd(path: string): PrdParse | null {
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    return null;
  }
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];

  const phaseMatch = fm.match(PHASE_RE);
  const phase = phaseMatch ? phaseMatch[1].replace(/['"]/g, "") : null;

  const progressMatch = fm.match(PROGRESS_RE);
  const num = progressMatch ? Number(progressMatch[1]) : 0;
  const den = progressMatch ? Number(progressMatch[2]) : 0;

  const crMatch = fm.match(CLOSURE_REASON_RE);
  const hasClosureReason = !!(crMatch && crMatch[1].trim().length >= 20);

  const body = content.slice(fmMatch[0].length);
  let checkedCount = 0;
  let positiveChecked = 0;
  let positiveTotal = 0;
  let antiChecked = 0;
  let antiTotal = 0;
  for (const line of body.split("\n")) {
    if (ISC_ANTI_TOTAL_RE.test(line)) {
      antiTotal++;
      if (ISC_ANTI_CHECKED_RE.test(line)) { antiChecked++; checkedCount++; }
    } else if (ISC_POSITIVE_TOTAL_RE.test(line)) {
      positiveTotal++;
      if (ISC_POSITIVE_CHECKED_RE.test(line)) { positiveChecked++; checkedCount++; }
    } else if (ISC_CHECKED_RE.test(line)) {
      // ISC lines that don't match either positive (\d) or anti (A) — count
      // for backward compat with PRDs whose ISCs don't follow the digit/A
      // convention exactly. Should be rare.
      checkedCount++;
    }
  }
  const antiDefaultUnchecked = ANTI_DEFAULT_UNCHECKED_RE.test(body);

  return {
    path, phase, num, den, hasClosureReason,
    bodyCheckedCount: checkedCount,
    positiveChecked, positiveTotal,
    antiChecked, antiTotal,
    antiDefaultUnchecked,
  };
}

// Phases that are explicitly IN-FLIGHT — when a PRD lives under
// MEMORY/ARCHIVE/cold/... after a cold-decay sweep but its phase is still
// observe/plan/etc., it was archived because of staleness, NOT closed. R71
// must not demand ISC parity in that case.
const IN_FLIGHT_PHASES = new Set([
  "observe", "think", "plan", "build", "execute", "verify",
  "deliver", "discovery", "in-progress",
]);

function isTerminal(p: PrdParse, terminalSet: Set<string>): boolean {
  const archivedPath = p.path.includes("/WORK/archived/") || p.path.includes("/ARCHIVE/");
  if (archivedPath) {
    // Archived path is terminal UNLESS phase is explicitly in-flight
    // (cold-decay case — archived but never closed).
    if (p.phase && IN_FLIGHT_PHASES.has(p.phase)) return false;
    return true;
  }
  if (p.phase && terminalSet.has(p.phase)) return true;
  return false;
}

export async function r71PrdClosureIscParity(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");
  const archiveRoot = join(ctx.repoRoot, "MEMORY", "ARCHIVE");

  if (!existsSync(workRoot) && !existsSync(archiveRoot)) {
    return {
      rId: "R71",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Neither MEMORY/WORK/ nor MEMORY/ARCHIVE/ found under ${ctx.repoRoot}`],
    };
  }

  const terminalSet = loadTerminalSet(ctx.repoRoot);
  const baseline = loadBaseline();

  const allPrds = walkPrds(ctx.repoRoot);
  if (allPrds.length === 0) {
    return {
      rId: "R71",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No PRD.md files found under ${ctx.repoRoot}`],
    };
  }

  const newDebt: string[] = [];
  const legacyDebt: string[] = [];
  const numeratorMismatch: string[] = [];
  let exempt = 0;
  let terminalCount = 0;
  let cleanTerminal = 0;

  for (const path of allPrds) {
    const parsed = parsePrd(path);
    if (!parsed) continue;
    if (!isTerminal(parsed, terminalSet)) continue;
    terminalCount++;

    if (parsed.hasClosureReason) {
      exempt++;
      continue;
    }

    if (parsed.den === 0) {
      // no progress field — out of scope for R71; R17 handles missing progress
      continue;
    }

    const xyOk = parsed.num === parsed.den;
    const bodyOk = parsed.bodyCheckedCount === parsed.num;
    // R-FW-3: positive ISCs MUST be fully checked. Anti ISCs MAY be unchecked
    // if section header declares default-unchecked.
    const positiveOk = parsed.positiveChecked === parsed.positiveTotal;
    const antiOk = parsed.antiDefaultUnchecked
      ? true
      : parsed.antiChecked === parsed.antiTotal;

    if (xyOk && bodyOk && positiveOk && antiOk) {
      cleanTerminal++;
      continue;
    }

    const unchecked = parsed.den - parsed.num;
    const mismatch = Math.abs(parsed.bodyCheckedCount - parsed.num);
    const splitStr = `positive=${parsed.positiveChecked}/${parsed.positiveTotal} anti=${parsed.antiChecked}/${parsed.antiTotal}${parsed.antiDefaultUnchecked ? " (anti default-unchecked)" : ""}`;
    const evidenceLine = `${path}: phase=${parsed.phase ?? "(none)"} progress=${parsed.num}/${parsed.den} unchecked=${unchecked} body_checked=${parsed.bodyCheckedCount} numerator_mismatch=${mismatch} ${splitStr}`;

    if (baseline.has(path)) {
      legacyDebt.push(evidenceLine);
    } else {
      newDebt.push(evidenceLine);
      if (mismatch > 0) numeratorMismatch.push(`${path}: progress.num=${parsed.num} body[x]=${parsed.bodyCheckedCount}`);
    }
  }

  const summary = [
    `terminal_prds=${terminalCount}`,
    `clean_terminal=${cleanTerminal}`,
    `exempt_closure_reason=${exempt}`,
    `legacy_debt=${legacyDebt.length}`,
    `new_silent_debt=${newDebt.length}`,
    `numerator_mismatches=${numeratorMismatch.length}`,
  ];

  if (newDebt.length === 0) {
    return {
      rId: "R71",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `R71: ${summary.join(" ")}`,
        ...(legacyDebt.length > 0 ? [`(${legacyDebt.length} legacy-debt PRDs in advisory bucket — see closure-debt-baseline.json)`] : []),
      ],
    };
  }

  return {
    rId: "R71",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `R71: ${summary.join(" ")}`,
      `New silent-debt PRDs (post-baseline) — operator must close ISCs, write closure_reason:, or re-open:`,
      ...newDebt.slice(0, 15),
      ...(newDebt.length > 15 ? [`(... +${newDebt.length - 15} more)`] : []),
    ],
  };
}
