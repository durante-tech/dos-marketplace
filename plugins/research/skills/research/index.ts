// RFC-0015 §6 (Research Intent API) — module entry point + singleton router.

import { ResearchRouter } from "./Router";
import type {
  ResearchPerspectivesResponse,
  SearchPerspectivesOptions,
} from "./Router";

export {
  ResearchRouter,
  DEFAULT_RESEARCH_POOL,
} from "./Router";

export type {
  ProviderHealth,
  HealthResponse,
  ResearchPerspective,
  ResearchPerspectivesResponse,
  SearchPerspectivesOptions,
  SelectProvidersInput,
  ResearchRouterConfig,
} from "./Router";

/**
 * Module-singleton router. Callers that need a custom configuration
 * (alternate Studio URL, a longer healthcheck cache) should instantiate
 * ResearchRouter directly.
 */
const defaultRouter = new ResearchRouter();

/**
 * §6 Research namespace — the intent-verb façade exported to workflows and
 * other Packs. Phase 1 exposes `searchPerspectives` only; `analyze`,
 * `synthesize`, and `counterpoint` are deferred to a later RFC (§6).
 */
export const Research = {
  searchPerspectives: (
    query: string,
    options?: SearchPerspectivesOptions,
  ): Promise<ResearchPerspectivesResponse> =>
    defaultRouter.searchPerspectives(query, options),
};
