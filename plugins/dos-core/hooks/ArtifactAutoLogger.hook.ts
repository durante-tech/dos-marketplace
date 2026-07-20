#!/usr/bin/env bun
/**
 * ArtifactAutoLogger.hook.ts — PostToolUse
 *
 * Captures write-class tool calls to MEMORY/ARTIFACTS/artifacts.jsonl with
 * best-effort skill attribution. Always returns {continue:true}.
 *
 * Attribution strategy (SCOPE-BOUNDED, Council 4/4 unanimous):
 * - If PostToolUse input carries agent_type (subagent call) → use it directly.
 * - Otherwise parse transcript_path backwards from EOF for the most recent
 *   Skill boundary (tool_use with name='Skill' OR user message containing
 *   <command-name>/SkillName</command-name>).
 * - Stop at first natural boundary (plain user message OR isCompactSummary).
 * - Fail-closed: unattributed entries carry attribution_failure_reason.
 *
 * Env:
 *   STUDIO_AUTO_LOG=prod  (default — emit)
 *   STUDIO_AUTO_LOG=off   (kill switch — short-circuit)
 *   STUDIO_AUTO_LOG=test  (emit with _test_marker=true)
 */

import {
  readFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
  openSync,
  readSync,
  closeSync,
  fstatSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, basename } from 'path';
import { getMemorySubdir, loadProjectEnv } from './lib/paths';
import { startTimer, stopTimer } from './lib/hook-io';
import { resolveByPath } from './lib/path-attribution';
import { isTerminalPhase } from './lib/tab-constants';
import { rotateIfNeeded } from './lib/rotate';

loadProjectEnv();

// ========================================
// Types
// ========================================

interface HookInput {
  session_id: string;
  transcript_path?: string;
  hook_event_name?: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response?: unknown;
  tool_use_id?: string;
  cwd?: string;
  permission_mode?: string;
  agent_id?: string;
  agent_type?: string;
}

type AttributionFailureReason =
  | 'no-skill-found'
  | 'compacted'
  | 'out-of-window'
  | 'no-transcript-path'
  | 'parse-error'
  | 'slash-command-unrecognized';

interface Attribution {
  skill_id: string | null;
  reason: AttributionFailureReason | null;
}

interface ArtifactEntry {
  timestamp: string;
  pack: string;
  workflow: string;
  type: string;
  title: string;
  path: string;
  contentPreview: string;
  wing: string;
  sessionId: string;
  tool_invocation_id: string;
  event_type: string;
  agent_id?: string;
  agent_type?: string;
  attribution_failure_reason?: AttributionFailureReason;
  // RFC-0007 × Artifact bridge — Phase A.1 per-entry precision.
  prdSlug?: string;
  receiptSha?: string;
  _test_marker?: boolean;
}

// ========================================
// Reverse transcript reader
// ========================================

const CHUNK_SIZE = 64 * 1024;
const MAX_BYTES = 512 * 1024;

// Module-level scratch buffer reused across chunk reads inside a single hook
// process. readSync always writes exactly readLen bytes, so aliasing is safe
// because we toString() + slice before the next read.
const SCRATCH = Buffer.allocUnsafe(CHUNK_SIZE);

