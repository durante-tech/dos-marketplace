export type {
  ProsodySettings,
  TraitDefinition,
  VoiceMapping,
  VoiceRegistryEntry,
  TraitsData,
  ComposedAgent,
  ClaudeCodeColorName,
  OutputFormat,
  Timing,
} from "./types.ts";

export { composeAgent } from "./compose.ts";
export { loadTraits, inferTraitsFromTask } from "./traits.ts";
export { saveAgent, loadAgent } from "./persistence.ts";
export { searchTraits, listTraits } from "./search.ts";
export { showAnalytics } from "./analytics.ts";
export { commands, type Command } from "./commands/index.ts";
