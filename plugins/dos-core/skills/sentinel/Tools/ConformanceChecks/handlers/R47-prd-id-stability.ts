/**
 * R47 (V13.4 — RFC-0085 §2 deferred replacement) — ID-stability invariant
 * via git-history monotonicity scan.
 *
 * Background: RFC-0085 §2 deferred R47 to v0.0.13 after the 4-voice council
 * rejected the 50%-gap heuristic (Feathers: wrong invariant — monotonicity
 * is the right one; Fowler: lower-cost write-time enforcement; Cockburn:
 * methodology-weight too heavy; KentBeck: Clam-level mechanism, defer until
 * renumber-in-the-wild incident). V13.4 ships the monotonicity invariant:
 * no ISC-N present in the parent commit may be absent and unstruck in HEAD.
 *
 * Applicability: PRD frontmatter has `format_version: 3` AND git is
 * available AND the PRD has ≥1 ancestor commit. Strikethrough form
 * (`~~ISC-N~~`) records intentional removal and exempts the ID.
 *
 * Pass condition: every ISC-N from the parent commit is either still
 * present (checked or unchecked) OR explicitly struckthrough in HEAD.
 *
 * Fail condition: ≥1 ISC-N present in parent is absent-and-unstruck in HEAD.
 *
 * not_applicable conditions: git unavailable, no ancestor commits, no
 * vNext PRDs in repo, repo not a git working tree.
 */

import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { CheckContext, CheckResult } from "../types.ts";
import { isPreCutoffISO } from "../lib/grandfather.ts";

const REQUIREMENT =
  "vNext PRDs: every `ISC-N` present in a parent commit must be present-or-struckthrough in HEAD per RFC-0085 R47 monotonicity invariant";
const RULE_CUTOFF_ISO = "2026-05-13";

/** Recursively collect PRD.md files under a root (used for the nested ARCHIVE tree). */
function walkPrdMd(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  let entries: string[];
  try { entries = readdirSync(root); } catch { return out; }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(root, entry);
    let st: ReturnType<typeof statSync>;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) out.push(...walkPrdMd(full));
    else if (entry === "PRD.md") out.push(full);
  }
  return out;
}

function listPrdPaths(repoRoot: string): string[] {
  const out: string[] = [];
  // MEMORY/WORK (active/archived/flat) — gitignored, so per-PRD `git log`
  // returns <2 commits and these are skipped; retained only for the rare
  // operator-local tree where WORK is exceptionally tracked.
  const workDir = join(repoRoot, "MEMORY", "WORK");
  if (existsSync(workDir)) {
    for (const layer of ["active", "archived", ""]) {
      const base = layer ? join(workDir, layer) : workDir;
      if (!existsSync(base)) continue;
      try {
        for (const dir of readdirSync(base)) {
          const prd = join(base, dir, "PRD.md");
          try { if (statSync(prd).isFile()) out.push(prd); } catch {}
        }
      } catch {}
    }
  }
  // MEMORY/ARCHIVE — git-TRACKED canonical PRDs ({YYYY-MM}/{slug}/PRD.md). These
  // carry real history, so the monotonicity scan is actually REACHABLE here. The
  // WORK-only scan was structurally dead (gitignored → no ancestor commit →
  // every PRD skipped → not_applicable forever) — SENT-10.
  out.push(...walkPrdMd(join(repoRoot, "MEMORY", "ARCHIVE")));
  return out;
}