function* readTranscriptBackwards(path: string): Generator<string> {
  let fd: number;
  try { fd = openSync(path, 'r'); } catch { return; }
  try {
    const st = fstatSync(fd);
    let pos = st.size;
    if (pos === 0) return;

    let trailing = '';
    let bytesRead = 0;
    let isEofChunk = true;

    while (pos > 0 && bytesRead < MAX_BYTES) {
      const readLen = Math.min(CHUNK_SIZE, pos);
      pos -= readLen;
      bytesRead += readLen;
      readSync(fd, SCRATCH, 0, readLen, pos);
      const text = SCRATCH.toString('utf-8', 0, readLen) + trailing;

      const lines = text.split('\n');

      let firstIdx = 0;
      if (pos > 0) {
        trailing = lines[0];
        firstIdx = 1;
      } else {
        trailing = '';
      }

      // Skip a partial trailing line at file EOF (mid-write race). Only
      // trim when more data exists behind us — otherwise a single-line file
      // without a terminating newline would be silently dropped.
      let endIdx = lines.length;
      if (isEofChunk && pos > 0 && lines[endIdx - 1] !== '') {
        endIdx -= 1;
      }
      isEofChunk = false;

      for (let i = endIdx - 1; i >= firstIdx; i--) {
        const line = lines[i];
        if (line.trim()) yield line;
      }
    }

    if (pos === 0 && trailing.trim()) yield trailing;
  } finally {
    closeSync(fd);
  }
}

// ========================================
// Attribution
// ========================================

// Slash-command that maps to a DOS skill when the first letter is uppercase.
// Lowercase built-ins (/effort, /model, /compact, /exit) are ignored — they
// are Claude Code configuration commands, not skill invocations.
const COMMAND_NAME_RE = /<command-name>\/([A-Za-z][A-Za-z0-9_-]*)<\/command-name>/;

function parseJsonl(line: string): any | null {
  try { return JSON.parse(line); } catch { return null; }
}

type EntryKind =
  | { kind: 'skill-start'; skill: string }
  | { kind: 'boundary' }
  | { kind: 'lowercase-command' }
  | { kind: 'skip' };

function classifyEntry(entry: any): EntryKind {
  if (!entry || entry.isSidechain === true) return { kind: 'skip' };

  const content = entry.message?.content;

  // Assistant tool_use: {type:"tool_use", name:"Skill", input:{skill:"X"}}
  if (Array.isArray(content)) {
    for (const part of content) {
      if (part?.type === 'tool_use' && part?.name === 'Skill') {
        const s = part?.input?.skill;
        if (typeof s === 'string' && s.length > 0) {
          return { kind: 'skill-start', skill: s };
        }
      }
    }
  }

  if (entry.type !== 'user') return { kind: 'skip' };

  // Collect user message text once.
  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part?.text === 'string') text += part.text + '\n';
    }
  }

  const m = COMMAND_NAME_RE.exec(text);
  if (m) {
    const first = m[1].charCodeAt(0);
    if (first >= 65 && first <= 90) {           // 'A'..'Z'
      return { kind: 'skill-start', skill: m[1] };
    }
    return { kind: 'lowercase-command' };       // transparent to attribution
  }

  return { kind: 'boundary' };
}

function resolveActiveSkill(transcriptPath?: string): Attribution {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return { skill_id: null, reason: 'no-transcript-path' };
  }

  let sawLowercaseCommand = false;

  try {
    for (const line of readTranscriptBackwards(transcriptPath)) {
      const entry = parseJsonl(line);
      if (!entry) continue;

      if (entry.isCompactSummary === true) {
        return { skill_id: null, reason: 'compacted' };
      }

      const k = classifyEntry(entry);
      switch (k.kind) {
        case 'skill-start':
          return { skill_id: k.skill, reason: null };
        case 'boundary':
          return {
            skill_id: null,
            reason: sawLowercaseCommand ? 'slash-command-unrecognized' : 'out-of-window',
          };
        case 'lowercase-command':
          sawLowercaseCommand = true;
          continue;
        default:
          continue;
      }
    }
  } catch {
    return { skill_id: null, reason: 'parse-error' };
  }

  return { skill_id: null, reason: 'no-skill-found' };
}

// Path-based attribution fallback now lives in hooks/lib/path-attribution.ts
// so StreamEventDispatcher and ArtifactAutoLogger share one matcher table.

// ========================================
// Tool input extraction
// ========================================

