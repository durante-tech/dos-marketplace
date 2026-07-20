/**
 * tab-constants.ts - Single source of truth for tab title colors and states.
 *
 * All hooks that touch tab titles import from here.
 * No more independent color definitions across 6 files.
 *
 * Phase-aware tabs: Each Algorithm phase gets a distinct background color
 * and symbol, so multiple Kitty tabs show at-a-glance where each session
 * is in the Algorithm.
 */

export const TAB_COLORS = {
  thinking:  { inactiveBg: '#1E0A3C', label: 'purple' },
  working:   { inactiveBg: '#804000', label: 'orange' },
  question:  { inactiveBg: '#0D4F4F', label: 'teal' },
  completed: { inactiveBg: '#022800', label: 'green' },
  error:     { inactiveBg: '#804000', label: 'orange' },
  idle:      { inactiveBg: 'none',    label: 'default' },
} as const;

export const ACTIVE_TAB_BG = '#002B80';
export const ACTIVE_TAB_FG = '#FFFFFF';
export const INACTIVE_TAB_FG = '#A0A0A0';

export type TabState = keyof typeof TAB_COLORS;

/**
 * Phase-specific tab configuration.
 * Each Algorithm phase has a unique symbol and dark background color
 * optimized for readability with light text on Kitty tab bar.
 */
export const PHASE_TAB_CONFIG: Record<string, { symbol: string; inactiveBg: string; label: string; gerund: string }> = {
  OBSERVE:  { symbol: '👁️', inactiveBg: '#0C2D48', label: 'observe',  gerund: 'Observing the user request.' },
  THINK:    { symbol: '🧠', inactiveBg: '#2D1B69', label: 'think',    gerund: 'Analyzing the problem space.' },
  PLAN:     { symbol: '📋', inactiveBg: '#1E1B4B', label: 'plan',     gerund: 'Planning the execution approach.' },
  BUILD:    { symbol: '🔨', inactiveBg: '#78350F', label: 'build',    gerund: 'Building the solution artifacts.' },
  EXECUTE:  { symbol: '⚡', inactiveBg: '#713F12', label: 'execute',  gerund: 'Executing the planned work.' },
  VERIFY:   { symbol: '✅', inactiveBg: '#14532D', label: 'verify',   gerund: 'Verifying ideal state criteria.' },
  LEARN:    { symbol: '📚', inactiveBg: '#134E4A', label: 'learn',    gerund: 'Recording the session learnings.' },
  COMPLETE: { symbol: '✅', inactiveBg: '#022800', label: 'complete', gerund: 'Complete.' },
  IDLE:     { symbol: '',   inactiveBg: 'none',    label: 'idle',     gerund: '' },
};

export type AlgorithmTabPhase = keyof typeof PHASE_TAB_CONFIG;

/**
 * Phases a PRD author can write in frontmatter. Excludes IDLE (runtime-only
 * tab state, not a valid Algorithm phase). Typed as `ReadonlySet<string>`
 * so callers can test membership against raw frontmatter values without
 * upfront narrowing; the inner construction is still AlgorithmTabPhase-
 * checked so this list cannot drift from `PHASE_TAB_CONFIG` at compile time.
 *
 * Values are UPPERCASE tab-phase names (matches PHASE_TAB_CONFIG keys).
 * For the LOWERCASE frontmatter literal an author writes (e.g.,
 * `phase: complete`), see `PRD_PHASE_COMPLETE` below.
 */
export const PRD_AUTHORED_PHASES: ReadonlySet<string> = new Set<AlgorithmTabPhase>([
  'OBSERVE', 'THINK', 'PLAN', 'BUILD', 'EXECUTE', 'VERIFY', 'LEARN', 'COMPLETE',
]);

/**
 * Frontmatter phase value that marks a PRD as complete. Lowercase because
 * that's the literal an author writes in the YAML (e.g., `phase: complete`).
 * The uppercase `'COMPLETE'` in `PRD_AUTHORED_PHASES` / `PHASE_TAB_CONFIG`
 * is a separate display/tab convention — the two are related but distinct
 * (YAML is case-sensitive).
 *
 * Lives in tab-constants.ts (zero external imports) rather than prd-utils.ts
 * (imports yaml) so security-isolated consumers like PRDSigner.hook.ts can
 * reference this value without pulling a runtime yaml dependency into their
 * graph.
 */
export const PRD_PHASE_COMPLETE = 'complete' as const;

/**
 * Terminal PRD frontmatter phases. A PRD is "finished" when its phase is either
 * 'complete' (the Algorithm-authored value) OR 'done' (used by 6+ live PRDs).
 *
 * This set exists because consumers kept checking only `phase === PRD_PHASE_COMPLETE`
 * and silently mis-handling 'done' PRDs — a class that recurred across at least eight
 * generations (Forge H-016/049b/054/058/075/101 and H-116, which found five more live
 * sites at once). Each earlier fix bolted on a local `|| phase === 'done'`, which is
 * exactly why the class kept coming back. Check `isTerminalPhase()` instead of adding
 * another special case.
 */
export const TERMINAL_PRD_PHASES: ReadonlySet<string> = new Set(['complete', 'done']);

/**
 * True when a PRD frontmatter phase means the PRD is finished. Case-insensitive so it
 * also matches quoted/upper variants (`phase: "DONE"`), which the quoted-YAML class
 * (H-050/052/053) showed up in the corpus.
 */
export function isTerminalPhase(phase: string | null | undefined): boolean {
  return phase != null && TERMINAL_PRD_PHASES.has(phase.toLowerCase());
}
