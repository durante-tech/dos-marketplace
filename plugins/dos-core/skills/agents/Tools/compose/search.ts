import type { TraitsData, VoiceRegistryEntry } from "./types.ts";
import { getProsody } from "./voice.ts";

export const SEARCH_HINTS: Record<string, string[]> = {
  legal: ["contract", "agreement", "clause", "liability", "compliance", "regulation", "terms", "lawyer", "attorney", "lawsuit", "SLA", "MSA", "NDA"],
  finance: ["budget", "revenue", "cost", "pricing", "runway", "economics", "ROI", "P&L", "burn", "CAC", "LTV", "margin", "forecast"],
  medical: ["health", "clinical", "patient", "diagnosis", "treatment", "medical", "pharma", "disease"],
  security: ["vulnerability", "threat", "exploit", "attack", "CVE", "OWASP", "pentest", "auth", "encryption", "firewall"],
  technical: ["code", "architecture", "system", "API", "database", "refactor", "debug", "implementation", "deploy", "infrastructure"],
  research: ["research", "study", "investigate", "analyze", "compare", "benchmark", "survey", "literature"],
  creative: ["design", "visual", "content", "storytelling", "editorial", "aesthetic", "brand", "illustration"],
  product: ["roadmap", "prioritize", "feature", "GTM", "market", "competitive", "strategy", "user research"],
  sales: ["prospect", "pipeline", "outreach", "deal", "ICP", "proposal", "pitch", "cold email"],
  brand: ["positioning", "messaging", "tone", "identity", "differentiation", "narrative"],
  data: ["data", "analytics", "statistics", "visualization", "SQL", "metrics", "dashboard", "dataset"],
  communications: ["PR", "stakeholder", "announcement", "crisis", "media", "communications"],
  skeptical: ["question", "challenge", "doubt", "verify", "prove", "evidence"],
  analytical: ["analyze", "breakdown", "quantify", "measure", "data-driven", "logical"],
  enthusiastic: ["exciting", "celebrate", "energy", "positive", "momentum"],
  contrarian: ["devil's advocate", "opposite", "counter", "argue", "challenge assumption"],
  pragmatic: ["practical", "realistic", "simple", "minimal", "what exists"],
  cautious: ["careful", "risk", "safe", "conservative", "warn", "downside"],
  bold: ["decisive", "confident", "strong opinion", "commit", "assertive"],
  empathetic: ["human", "feelings", "stakeholder", "emotional", "user experience", "support"],
  meticulous: ["detail", "precise", "edge case", "thorough check", "audit", "verify every"],
  thorough: ["comprehensive", "exhaustive", "complete", "all angles", "deep dive"],
  rapid: ["quick", "fast", "brief", "speed", "efficient", "summary", "30 seconds"],
  systematic: ["step by step", "methodology", "structured", "framework", "process"],
  investigative: ["investigate", "reconnaissance", "map territory", "understand first", "explore before"],
  parallel: ["parallel", "concurrent", "simultaneous", "batch", "multiple agents"],
  exploratory: ["explore", "discover", "tangent", "open-ended", "divergent", "brainstorm"],
  comparative: ["compare", "vs", "pros cons", "side by side", "alternative", "option A or B"],
  synthesizing: ["synthesize", "combine", "consolidate", "merge", "unified", "integrate sources"],
  adversarial: ["red team", "attack", "break", "exploit", "stress test", "penetration"],
  consultative: ["advise", "consult", "ask questions", "understand context", "guide", "recommend"],
};

export function searchTraits(query: string, traits: TraitsData): void {
  const queryLower = query.toLowerCase();
  const suggestions: { trait: string; dimension: string; score: number; reason: string }[] = [];

  for (const [trait, hints] of Object.entries(SEARCH_HINTS)) {
    let score = 0;
    const matchedHints: string[] = [];
    for (const hint of hints) {
      if (queryLower.includes(hint.toLowerCase())) {
        score += hint.length > 4 ? 2 : 1;
        matchedHints.push(hint);
      }
    }
    if (score > 0) {
      const dimension = traits.expertise[trait] ? "expertise" : traits.personality[trait] ? "personality" : traits.approach[trait] ? "approach" : "unknown";
      suggestions.push({ trait, dimension, score, reason: `matched: ${matchedHints.join(", ")}` });
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  if (suggestions.length === 0) {
    console.log(`No trait matches for: "${query}"`);
    console.log("Try more specific terms or use --list to see all traits.");
    return;
  }

  console.log(`TRAIT SUGGESTIONS for: "${query}"\n`);

  const byDim: Record<string, typeof suggestions> = {};
  for (const s of suggestions) {
    if (!byDim[s.dimension]) byDim[s.dimension] = [];
    byDim[s.dimension].push(s);
  }

  for (const dim of ["expertise", "personality", "approach"]) {
    if (!byDim[dim]) continue;
    console.log(`  ${dim.toUpperCase()}:`);
    for (const s of byDim[dim]) {
      console.log(`    ${s.trait.padEnd(16)} score:${s.score}  (${s.reason})`);
    }
  }

  const bestExpertise = suggestions.find((s) => s.dimension === "expertise");
  const bestPersonality = suggestions.find((s) => s.dimension === "personality");
  const bestApproach = suggestions.find((s) => s.dimension === "approach");

  if (bestExpertise || bestPersonality || bestApproach) {
    const parts = [bestExpertise?.trait || "research", bestPersonality?.trait || "analytical", bestApproach?.trait || "thorough"];
    console.log(`\n  SUGGESTED COMPOSITION: --traits "${parts.join(",")}"`);
  }
}

export function listTraits(traits: TraitsData): void {
  console.log("AVAILABLE TRAITS (base + user merged)\n");

  console.log("EXPERTISE (domain knowledge):");
  for (const [key, def] of Object.entries(traits.expertise)) {
    console.log(`  ${key.padEnd(15)} - ${def.name}`);
  }

  console.log("\nPERSONALITY (behavior style):");
  for (const [key, def] of Object.entries(traits.personality)) {
    console.log(`  ${key.padEnd(15)} - ${def.name}`);
  }

  console.log("\nAPPROACH (work style):");
  for (const [key, def] of Object.entries(traits.approach)) {
    console.log(`  ${key.padEnd(15)} - ${def.name}`);
  }

  console.log("\nVOICES AVAILABLE:");
  const registry = traits.voice_mappings?.voice_registry || {};
  for (const [name, entry] of Object.entries(registry as Record<string, VoiceRegistryEntry>)) {
    const prosody = getProsody(entry);
    console.log(`  ${name.padEnd(12)} - ${entry.description}`);
    console.log(`               stability:${prosody.stability} style:${prosody.style} speed:${prosody.speed} volume:${prosody.volume}`);
  }

  if (traits.examples && Object.keys(traits.examples).length > 0) {
    console.log("\nEXAMPLE COMPOSITIONS:");
    for (const [key, example] of Object.entries(traits.examples)) {
      console.log(`  ${key.padEnd(18)} - ${example.description}`);
      console.log(`                      traits: ${example.traits.join(", ")}`);
    }
  }
}
