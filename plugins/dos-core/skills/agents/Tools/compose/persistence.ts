import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync, unlinkSync } from "fs";
import type { ComposedAgent, TraitsData } from "./types.ts";
import { CUSTOM_AGENTS_DIR } from "./constants.ts";
import { hexToNamedColor } from "./color.ts";
import { composeAgent, slugify } from "./compose.ts";
import { buildSavedAgentBody } from "./render.ts";

export function saveAgent(agent: ComposedAgent): string {
  mkdirSync(CUSTOM_AGENTS_DIR, { recursive: true });

  const slug = slugify(agent.name);
  const filePath = `${CUSTOM_AGENTS_DIR}/${slug}.md`;
  const today = new Date().toISOString().split("T")[0];

  const titleParts: string[] = [];
  if (agent.personality.length) titleParts.push(agent.personality[0].name);
  if (agent.expertise.length) titleParts.push(agent.expertise[0].name);
  const personaTitle =
    titleParts.length > 0 ? "The " + titleParts.join(" ") : "Custom Specialist";

  const flatten = (s: string) => s.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  const bgParts: string[] = [];
  for (const e of agent.expertise) bgParts.push(flatten(e.description));
  for (const p of agent.personality) bgParts.push(flatten(p.description));
  for (const a of agent.approach) bgParts.push(flatten(a.description));
  const personaBackground = bgParts.length > 0
    ? bgParts.join(". ").replace(/\.\./g, ".").replace(/\. *$/, "") + "."
    : "Composed specialist agent.";

  const expertiseNames = agent.expertise.map((e) => e.name);
  const personalityNames = agent.personality.map((p) => p.name.toLowerCase());
  const description =
    expertiseNames.length > 0
      ? `${agent.name} — ${expertiseNames.join(" and ")} with ${personalityNames.join(", ")} approach.`
      : `${agent.name} — custom agent with ${personalityNames.join(", ")} approach.`;

  const body = buildSavedAgentBody(agent, personaTitle, slug);

  const namedColor = hexToNamedColor(agent.color);
  const content = `---
name: ${slug}
description: "${description.replace(/"/g, '\\"')}"
model: opus
tools: Bash, Read, Write, Edit, MultiEdit, Grep, Glob, WebFetch, WebSearch, TodoWrite
color: ${namedColor}

# DOS metadata (Claude Code parser ignores unknown fields; these are consumed by voice.sh + identity tooling)
display_name: "${agent.name.replace(/"/g, '\\"')}"
color_hex: "${agent.color}"
voiceId: "${agent.voiceId}"
voice:
  stability: ${agent.voiceSettings.stability}
  similarity_boost: ${agent.voiceSettings.similarity_boost}
  style: ${agent.voiceSettings.style}
  speed: ${agent.voiceSettings.speed}
  use_speaker_boost: ${agent.voiceSettings.use_speaker_boost}
  volume: ${agent.voiceSettings.volume}
persona:
  name: "${agent.name.replace(/"/g, '\\"')}"
  title: "${personaTitle.replace(/"/g, '\\"')}"
  background: "${personaBackground.replace(/"/g, '\\"')}"
custom_agent: true
created: "${today}"
traits: [${agent.traits.map((t) => `"${t}"`).join(", ")}]
source: "ComposeAgent"
---

${body}
`;

  // writeArtifact:exempt — composed-agent persistence (runtime state)
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

export function loadAgent(name: string, traits: TraitsData, task?: string): ComposedAgent | null {
  const slug = slugify(name);
  const filePath = `${CUSTOM_AGENTS_DIR}/${slug}.md`;

  if (!existsSync(filePath)) {
    console.error(`Error: Custom agent "${name}" not found at ${filePath}`);
    console.error("Use --list-saved to see available agents");
    return null;
  }

  const content = readFileSync(filePath, "utf-8");
  const traitsMatch = content.match(/^traits:\s*\[([^\]]+)\]/m);

  if (!traitsMatch) {
    console.error(`Error: Could not extract traits from ${filePath}`);
    return null;
  }

  const traitKeys = traitsMatch[1]
    .replace(/"/g, "")
    .split(",")
    .map((t) => t.trim());

  return composeAgent(traitKeys, task || "", traits);
}

export function listSavedAgents(): void {
  if (!existsSync(CUSTOM_AGENTS_DIR)) {
    console.log("No custom agents directory found. Use --save to create one.");
    return;
  }

  const files = readdirSync(CUSTOM_AGENTS_DIR).filter((f) => f.endsWith(".md") && f !== "README.md");

  if (files.length === 0) {
    console.log("No saved custom agents found. Use --save to create one.");
    return;
  }

  console.log("SAVED CUSTOM AGENTS\n");
  for (const file of files) {
    const content = readFileSync(`${CUSTOM_AGENTS_DIR}/${file}`, "utf-8");
    const nameMatch = content.match(/^name:\s*"?([^"\n]+)"?/m);
    const traitsMatch = content.match(/^traits:\s*\[([^\]]+)\]/m);
    const colorMatch = content.match(/^color:\s*"?([^"\n]+)"?/m);
    const voiceIdMatch = content.match(/^voiceId:\s*"?([^"\n]+)"?/m);
    const slug = file.replace(/\.md$/, "");

    const name = nameMatch?.[1] || slug;
    const traits = traitsMatch?.[1]?.replace(/"/g, "") || "unknown";
    const color = colorMatch?.[1] || "none";

    console.log(`  ${slug.padEnd(25)} ${name}`);
    console.log(`${"".padEnd(27)} traits: ${traits}`);
    console.log(`${"".padEnd(27)} color: ${color}  voice: ${voiceIdMatch?.[1]?.slice(0, 12) || "none"}...`);
    console.log();
  }
}

export function deleteAgent(name: string): boolean {
  const slug = slugify(name);
  const filePath = `${CUSTOM_AGENTS_DIR}/${slug}.md`;

  if (!existsSync(filePath)) {
    console.error(`Error: Custom agent "${name}" not found at ${filePath}`);
    return false;
  }

  unlinkSync(filePath);
  console.log(`Deleted custom agent: ${slug} (${filePath})`);
  return true;
}
