/**
 * review-debt.ts — pure logic for ReviewDebtGate.hook.ts (V21-W1-S1).
 *
 * Everything here is deterministic and side-effect-free so the gate's
 * behavior is unit-testable without a live transcript (the GoalLevelRouter /
 * lib/goal-level.ts split, applied to review debt).
 *
 * Definitions (documented per the slice spec — "simple, documented,
 * configurable"):
 *
 *   EDIT WAVE — a maximal run of code-producing Write/Edit/MultiEdit tool
 *   calls in transcript order, where consecutive edits separated by fewer
 *   than `waveGap` non-edit tool calls belong to the same wave. A gap of
 *   `waveGap` or more non-edit calls (default 5 — a Read in the middle of an
 *   editing burst does not split the wave) closes the wave; the next edit
 *   opens a new one.
 *
 *   REVIEW DEBT — the number of edit waves that occurred strictly AFTER the
 *   most recent /code-review invocation (Skill "code-review", with the
 *   historic "simplify" alias accepted for detection parity with
 *   VerifyGate.hook.ts — that hook's simplify_* identifier surface is a
 *   stable operator contract and is deliberately not touched here).
 *
 * Code-producing filter mirrors VerifyGate's intent (extensions + exclusion
 * rules) without importing from it — VerifyGate is claimed by the Forge loop
 * and its lists are private to that file.
 */

export interface TranscriptToolUse {
  name: string;
  input: Record<string, unknown>;
  /** ISO timestamp of the enclosing transcript entry ('' when absent). */
  ts: string;
}

/** Same extension surface VerifyGate treats as code-producing. */
const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'py', 'go', 'rs', 'rb',
  'java', 'kt', 'swift',
  'c', 'cpp', 'cc', 'h', 'hpp',
  'cs', 'php', 'lua',
  'sh', 'bash', 'zsh',
  'sql', 'tf', 'hcl', 'proto', 'graphql',
]);

const EXCLUDED_PATH_PATTERNS: RegExp[] = [
  /\.md$/i,
  /(?:^|\/)MEMORY\//,
  /(?:^|\/)node_modules\//,
  /(?:^|\/)dist\//,
  /(?:^|\/)build\//,
  /(?:^|\/)generated\//,
  /\.generated\.[^/]+$/,
  /(?:^|\/)__snapshots__\//,
  /\.snap$/,
  /\.fixture\.[^/]+$/,
];

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

/** VerifyGate detection parity: /simplify was renamed /code-review in Claude
 *  Code v2.1.146; both names satisfy the review signal. H-129 (Forge Gen 130):
 *  /review (PR-target review) and /security-review are the same review
 *  substance — a session that discharged review via /review kept warning on
 *  every later commit because the gate only counted the two original names. */
export const REVIEW_SKILL_RE = /^(simplify|code-review|review|security-review)\b/i;

export function isCodeProducingPath(path: string): boolean {
  if (!path) return false;
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  if (!CODE_EXTENSIONS.has(path.slice(dot + 1).toLowerCase())) return false;
  return !EXCLUDED_PATH_PATTERNS.some((re) => re.test(path));
}

export function isCodeEditCall(use: TranscriptToolUse): boolean {
  if (!EDIT_TOOLS.has(use.name)) return false;
  const p = typeof use.input.file_path === 'string' ? use.input.file_path : '';
  return isCodeProducingPath(p);
}

export function isReviewInvocation(use: TranscriptToolUse): boolean {
  if (use.name !== 'Skill') return false;
  const skill = typeof use.input.skill === 'string' ? use.input.skill : '';
  // Plugin-qualified names ("code-review:code-review") count too — key on the
  // final `:`-segment (the SkillActivationWriter normalization rule).
  const last = skill.split(':').pop() ?? skill;
  return REVIEW_SKILL_RE.test(skill) || REVIEW_SKILL_RE.test(last.trim());
}

/** Ordered tool_use extraction from transcript JSONL text (fail-soft on
 *  malformed lines — the VerifyGate extractToolUses shape, plus timestamps). */
