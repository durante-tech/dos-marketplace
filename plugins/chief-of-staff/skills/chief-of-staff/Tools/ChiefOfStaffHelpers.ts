/**
 * ChiefOfStaffHelpers.ts — deterministic logic extracted from workflow prose.
 *
 * Relocated from Followup.md Step 3 (prose-mislocation audit B4, RFC-0126 §9).
 * The chase-date math was hand-typed per run; this pins the three branches to a
 * tested function so the workflow prose can call it instead of re-deriving it.
 *
 * Date model: all dates are ISO calendar-date strings (`YYYY-MM-DD`), no time
 * component, interpreted in the principal's local civil day. This keeps the math
 * timezone-free and the function pure (no `new Date()` "now" inside — the caller
 * passes `today`).
 */

import { homedir } from 'os';
import { join } from 'path';

export type ChaseKind = 'hard-deadline' | 'soft-getback' | 'circle-back-2w';

export interface ChaseDateInput {
  /** Which of the three commitment branches this row is. */
  kind: ChaseKind;
  /** Reference day as ISO YYYY-MM-DD. For hard-deadline this is unused (deadline drives it); for the other two it is the day the commitment was made ("today"). */
  today: string;
  /** The hard deadline as ISO YYYY-MM-DD. Required only for kind === 'hard-deadline'. */
  deadline?: string;
  /**
   * Soft-getback chase window in business days. Defaults to 5 (the principal's
   * default chase window), overridable via principal.md.
   */
  softWindowBusinessDays?: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse an ISO YYYY-MM-DD into a UTC-anchored Date (noon UTC to dodge DST edges). */
function parseIsoDate(iso: string): Date {
  if (!ISO_DATE_RE.test(iso)) {
    throw new Error(`Invalid ISO date (expected YYYY-MM-DD): ${iso}`);
  }
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  // Reject calendar-invalid dates that JS would silently roll over (e.g. 2026-02-30).
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error(`Invalid calendar date: ${iso}`);
  }
  return date;
}

/** Format a UTC-anchored Date back to ISO YYYY-MM-DD. */
function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Saturday (6) or Sunday (0) in UTC terms. */
function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Add (or subtract, if `n` is negative) `n` business days to an ISO date,
 * skipping Saturdays and Sundays. Weekends are not counted as steps. The
 * landing day is never a weekend.
 */
export function addBusinessDays(iso: string, n: number): string {
  const date = parseIsoDate(iso);
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + step);
    if (!isWeekend(date)) {
      remaining -= 1;
    }
  }
  return toIsoDate(date);
}

/** Add `n` calendar days (weekends counted) to an ISO date. */
export function addCalendarDays(iso: string, n: number): string {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + n);
  return toIsoDate(date);
}

/**
 * Compute the chase date for a commitment ledger row.
 *
 * Branches (preserve Followup.md Step 3 exactly):
 *  - hard-deadline   → deadline − 2 business days
 *  - soft-getback    → today + N business days (N defaults to 5, overridable)
 *  - circle-back-2w  → today + 12 calendar days (the day-12 rule; not 14, not business days)
 *
 * Returns ISO YYYY-MM-DD.
 */
