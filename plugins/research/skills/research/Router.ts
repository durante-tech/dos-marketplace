// RFC-0015 §6 (Research Intent API) + §7.4 (provider selection) + §8.3 (healthcheck).

/**
 * Default provider pool in §7.4 diversity rank order.
 *
 * Personas are preserved from the existing `*Researcher.md` agent files for UI
 * display (Appendix B.2 — "persona voice collapse" mitigation). Exact strings
 * may drift as agent files evolve; consumers MUST treat them as display-only
 * labels, not routing identifiers.
 */
export const DEFAULT_RESEARCH_POOL: ReadonlyArray<{
  provider: string;
  apiBackend: string;
  persona: string;
}> = [
  { provider: "claude", apiBackend: "anthropic", persona: "Alex Chen — The Academic" },
  { provider: "perplexity", apiBackend: "perplexity", persona: "Ava Chen — The Investigator" },
  { provider: "gemini", apiBackend: "google", persona: "Maya Lindqvist — The Synthesist" },
  { provider: "brave", apiBackend: "brave", persona: "Maya Torres — The Source Hunter" },
  { provider: "grok", apiBackend: "xai", persona: "Johannes — The Contrarian" },
  { provider: "codex", apiBackend: "openai", persona: "Remy — The Archaeologist" },
];

/** §8.3 healthcheck — per-provider status reported by the gateway. */
export interface ProviderHealth {
  status: "ok" | "misconfigured" | "unknown";
  pool_key: string;
}

/** §8.3 healthcheck response envelope. */
export interface HealthResponse {
  providers: Record<string, ProviderHealth>;
  checkedAt: string;
}

/** §6.1 perspective shape — one provider's output inside a searchPerspectives response. */
export interface ResearchPerspective {
  provider: string;
  persona?: string;
  summary: string;
  bullets: string[];
  citations: Array<{ url: string; title?: string; accessedAt: string }>;
  tokenUsage: { input: number; output: number };
}

/**
 * 28D delivery sprint D16 — adopt the Anthropic SDK 0.96.0 shape for
 * managed-agent search-result content blocks. Mirrors
 * `BetaManagedAgentsSearchResultBlock` so downstream consumers (Bdr,
 * Sales, ChiefOfStaff, Dispatch) get a uniform envelope instead of
 * Research-pack-specific JSON.
 *
 * @see https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/sdk-v0.96.0
 */
export interface ManagedAgentsSearchResultBlock {
  type: "managed_agents_search_result";
  source: {
    url: string;
    title: string;
  };
  /** Content blocks (text + citation blocks per the SDK shape) */
  content: Array<{ type: string; text?: string; [k: string]: unknown }>;
  /** Optional citation spans for inline-cited synthesis */
  citations?: Array<{
    start_index: number;
    end_index: number;
    url: string;
  }>;
}

/**
 * Research envelope when emitting in SDK-managed-agents shape (D16).
 * Use this when consuming sub-skills (Bdr brief generator, Sales proposal
 * synthesizer, ChiefOfStaff morning brief, Dispatch newsletter authoring)
 * benefit from the SDK envelope shape.
 */
export interface ResearchResultEnvelope {
  query: string;
  results: ManagedAgentsSearchResultBlock[];
  /** Sub-skill consumer hint — which pack/workflow asked for this envelope */
  consumer?: string;
}

/** §6.1 searchPerspectives response envelope. */
export interface ResearchPerspectivesResponse {
  query: string;
  perspectives: ResearchPerspective[];
  synthesis: {
    agree: string[];
    conflicts: string[];
    gaps: string[];
  };
  researchersUsed: string[];
  executionTimeMs: number;
  totalCostCredits: number;
}

/** Options accepted by Research.searchPerspectives (§6.1). */
export interface SearchPerspectivesOptions {
  count?: 1 | 2 | 3 | 4;
  diversity?: "high" | "medium" | "low";
  providers?: string[];
  depth?: "fast" | "standard" | "deep";
  timeoutMs?: number;
}

/** Selection input for selectProviders (§7.4). */
export interface SelectProvidersInput {
  count: number;
  diversity: "high" | "medium" | "low";
  providers?: string[];
}

/** Router constructor config. */
export interface ResearchRouterConfig {
  studioUrl?: string;
  studioKey?: string;
  /** §8.3 — default 300s cache on the healthcheck response. */
  healthCacheSeconds?: number;
}

/**
 * Lazy import of the fan-out function to avoid a circular dependency between
 * Router.ts and Tools/SearchPerspectives.ts (SearchPerspectives imports the
 * perspective/response types from this file).
 */
type FanOutFn = (
  query: string,
  selectedProviders: Array<{ provider: string; apiBackend: string; persona: string }>,
  options: { depth: "fast" | "standard" | "deep"; timeoutMs: number },
) => Promise<ResearchPerspectivesResponse>;

/**
 * ResearchRouter — RFC-0015 §6 + §7.4 client-side entry point.
 *
 * Phase 1 scope: healthcheck fetch with cache, §7.4 selection algorithm, and a
 * searchPerspectives method that delegates to the fan-out helper. The fan-out
 * itself is stubbed pending Phase 3 provider wiring (§15).
 */
