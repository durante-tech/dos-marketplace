import { readFileSync, existsSync } from "fs";
import type { ComposedAgent } from "./types.ts";
import { SAVED_AGENT_TEMPLATE_PATH } from "./constants.ts";
import { compileTemplate, type TemplateDelegate } from "./template.ts";

let cached: TemplateDelegate | null = null;

function loadSavedAgentTemplate(): TemplateDelegate {
  if (cached) return cached;
  if (!existsSync(SAVED_AGENT_TEMPLATE_PATH)) {
    console.error(`Error: Saved-agent template not found at ${SAVED_AGENT_TEMPLATE_PATH}`);
    process.exit(1);
  }
  const content = readFileSync(SAVED_AGENT_TEMPLATE_PATH, "utf-8");
  cached = compileTemplate(content);
  return cached;
}

export function buildSavedAgentBody(
  agent: ComposedAgent,
  personaTitle: string,
  slug: string
): string {
  const expertiseBlock = agent.expertise.length
    ? agent.expertise
        .map((e) => `### ${e.name}\n\n${e.description}`)
        .join("\n\n")
    : "";

  const personalityBlock = agent.personality.length
    ? agent.personality
        .map((p) => `- **${p.name}**: ${p.description}`)
        .join("\n")
    : "";

  const approachBlock = agent.approach.length
    ? agent.approach.map((a) => `- **${a.name}**: ${a.description}`).join("\n")
    : "";

  const identityList = [
    ...agent.expertise.map((e) => `- **${e.name}**: ${e.description}`),
    ...agent.personality.map((p) => `- **${p.name}**: ${p.description}`),
  ].join("\n");

  const combinedList = [
    ...agent.expertise.map((e) => `- ${e.name}`),
    ...agent.personality.map((p) => `- ${p.name} approach`),
    ...agent.approach.map((a) => `- ${a.name} methodology`),
  ].join("\n");

  const template = loadSavedAgentTemplate();
  return template({
    name: agent.name,
    personaTitle,
    slug,
    voiceId: agent.voiceId,
    vs: agent.voiceSettings,
    traitsCsv: agent.traits.join(","),
    expertiseBlock,
    personalityBlock,
    approachBlock,
    identityList,
    combinedList,
  });
}
