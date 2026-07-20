/**
 * R65 — Every PRD's frontmatter `progress: N/M` denominator MUST equal the
 * count of `- [ ] ISC-` and `- [x] ISC-` lines in the body (including
 * anti-criteria `- [ ] ISC-A` and `- [x] ISC-A` lines).
 *
 * Background: the 2026-05-15 v0.0.15 PRD-F closure sweep caught 4 ISC-count
 * denominator mismatches across child PRDs because counts were stamped before
 * bodies were enumerated. Algorithm v0.0.10 §6.1.e6 MECHANICAL PRE-READ
 * (added 2026-05-15) prescribes inverting the order — enumerate ISC body
 * lines FIRST, then stamp the denominator. This R-rule audits at scan time
 * so drift can't slip past.
 *
 * Scope:
 *   - Scans MEMORY/WORK/**\/*.md (slug/PRD.md legacy flat layout)
 *   - Scans MEMORY/WORK/active/**\/*.md
 *   - Scans MEMORY/WORK/archived/**\/*.md
 *   - Project-eligible per getMemorySubdir('WORK') three-step resolver;
 *     this handler scans the ctx.repoRoot copy (caller chooses which root).
 *
 * Algorithm:
 *   1. Parse YAML frontmatter; extract `progress` value (regex on the
 *      frontmatter block).
 *   2. Match `progress: N/M` via /^progress:\s*(\d+)\/(\d+)$/m.
 *   3. Count body lines matching /^- \[[ xX]\] ISC-/ (checkbox char
 *      case-insensitive per GFM — accepts [ ], [x], [X]; anchored at
 *      line start).
 *   4. Compare denominator M against body count.
 *
 * Status:
 *   - pass: every scanned PRD with a `progress: N/M` field has denominator
 *     === body ISC-line count.
 *   - fail: at least one PRD has denominator !== body count; evidence
 *     reports `denominator=M body=K` per offending PRD path.
 *   - not_applicable: MEMORY/WORK/ absent, or no PRD has a parseable
 *     `progress:` field. Files lacking frontmatter or progress are skipped
 *     silently (counted toward "scanned but skipped").
 *
 * Tier: warning (RFC-0085 council default for new presence checks).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every PRD's frontmatter `progress: N/M` denominator must equal the count of `- [ ] ISC-` and `- [x] ISC-` lines in the body";

const PROGRESS_RE = /^progress:\s*(\d+)\/(\d+)\s*$/m;
const ISC_LINE_RE = /^- \[[ xX]\] ISC-/;

// R65 ratified 2026-05-15 (Algorithm v0.0.10 §6.1.e6 MECHANICAL PRE-READ
// shipped same day). PRDs scaffolded before this doctrine existed could not
// have followed it; applying the denominator-parity rule retroactively
// penalizes legacy artifacts. Extracted from PRD slug timestamp (YYYYMMDD-
// HHmmss_ prefix); PRDs predating the cutoff are skipped silently — the
// rule's intent (catch forward drift) is preserved.
const R65_CUTOFF_MS = new Date("2026-05-15T00:00:00Z").getTime();
const SLUG_TS_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})_/;

function slugMsFromPath(path: string): number | null {
  // Read the timestamp from the PRD's OWN slug dir (the directory immediately
  // containing the file), NOT the first timestamp anywhere in the path. Under a
  // nested layout like `.../20260101_ancestor/20260601_child/PRD.md` the prior
  // un-anchored first-match picked the ANCESTOR's (pre-cutoff) timestamp and
  // wrongly grandfathered a post-cutoff child PRD (SENT-13).
  const segments = path.split("/");
  const slugDir = segments.length >= 2 ? segments[segments.length - 2]! : "";
  const m = SLUG_TS_RE.exec(slugDir);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function readFrontmatter(content: string): string | null {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : null;
}

function readBody(content: string): string {
  const m = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1] : content;
}

function countIscLines(body: string): number {
  let count = 0;
  for (const line of body.split("\n")) {
    if (ISC_LINE_RE.test(line)) count++;
  }
  return count;
}

/** Walk a directory recursively, collecting `.md` files. Symlinks and errors
 *  are skipped silently to keep the scan robust under operator-local trees. */
function walkMarkdown(root: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(root, entry);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (stat.isFile() && entry.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

export async function r65PrdProgressDenominator(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");

  if (!existsSync(workRoot)) {
    return {
      rId: "R65",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`MEMORY/WORK/ not found under ${ctx.repoRoot}`],
    };
  }

  const candidates = walkMarkdown(workRoot);
  if (candidates.length === 0) {
    return {
      rId: "R65",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No .md files found under ${workRoot}`],
    };
  }

  const fails: string[] = [];
  let scannedWithProgress = 0;

  for (const path of candidates) {
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch {
      continue;
    }

    const fm = readFrontmatter(content);
    if (!fm) continue; // not_applicable for this file — no frontmatter

    const progressMatch = fm.match(PROGRESS_RE);
    if (!progressMatch) continue; // not_applicable — no `progress: N/M` field

    // Legacy exemption: PRDs scaffolded before R65 doctrine (2026-05-15)
    // are out of scope. They could not have followed a discipline that
    // did not yet exist; rule intent (forward drift) is preserved.
    const slugMs = slugMsFromPath(path);
    if (slugMs !== null && slugMs < R65_CUTOFF_MS) continue;

    scannedWithProgress++;
    const denominator = Number(progressMatch[2]);
    const body = readBody(content);
    const bodyCount = countIscLines(body);

    if (denominator !== bodyCount) {
      fails.push(`${path}: denominator=${denominator} body=${bodyCount}`);
    }
  }

  if (scannedWithProgress === 0) {
    return {
      rId: "R65",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`No PRD with parseable \`progress: N/M\` frontmatter found under ${workRoot}`],
    };
  }

  if (fails.length === 0) {
    return {
      rId: "R65",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`${scannedWithProgress} PRD(s) with progress field; all denominators match body ISC-line counts`],
    };
  }

  return {
    rId: "R65",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${scannedWithProgress} PRD(s) denominator mismatch:`, ...fails.slice(0, 10)],
  };
}
