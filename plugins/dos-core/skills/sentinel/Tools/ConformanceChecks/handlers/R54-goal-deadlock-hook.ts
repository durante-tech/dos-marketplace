/**
 * R54 (v0.0.15 foundation-fix sprint, PRD-20260513-145627 ISC-5 regression
 * guard) — settings.json `hooks.Stop[].hooks[].command` must reference
 * `GoalDeadlockDetect.hook.ts`.
 *
 * Background: ISC-5 wired the GoalDeadlockDetect hook into Stop so the agent
 * surfaces /goal deadlock detection at the end of every turn. If the entry
 * is silently dropped from settings.json (e.g. a settings.json bulk edit
 * collapses a hook group), deadlock detection regresses to silent.
 *
 * Applicability: settings.json present under <hooksRoot>/../settings.json.
 *
 * Pass condition: at least one entry in `hooks.Stop` carries a command
 * string containing the literal substring `GoalDeadlockDetect.hook.ts`.
 *
 * Fail condition: settings.json present but no Stop entry references the
 * hook file (registration silently dropped).
 *
 * Not_applicable: settings.json not found (non-DOS install).
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "settings.json `hooks.Stop[].hooks[].command` must reference `GoalDeadlockDetect.hook.ts` (ISC-5 regression guard)";
const HOOK_TOKEN = "GoalDeadlockDetect.hook.ts";

interface HookEntry {
  type?: string;
  command?: string;
}

interface HookBlock {
  matcher?: string;
  hooks?: HookEntry[];
}

interface Settings {
  hooks?: {
    Stop?: HookBlock[];
    [other: string]: unknown;
  };
}

export async function r54GoalDeadlockHook(ctx: CheckContext): Promise<CheckResult> {
  const settingsPath = ctx.settingsPath ?? join(dirname(ctx.hooksRoot), "settings.json");

  if (!existsSync(settingsPath)) {
    return {
      rId: "R54",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`settings.json not found at ${settingsPath} — non-DOS install`],
    };
  }

  let raw: string;
  try {
    raw = readFileSync(settingsPath, "utf-8");
  } catch (err) {
    return {
      rId: "R54",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${settingsPath} unreadable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  let settings: Settings;
  try {
    settings = JSON.parse(raw) as Settings;
  } catch (err) {
    return {
      rId: "R54",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${settingsPath}: invalid JSON — ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const blocks = settings.hooks?.Stop ?? [];
  let matched = 0;
  for (const block of blocks) {
    for (const h of block.hooks ?? []) {
      if (typeof h.command === "string" && h.command.includes(HOOK_TOKEN)) {
        matched++;
      }
    }
  }

  if (matched === 0) {
    return {
      rId: "R54",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${settingsPath}: no Stop hook command references ${HOOK_TOKEN}`,
        `Found ${blocks.length} Stop group(s) but none wire GoalDeadlockDetect — ISC-5 regression`,
      ],
    };
  }

  return {
    rId: "R54",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [`${settingsPath}: ${matched} Stop hook entry(ies) reference ${HOOK_TOKEN}`],
  };
}
