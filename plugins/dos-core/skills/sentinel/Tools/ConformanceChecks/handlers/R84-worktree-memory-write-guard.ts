/**
 * R84 — WorktreeMemoryWriteGuard must be registered, present, and tested.
 *
 * Confirms the PreToolUse guard that mechanizes the RFC-0137 silent-discard
 * contract is actually wired end-to-end: the hook is registered in settings.json
 * (across the write matchers), the hook file exists, and its characterization
 * test file exists. The dangerous state this catches is PARTIAL wiring —
 * registered-but-missing (a dangling command Claude Code would fail to spawn) or
 * present-but-unregistered (a guard that silently never fires).
 *
 * Worktree-safe resolution (RFC-0136 pattern): resolve the `.claude` root from
 * the checkout under test FIRST (`${repoRoot}/Releases/v0.0.19/.claude`), then
 * fall back to the live `${HOME}/.claude`. In a worktree where the submodule is
 * not checked out, neither resolves and the rule returns not_applicable rather
 * than a false fail.
 *
 * Tier: warning (default for new presence checks).
 * Spec: RFC-0137. PRD: MEMORY/WORK/active/20260626-011756_worktree-memory-write-guard.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "WorktreeMemoryWriteGuard PreToolUse hook must be registered in settings.json, present, and have a characterization test (RFC-0137)";

const HOME = homedir();
const SUBMODULE_REL = "Releases/v0.0.19/.claude";
const SETTINGS_REL = "settings.json";
const HOOK_REL = "hooks/WorktreeMemoryWriteGuard.hook.ts";
const TEST_REL = "hooks/WorktreeMemoryWriteGuard.test.ts";
const HOOK_CMD = "WorktreeMemoryWriteGuard.hook.ts";

function resolveClaudeRoot(repoRoot: string): string | null {
  for (const root of [join(repoRoot, SUBMODULE_REL), join(HOME, ".claude")]) {
    if (existsSync(join(root, SETTINGS_REL))) return root;
  }
  return null;
}

export async function r84WorktreeMemoryWriteGuard(ctx: CheckContext): Promise<CheckResult> {
  const root = resolveClaudeRoot(ctx.repoRoot);
  if (!root) {
    return {
      rId: "R84",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `No .claude/settings.json resolvable from ${join(ctx.repoRoot, SUBMODULE_REL)} or ${join(HOME, ".claude")} (submodule not checked out in this tree)`,
      ],
    };
  }

  const settingsPath = join(root, SETTINGS_REL);
  let settings = "";
  try {
    settings = readFileSync(settingsPath, "utf-8");
  } catch {
    // unreadable settings — treated as not-registered below
  }

  const registered = settings.includes(HOOK_CMD);
  const hookExists = existsSync(join(root, HOOK_REL));
  const testExists = existsSync(join(root, TEST_REL));

  const evidence = [
    `root=${root}`,
    `registered=${registered}`,
    `hook=${hookExists}`,
    `test=${testExists}`,
  ];

  if (registered && hookExists && testExists) {
    return { rId: "R84", requirement: REQUIREMENT, status: "pass", evidence };
  }

  return {
    rId: "R84",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      ...evidence,
      registered && !hookExists ? "DANGLING: registered in settings.json but hook file missing" : "",
      !registered && hookExists ? "SILENT: hook file present but NOT registered in settings.json" : "",
      !testExists ? "characterization test missing (RFC-0137 §6 gate)" : "",
    ].filter(Boolean),
  };
}
