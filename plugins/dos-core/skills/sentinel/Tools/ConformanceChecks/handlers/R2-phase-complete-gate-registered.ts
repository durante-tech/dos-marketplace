/**
 * R2 (RFC-0060) — PhaseCompleteGate hook registered in settings.json
 * PreToolUse Edit matcher.
 *
 * R1 verifies the hook file exists; R2 verifies it's actually wired into the
 * harness. A hook on disk that's not in settings.json is unwired weight —
 * Feathers' "latent inventory" anti-pattern. RFC-0060 mandates the hook fire
 * on Edit (specifically on PRD.md frontmatter writes), so the matcher must
 * include "Edit" — Write/MultiEdit alone don't trigger frontmatter updates
 * that flip phase to complete.
 *
 * Two-anchor check (mirrors R9 pattern):
 *   1. settings.json declares hook in hooks.PreToolUse for at least one
 *      Edit-inclusive matcher
 *   2. The matcher's hook command references PhaseCompleteGate.hook.ts
 *
 * Failure modes:
 *   - settings.json not found → fail
 *   - hooks.PreToolUse missing or empty → fail
 *   - No matcher mentioning Edit references PhaseCompleteGate → fail
 *
 * Test seam: ctx.settingsPath overrides default path resolution.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const HOOK_NAME = "PhaseCompleteGate.hook.ts";
const REQUIREMENT = "PhaseCompleteGate hook registered in settings.json PreToolUse Edit matcher";

interface HookEntry {
  type?: string;
  command?: string;
}

interface MatcherBlock {
  matcher?: string;
  hooks?: HookEntry[];
}

interface Settings {
  hooks?: {
    PreToolUse?: MatcherBlock[];
    [other: string]: unknown;
  };
}

function resolveSettingsPath(ctx: CheckContext): string {
  if (ctx.settingsPath) return ctx.settingsPath;
  return join(homedir(), ".claude", "settings.json");
}

function matcherIncludesEdit(matcher: string | undefined): boolean {
  if (!matcher) return false;
  return /\bEdit\b/.test(matcher);
}

export async function r2PhaseCompleteGateRegistered(ctx: CheckContext): Promise<CheckResult> {
  const path = resolveSettingsPath(ctx);

  if (!existsSync(path)) {
    return {
      rId: "R2-RFC0060",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${path} not found`],
    };
  }

  let settings: Settings;
  try {
    settings = JSON.parse(readFileSync(path, "utf-8")) as Settings;
  } catch (err) {
    return {
      rId: "R2-RFC0060",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`failed to parse ${path}: ${(err as Error).message}`],
    };
  }

  const blocks = settings.hooks?.PreToolUse ?? [];
  if (blocks.length === 0) {
    return {
      rId: "R2-RFC0060",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`hooks.PreToolUse missing or empty in ${path}`],
    };
  }

  const editMatchers: string[] = [];
  for (const block of blocks) {
    if (!matcherIncludesEdit(block.matcher)) continue;
    const hooks = block.hooks ?? [];
    for (const h of hooks) {
      if (typeof h.command === "string" && h.command.includes(HOOK_NAME)) {
        editMatchers.push(block.matcher ?? "(unnamed)");
        break;
      }
    }
  }

  if (editMatchers.length === 0) {
    return {
      rId: "R2-RFC0060",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `no PreToolUse matcher containing "Edit" references ${HOOK_NAME} in ${path}`,
        "fix: add hooks.PreToolUse[].matcher containing Edit with command pointing to PhaseCompleteGate.hook.ts",
      ],
    };
  }

  return {
    rId: "R2-RFC0060",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${HOOK_NAME} wired under ${editMatchers.length} Edit-inclusive matcher(s): ${editMatchers.join(", ")}`,
    ],
    loc: path,
  };
}
