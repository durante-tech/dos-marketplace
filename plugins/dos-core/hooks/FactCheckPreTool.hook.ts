#!/usr/bin/env bun
// conformance:R13-exempt — single bridge fact_check with explicit 4s timeout cap — measured sub-1s typical, bounded worst-case (operator-authorized R13 closure 2026-05-18; Engineer council triage)
/**
 * FactCheckPreTool.hook.ts — Pre-write contradiction check (RFC-0005 §14.4).
 *
 * TRIGGER: PreToolUse on Write | Edit | MultiEdit
 *
 * Fires before a file is written/edited. Extracts the text being committed to
 * disk and asks the MemPalace `fact_check` bridge action whether it contradicts
 * any current fact in the knowledge graph. If any issue comes back with
 * confidence >= 0.9, the tool call is BLOCKED (exit 2 + blocking stderr).
 * Lower-confidence issues are surfaced as advisory stderr but not blocked.
 *
 * OPT-OUT: set `DOS_FACT_CHECK_DISABLE=1` in the environment. The hook exits 0
 * immediately without calling the bridge. Useful for drift-repair sessions and
 * deliberate counter-fact writes.
 *
 * NON-BLOCKING ON ERROR: bridge failures, parse errors, or missing content
 * degrade to a silent pass. A broken fact-check must not prevent writes.
 */

import { bridgeSync } from './lib/mempalace';
import { startTimer, stopTimer } from './lib/hook-io';
import { loadProjectEnv } from './lib/paths';

loadProjectEnv();

interface HookInput {
  tool_name?: string;
  tool_input?: {
    file_path?: string;
    content?: string;
    new_string?: string;
    edits?: Array<{ new_string?: string }>;
  };
}

async function readStdin(): Promise<HookInput | null> {
  try {
    const raw = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 300)),
    ]);
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Extract the text being committed from the tool input. Different tools
 * carry the text in different fields.
 */
function extractText(input: HookInput): string {
  const ti = input.tool_input;
  if (!ti) return '';
  // Write: { content, file_path }
  if (typeof ti.content === 'string') return ti.content;
  // Edit: { new_string, old_string, file_path }
  if (typeof ti.new_string === 'string') return ti.new_string;
  // MultiEdit: { edits: [{ new_string, ... }], file_path }
  if (Array.isArray(ti.edits)) {
    return ti.edits.map(e => e.new_string ?? '').join('\n');
  }
  return '';
}

async function main(): Promise<void> {
  // Opt-out gate — fastest possible path.
  if (process.env.DOS_FACT_CHECK_DISABLE === '1') {
    process.exit(0);
  }

  const input = await readStdin();
  if (!input) process.exit(0);

  const text = extractText(input).trim();
  // Skip trivially short writes — not worth the bridge roundtrip.
  if (text.length < 80) process.exit(0);

  // Cap the probe size — fact_check is BM25/KG-bounded, over-large text
  // doesn't improve signal and delays every write.
  const probe = text.length > 4000 ? text.slice(0, 4000) : text;

  const result = bridgeSync('fact_check', { text: probe }, 4000);

  if (!result.ok) {
    // Silent degrade — a broken fact-check must never block writes.
    process.exit(0);
  }

  const issues = (result.data.issues || []) as Array<{
    type?: string;
    confidence?: number;
    description?: string;
    detail?: string;
    predicate?: string;
    subject?: string;
    object?: string;
  }>;

  // Block iff any issue clears the 0.9 confidence bar.
  const blockers = issues.filter(i => typeof i.confidence === 'number' && i.confidence >= 0.9);

  if (blockers.length > 0) {
    const summary = blockers.slice(0, 3).map(b => {
      const what = b.description || b.detail
        || (b.subject && b.predicate ? `${b.subject} ${b.predicate} ${b.object}` : b.type)
        || 'unspecified';
      return `  - [${(b.confidence ?? 0).toFixed(2)}] ${b.type ?? 'contradiction'}: ${what}`;
    }).join('\n');
    process.stderr.write(
      `[FactCheckPreTool] Blocked — ${blockers.length} high-confidence contradiction(s):\n${summary}\n` +
      `To override for this session, set DOS_FACT_CHECK_DISABLE=1\n`,
    );
    // Exit code 2 = blocking hook per Claude Code hook contract.
    process.exit(2);
  }

  // Surface low-confidence issues as advisory, but do not block.
  if (issues.length > 0) {
    console.error(`[FactCheckPreTool] ${issues.length} low-confidence note(s); not blocking`);
  }
  process.exit(0);
}

const _t = startTimer('FactCheckPreTool');
process.on('exit', () => stopTimer(_t, 'PreToolUse'));
main().catch(() => process.exit(0));
