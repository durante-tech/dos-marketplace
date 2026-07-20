import { readFileSync, existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import type { TraitsData } from "./types.ts";
import { BASE_TRAITS_PATH, USER_TRAITS_PATH } from "./constants.ts";

export function deepMerge<T extends Record<string, unknown>>(base: T, user: Partial<T>): T {
  const result = { ...base };

  for (const key of Object.keys(user) as (keyof T)[]) {
    const userVal = user[key];
    const baseVal = base[key];

    if (
      userVal !== undefined &&
      typeof userVal === "object" &&
      userVal !== null &&
      !Array.isArray(userVal) &&
      typeof baseVal === "object" &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        userVal as Record<string, unknown>
      ) as T[keyof T];
    } else if (userVal !== undefined) {
      result[key] = userVal as T[keyof T];
    }
  }

  return result;
}

export function mergeArrays<T>(base: T[], user: T[]): T[] {
  return [...base, ...user];
}

export function loadTraits(): TraitsData {
  if (!existsSync(BASE_TRAITS_PATH)) {
    console.error(`Error: Base traits file not found at ${BASE_TRAITS_PATH}`);
    process.exit(1);
  }
  const baseContent = readFileSync(BASE_TRAITS_PATH, "utf-8");
  const base = parseYaml(baseContent) as TraitsData;

  if (existsSync(USER_TRAITS_PATH)) {
    const userContent = readFileSync(USER_TRAITS_PATH, "utf-8");
    const user = parseYaml(userContent) as Partial<TraitsData>;

    const merged: TraitsData = {
      expertise: deepMerge(base.expertise || {}, user.expertise || {}),
      personality: deepMerge(base.personality || {}, user.personality || {}),
      approach: deepMerge(base.approach || {}, user.approach || {}),
      voice_mappings: {
        default: user.voice_mappings?.default || base.voice_mappings?.default || "{PRINCIPAL.NAME}",
        default_voice_id:
          user.voice_mappings?.default_voice_id ||
          base.voice_mappings?.default_voice_id ||
          "",
        voice_registry: deepMerge(
          base.voice_mappings?.voice_registry || {},
          user.voice_mappings?.voice_registry || {}
        ),
        mappings: mergeArrays(
          base.voice_mappings?.mappings || [],
          user.voice_mappings?.mappings || []
        ),
        fallbacks: deepMerge(
          base.voice_mappings?.fallbacks || {},
          user.voice_mappings?.fallbacks || {}
        ),
      },
      examples: deepMerge(base.examples || {}, user.examples || {}),
    };

    return merged;
  }

  return base;
}

export function inferTraitsFromTask(task: string, traits: TraitsData): string[] {
  const inferred: string[] = [];
  const taskLower = task.toLowerCase();

  for (const [key, def] of Object.entries(traits.expertise)) {
    if (def.keywords?.some((kw) => taskLower.includes(kw.toLowerCase()))) {
      inferred.push(key);
    }
  }

  for (const [key, def] of Object.entries(traits.personality)) {
    if (def.keywords?.some((kw) => taskLower.includes(kw.toLowerCase()))) {
      inferred.push(key);
    }
  }

  for (const [key, def] of Object.entries(traits.approach)) {
    if (def.keywords?.some((kw) => taskLower.includes(kw.toLowerCase()))) {
      inferred.push(key);
    }
  }

  const hasExpertise = inferred.some((t) => traits.expertise[t]);
  const hasPersonality = inferred.some((t) => traits.personality[t]);
  const hasApproach = inferred.some((t) => traits.approach[t]);

  if (!hasPersonality) inferred.push("analytical");
  if (!hasApproach) inferred.push("thorough");
  if (!hasExpertise) inferred.push("research");

  return [...new Set(inferred)];
}
