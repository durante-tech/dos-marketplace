#!/usr/bin/env bun
/**
 * ContainmentGuardRedactor.hook.ts — RFC-0068 ISC-1.1
 *
 * PostToolUse REDACTIVE sibling of ContainmentGuard.hook.ts.
 * Path A per RFC-0068 design choice: sibling file, separate concerns.
 *
 * PARENT (ContainmentGuard.hook.ts): PreToolUse on Write/Edit/MultiEdit.
 *   Decision-style — denies WRITES of identity/secret patterns into public files.
 *   Output direction: prevents private content from LEAVING containment zones.
 *
 * THIS HOOK (Redactor): PostToolUse on Read.
 *   Redaction-style — masks identity/secret patterns in tool OUTPUT
 *   before the model sees them. Uses Anthropic v2.1.121's all-tools
 *   `hookSpecificOutput.updatedToolOutput` mechanism.
 *   Input direction: prevents the model from seeing identity/secrets that
 *   slipped into a non-zone file's content.
 *
 * MODES (env: DOS_LIFT_CONTAINMENT_GUARD_REDACTOR_MODE):
 *   shadow  (DEFAULT) — log violations to MEMORY/STATE/containment-guard-redactor-shadow.jsonl,
 *                       always continue:true. Operator reviews FP rate before promoting.
 *   enforce            — log + return updatedToolOutput with each match replaced by
 *                        `[REDACTED:<pattern_name>]`.
 *   disabled           — bypass entirely (no log, no scan).
 *
 * Feature-flag opt-out (RFC-0057 §7):
 *   DOS_LIFT_CONTAINMENT_GUARD_REDACTOR_DISABLED=1 → bypass equivalent to mode=disabled.
 *
 * Bypass flow (in order):
 *   1. tool_name !== 'Read' → continue (only Read in v1; NotebookRead deferred)
 *   2. DISABLED flag set → continue
 *   3. mode=disabled → continue
 *   4. tool_response is not a string → continue (defensive — Read returns string content)
 *   5. file_path resolves into a containment zone → continue (private file, model authorized)
 *   6. content has no IDENTITY_PATTERNS hits → continue
 *   7. otherwise:
 *       mode=shadow  → log + continue
 *       mode=enforce → log + emit hookSpecificOutput.updatedToolOutput with redactions
 *
 * Coupling: RFC-0068 ISC-1.1, RFC-0044 §3-§4 (containment doctrine),
 *           ContainmentGuard.hook.ts (PreToolUse sibling).
 *
 * Anti-criteria preserved:
 *   - No inference / LLM calls (regex catalog only)
 *   - No modifications to ContainmentGuard.hook.ts
 *   - No changes to containment-zones.ts patterns
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput } from './lib/hook-io.ts';
import { loadProjectEnv } from './lib/paths.ts';

loadProjectEnv();

// ─── 0. Read input — fail open on bad pipe ────────────────────────────────
const input = await readHookInput();
if (!input) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const toolName = (input as { tool_name?: string }).tool_name || '';
const toolInput = (input as { tool_input?: Record<string, unknown> }).tool_input || {};
const toolResponse = (input as { tool_response?: unknown }).tool_response;
const sessionId = input.session_id || 'unknown';

// ─── 1. Tool guard — Read only in v1 ──────────────────────────────────────
if (toolName !== 'Read') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 2-3. Mode + disabled flag ────────────────────────────────────────────
const mode = (process.env.DOS_LIFT_CONTAINMENT_GUARD_REDACTOR_MODE || 'shadow').toLowerCase();
const disabled = process.env.DOS_LIFT_CONTAINMENT_GUARD_REDACTOR_DISABLED === '1';

if (disabled || mode === 'disabled') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 4. tool_response content extraction ──────────────────────────────────
// The current Claude Code Read PostToolUse tool_response is an OBJECT:
//   { type: 'text', file: { filePath, content, numLines, startLine, totalLines } }
// (verified against a live transcript, 2026-07-02). The prior `typeof !== 'string'`
// guard assumed a bare string and therefore silently no-op'd on EVERY real Read —
// this redactor never scanned anything (RedTeam D-finding). We now extract text
// from: a bare string (legacy), an object with `.file.content` (current Read), or
// an object with a top-level `.content`. Anything else (e.g. an image read with no
// text) yields '' → skip. On enforce we rebuild the SAME shape with content redacted.
const responseWasString = typeof toolResponse === 'string';
const responseObj =
  toolResponse && typeof toolResponse === 'object'
    ? (toolResponse as Record<string, unknown>)
    : null;
const content: string = extractReadText(toolResponse);
if (!content) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 4b. Resolve repo root + zones module ─────────────────────────────────
// Primary location: Packs/sentinel/src/Tools/containment-zones.ts (V16 Pack-evolution).
// Legacy fallback: Tools/dos-toolchain/containment-zones.ts (frozen-release compat).
const repoRoot = resolveRepoRoot();
function resolveZonesPath(root: string | null): string | null {
  if (!root) return null;
  const packPath = join(root, 'Packs', 'sentinel', 'src', 'Tools', 'containment-zones.ts');
  if (existsSync(packPath)) return packPath;
  const legacyPath = join(root, 'Tools', 'dos-toolchain', 'containment-zones.ts');
  if (existsSync(legacyPath)) return legacyPath;
  return null;
}
const zonesModulePath = resolveZonesPath(repoRoot);

let CONTAINMENT_ZONES: ZoneShape[] = [];
let IDENTITY_PATTERNS: PatternShape[] = [];
let matchesZone: ((p: string, z?: ZoneShape[]) => ZoneShape | null) | null = null;

if (zonesModulePath && existsSync(zonesModulePath)) {
  try {
    const mod = await import(zonesModulePath);
    CONTAINMENT_ZONES = mod.CONTAINMENT_ZONES || [];
    IDENTITY_PATTERNS = mod.IDENTITY_PATTERNS || [];
    matchesZone = mod.matchesZone;
  } catch (err) {
    logShadow({
      reason: 'zones-import-failed',
      error: String(err),
    });
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
} else {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

if (!matchesZone) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 5. Zone match → skip redaction (private file, model authorized) ──────
const filePath = String(toolInput.file_path || '');
if (filePath && repoRoot) {
  const relativePath = filePath.startsWith('/')
    ? (() => {
        const rel = relative(repoRoot, filePath);
        return rel.startsWith('..') ? filePath : rel;
      })()
    : filePath;
  if (matchesZone(relativePath, CONTAINMENT_ZONES)) {
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
}

// ─── 6. Scan content for identity patterns ────────────────────────────────
const violations: ViolationShape[] = [];
for (const p of IDENTITY_PATTERNS) {
  const globalRegex = new RegExp(p.regex.source, ensureGlobalFlag(p.regex.flags));
  let m: RegExpExecArray | null;
  while ((m = globalRegex.exec(content)) !== null) {
    violations.push({
      pattern: p.name,
      matchedText: m[0],
      offset: m.index,
    });
    if (m.index === globalRegex.lastIndex) globalRegex.lastIndex++;
  }
}

if (violations.length === 0) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 7. Violation handling ────────────────────────────────────────────────
const summary = {
  timestamp: new Date().toISOString(),
  session_id: sessionId,
  tool: toolName,
  file_path: filePath,
  response_chars: content.length,
  violation_count: violations.length,
  violations: violations.slice(0, 10).map((v) => ({
    pattern: v.pattern,
    matched_text: v.matchedText.slice(0, 80),
    offset: v.offset,
  })),
  mode,
  would_redact: mode === 'enforce',
};

logShadow(summary);

if (mode === 'enforce') {
  // Build redacted content by replacing each pattern's matches in turn.
  // Use global regex on each pattern; replace with [REDACTED:<pattern_name>].
  let redacted = content;
  for (const p of IDENTITY_PATTERNS) {
    const g = new RegExp(p.regex.source, ensureGlobalFlag(p.regex.flags));
    redacted = redacted.replace(g, `[REDACTED:${p.name}]`);
  }
  // Preserve the original tool_response shape: for the object Read shape emit
  // { ...resp, file: { ...resp.file, content: redacted } } so the model still
  // receives a well-formed Read result; for a legacy string emit a string.
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: buildRedactedOutput(redacted),
      },
    }),
  );
  process.exit(0);
}

// shadow (default) — log + continue
console.log(JSON.stringify({ continue: true }));
process.exit(0);

// ────────────────────────── helpers ───────────────────────────

interface ZoneShape {
  name: string;
  patterns: string[];
  rationale: string;
  releaseAction: string;
}

interface PatternShape {
  name: string;
  regex: RegExp;
  suggestion: string;
}

interface ViolationShape {
  pattern: string;
  matchedText: string;
  offset: number;
}

function ensureGlobalFlag(flags: string): string {
  return flags.includes('g') ? flags : flags + 'g';
}

/**
 * Extract the scannable text from a Read tool_response of any known shape:
 *   - bare string (legacy / hypothetical future variant)
 *   - { file: { content: string } }  (current Claude Code Read shape)
 *   - { content: string }            (defensive alternate)
 * Returns '' when there is no text to scan (e.g. an image read).
 */
