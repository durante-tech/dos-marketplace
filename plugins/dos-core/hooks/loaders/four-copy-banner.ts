import { readPreviousHealth } from '../lib/health';
import type { ContextLoader } from './types';

/**
 * RFC-0020 P0-3: emit a banner line when the previous session's
 * sync-check found four-copy drift. Reads the prior health.json cache;
 * silent on first-ever boot or when the cache shows zero drift.
 */
export const fourCopyBannerLoader: ContextLoader = {
  name: 'four-copy-banner',
  load: () => {
    const prev = readPreviousHealth();
    const driftCount = prev?.four_copy_drift.count ?? 0;
    if (driftCount === 0) return {};
    const head = prev?.four_copy_drift.last_checked_head?.slice(0, 7) ?? '?';
    const fragment = `\n> **Four-copy sync drift:** ${driftCount} file(s) out of sync since HEAD ${head} — run \`bun ~/Durante/Tools/sync-check.ts --full\`.\n`;
    return { fragment, slot: 'project' };
  },
};
