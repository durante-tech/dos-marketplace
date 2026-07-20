/**
 * R29 — IntelFirstGuard.hook.ts registered in PreToolUse Bash matcher.
 *
 * The Algorithm INTEL-FIRST obligation requires that IntelFirstGuard.hook.ts
 * fire on every entity-subject Bash call. This is enforced mechanically by
 * having the hook registered in the PreToolUse hook group with matcher "Bash"
 * in settings.json.
 *
 * This check reads settings.json and verifies the hook is wired. If the hook
 * is absent from the Bash PreToolUse group, entity-subject sessions silently
 * skip the INTEL-FIRST obligation — the failure mode that the 2026-05-03
 * Rich McVey audit documented.
 *
 * settings.json path: ctx.settingsPath ?? join(ctx.hooksRoot, '..', 'settings.json')
 *
 * Failure modes:
 *   - settings.json not found → not_applicable
 *   - No PreToolUse hook group → fail
 *   - No Bash matcher in PreToolUse → fail
 *   - IntelFirstGuard.hook.ts not in Bash matcher → fail
 *
 * Why R-class: INTEL-FIRST is a mandatory algorithm rule. An un-wired guard
 * means the rule exists only as text — the 2026-05-03 incident confirmed that
 * text rules alone don't bind. This check enforces the binding.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "IntelFirstGuard.hook.ts must be registered in the PreToolUse Bash matcher in settings.json";

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

function intelFirstGuardRegistered(settings: Settings): boolean {
  const preToolUse = settings.hooks?.PreToolUse;
  if (!Array.isArray(preToolUse)) return false;

  for (const group of preToolUse) {
    if (group.matcher !== "Bash") continue;
    if (!Array.isArray(group.hooks)) continue;
    for (const hook of group.hooks) {
      if (typeof hook.command === "string" && hook.command.includes("IntelFirstGuard")) {
        return true;
      }
    }
  }
  return false;
}

export async function r29IntelFirstActive(ctx: CheckContext): Promise<CheckResult> {
  const settingsPath =
    ctx.settingsPath ?? join(ctx.hooksRoot, "..", "settings.json");

  if (!existsSync(settingsPath)) {
    return {
      rId: "R29",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`settings.json not found at ${settingsPath}`],
    };
  }

  let settings: Settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8")) as Settings;
  } catch (err) {
    return {
      rId: "R29",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `settings.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  if (intelFirstGuardRegistered(settings)) {
    return {
      rId: "R29",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: ["IntelFirstGuard.hook.ts found in PreToolUse Bash matcher"],
    };
  }

  // Diagnose: is PreToolUse present? Is Bash matcher present?
  const preToolUse = settings.hooks?.PreToolUse;
  if (!Array.isArray(preToolUse) || preToolUse.length === 0) {
    return {
      rId: "R29",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: ["PreToolUse hook group absent or empty in settings.json"],
    };
  }

  const bashGroup = preToolUse.find((g) => g.matcher === "Bash");
  if (!bashGroup) {
    return {
      rId: "R29",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: ['No PreToolUse Bash matcher found in settings.json — INTEL-FIRST guard cannot fire'],
    };
  }

  return {
    rId: "R29",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      "PreToolUse Bash matcher exists but does not include IntelFirstGuard.hook.ts",
      `Current Bash hooks: ${(bashGroup.hooks ?? []).map((h) => h.command ?? "(no command)").join(", ")}`,
    ],
  };
}
