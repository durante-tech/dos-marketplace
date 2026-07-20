/**
 * R57 (v0.0.15 foundation-fix sprint, PRD-20260513-145627 ISC regression
 * guard) — `~/.claude/hooks/CheckpointPerISC.hook.ts` must define a
 * `tryStaleClear` function so stale-checkpoint clearing remains operational.
 *
 * Background: CheckpointPerISC's `tryStaleClear` is the recovery path that
 * detects and clears a stale per-ISC checkpoint before re-checkpointing.
 * Without it, a stuck checkpoint (e.g. crashed session left a sentinel
 * file) silently blocks subsequent ISC checkpointing for that PRD. The
 * function is load-bearing for the foundation-fix sprint's per-ISC ratchet.
 *
 * Applicability: ~/.claude/hooks/CheckpointPerISC.hook.ts exists.
 *
 * Pass condition: hook source contains the substring `tryStaleClear`.
 *
 * Fail condition: file exists but the function name is absent.
 *
 * Not_applicable: CheckpointPerISC.hook.ts not found (non-DOS install or
 * pre-foundation-fix host).
 *
 * Resolution: under maintainer-mode symlink (~/.claude →
 * Releases/v0.0.15/.claude), this path reaches the active submodule's
 * working tree directly. Under a customer install, the same path resolves
 * to the real ~/.claude/hooks/ directory.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "~/.claude/hooks/CheckpointPerISC.hook.ts must define a `tryStaleClear` function (foundation-fix regression guard)";
const FUNCTION_TOKEN = "tryStaleClear";
const HOOK_FILE = "CheckpointPerISC.hook.ts";

export async function r57CheckpointStaleClear(ctx: CheckContext): Promise<CheckResult> {
  const hookPath = join(ctx.hooksRoot, HOOK_FILE);

  if (!existsSync(hookPath)) {
    return {
      rId: "R57",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${HOOK_FILE} not found at ${hookPath}`],
    };
  }

  let src: string;
  try {
    src = readFileSync(hookPath, "utf-8");
  } catch (err) {
    return {
      rId: "R57",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${hookPath} unreadable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  if (!src.includes(FUNCTION_TOKEN)) {
    return {
      rId: "R57",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${hookPath}: missing reference to '${FUNCTION_TOKEN}' — stale-checkpoint clearing regressed`,
        "Foundation-fix sprint added tryStaleClear so stuck checkpoints don't block per-ISC ratcheting.",
      ],
    };
  }

  return {
    rId: "R57",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [`${hookPath}: '${FUNCTION_TOKEN}' present — stale-clear recovery path wired`],
  };
}
