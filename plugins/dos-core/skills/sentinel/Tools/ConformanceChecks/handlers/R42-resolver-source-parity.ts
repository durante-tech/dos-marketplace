/**
 * R42 — Project resolver source-of-truth parity.
 *
 * Background: 2026-05-09 incident. The legacy statusline-command.sh resolver
 * read PROJECTS.md exclusively while the V11 resolveProjectSlug() read
 * .dos-projects.json exclusively. cd ~/Experiments/altyaa rendered correctly
 * in the V11 segment (JSON canonical) but "⚠ unmapped project" in the
 * legacy segment (PROJECTS.md gap) — same operator, same cwd, contradictory
 * status.
 *
 * Convention (post-incident): both resolvers MUST consult .dos-projects.json
 * as the canonical source. PROJECTS.md is fallback / Stack metadata only.
 *
 * Detection: scan resolver source files for the sentinel string
 * `.dos-projects.json`. The two resolvers are:
 *   1. ~/.claude/statusline-command.sh           (legacy bash resolver)
 *   2. ~/.claude/hooks/lib/project-context.ts    (V11 TS resolver)
 *
 * Both must reference `.dos-projects.json` either by string literal, env
 * variable, or function call to a shared loader. If either omits the
 * canonical source, the rule fails.
 *
 * Pass: both resolver files reference .dos-projects.json.
 * Fail: one or both omit the canonical source string.
 * Not_applicable: neither resolver file exists (non-DOS install).
 *
 * Exempt pragma: `// conformance:R42-exempt <reason>` on the file's first 5 lines.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Both project resolvers (legacy statusline-command.sh + V11 hooks/lib/project-context.ts) must consult .dos-projects.json (canonical) as their primary source";
const CANONICAL_NEEDLE = ".dos-projects.json";
const EXEMPT_PRAGMA = /conformance:R42-exempt/;

function checkFileMentionsCanonical(path: string): { exists: boolean; mentions: boolean; exempt: boolean } {
  if (!existsSync(path)) return { exists: false, mentions: false, exempt: false };
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    return { exists: true, mentions: false, exempt: false };
  }
  const firstLines = content.split("\n").slice(0, 5).join("\n");
  if (EXEMPT_PRAGMA.test(firstLines)) return { exists: true, mentions: false, exempt: true };
  return { exists: true, mentions: content.includes(CANONICAL_NEEDLE), exempt: false };
}

export async function r42ResolverSourceParity(ctx: CheckContext): Promise<CheckResult> {
  const home = homedir();
  const resolvers = [
    {
      label: "legacy statusline (bash)",
      path: join(home, ".claude", "statusline-command.sh"),
    },
    {
      label: "V11 TS resolver",
      path: join(home, ".claude", "hooks", "lib", "project-context.ts"),
    },
  ];

  const checked = resolvers.map((r) => ({ ...r, ...checkFileMentionsCanonical(r.path) }));
  const present = checked.filter((r) => r.exists);

  if (present.length === 0) {
    return {
      rId: "R42",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`neither resolver file installed — non-DOS install`],
    };
  }

  const offenders = present.filter((r) => !r.mentions && !r.exempt);
  if (offenders.length === 0) {
    return {
      rId: "R42",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: present.map(
        (r) => `${r.label} references .dos-projects.json${r.exempt ? " (exempt)" : ""}`,
      ),
    };
  }

  return {
    rId: "R42",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${offenders.length} resolver(s) do not reference .dos-projects.json:`,
      ...offenders.map((r) => `  • ${r.label} at ${r.path}`),
      `Fix: every resolver must read .dos-projects.json as the canonical source. PROJECTS.md is fallback only.`,
    ],
  };
}
