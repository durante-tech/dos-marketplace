#!/usr/bin/env bun
/**
 * CapabilityInvocationLedger.hook.ts — SessionEnd
 *
 * RFC-0114 P3 (invocation-evidence pipeline). Parses the session transcript for
 * capability invocations (Skill / Task / Agent / select platform tools) and
 * attributes each to the PRD that was being authored when it fired (temporal
 * attribution — NOT a session-wide Cartesian product, which would bleed PRD-A's
 * evidence onto co-session PRD-B and mask real silent-drops). Writes:
 *   MEMORY/STATE/capability-invocations/{session_id}.jsonl
 *
 * The R63 lifecycle handler reads these ledgers offline to classify a listed
 * capability as `selected` (terminal pass) when invocation evidence exists,
 * instead of falsely flagging every used-but-unmarked capability as silent-drop.
 *
 * Cost: one batch parse at SessionEnd — no per-tool-call overhead (P3 over P2).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getMemorySubdir } from './lib/paths';

interface HookInput {
  session_id?: string;
  transcript_path?: string;
}

export interface InvocationEvidenceRecord {
  prd_slug: string;
  capability: string;
  tool: string;
  ts: string;
  session_id: string;
  /** RFC-0154 §5: how the capability was addressed. Absent on pre-0154 rows. */
  outcome?: 'invoked' | 'declined';
  /** RFC-0154 §5: trigger row id, parsed from `[trigger:<id>]` on decline lines. */
  trigger_id?: string;
}

// Platform tools whose raw name IS the capability when listed in a SELECTED
// block. Deliberately narrow: file/structural tools (Read/Glob/Grep/Bash/Edit)
// fire constantly and would both bloat the ledger and defang silent-drop
// detection if any PRD listed them. Skill/Task/Agent are handled separately.
const CAPABILITY_TOOL_NAMES = new Set(['WebSearch', 'WebFetch']);

/** Capability name from a tool_use block, or null if the tool isn't a capability invocation. */
function capabilityFromToolUse(name: string, input: Record<string, unknown>): string | null {
  if (name === 'Skill') return typeof input.skill === 'string' ? input.skill : null;
  if (name === 'Task' || name === 'Agent') return typeof input.subagent_type === 'string' ? input.subagent_type : null;
  if (CAPABILITY_TOOL_NAMES.has(name)) return name;
  return null;
}

/** Extract `<slug>` from a `…/MEMORY/WORK/[active|archived/]<slug>/PRD.md` path. */
export function slugFromPrdPath(filePath: string): string | null {
  const m = filePath.match(/MEMORY\/WORK\/(?:active\/|archived\/)?([^/]+)\/PRD\.md$/);
  return m ? m[1] : null;
}

/**
 * Pure core (testable). Walks the transcript in order, tracking which PRD is
 * "current" (last PRD.md authored), and attributes each capability invocation
 * to that PRD. Returns slug → set of capabilities invoked while working on it.
 * Capabilities invoked before any PRD.md write are attributed to the first PRD
 * the session touches (the session's working context).
 */
export function parseTranscriptForInvocations(transcriptPath: string): Map<string, Set<string>> {
  const bySlug = new Map<string, Set<string>>();
  let raw: string;
  try { raw = readFileSync(transcriptPath, 'utf-8'); } catch { return bySlug; }

  const ensure = (slug: string): Set<string> => {
    let s = bySlug.get(slug);
    if (!s) { s = new Set(); bySlug.set(slug, s); }
    return s;
  };

  let currentSlug: string | null = null;
  const pending = new Set<string>(); // caps seen before the first PRD.md write

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let e: any;
    try { e = JSON.parse(t); } catch { continue; }
    const content = e?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (!b || b.type !== 'tool_use') continue;
      const input = (b.input ?? {}) as Record<string, unknown>;

      if ((b.name === 'Write' || b.name === 'Edit' || b.name === 'MultiEdit') && typeof input.file_path === 'string') {
        const slug = slugFromPrdPath(input.file_path);
        if (slug) {
          const set = ensure(slug);
          set.add('PRD'); // the PRD doc itself is evidence of the PRD capability
          if (currentSlug === null && pending.size > 0) {
            for (const p of pending) set.add(p); // flush pre-write caps to the first PRD
            pending.clear();
          }
          currentSlug = slug;
        }
        continue;
      }

      const cap = capabilityFromToolUse(b.name, input);
      if (cap) {
        if (currentSlug) ensure(currentSlug).add(cap);
        else pending.add(cap);
      }
    }
  }
  return bySlug;
}

