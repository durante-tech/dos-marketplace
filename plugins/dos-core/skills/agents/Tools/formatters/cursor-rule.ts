/**
 * cursor-rule.ts — RFC-0018 amendment cursor-rule formatter (Phase 2 subset).
 */

export interface CursorRuleInput {
  name: string;
  description: string;
  body: string;
  toolsAllowlist: string;
  globs?: string;
  alwaysApply?: boolean;
  traits?: string[];
  voiceId?: string;
}

export function formatCursorRule(input: CursorRuleInput): string {
  const globs = input.globs?.trim() || "**/*";
  const alwaysApply = input.alwaysApply === true;
  const traits = input.traits?.length ? input.traits.join(", ") : "";
  const voice = input.voiceId ? input.voiceId : "";

  const warning = [
    "> ⚠ This agent was authored with a tool allowlist that the target harness",
    "> does not enforce. Trust this agent only with tools the harness itself permits.",
    `> Canonical allowlist: ${input.toolsAllowlist}`,
    "",
  ].join("\n");

  const metaComments = [
    voice ? `<!-- dos:voice:${voice} -->` : "",
    traits ? `<!-- dos:traits:${traits} -->` : "",
    "<!-- dos:owned -->",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "---",
    `description: ${JSON.stringify(input.description)}`,
    `globs: ${globs}`,
    `alwaysApply: ${alwaysApply}`,
    "---",
    metaComments,
    warning,
    input.body.trim(),
    "",
  ].join("\n");
}

export function defaultCursorRulePath(projectDir: string, name: string): string {
  return `${projectDir}/.cursor/rules/${name}.mdc`;
}
