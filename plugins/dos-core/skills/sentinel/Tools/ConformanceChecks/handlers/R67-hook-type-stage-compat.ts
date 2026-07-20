/**
 * R67 — hook-type ↔ stage compatibility.
 *
 * Background: Claude Code v2.1.142+ rejects hooks configured at
 * `SessionStart`, `Setup`, or `SubagentStart` with `type: "prompt"` or
 * `type: "agent"` — these stages MUST use `type: "command"`. DOS today is
 * compliant (LoadContext / MemPalaceWakeUp / KittyEnvPersist etc. are all
 * command-type), but there is no static gate, so a new Pack author could
 * silently misconfigure a new SessionStart hook and the platform error
 * would only surface at session-start time.
 *
 * This R-rule scans `~/.claude/settings.json` (or ctx.settingsPath override)
 * and asserts every hook at the three gated stages is type:command.
 *
 * Pass:
 *   - settings.json declares no hooks at SessionStart / Setup / SubagentStart, OR
 *   - every hook entry at those stages has type === "command"
 * Fail:
 *   - at least one hook entry at a gated stage has type !== "command"
 *   - evidence names the stage, the matcher, the offending command, and the
 *     current type
 * Not_applicable:
 *   - settings.json is missing
 *   - settings.json is unreadable / unparseable JSON
 *
 * Tier: warning per RFC-0085 council default for new presence checks.
 *
 * Settings shape (Claude Code native):
 *   {
 *     "hooks": {
 *       "SessionStart": [ { "matcher"?: string, "hooks": [ { "type": "command" | "prompt" | "agent", "command": string } ] } ],
 *       ...
 *     }
 *   }
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Hooks at SessionStart / Setup / SubagentStart MUST declare type:command (Claude Code v2.1.142+ rejects prompt/agent types at these stages)";

const GATED_STAGES = ["SessionStart", "Setup", "SubagentStart"] as const;
type GatedStage = (typeof GATED_STAGES)[number];

interface HookEntry {
  type?: string;
  command?: string;
}

interface MatcherBlock {
  matcher?: string;
  hooks?: HookEntry[];
}

interface Settings {
  hooks?: Partial<Record<GatedStage, MatcherBlock[]>> & { [other: string]: unknown };
}

export async function r67HookTypeStageCompat(ctx: CheckContext): Promise<CheckResult> {
  const settingsPath = ctx.settingsPath ?? join(dirname(ctx.hooksRoot), "settings.json");

  if (!existsSync(settingsPath)) {
    return {
      rId: "R67",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${settingsPath} not found — settings.json missing`],
    };
  }

  let settings: Settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch (err) {
    return {
      rId: "R67",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${settingsPath} unparseable: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const hooksBlock = settings.hooks;
  if (!hooksBlock || typeof hooksBlock !== "object") {
    // No hooks array at all → pass-by-vacuity (nothing to misconfigure).
    return {
      rId: "R67",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: ["settings.json has no `hooks` block — nothing to gate"],
    };
  }

  const offenders: string[] = [];
  let scanned = 0;

  for (const stage of GATED_STAGES) {
    const blocks = hooksBlock[stage];
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      const matcher = block?.matcher ?? "(unmatched)";
      const entries = Array.isArray(block?.hooks) ? block.hooks : [];
      for (const entry of entries) {
        scanned++;
        const type = entry?.type;
        if (type !== "command") {
          const cmd = entry?.command ?? "(no command)";
          offenders.push(
            `${stage}[matcher=${matcher}]: type="${type ?? "<missing>"}" command="${cmd}" (must be "command")`,
          );
        }
      }
    }
  }

  if (scanned === 0) {
    return {
      rId: "R67",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: ["no hooks declared at SessionStart / Setup / SubagentStart — nothing to gate"],
    };
  }

  if (offenders.length === 0) {
    return {
      rId: "R67",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`${scanned} hook entr${scanned === 1 ? "y" : "ies"} at gated stages; all type:command`],
    };
  }

  return {
    rId: "R67",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${offenders.length}/${scanned} hook entr${offenders.length === 1 ? "y" : "ies"} at gated stages have wrong type:`,
      ...offenders.slice(0, 10),
    ],
  };
}
