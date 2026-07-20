export interface ProsodySettings {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
  volume: number;
}

export interface TraitDefinition {
  name: string;
  description: string;
  prompt_fragment?: string;
  keywords?: string[];
}

export interface VoiceMapping {
  traits: string[];
  voice: string;
  voice_id?: string;
  reason?: string;
}

export interface VoiceRegistryEntry {
  voice_id: string;
  characteristics: string[];
  description: string;
  prosody?: ProsodySettings;
  stability?: number;
  similarity_boost?: number;
}

export interface TraitsData {
  expertise: Record<string, TraitDefinition>;
  personality: Record<string, TraitDefinition>;
  approach: Record<string, TraitDefinition>;
  voice_mappings: {
    default: string;
    default_voice_id: string;
    voice_registry: Record<string, VoiceRegistryEntry>;
    mappings: VoiceMapping[];
    fallbacks: Record<string, string>;
  };
  examples: Record<string, { description: string; traits: string[] }>;
}

export interface ComposedAgent {
  name: string;
  traits: string[];
  expertise: TraitDefinition[];
  personality: TraitDefinition[];
  approach: TraitDefinition[];
  voice: string;
  voiceId: string;
  voiceReason: string;
  voiceSettings: ProsodySettings;
  color: string;
  prompt: string;
}

export type ClaudeCodeColorName =
  | "red" | "blue" | "green" | "yellow"
  | "purple" | "orange" | "pink" | "cyan";

export type OutputFormat = "prompt" | "json" | "yaml" | "summary";

export type Timing = "fast" | "standard" | "deep";
