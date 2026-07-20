#!/usr/bin/env bun
/**
 * CouncilUnanimousRedTeam.hook.ts — PostToolUse (Task)
 *
 * Amendment I-1 mechanical enforcement (v0.0.10 amendment-i-proposal Rev 2).
 *
 *   "Council returns N-of-N unanimous on any cluster AND task tier ≥ E4
 *    (deep/xhigh/comprehensive) → RedTeam fires automatically, no operator
 *    gate. For tier ≤ E3, unanimity is logged to
 *    MEMORY/LEARNING/SIGNALS/panel-converged-early.jsonl but RedTeam remains
 *    operator-gated."
 *
 * After every Task subagent return, this hook applies **layered detection**
 * (per Cato F1 ship-blocker fix 2026-05-26 — Mechanism A as pre-filter +
 * Mechanism C as content extractor; ISC-A3 reinstated):
 *
 *   0. **Mechanism A pre-filter (subagent_type allowlist)** — extract
 *      tool_use.subagent_type from the PostToolUse payload. If it is NOT in
 *      COUNCIL_SEAT_ALLOWLIST (the 9 persistent Council specialist seats per
 *      lib/tier.ts), short-circuit to {continue:true} immediately. NO parse,
 *      NO flag-write. This prevents the parser from firing on arbitrary Task
 *      returns whose body happens to contain a quoted Council verdicts table
 *      (the F1 silent-pivot risk: Mechanism C alone is too permissive).
 *   1. **Mechanism C content extractor** — Parse the returned text for a
 *      `## Council Verdicts` table (canonical PRD shape characterized against
 *      parent PRD 20260526-191054 — see verdict-parser comments below).
 *   2. Detect PER-CLUSTER unanimous verdicts on Council seat columns
 *      (excluding the RedTeam adversarial column per ISC-ANTI-3).
 *   3. Read PRD frontmatter `effort:` field via bounded-head fd read
 *      (re-using SubagentReturnTally pattern lines 116-123).
 *   4. ALWAYS append to MEMORY/LEARNING/SIGNALS/panel-converged-early.jsonl
 *      using Cato F6 schema (timestamp, session_id, prd_slug, cluster_id,
 *      seat_count, tier, council_seats[]).
 *   5. If tier ≥ E4 (deep/xhigh/comprehensive per lib/tier.ts) → atomically
 *      write flag-file at
 *      MEMORY/STATE/redteam-pending-{session_id}-{cluster_id}.json — sibling
 *      RedTeamPendingGate.hook.ts blocks next non-RedTeam tool-use until the
 *      flag clears (or until the 4h TTL expires per Cato F3 fix).
 *
 * Surface decision (Council D2 2026-05-26, 4-of-5 seats): (c) flag-file +
 * sibling PreToolUse gate. Mirrors Amendment H QATesterGate Path B Day-1
 * pattern (operator-validated 2026-05-25T15:50Z).
 *
 * File-count decision (Council D3 per SandiMetz amendment): 2-file
 * architecture, not 3. This file handles detection + flag-write. Sibling
 * gate handles block-until-cleared AND receipt-clear (method, not file).
 *
 * Observation-first: ALWAYS returns {continue:true}; never blocks here.
 * Blocking happens in the sibling PreToolUse gate, never in this PostToolUse.
 */

import {
  readFileSync, appendFileSync, mkdirSync, existsSync,
  readdirSync, statSync, openSync, readSync, closeSync,
} from 'node:fs';
import { join } from 'node:path';
import { getMemorySubdir } from './lib/paths';
import {
  isAtLeastE4, effortToTier, SEAT_HEADER_ALIASES, NON_SEAT_HEADERS,
  COUNCIL_SEAT_ALLOWLIST,
} from './lib/tier';
import { atomicWriteSync } from './lib/atomic-write';

const COUNCIL_TOOLS = new Set(['Task']);

/**
 * Mechanism A pre-filter set — frozen lowercase index over the canonical
 * COUNCIL_SEAT_ALLOWLIST exported from lib/tier.ts. We compare the incoming
 * `tool_input.subagent_type` (lowercased) against this set. If absent, we
 * short-circuit BEFORE invoking the verdict parser (Cato F1 fix). Keeping
 * the set local + frozen avoids re-lowering 9 strings on every Task return.
 */
const COUNCIL_SEAT_ALLOWLIST_LC: ReadonlySet<string> = new Set(
  COUNCIL_SEAT_ALLOWLIST.map((s) => s.toLowerCase())
);

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  tool_use_id?: string;
}