function extractReadText(resp: unknown): string {
  if (typeof resp === 'string') return resp;
  if (resp && typeof resp === 'object') {
    const o = resp as Record<string, unknown>;
    const file = o.file as Record<string, unknown> | undefined;
    if (file && typeof file.content === 'string') return file.content;
    if (typeof o.content === 'string') return o.content;
  }
  return '';
}

/**
 * Rebuild the tool_response with redacted text, preserving the original shape so
 * `updatedToolOutput` replaces the result in kind (object stays an object).
 * Closes over module-scope `responseWasString` / `responseObj`, both assigned
 * before this runs (enforce path).
 */
function buildRedactedOutput(redacted: string): unknown {
  if (responseWasString || !responseObj) return redacted;
  const file = responseObj.file;
  if (file && typeof file === 'object' && typeof (file as Record<string, unknown>).content === 'string') {
    return { ...responseObj, file: { ...(file as Record<string, unknown>), content: redacted } };
  }
  if (typeof responseObj.content === 'string') {
    return { ...responseObj, content: redacted };
  }
  return redacted;
}

function hasZonesAt(dir: string): boolean {
  return (
    existsSync(join(dir, 'Packs', 'sentinel', 'src', 'Tools', 'containment-zones.ts')) ||
    existsSync(join(dir, 'Tools', 'dos-toolchain', 'containment-zones.ts'))
  );
}

