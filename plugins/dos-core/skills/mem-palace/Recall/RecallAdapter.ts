/**
 * RecallAdapter.ts — RFC-0037 Phase 1, Workstream WS-F
 *
 * Walking adapter (Cockburn R2 hybrid): one Sea-level use case (`recall`),
 * three named hardcoded call-sites inside a registry. No shared types
 * extracted from the per-primitive recall functions — Sandi's anti-pre-naming
 * move (RFC-0037 §2 disambiguation, §5.4). The result type is a discriminated
 * UNION of the three per-primitive result shapes; if Phase 2's trigger
 * condition fires (≥3 call sites sharing a load-bearing pattern), the
 * extraction can name itself then.
 *
 * Lookup is case-insensitive — `recall('STUDIO')`, `recall('Studio')`, and
 * `recall('studio')` all hit the same handler. Unknown primitives return
 * null without throwing; callers (IntentRetrieval hook) treat null as
 * "fall through to legacy dispatch."
 *
 * Per MEMORY entry pack-install-runtime-path-quirk: this file imports
 * sibling recall functions, which in turn import bridgeSync from
 * ../../../hooks/lib/mempalace. That path only resolves at the live install
 * location ~/.claude/skills/mem-palace/Recall/. Under symlink mode the live
 * tree IS the submodule — same physical file backs both the pack-source
 * compile check (after copy-to-live) and the production runtime.
 */

import { recallStudio } from './recallStudio';
import type { RecallStudioResult } from './recallStudio';
import { recallMemPalace } from './recallMemPalace';
import { recallGatewayEnv } from './recallGatewayEnv';

// recallMemPalace and recallGatewayEnv intentionally do NOT export their
// per-primitive Result types — Sandi's discipline. We reconstruct them here
// via inferred return-type so the union stays type-safe without the per-pack
// modules leaking shared types. ReturnType<Promise<X>> unwraps the awaited shape.
type RecallMemPalaceResult = Awaited<ReturnType<typeof recallMemPalace>>;
type RecallGatewayEnvResult = Awaited<ReturnType<typeof recallGatewayEnv>>;

/**
 * Discriminated union over the three per-primitive result shapes. Callers
 * narrow on `result.primitive` (literal type 'Studio' | 'MemPalace' |
 * 'gateway-env'). NOT extracted to a shared types.ts — Phase 2 only.
 */
export type RecallResult =
  | RecallStudioResult
  | RecallMemPalaceResult
  | RecallGatewayEnvResult;

/**
 * Registry of named recall functions, keyed by lowercase primitive name.
 * Adding a 4th primitive in Phase 2 = one map entry + one import. This is
 * the entire abstraction — no factory, no decorator, no plugin contract.
 */
export const RECALL_REGISTRY: Record<string, () => Promise<RecallResult>> = {
  'studio': recallStudio,
  'mempalace': recallMemPalace,
  'gateway-env': recallGatewayEnv,
};

/**
 * Walking adapter wrapping the registry. Stateful only in name — the class
 * exists so callers have one named seam (`new RecallAdapter().recall(p)`)
 * even though there's nothing to construct. Phase 2 will likely add per-
 * instance config (timeout budgets, backend allowlists); the seam is here
 * before it earns its keep so the API doesn't churn.
 */
export class RecallAdapter {
  /**
   * Resolve a primitive name to its named recall function and invoke it.
   * Case-insensitive lookup. Returns null on unknown primitive — never
   * throws so callers can treat null as a deterministic miss signal.
   */
  async recall(primitive: string): Promise<RecallResult | null> {
    const fn = RECALL_REGISTRY[primitive.toLowerCase()];
    if (!fn) return null;
    return fn();
  }
}
