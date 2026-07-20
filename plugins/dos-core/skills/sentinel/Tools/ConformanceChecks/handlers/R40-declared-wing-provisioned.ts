/**
 * R40 — Declared wing provisioned in palace cache.
 *
 * Background: 2026-05-09 incident. .dos-projects.json declared 12 projects
 * with wing identifiers, but only 2 wings had palace-cache-{wing}.sh files
 * pre-seeded. cd ~/Experiments/altyaa rendered Drwr:— because the cache
 * file was missing — the V11 status bar segment fell back to the global
 * SUM-bug path that produced Drwr:21432 (12×total) under that condition.
 *
 * Convention: every wing declared in .dos-projects.json should have a
 * palace-cache-{wing}.sh file in ~/.claude/MEMORY/STATE/. The file may
 * carry palace_wing_drawers=0 — the point is that the file EXISTS so
 * the statusline finds it instead of falling through.
 *
 * Pass: every declared wing has a corresponding cache file.
 * Warn (status=fail with permissive evidence): some wings unprovisioned —
 * status bar will dash for those projects until first hook write.
 * Not_applicable: .dos-projects.json absent.
 *
 * Operator-friendly: the fix is mechanical (`touch` the cache file), so
 * the rule reports the gap with the seed command in the evidence.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Every wing declared in .dos-projects.json should have a corresponding palace-cache-{wing}.sh in ~/.claude/MEMORY/STATE/ (otherwise status bar dashes for the project)";

function findCanonicalPath(repoRoot: string): string | null {
  const home = homedir();
  const candidates = [
    join(home, "Durante", "Tools", ".dos-projects.json"),
    join(home, "Durante", ".dos-projects.json"),
    join(repoRoot, "Tools", ".dos-projects.json"),
    join(repoRoot, ".dos-projects.json"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

interface CanonicalProject { id?: string; wing?: string | null; root_path?: string | null }

export async function r40DeclaredWingProvisioned(ctx: CheckContext): Promise<CheckResult> {
  const canonicalJson = findCanonicalPath(ctx.repoRoot);
  if (!canonicalJson) {
    return {
      rId: "R40",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`.dos-projects.json not found — canonical registry not initialized`],
    };
  }

  let projects: CanonicalProject[] = [];
  try {
    const data = JSON.parse(readFileSync(canonicalJson, "utf-8")) as { projects?: CanonicalProject[] };
    projects = data.projects ?? [];
  } catch (err) {
    return {
      rId: "R40",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${canonicalJson} unparseable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  // Skip projects with null wing (e.g., builders-compass placeholder rows)
  const wings = projects
    .filter((p) => p.wing && typeof p.wing === "string" && p.wing.length > 0)
    .map((p) => p.wing as string);

  if (wings.length === 0) {
    return {
      rId: "R40",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`no wings declared in ${canonicalJson}`],
    };
  }

  const stateDir = join(homedir(), ".claude", "MEMORY", "STATE");
  const unprovisioned: string[] = [];
  for (const wing of wings) {
    const cachePath = join(stateDir, `palace-cache-${wing}.sh`);
    if (!existsSync(cachePath)) unprovisioned.push(wing);
  }

  if (unprovisioned.length === 0) {
    return {
      rId: "R40",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`${wings.length} declared wing(s) — all have palace-cache files`],
    };
  }

  const seedHint =
    `Fix: for each unprovisioned wing, write \`palace_wing_drawers=0\\npalace_total_drawers=N\` to ${stateDir}/palace-cache-{wing}.sh — the file's mere existence is the gate.`;

  return {
    rId: "R40",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${unprovisioned.length} of ${wings.length} declared wing(s) lack a palace-cache file:`,
      ...unprovisioned.map((w) => `  • ${w} (expected ${stateDir}/palace-cache-${w}.sh)`),
      seedHint,
    ],
  };
}
