/**
 * R72 — Promotion-debt advisory. Flags PRDs where `progress: X/X` (all ISCs
 * checked) but `phase` is NOT in the terminal-set AND `age_days >= 7`.
 *
 * Background: the 2026-05-18 framework audit (Mode F) found 31 PRDs across
 * 5 projects with X==Y but stuck-in-flight phase (27 of 31 in `verify`).
 * These are the OPPOSITE of silent debt — work is mechanically done but
 * the operator forgot to promote phase. R72 surfaces them as an advisory
 * so the operator can either promote or re-open with new work.
 *
 * Status: always `pass` (advisory-only, never blocks). Evidence count is
 * the signal. Phase 2 may promote to `warn` if operator finds the count
 * persistent and noisy.
 *
 * Terminal-set sourced from Packs/prd/src/lifecycle/terminal-phases.json
 * (R-FW-6 canonical file). PRDs with phase in `IN_FLIGHT_PHASES` AND
 * `age_days < 7` are silently ignored — too fresh to be debt.
 *
 * Spec: MEMORY/RESEARCH/2026-05/unchecked-isc-rootcause-framework-audit.md §6
 *       PRD 20260518-031400_ship-rfw-phase15-anti-split-promotion
 */

import { existsSync, readFileSync, readdirSync, statSync, type Stats } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Advisory: PRDs with progress X/X but non-terminal phase AND age >= 7 days are surfaced for operator promote-or-reopen decision";

const HOME = homedir();
// RFC-0136 follow-up: resolve the committed terminal-phases.json from the
// checkout under test first (worktree / clone / CI safe); the old
// `${HOME}/Durante/...` hardcode read the maintainer's main checkout from inside
// a worktree. Homedir path is the fallback. Resolution in loadTerminalSet(repoRoot).
const TERMINAL_PHASES_REL = "Packs/prd/src/lifecycle/terminal-phases.json";
const TERMINAL_PHASES_FALLBACK = `${HOME}/Durante/${TERMINAL_PHASES_REL}`;
const DEFAULT_TERMINAL_PHASES = ["done", "complete", "learn", "ship", "phase-a-complete"];
const STALENESS_DAYS = 7;
const SECONDS_PER_DAY = 86400;

const PROGRESS_RE = /^progress:\s*(\d+)\/(\d+)\s*$/m;
const PHASE_RE = /^phase:\s*([^\s'"]+)/m;

interface TerminalPhasesFile { terminal: string[]; }

interface PrdParse { phase: string | null; num: number; den: number; }

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

function walkPrds(root: string): string[] {
  const out: string[] = [];
  for (const base of ["MEMORY/WORK", "MEMORY/ARCHIVE"]) {
    const start = join(root, base);
    if (!existsSync(start)) continue;
    const stack = [start];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      let entries: string[];
      try { entries = readdirSync(dir); } catch { continue; }
      for (const e of entries) {
        const full = join(dir, e);
        let st: Stats;
        try { st = statSync(full); } catch { continue; }
        if (st.isDirectory()) stack.push(full);
        else if (st.isFile() && e === "PRD.md") out.push(full);
      }
    }
  }
  return out;
}

function parsePrd(path: string): PrdParse | null {
  let content: string;
  try { content = readFileSync(path, "utf-8"); } catch { return null; }
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;
  const fm = fmMatch[1];
  const phaseMatch = fm.match(PHASE_RE);
  const phase = phaseMatch ? phaseMatch[1].replace(/['"]/g, "") : null;
  const progressMatch = fm.match(PROGRESS_RE);
  if (!progressMatch) return null;
  return { phase, num: Number(progressMatch[1]), den: Number(progressMatch[2]) };
}

export async function r72PrdPromotionDebtAdvisory(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");
  const archiveRoot = join(ctx.repoRoot, "MEMORY", "ARCHIVE");

  if (!existsSync(workRoot) && !existsSync(archiveRoot)) {
    return {
      rId: "R72",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Neither MEMORY/WORK/ nor MEMORY/ARCHIVE/ found under ${ctx.repoRoot}`],
    };
  }

  const terminalSet = loadTerminalSet(ctx.repoRoot);
  const allPrds = walkPrds(ctx.repoRoot);
  if (allPrds.length === 0) {
    return {
      rId: "R72",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No PRD.md files found under ${ctx.repoRoot}`],
    };
  }

  const now = Date.now() / 1000;
  const promotionDebt: string[] = [];
  let scanned = 0;

  for (const path of allPrds) {
    const parsed = parsePrd(path);
    if (!parsed) continue;
    if (parsed.den === 0) continue;
    if (parsed.num !== parsed.den) continue; // not yet fully checked
    if (parsed.phase && terminalSet.has(parsed.phase)) continue; // already terminal
    scanned++;

    let mtime: number;
    try {
      const st = statSync(path);
      mtime = st.mtimeMs / 1000;
    } catch {
      continue;
    }
    const ageDays = Math.floor((now - mtime) / SECONDS_PER_DAY);
    if (ageDays < STALENESS_DAYS) continue;

    promotionDebt.push(`${path}: phase=${parsed.phase ?? "(none)"} progress=${parsed.num}/${parsed.den} age=${ageDays}d`);
  }

  // Always pass (advisory-only). Evidence count surfaces the signal.
  const summary = `R72 (advisory): full-progress-stuck-in-flight=${promotionDebt.length}/${scanned} candidates (>= ${STALENESS_DAYS} days old)`;
  return {
    rId: "R72",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      summary,
      ...(promotionDebt.length > 0
        ? [`Operator decision needed — promote phase to terminal OR re-open with new ISCs:`, ...promotionDebt.slice(0, 10), ...(promotionDebt.length > 10 ? [`(... +${promotionDebt.length - 10} more)`] : [])]
        : []),
    ],
  };
}
