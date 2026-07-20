/**
 * R8 — bridgeFire stderr captured to ring-buffer.
 *
 * The ring-buffer lives at ~/.claude/MEMORY/STATE/mempalace-errors.jsonl.
 * A fresh machine won't have it yet (no SessionEnd has fired) — treat that
 * as `not_applicable`, not `fail`. An existing-but-unwritable file IS a
 * fail (permission regression or corruption).
 *
 * Tests pass `ringBufferPath` via CheckContext to redirect to a temp file.
 */

import { existsSync, accessSync, constants, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const DEFAULT_RING_BUFFER = join(
  homedir(),
  ".claude",
  "MEMORY",
  "STATE",
  "mempalace-errors.jsonl",
);

export async function r8RingBufferExists(ctx: CheckContext): Promise<CheckResult> {
  const path = ctx.ringBufferPath ?? DEFAULT_RING_BUFFER;

  if (!existsSync(path)) {
    return {
      rId: "R8",
      requirement: "bridgeFire stderr captured to ring-buffer",
      status: "not_applicable",
      evidence: [`${path} not yet created — first SessionEnd hasn't run`],
    };
  }

  try {
    const st = statSync(path);
    if (!st.isFile()) {
      return {
        rId: "R8",
        requirement: "bridgeFire stderr captured to ring-buffer",
        status: "fail",
        evidence: [`${path} exists but is not a regular file`],
      };
    }
    accessSync(path, constants.W_OK);
  } catch (err) {
    return {
      rId: "R8",
      requirement: "bridgeFire stderr captured to ring-buffer",
      status: "fail",
      evidence: [`${path} is not append-writable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  return {
    rId: "R8",
    requirement: "bridgeFire stderr captured to ring-buffer",
    status: "pass",
    evidence: [`${path} present and writable`],
  };
}
