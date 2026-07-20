#!/usr/bin/env bun
/**
 * CorrectionDetector.hook.ts - Detect User Corrections in Real-Time
 *
 * PURPOSE:
 * Pattern-matches user messages for correction signals ("no, that's wrong",
 * "actually it's X", "not Y, it's Z"). Queues detected corrections for
 * MemoryHarvest to process at session end with full context.
 *
 * This is pure pattern matching — NO inference calls, <50ms execution.
 *
 * TRIGGER: UserPromptSubmit
 *
 * INPUT:
 * - stdin: { session_id, prompt }
 *
 * OUTPUT:
 * - stdout: None (never blocks)
 * - stderr: Detection log
 * - Side effect: Appends to STATE/correction-queue-{session_id}.json
 * - exit(0): Always
 *
 * INTER-HOOK RELATIONSHIPS:
 * - INDEPENDENT OF: RatingCapture, MemPalaceRate
 * - FEEDS: MemoryHarvest.hook.ts (reads correction queue at SessionEnd)
 */

import { readFileSync, existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { atomicWriteSync } from './lib/atomic-write';
import { startTimer, stopTimer } from './lib/hook-io';
import { emitMemoryDigest } from './lib/memory-digest';
import { getMemorySubdir } from './lib/paths';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), ".claude");
const STATE_DIR = join(DOS_DIR, "MEMORY", "STATE");

interface HookInput {
  session_id: string;
  prompt: string;
  hook_event_name: string;
}

// V11.11 — Short-hard-correction fast-path (RFC-0076 ISC-V11.11).
// Targets terse rating-1 anchor events like `then 2` / `then 2 then 3` /
// `wait` that the existing CORRECTION_PATTERNS miss because they're shorter
// than the 15-char anti-pattern threshold. Must run BEFORE the ANTI_PATTERNS
// loop (which would otherwise reject any ≤15-char prompt).
// Spec: MEMORY/WORK/20260511-030000_v11-11-correctiondetector-regex-spec/PRD.md
const SHORT_HARD_CORRECTION = /^(?:no|not|actually|then|wait|instead)(?:\s|$|[,.;:!?])/i;
const SHORT_HARD_ANTI = /^(?:no\s+(?:worries|problem|idea|kidding)|not\s+(?:sure|really|quite|exactly|yet))\b/i;
const CORRECTION_LENGTH_CAP = 30;

/**
 * Confidence score for a short-hard correction match. Informational only —
 * does NOT gate the queue write. Emitted in the digest message.
 * Base 0.85 + bonuses, capped at 0.99.
 */
function shortHardConfidence(prompt: string): number {
  let conf = 0.85;
  if (/^(?:then|actually|instead)\s/i.test(prompt)) conf += 0.05; // strong corrective verbs
  if (prompt.length <= 15) conf += 0.05; // terser → higher confidence
  if (/\d/.test(prompt)) conf += 0.04;   // matches "then 2" / "then 3" shape
  return Math.min(conf, 0.99);
}

/**
 * V11.11 fast-path: match the short-hard-correction shape ahead of the
 * regular detectCorrection() flow. Returns { correction, confidence } on
 * match, null otherwise. The anti-pattern guard suppresses the two FP
 * families observed in 30-day corpus (`no worries/problem/idea/kidding`
 * and `not sure/really/quite/exactly/yet`).
 */
function detectShortHardCorrection(prompt: string): { correction: string; confidence: number } | null {
  const trimmed = prompt.trim();
  if (trimmed.length > CORRECTION_LENGTH_CAP) return null;
  const firstLine = trimmed.split("\n")[0];
  if (!SHORT_HARD_CORRECTION.test(firstLine)) return null;
  if (SHORT_HARD_ANTI.test(firstLine)) return null;
  return { correction: trimmed, confidence: shortHardConfidence(trimmed) };
}