export function extractToolUses(transcriptText: string): TranscriptToolUse[] {
  const uses: TranscriptToolUse[] = [];
  for (const line of transcriptText.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let entry: any;
    try {
      entry = JSON.parse(t);
    } catch {
      continue;
    }
    const blocks = entry?.message?.content;
    if (!Array.isArray(blocks)) continue;
    const ts = typeof entry?.timestamp === 'string' ? entry.timestamp : '';
    for (const b of blocks) {
      if (b?.type === 'tool_use' && typeof b.name === 'string') {
        uses.push({ name: b.name, input: (b.input ?? {}) as Record<string, unknown>, ts });
      }
    }
  }
  return uses;
}

export interface ReviewDebt {
  /** Edit waves strictly after the latest review signal. */
  debtWaves: number;
  /** Individual code-producing edit calls after the latest review signal. */
  editsSinceReview: number;
  /** true when any review invocation was found (transcript or external). */
  reviewSeen: boolean;
  /** ISO ts of the review signal used, '' when none. */
  lastReviewTs: string;
}

/**
 * Compute review debt over an ordered tool-use list.
 *
 * `externalReviewTs` lets the caller fold in a review signal the transcript
 * cannot carry (e.g. a skill-activations.jsonl code-review line surviving a
 * post-compact transcript truncation): edits at or before that timestamp are
 * treated as reviewed.
 */
export function computeReviewDebt(
  uses: TranscriptToolUse[],
  waveGap: number,
  externalReviewTs = '',
): ReviewDebt {
  let lastReviewIdx = -1;
  for (let i = 0; i < uses.length; i++) {
    if (isReviewInvocation(uses[i])) lastReviewIdx = i;
  }
  const transcriptReviewTs = lastReviewIdx >= 0 ? uses[lastReviewIdx].ts : '';
  const reviewSeen = lastReviewIdx >= 0 || externalReviewTs !== '';
  // ISO-8601 strings compare lexicographically; '' sorts before everything.
  const lastReviewTs =
    externalReviewTs > transcriptReviewTs ? externalReviewTs : transcriptReviewTs;

  let debtWaves = 0;
  let editsSinceReview = 0;
  let inWave = false;
  let gapSinceLastEdit = 0;

  for (let i = 0; i < uses.length; i++) {
    const u = uses[i];
    const afterIdx = i > lastReviewIdx;
    const afterTs = externalReviewTs === '' || (u.ts !== '' && u.ts > externalReviewTs);
    if (isCodeEditCall(u)) {
      if (!(afterIdx && afterTs)) continue; // reviewed territory
      editsSinceReview++;
      if (!inWave || gapSinceLastEdit >= waveGap) debtWaves++;
      inWave = true;
      gapSinceLastEdit = 0;
    } else {
      if (inWave) gapSinceLastEdit++;
      if (isReviewInvocation(u)) {
        // A review closes all open debt bookkeeping (already handled via
        // lastReviewIdx, but keep the wave state honest for ordering).
        inWave = false;
        gapSinceLastEdit = 0;
      }
    }
  }

  return { debtWaves, editsSinceReview, reviewSeen, lastReviewTs };
}

// ─── Trigger detection (the two surfaces the gate evaluates on) ─────────────

/** True when a Bash command contains a git-commit segment. Segments split on
 *  `|`, `;`, `&`, and newlines so `git log | grep commit` does not match. */
export function isGitCommitCommand(command: string): boolean {
  return /\bgit\b[^|;&\n]*\bcommit\b/.test(command);
}

/** True when a Write/Edit/MultiEdit payload sets `phase: complete` on a
 *  PRD.md — the PhaseCompleteGate.hook.ts detection contract, reproduced
 *  (that hook is Forge-claimed; do not import from it). */
export function isPhaseCompleteWrite(
  toolName: string,
  input: Record<string, unknown>,
): boolean {
  if (!EDIT_TOOLS.has(toolName)) return false;
  const filePath = typeof input.file_path === 'string' ? input.file_path : '';
  if (!/(^|\/)PRD\.md$/.test(filePath)) return false;
  const candidateText = [input.content, input.new_string]
    .filter((x): x is string => typeof x === 'string')
    .join('\n');
  return /^phase:\s*complete\s*$/m.test(candidateText);
}