/**
 * Mechanism A — extract subagent_type from PostToolUse tool_input and test
 * against the persistent Council seat allowlist (case-insensitive). Returns
 * true only when the subagent is one of the 9 persistent specialists per
 * CouncilMembers.md lines 64-72.
 *
 * Composed `general-purpose` seats are NOT counted as Council seats in v1
 * (ISC-A1) — they fail this check and are silently passed through.
 */
export function isCouncilSeatSubagent(input: Record<string, unknown> | undefined): boolean {
  if (!input) return false;
  const subagentType = String(input.subagent_type ?? '').trim().toLowerCase();
  if (!subagentType) return false;
  return COUNCIL_SEAT_ALLOWLIST_LC.has(subagentType);
}

export interface SeatVerdict {
  seat: string;          // canonical seat name (KentBeck, Pragmatic, ...)
  verdict: string;       // first verdict token: ACCEPT | AMEND | REJECT
}

export interface ClusterVerdict {
  cluster_id: string;    // e.g. "1", "8", "Cand 1"
  seats: SeatVerdict[];  // one entry per Council seat column (RedTeam excluded)
  unanimous: boolean;    // true iff all seats[].verdict identical
  verdict_token: string; // the unanimous token if unanimous, else "MIXED"
}

/** Flatten a tool_response of unknown shape into plain text. */
export function responseText(resp: unknown): string {
  if (resp == null) return '';
  if (typeof resp === 'string') return resp;
  if (Array.isArray(resp)) return resp.map(responseText).join('\n');
  if (typeof resp === 'object') {
    const o = resp as Record<string, unknown>;
    if (typeof o.text === 'string') return o.text;
    if (typeof o.content === 'string') return o.content;
    if (Array.isArray(o.content)) return o.content.map(responseText).join('\n');
  }
  return '';
}

/**
 * Verdict-parser — characterized against parent PRD 20260526-191054 line
 * 140-148 `## Council Verdicts` table (LOAD-BEARING per Council D4 Feathers
 * amendment). The canonical shape is:
 *
 *   | Cand | Beck | pragmatic | Young | cockburn | uncle-bob | RedTeam |
 *   |---|---|---|---|---|---|---|
 *   | 1 (presence.*-grep R-rules) | ACCEPT | ACCEPT | ACCEPT | ACCEPT | ACCEPT | **AMEND — overturn unanimous** |
 *   | 8 (file-redirected stdio R-rule) | ACCEPT | ACCEPT | ACCEPT | ACCEPT | ACCEPT | **AMEND — overturn unanimous (n=1, ship advisory)** |
 *
 * Parser contract:
 *   - INPUT: full text body containing zero or more `## Council Verdicts` sections.
 *   - OUTPUT: zero or more ClusterVerdict entries, one per data row.
 *   - Header parse: first non-separator pipe row after `## Council Verdicts`.
 *     Skip first column (cluster label), skip any column whose header (lowercased,
 *     stripped of markdown) matches NON_SEAT_HEADERS (cand, redteam, etc.).
 *     Map remaining columns via SEAT_HEADER_ALIASES (e.g. "Beck" → "KentBeck").
 *   - Data row parse: each subsequent pipe row until blank line or new heading.
 *     Cell extraction: strip leading/trailing whitespace, strip `**...**` bold
 *     markers, take the FIRST recognized verdict token (ACCEPT | AMEND | REJECT)
 *     case-insensitive. Cells like "AMEND (hook fail-closed)" → "AMEND".
 *   - Unanimity: all extracted seat verdicts identical AND seat count ≥ 2.
 *     n=1 panels are NEVER unanimous (degenerate; ISC-ANTI-3 spirit).
 *   - Ambiguous cells (no recognizable token) → seat dropped from that row;
 *     unanimity still calculable if remaining seats agree.
 *   - Cluster ID: first column cell, with leading numeric/identifier extracted.
 *     "1 (presence.*-grep R-rules)" → "1". Falls back to full cell if no
 *     identifier extractable.
 *
 * Parser provenance: parent PRD 20260526-191054 line 140-148 is the canonical
 * fixture. Two unanimous clusters expected: Cand 1 and Cand 8. The other rows
 * (2, 3, 4, 5, 7) are mixed and MUST NOT register as unanimous.
 */
