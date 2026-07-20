#!/usr/bin/env bun
/**
 * StreamEventDispatcher.hook.ts — PR3b unified dispatcher
 *
 * Single PostToolUse hook per matcher that routes write-class tool calls
 * to streamEvent.capture() for mid-session Studio sync. Spec §The Three
 * RedTeam Non-Negotiables §1: registering one dispatcher per matcher
 * (instead of three separate subsystem hooks) keeps every matcher at ≤5
 * hooks, sidestepping Claude Code's silent-drop ceiling.
 *
 * ROUTING (internal, not externally configurable):
 *   Write / Edit / MultiEdit / NotebookEdit / mcp__filesystem__write_file
 *   / mcp__filesystem__edit_file → streamEvent.capture('artifacts', ...)
 *
 * Future matchers (voice events, security events, kg writes, corrections,
 * learnings, hook-metrics) fire from their own lifecycle triggers
 * (VoiceCompletion.hook, SecurityValidator.hook, CorrectionDetector.hook,
 * etc.), not via PostToolUse. The dispatcher handles only what PostToolUse
 * can naturally see: tool-invocation artifacts.
 *
 * COEXISTENCE WITH ArtifactAutoLogger:
 *   ArtifactAutoLogger writes the local artifacts.jsonl (dashboard feed).
 *   StreamEventDispatcher writes to .streaming/ (Studio sync feed).
 *   Both fire PostToolUse; both are idempotent; both return {continue:true}.
 *   The iter-1 SaveArtifactsToStudio batch path continues to run at
 *   SessionEnd. Until the batch path is gated on syncMode:stream, events
 *   hit Studio twice with different idempotency keys (batch vs event) —
 *   acceptable for dev; will be reconciled in a later PR.
 *
 * FAIL-SOFT:
 *   - Any error in streamEvent.capture() is swallowed here; hook always
 *     returns {continue:true} + exit(0). PostToolUse must never block.
 *   - QueueFullError on security/corrections is still swallowed at this
 *     layer because artifacts is not those categories; that path is
 *     unreachable from this dispatcher.
 *
 * Env:
 *   DOS_STREAM_DISPATCH=off   — kill switch; hook returns immediately.
 *   DOS_STREAM_DISPATCH=prod  — default; live dispatch.
 */

import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { basename } from 'path';
import { capture, type StreamingTool } from './lib/streamEvent';
import { startTimer, stopTimer } from './lib/hook-io';
import { resolveByPath } from './lib/path-attribution';
import { loadProjectEnv } from './lib/paths';

loadProjectEnv();

// RFC-0110 fan-out — RETIRED 2026-07-02 (de-fan-out, council 3/4 keep-registrations).
// The believed 5-hook-per-matcher ceiling was empirically FALSIFIED: a headless
// probe (12 uniquely-commanded sentinel hooks in one PostToolUse Edit matcher
// group, 2 trials) executed 12/12, each exactly once. With the ceiling gone, the
// three fanned siblings — also directly registered in settings.json — were
// double-running per Write/Edit. FAN_OUT_HOOKS is now empty; the fan-out
// machinery and DOS_FANOUT_DROPPED_HOOKS kill-switch are preserved inert per the
// council's Branch-by-Abstraction retirement sequence (Fowler F2: scaffolding
// comes down only after the migration proves out; full removal is the
// post-verification cleanup option). The disjointness invariant
// (settings matcher-groups ∩ FAN_OUT_HOOKS = ∅) is owned by
// hooks/settings-invariants.test.ts — it fails loudly if anything is re-added
// here while still directly registered. Probe harness: hooks/tools/ceiling-probe/.
// History: Plans/Specs/RFC-0110-council-hook-matcher-fanout.md (2026-05-17).
const FAN_OUT_HOOKS: readonly string[] = [];
const FAN_OUT_TIMEOUT_MS = 30_000;

function fanOutToDroppedHook(name: string, inputJson: string): Promise<void> {
  const dosDir = process.env.DOS_DIR ?? `${process.env.HOME}/.claude`;
  const hookPath = `${dosDir}/hooks/${name}`;
  return new Promise<void>((res) => {
    let settled = false;
    const settle = () => { if (settled) return; settled = true; res(); };
    const child = spawn('bun', [hookPath], { stdio: ['pipe', 'pipe', 'pipe'] });
    const timer = setTimeout(() => { try { child.kill('SIGTERM'); } catch { /* ignore */ } settle(); }, FAN_OUT_TIMEOUT_MS);
    child.stdout?.on('data', () => { /* drain — discard sub-hook reply */ });
    child.stderr?.on('data', () => { /* drain — preserve stderr to /dev/null */ });
    child.on('close', () => { clearTimeout(timer); settle(); });
    child.on('error', () => { clearTimeout(timer); settle(); });
    try { child.stdin?.write(inputJson); child.stdin?.end(); } catch { clearTimeout(timer); settle(); }
  });
}

