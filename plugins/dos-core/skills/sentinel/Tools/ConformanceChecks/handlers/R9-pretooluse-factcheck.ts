/**
 * R9 — fact_check wired into PreToolUse.
 *
 * §14.4 obligation: a PreToolUse hook invokes `fact_check` against
 * pending Write/Edit/MultiEdit content. Two-anchor presence check:
 *
 *   1. FactCheckPreTool.hook.ts exists under hooksRoot
 *   2. settings.json declares it in hooks.PreToolUse for at least
 *      one matcher (Write / Edit / MultiEdit / Bash — any)
 *
 * Either anchor missing = fail. Both present but no overlap (hook
 * exists + settings unreferenced) is flagged — hook files sitting
 * unwired contradict the obligation.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const DEFAULT_HOOK_FILE = "FactCheckPreTool.hook.ts";
const DEFAULT_HOOK_NAME = "FactCheckPreTool";

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

function settingsReferencesHook(settings: Settings, hookName: string): string[] {
  const matchers: string[] = [];
  const blocks = settings.hooks?.PreToolUse ?? [];
  for (const block of blocks) {
    const hooks = block.hooks ?? [];
    for (const h of hooks) {
      if (typeof h.command === "string" && h.command.includes(hookName)) {
        matchers.push(block.matcher ?? "(unnamed)");
        break;
      }
    }
  }
  return matchers;
}

export async function r9PreToolUseFactCheck(ctx: CheckContext): Promise<CheckResult> {
  const hookPath = join(ctx.hooksRoot, DEFAULT_HOOK_FILE);
  const settingsPath = ctx.settingsPath ?? join(dirname(ctx.hooksRoot), "settings.json");

  const hookExists = existsSync(hookPath);
  if (!existsSync(settingsPath)) {
    return {
      rId: "R9",
      requirement: "fact_check wired into PreToolUse",
      status: "not_applicable",
      evidence: [`${settingsPath} not found — settings.json missing`],
    };
  }

  let settings: Settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch (err) {
    return {
      rId: "R9",
      requirement: "fact_check wired into PreToolUse",
      status: "fail",
      evidence: [`${settingsPath} unparseable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const evidence: string[] = [];
  if (!hookExists) {
    evidence.push(`${hookPath}: ${DEFAULT_HOOK_FILE} not installed`);
  }
  const matchers = settingsReferencesHook(settings, DEFAULT_HOOK_NAME);
  if (matchers.length === 0) {
    evidence.push(`${settingsPath}: hooks.PreToolUse has no entry referencing ${DEFAULT_HOOK_NAME}`);
  }

  return {
    rId: "R9",
    requirement: "fact_check wired into PreToolUse",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence: evidence.length === 0
      ? [`${DEFAULT_HOOK_FILE} present; wired for matcher(s): ${matchers.join(", ")}`]
      : evidence,
  };
}
