/**
 * R6 — CI diffs SKILL.md against ACTIONS + tool_*.
 *
 * Delegates to the existing `Durante/Tools/check-skill-md-drift.ts` via
 * `Bun.spawn`. That tool targets the mem-palace pack's SKILL.md today and
 * exits 0 (parity) / 1 (drift) / 2 (config error). This handler wraps it
 * into the conformance matrix:
 *
 *   exit 0 → pass
 *   exit 1 → fail (with stdout as evidence)
 *   exit 2 → not_applicable (config error means the pack isn't present)
 *
 * The generalization from "MemPalace-only" to "any pack with a bridge" is
 * deferred until a second pack gets a bridge module. Until then the exit-2
 * path carries the "not applicable" case cleanly.
 */

import { existsSync, mkdtempSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { CheckContext, CheckResult } from "../types.ts";

function resolveDriftTool(repoRoot: string): string {
  return join(repoRoot, "Tools", "check-skill-md-drift.ts");
}

export async function r6SkillMdParity(ctx: CheckContext): Promise<CheckResult> {
  const tool = resolveDriftTool(ctx.repoRoot);

  if (!existsSync(tool)) {
    return {
      rId: "R6",
      requirement: "CI diffs SKILL.md against ACTIONS + tool_*",
      status: "not_applicable",
      evidence: [`${tool} not found — drift tool not installed in this repo`],
    };
  }

  // Canonical file-redirected child stdio (2026-05-21 pattern): piped capture
  // races the child's exit flush under bun:test — the drift tool's evidence
  // text arrived empty and the handler degraded to "exit 1" evidence.
  const ioDir = mkdtempSync(join(tmpdir(), "r6-io-"));
  const proc = Bun.spawn(["bun", tool], {
    cwd: ctx.repoRoot,
    stdout: Bun.file(join(ioDir, "out")),
    stderr: Bun.file(join(ioDir, "err")),
  });
  const exitCode = await proc.exited;
  const stdout = readFileSync(join(ioDir, "out"), "utf8");
  const stderr = readFileSync(join(ioDir, "err"), "utf8");

  if (exitCode === 0) {
    return {
      rId: "R6",
      requirement: "CI diffs SKILL.md against ACTIONS + tool_*",
      status: "pass",
      evidence: [`${tool}: parity ok`],
    };
  }
  if (exitCode === 2) {
    const reason = (stdout || stderr).trim().split("\n")[0] ?? "config error";
    return {
      rId: "R6",
      requirement: "CI diffs SKILL.md against ACTIONS + tool_*",
      status: "not_applicable",
      evidence: [`${tool}: ${reason}`],
    };
  }
  const body = stdout.trim() || stderr.trim() || `exit ${exitCode}`;
  return {
    rId: "R6",
    requirement: "CI diffs SKILL.md against ACTIONS + tool_*",
    status: "fail",
    evidence: body.split("\n").slice(0, 10),
  };
}
