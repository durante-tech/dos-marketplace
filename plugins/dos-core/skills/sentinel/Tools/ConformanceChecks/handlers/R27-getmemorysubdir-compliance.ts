/**
 * R27 — No code hard-codes ~/.claude/MEMORY/{WORK,LEARNING,RESEARCH,ARTIFACTS}
 * paths; all MEMORY path resolution must go through getMemorySubdir().
 *
 * The CLAUDE.md project-level memory resolution contract (getMemorySubdir) is
 * the canonical MEMORY path resolver. Direct hard-coding of MEMORY subdirectory
 * paths bypasses project-first resolution and breaks multi-project operation:
 * a hard-coded `~/.claude/MEMORY/WORK/` always writes to the global location
 * even when a project-specific MEMORY/WORK/ exists.
 *
 * Scans TypeScript and Python source files under ctx.repoRoot (excluding
 * node_modules/, dist/, .git/, __fixtures__/) for forbidden hard-coded patterns.
 *
 * Forbidden patterns (regex):
 *   ~/.claude/MEMORY/WORK        (hard-coded WORK subdir)
 *   ~/.claude/MEMORY/LEARNING    (hard-coded LEARNING subdir)
 *   ~/.claude/MEMORY/RESEARCH    (hard-coded RESEARCH subdir)
 *   ~/.claude/MEMORY/ARTIFACTS   (hard-coded ARTIFACTS subdir)
 *   /.claude/MEMORY/STATE        (hard-coded STATE subdir — global-only but still wrong)
 *
 * Exempt pragma: `// conformance:R27-exempt` on the line with the pattern.
 *
 * Failure modes:
 *   - No source files found → not_applicable
 *   - Any source file contains a forbidden hard-coded path → fail
 *
 * Why R-class: path hard-coding is a data-routing bug. It silently bypasses
 * the three-step project-first resolution chain and cross-contaminates MEMORY/
 * data across projects — breaking the isolation guarantee.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "No source file may hard-code ~/.claude/MEMORY/{WORK,LEARNING,RESEARCH,ARTIFACTS,STATE} paths — use getMemorySubdir()";

/** Subdirectory names whose hard-coded paths are forbidden. */
const FORBIDDEN_SUBDIRS = ["WORK", "LEARNING", "RESEARCH", "ARTIFACTS", "STATE"] as const;

/** Build grep patterns for forbidden hard-coded paths. */
const FORBIDDEN_PATTERNS = FORBIDDEN_SUBDIRS.map(
  (sub) => `\\.claude/MEMORY/${sub}`,
);

const EXCLUDE_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "__fixtures__",
  ".sentinel",
  "Releases",      // frozen snapshots — read-only historical artifacts, not subject to live R27
  "worktrees",     // sibling agent worktrees — transient mirror of repo (under .claude/)
]);
const SOURCE_EXTS = [".ts", ".py"];

/**
 * Collect TypeScript/Python source files under rootDir, honoring the same
 * directory exclusions grep used. In-process (no spawn) so the handler is
 * deterministic under the bun:test child-process env, where spawnSync('grep')
 * returns status 2 / empty output — which previously degraded R27 to a false
 * not_applicable. See sentinel-engine-013.
 */
function collectSourceFiles(rootDir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(rootDir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (EXCLUDE_DIRS.has(name)) continue;
    const full = join(rootDir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (SOURCE_EXTS.some((ext) => name.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan source files for forbidden hard-coded MEMORY-subdir paths. Mirrors the
 * grep semantics it replaces: per-line regex match against each pattern,
 * skipping lines bearing the exempt pragma.
 */
function grepFiles(
  rootDir: string,
  patterns: string[],
): Array<{ file: string; lineNum: number; content: string }> {
  if (!existsSync(rootDir)) return [];

  const results: Array<{ file: string; lineNum: number; content: string }> = [];
  const regexes = patterns.map((p) => new RegExp(p));

  for (const file of collectSourceFiles(rootDir)) {
    let text: string;
    try {
      text = readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const content = lines[i];
      if (!regexes.some((re) => re.test(content))) continue;
      // Skip lines with the exempt pragma
      if (content.includes("conformance:R27-exempt")) continue;
      results.push({ file, lineNum: i + 1, content: content.trim() });
    }
  }

  return results;
}

export async function r27GetmemorysubdirCompliance(ctx: CheckContext): Promise<CheckResult> {
  const scanRoot = ctx.packRoot ?? ctx.repoRoot;

  if (!existsSync(scanRoot)) {
    return {
      rId: "R27",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Scan root not found: ${scanRoot}`],
    };
  }

  const violations = grepFiles(scanRoot, FORBIDDEN_PATTERNS);

  if (violations.length === 0) {
    // Quick check that we actually found some source files to scan
    const tsFiles = collectSourceFiles(scanRoot).filter((f) => f.endsWith(".ts"));
    if (tsFiles.length === 0) {
      return {
        rId: "R27",
        requirement: REQUIREMENT,
        status: "not_applicable",
        evidence: [`No TypeScript or Python source files found under ${scanRoot}`],
      };
    }

    return {
      rId: "R27",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `No hard-coded ~/.claude/MEMORY/... paths found in ${tsFiles.length} source file(s)`,
        `Scanned: ${scanRoot}`,
      ],
    };
  }

  return {
    rId: "R27",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: violations.map(
      (v) => `${v.file}:${v.lineNum}: ${v.content.slice(0, 120)}`,
    ),
  };
}
