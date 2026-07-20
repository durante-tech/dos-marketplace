import type { ProsodySettings, TraitsData, VoiceRegistryEntry } from "./types.ts";
import { DEFAULT_PROSODY, PERSONALITY_PROSODY } from "./constants.ts";

export function getProsody(entry: VoiceRegistryEntry | undefined): ProsodySettings {
  if (!entry) return DEFAULT_PROSODY;

  if (entry.prosody) {
    return {
      stability: entry.prosody.stability ?? DEFAULT_PROSODY.stability,
      similarity_boost: entry.prosody.similarity_boost ?? DEFAULT_PROSODY.similarity_boost,
      style: entry.prosody.style ?? DEFAULT_PROSODY.style,
      speed: entry.prosody.speed ?? DEFAULT_PROSODY.speed,
      use_speaker_boost: entry.prosody.use_speaker_boost ?? DEFAULT_PROSODY.use_speaker_boost,
      volume: (entry.prosody as ProsodySettings).volume ?? DEFAULT_PROSODY.volume,
    };
  }

  return {
    stability: entry.stability ?? DEFAULT_PROSODY.stability,
    similarity_boost: entry.similarity_boost ?? DEFAULT_PROSODY.similarity_boost,
    style: DEFAULT_PROSODY.style,
    speed: DEFAULT_PROSODY.speed,
    use_speaker_boost: DEFAULT_PROSODY.use_speaker_boost,
    volume: DEFAULT_PROSODY.volume,
  };
}

export interface ResolvedVoice {
  voice: string;
  voiceId: string;
  reason: string;
  voiceSettings: ProsodySettings;
}

export function resolveVoice(
  traitKeys: string[],
  traits: TraitsData,
  personalityKeys?: string[]
): ResolvedVoice {
  const mappings = traits.voice_mappings;
  const registry = mappings.voice_registry || {};

  const resolveProsody = (voiceName: string): ProsodySettings => {
    const entry = registry[voiceName];
    if (entry?.prosody) return getProsody(entry);
    if (personalityKeys?.length) {
      const pKey = personalityKeys[0];
      if (PERSONALITY_PROSODY[pKey]) {
        return { ...DEFAULT_PROSODY, ...PERSONALITY_PROSODY[pKey] };
      }
    }
    return getProsody(entry);
  };

  const getVoiceId = (voiceName: string, fallbackId?: string): string => {
    if (registry[voiceName]?.voice_id) {
      return registry[voiceName].voice_id;
    }
    return fallbackId || mappings.default_voice_id || "";
  };

  const matchedMappings = mappings.mappings
    .map((m) => ({
      ...m,
      matchCount: m.traits.filter((t) => traitKeys.includes(t)).length,
      isFullMatch: m.traits.every((t) => traitKeys.includes(t)),
    }))
    .filter((m) => m.isFullMatch)
    .sort((a, b) => b.matchCount - a.matchCount);

  if (matchedMappings.length > 0) {
    const best = matchedMappings[0];
    const voiceName = best.voice;
    return {
      voice: voiceName,
      voiceId: best.voice_id || getVoiceId(voiceName),
      reason: best.reason || `Matched traits: ${best.traits.join(", ")}`,
      voiceSettings: resolveProsody(voiceName),
    };
  }

  for (const trait of traitKeys) {
    if (mappings.fallbacks[trait]) {
      const voiceName = mappings.fallbacks[trait];
      const voiceIdKey = `${trait}_voice_id`;
      const fallbackVoiceId = mappings.fallbacks[voiceIdKey] as string | undefined;
      return {
        voice: voiceName,
        voiceId: fallbackVoiceId || getVoiceId(voiceName),
        reason: `Fallback for trait: ${trait}`,
        voiceSettings: resolveProsody(voiceName),
      };
    }
  }

  return {
    voice: mappings.default,
    voiceId: mappings.default_voice_id || "",
    reason: "Default voice (no specific mapping matched)",
    voiceSettings: resolveProsody(mappings.default),
  };
}
