#!/usr/bin/env bun
/**
 * SubagentReturnTally.hook.ts — PostToolUse (Agent / Task)
 *
 * Amendment G (v0.0.10 Part 4) — the EXTERNAL counter for Subagent Return
 * Reconciliation. After every Agent/Task return, counts the enumerable atomic
 * deliverables in the returned text (numbered lists, >=3-row tables, checklists)
 * and appends one entry to a per-session ledger:
 *   MEMORY/STATE/subagent-returns/{session_id}.jsonl
 *
 * PhaseCompleteGate reads this ledger and blocks `phase: complete` when the
 * PRD's `## Reconciliation Log` holds fewer `RECONCILED:` lines than the ledger
 * holds return entries for the PRD slug. The agent does NOT administer this
 * hook — that is the conflicted-actor mitigation (RedTeam D3, 2026-05-20).
 *
 * Observation-only: ALWAYS returns {continue:true}; never blocks; fails open.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { atomicAppendSync } from './lib/atomic-write';
import { getMemorySubdir, resolveSessionId } from './lib/paths';
import { lookupSpawnSlug, readSpawnMapLines, resolveActivePrdSlug } from './lib/spawn-attribution';

// resolveActivePrdSlug moved to ./lib/spawn-attribution (shared with the spawn
// hook, RFC-0125). Re-exported for compatibility with prior importers/tests.
export { resolveActivePrdSlug };

const TALLY_TOOLS = new Set(['Agent', 'Task']);

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: unknown;
  tool_use_id?: string;
}

export interface Tally {
  numbered: number;
  table_rows: number;
  checklist: number;
  total: number;
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
 * Count enumerable atomic deliverables — Amendment G §G.2 step 1 definition:
 * numbered lists, tables of >=3 data rows, checklists. Content inside fenced
 * code blocks is skipped — a code sample must not inflate the count that feeds
 * the blocking reconciliation gate. A checklist line is never also a numbered
 * line. Tables: consecutive pipe-delimited lines with a separator row at index
 * 1 and >=3 data rows qualify; sum the data rows of qualifying tables only.
 */
export function countEnumerables(text: string): Tally {
  let numbered = 0;
  let checklist = 0;
  let table_rows = 0;
  let inFence = false;
  let block: string[] = [];
  const flushTable = () => {
    if (/^\s*\|[\s:|-]+\|\s*$/.test(block[1] ?? '') && block.length - 2 >= 3) {
      table_rows += block.length - 2;
    }
    block = [];
  };
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) { inFence = !inFence; flushTable(); continue; }
    if (inFence) { flushTable(); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) { block.push(line); continue; }
    flushTable();
    if (/^\s*[-*]\s*\[[ xX]\]\s/.test(line)) { checklist++; continue; }
    if (/^\s*\d+\.\s+\S/.test(line)) numbered++;
  }
  flushTable();
  return { numbered, table_rows, checklist, total: numbered + table_rows + checklist };
}

function main(): void {
  let input: HookInput | null;
  try { input = JSON.parse(readFileSync(0, 'utf-8')) as HookInput; }
  catch { return; }
  if (!input || !TALLY_TOOLS.has(input.tool_name ?? '')) return;

  const tally = countEnumerables(responseText(input.tool_response));
  const sessionId = resolveSessionId(input);
  const ti = input.tool_input ?? {};
  const subagent = String(ti.description || ti.subagent_type || 'subagent').slice(0, 80);

  // RFC-0125 Regime 1: attribute the return to the PRD that was active when the
  // subagent SPAWNED, looked up by tool_use_id in the spawn-map. A MISS (spawn
  // pre-dated the hook, empty tool_use_id, or no map) records prd_slug:"unknown"
  // + attribution:"fallback" — it does NOT silently re-run the mtime guess
  // (that drift is the bug; an honest "unknown" marker is the fix, finding 10).
  const toolUseId = input.tool_use_id || '';
  const spawnSlug = lookupSpawnSlug(readSpawnMapLines(sessionId), toolUseId);

  const entry = {
    ts: new Date().toISOString(),
    session: sessionId,
    prd_slug: spawnSlug ?? 'unknown',
    attribution: spawnSlug ? 'spawn' : 'fallback',
    subagent,
    tool: input.tool_name,
    enumerables: tally,
    tool_use_id: toolUseId,
  };

  atomicAppendSync(
    join(getMemorySubdir('STATE'), 'subagent-returns', `${sessionId}.jsonl`),
    JSON.stringify(entry),
  );
}

if (import.meta.main) {
  try { main(); } catch { /* fail open — observation-only hook never blocks */ }
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}