export function parseCouncilVerdicts(text: string): ClusterVerdict[] {
  const results: ClusterVerdict[] = [];
  const lines = text.split('\n');

  let i = 0;
  while (i < lines.length) {
    // Find next `## Council Verdicts` heading (case-insensitive, allow any
    // heading level >= 2).
    if (!/^#{2,}\s+Council\s+Verdicts\s*$/i.test(lines[i].trim())) {
      i++;
      continue;
    }
    i++;

    // Skip blank/prose lines until we hit a pipe-row header.
    while (i < lines.length && !/^\s*\|.*\|\s*$/.test(lines[i])) {
      // Stop if we hit a new heading before finding the table.
      if (/^#{1,6}\s/.test(lines[i])) break;
      i++;
    }
    if (i >= lines.length) break;
    if (!/^\s*\|.*\|\s*$/.test(lines[i])) continue;

    // Parse header row.
    const headerCells = splitRow(lines[i]);
    i++;
    // Skip separator row if present (| --- | --- | ...).
    if (i < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) {
      i++;
    }

    // Build seat-column map: { columnIndex: canonicalSeatName }.
    // Index 0 is the cluster label column — skipped.
    const seatColumns: Map<number, string> = new Map();
    for (let c = 1; c < headerCells.length; c++) {
      // Strip hyphens and spaces too, not just markdown emphasis: the canonical
      // fixture header spells the seat `uncle-bob` (tier.ts docstring) but the
      // alias map keys are punctuation-free (`unclebob`). Without this the
      // UncleBob column is dropped from the unanimity count and a genuine
      // dissent reads as false-unanimous → wrong Amendment I-1 auto-fire (H-049).
      const raw = headerCells[c].toLowerCase().replace(/[-*_` ]/g, '').trim();
      if (NON_SEAT_HEADERS.has(raw)) continue;
      const canonical = SEAT_HEADER_ALIASES[raw];
      if (canonical) seatColumns.set(c, canonical);
    }
    if (seatColumns.size === 0) continue; // Not a Council table; skip.

    // Parse data rows until blank line or new heading.
    while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
      const cells = splitRow(lines[i]);
      i++;
      if (cells.length < headerCells.length) continue;

      const clusterId = extractClusterId(cells[0]);
      const seats: SeatVerdict[] = [];
      for (const [colIdx, seatName] of seatColumns.entries()) {
        const verdict = extractVerdict(cells[colIdx]);
        if (verdict) seats.push({ seat: seatName, verdict });
      }

      const tokens = new Set(seats.map((s) => s.verdict));
      const unanimous = seats.length >= 2 && tokens.size === 1;
      const verdict_token = unanimous ? seats[0].verdict : 'MIXED';

      results.push({ cluster_id: clusterId, seats, unanimous, verdict_token });
    }
  }

  return results;
}

/** Split a markdown table row into cells (trimmed, outer pipes removed). */
function splitRow(line: string): string[] {
  const stripped = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return stripped.split('|').map((c) => c.trim());
}

/**
 * Extract a cluster identifier from a first-column cell. Examples:
 *   "1 (presence.*-grep R-rules)" → "1"
 *   "Cand 8" → "8"
 *   "Cluster A" → "A"
 *   "free-form-label" → "free-form-label"
 */
function extractClusterId(cell: string): string {
  const stripped = cell.replace(/[*_`]/g, '').trim();
  // Prefer leading number/identifier.
  const m = stripped.match(/^(?:Cand|Cluster|Candidate)\s+([A-Za-z0-9-]+)/i)
    ?? stripped.match(/^([A-Za-z0-9-]+)/);
  return m?.[1] ?? stripped.slice(0, 64);
}

/**
 * Extract the FIRST verdict token from a cell. Recognizes ACCEPT/AMEND/REJECT
 * case-insensitive. Strips bold markers. Returns '' if no token found.
 *
 * Examples:
 *   "ACCEPT"                                    → "ACCEPT"
 *   "AMEND (hook fail-closed)"                  → "AMEND"
 *   "**AMEND — overturn unanimous**"            → "AMEND"
 *   "**REJECT**"                                → "REJECT"
 *   "n/a — not unanimous"                       → "" (no token)
 *   "n/a"                                       → "" (no token)
 */
function extractVerdict(cell: string): string {
  const cleaned = cell.replace(/[*_`]/g, '');
  const m = cleaned.match(/\b(ACCEPT|AMEND|REJECT)\b/i);
  return m ? m[1].toUpperCase() : '';
}

/**
 * Bounded-head PRD frontmatter reader. Re-uses SubagentReturnTally pattern
 * lines 116-123 — single 1024-byte read extracts both `phase:` and `effort:`.
 * Hot-path safe — no full body load.
 *
 * Returns {} if the PRD doesn't exist or has no frontmatter.
 */
export function readPrdFrontmatter(prdPath: string): { phase?: string; effort?: string } {
  try {
    const fd = openSync(prdPath, 'r');
    try {
      const buf = Buffer.allocUnsafe(1024);
      const n = readSync(fd, buf, 0, 1024, 0);
      const fm = buf.toString('utf-8', 0, n).match(/^---\n([\s\S]*?)\n---/);
      if (!fm) return {};
      const block = fm[1];
      // Optional-quote tolerance (`phase: "done"`): the value class starts after
      // an optional quote so a quoted scalar is captured, not silently dropped to
      // undefined (H-050, latent — no quoted values in the corpus today). Both
      // keys are case-insensitive for consistency.
      return {
        phase: block.match(/^phase:\s*["']?([a-z_-]+)/mi)?.[1]?.toLowerCase(),
        effort: block.match(/^effort:\s*["']?([a-z_-]+)/mi)?.[1]?.toLowerCase(),
      };
    } finally { closeSync(fd); }
  } catch { return {}; }
}

/**
 * Resolve active PRD slug for session — mirrors SubagentReturnTally
 * resolveActivePrdSlug exactly. Returns slug name (last path segment) or
 * 'unknown'.
 */
export function resolveActivePrdSlug(sessionId: string): string {
  try {
    const stateFile = join(getMemorySubdir('STATE'), `active-prd-${sessionId}.json`);
    if (existsSync(stateFile)) {
      const p = JSON.parse(readFileSync(stateFile, 'utf-8')) as { prdSlug?: string };
      if (p.prdSlug) return p.prdSlug;
    }
  } catch { /* fall through */ }

  try {
    const workDir = getMemorySubdir('WORK');
    let best: string | null = null;
    let bestMtime = 0;
    for (const root of [workDir, join(workDir, 'active')]) {
      if (!existsSync(root)) continue;
      for (const name of readdirSync(root)) {
        const prd = join(root, name, 'PRD.md');
        let phase = '';
        let mtimeMs = 0;
        try {
          mtimeMs = statSync(prd).mtimeMs;
          phase = readPrdFrontmatter(prd).phase ?? '';
        } catch { continue; }
        // Both 'complete' and 'done' are terminal in the live corpus (6 PRDs use
        // 'done', incl. this parser's own canonical fixture PRD) — a finished PRD
        // must not win the mtime race for 'active' and misattribute RedTeam-pending
        // flags to a closed PRD (H-049b).
        if (phase === 'complete' || phase === 'done') continue;
        if (mtimeMs > bestMtime) { bestMtime = mtimeMs; best = name; }
      }
    }
    if (best) return best;
  } catch { /* fall through */ }

  return 'unknown';
}

/**
 * Resolve absolute path to a PRD given its slug. Searches WORK/, WORK/active/
 * in fall-through order. Returns null if not found.
 */
export function resolvePrdPath(slug: string): string | null {
  if (slug === 'unknown') return null;
  const workDir = getMemorySubdir('WORK');
  for (const root of [workDir, join(workDir, 'active')]) {
    const p = join(root, slug, 'PRD.md');
    if (existsSync(p)) return p;
  }
  return null;
}

/** Cato F6 schema for panel-converged-early.jsonl entries. */
export interface PanelConvergedEntry {
  timestamp: string;
  session_id: string;
  prd_slug: string;
  cluster_id: string;
  seat_count: number;
  tier: string;          // "E0" .. "E6"
  council_seats: string[];
}

/**
 * RedTeam-pending flag-file payload.
 *
 * Schema (Cato F2 amendment 2026-05-26, operator-authorized): the shipped
 * field names (`timestamp`, `council_seats`, `verdict_summary`) are
 * **declared canonical** — they supersede the ISC-C2 design-PRD names
 * (`fired_at`, `panel_seats`, `verdict`). The design PRD `## Decisions`
 * section carries the amendment record. New `tier` field added per Cato F2
 * disposition: it is `number` (E-tier integer 0-6 per lib/tier.ts), not the
 * `"E4"` label string used in the signals JSONL — chosen for parity with
 * `effortToTier()` return type and to make sibling-gate gating arithmetic
 * trivial (no string-parse). The sibling RedTeamPendingGate reader is
 * forward-compatible: it ignores fields it does not read.
 */
export interface RedTeamPendingFlag {
  schema_version: 1;
  timestamp: string;
  session_id: string;
  prd_slug: string;
  cluster_id: string;
  reason: string;        // "Amendment_I-1_unanimous_council_E4+"
  council_seats: string[];
  verdict_summary: string;
  tier: number;          // E-tier integer 0-6 per lib/tier.ts effortToTier()
}

function effortToETierLabel(effort: string | undefined): string {
  // Lightweight label producer — keeps hook's stderr/jsonl human-readable.
  const map: Record<string, string> = {
    minimal: 'E0', standard: 'E1', extended: 'E2', advanced: 'E3',
    deep: 'E4', xhigh: 'E5', comprehensive: 'E6',
  };
  return map[(effort ?? '').toLowerCase()] ?? 'E?';
}

function main(): void {
  let input: HookInput | null;
  try { input = JSON.parse(readFileSync(0, 'utf-8')) as HookInput; }
  catch { return; }
  if (!input || !COUNCIL_TOOLS.has(input.tool_name ?? '')) return;

  // Mechanism A pre-filter (Cato F1 ship-blocker fix 2026-05-26 — ISC-A3
  // reinstated). Only Council specialist seat returns advance to the parser.
  // Without this gate, any Task return containing a quoted Council Verdicts
  // table would silently trigger flag-writes — the F1 finding. Composed
  // `general-purpose` agents and non-Council specialists fall through here.
  if (!isCouncilSeatSubagent(input.tool_input)) return;

  const text = responseText(input.tool_response);
  if (!text) return;

  const verdicts = parseCouncilVerdicts(text);
  const unanimousClusters = verdicts.filter((v) => v.unanimous);
  if (unanimousClusters.length === 0) return; // no Council Verdicts table OR none unanimous.

  const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || 'unknown';
  const prdSlug = resolveActivePrdSlug(sessionId);
  const prdPath = resolvePrdPath(prdSlug);
  const fm = prdPath ? readPrdFrontmatter(prdPath) : {};
  const tier = effortToETierLabel(fm.effort);
  const tierInt = effortToTier(fm.effort);
  const eligibleAutoFire = isAtLeastE4(fm.effort);

  const signalsDir = join(getMemorySubdir('LEARNING'), 'SIGNALS');
  mkdirSync(signalsDir, { recursive: true });
  const signalsFile = join(signalsDir, 'panel-converged-early.jsonl');

  const stateDir = getMemorySubdir('STATE');
  mkdirSync(stateDir, { recursive: true });

  const now = new Date().toISOString();

  for (const cluster of unanimousClusters) {
    const seats = cluster.seats.map((s) => s.seat);

    // ALWAYS append signal (per child PRD ISC-D1 + ISC-ANTI-4 — no silent drops).
    const entry: PanelConvergedEntry = {
      timestamp: now,
      session_id: sessionId,
      prd_slug: prdSlug,
      cluster_id: cluster.cluster_id,
      seat_count: seats.length,
      tier,
      council_seats: seats,
    };
    appendFileSync(signalsFile, JSON.stringify(entry) + '\n');

    if (eligibleAutoFire) {
      // E4+ → atomically write flag file (Cato F2 ship-blocker fix
      // 2026-05-26: switched writeFileSync → atomicWriteSync for torn-write
      // protection; the sibling gate reads this file on every PreToolUse and
      // a partial write would mis-block). Sibling PreToolUse gate enforces
      // the block; 4h TTL bypass per Cato F3 fix in the sibling.
      const flag: RedTeamPendingFlag = {
        schema_version: 1,
        timestamp: now,
        session_id: sessionId,
        prd_slug: prdSlug,
        cluster_id: cluster.cluster_id,
        reason: 'Amendment_I-1_unanimous_council_E4+',
        council_seats: seats,
        verdict_summary: `${seats.length}-of-${seats.length} ${cluster.verdict_token}`,
        tier: tierInt,
      };
      const safeCluster = cluster.cluster_id.replace(/[^A-Za-z0-9_-]/g, '_');
      const flagPath = join(stateDir, `redteam-pending-${sessionId}-${safeCluster}.json`);
      atomicWriteSync(flagPath, JSON.stringify(flag, null, 2));
      process.stderr.write(
        `[CouncilUnanimousRedTeam] auto-fire pending: cluster=${cluster.cluster_id} ` +
        `tier=${tier} seats=${seats.length} verdict=${cluster.verdict_token} ` +
        `reason=Amendment_I-1\n`
      );
    } else {
      process.stderr.write(
        `[CouncilUnanimousRedTeam] signal-only (tier ${tier} < E4): ` +
        `cluster=${cluster.cluster_id} verdict=${cluster.verdict_token} ` +
        `seats=${seats.length} (RedTeam remains operator-gated)\n`
      );
    }
  }
}

if (import.meta.main) {
  try { main(); } catch { /* fail open — observation-first hook never blocks */ }
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}
