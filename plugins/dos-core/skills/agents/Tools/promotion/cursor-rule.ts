import { existsSync, mkdirSync, renameSync, writeFileSync } from "fs";
import { loadComposeAuthoredAgent, validatePromotionRequest } from "./source.ts";
import { evaluateGate, enforcePromotionGate, auditForcedPromotion } from "./gate.ts";
import { formatCursorRule, defaultCursorRulePath } from "../formatters/cursor-rule.ts";
import type { PromoteOptions } from "./types.ts";

export interface CursorRulePromoteOptions extends PromoteOptions {
  globs: string;
  alwaysApply: boolean;
}

export function promoteCursorRule(opts: CursorRulePromoteOptions): number {
  const validation = validatePromotionRequest(opts);
  if (!validation.ok) return validation.code;

  if (opts.scope !== "project") {
    process.stderr.write(
      JSON.stringify({
        error: "scope_requires_project",
        format: "cursor-rule",
        detail: "workspace-level formats require --scope project",
      }) + "\n",
    );
    return 1;
  }

  const source = loadComposeAuthoredAgent(opts.slug);
  if (!source.ok) return source.code;

  const gate = evaluateGate(source.value.identity, opts);
  const gateCheck = enforcePromotionGate(gate, source.value.identity, opts.force);
  if (!gateCheck.ok) return gateCheck.code;

  const name = String(source.value.frontmatter.name || opts.slug);
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const targetPath = defaultCursorRulePath(projectDir, name);

  if (existsSync(targetPath) && !opts.force) {
    process.stderr.write(
      JSON.stringify({
        error: "file_collision",
        existing_path: targetPath,
      }) + "\n",
    );
    return 2;
  }

  const content = formatCursorRule({
    name,
    description: String(source.value.frontmatter.description || name),
    body: source.value.body,
    toolsAllowlist: opts.tools,
    globs: opts.globs,
    alwaysApply: opts.alwaysApply,
    traits: source.value.traits,
    voiceId:
      typeof source.value.frontmatter.voiceId === "string"
        ? source.value.frontmatter.voiceId
        : undefined,
  });

  if (opts.dryRun) {
    console.log(`--- DRY RUN (cursor-rule) ---`);
    console.log(`would write: ${targetPath}`);
    console.log(content.slice(0, 400));
    return 0;
  }

  if (opts.force && !gate.permitted) {
    auditForcedPromotion(opts.slug, source.value.identity, gate, opts.scope);
  }

  mkdirSync(`${projectDir}/.cursor/rules`, { recursive: true });
  const tmp = `${targetPath}.tmp-${process.pid}`;
  // writeArtifact:exempt — atomic tmp write (rename follows)
  writeFileSync(tmp, content, { encoding: "utf-8", mode: 0o644 });
  renameSync(tmp, targetPath);

  console.log(`[ComposeAgent] promoted ${opts.slug} → ${targetPath} (format: cursor-rule)`);
  return 0;
}
