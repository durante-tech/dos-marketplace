import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { ComposedAgent, TraitDefinition, TraitsData } from "./types.ts";
import { TEMPLATE_PATH } from "./constants.ts";
import { resolveVoice } from "./voice.ts";
import { generateAgentColor } from "./color.ts";
import { compileTemplate, type TemplateDelegate } from "./template.ts";

let cachedTemplate: TemplateDelegate | null = null;

/**
 * Resolve the active Algorithm doctrine for template injection.
 *
 * Inlined (rather than importing ~/.claude/DOS/Tools/resolve-active-doctrine.ts)
 * because pack source and live install sit at different directory depths
 * relative to DOS/Tools/ — the same relative import would resolve to different
 * targets across the Four Copies. Logic mirror: ~/Durante/Tools/resolve-active-doctrine.ts.
 */
// Fallback resolution order (mirrors resolve-active-doctrine.ts, TOOLB-003):
//   1. the committed install default (.default-LATEST) — so the fallback can
//      never drift from what ships in the box
//   2. a hardcoded last-resort if .default-LATEST is also unreadable
const HARDCODED_DOCTRINE_FALLBACK = "v0.0.10";

interface ResolvedDoctrine {
  algorithmVersion: string;
  algorithmSpecPath: string;
  liteProfilePath: string;
}

function resolveDoctrineFallback(algorithmDir: string): string {
  try {
    const defaultLatest = join(algorithmDir, ".default-LATEST");
    if (existsSync(defaultLatest)) {
      const raw = readFileSync(defaultLatest, "utf-8").trim();
      if (raw && /^v\d+\.\d+\.\d+(-\w+)?$/.test(raw)) return raw;
    }
  } catch {
  }
  return HARDCODED_DOCTRINE_FALLBACK;
}

function resolveActiveDoctrine(): ResolvedDoctrine {
  const home = process.env.HOME ?? "";
  const algorithmDir = join(home, ".claude", "DOS", "Algorithm");
  const liteProfilePath = join(home, ".claude", "DOS", "PARTIALS", "_algorithm-lite.md");
  const latestPointer = join(algorithmDir, "LATEST");
  const fallbackVersion = resolveDoctrineFallback(algorithmDir);

  let version = fallbackVersion;
  try {
    if (existsSync(latestPointer)) {
      const raw = readFileSync(latestPointer, "utf-8").trim();
      if (raw && /^v\d+\.\d+\.\d+(-\w+)?$/.test(raw)) version = raw;
    }
  } catch {
  }

  let specPath = join(algorithmDir, `${version}.md`);
  if (!existsSync(specPath)) {
    const fallback = join(algorithmDir, `${fallbackVersion}.md`);
    if (existsSync(fallback)) {
      version = fallbackVersion;
      specPath = fallback;
    }
  }

  return { algorithmVersion: version, algorithmSpecPath: specPath, liteProfilePath };
}

export function loadTemplate(): TemplateDelegate {
  if (cachedTemplate) return cachedTemplate;
  if (!existsSync(TEMPLATE_PATH)) {
    console.error(`Error: Template file not found at ${TEMPLATE_PATH}`);
    process.exit(1);
  }
  const content = readFileSync(TEMPLATE_PATH, "utf-8");
  cachedTemplate = compileTemplate(content);
  return cachedTemplate;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function composeAgent(
  traitKeys: string[],
  task: string,
  traits: TraitsData,
  timing?: string,
  criteria?: string[]
): ComposedAgent {
  const expertise: TraitDefinition[] = [];
  const personality: TraitDefinition[] = [];
  const approach: TraitDefinition[] = [];

  for (const key of traitKeys) {
    if (traits.expertise[key]) expertise.push(traits.expertise[key]);
    if (traits.personality[key]) personality.push(traits.personality[key]);
    if (traits.approach[key]) approach.push(traits.approach[key]);
  }

  const nameParts: string[] = [];
  const firstExpertise = expertise[0];
  const firstPersonality = personality[0];
  const firstApproach = approach[0];
  if (firstExpertise) nameParts.push(firstExpertise.name);
  if (firstPersonality) nameParts.push(firstPersonality.name);
  if (firstApproach) nameParts.push(firstApproach.name);
  const name = nameParts.length > 0 ? nameParts.join(" ") : "Dynamic Agent";

  const personalityKeys = traitKeys.filter((k) => traits.personality[k]);
  const { voice, voiceId, reason: voiceReason, voiceSettings } = resolveVoice(traitKeys, traits, personalityKeys);
  const color = generateAgentColor(traitKeys);

  const validTimings = ["fast", "standard", "deep"];
  const timingValue = timing && validTimings.includes(timing) ? timing : undefined;
  const timingData = timingValue
    ? {
        timing: timingValue,
        isFast: timingValue === "fast",
        isStandard: timingValue === "standard",
        isDeep: timingValue === "deep",
      }
    : {};

  const template = loadTemplate();
  const doctrine = resolveActiveDoctrine();
  const prompt = template({
    name,
    task,
    expertise,
    personality,
    approach,
    voice,
    voiceId,
    voiceSettings,
    color,
    criteria,
    ...doctrine,
    ...timingData,
  });

  return {
    name,
    traits: traitKeys,
    expertise,
    personality,
    approach,
    voice,
    voiceId,
    voiceReason,
    voiceSettings,
    color,
    prompt,
  };
}
