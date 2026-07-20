// RFC-0015 §6.1 (Research.searchPerspectives) fan-out + synthesis composition.

import type { ResearchPerspective, ResearchPerspectivesResponse } from "../Router";

/**
 * Phase 1 stub signal — emitted once per fan-out call so operators can see at a
 * glance that the real provider backends are not yet wired (Phase 3, §15).
 */
let phase1WarningEmitted = false;
function warnPhase1Once() {
  if (phase1WarningEmitted) return;
  phase1WarningEmitted = true;
  console.warn(
    "[Research.searchPerspectives] Phase 1 stub — provider wiring pending (RFC-0015 §15).",
  );
}

/**
 * Phase 1 per-provider stub: returns an empty perspective carrying only the
 * provider + persona label. Real provider calls (Perplexity, Gemini, Brave,
 * Grok, Claude, Codex) land in Phase 3 per RFC-0015 §15.
 */
async function stubProviderCall(
  provider: { provider: string; apiBackend: string; persona: string },
  _query: string,
  _depth: "fast" | "standard" | "deep",
): Promise<ResearchPerspective> {
  return {
    provider: provider.provider,
    persona: provider.persona,
    summary: "",
    bullets: [],
    citations: [],
    tokenUsage: { input: 0, output: 0 },
  };
}

/**
 * §6.1 fan-out entry point. Runs one call per selected provider in parallel,
 * bounded by a Promise.race timeout, then composes the §6.1 response envelope.
 *
 * Synthesis (agree/conflicts/gaps) is returned with empty arrays in Phase 1 —
 * populating it requires real provider output to cross-compare, which arrives
 * with the Phase 3 wiring.
 */
export async function fanOutPerspectives(
  query: string,
  selectedProviders: Array<{ provider: string; apiBackend: string; persona: string }>,
  options: { depth: "fast" | "standard" | "deep"; timeoutMs: number },
): Promise<ResearchPerspectivesResponse> {
  warnPhase1Once();

  const start = Date.now();

  const perProvider = selectedProviders.map(async (p): Promise<ResearchPerspective> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const call = stubProviderCall(p, query, options.depth);
    const timeout = new Promise<ResearchPerspective>((resolve) => {
      timer = setTimeout(() => {
        resolve({
          provider: p.provider,
          persona: p.persona,
          summary: "",
          bullets: [],
          citations: [],
          tokenUsage: { input: 0, output: 0 },
        });
      }, options.timeoutMs);
    });
    return Promise.race([call, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  });

  const perspectives = await Promise.all(perProvider);

  return {
    query,
    perspectives,
    synthesis: {
      agree: [],
      conflicts: [],
      gaps: [],
    },
    researchersUsed: selectedProviders.map((p) => p.provider),
    executionTimeMs: Date.now() - start,
    totalCostCredits: 0,
  };
}