function resolveRepoRoot(): string | null {
  const env = process.env.CLAUDE_PROJECT_DIR;
  if (env && hasZonesAt(env)) {
    return env;
  }
  // Do NOT hard-stop at a `.git` boundary: inside the active submodule
  // (Releases/vX.Y.Z/.claude) the first `.git` is the submodule gitlink with no
  // zones, so the old `return null` there made this redactor resolve null and fail
  // OPEN — Read output in the submodule workspace was never scanned/redacted, and
  // the hook exited before even logging to the shadow trail. Parent-repo zones sit
  // ABOVE the submodule .git — keep walking. (Forge Gen 31; same bug+fix as H-025/026.)
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (hasZonesAt(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to ~/Durante if cwd walk didn't find it (common when invoked from a subagent or weird cwd)
  const fallback = join(homedir(), 'Durante');
  if (hasZonesAt(fallback)) {
    return fallback;
  }
  return null;
}

function logShadow(entry: Record<string, unknown>): void {
  try {
    const stateDir = join(homedir(), '.claude', 'MEMORY', 'STATE');
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    const path = join(stateDir, 'containment-guard-redactor-shadow.jsonl');
    appendFileSync(path, JSON.stringify(entry) + '\n');
  } catch {
    // Best-effort — never break the hook over shadow logging
  }
}