function readField(fmBody: string, field: string): string | undefined {
  const m = fmBody.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return m?.[1]?.trim().replace(/^["']|["']$/g, "");
}

// Canonical file-redirected child stdio (2026-05-21 pattern, as in R6): piped
// spawnSync capture races the child's exit flush under bun:test — git probes
// returned EMPTY stdout inside the runner, degrading every verdict to
// not_applicable (the quirk formerly documented in this rule's test header).
async function git(repoRoot: string, args: string[]): Promise<{ status: number; stdout: string }> {
  const ioDir = mkdtempSync(join(tmpdir(), "r47-io-"));
  try {
    const proc = Bun.spawn(["git", "-C", repoRoot, ...args], {
      stdout: Bun.file(join(ioDir, "out")),
      stderr: "ignore",
    });
    const status = await proc.exited;
    return { status, stdout: readFileSync(join(ioDir, "out"), "utf8") };
  } finally {
    // Code-review 2026-07-07: the ARCHIVE walk spawns git per PRD (~230/run);
    // without cleanup each run leaked ~230 tmpdirs unboundedly.
    try { rmSync(ioDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

async function gitAvailable(repoRoot: string): Promise<boolean> {
  const r = await git(repoRoot, ["rev-parse", "--is-inside-work-tree"]);
  return r.status === 0 && r.stdout.trim() === "true";
}

async function getParentBlob(repoRoot: string, prdPath: string): Promise<string | null> {
  // Find the second-most-recent commit touching the file (parent of HEAD-for-this-file).
  const log = await git(repoRoot, ["log", "--format=%H", "-n", "2", "--", prdPath]);
  if (log.status !== 0) return null;
  const commits = log.stdout.trim().split("\n").filter(Boolean);
  if (commits.length < 2) return null;
  const parent = commits[1];
  // Get the blob at the parent commit.
  const relPath = prdPath.startsWith(repoRoot + "/") ? prdPath.slice(repoRoot.length + 1) : prdPath;
  const show = await git(repoRoot, ["show", `${parent}:${relPath}`]);
  if (show.status !== 0) return null;
  return show.stdout;
}

function extractIscIds(content: string): { all: Set<string>; struck: Set<string> } {
  const all = new Set<string>();
  const struck = new Set<string>();
  // "present" IDs live inside ## Criteria as `- [ ] ISC-N` / `- [x] ISC-N`.
  const critMatch = content.match(/## Criteria\n([\s\S]*?)(?=\n## |\n---|$)/);
  if (critMatch) {
    for (const line of critMatch[1].split("\n")) {
      const present = line.match(/^- \[[ x]\]\s+(ISC-[A-Z]?-?\d+(?:\.\d+)?)/);
      if (present) all.add(present[1]);
    }
  }
  // "struck" IDs (intentional-removal tombstones) can appear anywhere in the
  // document — e.g. inside ## Decisions narrating the supersession.
  for (const m of content.matchAll(/~~\s*(ISC-[A-Z]?-?\d+(?:\.\d+)?)\s*~~/g)) {
    struck.add(m[1]);
  }
  return { all, struck };
}

export const R47_prd_id_stability: CheckHandler = async (ctx) => {
  if (!(await gitAvailable(ctx.repoRoot))) {
    return { rId: "R47", requirement: REQUIREMENT, status: "not_applicable", evidence: ["git not available — monotonicity scan skipped"] };
  }

  const prds = listPrdPaths(ctx.repoRoot);
  if (prds.length === 0) {
    return { rId: "R47", requirement: REQUIREMENT, status: "not_applicable", evidence: ["no MEMORY/WORK or MEMORY/ARCHIVE PRDs found"] };
  }

  const fails: string[] = [];
  let applicable = 0;

  for (const prdPath of prds) {
    let content: string;
    try { content = readFileSync(prdPath, "utf-8"); } catch { continue; }
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const fm = fmMatch[1];
    if (readField(fm, "format_version") !== "3") continue;
    const started = readField(fm, "started");
    if (isPreCutoffISO(started, RULE_CUTOFF_ISO)) continue;

    const parentContent = await getParentBlob(ctx.repoRoot, prdPath);
    if (parentContent === null) continue; // no ancestor — first commit of file

    applicable++;
    const parentIds = extractIscIds(parentContent).all;
    const head = extractIscIds(content);
    const headPresentOrStruck = new Set([...head.all, ...head.struck]);

    const missing: string[] = [];
    for (const id of parentIds) {
      if (!headPresentOrStruck.has(id)) missing.push(id);
    }
    if (missing.length > 0) {
      fails.push(`${prdPath}: ${missing.length} ISC-N from parent commit absent-and-unstruck in HEAD: ${missing.slice(0, 3).join(", ")}`);
    }
  }

  if (applicable === 0) {
    return { rId: "R47", requirement: REQUIREMENT, status: "not_applicable", evidence: [`scanned ${prds.length} PRDs; none are vNext with ancestor commits yet`] };
  }
  if (fails.length === 0) {
    return { rId: "R47", requirement: REQUIREMENT, status: "pass", evidence: [`${applicable} applicable vNext PRDs — ID monotonicity preserved across parent commits`] };
  }
  return {
    rId: "R47",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length} PRDs with ID-stability violations:`, ...fails.slice(0, 5)],
  };
};

type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;