export function computeChaseDate(input: ChaseDateInput): string {
  switch (input.kind) {
    case 'hard-deadline': {
      if (!input.deadline) {
        throw new Error("computeChaseDate: kind 'hard-deadline' requires a deadline");
      }
      return addBusinessDays(input.deadline, -2);
    }
    case 'soft-getback': {
      const window = input.softWindowBusinessDays ?? 5;
      return addBusinessDays(input.today, window);
    }
    case 'circle-back-2w': {
      return addCalendarDays(input.today, 12);
    }
    default: {
      const exhaustive: never = input.kind;
      throw new Error(`computeChaseDate: unknown kind ${String(exhaustive)}`);
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Triage four-bucket presentation render (Triage.md Step 5, prose-mislocation
 * audit B1, RFC-0126 §9).
 *
 * The presentation skeleton — section headers, emoji, per-bucket counts,
 * indentation, the `---` draft fences, the approval prompts, and the fixed
 * suffix strings ("two-touch rule active", "rolled up for Morning brief") — is
 * a deterministic transform of structured bucket data into operator-facing
 * markdown. The field VALUES (sender, subject, draft body, TLDR, enrichment,
 * rule text) remain agent-judgment-filled; this helper only fixes the bytes of
 * the skeleton so the layout cannot drift between runs.
 *
 * Output is byte-identical to the prior inline template: same headings, same
 * two-space / five-space indentation, same blank-line separators, same trailing
 * structure. Empty buckets still render their header line with a `(0)` count
 * (the template always showed every section header).
 * ────────────────────────────────────────────────────────────────────────── */

/** A drafted message in the Principal-Must-Reply or EA-Handles bucket. */
export interface TriageDraftItem {
  sender: string;
  subject: string;
  /** Principal-Must-Reply: the 1-line relationship note. EA-Handles: leave undefined. */
  context?: string;
  /** EA-Handles: the rule that fired, or undefined → renders "Rule applied: {rule text if any}" empty form. */
  ruleApplied?: string;
  draftBody: string;
}

/** A one-line item in the FYI / Archive / First-Contact / New-Rules buckets. */
export interface TriageBulletItem {
  /** FYI: the TLDR. New-rules: the rule text. (single-field bullet) */
  text?: string;
  /** Archive / First-contact: the leading sender, paired with `detail`. */
  sender?: string;
  /** Archive: reason. First-contact: 3-line enrichment. */
  detail?: string;
}

export interface TriagePresentation {
  count: number;
  mustReply: TriageDraftItem[];
  fyi: TriageBulletItem[];
  eaHandles: TriageDraftItem[];
  archive: TriageBulletItem[];
  firstContact: TriageBulletItem[];
  newRules: TriageBulletItem[];
}

/** Render one numbered draft item (Must-Reply / EA-Handles), preserving the 5-space body indent. */
function renderDraftItem(item: TriageDraftItem, index: number, approvalPrompt: string): string {
  const lines: string[] = [];
  const tag = approvalPrompt === 'Approve? [yes / edit / skip]'
    ? '[DRAFT — REVIEW REQUESTED]'
    : '[DRAFT — OK TO SEND?]';
  lines.push(`  ${index}. ${tag} From: ${item.sender} — Subject: ${item.subject}`);
  if (item.context !== undefined) {
    lines.push(`     Context: ${item.context}`);
  }
  if (item.ruleApplied !== undefined) {
    lines.push(`     Rule applied: ${item.ruleApplied}`);
  }
  lines.push('     Draft:');
  lines.push('     ---');
  lines.push(`     ${item.draftBody}`);
  lines.push('     ---');
  lines.push(`     ${approvalPrompt}`);
  return lines.join('\n');
}

/**
 * Render the four-bucket triage presentation block. Returns the exact markdown
 * the inline Triage.md Step 5 template produced (without the surrounding
 * ``` fences — the workflow already wraps the call in a code block).
 */
export function renderTriagePresentation(p: TriagePresentation): string {
  const out: string[] = [];

  out.push(`📥 INBOX TRIAGE — ${p.count} messages processed`);
  out.push('');

  out.push(`🔴 PRINCIPAL-MUST-REPLY (${p.mustReply.length})`);
  p.mustReply.forEach((item, i) => {
    out.push(renderDraftItem(item, i + 1, 'Approve? [yes / edit / skip]'));
  });
  out.push('');

  out.push(`📘 READ-ONLY-FYI (${p.fyi.length}) — rolled up for Morning brief`);
  for (const item of p.fyi) {
    out.push(`  • ${item.text}`);
  }
  out.push('');

  out.push(`📗 EA-HANDLES (${p.eaHandles.length})`);
  p.eaHandles.forEach((item, i) => {
    out.push(renderDraftItem(item, i + 1, 'Send? [yes / edit / skip]'));
  });
  out.push('');

  out.push(`🗑️ ARCHIVE (${p.archive.length}) — two-touch rule active`);
  for (const item of p.archive) {
    out.push(`  • ${item.sender} — ${item.detail}`);
  }
  out.push('');

  out.push(`🆕 FIRST CONTACT (${p.firstContact.length})`);
  for (const item of p.firstContact) {
    out.push(`  • ${item.sender} — ${item.detail}`);
  }
  out.push('');

  out.push(`⚠️ NEW RULES ADDED (${p.newRules.length})`);
  for (const item of p.newRules) {
    out.push(`  • ${item.text}`);
  }

  return out.join('\n');
}

/* ──────────────────────────────────────────────────────────────────────────
 * Triage Step 2 — mbox/eml structured-field parse (prose-mislocation audit B7,
 * RFC-0126 §9).
 *
 * Triage.md Step 2 ingests from three sources: MCP passthrough (already
 * structured JSON), freeform paste (agent judgment — NOT extracted here), and a
 * file path. The file-path case for the `.mbox` / `.eml` RFC-5322 formats is
 * deterministic: a `From ` envelope separator splits messages, `Header: value`
 * lines precede a blank line, and the remainder is the body. This helper pins
 * that parse so the workflow does not hand-derive the `{from, subject, body,
 * received_at, thread_id}` shape per run for the deterministic format. Paste
 * extraction remains agent judgment because pasted text has no fixed grammar.
 * ────────────────────────────────────────────────────────────────────────── */

/** The structured shape every Triage message is reduced to before classification. */
export interface TriageMessage {
  from: string;
  subject: string;
  body: string;
  /** The `Date:` header verbatim, or '' when absent. */
  received_at: string;
  /** `Message-ID` (or `In-Reply-To` when present) — the thread key. '' when absent. */
  thread_id: string;
}

/** Parse a single RFC-5322 block (headers, blank line, body) into a TriageMessage. */
function parseRfc822Block(block: string): TriageMessage {
  const normalized = block.replace(/\r\n/g, '\n').replace(/^\n+/, '');
  const blankIdx = normalized.indexOf('\n\n');
  const headerSection = blankIdx === -1 ? normalized : normalized.slice(0, blankIdx);
  const body = blankIdx === -1 ? '' : normalized.slice(blankIdx + 2);

  const headers = new Map<string, string>();
  let currentKey: string | null = null;
  for (const rawLine of headerSection.split('\n')) {
    if (rawLine === '') continue;
    // RFC-5322 folded continuation: a leading space/tab continues the prior header.
    if ((rawLine.startsWith(' ') || rawLine.startsWith('\t')) && currentKey) {
      headers.set(currentKey, `${headers.get(currentKey)} ${rawLine.trim()}`);
      continue;
    }
    const colon = rawLine.indexOf(':');
    if (colon === -1) continue;
    currentKey = rawLine.slice(0, colon).trim().toLowerCase();
    headers.set(currentKey, rawLine.slice(colon + 1).trim());
  }

  return {
    from: headers.get('from') ?? '',
    subject: headers.get('subject') ?? '',
    body: body.replace(/\n+$/, ''),
    received_at: headers.get('date') ?? '',
    thread_id: headers.get('in-reply-to') ?? headers.get('message-id') ?? '',
  };
}

/**
 * Parse a raw `.mbox` / `.eml` string into structured TriageMessage records.
 *
 * mbox splits messages on a line beginning with `From ` (the envelope separator,
 * distinct from the `From:` header). A single `.eml` has no separator and parses
 * as one message. Empty input yields an empty array.
 */
export function parseMboxMessages(raw: string): TriageMessage[] {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (normalized.trim() === '') return [];

  // Split on mbox envelope lines: a line starting with "From " (not "From:").
  const blocks: string[] = [];
  let current: string[] = [];
  let started = false;
  for (const line of normalized.split('\n')) {
    if (/^From /.test(line)) {
      if (started && current.length > 0) {
        blocks.push(current.join('\n'));
      }
      current = [];
      started = true;
      continue;
    }
    current.push(line);
  }
  if (current.length > 0 && current.join('\n').trim() !== '') {
    blocks.push(current.join('\n'));
  }

  // No envelope separator at all → a single .eml message.
  if (blocks.length === 0) {
    return [parseRfc822Block(normalized)];
  }
  return blocks
    .filter((b) => b.trim() !== '')
    .map((b) => parseRfc822Block(b));
}

/* ──────────────────────────────────────────────────────────────────────────
 * Triage Step 3.6 — ADD TO RULES prefix detection (prose-mislocation audit B7,
 * RFC-0126 §9).
 *
 * Detecting the `ADD TO RULES:` prefix on an inbound from the principal and
 * extracting the rule text is a deterministic string predicate, not judgment.
 * The match is case-insensitive on the prefix keyword and tolerates leading
 * whitespace; the rule text is everything after the colon, trimmed. WHO counts
 * as "the principal themselves" remains the caller's judgment — this only
 * answers "is this an ADD TO RULES line, and what is the rule".
 * ────────────────────────────────────────────────────────────────────────── */

export interface RulePrefixMatch {
  isRule: boolean;
  /** The rule text after the prefix, trimmed. '' when isRule is false or the rule body is empty. */
  ruleText: string;
}

const ADD_TO_RULES_RE = /^\s*ADD TO RULES:\s*(.*)$/i;

/**
 * Detect the `ADD TO RULES:` prefix and extract the rule text.
 *
 * Matches the prefix case-insensitively at the start of the (single-line or
 * multi-line) message, allowing leading whitespace. Returns the trimmed rule
 * body. A bare `ADD TO RULES:` with no body is still a match with empty
 * ruleText (the caller decides whether to prompt for the missing rule).
 */
export function parseRulePrefix(message: string): RulePrefixMatch {
  const firstLine = message.replace(/\r\n/g, '\n').split('\n')[0] ?? '';
  const m = ADD_TO_RULES_RE.exec(firstLine);
  if (!m) {
    return { isRule: false, ruleText: '' };
  }
  return { isRule: true, ruleText: m[1].trim() };
}

/**
 * Format a new rule for appending to rules.md, matching the canon shape
 * (`- WHEN ... THEN ...`). If the principal already wrote a leading `- `, it is
 * preserved; otherwise the bullet prefix is added. Returns a single line.
 */
export function formatRuleLine(ruleText: string): string {
  const trimmed = ruleText.trim();
  return trimmed.startsWith('- ') ? trimmed : `- ${trimmed}`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Triage Step 5.3 — commitment ledger row (prose-mislocation audit B7,
 * RFC-0126 §9).
 *
 * Recording a created commitment in commitments.md is a persist with a
 * deterministic row format. The pure part — building the markdown table row
 * from the commitment fields — is extracted and tested here; the append I/O is
 * a thin wrapper (see persistCommitment). The chase date itself comes from the
 * already-tested computeChaseDate(); this helper only lays out the row.
 * ────────────────────────────────────────────────────────────────────────── */

export interface CommitmentRecord {
  /** What was committed to, e.g. "send the revised contract". (Open table: Commitment) */
  what: string;
  /** Who OWES the commitment — the principal or a delegate. (Open table: Owner) */
  owner?: string;
  /** The counterparty it is owed to / from. (Open table: To / From) */
  to: string;
  /** ISO YYYY-MM-DD the commitment was made. (Open table: Made) */
  made_on: string;
  /** Origin reference, e.g. a thread_id or meeting slug. '' when absent. (Open table: Source) */
  source?: string;
  /** ISO YYYY-MM-DD hard deadline, if any. (Open table: Deadline) */
  deadline?: string;
  /** ISO YYYY-MM-DD chase date (from computeChaseDate). (Open table: Chase Date) */
  chase_date: string;
  /** Lifecycle status; defaults to "Open" for a freshly captured row. (Open table: Status) */
  status?: string;
}

/** Escape a pipe so it cannot break the markdown table column structure. */
function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

/**
 * The ONE canonical commitments.md "Open" table schema — the single source of the
 * column order both Triage and Followup write and Morning reads. Reference this so
 * the two writers can never drift apart again (the two-writers bug fix).
 */
export const COMMITMENT_COLUMNS = [
  'Commitment', 'Owner', 'To / From', 'Made', 'Source', 'Deadline', 'Chase Date', 'Status',
] as const;
export const COMMITMENT_TABLE_HEADER =
  `| ${COMMITMENT_COLUMNS.join(' | ')} |\n| ${COMMITMENT_COLUMNS.map(() => '---').join(' | ')} |`;

/**
 * Build a single commitments.md "Open" table row (no trailing newline) on the ONE
 * canonical 8-column schema. Triage and Followup BOTH build rows through this helper
 * (one writer-of-format), so Morning's column-position aging parse never mis-reads.
 *
 * Column order: | Commitment | Owner | To / From | Made | Source | Deadline | Chase Date | Status |
 */
export function formatCommitmentRow(c: CommitmentRecord): string {
  return [
    '',
    escapeCell(c.what),
    escapeCell(c.owner ?? ''),
    escapeCell(c.to),
    escapeCell(c.made_on),
    escapeCell(c.source ?? ''),
    escapeCell(c.deadline ?? ''),
    escapeCell(c.chase_date),
    escapeCell(c.status ?? 'Open'),
    '',
  ].join(' | ').trim();
}

/**
 * Parse a commitments.md "Open" table row back into a CommitmentRecord — the reader
 * Morning uses for the aging calc (`chase_date <= target_day`). Legacy-tolerant:
 * accepts BOTH the canonical 8-column rows AND the historical 5-column rows
 * (`| what | to | made_on | chase_date | source |`) a principal's existing file may
 * hold, so the schema unify never silently breaks the aging calc (OoS-6). Splits on
 * UNescaped pipes (so a `\|` inside a cell does not shift columns). Returns null for a
 * header / separator / blank / unrecognized row.
 */
export function parseCommitmentRow(row: string): CommitmentRecord | null {
  const line = row.trim();
  if (!line.startsWith('|')) return null;
  const inner = line.replace(/^\|/, '').replace(/\|$/, '');
  const cells = inner.split(/(?<!\\)\|/).map((s) => s.trim().replace(/\\\|/g, '|'));
  if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) return null; // separator
  if (cells[0] === 'Commitment') return null; // header
  if (cells.length >= 8) {
    return {
      what: cells[0]!, owner: cells[1], to: cells[2]!, made_on: cells[3]!,
      source: cells[4], deadline: cells[5], chase_date: cells[6]!, status: cells[7],
    };
  }
  if (cells.length === 5) {
    // legacy: | what | to | made_on | chase_date | source |
    return { what: cells[0]!, to: cells[1]!, made_on: cells[2]!, chase_date: cells[3]!, source: cells[4] };
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Triage Step 5.5 — Bucket-2 FYI rollup persistence (prose-mislocation audit
 * B7, RFC-0126 §9).
 *
 * The rollup is written to a dated file `triage-rollups/{YYYY-MM-DD}.md`,
 * appended-to if the day's file already exists. The deterministic parts — the
 * dated filename derivation and the rollup section formatting — are extracted
 * and tested; the read-existing / append-or-create I/O is the thin wrapper
 * (see persistTriageRollup). Morning Step 2 reads these files back, so the
 * format must stay stable.
 * ────────────────────────────────────────────────────────────────────────── */

const ISO_DATE_RE_ROLLUP = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Derive the dated rollup filename for a triage run. `dateIso` is an ISO
 * YYYY-MM-DD (the run's civil day). Returns just the basename
 * (`{YYYY-MM-DD}.md`); the caller joins it under the triage-rollups dir.
 */
export function triageRollupFilename(dateIso: string): string {
  if (!ISO_DATE_RE_ROLLUP.test(dateIso)) {
    throw new Error(`triageRollupFilename: expected ISO YYYY-MM-DD, got ${dateIso}`);
  }
  return `${dateIso}.md`;
}

/**
 * Format a Bucket-2 FYI rollup section. `items` are the one-line TLDRs from the
 * Read-Only-FYI bucket. `runIso` timestamps the run within the day's file (a day
 * can hold multiple triage runs). Returns the section to append (with a leading
 * blank line separator so appends stack cleanly). Empty items still produce a
 * heading line marked `(none)` so the day's file records that a run happened.
 */
export function formatTriageRollup(items: string[], runIso: string): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`## Triage rollup — ${runIso}`);
  if (items.length === 0) {
    lines.push('- (none)');
  } else {
    for (const item of items) {
      lines.push(`- ${item.replace(/\n/g, ' ').trim()}`);
    }
  }
  return lines.join('\n');
}

/* ──────────────────────────────────────────────────────────────────────────
 * Ledger → KG bridge (Cluster A, RFC-0140). DEFAULT-OFF / opt-in.
 *
 * The markdown ledger (commitments.md) is and stays canonical. This is the ONE
 * component that mirrors a captured commitment row ONE-WAY into the MemPalace
 * KG as a `committed_to` fact — the single writer of ledger-originated
 * `committed_to` facts. It runs ONLY when the operator opts in via
 * COS_KG_BRIDGE=1; unset (or any other value) is a hard no-op, so the KG mirror
 * stays empty and markdown is the sole store by default.
 *
 * Provenance partitioning: add_kg_fact persists no `context` field
 * (_bridge_kg.py), so ledger provenance is embedded in the fact `object` as
 * bracketed metadata — the SAME convention SaveCommitmentsToStudio already reads
 * for `[deadline: …]`. Every emitted fact carries `[ledger:
 * ChiefOfStaff/commitments.md]` (plus the row Source, when present), keeping
 * ledger-originated facts attributable and partitioned from Algorithm-originated
 * `committed_to` facts.
 *
 * Fact shape is deliberately compatible with SaveCommitmentsToStudio's reader:
 *   subject    = owner (assignee)            → body.assignee
 *   object     = what + bracketed metadata   → body.content / parseDeadline()
 *   valid_from = made_on (ISO YYYY-MM-DD)     → body.committedAt
 * ────────────────────────────────────────────────────────────────────────── */

/** True only when the operator has explicitly opted into the KG bridge (COS_KG_BRIDGE=1). */
export function isKgBridgeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.COS_KG_BRIDGE === '1';
}

export interface KgBridgeResult {
  /** Whether a `committed_to` fact was emitted to the KG. */
  emitted: boolean;
  /** Why nothing was emitted: 'disabled' (flag off — the default) or 'spawn-failed'. */
  reason?: 'disabled' | 'spawn-failed';
}

/**
 * Mirror ONE captured commitment row to the KG as a `committed_to` fact.
 *
 * DEFAULT-OFF: returns { emitted: false, reason: 'disabled' } and touches
 * nothing unless COS_KG_BRIDGE=1. Never throws — a bridge failure must never
 * break the (already-completed) canonical markdown append; it degrades to
 * { emitted: false, reason: 'spawn-failed' } instead.
 */
export function bridgeCommitmentToKg(
  c: CommitmentRecord,
  env: Record<string, string | undefined> = process.env,
): KgBridgeResult {
  if (!isKgBridgeEnabled(env)) return { emitted: false, reason: 'disabled' };

  const owner = (c.owner ?? '').trim() || 'principal';
  const tags = [
    c.deadline ? `[deadline: ${c.deadline}]` : null,
    '[ledger: ChiefOfStaff/commitments.md]',
    c.source && c.source.trim() ? `[source: ${c.source.trim()}]` : null,
  ].filter(Boolean).join(' ');
  const object = `${c.what.trim()} ${tags}`.trim();

  const bridge = join(homedir(), '.claude', 'DOS', 'Tools', 'mempalace_bridge.py');
  const proc = Bun.spawnSync(
    ['uv', 'run', '--with', 'mempalace>=3.3.5,<4', 'python', bridge,
     'add_kg_fact', JSON.stringify({
       subject: owner,
       predicate: 'committed_to',
       object,
       valid_from: c.made_on,
     })],
    { timeout: 15000 },
  );
  if (proc.exitCode !== 0) return { emitted: false, reason: 'spawn-failed' };
  return { emitted: true };
}