function extractFilePath(input: HookInput): string {
  const ti: any = input.tool_input || {};
  if (typeof ti.file_path === 'string') return ti.file_path;
  if (typeof ti.path === 'string') return ti.path;
  if (typeof ti.destination === 'string') return ti.destination;
  if (input.tool_name?.startsWith('mcp__mempalace__')) {
    const wing = ti.wing || ti.agent_name || 'general';
    const room = ti.room || ti.topic || 'default';
    return `mempalace://${wing}/${room}`;
  }
  return '';
}

function extractContentPreview(input: HookInput): string {
  const ti: any = input.tool_input || {};
  const text =
    ti.content ??
    ti.new_string ??
    ti.contents ??
    (Array.isArray(ti.edits) ? ti.edits[0]?.new_string : undefined) ??
    ti.entry ??
    '';
  return typeof text === 'string' ? text.slice(0, 200) : '';
}

// ========================================
// Emission
// ========================================

function appendArtifact(entry: ArtifactEntry): void {
  const dir = getMemorySubdir('ARTIFACTS');
  if (!existsSync(dir)) {
    try { mkdirSync(dir, { recursive: true }); }
    catch (e) { process.stderr.write(`[ArtifactAutoLogger] mkdir failed: ${e}\n`); return; }
  }
  const file = join(dir, 'artifacts.jsonl');
  rotateIfNeeded(file);
  try { appendFileSync(file, JSON.stringify(entry) + '\n'); }
  catch (e) { process.stderr.write(`[ArtifactAutoLogger] append failed: ${e}\n`); }
}

export function findPrdFromSessionState(sessionId: string): { prdSlug?: string; receiptSha?: string } {
  // RFC-0032 Phase A W3 — deterministic session→PRD binding.
  // The Algorithm's OBSERVE first-action writes
  // MEMORY/STATE/active-prd-{sessionId}.json containing {prdSlug, startedAt}.
  // Reading by input.session_id gives the canonical PRD for THIS session,
  // not whichever PRD was most-recently-touched in the project. This wins
  // over the mtime heuristic because it CANNOT bleed across concurrent CC
  // sessions sharing one project's MEMORY/WORK/.
  if (!sessionId) return {};
  let stateDir: string;
  try { stateDir = getMemorySubdir('STATE'); } catch { return {}; }
  const stateFile = join(stateDir, `active-prd-${sessionId}.json`);
  if (!existsSync(stateFile)) return {};
  let payload: { prdSlug?: string; startedAt?: string };
  try { payload = JSON.parse(readFileSync(stateFile, 'utf-8')); }
  catch { return {}; }
  if (!payload?.prdSlug) return {};
  // Read the bound PRD's frontmatter once — for BOTH the phase check and
  // receiptSha — resolving across WORK/ AND WORK/active/ (RFC-0125 finding 8:
  // the slug may live under active/, where the old WORK/-only lookup dropped
  // the receiptSha).
  let receiptSha: string | undefined;
  let phase = '';
  try {
    const workDir = getMemorySubdir('WORK');
    for (const root of [workDir, join(workDir, 'active')]) {
      const prdPath = join(root, payload.prdSlug, 'PRD.md');
      if (!existsSync(prdPath)) continue;
      const fm = readFileSync(prdPath, 'utf-8').match(/^---\n([\s\S]*?)\n---/);
      phase = fm?.[1]?.match(/^phase:\s*([a-z_-]+)/m)?.[1] ?? '';
      const shaMatch = fm?.[1]?.match(/^receipt_sha256:\s*([a-f0-9]{64})\s*$/m);
      if (shaMatch) receiptSha = shaMatch[1];
      break;
    }
  } catch { /* non-critical */ }
  // RFC-0125 finding 3: do NOT bind an artifact to a COMPLETED PRD via the
  // session-state path (the mtime path findActivePrdContext already skips
  // complete). Returning {} lets the caller fall through to that phase-filtered
  // path instead of attributing the artifact to finished work.
  if (isTerminalPhase(phase)) return {};
  return receiptSha ? { prdSlug: payload.prdSlug, receiptSha } : { prdSlug: payload.prdSlug };
}

