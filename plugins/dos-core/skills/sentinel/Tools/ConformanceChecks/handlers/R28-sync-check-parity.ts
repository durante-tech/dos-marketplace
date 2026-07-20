/**
 * R28 — bun ~/Durante/Tools/sync-check.ts exits 0 (four-copy parity).
 *
 * Runs sync-check.ts in --summary mode and verifies it exits 0. Exit code 1
 * means drift detected (at least one copy mismatch). Exit code 2 means a
 * manifest error. Any non-zero exit is a conformance failure.
 *
 * This is a dynamic/live check: it requires sync-check.ts to be present and
 * the Bun runtime to be available. Returns `not_applicable` if the tool is
 * not found.
 *
 * sync-check.ts path resolution:
 *   1. $HOME/Durante/Tools/sync-check.ts (primary canonical)
 *   2. join(ctx.repoRoot, 'Tools', 'sync-check.ts') (project-relative)
 *
 * Failure modes:
 *   - sync-check.ts not found → not_applicable
 *   - bun not available → not_applicable
 *   - sync-check.ts exits 1 (drift) → fail with stdout as evidence
 *   - sync-check.ts exits 2 (manifest error) → fail with stderr as evidence
 *
 * Why R-class: four-copy parity is an architectural invariant. Silent drift
 * between copies means the live install and pack source diverge — agents run
 * different skill logic than what's committed, making the codebase a lie.
 */

import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "bun Tools/sync-check.ts must exit 0 — all four-copy pairs must be in parity";

function resolveSyncCheckPath(ctx: CheckContext): string | null {
  if (ctx.syncCheckPath !== undefined) {
    return existsSync(ctx.syncCheckPath) ? ctx.syncCheckPath : null;
  }
  const candidates = [
    join(homedir(), "Durante", "Tools", "sync-check.ts"),
    join(ctx.repoRoot, "Tools", "sync-check.ts"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** Default command runner — production path. Tests inject ctx.exec instead. */
function defaultExec(cmd: string, args: string[]): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const r = spawnSync(cmd, args, { encoding: "utf-8", timeout: 30_000 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function bunExists(exec: (c: string, a: string[]) => { status: number | null }): boolean {
  return exec("which", ["bun"]).status === 0;
}

export async function r28SyncCheckParity(ctx: CheckContext): Promise<CheckResult> {
  const exec = ctx.exec ?? defaultExec;
  const syncCheckPath = resolveSyncCheckPath(ctx);

  if (!syncCheckPath) {
    return {
      rId: "R28",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["sync-check.ts not found at ~/Durante/Tools/ or ctx.repoRoot/Tools/"],
    };
  }

  if (!bunExists(exec)) {
    return {
      rId: "R28",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["bun not found in PATH — cannot run sync-check.ts"],
    };
  }

  const result = exec("bun", [syncCheckPath, "--summary"]);

  if (result.status === 0) {
    const summary = (result.stdout ?? "").trim().split("\n").slice(0, 3).join(" | ");
    return {
      rId: "R28",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `sync-check.ts exited 0 — all copies in parity`,
        ...(summary ? [`output: ${summary}`] : []),
      ],
    };
  }

  const stdout = (result.stdout ?? "").trim();
  const stderr = (result.stderr ?? "").trim();
  const exitCode = result.status ?? "(signal)";

  return {
    rId: "R28",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `sync-check.ts exited ${exitCode} — four-copy parity violation`,
      ...(stdout ? [`stdout: ${stdout.slice(0, 500)}`] : []),
      ...(stderr ? [`stderr: ${stderr.slice(0, 200)}`] : []),
    ],
  };
}
