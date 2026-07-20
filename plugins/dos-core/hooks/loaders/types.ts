/**
 * SessionStart context-loader plugin contract.
 *
 * Each loader is one concern of LoadContext.hook.ts main(): version check,
 * startup files, relationship context, learning readback, project KG facts,
 * drift detection, active work summary. The registry in `index.ts` orders
 * them; main() iterates and `safeLoad()` wraps the call so any one loader
 * failing cannot fail the SessionStart hook.
 */

export interface BootContext {
  dosDir: string;
  settings: Settings;
  prevHead: string;
}

export interface DynamicContextConfig {
  relationshipContext?: boolean;
  learningReadback?: boolean;
  activeWorkSummary?: boolean;
}

export interface LoadAtStartupConfig {
  _docs?: string;
  files?: string[];
}

export interface Settings {
  dynamicContext?: DynamicContextConfig;
  loadAtStartup?: LoadAtStartupConfig;
  [key: string]: unknown;
}

/**
 * The shape every loader returns. A loader may contribute to the unified
 * dynamic-context `<system-reminder>` (`fragment`), emit its own stdout
 * block (`emit`), or only log progress to stderr (`log`). Combinations are
 * allowed; missing fields are treated as no-op.
 *
 * `slot` controls placement within the unified reminder. The composition
 * order is fixed: project → relationship → learning (with `\n---\n`
 * before learning when present). Loaders can fire in any registry order;
 * fragments still land in the right composition slot. Default 'project'.
 */
export type FragmentSlot = 'project' | 'relationship' | 'learning';

export interface LoaderResult {
  fragment?: string;       // appended to the unified system-reminder
  slot?: FragmentSlot;     // placement within the unified reminder
  emit?: string;           // standalone stdout block (own envelope)
  log?: string;            // progress line for stderr
}

/**
 * Loaders run in two phases:
 *   'pre'  → before the unified dynamic-context system-reminder is emitted.
 *            Their fragments populate the unified reminder.
 *   'post' → after the unified reminder. Their `emit` lands as a separate
 *            stdout block (e.g. active-work summary). Default 'pre'.
 */
export type LoaderPhase = 'pre' | 'post';

export interface ContextLoader {
  name: string;
  phase?: LoaderPhase;
  enabled?: (settings: Settings) => boolean;
  load: (ctx: BootContext) => Promise<LoaderResult> | LoaderResult;
}
