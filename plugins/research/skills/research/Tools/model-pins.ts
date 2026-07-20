/**
 * model-pins - single owner for Research-pack vendor model versions
 *
 * Every vendor tool (Gemini.ts, Grok.ts, Perplexity.ts) imports its model
 * list and default from here instead of re-declaring a private VALID_MODELS
 * enum. One file to edit when a model rotates; no per-tool drift.
 *
 * PIN CONVENTION: prefer durable family names over dated release tags.
 * Perplexity's `sonar` / `sonar-pro` / `sonar-reasoning-pro` is the model —
 * a family name survives a provider's point releases, a dated tag
 * (e.g. an old `grok-4.20-0309-...`) rots the moment the provider ships
 * the next snapshot. New pins follow the family-name convention.
 *
 * The `as const` arrays are the single source of truth; the exported types
 * are derived from them, so a tool's `Model` type can never disagree with
 * the list it validates against.
 *
 * @see Packs/research/src/SKILL.md
 */

// ──────────────────────────────────────────────────────────────────────
// Gemini (Google) — gemini-2.5 family
// ──────────────────────────────────────────────────────────────────────
export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
] as const;
export type GeminiModel = (typeof GEMINI_MODELS)[number];
export const GEMINI_DEFAULT_MODEL: GeminiModel = "gemini-2.5-flash";

// ──────────────────────────────────────────────────────────────────────
// Grok (xAI) — grok-4 family
// `grok-4` replaces the dated `grok-4.20-0309-reasoning` pin (de-rot):
// the family name tracks the provider's reasoning model across snapshots.
// ──────────────────────────────────────────────────────────────────────
export const GROK_MODELS = [
  "grok-4",
  "grok-4-1-fast-reasoning",
  "grok-4-1-fast-non-reasoning",
] as const;
export type GrokModel = (typeof GROK_MODELS)[number];
export const GROK_DEFAULT_MODEL: GrokModel = "grok-4-1-fast-reasoning";

// ──────────────────────────────────────────────────────────────────────
// Perplexity — sonar family (the durable-family-name reference convention)
// ──────────────────────────────────────────────────────────────────────
export const PERPLEXITY_MODELS = [
  "sonar",
  "sonar-pro",
  "sonar-reasoning-pro",
] as const;
export type PerplexityModel = (typeof PERPLEXITY_MODELS)[number];
export const PERPLEXITY_DEFAULT_MODEL: PerplexityModel = "sonar";