async function fanOutToDroppedHooks(inputJson: string): Promise<void> {
  await Promise.all(FAN_OUT_HOOKS.map((n) => fanOutToDroppedHook(n, inputJson)));
}

interface HookInput {
  session_id: string;
  tool_name: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  agent_id?: string;
  agent_type?: string;
}

const WRITE_CLASS_TOOLS = new Set<string>([
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'mcp__filesystem__write_file',
  'mcp__filesystem__edit_file',
]);

// Per-session artifact sequence counter. Fresh hook process per invocation,
// so keyed by (sessionId, toolCallId) via file-backed seq in streamEvent —
// here we just set artifactSeq=1 because one PostToolUse fires once per
// tool call (MultiEdit with N files is still one invocation, one artifact
// event carrying the file list in payload).
const ARTIFACT_SEQ_DEFAULT = 1;

function toolToStreamTool(toolName: string): StreamingTool | null {
  if (WRITE_CLASS_TOOLS.has(toolName)) return 'artifacts';
  return null;
}

function extractPayload(input: HookInput): Record<string, unknown> | null {
  const ti = input.tool_input ?? {};
  // NotebookEdit (in WRITE_CLASS_TOOLS) carries its target as `notebook_path`,
  // not file_path/path — without it, every NotebookEdit silently produced no
  // stream event. (Forge Gen 28.)
  const filePath = (ti.file_path as string) ?? (ti.path as string) ?? (ti.notebook_path as string) ?? '';
  if (!filePath) return null;
  // Shape matches Studio's CreateArtifactSchema at apps/web/app/api/v1/
  // artifacts/route.ts. Required: pack, artifactType, title, filePath.
  // Optional: sessionId, toolCallId, artifactSeq, producedAt, wing, workflow,
  // contentPreview, projectId.
  //
  // Attribution priority: input.agent_type (sub-agent self-tag) wins; else
  // path-based fallback (Research / Algorithm / <SkillName> / RFC / Plan)
  // from the shared lib; else generic 'stream-dispatch'. Same matcher used
  // by ArtifactAutoLogger so both producers agree on attribution.
  const byPath = resolveByPath(filePath);
  const pack = input.agent_type ?? byPath.pack;
  const artifactType = input.agent_type ? 'file' : byPath.artifactType;
  const workflow = input.agent_type ? undefined : byPath.workflow;
  return {
    pack,
    artifactType,
    title: basename(filePath) || filePath,
    filePath,
    sessionId: input.session_id,
    toolCallId: input.tool_use_id ?? '',
    artifactSeq: ARTIFACT_SEQ_DEFAULT,
    producedAt: new Date().toISOString(),
    ...(workflow && workflow !== 'unknown' ? { workflow } : {}),
  };
}

async function main(): Promise<void> {
  const mode = (process.env.DOS_STREAM_DISPATCH ?? 'prod').toLowerCase();
  if (mode === 'off') return;

  // Read stdin ONCE — reused by both streamEvent.capture (this dispatcher's
  // original concern) and the fan-out to silently-dropped sibling hooks
  // (RFC-0110 council 2026-05-17 addition).
  let inputJson: string;
  try {
    inputJson = readFileSync(0, 'utf-8');
  } catch {
    return;
  }

  let input: HookInput;
  try {
    input = JSON.parse(inputJson);
  } catch {
    return;
  }

  // Fan out IN PARALLEL with existing capture work. Kill-switch:
  // DOS_FANOUT_DROPPED_HOOKS=off disables fan-out without code change.
  const fanOutEnabled = (process.env.DOS_FANOUT_DROPPED_HOOKS ?? 'on').toLowerCase() !== 'off';
  const fanOut = fanOutEnabled ? fanOutToDroppedHooks(inputJson) : Promise.resolve();

  // Existing concern: stream-event capture for Studio sync (unchanged).
  const streamTool = toolToStreamTool(input.tool_name);
  if (streamTool) {
    const payload = extractPayload(input);
    if (payload) {
      try {
        await capture(streamTool, payload, {
          sessionId: input.session_id,
          toolCallId: input.tool_use_id ?? '',
          keyFields: {
            sessionId: input.session_id,
            toolCallId: input.tool_use_id ?? 'unknown',
            artifactSeq: ARTIFACT_SEQ_DEFAULT,
          },
        });
      } catch {
        // Swallow. Hook must never block PostToolUse. streamEvent's own
        // overflow path (QueueFullError for security/corrections) is
        // unreachable here because artifacts is drop-oldest-warn.
      }
    }
  }

  // Join fan-out completion (already running in parallel above).
  await fanOut;
}

const _t = startTimer('StreamEventDispatcher');
process.on('exit', () => stopTimer(_t, 'PostToolUse'));
main().catch(() => {}).finally(() => {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
});
