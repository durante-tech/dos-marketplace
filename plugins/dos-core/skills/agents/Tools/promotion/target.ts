import { mkdirSync, writeFileSync, renameSync } from "fs";
import { AGENTS_DIR_USER, VALID_SLUG_PATTERN } from "./constants.ts";
import { pollForRegistration } from "./registry.ts";
import type { GateDecision, LoadedAgent, PromoteOptions, PromotionTarget, StepResult } from "./types.ts";

/**
 * Build the promoted-agent file content from the source custom-agent file,
 * replacing `tools:` with the caller-supplied allowlist. Canonical Claude Code
 * fields stay at top; DOS metadata below is preserved verbatim (§6.1 step 7).
 */
export function buildPromotedAgentContent(
  rawFrontmatter: string,
  body: string,
  toolsAllowlist: string,
): string {
  const lines = rawFrontmatter.split("\n");
  let toolsFound = false;
  const replacedLines = lines.map((line) => {
    if (/^tools\s*:/.test(line)) {
      toolsFound = true;
      return `tools: ${toolsAllowlist}`;
    }
    return line;
  });
  if (!toolsFound) {
    replacedLines.splice(4, 0, `tools: ${toolsAllowlist}`);
  }
  return `---\n${replacedLines.join("\n")}\n---\n${body}`;
}

export function resolvePromotionTarget(
  source: LoadedAgent,
  opts: PromoteOptions,
): StepResult<PromotionTarget> {
  const targetDir =
    opts.scope === "user"
      ? AGENTS_DIR_USER
      : `${process.env.CLAUDE_PROJECT_DIR || process.cwd()}/.claude/agents`;

  if (opts.scope === "project" && !process.env.CLAUDE_PROJECT_DIR) {
    console.error(
      `[ComposeAgent] --scope project requires CLAUDE_PROJECT_DIR env var; falling back to cwd/.claude/agents. Set CLAUDE_PROJECT_DIR explicitly to avoid ambiguity.`,
    );
  }

  const targetName = String(source.frontmatter.name || opts.slug);
  if (!VALID_SLUG_PATTERN.test(targetName)) {
    console.error(
      `[ComposeAgent] frontmatter name '${targetName}' violates ^[a-z][a-z0-9-]*$ — custom-agent file is corrupt.`,
    );
    return { ok: false, code: 2 };
  }
  const targetPath = `${targetDir}/${targetName}.md`;
  const content = buildPromotedAgentContent(source.rawFrontmatter, source.body, opts.tools);

  return { ok: true, value: { targetDir, targetName, targetPath, content } };
}

export function previewPromotion(target: PromotionTarget, gate: GateDecision): number {
  console.log(`--- DRY RUN ---`);
  console.log(`would write: ${target.targetPath}`);
  console.log(`gate: ${gate.permitted ? "permitted" : "REFUSED"} (${gate.reason})`);
  console.log(`--- BODY PREVIEW (first 400 chars) ---`);
  console.log(target.content.slice(0, 400));
  console.log(`--- END DRY RUN ---`);
  return 0;
}

export function writePromotedAgentAtomically(target: PromotionTarget): void {
  mkdirSync(target.targetDir, { recursive: true });
  const tmp = `${target.targetPath}.tmp-${process.pid}`;
  // writeArtifact:exempt — atomic tmp write (rename follows)
  writeFileSync(tmp, target.content, { encoding: "utf-8", mode: 0o644 });
  renameSync(tmp, target.targetPath);
}

export function reportPromotionOutcome(
  target: PromotionTarget,
  traits: string[],
  scope: "user" | "project",
  slug: string,
): number {
  const registered = pollForRegistration(target.targetName, scope);
  const traitList = traits.join(", ");

  if (registered) {
    console.log(`✓ Promoted '${target.targetName}' → ${target.targetPath}`);
    console.log(`  Composition: ${traitList} (${traits.length} traits)`);
    console.log(`  Activate NOW: run \`/agents\` in this session`);
    console.log(`  Or: will auto-load on next \`claude\` session start`);
    console.log(`  Demote anytime: \`ComposeAgent --demote ${slug}\``);
    return 0;
  }

  console.log(`✓ Wrote '${target.targetName}' → ${target.targetPath}`);
  console.log(`  Composition: ${traitList} (${traits.length} traits)`);
  console.log(`  Claude Code registry has NOT re-scanned yet.`);
  console.log(`  Activate NOW: run \`/agents\` in this session, or restart \`claude\`.`);
  console.log(`  Demote anytime: \`ComposeAgent --demote ${slug}\``);
  return 3;
}