/** Flatten the slug → capabilities map into evidence records. */
export function buildLedgerRecords(
  bySlug: Map<string, Set<string>>, sessionId: string, ts: string,
): InvocationEvidenceRecord[] {
  const out: InvocationEvidenceRecord[] = [];
  for (const [prd_slug, caps] of bySlug) {
    for (const capability of caps) {
      out.push({ prd_slug, capability, tool: 'transcript', ts, session_id: sessionId, outcome: 'invoked' });
    }
  }
  return out;
}

export interface DeclineRecord {
  capability: string;
  trigger_id?: string;
}

/**
 * RFC-0154 §5: decline-event derivation. Scans PRD Write/Edit payloads in the
 * transcript for Decline Protocol lines (`Declined: <Cap> — <reason>`,
 * optionally carrying `[trigger:<row-id>]`), attributed to the PRD being
 * written. Separate pass from parseTranscriptForInvocations to keep the
 * existing parser's contract untouched (fail-open, best-effort).
 */
export function parseTranscriptForDeclines(transcriptPath: string): Map<string, DeclineRecord[]> {
  const bySlug = new Map<string, DeclineRecord[]>();
  let raw: string;
  try { raw = readFileSync(transcriptPath, 'utf-8'); } catch { return bySlug; }

  const DECLINE_RE = /Declined:\s*([A-Za-z0-9/_-]+)\s*[—-]/g;
  const TRIGGER_RE = /\[trigger:([a-z0-9-]+)\]/;

  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || !t.includes('Declined:')) continue;
    let e: any;
    try { e = JSON.parse(t); } catch { continue; }
    const content = e?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const b of content) {
      if (!b || b.type !== 'tool_use') continue;
      const input = (b.input ?? {}) as Record<string, unknown>;
      if (b.name !== 'Write' && b.name !== 'Edit' && b.name !== 'MultiEdit') continue;
      if (typeof input.file_path !== 'string') continue;
      const slug = slugFromPrdPath(input.file_path);
      if (!slug) continue;
      const payload = [input.content, input.new_string]
        .filter((x): x is string => typeof x === 'string')
        .join('\n');
      for (const m of payload.matchAll(DECLINE_RE)) {
        const declineLine = payload.slice(m.index ?? 0).split('\n')[0];
        const trig = declineLine.match(TRIGGER_RE);
        const list = bySlug.get(slug) ?? [];
        list.push({ capability: m[1], trigger_id: trig ? trig[1] : undefined });
        bySlug.set(slug, list);
      }
    }
  }
  return bySlug;
}

/** Decline records for capabilities NOT also invoked under the same PRD. */
export function buildDeclineRecords(
  declines: Map<string, DeclineRecord[]>,
  invoked: Map<string, Set<string>>,
  sessionId: string,
  ts: string,
): InvocationEvidenceRecord[] {
  const out: InvocationEvidenceRecord[] = [];
  for (const [prd_slug, list] of declines) {
    const invokedSet = invoked.get(prd_slug) ?? new Set<string>();
    const emitted = new Set<string>();
    for (const d of list) {
      if (invokedSet.has(d.capability) || emitted.has(d.capability)) continue;
      emitted.add(d.capability);
      out.push({
        prd_slug, capability: d.capability, tool: 'prd-decision', ts,
        session_id: sessionId, outcome: 'declined',
        ...(d.trigger_id ? { trigger_id: d.trigger_id } : {}),
      });
    }
  }
  return out;
}

function main(): void {
  let input: HookInput;
  try { input = JSON.parse(readFileSync(0, 'utf-8')) as HookInput; } catch { return; }
  const sessionId = input.session_id || process.env.CLAUDE_SESSION_ID || 'unknown';
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) return;

  const bySlug = parseTranscriptForInvocations(transcriptPath);
  if (bySlug.size === 0) return;

  const ts = new Date().toISOString();
  const declines = parseTranscriptForDeclines(transcriptPath);
  const records = [
    ...buildLedgerRecords(bySlug, sessionId, ts),
    ...buildDeclineRecords(declines, bySlug, sessionId, ts),
  ];
  if (records.length === 0) return;

  const dir = join(getMemorySubdir('STATE'), 'capability-invocations');
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Overwrite (not append): the parse recomputes the session's full evidence
    // each run, so writing is idempotent across SessionEnd re-fires / resumes.
    writeFileSync(join(dir, `${sessionId}.jsonl`), records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  } catch { /* fail open — evidence ledger is best-effort */ }
}

// Run as a hook only when executed directly (not when imported by tests).
if (import.meta.main) main();
