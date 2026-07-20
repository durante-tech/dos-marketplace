/**
 * recallFormat.ts — RFC-0037 Phase 2 Consolidation (V11.20)
 *
 * Phase 2 trigger fired: 3 consumers now share two pieces of logic
 * (primitive enumeration + result formatting). Per Sandi (1st rule): "the
 * wrong abstraction is far costlier than duplication" — 3 callers earn
 * extraction, no fewer.
 *
 * Consumers of the {@link RecallAdapter} (the N=3 that triggers this
 * consolidation):
 *   1. ~/.claude/hooks/IntentRetrieval.hook.ts — UserPromptSubmit-time
 *      CANONICAL → adapter dispatch (the original consumer, V11.16-wired).
 *      Currently keeps its own inline formatter byte-for-byte equal to
 *      this module's; will switch to the import after the V11.5+V11.6
 *      injection-observe work that is concurrently rewriting that file
 *      lands. The seam exists and is wired to the other two consumers
 *      now so consumer #1's adoption is a 3-line edit, not a redesign.
 *   2. ~/Durante/Tools/recall.ts — operator CLI surface
 *      (`bun Tools/recall.ts <primitive>`); imports formatRecallResult.
 *   3. ~/Durante/Tools/pre-commit-recall.ts — pre-commit gate that surfaces
 *      relevant prior recall data when commit subject/staged files name a
 *      known primitive (RFC numbers, project slugs, Studio/MemPalace);
 *      imports formatRecallResult.
 *
 * What's extracted (only what 3 consumers genuinely share):
 *   - RECALL_PRIMITIVE_KEYS: enumeration of registered primitive keys —
 *     callers iterate this without poking into RECALL_REGISTRY internals
 *   - isKnownPrimitive(name): case-insensitive membership check — used by
 *     pre-commit-recall to decide whether to dispatch on each detected token
 *   - formatRecallResult(r): markdown formatter shared by IntentRetrieval
 *     (UserPromptSubmit injection) + recall.ts CLI (stdout) + pre-commit-
 *     recall (commit-message hint stream)
 *
 * What's NOT extracted (per-consumer concern):
 *   - Primitive detection from free-text — IntentRetrieval has its own
 *     PRIMITIVE_PATTERNS in lib/intent-classifier.ts (regex against prompt);
 *     pre-commit-recall has its own commit-subject scanner; recall.ts takes
 *     a CLI argv. Three different inputs → no shared abstraction.
 *   - Output sink — IntentRetrieval injects into UserPromptSubmit,
 *     recall.ts writes to stdout, pre-commit-recall writes to a hint buffer.
 *     Three different sinks → no shared abstraction.
 *
 * No I/O at module load. Pure exports.
 */

import type { RecallResult } from './RecallAdapter';
import { RECALL_REGISTRY } from './RecallAdapter';

/**
 * Frozen array of registered primitive keys (lowercase, matching the
 * RECALL_REGISTRY map keys). Computed once at module load. Consumers
 * iterate this for "show me everything" surfaces (CLI --all flag,
 * pre-commit dispatch over multiple detected tokens).
 *
 * Sorted for deterministic test snapshots.
 */
export const RECALL_PRIMITIVE_KEYS: readonly string[] = Object.freeze(
  Object.keys(RECALL_REGISTRY).sort(),
);

/**
 * Case-insensitive membership check. Returns true iff `name` resolves to a
 * registered primitive. Empty/whitespace-only → false. Never throws.
 *
 * Used by pre-commit-recall + recall.ts to early-exit when the operator's
 * input doesn't match a known primitive (saves a backend dispatch).
 * IntentRetrieval doesn't call this — its classifier already enumerated
 * primitives via PRIMITIVE_PATTERNS in lib/intent-classifier.ts.
 */
export function isKnownPrimitive(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  return trimmed.toLowerCase() in RECALL_REGISTRY;
}

/**
 * Truncation budget for the JSON value block in formatted output. Picked
 * to match IntentRetrieval's pre-extraction value (1500 chars) — the
 * extraction is byte-equivalent so existing UserPromptSubmit injection
 * snapshots stay stable.
 */
const VALUE_BLOCK_TRUNCATE_AT = 1500;

/**
 * Maximum number of conflicts surfaced inline. Past 5 the noise-to-signal
 * crashes; if there are more conflicts the count is shown in the header.
 * Same value as IntentRetrieval's pre-extraction code.
 */
const CONFLICTS_INLINE_MAX = 5;

/**
 * Render a {@link RecallResult} as a compact Markdown block. Identical
 * output to the prior IntentRetrieval.hook.ts inline formatter (lines
 * 82-108 before this extraction) — verified byte-equivalent so the
 * existing UserPromptSubmit injection text doesn't drift.
 *
 * Never throws. JSON-serialization failures degrade to a single-line
 * placeholder so the surrounding markdown stays valid.
 *
 * Typical output (Studio primitive, current claim, no conflicts):
 *
 * ```
 * ## Canonical Recall — Studio
 * **Status:** current | **Source:** palace | **Precedence:** operator-wins
 *
 * ```json
 * {
 *   "palace_hit_count": 5,
 *   "palace_summary": "..."
 * }
 * ```
 *
 * **Backends queried:** palace, studio-mirror
 * ```
 */
export function formatRecallResult(r: RecallResult): string {
  const lines: string[] = [];
  lines.push(`## Canonical Recall — ${r.primitive}`);
  if (r.current) {
    lines.push(
      `**Status:** ${r.current.status} | **Source:** ${r.current.source} | **Precedence:** ${r.current.precedence}`,
    );
    try {
      const valueJson = JSON.stringify(r.current.value, null, 2);
      lines.push('\n```json');
      lines.push(
        valueJson.length > VALUE_BLOCK_TRUNCATE_AT
          ? valueJson.slice(0, VALUE_BLOCK_TRUNCATE_AT) + '\n…(truncated)'
          : valueJson,
      );
      lines.push('```');
    } catch {
      lines.push('(value not JSON-serializable)');
    }
  } else {
    lines.push('(no current claim — backends returned no usable data)');
  }
  lines.push(`\n**Backends queried:** ${r.sources.join(', ') || '(none)'}`);
  if (r.conflicts.length > 0) {
    lines.push(`\n**Conflicts (${r.conflicts.length}):**`);
    for (const c of r.conflicts.slice(0, CONFLICTS_INLINE_MAX)) {
      lines.push(`- ${c.backendA} ↔ ${c.backendB}: ${c.reason}`);
    }
  }
  return lines.join('\n');
}
