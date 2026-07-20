/**
 * R53 (v0.0.15 foundation-fix sprint, PRD-20260513-145627 ISC-4 regression
 * guard) — settings.json `hooks.SessionStart[].hooks[].command` must
 * reference `SessionBaseline.hook.ts`.
 *
 * Background: ISC-4 wired the SessionBaseline hook into SessionStart so that
 * every new session auto-fires a baseline snapshot (PRD foundation-fix +
 * RFC-0096). If the entry is silently dropped from settings.json (e.g. by a
 * settings.json bulk edit that drops a group), session baselining stops
 * functioning and the regression is invisible until a stability incident
 * tries to look up "baseline at session start".
 *
 * Applicability: settings.json present under <hooksRoot>/../settings.json.
 *
 * Pass condition: at least one entry in `hooks.SessionStart` carries a
 * command string containing the literal substring `SessionBaseline.hook.ts`.
 *
 * Fail condition: settings.json present but no SessionStart entry references
 * the hook file (registration silently dropped).
 *
 * Not_applicable: settings.json not found (non-DOS install).
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "settings.json `hooks.SessionStart[].hooks[].command` must reference `SessionBaseline.hook.ts` (ISC-4 regression guard)";
const HOOK_TOKEN = "SessionBaseline.hook.ts";

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
    SessionStart?: HookBlock[];
    [other: string]: unknown;
  };
}

export async function r53SessionBaselineHook(ctx: CheckContext): Promise<CheckResult> {
  const settingsPath = ctx.settingsPath ?? join(dirname(ctx.hooksRoot), "settings.json");

  if (!existsSync(settingsPath)) {
    return {
      rId: "R53",
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
      rId: "R53",
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
      rId: "R53",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [`${settingsPath}: invalid JSON — ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const blocks = settings.hooks?.SessionStart ?? [];
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
      rId: "R53",
      requirement: REQUIREMENT,
      status: "fail",
      evidence: [
        `${settingsPath}: no SessionStart hook command references ${HOOK_TOKEN}`,
        `Found ${blocks.length} SessionStart group(s) but none wire SessionBaseline — ISC-4 regression`,
      ],
    };
  }

  return {
    rId: "R53",
    requirement: REQUIREMENT,
    status: "pass",
    evidence: [`${settingsPath}: ${matched} SessionStart hook entry(ies) reference ${HOOK_TOKEN}`],
  };
}