function findActivePrdContext(): { prdSlug?: string; receiptSha?: string } {
  let workDir: string;
  try { workDir = getMemorySubdir('WORK'); }
  catch { return {}; }
  if (!existsSync(workDir)) return {};

  // Pick the most-recently-modified PRD that is NOT in a terminal phase.
  // Pre-fix: any PRD touched recently could win, including completed ones
  // from concurrent CC sessions writing to the same project's MEMORY/WORK/.
  // That cross-session bleed mis-attributed every artifact in this session
  // to a different session's PRD slug. The phase filter rules out the
  // "completed PRD got touched by hook bookkeeping" failure mode and keeps
  // attribution scoped to genuinely-active work.
  let latestSlug: string | null = null;
  let latestMtime = 0;
  let latestReceiptSha: string | undefined;

  try {
    const names = readdirSync(workDir);
    for (const name of names) {
      const fullPath = join(workDir, name);
      let st;
      try { st = statSync(fullPath); } catch { continue; }
      if (!st.isDirectory()) continue;
      const prdPath = join(fullPath, 'PRD.md');
      if (!existsSync(prdPath)) continue;
      // Read frontmatter once — get phase + receipt_sha256 in same pass.
      let phase: string | undefined;
      let receiptSha: string | undefined;
      try {
        const content = readFileSync(prdPath, 'utf-8');
        const fm = content.match(/^---\n([\s\S]*?)\n---/);
        if (fm) {
          const phaseMatch = fm[1]!.match(/^phase:\s*([a-z_-]+)\s*$/m);
          if (phaseMatch) phase = phaseMatch[1]!.toLowerCase();
          const shaMatch = fm[1]!.match(/^receipt_sha256:\s*([a-f0-9]{64})\s*$/m);
          if (shaMatch) receiptSha = shaMatch[1];
        }
      } catch { /* unparseable PRD — skip */ continue; }
      // Skip terminal phases: 'complete'/'done' or empty/missing frontmatter
      // (degraded PRD; safer to ignore than mis-attribute).
      if (!phase || isTerminalPhase(phase)) continue;
      if (st.mtimeMs > latestMtime) {
        latestMtime = st.mtimeMs;
        latestSlug = name;
        latestReceiptSha = receiptSha;
      }
    }
  } catch { return {}; }

  if (!latestSlug) return {};

  const result: { prdSlug: string; receiptSha?: string } = { prdSlug: latestSlug };
  if (latestReceiptSha) result.receiptSha = latestReceiptSha;
  return result;
}

// ========================================
// Main
// ========================================

const WRITE_CLASS_TOOLS = new Set<string>([
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'mcp__filesystem__write_file',
  'mcp__filesystem__edit_file',
  'mcp__filesystem__move_file',
  'mcp__filesystem__create_directory',
  'mcp__mempalace__mempalace_diary_write',
  'mcp__mempalace__mempalace_add_drawer',
  'mcp__mempalace__mempalace_update_drawer',
  'mcp__mempalace__mempalace_kg_add',
]);

/**
 * Path denylist — edits to these paths are never "artifacts" in any
 * meaningful sense. Previously every Studio-code edit I made during a
 * development session logged a row with empty `pack`, flooding the
 * artifacts table with 92% unattributed noise.
 *
 * Matching is substring. Order-agnostic.
 */
const DENYLIST_PATH_FRAGMENTS: readonly string[] = [
  '/tmp/',                          // ephemeral scratch
  '/.git/',                         // git internals
  '/node_modules/',                 // deps
  '/.next/',                        // build cache
  '/Platform/studio/apps/',         // Studio app code (self-edits)
  '/Platform/studio/packages/',     // Studio packages code
  '/Durante/Packs/',                // Pack source code
  '/.claude/hooks/',                // hook source
  '/.claude/skills/',               // skill source
  '/.claude/MEMORY/STATE/',         // hook runtime state
];

