/**
 * hook-output.ts — typed, spec-correct emitters for the Claude Code hook
 * output shapes DOS hooks actually use.
 *
 * Extracted (Beck triangulation) from four hooks whose hand-rolled JSON used
 * shapes the hook runtime silently drops. Ground truth: the official hooks
 * reference digest (hooks-docs-reference.md §"Output JSON"). Each emitter
 * writes exactly one JSON object to stdout in the shape the runtime reads for
 * that event.
 *
 * YAGNI: only the four shapes the fixes needed live here — no allow/defer
 * permission decisions, no updatedInput/updatedToolOutput, no PostToolUse
 * decision:block. Add the next shape when a hook actually needs it.
 *
 * The `write` seam defaults to console.log (newline-terminated, one JSON object
 * per line — the dominant hook convention) and is injectable so the emitters
 * are unit-testable without spawning a subprocess.
 */

export type HookWriter = (line: string) => void;

const defaultWrite: HookWriter = (line) => console.log(line);

/** PreToolUse permission decisions this codebase emits (subset of the spec enum). */
export type PreToolUsePermission = "deny" | "ask";

/**
 * UserPromptSubmit: inject additionalContext into the next turn. MUST be nested
 * under hookSpecificOutput — a top-level `additionalContext` is not read.
 */
export function emitUserPromptSubmitContext(
  additionalContext: string,
  write: HookWriter = defaultWrite,
): void {
  write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext },
  }));
}

/**
 * PostToolUse: surface additionalContext after a tool ran. Nested under
 * hookSpecificOutput; the explicit `continue:true` documents the never-blocks
 * contract (PostToolUse cannot block anyway — it already ran).
 */
export function emitPostToolUseContext(
  additionalContext: string,
  write: HookWriter = defaultWrite,
): void {
  write(JSON.stringify({
    continue: true,
    hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext },
  }));
}

/**
 * PreToolUse: gate a tool call. `permissionDecision` drives the runtime —
 * "deny" blocks the call, "ask" prompts the operator. A top-level `{decision}`
 * has no binding on PreToolUse.
 */
export function emitPreToolUseDecision(
  permissionDecision: PreToolUsePermission,
  permissionDecisionReason: string,
  write: HookWriter = defaultWrite,
): void {
  write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision,
      permissionDecisionReason,
    },
  }));
}

/**
 * Stop: surface an operator-facing directive WITHOUT preventing stop. Rides on
 * the universal `systemMessage` (shown regardless of continue). `stopReason`
 * would be a no-op here — the runtime only honors it alongside continue:false.
 */
export function emitStopMessage(
  systemMessage: string,
  write: HookWriter = defaultWrite,
): void {
  write(JSON.stringify({ continue: true, systemMessage }));
}
