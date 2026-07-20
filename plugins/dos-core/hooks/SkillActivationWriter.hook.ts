#!/usr/bin/env bun
/**
 * SkillActivationWriter.hook.ts — RFC-0156 P1 usage/miss telemetry WRITER.
 *
 * PostToolUse hook (matcher: "Skill") that appends one JSONL line per skill
 * invocation to <DOS_DIR>/MEMORY/STATE/skill-activations.jsonl — the file
 * SaveSkillActivationsToStudio (SYNC_TOOLS 'skill-activations') has been
 * draining since RFC-0068 ISC-10 without any writer existing. This closes
 * that gap (RFC-0156 §6: instrument before promises).
 *
 * Entry schema — MUST stay in lockstep with the reader
 * (skills/research/Tools/SaveSkillActivationsToStudio.ts):
 *   { timestamp: ISO-8601, skill_name: string, session_id: string,
 *     source: "NATIVE" | "ALGORITHM" | "MINIMAL", duration_ms?, project_path? }
 *
 * `source` derivation: the mode classifier's per-session turn-state file
 * (<DOS_DIR>/MEMORY/STATE/router-turn-<session>.json, written by
 * IntentRetrieval via lib/router-trace.ts) carries the latest mode `hint`.
 * Absent or invalid → "NATIVE" (the mode-inversion default, 2026-07-08).
 *
 * Path decision (RFC-0156 build D7): the GLOBAL STATE dir, deliberately —
 * the reader scans global + PROJECTS.md projects, and PROJECTS.md is absent
 * on this host, so a project-first getMemorySubdir() write would be invisible
 * to the reader (the resolver-mismatch failure class).
 *
 * Fail-open: a telemetry writer must NEVER block or fail a skill invocation
 * (ISC-16) — every path swallows errors and exits 0.
 *
 * CLI mode (ISC-15 — considered-vs-invoked delta):
 *   bun SkillActivationWriter.hook.ts --delta [session_id]
 * joins routing-decisions.jsonl (what OrchestratorPrompt's catalog router
 * CONSIDERED) against skill-activations.jsonl (what actually fired) for one
 * session, printing the per-session miss surface.
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDosDir, resolveSessionId } from './lib/paths';
import { turnStatePath } from './lib/router-trace';
import { readStdinBounded } from './lib/stdin-bounded';

const VALID_SOURCES = new Set(['NATIVE', 'ALGORITHM', 'MINIMAL']);
type Source = 'NATIVE' | 'ALGORITHM' | 'MINIMAL';

export interface PostToolUseInput {
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

export interface SkillActivationEntry {
  timestamp: string;
  skill_name: string;
  session_id: string;
  source: Source;
  duration_ms?: number;
  project_path?: string;
}

function stateDir(): string {
  return join(getDosDir(), 'MEMORY', 'STATE');
}

export function activationsPath(): string {
  return join(stateDir(), 'skill-activations.jsonl');
}

/** The Skill tool's input field is `skill`; sibling names are read defensively
 *  (the OrchestratorGate.hook.ts precedent — the field name is not fully
 *  trusted across harness contexts). */
