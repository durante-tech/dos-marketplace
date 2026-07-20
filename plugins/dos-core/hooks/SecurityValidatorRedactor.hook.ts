#!/usr/bin/env bun
/**
 * SecurityValidatorRedactor.hook.ts — RFC-0068 ISC-1.2
 *
 * PostToolUse REDACTIVE sibling of SecurityValidator.hook.ts.
 * Path A per RFC-0068 design choice (parallel to ContainmentGuardRedactor.hook.ts
 * which handles the Read tool surface).
 *
 * PARENT (SecurityValidator.hook.ts): PreToolUse on Bash/Edit/Write/Read.
 *   Decision-style — blocks dangerous commands and zero-access reads via
 *   patterns.yaml command-matching catalog (blocked/confirm/alert/zeroAccess).
 *
 * THIS HOOK (Redactor): PostToolUse on Bash.
 *   Redaction-style — masks identity/secret patterns in Bash command OUTPUT
 *   (stdout AND stderr) before the model sees them. Uses Anthropic v2.1.121's
 *   all-tools `hookSpecificOutput.updatedToolOutput` mechanism.
 *
 * BASH RESPONSE SHAPE (verified against claude 2.1.129 binary):
 *   { stdout: string, stderr: string, interrupted: boolean,
 *     isImage?: boolean, persistedOutputPath?: string, ... }
 *   Redactor preserves the full object shape; only stdout + stderr are mutated.
 *
 * PATTERN CATALOG (v1):
 *   IDENTITY_PATTERNS from `containment-zones.ts` — reused (NOT duplicated).
 *   patterns.yaml is a command-matching catalog (input gating), wrong shape
 *   for output redaction. Future v2 may add a broader Bash-output secret
 *   catalog (AWS keys, GitHub tokens, env-dump shapes) — out of scope for ISC-1.2.
 *
 * MODES (env: DOS_LIFT_SECURITY_VALIDATOR_REDACTOR_MODE):
 *   shadow  (DEFAULT) — log to MEMORY/STATE/security-validator-redactor-shadow.jsonl,
 *                       always continue:true. Operator reviews FP rate first.
 *   enforce            — log + emit updatedToolOutput object with stdout+stderr
 *                        redacted in place; other fields pass through unchanged.
 *   disabled           — full bypass (no log, no scan).
 *
 * Feature-flag opt-out (RFC-0057 §7):
 *   DOS_LIFT_SECURITY_VALIDATOR_REDACTOR_DISABLED=1 → bypass.
 *
 * Bypass flow (in order):
 *   1. tool_name !== 'Bash' → continue
 *   2. DISABLED flag set → continue
 *   3. mode=disabled → continue
 *   4. tool_response is not an object → continue (defensive — Bash returns object)
 *   5. neither stdout nor stderr present as string → continue
 *   6. zones module not resolvable → continue (fail open silently)
 *   7. content has no IDENTITY_PATTERNS hits → continue
 *   8. otherwise:
 *       mode=shadow  → log + continue
 *       mode=enforce → log + emit hookSpecificOutput.updatedToolOutput with redactions
 *
 * Coupling: RFC-0068 ISC-1.2, RFC-0044 §3-§4 (containment doctrine),
 *           ContainmentGuardRedactor.hook.ts (Read-side sibling),
 *           SecurityValidator.hook.ts (PreToolUse sibling unmodified).
 *
 * Anti-criteria preserved:
 *   - No modifications to SecurityValidator.hook.ts (Path A is sibling)
 *   - No inference / LLM calls (regex catalog only)
 *   - No new pattern catalog file (IDENTITY_PATTERNS reused as-is)
 *   - No changes to other Bash PostToolUse hooks (additive matcher entry only)
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
const toolResponse = (input as { tool_response?: unknown }).tool_response;
const sessionId = input.session_id || 'unknown';

// ─── 1. Tool guard — Bash only ────────────────────────────────────────────
if (toolName !== 'Bash') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 2-3. Mode + disabled flag ────────────────────────────────────────────
const mode = (process.env.DOS_LIFT_SECURITY_VALIDATOR_REDACTOR_MODE || 'shadow').toLowerCase();
const disabled = process.env.DOS_LIFT_SECURITY_VALIDATOR_REDACTOR_DISABLED === '1';

if (disabled || mode === 'disabled') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 4. tool_response shape guard ─────────────────────────────────────────
// Bash returns an object with stdout, stderr, interrupted, etc.
// If shape is unexpected (string, null, primitive), skip rather than crash.
if (toolResponse === null || typeof toolResponse !== 'object') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const responseObj = toolResponse as Record<string, unknown>;
const stdout = typeof responseObj.stdout === 'string' ? responseObj.stdout : '';
const stderr = typeof responseObj.stderr === 'string' ? responseObj.stderr : '';

if (!stdout && !stderr) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 5. Resolve repo root + zones module ──────────────────────────────────
// Primary location: Packs/sentinel/src/Tools/containment-zones.ts (V16 Pack-evolution).
// Legacy fallback: Tools/dos-toolchain/containment-zones.ts (frozen-release compat).
// The legacy-only resolver shipped dead — the toolchain path no longer exists,
// so repoRoot was always null and this hook never scanned (RedTeam D-finding).
const repoRoot = resolveRepoRoot();
const zonesModulePath = resolveZonesPath(repoRoot);

let IDENTITY_PATTERNS: PatternShape[] = [];

if (zonesModulePath && existsSync(zonesModulePath)) {
  try {
    const mod = await import(zonesModulePath);
    IDENTITY_PATTERNS = mod.IDENTITY_PATTERNS || [];
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

if (IDENTITY_PATTERNS.length === 0) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 6. Scan stdout + stderr for identity patterns ────────────────────────
const violations: ViolationShape[] = [];
for (const stream of ['stdout', 'stderr'] as const) {
  const content = stream === 'stdout' ? stdout : stderr;
  if (!content) continue;
  for (const p of IDENTITY_PATTERNS) {
    const globalRegex = new RegExp(p.regex.source, ensureGlobalFlag(p.regex.flags));
    let m: RegExpExecArray | null;
    while ((m = globalRegex.exec(content)) !== null) {
      violations.push({
        stream,
        pattern: p.name,
        matchedText: m[0],
        offset: m.index,
      });
      if (m.index === globalRegex.lastIndex) globalRegex.lastIndex++;
    }
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
  stdout_chars: stdout.length,
  stderr_chars: stderr.length,
  violation_count: violations.length,
  violations: violations.slice(0, 10).map((v) => ({
    stream: v.stream,
    pattern: v.pattern,
    matched_text: v.matchedText.slice(0, 80),
    offset: v.offset,
  })),
  mode,
  would_redact: mode === 'enforce',
};

logShadow(summary);

if (mode === 'enforce') {
  const redactedStdout = redactString(stdout, IDENTITY_PATTERNS);
  const redactedStderr = redactString(stderr, IDENTITY_PATTERNS);
  // Preserve full object shape; override only stdout + stderr.
  const updatedToolOutput = {
    ...responseObj,
    stdout: redactedStdout,
    stderr: redactedStderr,
  };
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput,
      },
    }),
  );
  process.exit(0);
}

// shadow (default) — log + continue
console.log(JSON.stringify({ continue: true }));
process.exit(0);

// ────────────────────────── helpers ───────────────────────────

interface PatternShape {
  name: string;
  regex: RegExp;
  suggestion: string;
}

interface ViolationShape {
  stream: 'stdout' | 'stderr';
  pattern: string;
  matchedText: string;
  offset: number;
}

function ensureGlobalFlag(flags: string): string {
  return flags.includes('g') ? flags : flags + 'g';
}

function redactString(content: string, patterns: PatternShape[]): string {
  let redacted = content;
  for (const p of patterns) {
    const g = new RegExp(p.regex.source, ensureGlobalFlag(p.regex.flags));
    redacted = redacted.replace(g, `[REDACTED:${p.name}]`);
  }
  return redacted;
}

function hasZonesAt(dir: string): boolean {
  return (
    existsSync(join(dir, 'Packs', 'sentinel', 'src', 'Tools', 'containment-zones.ts')) ||
    existsSync(join(dir, 'Tools', 'dos-toolchain', 'containment-zones.ts'))
  );
}

function resolveZonesPath(root: string | null): string | null {
  if (!root) return null;
  const packPath = join(root, 'Packs', 'sentinel', 'src', 'Tools', 'containment-zones.ts');
  if (existsSync(packPath)) return packPath;
  const legacyPath = join(root, 'Tools', 'dos-toolchain', 'containment-zones.ts');
  if (existsSync(legacyPath)) return legacyPath;
  return null;
}

function resolveRepoRoot(): string | null {
  const env = process.env.CLAUDE_PROJECT_DIR;
  if (env && hasZonesAt(env)) {
    return env;
  }
  // Do NOT hard-stop at a `.git` boundary: inside the active submodule
  // (Releases/vX.Y.Z/.claude) the first `.git` is the submodule gitlink with no
  // zones, so the old `return null` there made this redactor resolve null and
  // fail OPEN — Bash output produced in the submodule workspace was never scanned
  // for secrets. The parent-repo zones sit ABOVE the submodule .git, so keep
  // walking. (Forge Gen 27 — same bug + fix as ContainmentGuard H-025.)
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (hasZonesAt(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to ~/Durante if cwd walk didn't find it (common when invoked from a subagent or weird cwd).
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
    const path = join(stateDir, 'security-validator-redactor-shadow.jsonl');
    appendFileSync(path, JSON.stringify(entry) + '\n');
  } catch {
    // Best-effort
  }
}
