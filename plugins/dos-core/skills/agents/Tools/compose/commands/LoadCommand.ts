import type { Command } from "./types.ts";
import { loadAgent } from "../persistence.ts";

export const LoadCommand: Command = {
  name: "load",
  matches: (argv) => Boolean(argv.load),
  execute: (argv, ctx) => {
    const agent = loadAgent(argv.load!, ctx.getTraits(), argv.task);
    if (!agent) return 1;

    switch (argv.output) {
      case "json":
        console.log(JSON.stringify({
          name: agent.name,
          traits: agent.traits,
          voice: agent.voice,
          voice_id: agent.voiceId,
          voice_settings: agent.voiceSettings,
          color: agent.color,
          prompt: agent.prompt,
        }, null, 2));
        break;
      case "summary":
        console.log(`LOADED AGENT: ${agent.name}`);
        console.log(`Traits: ${agent.traits.join(", ")}`);
        console.log(`Voice: ${agent.voice} [${agent.voiceId}]`);
        console.log(`Color: ${agent.color}`);
        break;
      default:
        console.log(agent.prompt);
    }
    return 0;
  },
};
