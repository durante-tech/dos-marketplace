/**
 * R34 — working-tree-clean-gate.ts reports clean OR documented operator exception.
 *
 * Runs working-tree-clean-gate.ts and checks for a clean exit code (0) or a
 * documented operator exception (DOS_ALLOW_DIRTY_LEARN=1 env override, which
 * is explicitly audited in the gate's stderr output).
 *
 * This is the Tier 3 system-coherence check: it verifies that the current
 * working tree is in the expected state at Sentinel scan time — not just that
 * the gate tool exists (R21 checks that), but that it reports a clean result.
 *
 * This is a dynamic/live check: requires the gate script to exist.
 *
 * Gate path resolution:
 *   1. $HOME/Durante/Tools/working-tree-clean-gate.ts
 *   2. join(ctx.repoRoot, 'Tools', 'working-tree-clean-gate.ts')
 *
 * Operator exception: if DOS_ALLOW_DIRTY_LEARN=1 is in env, the gate exits 0
 * with a stderr WARNING. This is considered a "documented exception" and R34
 * reports pass with a warning note in evidence.
 *
 * Failure modes:
 *   - Gate script not found → not_applicable
 *   - bun not available → not_applicable
 *   - Gate exits non-zero without DOS_ALLOW_DIRTY_LEARN → fail
 *
 * Why R-class: a dirty working tree at Sentinel scan time indicates uncommitted
 * work — the specific failure mode that caused data loss in the 2026-05-04
 * incident (submodule edits not committed before parent push).
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "working-tree-clean-gate.ts must exit 0 (clean tree) OR document an operator exception";

function resolveGatePath(ctx: CheckContext): string | null {
  if (ctx.gatePath !== undefined) {
    return existsSync(ctx.gatePath) ? ctx.gatePath : null;
  }
  const home = homedir();
  const candidates = [
    join(home, "Durante", "Tools", "working-tree-clean-gate.ts"),
    join(ctx.repoRoot, "Tools", "working-tree-clean-gate.ts"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Default command runner — production path. Tests inject ctx.exec instead.
 *  `cwd` is threaded so working-tree-clean-gate.ts audits the SCANNED repo
 *  (ctx.repoRoot) rather than the Sentinel process's working directory — the
 *  gate resolves its repo root via findGitRoot(process.cwd()). */
function makeDefaultExec(cwd: string) {
  return function defaultExec(cmd: string, args: string[]): {
    status: number | null;
    stdout: string;
    stderr: string;
  } {
    const r = spawnSync(cmd, args, { encoding: "utf-8", timeout: 30_000, cwd });
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  };
}

function bunExists(exec: (c: string, a: string[]) => { status: number | null }): boolean {
  return exec("which", ["bun"]).status === 0;
}

export async function r34DirtyTreeAudit(ctx: CheckContext): Promise<CheckResult> {
  const exec = ctx.exec ?? makeDefaultExec(ctx.repoRoot);
  const gatePath = resolveGatePath(ctx);

  if (!gatePath) {
    return {
      rId: "R34",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["working-tree-clean-gate.ts not found at ~/Durante/Tools/ or ctx.repoRoot/Tools/"],
    };
  }

  if (!bunExists(exec)) {
    return {
      rId: "R34",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["bun not found in PATH — cannot run working-tree-clean-gate.ts"],
    };
  }

  const result = exec("bun", [gatePath, "--format", "json"]);

  // Check for DOS_ALLOW_DIRTY_LEARN bypass in stderr (documented operator exception)
  const stderr = (result.stderr ?? "").trim();
  const stdout = (result.stdout ?? "").trim();
  const isDocumentedBypass = stderr.includes("DOS_ALLOW_DIRTY_LEARN");

  if (result.status === 0) {
    const evidence: string[] = ["working-tree-clean-gate.ts exited 0 — tree is clean"];
    if (isDocumentedBypass) {
      evidence.push("NOTE: DOS_ALLOW_DIRTY_LEARN=1 bypass was used (documented operator exception)");
    }
    return {
      rId: "R34",
      requirement: REQUIREMENT,
      status: "pass",
      evidence,
    };
  }

  return {
    rId: "R34",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `working-tree-clean-gate.ts exited ${result.status ?? "(signal)"} — dirty working tree`,
      ...(stdout ? [`stdout: ${stdout.slice(0, 500)}`] : []),
      ...(stderr ? [`stderr: ${stderr.slice(0, 200)}`] : []),
    ],
  };
}
