import type { ContextLoader } from './types';

import { fourCopyBannerLoader } from './four-copy-banner';
import { startupFilesLoader } from './startup-files';
import { relationshipLoader } from './relationship';
import { learningLoader } from './learning';
import { projectLoader } from './project';
import { activeWorkLoader } from './active-work';

/**
 * Registry order = original main() LOAD order (preserves stderr log
 * sequence). Composition order in the unified reminder is decoupled —
 * fragments are sorted by their `slot` field at composition time, so
 * stdout always shows project → relationship → learning regardless of
 * load order.
 *
 *   startupFiles    → own stdout system-reminder envelope
 *   relationship    → fragment (slot: relationship), gated
 *   learning        → fragment (slot: learning), gated
 *   project         → fragment (slot: project, includes drift warnings)
 *   fourCopyBanner  → fragment (slot: project, appended after drift)
 *   activeWork      → own stdout block, gated, AFTER unified reminder
 *
 * Note: version check is NOT in the registry. It runs in main() between
 * recordSessionStart and loadSettings because settings.json must be
 * loaded BEFORE the registry traversal (gating fns need settings) but
 * AFTER the version check (preserves the original log sequence). The
 * version check has no fragment/emit/slot — it's a pure side-effect
 * status logger.
 */
export const CONTEXT_LOADERS: readonly ContextLoader[] = [
  startupFilesLoader,
  relationshipLoader,
  learningLoader,
  projectLoader,
  fourCopyBannerLoader,
  activeWorkLoader,
];

export type { ContextLoader, BootContext, LoaderResult, Settings } from './types';