// The submodule mirror lives at Releases/vX.Y.Z/.claude — version-agnostic so it
// never goes stale on a release bump (was hardcoded /Releases/v0.0.4/.claude/,
// dead since the repo moved past v0.0.4 → self-edit noise leaked back in).
// (Forge Gen 23.)
const RELEASE_MIRROR_RE = /\/Releases\/v\d+\.\d+\.\d+\/\.claude\//;

function isCodeEdit(filePath: string): boolean {
  for (const frag of DENYLIST_PATH_FRAGMENTS) {
    if (filePath.includes(frag)) return true;
  }
  return RELEASE_MIRROR_RE.test(filePath);
}

async function main(): Promise<void> {
  let input: HookInput;
  try { input = JSON.parse(readFileSync(0, 'utf-8')); }
  catch { return; }

  const mode = (process.env.STUDIO_AUTO_LOG || 'prod').toLowerCase();
  if (mode === 'off') return;

  // Bash is routed here for future extension; currently a no-op.
  if (input.tool_name === 'Bash') return;

  if (!WRITE_CLASS_TOOLS.has(input.tool_name)) return;

  const filePath = extractFilePath(input);
  if (!filePath) return;

  // Drop edits to code/infra paths that are never meaningful artifacts.
  // This eliminates the 92% noise floor where every self-edit logged as
  // an unattributed artifact row.
  if (isCodeEdit(filePath)) return;

  // Subagent calls bring agent_type on the hook input; primary calls fall
  // through to transcript-parse.
  const attr: Attribution = input.agent_type
    ? { skill_id: input.agent_type, reason: null }
    : resolveActiveSkill(input.transcript_path);

  // When transcript attribution fails (out-of-window, no-skill-found, etc.),
  // attempt path-based fallback attribution before falling through to the
  // generic "unattributed" sentinel. This fixes the common case where a skill
  // is invoked by message (not /Skill) or a sub-agent writes a file outside
  // an active transcript window.
  let resolvedPack: string;
  let resolvedWorkflow: string;
  let resolvedType: string;

  if (attr.skill_id) {
    resolvedPack = attr.skill_id;
    resolvedWorkflow = '';
    resolvedType = 'file';
  } else {
    const pathAttr = resolveByPath(filePath);
    if (pathAttr.pack !== 'stream-dispatch') {
      // Path-based attribution succeeded — use it.
      resolvedPack = pathAttr.pack;
      resolvedWorkflow = pathAttr.workflow;
      resolvedType = pathAttr.artifactType;
    } else {
      // Truly unresolvable — keep the explicit sentinel so the UI can badge
      // these rows distinctly.
      resolvedPack = 'unattributed';
      resolvedWorkflow = '';
      resolvedType = 'file';
    }
  }

  const entry: ArtifactEntry = {
    timestamp: new Date().toISOString(),
    pack: resolvedPack,
    workflow: resolvedWorkflow,
    // `type` is the semantic slot (e.g., "generated-image", "prd"); skills
    // populate it when calling appendArtifact directly. Hook-auto entries
    // mark it as "file" so aggregation can distinguish from manual entries.
    type: resolvedType,
    title: basename(filePath) || filePath,
    path: filePath,
    contentPreview: extractContentPreview(input),
    wing: '',
    sessionId: input.session_id,
    tool_invocation_id: input.tool_use_id || '',
    event_type: input.tool_name,
  };
  if (input.agent_id) entry.agent_id = input.agent_id;
  if (input.agent_type) entry.agent_type = input.agent_type;
  // Only record the transcript-failure reason when path-attribution did NOT
  // rescue the entry. When the path resolved to a real pack (Algorithm, RFC,
  // Research, etc.), the entry is genuinely attributed and the original
  // transcript-scan failure is misleading. Reason is preserved on the
  // 'unattributed' sentinel path where it's load-bearing for triage.
  if (attr.reason && resolvedPack === 'unattributed') {
    entry.attribution_failure_reason = attr.reason;
  }
  if (mode === 'test') entry._test_marker = true;

  // Prefer path-derived prdSlug when the artifact is itself inside a
  // PRD's directory: MEMORY/WORK/{slug}/anything → prdSlug = {slug}. This
  // is the canonical link — nothing else can be more accurate. Falls back
  // to the active-PRD heuristic only when the file path doesn't disclose
  // a slug. Avoids cross-session bleed when a hook fires on a write to a
  // PRD's own directory.
  // The optional bucket segment (RFC-0037 active/archived split) must be skipped,
  // else a bucketed path MEMORY/WORK/active/{slug}/... captured "active" as the
  // slug, mis-attributing artifacts to a fake PRD. Mirrors PRDSync's path guard.
  // (Forge Gen 23, verified flat + bucketed.)
  const pathSlugMatch = filePath.match(/\/MEMORY\/WORK\/(?:active\/|archived\/)?([^/]+)\//);
  if (pathSlugMatch) {
    entry.prdSlug = pathSlugMatch[1]!;
    // Pick up receiptSha from this same PRD's frontmatter when present.
    try {
      const prdPath = join(getMemorySubdir('WORK'), pathSlugMatch[1]!, 'PRD.md');
      if (existsSync(prdPath)) {
        const content = readFileSync(prdPath, 'utf-8');
        const fm = content.match(/^---\n([\s\S]*?)\n---/);
        const shaMatch = fm?.[1]?.match(/^receipt_sha256:\s*([a-f0-9]{64})\s*$/m);
        if (shaMatch) entry.receiptSha = shaMatch[1];
      }
    } catch { /* non-critical */ }
  } else {
    // RFC-0032 Phase A W3 — session-id-keyed deterministic binding wins over
    // the mtime heuristic because it CANNOT bleed across concurrent CC
    // sessions sharing one project's MEMORY/WORK/. The Algorithm writes
    // MEMORY/STATE/active-prd-{sessionId}.json at OBSERVE entry; reading by
    // input.session_id gives the canonical PRD for THIS session, not
    // whichever PRD was most-recently-touched in the project.
    const sessionPrd = findPrdFromSessionState(input.session_id);
    if (sessionPrd.prdSlug) {
      entry.prdSlug = sessionPrd.prdSlug;
      if (sessionPrd.receiptSha) entry.receiptSha = sessionPrd.receiptSha;
    } else {
      // PERMANENT FALLBACK (Fowler Branch by Abstraction, Council ratified
      // 2026-05-01) — the heuristic is NOT a transitional shim. It serves:
      //   1. Pre-state-file installations (Algorithm version <RFC-0032)
      //   2. Sub-agent emissions outside Algorithm OBSERVE/LEARN entry/exit
      //   3. Race windows where the state-file write hasn't landed yet
      //   4. Sessions where CLAUDE_SESSION_ID is unset
      // Removing the heuristic would mis-attribute these legitimate writes;
      // keeping it as fallback preserves correctness for the long tail.
      const prdCtx = findActivePrdContext();
      if (prdCtx.prdSlug) entry.prdSlug = prdCtx.prdSlug;
      if (prdCtx.receiptSha) entry.receiptSha = prdCtx.receiptSha;
    }
  }

  appendArtifact(entry);
}

// import.meta.main guard (matches the other hooks) so this module can be
// imported for unit tests without running main() + process.exit() (RFC-0125
// follow-up — enables the finding-3 phase-filter regression test).
if (import.meta.main) {
  const _t = startTimer('ArtifactAutoLogger');
  process.on('exit', () => stopTimer(_t, 'PostToolUse'));
  main().catch(() => {}).finally(() => {
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  });
}
