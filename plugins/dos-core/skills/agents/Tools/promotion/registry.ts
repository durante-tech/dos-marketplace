import { spawnSync } from "child_process";
import { POLL_BACKOFF_MS } from "./constants.ts";
import type { StepResult } from "./types.ts";

/**
 * Invoke `claude agents --setting-sources <scope>` and parse the text output.
 * 2.1.117 lacks `--json`; we parse `  <name> · <model>` lines per §14.4.
 */
export function runClaudeAgents(scope: string): {
  entries: { name: string; model: string }[];
  ok: boolean;
  raw: string;
} {
  const result = spawnSync("claude", ["agents", "--setting-sources", scope], {
    encoding: "utf-8",
    timeout: 2000,
  });
  const raw = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.error || result.status !== 0) {
    return { entries: [], ok: false, raw };
  }
  const entries: { name: string; model: string }[] = [];
  for (const line of (result.stdout || "").split("\n")) {
    const m = line.match(/^\s{2}(\S[^·\n]*?)\s·\s(\S+)\s*$/);
    if (m) {
      entries.push({ name: m[1].trim(), model: m[2].trim() });
    }
  }
  return { entries, ok: true, raw };
}

/**
 * Poll `claude agents` with exponential backoff looking for a name/scope match.
 * Returns true if found within the 7.5s budget (§10.2); false on timeout.
 */
export function pollForRegistration(name: string, scope: string): boolean {
  for (const delay of POLL_BACKOFF_MS) {
    const waitEnd = Date.now() + delay;
    while (Date.now() < waitEnd) {
      const chunk = Math.min(50, waitEnd - Date.now());
      if (chunk > 0) Bun.sleepSync(chunk);
    }
    const { entries, ok } = runClaudeAgents(scope);
    if (!ok) continue;
    if (entries.some((e) => e.name === name)) return true;
  }
  return false;
}

/**
 * Poll for disappearance (used by --demote) — same backoff, inverted predicate.
 */
export function pollForDisappearance(name: string, scope: string): boolean {
  for (const delay of POLL_BACKOFF_MS) {
    const waitEnd = Date.now() + delay;
    while (Date.now() < waitEnd) {
      const chunk = Math.min(50, waitEnd - Date.now());
      if (chunk > 0) Bun.sleepSync(chunk);
    }
    const { entries, ok } = runClaudeAgents(scope);
    if (!ok) continue;
    if (!entries.some((e) => e.name === name)) return true;
  }
  return false;
}

/**
 * Scope-priority collision refusal (§9.2). Checks user + project scopes for a
 * pre-existing name. Note: 2.1.117 `--setting-sources` accepts user|project|local.
 * `managed` and `plugin` priorities are spec-aspirational; not observable via
 * Phase 1 CLI (§9.1 CLI reality note in PRD §D3).
 */
export function checkScopeCollision(
  name: string,
  targetScope: "user" | "project",
): { collision: boolean; existingScope: string | null } {
  const priority: Array<"user" | "project"> = ["project", "user"];
  const targetIdx = priority.indexOf(targetScope);
  for (let i = 0; i < priority.length; i++) {
    const s = priority[i];
    const { entries } = runClaudeAgents(s);
    if (entries.some((e) => e.name === name)) {
      if (i < targetIdx) return { collision: true, existingScope: s };
      if (i === targetIdx) return { collision: true, existingScope: s };
    }
  }
  return { collision: false, existingScope: null };
}

export function enforceNoScopeCollision(
  targetName: string,
  scope: "user" | "project",
): StepResult<void> {
  const collision = checkScopeCollision(targetName, scope);
  if (collision.collision) {
    console.error(
      JSON.stringify({
        error: "scope_collision",
        target_scope: scope,
        existing_scope: collision.existingScope,
        suggestion: `run 'ComposeAgent --demote ${targetName}' first, or choose a different name`,
      }),
    );
    return { ok: false, code: 2 };
  }
  return { ok: true, value: undefined };
}
