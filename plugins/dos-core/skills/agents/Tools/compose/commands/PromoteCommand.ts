import type { Command } from "./types.ts";
import {
  promoteAgent,
  ephemeralPromote,
  DEFAULT_PROMOTE_N_SESSIONS,
  DEFAULT_FRESHNESS_DAYS,
  DEFAULT_TOOLS_ALLOWLIST,
} from "../../promotion/index.ts";
import { promoteCursorRule } from "../../promotion/cursor-rule.ts";
import { coerceScope, coerceInt, coerceFloat, SCOPE_ERROR } from "../coerce.ts";
import type { AgentArgs } from "../parseArgs.ts";

export function hasCursorRuleOnlyFlags(argv: AgentArgs): boolean {
  return Boolean(argv["auto-attach-globs"] || argv["always-apply"]);
}

export function cursorRuleGlobs(argv: AgentArgs): string {
  return argv["auto-attach-globs"] || "**/*";
}

export const PromoteCommand: Command = {
  name: "promote",
  matches: (argv) => Boolean(argv.promote),
  execute: (argv) => {
    const format = argv.format ?? "claude-agent";

    if (argv.ephemeral && format !== "claude-agent") {
      process.stderr.write(
        JSON.stringify({
          error: "format_incompatible_with_ephemeral",
          format,
          suggestion: "drop --ephemeral or use --format claude-agent",
        }) + "\n",
      );
      return 2;
    }

    if (
      hasCursorRuleOnlyFlags(argv) &&
      format !== "cursor-rule"
    ) {
      process.stderr.write(
        JSON.stringify({
          error: "flag_requires_cursor_rule_format",
          current_format: format,
        }) + "\n",
      );
      return 2;
    }

    let scope = coerceScope(argv.scope);
    if (!scope) {
      if (format === "claude-agent") {
        console.error(SCOPE_ERROR);
        return 1;
      }
      scope = "project";
    }
    const n = coerceInt(argv["promote-n-sessions"], DEFAULT_PROMOTE_N_SESSIONS);
    const days = coerceInt(argv["freshness-days"], DEFAULT_FRESHNESS_DAYS);
    const minDays = coerceInt(argv["promote-min-days"], 0);
    const minRatio = coerceFloat(argv["promote-min-persisted-ratio"], 0.0);

    if (argv.ephemeral) {
      return ephemeralPromote({
        slug: argv.promote!,
        exec: Boolean(argv["ephemeral-exec"]),
        abortSeconds: 3,
        nSessions: n,
        freshnessDays: days,
        minDaysSpread: minDays,
        minPersistedRatio: minRatio,
        force: Boolean(argv["force-promote"]),
      });
    }

    if (format === "cursor-rule") {
      return promoteCursorRule({
        slug: argv.promote!,
        scope,
        tools: argv.tools || DEFAULT_TOOLS_ALLOWLIST,
        nSessions: n,
        freshnessDays: days,
        minDaysSpread: minDays,
        minPersistedRatio: minRatio,
        force: Boolean(argv["force-promote"]),
        dryRun: Boolean(argv["dry-run"]),
        globs: cursorRuleGlobs(argv),
        alwaysApply: Boolean(argv["always-apply"]),
      });
    }

    return promoteAgent({
      slug: argv.promote!,
      scope,
      tools: argv.tools || DEFAULT_TOOLS_ALLOWLIST,
      nSessions: n,
      freshnessDays: days,
      minDaysSpread: minDays,
      minPersistedRatio: minRatio,
      force: Boolean(argv["force-promote"]),
      dryRun: Boolean(argv["dry-run"]),
    });
  },
};
