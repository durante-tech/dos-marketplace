import { loadRelationshipContext, isDynamicEnabled } from './helpers';
import type { ContextLoader } from './types';

/**
 * Lightweight summary of high-confidence opinions + last 48h
 * relationship notes. Gated by settings.dynamicContext.relationshipContext
 * (default true).
 */
export const relationshipLoader: ContextLoader = {
  name: 'relationship context',
  enabled: (s) => isDynamicEnabled(s, 'relationshipContext'),
  load: (ctx) => {
    const fragment = loadRelationshipContext(ctx.dosDir);
    if (!fragment) return {};
    return {
      fragment,
      slot: 'relationship',
      log: `💕 Loaded relationship context (${fragment.length} chars)`,
    };
  },
};
