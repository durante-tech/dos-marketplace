import { existsSync, readFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import { CUSTOM_AGENTS_DIR, VALID_SLUG_PATTERN } from "./constants.ts";
import { computeCompositionIdentity } from "./identity.ts";
import type { LoadedAgent, PromoteOptions, StepResult } from "./types.ts";

/**
 * Read a custom-agent source file and return frontmatter + body.
 * Parses the YAML block between the first two `---` delimiters.
 */
export function readCustomAgentFile(slug: string): {
  frontmatter: Record<string, unknown>;
  body: string;
  rawFrontmatter: string;
} {
  const filePath = `${CUSTOM_AGENTS_DIR}/${slug}.md`;
  if (!existsSync(filePath)) {
    throw new Error(`custom-agent not found: ${filePath}`);
  }
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`custom-agent ${slug} has no frontmatter block`);
  }
  const rawFrontmatter = match[1];
  const body = match[2];
  let frontmatter: Record<string, unknown> = {};
  try {
    frontmatter = (parseYaml(rawFrontmatter) as Record<string, unknown>) || {};
  } catch (e) {
    throw new Error(`custom-agent ${slug} frontmatter unparseable: ${e}`);
  }
  return { frontmatter, body, rawFrontmatter };
}

export function validatePromotionRequest(opts: PromoteOptions): StepResult<void> {
  if (!VALID_SLUG_PATTERN.test(opts.slug)) {
    console.error(
      JSON.stringify({
        error: "invalid_slug",
        slug: opts.slug,
        pattern: VALID_SLUG_PATTERN.source,
        suggestion: "promotion names must match ^[a-z][a-z0-9-]*$",
      }),
    );
    return { ok: false, code: 2 };
  }
  return { ok: true, value: undefined };
}

export function loadComposeAuthoredAgent(slug: string): StepResult<LoadedAgent> {
  let source: { frontmatter: Record<string, unknown>; body: string; rawFrontmatter: string };
  try {
    source = readCustomAgentFile(slug);
  } catch (e) {
    console.error(`[ComposeAgent] ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, code: 1 };
  }

  const fm = source.frontmatter;
  if (fm.custom_agent !== true || fm.source !== "ComposeAgent") {
    console.error(
      `[ComposeAgent] ${slug} is missing 'custom_agent: true' or 'source: "ComposeAgent"' — not a ComposeAgent-authored file. Refusing to promote.`,
    );
    return { ok: false, code: 1 };
  }

  const title =
    typeof fm.display_name === "string"
      ? fm.display_name
      : typeof fm.name === "string"
        ? fm.name
        : slug;
  const traits = Array.isArray(fm.traits)
    ? (fm.traits as unknown[]).map((t) => String(t))
    : [];
  const identity = computeCompositionIdentity(title, traits);

  return {
    ok: true,
    value: {
      frontmatter: source.frontmatter,
      body: source.body,
      rawFrontmatter: source.rawFrontmatter,
      title,
      traits,
      identity,
    },
  };
}
