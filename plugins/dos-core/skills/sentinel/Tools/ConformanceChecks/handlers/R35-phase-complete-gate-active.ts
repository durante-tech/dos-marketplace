/**
 * R35 — PhaseCompleteGate.hook.ts is present and registered in PreToolUse
 * Edit matcher (RFC-0060).
 *
 * RFC-0060 shipped PhaseCompleteGate.hook.ts as the mechanical enforcer of
 * the WORKING-TREE-CLEAN GATE at every phase:complete transition. This hook
 * fires on PreToolUse Edit (and Write/MultiEdit), blocking `phase: complete`
 * writes to PRD frontmatter until all 5 completion checks pass.
 *
 * This check verifies two things:
 *   1. PhaseCompleteGate.hook.ts file EXISTS on disk (not deleted)
 *   2. settings.json has it registered in at least one of the PreToolUse
 *      Edit, Write, or MultiEdit matchers
 *
 * settings.json path: ctx.settingsPath ?? join(ctx.hooksRoot, '..', 'settings.json')
 * Hook file resolution (checked in order):
 *   1. join(ctx.hooksRoot, 'PhaseCompleteGate.hook.ts')
 *   2. $HOME/.claude/hooks/PhaseCompleteGate.hook.ts
 *
 * Failure modes:
 *   - settings.json not found → not_applicable
 *   - PhaseCompleteGate.hook.ts not found on disk → fail
 *   - Hook not registered in PreToolUse Edit/Write/MultiEdit → fail
 *
 * Why R-class: PhaseCompleteGate is the mechanical enforcement of the 5-gate
 * phase-complete check. Without it, the algorithm's gate obligations are
 * doctrine-only — which is exactly the failure mode the 2026-05-04 incident
 * demonstrated (submodule dirt silently passing the phase boundary).
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "PhaseCompleteGate.hook.ts must exist on disk AND be registered in PreToolUse Edit/Write/MultiEdit in settings.json";

const GATE_FILENAME = "PhaseCompleteGate.hook.ts";
const REQUIRED_MATCHERS = ["Edit", "Write", "MultiEdit"] as const;

interface HookEntry {
  type?: string;
  command?: string;
}

interface HookGroup {
  matcher?: string;
  hooks?: HookEntry[];
}

interface Settings {
  hooks?: Record<string, HookGroup[]>;
}

function resolveGateFilePath(ctx: CheckContext): string | null {
  const candidates = [
    join(ctx.hooksRoot, GATE_FILENAME),
    join(homedir(), ".claude", "hooks", GATE_FILENAME),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function gateRegisteredInSettings(settings: Settings): boolean {
  const preToolUse = settings.hooks?.PreToolUse;
  if (!Array.isArray(preToolUse)) return false;

  for (const group of preToolUse) {
    if (!REQUIRED_MATCHERS.includes(group.matcher as typeof REQUIRED_MATCHERS[number])) continue;
    if (!Array.isArray(group.hooks)) continue;
    for (const hook of group.hooks) {
      if (typeof hook.command === "string" && hook.command.includes(GATE_FILENAME.replace(".ts", ""))) {
        return true;
      }
    }
  }
  return false;
}

function getRegisteredMatchers(settings: Settings): string[] {
  const preToolUse = settings.hooks?.PreToolUse;
  if (!Array.isArray(preToolUse)) return [];

  const found: string[] = [];
  for (const group of preToolUse) {
    if (!Array.isArray(group.hooks)) continue;
    for (const hook of group.hooks) {
      if (typeof hook.command === "string" && hook.command.includes(GATE_FILENAME.replace(".ts", ""))) {
        if (group.matcher) found.push(group.matcher);
      }
    }
  }
  return found;
}

export async function r35PhaseCompleteGateActive(ctx: CheckContext): Promise<CheckResult> {
  const settingsPath =
    ctx.settingsPath ?? join(ctx.hooksRoot, "..", "settings.json");

  if (!existsSync(settingsPath)) {
    return {
      rId: "R35",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`settings.json not found at ${settingsPath}`],
    };
  }

  // --- 1. Check gate file exists ---
  const gateFilePath = resolveGateFilePath(ctx);

  const evidence: string[] = [];

  if (!gateFilePath) {
    evidence.push(
      `${GATE_FILENAME} not found at ${ctx.hooksRoot}/ or ~/.claude/hooks/ — hook was deleted`,
    );
  }

  // --- 2. Check registration in settings.json ---
  let settings: Settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Settings;
  } catch (err) {
    return {
      rId: "R35",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `settings.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (!gateRegisteredInSettings(settings)) {
    evidence.push(
      `${GATE_FILENAME} not registered in PreToolUse Edit/Write/MultiEdit in settings.json`,
    );
  }

  if (evidence.length > 0) {
    return {
      rId: "R35",
      requirement: REQUIREMENT,
      status: "fail",
      evidence,
    };
  }

  const matchers = getRegisteredMatchers(settings);
  return {
    rId: "R35",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [
      `${GATE_FILENAME} present on disk: ${gateFilePath}`,
      `Registered in PreToolUse matchers: ${matchers.join(", ")}`,
    ],
  };
}
