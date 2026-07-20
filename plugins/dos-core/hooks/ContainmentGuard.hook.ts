#!/usr/bin/env bun
/**
 * ContainmentGuard.hook.ts — RFC-0044 W-2.4
 *
 * PreToolUse mechanical enforcement of DOS Containment & Distribution.
 * Imports the single source of truth from `Tools/dos-toolchain/containment-zones.ts`
 * and applies the zone-then-allowlist-then-scan pipeline to every Write/Edit/MultiEdit.
 *
 * MODES (env: DOS_LIFT_CONTAINMENT_GUARD_MODE):
 *   shadow  (DEFAULT) — log violations to MEMORY/STATE/containment-guard-shadow.jsonl,
 *                       always continue:true. Operator reviews before promoting.
 *   enforce            — block on violation via permissionDecision: "deny".
 *   disabled           — bypass entirely (no log, no scan).
 *
 * Feature-flag opt-out (RFC-0057 §7):
 *   DOS_LIFT_CONTAINMENT_GUARD_DISABLED=1 → bypass equivalent to mode=disabled.
 *
 * Bypass flow (in order):
 *   1. tool not in {Write, Edit, MultiEdit} → continue
 *   2. DISABLED flag set → continue
 *   3. mode=disabled → continue
 *   4. file path resolves into a containment zone → continue (private content allowed in zone)
 *   5. file path is in PATTERN_ALLOWLIST_FILES → continue (legitimate exception)
 *   6. content has no IDENTITY_PATTERNS hits → continue
 *   7. otherwise:
 *       mode=shadow  → log + continue
 *       mode=enforce → deny
 *
 * Coupling: RFC-0044 §3-§4, RFC-0057 §7-§8, the IntelFirstGuard.hook.ts structural template.
 */

import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput } from './lib/hook-io';
import { loadProjectEnv } from './lib/paths';

loadProjectEnv();

// ─── 0. Read input — fail open on bad pipe ────────────────────────────────
const input = await readHookInput();
if (!input) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

const toolName = (input as { tool_name?: string }).tool_name || '';
const toolInput = (input as { tool_input?: Record<string, unknown> }).tool_input || {};
const sessionId = input.session_id || 'unknown';

// ─── 1. Tool guard ────────────────────────────────────────────────────────
const GUARDED = new Set(['Write', 'Edit', 'MultiEdit']);
if (!GUARDED.has(toolName)) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 2-3. Mode + disabled flag ────────────────────────────────────────────
const mode = (process.env.DOS_LIFT_CONTAINMENT_GUARD_MODE || 'shadow').toLowerCase();
const disabled = process.env.DOS_LIFT_CONTAINMENT_GUARD_DISABLED === '1';

