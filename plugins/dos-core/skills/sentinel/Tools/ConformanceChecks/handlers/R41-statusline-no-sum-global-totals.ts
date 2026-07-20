/**
 * R41 — Statusline must not sum palace_total_drawers across cache files.
 *
 * Background: 2026-05-09 incident. The V11 status bar memory segment
 * (statusline/segments/memory.ts) summed palace_total_drawers across all
 * palace-cache-{wing}.sh files when slug was null. But palace_total_drawers
 * is a GLOBAL palace count snapshot — the SAME value in every cache file —
 * so the SUM produced N × global-total. With 12 cache files at 1786 drawers
 * each, the bar rendered Drwr:21432 instead of Drwr:1786.
 *
 * Convention: code that scans `palace-cache-*.sh` files MUST NOT add
 * palace_total_drawers values across files. To get the global total, read
 * one file's palace_total_drawers (any single file carries the snapshot).
 * To compute a real per-wing sum, sum palace_wing_drawers (the per-wing
 * field, which IS sum-able across mutually-exclusive wings).
 *
 * Detection (regex-grade — AST is overkill for this one-line anti-pattern):
 *   any source file under `statusline/` or `segments/` that contains both
 *   1. a regex literal matching `palace_total_drawers=`
 *   2. a `+=` or `+` operator combining the parsed value within a loop
 *   over `palace-cache` files
 *
 *   Heuristic: file matches BOTH `palace_total_drawers` AND
 *   (`+= parseInt` OR `sum +=`) within 8 lines of each other.
 *
 * Pass: no statusline source file mixes `palace_total_drawers` reads
 * with summation in the same 8-line window.
 * Fail: at least one file does.
 * Not_applicable: no statusline directory found (non-DOS install).
 *
 * Exempt pragma: `// conformance:R41-exempt <reason>` on the offending line.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "statusline/segments/* must not SUM palace_total_drawers across palace-cache-{wing}.sh files (global-total field is per-file snapshot, not sum-able)";
const EXEMPT_PRAGMA = /conformance:R41-exempt/;

function walkTs(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      out.push(...walkTs(p));
    } else if (st.isFile() && (name.endsWith(".ts") || name.endsWith(".tsx"))) {
      out.push(p);
    }
  }
  return out;
}

function flagSumOverGlobalTotal(content: string): { line: number; window: string }[] {
  const lines = content.split("\n");
  const offenders: { line: number; window: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.includes("palace_total_drawers")) continue;
    if (EXEMPT_PRAGMA.test(lines[i]!)) continue;
    // Look in the 8-line window after this line for a sum-shape op.
    const windowEnd = Math.min(lines.length, i + 9);
    let foundSum = false;
    for (let j = i; j < windowEnd; j++) {
      const ln = lines[j]!;
      if (EXEMPT_PRAGMA.test(ln)) continue;
      // Heuristic patterns:
      //   sum += ... palace_total_drawers
      //   sum += parseInt(...palace_total_drawers...)
      //   total += ... palace_total_drawers
      if (/\+=\s/.test(ln) && /\b(sum|total|count|drawers|drwr)\b/i.test(ln)) {
        foundSum = true;
        break;
      }
    }
    if (foundSum) {
      offenders.push({
        line: i + 1,
        window: lines.slice(i, Math.min(lines.length, i + 4)).join("\n"),
      });
    }
  }
  return offenders;
}

export async function r41StatuslineNoSumGlobalTotals(ctx: CheckContext): Promise<CheckResult> {
  // Inspect the live statusline tree (deployed) — it is the runtime authority.
  const home = homedir();
  const statuslineRoots = [
    join(home, ".claude", "statusline"),
    join(ctx.repoRoot, "statusline"),
  ];
  const filesToScan: string[] = [];
  for (const root of statuslineRoots) {
    if (existsSync(root)) filesToScan.push(...walkTs(root));
  }

  if (filesToScan.length === 0) {
    return {
      rId: "R41",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no statusline/ source tree found — non-DOS install`],
    };
  }

  const evidence: string[] = [];
  for (const path of filesToScan) {
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch {
      continue;
    }
    if (!content.includes("palace_total_drawers")) continue;
    const offenders = flagSumOverGlobalTotal(content);
    for (const o of offenders) {
      evidence.push(
        `${path}:${o.line}  SUM-over-palace_total_drawers anti-pattern (use one file's value, or sum palace_wing_drawers instead)`,
      );
    }
  }

  if (evidence.length === 0) {
    return {
      rId: "R41",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `${filesToScan.length} statusline TS file(s) scanned — no SUM-over-palace_total_drawers anti-patterns found`,
      ],
    };
  }

  return {
    rId: "R41",
    requirement: REQUIREMENT,
    status: "fail",
    evidence,
  };
}