export class ResearchRouter {
  private readonly studioUrl: string;
  private readonly studioKey: string | undefined;
  private readonly healthCacheSeconds: number;
  private healthCache: { value: HealthResponse; fetchedAt: number } | null = null;

  constructor(config?: ResearchRouterConfig) {
    this.studioUrl =
      config?.studioUrl ??
      (typeof process !== "undefined" ? process.env?.STUDIO_API_URL : undefined) ??
      "http://localhost:3000";
    this.studioKey =
      config?.studioKey ??
      (typeof process !== "undefined" ? process.env?.STUDIO_API_KEY : undefined);
    this.healthCacheSeconds = config?.healthCacheSeconds ?? 300;
  }

  /**
   * §8.3 — fetch pool-key health, cached for healthCacheSeconds.
   * Non-throwing: on network failure returns an empty providers map so the
   * router can degrade without blocking the caller.
   */
  async fetchHealth(): Promise<HealthResponse> {
    const now = Date.now();
    if (this.healthCache && now - this.healthCache.fetchedAt < this.healthCacheSeconds * 1000) {
      return this.healthCache.value;
    }

    try {
      // RSCH-01: bound the health probe so a stalled gateway can't hang the
      // router indefinitely. On timeout `fetch` throws (TimeoutError) and the
      // catch below degrades to the empty-providers fallback. Default 60s;
      // override via RESEARCH_GATEWAY_TIMEOUT_MS.
      // Sanitize like the provider tools' resolveGatewayTimeoutMs — a negative
      // or non-finite override must fall back, not reach AbortSignal.timeout
      // (which throws synchronously and would misread as a gateway outage).
      const rawTimeout = Number(process.env.RESEARCH_GATEWAY_TIMEOUT_MS);
      const timeoutMs = Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 60_000;
      const res = await fetch(`${this.studioUrl}/api/v1/scraping/health`, {
        method: "GET",
        headers: this.studioKey ? { Authorization: `Bearer ${this.studioKey}` } : {},
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const fallback: HealthResponse = { providers: {}, checkedAt: new Date().toISOString() };
        this.healthCache = { value: fallback, fetchedAt: now };
        return fallback;
      }
      const body = (await res.json()) as HealthResponse;
      this.healthCache = { value: body, fetchedAt: now };
      return body;
    } catch {
      const fallback: HealthResponse = { providers: {}, checkedAt: new Date().toISOString() };
      this.healthCache = { value: fallback, fetchedAt: now };
      return fallback;
    }
  }

  /**
   * §7.4 — pick N providers from the configured pool honoring the diversity
   * policy and skipping any reporting `misconfigured` in the healthcheck.
   */
  async selectProviders(
    options: SelectProvidersInput,
  ): Promise<Array<{ provider: string; apiBackend: string; persona: string }>> {
    const { count, diversity, providers } = options;

    const basePool = providers
      ? providers
          .map((name) => DEFAULT_RESEARCH_POOL.find((p) => p.provider === name))
          .filter((p): p is (typeof DEFAULT_RESEARCH_POOL)[number] => Boolean(p))
          .map((p) => ({ provider: p.provider, apiBackend: p.apiBackend, persona: p.persona }))
      : DEFAULT_RESEARCH_POOL.map((p) => ({
          provider: p.provider,
          apiBackend: p.apiBackend,
          persona: p.persona,
        }));

    const health = await this.fetchHealth();
    const eligible = basePool.filter((p) => {
      const entry = health.providers[p.provider];
      if (!entry) return true; // unknown === eligible; only skip explicit misconfigured
      return entry.status !== "misconfigured";
    });

    if (diversity === "high") {
      const seenBackends = new Set<string>();
      const deduped: typeof eligible = [];
      for (const p of eligible) {
        if (seenBackends.has(p.apiBackend)) continue;
        seenBackends.add(p.apiBackend);
        deduped.push(p);
        if (deduped.length >= count) break;
      }
      return deduped.slice(0, count);
    }

    if (diversity === "medium") {
      return eligible.slice(0, count);
    }

    // low — allow repeats by priority: cycle through eligible list until count hit.
    if (eligible.length === 0) return [];
    const picked: typeof eligible = [];
    for (let i = 0; i < count; i++) {
      picked.push(eligible[i % eligible.length]!);
    }
    return picked;
  }

  /**
   * §6.1 — run a multi-perspective search. Delegates to the fan-out helper
   * after selecting providers per §7.4.
   */
  async searchPerspectives(
    query: string,
    options?: SearchPerspectivesOptions,
  ): Promise<ResearchPerspectivesResponse> {
    const count = options?.count ?? 3;
    const diversity = options?.diversity ?? "high";
    const depth = options?.depth ?? "standard";
    const timeoutMs = options?.timeoutMs ?? 120000;

    const selected = await this.selectProviders({
      count,
      diversity,
      providers: options?.providers,
    });

    const mod = (await import("./Tools/SearchPerspectives")) as { fanOutPerspectives: FanOutFn };
    return mod.fanOutPerspectives(query, selected, { depth, timeoutMs });
  }
}
