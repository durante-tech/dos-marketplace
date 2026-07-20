/**
 * R19 — Frozen release invariant: tracked files in Releases/v0.0.X/.claude/
 * (plain-tree frozen releases, NOT the active submodule) must not have drifted
 * from the parent repository's committed HEAD state.
 *
 * Incident context (2026-05-04): a too-broad find-replace modified 24 files in
 * Releases/v0.0.3/.claude/ (v0.0.6 → v0.0.1 substitution across frozen
 * content). The drift was committed and subsequently reverted in 1af5c5dd.
 * This check prevents recurrence by detecting any deviation between on-disk
 * frozen release content and `git diff HEAD`.
 *
 * Logic:
 *   1. Parse .gitmodules to identify the ACTIVE submodule path (currently
 *      Releases/v0.0.6/.claude). Active path is SKIPPED — legitimate edits
 *      land there and are expected to be uncommitted during development.
 *   2. Scan Releases/ for version directories matching /^v\d+\.\d+\.\d+$/.
 *      Any directory whose Releases/v0.0.X/.claude path is NOT listed in
 *      .gitmodules is a frozen plain-tree release.
 *   3. For each frozen release, run `git -C <repoRoot> diff HEAD --name-only
 *      -- <repoRelativePath>`. Non-empty output = drift.
 *
 * Failure modes:
 *   - .gitmodules missing → not_applicable
 *   - Releases/ directory missing → not_applicable
 *   - No frozen releases found → not_applicable
 *   - Any frozen release has files differing from HEAD → fail
 *
 * Test seams (via CheckContext):
 *   - ctx.gitmodulesPath: override .gitmodules location (default: <repoRoot>/.gitmodules)
 *   - ctx.checkReleaseDriftFn: inject custom drift detector — avoids git dependency
 *     in unit tests by returning a controlled list of drifted file paths.
 *
 * Why R-class: frozen releases are canonical version snapshots used as reference
 * material and diffing baselines. Silent drift (even accidental) corrupts their
 * historical integrity and caused the 2026-05-04 audit incident.
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Frozen Releases/v0.0.X/.claude/ plain-tree content must match parent repo HEAD (no uncommitted drift from committed state)";

/** Parse .gitmodules content and return the set of all `path = ...` values. */
function parseActiveSubmodulePaths(content: string): Set<string> {
  const paths = new Set<string>();
  for (const match of content.matchAll(/^\s*path\s*=\s*(.+)$/gm)) {
    paths.add(match[1].trim());
  }
  return paths;
}

/**
 * Run `git diff HEAD --name-only -- <repoRelativePath>` and return the list
 * of changed file paths. An empty array means the path is clean.
 *
 * Throws if git exits non-zero (e.g., not a git repo, corrupted index).
 */
function detectDriftViaGit(repoRoot: string, repoRelativePath: string): string[] {
  const result = spawnSync(
    "git",
    ["-C", repoRoot, "diff", "HEAD", "--name-only", "--", repoRelativePath],
    { encoding: "utf-8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `git diff failed for ${repoRelativePath}: ${result.stderr?.trim() ?? "(no stderr)"}`,
    );
  }
  return result.stdout.split("\n").filter(Boolean);
}

export async function r19FrozenReleaseInvariant(ctx: CheckContext): Promise<CheckResult> {
  // --- 1. Locate and parse .gitmodules ---
  const gitmodulesPath = ctx.gitmodulesPath ?? join(ctx.repoRoot, ".gitmodules");

  if (!existsSync(gitmodulesPath)) {
    return {
      rId: "R19",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`.gitmodules not found at ${gitmodulesPath}`],
    };
  }

  let gitmodulesContent: string;
  try {
    gitmodulesContent = readFileSync(gitmodulesPath, "utf-8");
  } catch (err) {
    return {
      rId: "R19",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `Failed to read .gitmodules: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  const activeSubmodulePaths = parseActiveSubmodulePaths(gitmodulesContent);

  // --- 2. Discover frozen release directories ---
  const releasesRoot = join(ctx.repoRoot, "Releases");

  if (!existsSync(releasesRoot)) {
    return {
      rId: "R19",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`Releases/ directory not found under ${ctx.repoRoot}`],
    };
  }

  let entries: string[];
  try {
    entries = readdirSync(releasesRoot);
  } catch (err) {
    return {
      rId: "R19",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `Failed to read Releases/ directory: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  interface FrozenRelease {
    versionName: string;
    claudeAbsPath: string;
    repoRelativePath: string; // relative to repoRoot, e.g. "Releases/v0.0.3/.claude"
  }

  const frozenReleases: FrozenRelease[] = [];

  for (const entry of entries.sort()) {
    // Only consider version directories.
    if (!/^v\d+\.\d+\.\d+$/.test(entry)) continue;

    const claudeRelPath = `Releases/${entry}/.claude`;

    // Skip the active submodule — edits there are legitimate.
    if (activeSubmodulePaths.has(claudeRelPath)) continue;

    const claudeAbsPath = join(releasesRoot, entry, ".claude");
    if (!existsSync(claudeAbsPath)) continue;

    frozenReleases.push({
      versionName: entry,
      claudeAbsPath,
      repoRelativePath: claudeRelPath,
    });
  }

  if (frozenReleases.length === 0) {
    const activeList = [...activeSubmodulePaths].join(", ");
    return {
      rId: "R19",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `No frozen release directories found under Releases/ (active submodule path(s): ${activeList || "none"})`,
      ],
    };
  }

  // --- 3. Check each frozen release for drift ---
  const failEvidence: string[] = [];

  for (const release of frozenReleases) {
    let driftedFiles: string[];

    try {
      if (ctx.checkReleaseDriftFn) {
        driftedFiles = await ctx.checkReleaseDriftFn(
          release.claudeAbsPath,
          release.versionName,
        );
      } else {
        driftedFiles = detectDriftViaGit(ctx.repoRoot, release.repoRelativePath);
      }
    } catch (err) {
      failEvidence.push(
        `${release.versionName}: drift check error — ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    if (driftedFiles.length > 0) {
      const preview = driftedFiles.slice(0, 5).join(", ");
      const overflow =
        driftedFiles.length > 5 ? ` (+${driftedFiles.length - 5} more)` : "";
      failEvidence.push(
        `${release.versionName}: ${driftedFiles.length} file(s) differ from HEAD — ${preview}${overflow}`,
      );
    }
  }

  if (failEvidence.length > 0) {
    return {
      rId: "R19",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: failEvidence,
    };
  }

  const versionList = frozenReleases.map((r) => r.versionName).join(", ");
  return {
    rId: "R19",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${frozenReleases.length} frozen release(s) verified intact: ${versionList}`,
    ],
  };
}
