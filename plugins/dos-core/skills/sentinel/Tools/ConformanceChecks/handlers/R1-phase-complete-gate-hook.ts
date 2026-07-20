/**
 * R1 (RFC-0060) — PhaseCompleteGate.hook.ts exists at canonical path.
 *
 * RFC-0060 introduces a PreToolUse hook that blocks `phase: complete` writes
 * to PRD frontmatter when LEARN evidences are missing. The hook closes the
 * 6-of-7 soft-LEARN-obligations gap surfaced 2026-05-05 (operator's "well nothing
 * missing?" — a comprehensive-effort delivery had skipped LEARN entirely).
 *
 * R1 is the simplest of the three RFC-0060 R-rules: verify the hook file is
 * physically present at the canonical path. R2 verifies it's wired in
 * settings.json. R3 retroactively audits completed PRDs for LEARN evidences.
 *
 * Resolution chain:
 *   1. ctx.hooksRoot/PhaseCompleteGate.hook.ts (test seam)
 *   2. ~/.claude/hooks/PhaseCompleteGate.hook.ts (production)
 *
 * Failure modes:
 *   - File not at either location → fail
 *   - File present but empty / not a regular file → fail
 *   - File present and non-empty → pass
 */

import { existsSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const HOOK_FILENAME = "PhaseCompleteGate.hook.ts";
const REQUIREMENT = "PhaseCompleteGate.hook.ts exists at canonical path";

function resolveHookPath(ctx: CheckContext): string {
  if (ctx.hooksRoot) {
    return join(ctx.hooksRoot, HOOK_FILENAME);
  }
  return join(homedir(), ".claude", "hooks", HOOK_FILENAME);
}

export async function r1PhaseCompleteGateHook(ctx: CheckContext): Promise<CheckResult> {
  const path = resolveHookPath(ctx);

  if (!existsSync(path)) {
    return {
      rId: "R1-RFC0060",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${path} not found`,
        "fix: ship Releases/v0.0.6/.claude/hooks/PhaseCompleteGate.hook.ts (RFC-0060 §Architecture)",
      ],
    };
  }

  try {
    const st = statSync(path);
    if (!st.isFile()) {
      return {
        rId: "R1-RFC0060",
        requirement: REQUIREMENT,
        status: "fail",
        evidence: [`${path} exists but is not a regular file`],
      };
    }
    if (st.size === 0) {
      return {
        rId: "R1-RFC0060",
        requirement: REQUIREMENT,
        status: "fail",
        evidence: [`${path} is empty (zero bytes)`],
      };
    }
  } catch (err) {
    return {
      rId: "R1-RFC0060",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`stat ${path} failed: ${(err as Error).message}`],
    };
  }

  return {
    rId: "R1-RFC0060",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [`${path} present`],
    loc: path,
  };
}
