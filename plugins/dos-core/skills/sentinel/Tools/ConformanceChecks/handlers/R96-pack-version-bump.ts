/**
 * R96 — lint.pack-version-bump (seventh `lint.*` rule).
 *
 * The 2026-07-02 maturity audit: 39/50 pack versions sit at 1.0.0 —
 * "stamped once", not re-versioned — so extension.yaml `version` carries no
 * lifecycle signal. This rule flags packs whose `src/` content changed in
 * the recent history window while the manifest `version:` line did not
 * change in the same window.
 *
 * Detection (git history, pure f(HEAD..HEAD~N)): for each pack with commits
 * touching `Packs/<Pack>/src/` in the last WINDOW commits, check whether any
 * of those commits also modified the `version:` line of its extension.yaml
 * (via `git log -G"^version:" -- <manifest>`). Content-change without a
 * version-line change in-window → flagged.
 *
 * Honest limits (v1): commit-window heuristic, not a per-release semantic
 * diff — a pack touched twice with one bump still passes; docs-only src
 * changes still count as "content". Opt-out: `lint.pack-version-bump: ok
 * <reason>` anywhere in the pack's extension.yaml.
 *
 * Warn-only ship (lint.* advisory precedent): ALWAYS `status: "pass"`;
 * violations in evidence. Promote only after the versioning convention is
 * operator-ratified (it changes contributor workflow).
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "lint.pack-version-bump: a pack whose src/ changed recently should bump extension.yaml version in the same window";

const R_ID = "R96";
const WINDOW = 50; // commits

const ALLOW_RE = /lint\.pack-version-bump:\s*ok/i;

function gitLines(repoRoot: string, args: string[]): string[] {
  const r = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8", timeout: 30_000 });
  if (r.status !== 0 || typeof r.stdout !== "string") return [];
  return r.stdout.split("\n").filter(Boolean);
}

export async function r96PackVersionBump(ctx: CheckContext): Promise<CheckResult> {
  const packsDir = join(ctx.repoRoot, "Packs");
  if (!existsSync(packsDir)) {
    return { rId: R_ID, requirement: REQUIREMENT, status: "not_applicable", evidence: ["no Packs/ directory"] };
  }

  // Packs whose src/ changed within the window (one git call, not fifty).
  const changed = new Set<string>();
  for (const f of gitLines(ctx.repoRoot, ["log", `-${WINDOW}`, "--name-only", "--pretty=format:", "--", "Packs/*/src"])) {
    const m = f.match(/^Packs\/([^/]+)\/src\//);
    if (m) changed.add(m[1]);
  }
  if (changed.size === 0) {
    return { rId: R_ID, requirement: REQUIREMENT, status: "pass", evidence: [`no pack src/ changes in last ${WINDOW} commits`] };
  }

  const violations: string[] = [];
  for (const pack of [...changed].sort()) {
    const manifest = join(packsDir, pack, "src", "extension.yaml");
    if (!existsSync(manifest)) continue;
    let src = "";
    try {
      src = readFileSync(manifest, "utf8");
    } catch {
      continue;
    }
    if (ALLOW_RE.test(src)) continue;
    const bumps = gitLines(ctx.repoRoot, [
      "log", `-${WINDOW}`, "--pretty=format:%H", `-G^version:`, "--", `Packs/${pack}/src/extension.yaml`,
    ]);
    if (bumps.length === 0) {
      const ver = src.match(/^version:\s*(.+)$/m)?.[1]?.trim() ?? "?";
      violations.push(`Packs/${pack} — src/ changed in last ${WINDOW} commits, version stuck at ${ver}`);
    }
  }

  const summary =
    violations.length === 0
      ? `lint.pack-version-bump: ${changed.size} pack(s) changed in window, all bumped or opted out`
      : `lint.pack-version-bump (WARN-ONLY): ${violations.length} of ${changed.size} recently-changed pack(s) without a version bump in the same ${WINDOW}-commit window`;

  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [summary, ...violations.slice(0, 25), ...(violations.length > 25 ? [`(... +${violations.length - 25} more)`] : [])],
  };
}

export const __testing__ = { ALLOW_RE };