if (disabled || mode === 'disabled') {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 4-pre. Resolve repo root + zones module ──────────────────────────────
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
let PATTERN_ALLOWLIST_FILES: string[] = [];
let IDENTITY_PATTERNS: PatternShape[] = [];
let matchesZone: ((p: string, z?: ZoneShape[]) => ZoneShape | null) | null = null;
let isAllowlisted: ((p: string, a?: string[]) => boolean) | null = null;
let scanForViolations:
  | ((c: string, p?: PatternShape[]) => ViolationShape[])
  | null = null;

if (zonesModulePath && existsSync(zonesModulePath)) {
  try {
    const mod = await import(zonesModulePath);
    CONTAINMENT_ZONES = mod.CONTAINMENT_ZONES || [];
    PATTERN_ALLOWLIST_FILES = mod.PATTERN_ALLOWLIST_FILES || [];
    IDENTITY_PATTERNS = mod.IDENTITY_PATTERNS || [];
    matchesZone = mod.matchesZone;
    isAllowlisted = mod.isAllowlisted;
    scanForViolations = mod.scanForViolations;
  } catch (err) {
    // Fail open with a single shadow log of the import failure
    logShadow({
      reason: 'zones-import-failed',
      error: String(err),
    });
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  }
} else {
  // No zones file found — fail open silently. Operator will notice when zones land.
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

if (!matchesZone || !isAllowlisted || !scanForViolations) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 4. Extract target file_path + content ────────────────────────────────
const filePath = String(toolInput.file_path || toolInput.path || '');
if (!filePath) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// Normalize to repo-relative path (when possible)
const relativePath = (() => {
  if (!repoRoot) return filePath;
  if (filePath.startsWith('/')) {
    const rel = relative(repoRoot, filePath);
    return rel.startsWith('..') ? filePath : rel;
  }
  return filePath;
})();

// ─── 4b. Zone match → continue (private content allowed in zone) ──────────
const zoneHit = matchesZone(relativePath, CONTAINMENT_ZONES);
if (zoneHit) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 5. Allowlist match → continue ────────────────────────────────────────
if (isAllowlisted(relativePath, PATTERN_ALLOWLIST_FILES)) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 6-7. Scan content for identity patterns ──────────────────────────────
const content = extractContent(toolName, toolInput);
const violations = content
  ? scanForViolations(content, IDENTITY_PATTERNS)
  : [];

if (violations.length === 0) {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
}

// ─── 7. Violation handling ────────────────────────────────────────────────
const summary = {
  timestamp: new Date().toISOString(),
  session_id: sessionId,
  tool: toolName,
  file_path: relativePath,
  absolute_path: filePath,
  violation_count: violations.length,
  violations: violations.map((v) => ({
    pattern: v.pattern,
    matched_text: v.matchedText.slice(0, 80),
    line: v.lineNumber,
    suggestion: v.suggestion,
  })),
  mode,
  would_block: mode === 'enforce',
};

logShadow(summary);

if (mode === 'enforce') {
  const reason = formatBlockReason(relativePath, violations);
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
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
  lineNumber: number;
  suggestion: string;
}

function hasZonesAt(dir: string): boolean {
  return (
    existsSync(join(dir, 'Packs', 'sentinel', 'src', 'Tools', 'containment-zones.ts')) ||
    existsSync(join(dir, 'Tools', 'dos-toolchain', 'containment-zones.ts'))
  );
}

function resolveRepoRoot(): string | null {
  // 1. CLAUDE_PROJECT_DIR env wins
  const env = process.env.CLAUDE_PROJECT_DIR;
  if (env && hasZonesAt(env)) {
    return env;
  }
  // 2. Walk up from cwd. Do NOT hard-stop at a `.git` boundary: when cwd is inside
  //    the active submodule (Releases/vX.Y.Z/.claude — the default workspace), the
  //    FIRST `.git` is the submodule gitlink, which has no zones, so the old
  //    `return null` there made this guard resolve null and fail OPEN — every
  //    Write/Edit in the submodule silently bypassed the identity/secret scan. The
  //    parent-repo zones sit ABOVE the submodule .git, so keep walking to find them.
  //    (Forge Gen 26; verified null-from-submodule → resolves ~/Durante.)
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (hasZonesAt(dir)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 3. Final safety net: the known monorepo root (covers subagent / odd cwds).
  const fallback = join(homedir(), 'Durante');
  return hasZonesAt(fallback) ? fallback : null;
}

function extractContent(tool: string, ti: Record<string, unknown>): string {
  if (tool === 'Write') return String(ti.content || '');
  if (tool === 'Edit') return String(ti.new_string || '');
  if (tool === 'MultiEdit') {
    const edits = (ti.edits as Array<{ new_string?: string }>) || [];
    return edits.map((e) => String(e.new_string || '')).join('\n');
  }
  return '';
}

function logShadow(entry: Record<string, unknown>): void {
  try {
    const stateDir = join(homedir(), '.claude', 'MEMORY', 'STATE');
    if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
    const path = join(stateDir, 'containment-guard-shadow.jsonl');
    appendFileSync(path, JSON.stringify(entry) + '\n');
  } catch {
    // Best-effort — never break the hook over shadow logging
  }
}

function formatBlockReason(rel: string, vs: ViolationShape[]): string {
  const head = `🛑 ContainmentGuard: '${rel}' is outside any containment zone but contains identity/secret patterns.`;
  const body = vs
    .slice(0, 3)
    .map((v) => `  • [${v.pattern}] line ${v.lineNumber}: ${v.matchedText.slice(0, 60)}\n    → ${v.suggestion}`)
    .join('\n');
  const more = vs.length > 3 ? `\n  ... +${vs.length - 3} more` : '';
  const opts =
    '\n\nOptions:\n' +
    '  • Move file into a containment zone (see Packs/sentinel/src/Tools/containment-zones.ts).\n' +
    '  • Add file to PATTERN_ALLOWLIST_FILES if it legitimately documents the pattern.\n' +
    '  • Replace literal value with config/env reference.\n' +
    '  • Bypass once: run with DOS_LIFT_CONTAINMENT_GUARD_DISABLED=1 (operator escape hatch).';
  return `${head}\n${body}${more}${opts}`;
}
