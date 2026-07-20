import { checkActiveProgress, isDynamicEnabled } from './helpers';
import type { ContextLoader } from './types';

/**
 * Activity dashboard: recent (last 48h) WORK sessions + persistent
 * projects from MEMORY/STATE/progress/. Emits its own stdout block
 * AFTER the unified dynamic-context system-reminder. Gated by
 * settings.dynamicContext.activeWorkSummary (default true).
 */
export const activeWorkLoader: ContextLoader = {
  name: 'active work summary',
  phase: 'post',
  enabled: (s) => isDynamicEnabled(s, 'activeWorkSummary'),
  load: async (ctx) => {
    const summary = await checkActiveProgress(ctx.dosDir);
    if (!summary) return {};
    return {
      emit: summary,
      log: `📋 Active work summary loaded (${summary.length} chars)`,
    };
  },
};
