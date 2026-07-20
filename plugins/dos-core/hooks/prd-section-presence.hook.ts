#!/usr/bin/env bun
/**
 * prd-section-presence.hook.ts — Algorithm-required PRD section grader (Stop)
 *
 * Wave 1 of council-approved 3-wave rollout (PRD 20260502-150500). Single shared
 * grader for the seven default-blur findings (B1-B7) instead of seven distinct
 * hooks — Metz/Pragmatic 4-of-5 majority on DRY at the third concrete instance.
 *
 * Fail-soft contract (operator's non-negotiable):
 *   1. No active PRD discoverable → no-op (Guard 1)
 *   2. PRD frontmatter phase still `observe` → no-op (Guard 2: pre-section state)
 *   3. Last assistant text not ALGORITHM mode → no-op (Guard 3: NATIVE/MINIMAL exempt)
 *   4. PRD effort below per-rule threshold → no-op (Guard 4: tier exempt)
 *
 * Each guard returns `applies: false` with a `skip_reason`; conformance is only
 * computed when all four pass. Like `ModeHeaderGuard.hook.ts` (the pattern this
 * mirrors): grades, never blocks. Opt-in block via DOS_ENFORCEMENT_MODE_PRD_SECTIONS=block.
 *
 * Wave 1 ships PARALLELISM only. Wave 2 will add Schema Pre-Flight + BRIEF-INTEGRITY
 * by adding rows to the RULES table — no new hook, no new code path.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  closeSync,
  statSync,
  readdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput, startTimer, stopTimer } from './lib/hook-io';
import { loadProjectEnv, getMemorySubdir } from './lib/paths';

loadProjectEnv();

const HOME = homedir();
const DOS_DIR = process.env.DOS_DIR || join(HOME, '.claude');
const STATE_DIR = join(DOS_DIR, 'MEMORY', 'STATE');
const REFLECTIONS_DIR = join(DOS_DIR, 'MEMORY', 'LEARNING', 'REFLECTIONS');
const LOG_PATH = join(REFLECTIONS_DIR, 'prd-section-conformance.jsonl');

const TRANSCRIPT_TAIL_BYTES = 256 * 1024;
const TRANSCRIPT_FULL_READ_MAX = 1 * 1024 * 1024;

const ALGORITHM_BANNER_RE =
  /(♻︎\s*Entering\s*the\s*DOS\s*ALGORITHM|━━━\s*(?:👁️|🧠|📋|🔨|⚡|✅|📚)\s*(?:OBSERVE|THINK|PLAN|BUILD|EXECUTE|VERIFY|LEARN))/i;

// B.2(a) / RT-A15 / F15 — mode discrimination for the native-mode OBSERVATION
// row. When Guard 3 fails (turn is not ALGORITHM) we no longer skip silently;
// we record WHICH non-algorithm mode opened the turn, because a NATIVE/absent
// header on a high-fan-out turn is the under-routing fingerprint the C-tripwire
// needs. First-line-anchored to match ModeHeaderGuard's B.3 grader semantics.
const NATIVE_BANNER_RE = /════\s*DOS\s*\|\s*NATIVE\s*MODE/;
const MINIMAL_BANNER_RE = /═══\s*DOS\s*═/;

// Edit-class tools whose tool_use blocks count toward the fan-out fingerprint.
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

type NonAlgoMode = 'NATIVE' | 'MINIMAL' | 'NONE';

function classifyNonAlgoMode(firstAssistantText: string): NonAlgoMode {
  const head = firstNonEmptyLine(firstAssistantText);
  if (NATIVE_BANNER_RE.test(head)) return 'NATIVE';
  if (MINIMAL_BANNER_RE.test(head)) return 'MINIMAL';
  return 'NONE';
}

function firstNonEmptyLine(text: string): string {
  for (const line of text.split('\n')) {
    if (line.trim()) return line;
  }
  return '';
}

type EffortTier = 'standard' | 'extended' | 'advanced' | 'deep' | 'xhigh' | 'comprehensive';

const EFFORT_RANK: Record<EffortTier, number> = {
  standard: 1,
  extended: 2,
  advanced: 3,
  deep: 4,
  xhigh: 5,
  comprehensive: 6,
};

interface SectionRule {
  readonly id: string;
  readonly literal: string; // exact substring to grep for in PRD body
  readonly minEffort: EffortTier; // applies when PRD effort >= this rank
  readonly description: string;
}

// Wave 1: PARALLELISM. Wave 2 (2026-05-02): SCHEMA_PRE_FLIGHT + BRIEF_INTEGRITY.
// Single shared evaluator; row additions are the only Wave-2 mechanical surface.
const RULES: ReadonlyArray<SectionRule> = [
  {
    id: 'PARALLELISM',
    literal: '📐 PARALLELISM:',
    minEffort: 'advanced',
    description: 'PARALLELISM PRE-CHECK output (v0.0.6.md:367-371)',
  },
  {
    id: 'SCHEMA_PRE_FLIGHT',
    literal: '### Schema Pre-Flight',
    minEffort: 'standard',
    description: 'Schema Pre-Flight subsection (v0.0.6.md:188-192)',
  },
  {
    id: 'BRIEF_INTEGRITY',
    literal: '📊 BRIEF INTEGRITY:',
    minEffort: 'standard',
    description: 'BRIEF-INTEGRITY explicit emission (v0.0.6.md:183-187); n/a is allowed but must be emitted',
  },
  // Amendment T18 (operator-signed 2026-07-10; applied to v0.0.10.md §6.1 by
  // Tailor Gen 49; grading half queued to Forge — Gen 111). The doctrine names
  // this exact mechanism: "Graded by prd-section-presence at Stop (same
  // mechanism as 📐 PARALLELISM), NOT a new hook."
  {
    id: 'OBSERVE_EXIT_CHECKLIST',
    literal: '☑ OBSERVE-EXIT:',
    minEffort: 'standard',
    description: 'OBSERVE-EXIT CHECKLIST enumeration (v0.0.10.md §6.1 Amendment T18); every lettered substep verdicted fired|n/a',
  },
];

interface StopHookInput {
  session_id?: string;
  transcript_path?: string;
  stop_hook_active?: boolean;
}

interface PRDState {
  prdSlug: string;
  startedAt?: string;
}

interface PRDFrontmatter {
  task?: string;
  slug?: string;
  effort?: EffortTier;
  phase?: string;
}

// B.2(a) — the under-routing fingerprint payload, attached to the not-algorithm
// branch. native_mode is the first-line-anchored mode of the turn's first
// assistant message; edit_fanout is the count of DISTINCT files touched by
// Edit/Write/MultiEdit tool_use blocks across the turn's assistant messages.
// A NATIVE/absent header on a high edit_fanout turn = the under-routing the C
// tripwire (ALGORITHM-share of actual_mode) is built to catch.
interface UnderRouteObservation {
  native_mode: NonAlgoMode;
  edit_fanout: number;
}

type GuardResult =
  | { gate: true; prdSlug: string; prdBody: string; frontmatter: PRDFrontmatter; isAlgorithm: boolean }
  | { gate: false; reason: 'no-prd' | 'pre-section-phase' | 'no-transcript' }
  | { gate: false; reason: 'not-algorithm'; prdSlug: string; frontmatter: PRDFrontmatter; observation: UnderRouteObservation };

function findActivePRD(sessionId: string | null): { path: string; slug: string } | null {
  if (sessionId) {
    // active-prd-{sid}.json is the deterministic session→PRD binding (RFC-0032 W3).
    // It is written project-first and read that way by every sibling consumer
    // (ArtifactAutoLogger, SubagentSpawnAttribution, lib/spawn-attribution) via
    // getMemorySubdir('STATE'). Reading the GLOBAL STATE_DIR here missed the file
    // whenever CLAUDE_PROJECT_DIR differs from DOS_DIR — i.e. every project session —
    // silently degrading this Stop grader to the mtime-newest fallback that the
    // deterministic binding was built to replace. Resolve it the way the writer
    // does; keep the global path as a fault fallback only. (Forge H-114.)
    let stateDir: string;
    try { stateDir = getMemorySubdir('STATE'); } catch { stateDir = STATE_DIR; }
    const statePath = join(stateDir, `active-prd-${sessionId}.json`);
    if (existsSync(statePath)) {
      try {
        const parsed = JSON.parse(readFileSync(statePath, 'utf-8')) as PRDState;
        if (parsed.prdSlug) {
          const prdPath = resolvePRDPath(parsed.prdSlug);
          if (prdPath) return { path: prdPath, slug: parsed.prdSlug };
        }
      } catch {
        // Corrupt state file — fall through to mtime fallback.
      }
    }
  }
  // Fallback: most-recent-mtime PRD.md under any MEMORY/WORK/ tree we can find.
  return findMostRecentPRD();
}

function resolvePRDPath(slug: string): string | null {
  // Probe the flat WORK/{slug} path AND the RFC-0037 active/archived buckets —
  // 134 of the ~262 PRDs live under active/, so a slug-only flat lookup missed
  // the majority and the grader silently no-op'd for them (H-061).
  const bases = [process.env.CLAUDE_PROJECT_DIR ?? '', process.cwd(), DOS_DIR];
  const candidates: string[] = [];
  for (const base of bases) {
    if (!base) continue;
    candidates.push(join(base, 'MEMORY', 'WORK', slug, 'PRD.md'));
    candidates.push(join(base, 'MEMORY', 'WORK', 'active', slug, 'PRD.md'));
    candidates.push(join(base, 'MEMORY', 'WORK', 'archived', slug, 'PRD.md'));
  }
  for (const p of candidates) {
    if (p && existsSync(p)) return p;
  }
  return null;
}

function findMostRecentPRD(): { path: string; slug: string } | null {
  // Include the RFC-0037 active/archived buckets as scan roots: each yields slug
  // dirs directly, so the existing `slug: entry` loop works unchanged and the
  // 134 bucketed PRDs stop being invisible to the mtime fallback (H-061).
  const baseRoots = [
    join(process.env.CLAUDE_PROJECT_DIR ?? '', 'MEMORY', 'WORK'),
    join(process.cwd(), 'MEMORY', 'WORK'),
    join(DOS_DIR, 'MEMORY', 'WORK'),
  ];
  const roots = [
    ...baseRoots,
    ...baseRoots.map((r) => join(r, 'active')),
    ...baseRoots.map((r) => join(r, 'archived')),
  ].filter((r) => r && existsSync(r));
  let best: { path: string; slug: string; mtime: number } | null = null;
  for (const root of roots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const prdPath = join(root, entry, 'PRD.md');
      if (!existsSync(prdPath)) continue;
      try {
        const stat = statSync(prdPath);
        if (!best || stat.mtimeMs > best.mtime) {
          best = { path: prdPath, slug: entry, mtime: stat.mtimeMs };
        }
      } catch {
        // skip unreadable
      }
    }
  }
  return best ? { path: best.path, slug: best.slug } : null;
}

function parseFrontmatter(prdBody: string): PRDFrontmatter {
  const match = /^---\n([\s\S]*?)\n---/m.exec(prdBody);
  if (!match) return {};
  const yaml = match[1];
  const out: PRDFrontmatter = {};
  for (const line of yaml.split('\n')) {
    const m = /^(\w+):\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, '');
    if (key === 'task') out.task = val;
    else if (key === 'slug') out.slug = val;
    else if (key === 'phase') out.phase = val;
    else if (key === 'effort') {
      const e = val as EffortTier;
      if (e in EFFORT_RANK) out.effort = e;
    }
  }
  return out;
}

interface TranscriptEntry {
  type?: string;
  role?: string;
  isSidechain?: boolean;
  message?: {
    role?: string;
    content?: Array<{ type?: string; text?: string; name?: string; input?: { file_path?: string } }> | string;
  };
}

// Read + parse all transcript entries once (bounded tail for large files).
function readTranscriptEntries(transcriptPath: string): TranscriptEntry[] {
  if (!transcriptPath || !existsSync(transcriptPath)) return [];
  let raw: string;
  try {
    const stat = statSync(transcriptPath);
    if (stat.size > TRANSCRIPT_FULL_READ_MAX) {
      const buf = Buffer.alloc(TRANSCRIPT_TAIL_BYTES);
      const fd = openSync(transcriptPath, 'r');
      readSync(fd, buf, 0, buf.length, stat.size - buf.length);
      closeSync(fd);
      raw = buf.toString('utf-8');
    } else {
      raw = readFileSync(transcriptPath, 'utf-8');
    }
  } catch {
    return [];
  }
  const entries: TranscriptEntry[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as TranscriptEntry);
    } catch {
      // skip malformed
    }
  }
  return entries;
}

function entryText(entry: TranscriptEntry): string {
  const content = entry.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b?.type === 'text' || typeof b?.text === 'string')
      .map((b) => b.text ?? '')
      .join('\n');
  }
  return '';
}

function isToolResultUser(entry: TranscriptEntry): boolean {
  const content = entry.message?.content;
  return Array.isArray(content) && content.some((b) => (b as { type?: string })?.type === 'tool_result');
}

// Index of the turn's opening operator prompt (last real, non-sidechain,
// non-tool_result user entry). -1 when none found.
function lastOperatorUserIdx(entries: TranscriptEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const e = entries[i];
    if (e.isSidechain === true) continue;
    const role = e.role ?? e.message?.role;
    if (role !== 'user') continue;
    if (isToolResultUser(e)) continue;
    return i;
  }
  return -1;
}

// B.3-aligned: the FIRST assistant message text of the turn (after the opening
// operator prompt). Matches ModeHeaderGuard's grader so the observation row's
// mode classification agrees with the conformance row.
function firstAssistantOfTurnText(entries: TranscriptEntry[]): string {
  const startIdx = lastOperatorUserIdx(entries) + 1;
  for (let i = startIdx; i < entries.length; i += 1) {
    const e = entries[i];
    if (e.isSidechain === true) continue;
    const role = e.role ?? e.message?.role;
    if (role !== 'assistant') continue;
    const text = entryText(e);
    if (text) return text;
  }
  return '';
}

// B.2(a) under-routing fingerprint: count of DISTINCT files touched by
// Edit/Write/MultiEdit/NotebookEdit tool_use blocks across the turn's
// (non-sidechain) assistant messages. A high count under a NATIVE/absent header
// is the under-routing signal.
function editFanout(entries: TranscriptEntry[]): number {
  const startIdx = lastOperatorUserIdx(entries) + 1;
  const files = new Set<string>();
  for (let i = startIdx; i < entries.length; i += 1) {
    const e = entries[i];
    if (e.isSidechain === true) continue;
    const role = e.role ?? e.message?.role;
    if (role !== 'assistant') continue;
    const content = e.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type === 'tool_use' && typeof block.name === 'string' && EDIT_TOOLS.has(block.name)) {
        const fp = block.input?.file_path;
        if (typeof fp === 'string' && fp) files.add(fp);
        else files.add(`__anon-${i}-${block.name}`); // count an edit even without a path
      }
    }
  }
  return files.size;
}

function evaluateGuards(input: StopHookInput): GuardResult {
  const sessionId = input.session_id ?? null;
  const active = findActivePRD(sessionId);
  if (!active) return { gate: false, reason: 'no-prd' };

  let prdBody: string;
  try {
    prdBody = readFileSync(active.path, 'utf-8');
  } catch {
    return { gate: false, reason: 'no-prd' };
  }

  const frontmatter = parseFrontmatter(prdBody);
  if (frontmatter.phase === 'observe') {
    return { gate: false, reason: 'pre-section-phase' };
  }

  const transcript = input.transcript_path ?? '';
  if (!transcript) return { gate: false, reason: 'no-transcript' };

  const entries = readTranscriptEntries(transcript);
  const firstAssistant = firstAssistantOfTurnText(entries);
  const isAlgorithm = ALGORITHM_BANNER_RE.test(firstNonEmptyLine(firstAssistant));
  if (!isAlgorithm) {
    // B.2(a) / RT-A15 / F15 — was a silent skip; now a NATIVE-mode OBSERVATION
    // row carrying the under-routing fingerprint (mode + edit fan-out). This is
    // the ground-truth channel for the C tripwire (ALGORITHM-share of
    // actual_mode), which is structurally blind to a well-formed NATIVE header
    // on a turn that should have been ALGORITHM.
    return {
      gate: false,
      reason: 'not-algorithm',
      prdSlug: active.slug,
      frontmatter,
      observation: {
        native_mode: classifyNonAlgoMode(firstAssistant),
        edit_fanout: editFanout(entries),
      },
    };
  }

  return { gate: true, prdSlug: active.slug, prdBody, frontmatter, isAlgorithm: true };
}

interface RuleEvaluation {
  rule: string;
  applies: boolean;
  skipReason?: string;
  conformant: boolean | null;
  evidenceSnippet: string | null;
}

function evaluateRule(rule: SectionRule, prdBody: string, effort: EffortTier | undefined): RuleEvaluation {
  if (!effort || EFFORT_RANK[effort] < EFFORT_RANK[rule.minEffort]) {
    return {
      rule: rule.id,
      applies: false,
      skipReason: 'effort-below-threshold',
      conformant: null,
      evidenceSnippet: null,
    };
  }
  const idx = prdBody.indexOf(rule.literal);
  if (idx === -1) {
    return { rule: rule.id, applies: true, conformant: false, evidenceSnippet: null };
  }
  const snippet = prdBody.slice(idx, idx + 100).replace(/\n/g, ' ');
  return { rule: rule.id, applies: true, conformant: true, evidenceSnippet: snippet };
}

function shouldBlock(): boolean {
  return process.env.DOS_ENFORCEMENT_MODE_PRD_SECTIONS === 'block';
}

async function main(): Promise<void> {
  try {
    const input = (await readHookInput()) as unknown as StopHookInput | null;
    if (!input) process.exit(0);
    if (input.stop_hook_active) process.exit(0);

    const guardResult = evaluateGuards(input);
    const baseRow = {
      timestamp: new Date().toISOString(),
      session_id: input.session_id ?? null,
      prd_slug: null as string | null,
      effort: null as string | null,
    };

    if (!existsSync(REFLECTIONS_DIR)) mkdirSync(REFLECTIONS_DIR, { recursive: true });

    if (!guardResult.gate) {
      if (guardResult.reason === 'not-algorithm') {
        // B.2(a) / RT-A15 / F15 — NOT a silent skip. Write a native-mode
        // OBSERVATION row per rule carrying the under-routing fingerprint:
        // native_mode (NATIVE/MINIMAL/NONE first-line header) + edit_fanout
        // (distinct files touched this turn). A NATIVE/absent header on a
        // high-fan-out turn over an ACTIVE PRD is the under-routing signal the
        // C tripwire consumes. observation:true distinguishes these rows from
        // both graded conformance rows and the other silent-skip reasons.
        for (const rule of RULES) {
          const row = {
            ...baseRow,
            prd_slug: guardResult.prdSlug,
            effort: guardResult.frontmatter.effort ?? null,
            rule: rule.id,
            applies: false,
            skip_reason: 'not-algorithm',
            conformant: null,
            evidence_snippet: null,
            observation: true,
            native_mode: guardResult.observation.native_mode,
            edit_fanout: guardResult.observation.edit_fanout,
          };
          appendFileSync(LOG_PATH, `${JSON.stringify(row)}\n`);
        }
        process.exit(0);
      }
      // Other no-gate reasons stay silent skips — still one row per rule so
      // denominators include skips.
      for (const rule of RULES) {
        const row = {
          ...baseRow,
          rule: rule.id,
          applies: false,
          skip_reason: guardResult.reason,
          conformant: null,
          evidence_snippet: null,
        };
        appendFileSync(LOG_PATH, `${JSON.stringify(row)}\n`);
      }
      process.exit(0);
    }

    const failedRules: string[] = [];
    for (const rule of RULES) {
      const evaluation = evaluateRule(rule, guardResult.prdBody, guardResult.frontmatter.effort);
      const row = {
        ...baseRow,
        prd_slug: guardResult.prdSlug,
        effort: guardResult.frontmatter.effort ?? null,
        rule: evaluation.rule,
        applies: evaluation.applies,
        skip_reason: evaluation.skipReason ?? null,
        conformant: evaluation.conformant,
        evidence_snippet: evaluation.evidenceSnippet,
      };
      appendFileSync(LOG_PATH, `${JSON.stringify(row)}\n`);
      if (evaluation.applies && evaluation.conformant === false) {
        failedRules.push(`${rule.id} (${rule.literal})`);
      }
    }

    if (failedRules.length > 0 && shouldBlock()) {
      // Block mode: surface a system-reminder via stderr; exit 2 to refuse Stop.
      // Name the ACTUAL missing rules — the message previously hardcoded
      // PARALLELISM regardless of which rule failed (fixed with the T18 row).
      console.error(
        '[prd-section-presence] BLOCK mode: required PRD sections missing: ' +
          `${failedRules.join(', ')}. Edit the PRD to include them, then re-attempt Stop.`,
      );
      process.exit(2);
    }
    process.exit(0);
  } catch {
    // Fail-open — never break Stop on hook error. Same precedent as ModeHeaderGuard.hook.ts:124-126.
    process.exit(0);
  }
}

const _t = startTimer('prd-section-presence');
process.on('exit', () => stopTimer(_t, 'Stop'));
main();