export function extractSkillName(toolInput: Record<string, unknown> | undefined): string | null {
  if (!toolInput) return null;
  for (const key of ['skill', 'name', 'skill_name', 'skillName']) {
    const v = toolInput[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** Latest mode verdict for this session, from the router turn-state file
 *  (path via lib/router-trace's own turnStatePath — do not fork the helper). */
export function deriveSource(sessionId: string, statePath?: string): Source {
  try {
    const p = statePath ?? turnStatePath(sessionId);
    if (!existsSync(p)) return 'NATIVE';
    const state = JSON.parse(readFileSync(p, 'utf-8'));
    const hint = String(state?.hint ?? '').toUpperCase();
    return VALID_SOURCES.has(hint) ? (hint as Source) : 'NATIVE';
  } catch {
    return 'NATIVE';
  }
}

/** Pure entry builder — the reader-schema contract lives here and in the test. */
export function buildActivationEntry(
  input: PostToolUseInput,
  source: Source,
  now: Date = new Date(),
): SkillActivationEntry | null {
  const skillName = extractSkillName(input.tool_input);
  if (!skillName) return null;
  const entry: SkillActivationEntry = {
    timestamp: now.toISOString(),
    skill_name: skillName,
    session_id: resolveSessionId(input),
    source,
  };
  if (typeof input.cwd === 'string' && input.cwd) entry.project_path = input.cwd;
  return entry;
}

export function appendActivation(entry: SkillActivationEntry): void {
  const dir = stateDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(activationsPath(), JSON.stringify(entry) + '\n');
}

// ─── ISC-15: considered-vs-invoked delta ────────────────────────────────────

interface RoutingDecisionRow {
  session_id?: string;
  top?: Array<{ id?: string }>;
}

/** Skill names arrive in several namespaces — scoped invocations
 *  ("Releases/v0.0.21:media"), plugin-qualified ("code-review:code-review"),
 *  and bare catalog names ("media"). The join key is the final `:`-segment;
 *  comparing raw names systematically inflates the RFC-0156 §6 miss-rate
 *  (2026-07-10 review, CONFIRMED). */
export function normalizeSkillName(name: string): string {
  const last = name.split(':').pop() ?? name;
  return last.trim();
}

/** "skill:research/workflow:ExtensiveResearch" → "research"
 *  (workflow suffix stripped first so its `:` never pollutes normalization;
 *  scoped catalog ids like "skill:Releases/v0.0.21:media/…" normalize too). */
export function skillFromCatalogId(id: string): string | null {
  const m = /^skill:(.+?)(?:\/workflow:.*)?$/.exec(id);
  return m ? normalizeSkillName(m[1]) : null;
}

export interface SessionDelta {
  session_id: string;
  considered: string[];
  invoked: string[];
  considered_not_invoked: string[];
  invoked_not_considered: string[];
}

export function computeDelta(
  routingLines: string[],
  activationLines: string[],
  sessionId: string,
): SessionDelta {
  const considered = new Set<string>();
  for (const line of routingLines) {
    try {
      const row = JSON.parse(line) as RoutingDecisionRow;
      if (row.session_id !== sessionId) continue;
      for (const t of row.top ?? []) {
        const s = t.id ? skillFromCatalogId(t.id) : null;
        if (s) considered.add(s);
      }
    } catch {
      /* skip malformed */
    }
  }
  const invoked = new Set<string>();
  for (const line of activationLines) {
    try {
      const row = JSON.parse(line) as SkillActivationEntry;
      if (row.session_id === sessionId && row.skill_name) {
        invoked.add(normalizeSkillName(row.skill_name));
      }
    } catch {
      /* skip malformed */
    }
  }
  return {
    session_id: sessionId,
    considered: [...considered].sort(),
    invoked: [...invoked].sort(),
    considered_not_invoked: [...considered].filter((s) => !invoked.has(s)).sort(),
    invoked_not_considered: [...invoked].filter((s) => !considered.has(s)).sort(),
  };
}

function runDeltaCli(sessionArg?: string): void {
  const readLines = (p: string): string[] =>
    existsSync(p) ? readFileSync(p, 'utf-8').split('\n').filter((l) => l.trim()) : [];
  const activations = readLines(activationsPath());
  const routing = readLines(join(stateDir(), 'routing-decisions.jsonl'));
  let sessionId = sessionArg;
  if (!sessionId) {
    // Default: the session of the most recent activation.
    const last = activations[activations.length - 1];
    try {
      sessionId = last ? (JSON.parse(last) as SkillActivationEntry).session_id : undefined;
    } catch {
      sessionId = undefined;
    }
  }
  if (!sessionId) {
    console.error('[SkillActivationWriter] --delta: no session_id given and no activations recorded');
    process.exit(1);
  }
  console.log(JSON.stringify(computeDelta(routing, activations, sessionId), null, 2));
}

// ─── Hook entrypoint ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    // Bounded stdin read via the shared helper (lib/stdin-bounded.ts).
    const raw = await readStdinBounded(500, () => process.exit(0));
    if (raw === null) return;

    let input: PostToolUseInput;
    try {
      input = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      return;
    }

    // Cheap guards FIRST — no turn-state file I/O for non-Skill events or
    // skill-less payloads (argument-order finding, 2026-07-10 review).
    if (input.tool_name && input.tool_name !== 'Skill') return;
    if (!extractSkillName(input.tool_input)) return;

    const entry = buildActivationEntry(input, deriveSource(resolveSessionId(input)));
    if (!entry) return;
    appendActivation(entry);
  } catch {
    // Fail-open (ISC-16): telemetry must never block a skill invocation.
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args[0] === '--delta') {
    runDeltaCli(args[1]);
  } else {
    await main();
    process.exit(0);
  }
}
