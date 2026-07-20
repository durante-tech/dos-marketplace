import { readFileSync, existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import type { Command } from "./types.ts";
import { COUNCILS_PATH } from "../constants.ts";
import { composeAgent } from "../compose.ts";
import { logComposition, emitArtifactRow } from "../analytics.ts";

// Two member shapes (see councils.yaml comments + MEMORY/CANONICAL/specialist-directory.md):
//   - PersistentMember: routes to ~/.claude/agents/<Name>.md via Task(subagent_type)
//   - TraitsMember: ad-hoc trait composition via ComposeAgent.ts
type PersistentMember = { persistent: string; role?: string };
type TraitsMember = { role: string; traits: string[] };
type CouncilMember = PersistentMember | TraitsMember;

function isPersistent(m: CouncilMember): m is PersistentMember {
  return typeof (m as PersistentMember).persistent === "string";
}

let cachedCouncils: Record<string, CouncilMember[]> | null = null;

function loadCouncils(): Record<string, CouncilMember[]> {
  if (cachedCouncils) return cachedCouncils;
  if (!existsSync(COUNCILS_PATH)) {
    console.error(`Error: Councils config not found at ${COUNCILS_PATH}`);
    process.exit(1);
  }
  const content = readFileSync(COUNCILS_PATH, "utf-8");
  cachedCouncils = parseYaml(content) as Record<string, CouncilMember[]>;
  return cachedCouncils;
}

export const CouncilCommand: Command = {
  name: "council",
  matches: (argv) => Boolean(argv.council),
  execute: (argv, ctx) => {
    const councilType = argv.council!.toLowerCase();
    const councils = loadCouncils();

    if (!councils[councilType]) {
      console.error(`Error: Unknown council type "${councilType}". Available: ${Object.keys(councils).join(", ")}`);
      return 1;
    }

    const traits = ctx.getTraits();
    const cohortSize = councils[councilType].length;
    const councilMembers = councils[councilType].map((member) => {
      if (isPersistent(member)) {
        // Persistent specialist subagent — orchestrator spawns via Task(subagent_type).
        // The agent file at ~/.claude/agents/<persistent>.md owns the prompt, voice
        // prosody, permissions stack, and Subagent Algorithm Profile. We emit only
        // the routing marker; no prompt composition needed.
        return {
          role: member.role ?? member.persistent,
          kind: "specialist" as const,
          subagent_type: member.persistent,
        };
      }

      // Trait composition — legacy ad-hoc path. Orchestrator spawns via
      // Task(subagent_type: "general-purpose") with the composed prompt.
      const agent = composeAgent(member.traits, argv.task || "", traits, argv.timing);
      logComposition(agent, councilType);
      emitArtifactRow(agent, {
        persisted: false,
        savedPath: null,
        agentCount: cohortSize,
      });
      return {
        role: member.role,
        kind: "composed" as const,
        subagent_type: "general-purpose",
        name: agent.name,
        traits: member.traits,
        voice: agent.voice,
        voice_id: agent.voiceId,
        voice_settings: agent.voiceSettings,
        color: agent.color,
        prompt: agent.prompt,
      };
    });

    console.log(JSON.stringify(councilMembers, null, 2));
    return 0;
  },
};