// Correction signal patterns (case-insensitive)
// These patterns indicate the user is correcting the AI about a fact
const CORRECTION_PATTERNS: RegExp[] = [
  // Direct negation + correction
  /\bno[,.]?\s+(?:it'?s|that'?s|the)\s+/i,
  /\bno[,.]?\s+(?:actually|not)\b/i,
  /\bthat'?s\s+(?:wrong|incorrect|not right|not true)\b/i,
  /\bthat'?s\s+not\s+(?:how|what|where|when)\b/i,

  // "Actually" corrections
  /\bactually[,.]?\s+(?:it'?s|the|we|I|that)\b/i,
  /\bactually[,.]?\s+(?:no|not)\b/i,

  // "Not X, it's Y" pattern
  /\bnot\s+.{2,30}[,]\s+(?:it'?s|it\s+is|the)\b/i,

  // Path/location corrections (common in DOS)
  /\bthe\s+(?:path|dir|directory|folder|file)\s+is\s+(?:actually\s+)?[~/]/i,
  /\bit'?s\s+(?:at|in|under)\s+[~/]/i,

  // "Wrong" + correction
  /\bwrong\b.{0,20}\b(?:it'?s|should be|correct|right)\b/i,

  // "Should be X not Y"
  /\bshould\s+be\b.{1,40}\bnot\b/i,

  // "Instead of X, use Y"
  /\binstead\s+of\b/i,

  // "Don't" + behavioral correction
  /\bdon'?t\s+(?:do|use|add|create|make|put|save|store)\b/i,
  /\bstop\s+(?:doing|using|adding)\b/i,
  /\bnever\s+(?:do|use|add|create|make)\b/i,

  // "Remember that" (explicit memory request)
  /\bremember\s+(?:that|this|to)\b/i,

  // Version/name corrections
  /\bit'?s\s+(?:v?\d+\.\d+|version\s+\d+)/i,
  /\bthe\s+(?:name|version|number)\s+is\b/i,
];

// Anti-patterns: messages that match correction patterns but aren't corrections
const ANTI_PATTERNS: RegExp[] = [
  // Harness-injected envelopes (not user-typed; bodies contain agent text that
  // matches correction regexes spuriously — fixed 2026-05-08 after 4 false
  // positives queued during a multi-agent council run).
  /^<task-notification>/,
  /^<system-reminder>/,
  /^<command-message>/,
  /^<command-name>/,
  /^<user-prompt-submit-hook>/,

  // Code/commands (not conversational corrections)
  /^```/,
  /^\s*(?:import|const|let|var|function|class|export)\b/,
  /^\s*(?:git|npm|bun|yarn|docker|curl|cd|ls|rm)\s/,

  // Questions (asking, not correcting)
  /\?$/,

  // Very short messages (likely acknowledgments)
  /^.{0,15}$/,

  // Instructional context (telling AI what to do, not correcting)
  /^(?:please|can you|could you|I need|I want)\b/i,
];

// ─── B.2(b) / RT-A15 / F5 — operator mode-override capture ─────────────────
//
// The single signal that ever identified a REAL router misroute is the operator
// telling us the mode was wrong ("this should have been ALGORITHM", "why are
// you in NATIVE"). Per the ratified spec (classifier-ratified-spec-2026-06-12
// B.2(b)), CorrectionDetector recognizes mode-correction language and writes an
// override row — the correctness label for the C qualitative tripwire
// (AdversarialEmpiricist's revisit condition). This is independent of the
// correction-queue write: an override is BOTH a correction (queued) AND a
// labeled misroute (override row). Pure regex; the writer is fail-open.

const MODE_WORD = '(ALGORITHM|NATIVE|MINIMAL)';

// Corrective frames naming a mode. Case-insensitive. Each captures the mode the
// operator says the turn SHOULD have been (claimed_mode), where determinable.
const MODE_OVERRIDE_PATTERNS: RegExp[] = [
  // "this should have been ALGORITHM" / "should've been NATIVE" / "should be ALGORITHM mode"
  new RegExp(`\\bshould(?:'ve| have| be)?\\s+(?:been\\s+|be\\s+)?${MODE_WORD}\\b`, 'i'),
  // "why are you in NATIVE" / "why are we in MINIMAL mode"
  new RegExp(`\\bwhy\\s+(?:are|is|were)\\s+(?:you|we|this|it)\\s+(?:in|using)\\s+${MODE_WORD}\\b`, 'i'),
  // "that('s| was) ALGORITHM (work|not NATIVE)" — corrective frame + mode word
  new RegExp(`\\bthat(?:'s| was| is)\\s+${MODE_WORD}\\b`, 'i'),
  // "you should have used ALGORITHM" / "use ALGORITHM mode" in a corrective frame
  new RegExp(`\\b(?:should\\s+have\\s+)?used?\\s+${MODE_WORD}(?:\\s+mode)?\\b`, 'i'),
  // "not NATIVE, ALGORITHM" / "ALGORITHM not NATIVE" — explicit mode contrast
  new RegExp(`\\b${MODE_WORD}\\s*,?\\s+not\\s+${MODE_WORD}\\b`, 'i'),
  new RegExp(`\\bnot\\s+${MODE_WORD}\\s*,?\\s+(?:it'?s\\s+)?${MODE_WORD}\\b`, 'i'),
  // "wrong mode" + a mode word anywhere — corrective frame
  new RegExp(`\\bwrong\\s+mode\\b`, 'i'),
];

interface ModeOverride {
  /** The mode the operator says the turn SHOULD have been, when determinable. */
  claimed_mode: 'ALGORITHM' | 'NATIVE' | 'MINIMAL' | null;
  /** The matched corrective frame text (trimmed, capped). */
  matched: string;
}

// Override-specific anti-patterns: ONLY harness envelopes and code shapes. The
// question-mark and short-message anti-patterns from ANTI_PATTERNS are
// DELIBERATELY excluded — "why are you in NATIVE?" is a question by form but a
// mode-override by intent (the canonical B.2(b) exemplar). Honoring /\?$/ here
// would silence exactly the override the spec names.
const OVERRIDE_ANTI_PATTERNS: RegExp[] = [
  /^<task-notification>/,
  /^<system-reminder>/,
  /^<command-message>/,
  /^<command-name>/,
  /^<user-prompt-submit-hook>/,
  /^```/,
  /^\s*(?:import|const|let|var|function|class|export)\b/,
  /^\s*(?:git|npm|bun|yarn|docker|curl|cd|ls|rm)\s/,
];

/**
 * Detect operator mode-correction language. Returns the override or null.
 * Only harness-envelope/code anti-patterns are honored (NOT question/short
 * anti-patterns) so a machine turn that happens to contain a mode word does not
 * mint a false override while genuine question-form overrides survive. The bare
 * "wrong mode" frame yields claimed_mode=null (the operator named no target); a
 * captured mode word fills claimed_mode.
 */
function detectModeOverride(prompt: string): ModeOverride | null {
  const firstLine = prompt.split("\n")[0].trim();
  for (const anti of OVERRIDE_ANTI_PATTERNS) {
    if (anti.test(firstLine)) return null;
  }
  for (const re of MODE_OVERRIDE_PATTERNS) {
    const m = re.exec(prompt);
    if (m) {
      // The mode word after "not" is the REJECTED one; the corrected (claimed)
      // mode is the OTHER mode word. Taking the first capture group was backwards
      // for the "not X, it's Y" frame (recorded X, the rejected mode). Single-mode
      // frames ("should have been ALGORITHM", "why are you in NATIVE") keep their
      // sole mode word. (Forge Gen 24, verified across all frame shapes.)
      const span = m[0];
      const modeWords = [...span.matchAll(/\b(ALGORITHM|NATIVE|MINIMAL)\b/gi)]
        .map((x) => x[1]!.toUpperCase() as ModeOverride['claimed_mode']);
      const rejMatch = span.match(/\bnot\s+(ALGORITHM|NATIVE|MINIMAL)\b/i);
      const rejected = rejMatch ? rejMatch[1]!.toUpperCase() : null;
      let claimed: ModeOverride['claimed_mode'] = null;
      for (const w of modeWords) {
        if (w !== rejected) { claimed = w; break; }
      }
      if (!claimed && modeWords.length > 0) claimed = modeWords[0]!;
      return { claimed_mode: claimed, matched: prompt.slice(0, 200).trim() };
    }
  }
  return null;
}

/**
 * Append a mode-override row to LEARNING/SIGNALS/mode-override.jsonl (project-
 * first via getMemorySubdir, matching the router-trace SIGNALS convention).
 * Fail-open — never throws into the hook path.
 */
function writeModeOverride(sessionId: string, override: ModeOverride): void {
  try {
    const signalsDir = join(getMemorySubdir('LEARNING'), 'SIGNALS');
    if (!existsSync(signalsDir)) mkdirSync(signalsDir, { recursive: true });
    const row = {
      ts: new Date().toISOString(),
      session_id: sessionId,
      claimed_mode: override.claimed_mode,
      matched: override.matched,
    };
    appendFileSync(join(signalsDir, 'mode-override.jsonl'), `${JSON.stringify(row)}\n`);
  } catch {
    // fail-open
  }
}

/**
 * Detect if a user message contains a correction signal.
 * Returns the matched correction text or null.
 */
function detectCorrection(prompt: string): string | null {
  // Check anti-patterns first
  const firstLine = prompt.split("\n")[0].trim();
  for (const anti of ANTI_PATTERNS) {
    if (anti.test(firstLine)) return null;
  }

  // Check correction patterns
  for (const pattern of CORRECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      // Return the first 200 chars as the correction context
      return prompt.slice(0, 200).trim();
    }
  }

  return null;
}

/**
 * Append correction to the session queue.
 */
function queueCorrection(sessionId: string, correction: string): void {
  const queueFile = join(STATE_DIR, `correction-queue-${sessionId}.json`);

  try {
    mkdirSync(STATE_DIR, { recursive: true });

    let queue: string[] = [];
    if (existsSync(queueFile)) {
      try {
        queue = JSON.parse(readFileSync(queueFile, "utf-8"));
        if (!Array.isArray(queue)) queue = [];
      } catch {
        queue = [];
      }
    }

    // Cap at 20 corrections per session (prevent runaway)
    if (queue.length >= 20) {
      console.error("[CorrectionDetector] Queue full (20 max), skipping");
      return;
    }

    queue.push(correction);
    // RFC-0005 §13.1 R2: atomic write — queueFile is read+rewritten in a
    // read-modify-write cycle; torn writes would drop corrections.
    atomicWriteSync(queueFile, JSON.stringify(queue));
  } catch (err) {
    console.error("[CorrectionDetector] Queue write error:", err);
  }
}

async function main() {
  // Read hook input
  let input: HookInput | null = null;
  try {
    const decoder = new TextDecoder();
    const reader = Bun.stdin.stream().getReader();
    let raw = "";

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 200));
    const read = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
      }
    })();

    await Promise.race([read, timeout]);
    if (raw.trim()) input = JSON.parse(raw) as HookInput;
  } catch {
    process.exit(0);
  }

  if (!input?.prompt || !input?.session_id) {
    process.exit(0);
  }

  // B.2(b) / RT-A15 / F5 — operator mode-override capture. Runs BEFORE the
  // correction fast-path/regular detector and its early exits, so an override
  // that ALSO matches a correction shape ("no, that's ALGORITHM not NATIVE")
  // still records the misroute label even when the fast-path exits early. The
  // override row is the correctness channel; the correction queue is separate.
  const modeOverride = detectModeOverride(input.prompt);
  if (modeOverride) {
    writeModeOverride(input.session_id, modeOverride);
    console.error(
      `[CorrectionDetector] MODE-OVERRIDE captured (claimed_mode=${modeOverride.claimed_mode ?? 'null'}): "${modeOverride.matched.slice(0, 60)}"`,
    );
  }

  // V11.11 — Short-hard-correction fast-path runs first, before the regular
  // detector. This bypasses the ≤15-char anti-pattern in detectCorrection()
  // that would otherwise reject the rating-1 anchor prompts.
  const fastPath = detectShortHardCorrection(input.prompt);
  if (fastPath) {
    queueCorrection(input.session_id, fastPath.correction);
    let queueSize = 1;
    try {
      const queueFile = join(STATE_DIR, `correction-queue-${input.session_id}.json`);
      if (existsSync(queueFile)) {
        const parsed = JSON.parse(readFileSync(queueFile, "utf-8"));
        if (Array.isArray(parsed)) queueSize = parsed.length;
      }
    } catch {
      // Fall back to size 1 if read fails
    }
    const confStr = fastPath.confidence.toFixed(2);
    console.error(
      `[CorrectionDetector] HIGH-CONFIDENCE short-hard correction (conf=${confStr}): "${fastPath.correction}"`
    );
    emitMemoryDigest(
      `HIGH-CONFIDENCE correction detected (short hard pivot, conf=${confStr}, queue size ${queueSize}). PAUSE: re-read the user's last message verbatim, acknowledge the correction in the next response BEFORE continuing the prior task, and confirm understanding by restating what changed.`
    );
    process.exit(0);
  }

  // Detect correction
  const correction = detectCorrection(input.prompt);
  if (correction) {
    queueCorrection(input.session_id, correction);
    console.error(
      `[CorrectionDetector] Queued correction: "${correction.slice(0, 60)}..."`
    );

    // Stdout digest via shared helper (gate + wrapper centralized in lib/memory-digest).
    if (true) {
      let queueSize = 1;
      try {
        const queueFile = join(STATE_DIR, `correction-queue-${input.session_id}.json`);
        if (existsSync(queueFile)) {
          const parsed = JSON.parse(readFileSync(queueFile, "utf-8"));
          if (Array.isArray(parsed)) queueSize = parsed.length;
        }
      } catch {
        // Fall back to size 1 if read fails
      }
      emitMemoryDigest(`correction queued (queue size ${queueSize})`);
    }
  }

  process.exit(0);
}

const _t = startTimer('CorrectionDetector');
process.on('exit', () => stopTimer(_t, 'UserPromptSubmit'));
main().catch(() => process.exit(0));
