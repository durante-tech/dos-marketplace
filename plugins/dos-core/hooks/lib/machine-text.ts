/**
 * machine-text.ts — shared detector for harness-generated prompt text.
 *
 * Unions the two in-repo catalogs that already filtered system-injected text:
 *   - CorrectionDetector.hook.ts ANTI_PATTERNS (XML envelope prefixes)
 *   - RatingCapture.hook.ts SYSTEM_TEXT_PATTERNS (prose continuation prefixes)
 *
 * Consumed by the three UserPromptSubmit classifiers (EscalationGate,
 * IntentRetrieval, OrchestratorPrompt) and the Stop-side ModeHeaderGuard so
 * machine-generated turns are excluded from operator-intent classification.
 *
 * Prefix-anchored by design: a hybrid turn where the operator appends real
 * text below a pasted well-formed envelope is treated as machine text (a
 * documented, accepted residual). Pure module — no I/O.
 */

// XML envelope prefixes. Case-insensitive (/i) to match the RatingCapture
// variants of the same tags. Sourced from CorrectionDetector.hook.ts ANTI_PATTERNS
// plus RatingCapture.hook.ts SYSTEM_TEXT_PATTERNS.
export const MACHINE_TEXT_PATTERNS: RegExp[] = [
  /^<task-notification>/i,
  /^<system-reminder>/i,
  /^<command-message>/i,
  /^<command-name>/i,
  /^<user-prompt-submit-hook>/i,
  // Prose continuation prefixes (harness-injected, not operator-typed).
  /^This session is being continued from a previous conversation/i,
  /^Please continue the conversation/i,
  /^Note:.*was read before/i,
];

/**
 * True when the prompt opens with a harness-generated envelope or continuation
 * prefix. Trim-first matches RatingCapture.hook.ts:449 semantics and tolerates
 * leading whitespace.
 *
 * UNTOUCHED for non-router consumers (EscalationGate, OrchestratorPrompt,
 * RatingCapture, ModeHeaderGuard). The router (classifyPrompt) uses
 * stripMachineText below instead, which strips-and-re-enters per spec A.1.
 */
export function isMachineGeneratedPrompt(p: string): boolean {
  const trimmed = p.trim();
  return MACHINE_TEXT_PATTERNS.some((re) => re.test(trimmed));
}

// ─── Strip-and-re-enter (spec A.1 / RT-A4) ────────────────────────────────
//
// The router-side composition partner for classifyPrompt. Where
// isMachineGeneratedPrompt returns a single boolean ("the whole turn is
// machine"), stripMachineText PEELS the leading machine block(s) and hands
// back the human remainder so the classifier can re-enter the evidence table
// on the typed text. A pasted <task-notification> with 'debug
// StudioSync.hook.ts…' typed below it is classified on the typed text.
//
// Two pattern shapes in MACHINE_TEXT_PATTERNS, handled distinctly:
//   - XML envelope prefixes (^<tag>): strip the prefix envelope THROUGH its
//     matching close tag, looping for stacked envelopes. An UNCLOSED envelope
//     (truncated paste) is treated as all-machine → remainder='' (documented
//     residual — we cannot know where the human text begins).
//   - Prose continuation prefixes (no close tag): the entire text is machine,
//     remainder=''.
//
// Pure module — no I/O. Trim-first matches isMachineGeneratedPrompt semantics.

/** The XML-envelope subset of MACHINE_TEXT_PATTERNS (those anchored on `^<tag>`). */
const ENVELOPE_TAGS: string[] = [
  'task-notification',
  'system-reminder',
  'command-message',
  'command-name',
  'user-prompt-submit-hook',
];

/** The prose-continuation subset (no closing tag — whole text is machine). */
const PROSE_CONTINUATION_PATTERNS: RegExp[] = [
  /^This session is being continued from a previous conversation/i,
  /^Please continue the conversation/i,
  /^Note:.*was read before/i,
];

export interface StripResult {
  /** Human remainder after peeling leading machine block(s). '' when all-machine. */
  remainder: string;
  /** True when at least one leading machine block was stripped. */
  stripped: boolean;
  /** Count of machine blocks peeled (envelopes; 1 for a prose-continuation match). */
  blocks: number;
}

export function stripMachineText(p: string): StripResult {
  let current = p.trim();

  // Prose-continuation prefixes have no close tag — the whole turn is machine.
  for (const re of PROSE_CONTINUATION_PATTERNS) {
    if (re.test(current)) {
      return { remainder: '', stripped: true, blocks: 1 };
    }
  }

  let blocks = 0;
  // Peel stacked XML envelopes from the front. Loop until the head is no
  // longer an envelope prefix.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const head = current;
    const openMatch = /^<([a-z][a-z0-9-]*)>/i.exec(head);
    if (!openMatch) break;
    const tag = openMatch[1]!.toLowerCase();
    if (!ENVELOPE_TAGS.includes(tag)) break;

    // Find the matching close tag for THIS opening tag.
    const closeRe = new RegExp(`</${tag}>`, 'i');
    const closeMatch = closeRe.exec(head);
    if (!closeMatch) {
      // Unclosed envelope (truncated paste): treat as all-machine.
      return { remainder: '', stripped: true, blocks: blocks + 1 };
    }
    const closeEnd = closeMatch.index + closeMatch[0].length;
    current = head.slice(closeEnd).trim();
    blocks += 1;
    if (current.length === 0) break;
  }

  if (blocks === 0) {
    // No leading machine block — fully human text.
    return { remainder: current, stripped: false, blocks: 0 };
  }
  return { remainder: current, stripped: true, blocks };
}
