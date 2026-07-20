import {
  loadLearningDigest,
  loadAlgorithmReflections,
  loadFailurePatterns,
  loadSignalTrends,
} from '../lib/learning-readback';
import { isDynamicEnabled } from './helpers';
import type { ContextLoader } from './types';

/**
 * Aggregate four learning sub-fetches (signal trends, algorithm
 * reflections, learning digest, failure patterns) into a single
 * "Learning Context" section. Gated by
 * settings.dynamicContext.learningReadback (default true).
 *
 * Order is intentional — signal trends first (most actionable), then
 * reflections, then the broader digest, then failure patterns.
 */
export const learningLoader: ContextLoader = {
  name: 'learning readback',
  enabled: (s) => isDynamicEnabled(s, 'learningReadback'),
  load: (ctx) => {
    const learningDigest = loadLearningDigest(ctx.dosDir);
    const algorithmReflections = loadAlgorithmReflections(ctx.dosDir);
    const failurePatterns = loadFailurePatterns(ctx.dosDir);
    const signalTrends = loadSignalTrends(ctx.dosDir);

    const parts: string[] = [];
    if (signalTrends) parts.push(signalTrends);
    if (algorithmReflections) parts.push(algorithmReflections);
    if (learningDigest) parts.push(learningDigest);
    if (failurePatterns) parts.push(failurePatterns);

    if (parts.length === 0) return {};

    const fragment = '\n## Learning Context (auto-loaded)\n\n' + parts.join('\n\n');
    return {
      fragment,
      slot: 'learning',
      log: `📚 Loaded learning context: ${parts.length} sections (${fragment.length} chars)`,
    };
  },
};
