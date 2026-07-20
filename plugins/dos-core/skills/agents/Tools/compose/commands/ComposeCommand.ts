import type { Command } from "./types.ts";
import { composeAgent } from "../compose.ts";
import { inferTraitsFromTask } from "../traits.ts";
import { saveAgent } from "../persistence.ts";
import { logComposition, emitArtifactRow } from "../analytics.ts";
import { checkTraitConflicts } from "../conflicts.ts";

export const ComposeCommand: Command = {
  name: "compose",
  matches: () => true,
  execute: (argv, ctx) => {
    const traits = ctx.getTraits();
    let traitKeys: string[] = [];

    if (argv.traits) {
      traitKeys = argv.traits.split(",").map((t) => t.trim().toLowerCase());
    }

    if (argv.task) {
      const inferred = inferTraitsFromTask(argv.task, traits);
      traitKeys = [...new Set([...traitKeys, ...inferred])];
    }

    if (traitKeys.length === 0) {
      console.error("Error: Provide --task or --traits to compose an agent");
      console.error("Use --help for usage information");
      return 1;
    }

    const allTraitKeys = [
      ...Object.keys(traits.expertise),
      ...Object.keys(traits.personality),
      ...Object.keys(traits.approach),
    ];
    const invalidTraits = traitKeys.filter((t) => !allTraitKeys.includes(t));
    if (invalidTraits.length > 0) {
      console.error(`Error: Unknown traits: ${invalidTraits.join(", ")}`);
      console.error("Use --list to see available traits");
      return 1;
    }

    checkTraitConflicts(traitKeys);

    const criteriaList = argv.criteria ? argv.criteria.split(",").map((c) => c.trim()) : undefined;
    const agent = composeAgent(traitKeys, argv.task || "", traits, argv.timing, criteriaList);
    logComposition(agent);

    let savedPath: string | null = null;
    if (argv.save) {
      savedPath = saveAgent(agent);
      console.error(`Saved custom agent to: ${savedPath}`);
    }

    emitArtifactRow(agent, {
      persisted: savedPath !== null,
      savedPath,
      agentCount: 1,
    });

    switch (argv.output) {
      case "json":
        console.log(
          JSON.stringify(
            {
              name: agent.name,
              traits: agent.traits,
              voice: agent.voice,
              voice_id: agent.voiceId,
              voice_reason: agent.voiceReason,
              voice_settings: agent.voiceSettings,
              color: agent.color,
              expertise: agent.expertise.map((e) => e.name),
              personality: agent.personality.map((p) => p.name),
              approach: agent.approach.map((a) => a.name),
              prompt: agent.prompt,
            },
            null,
            2
          )
        );
        break;

      case "yaml":
        console.log(`name: "${agent.name}"`);
        console.log(`voice: "${agent.voice}"`);
        console.log(`voice_id: "${agent.voiceId}"`);
        console.log(`voice_reason: "${agent.voiceReason}"`);
        console.log(`color: "${agent.color}"`);
        console.log(`voice_settings:`);
        console.log(`  stability: ${agent.voiceSettings.stability}`);
        console.log(`  similarity_boost: ${agent.voiceSettings.similarity_boost}`);
        console.log(`  style: ${agent.voiceSettings.style}`);
        console.log(`  speed: ${agent.voiceSettings.speed}`);
        console.log(`  use_speaker_boost: ${agent.voiceSettings.use_speaker_boost}`);
        console.log(`  volume: ${agent.voiceSettings.volume}`);
        console.log(`traits: [${agent.traits.join(", ")}]`);
        break;

      case "summary":
        console.log(`COMPOSED AGENT: ${agent.name}`);
        console.log(`─────────────────────────────────────`);
        console.log(`Traits:      ${agent.traits.join(", ")}`);
        console.log(`Expertise:   ${agent.expertise.map((e) => e.name).join(", ") || "General"}`);
        console.log(`Personality: ${agent.personality.map((p) => p.name).join(", ")}`);
        console.log(`Approach:    ${agent.approach.map((a) => a.name).join(", ")}`);
        console.log(`Voice:       ${agent.voice} [${agent.voiceId}]`);
        console.log(`             (${agent.voiceReason})`);
        console.log(`Color:       ${agent.color}`);
        console.log(`Prosody:     stability:${agent.voiceSettings.stability} style:${agent.voiceSettings.style} speed:${agent.voiceSettings.speed} volume:${agent.voiceSettings.volume}`);
        break;

      default:
        console.log(agent.prompt);
    }
    return 0;
  },
};
