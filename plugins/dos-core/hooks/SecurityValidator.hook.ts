#!/usr/bin/env bun
/**
 * SecurityValidator.hook.ts - Security Validation for Tool Calls (PreToolUse)
 *
 * PURPOSE:
 * Validates Bash commands and file operations against security patterns before
 * execution. Prevents accidental or malicious operations that could damage the
 * system, expose secrets, or compromise security.
 *
 * TRIGGER: PreToolUse (matcher: Bash, Edit, Write, Read)
 *
 * INPUT:
 * - tool_name: "Bash" | "Edit" | "Write" | "Read"
 * - tool_input: { command?: string, file_path?: string, ... }
 * - session_id: Current session identifier
 *
 * OUTPUT:
 * - stdout: JSON decision object
 *   - {"continue": true} → Allow operation
 *   - {"decision": "ask", "message": "..."} → Prompt user for confirmation
 * - exit(0): Normal completion (with decision)
 * - exit(2): Hard block (catastrophic operation prevented)
 *
 * SIDE EFFECTS:
 * - Writes to: MEMORY/SECURITY/YYYY/MM/security-{summary}-{timestamp}.jsonl
 * - User prompt: May trigger confirmation dialog for confirm-level operations
 *
 * INTER-HOOK RELATIONSHIPS:
 * - DEPENDS ON: patterns.yaml (security pattern definitions)
 * - COORDINATES WITH: None (standalone validation)
 * - MUST RUN BEFORE: Tool execution (blocking)
 * - MUST RUN AFTER: None
 *
 * ERROR HANDLING:
 * - Missing patterns.yaml: Fails CLOSED onto HARDENED_FALLBACK — baked-in
 *   catastrophic-command block list (RFC-0112 §11 Phase 1), NOT allow-all
 * - Parse errors: Logs warning, fails CLOSED onto HARDENED_FALLBACK (RFC-0112 A2)
 * - Logging failures: Silent (should not block operations)
 *
 * PERFORMANCE:
 * - Blocking: Yes (must complete before tool executes)
 * - Typical execution: <10ms
 * - Design: Fast path for safe operations, pattern matching only when needed
 *
 * PATTERN CATEGORIES:
 * Bash commands:
 * - blocked: Always prevented (rm -rf /, format, etc.)
 * - confirm: Requires user confirmation (git push --force, etc.)
 * - alert: Logged but allowed (sudo, etc.)
 *
 * File paths:
 * - zeroAccess: Never readable or writable (~/.ssh, credentials, etc.)
 * - readOnly: Readable but not writable (system configs)
 * - confirmWrite: Requires confirmation to write
 * - noDelete: Cannot be deleted
 *
 * SECURITY MODEL:
 * - Defense in depth: Multiple pattern layers
 * - Fail-safe for catastrophic operations (exit 2)
 * - Fail-open for minor concerns (log and allow)
 * - All decisions logged for audit trail
 *
 * AUDIT — Claude Code v2.1.110 PermissionRequest re-check (DOSUpgrade L9):
 * v2.1.110 re-runs `permissions.deny` checks against any `updatedInput` a
 * PermissionRequest hook returns, closing a prior bypass window where a hook
 * could rewrite a denied path/command to slip past deny rules.
 *
 * This hook's PreToolUse responses are:
 *   - `{ continue: true }`                      (allow)
 *   - `{ decision: 'ask', message: string }`    (prompt user)
 *   - `process.exit(2)`                         (hard block)
 *
 * It never emits `updatedInput` and never rewrites tool arguments — there is
 * no path/command/argument mutation anywhere in handleBash/handleFileWrite/
 * handleRead. Therefore the new re-check behavior is a no-op here: nothing
 * was relying on the prior (pre-2.1.110) bypass, and nothing needs to change.
 * Conclusion: no code change required; behavior remains strictly additive
 * defense-in-depth for this hook.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { join, resolve as resolvePath } from 'path';
import { homedir } from 'os';
import { getMemorySubdir, getSecurityPatternsPath, expandPath as expandPathLib } from './lib/paths';

// ─── RFC-0112 A2 carve-out: fail-soft `yaml` resolution ────────────────────
// A static `import { parse } from 'yaml'` crashes this hook's WHOLE module
// load on a fresh install with no node_modules — which would leave a fresh
// DOS install with NO security validation at all. So `yaml` is resolved
// dynamically: the `yaml` package FIRST, the vendored bundle SECOND.
//
// SecurityValidator is CARVED OUT of the uniform fail-SOFT pattern the PRD
// hooks use. It fails OPEN by design ONLY for a missing/malformed patterns
// FILE (a usability choice — see loadPatterns; the "should it fail open at
// all" question is RFC-0112 §10 Escalation, out of scope). A missing `yaml`
// DEPENDENCY is a different failure: routing it into that permissive path
// would make the hook load, report healthy, and validate NOTHING. So on an
// unresolvable `yaml` this hook fails LOUD and CLOSED — loadPatterns() falls
// onto HARDENED_FALLBACK (baked-in catastrophic-command blocking). The
// resolution uses its OWN try/catch — never the prd-utils PRD loader — so
// the security hook never inherits the PRD hooks' soft semantics (RedTeam F3).
let parseYaml: ((src: string) => unknown) | null = null;
// Test seam (RFC-0112 A3): `DOS_RFC0112_SIMULATE_NO_YAML=1` forces the
// unresolvable-`yaml` state so the A3 release-gate can characterize the
// HARDENED_FALLBACK path faithfully on the real hook without rebuilding a
// node-modules-less filesystem. It only ever routes to the stricter
// fail-CLOSED path — it can never weaken validation — so it is not an
// attack surface.
if (process.env.DOS_RFC0112_SIMULATE_NO_YAML !== '1') {
  for (const spec of ['yaml', join(import.meta.dir, 'lib', 'vendor', 'prd-bundle.js')]) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(spec) as { parse?: (s: string) => unknown; parseYaml?: (s: string) => unknown };
      parseYaml = mod.parse ?? mod.parseYaml ?? null;
      if (parseYaml) break;
    } catch { /* try the next candidate */ }
  }
}
const yamlAvailable: boolean = parseYaml !== null;
if (!yamlAvailable) {
  console.error(
    '[DOS SECURITY] 🚨 RFC-0112: `yaml` dependency unresolvable (yaml package + ' +
    'vendored bundle both failed). SecurityValidator is running its HARDENED ' +
    'FALLBACK pattern set — catastrophic-command blocking only, NOT the full ' +
    'patterns.yaml policy. Fail-LOUD / fail-CLOSED by design. Provision the ' +
    'vendored bundle via `bun ~/Durante/Tools/bundle-hook-deps.ts`.',
  );
}
import { startTimer, stopTimer } from './lib/hook-io';
import { globToRegex } from './lib/glob';

// ========================================
// Security Event Logging
// ========================================

// Logs to individual files: MEMORY/SECURITY/YYYY/MM/security-{summary}-{timestamp}.jsonl
// Each event gets a descriptive filename for easy scanning

interface SecurityEvent {
  timestamp: string;
  session_id: string;
  event_type: 'block' | 'confirm' | 'alert' | 'allow' | 'shadow';
  tool: string;
  category: 'bash_command' | 'path_access' | 'skill_root_violation';
  target: string;  // command or path
  pattern_matched?: string;
  reason?: string;
  action_taken: string;
  // skill_root_violation only:
  target_root?: string;     // Which managed_paths glob matched the target
  enforce_mode?: 'shadow' | 'warn' | 'enforce';  // Mode at observation time
}

function generateEventSummary(event: SecurityEvent): string {
  // Create a 6-word-max slug from event type and target/reason
  const eventWord = event.event_type; // block, confirm, alert, allow

  // Extract key words from target or reason
  const source = event.reason || event.target || 'unknown';
  const words = source
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')  // Remove special chars
    .split(/\s+/)
    .filter(w => w.length > 1)     // Skip tiny words
    .slice(0, 5);                   // Max 5 words (+ event type = 6)

  return [eventWord, ...words].join('-');
}

function getSecurityLogPath(event: SecurityEvent): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hour = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const sec = now.getSeconds().toString().padStart(2, '0');

  const summary = generateEventSummary(event);
  const timestamp = `${year}${month}${day}-${hour}${min}${sec}`;

  return join(getMemorySubdir('SECURITY'), year, month, `security-${summary}-${timestamp}.jsonl`);
}

function logSecurityEvent(event: SecurityEvent): void {
  try {
    const logPath = getSecurityLogPath(event);
    const dir = logPath.substring(0, logPath.lastIndexOf('/'));

    // Ensure directory exists
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify(event, null, 2);
    writeFileSync(logPath, content);
  } catch {
    // Logging failure should not block operations
    console.error('Warning: Failed to log security event');
  }
}

// ========================================
// Types
// ========================================

interface HookInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown> | string;
}

interface Pattern {
  pattern: string;
  reason: string;
}

interface AllowlistEntry {
  pattern: string;
  reason: string;
}

interface SkillRootsConfig {
  enforce_mode: 'shadow' | 'warn' | 'enforce';
  managed_paths: string[];
  allowlist: AllowlistEntry[];
  dedup_ttl_hours: number;
  per_session_cap: number;
}

interface PatternsConfig {
  version: string;
  philosophy: {
    // RFC-0112 §11 Phase 3: closed union — the legacy 'permissive' allow-all
    // value is removed. Operator patterns.yaml may still carry free-form mode
    // strings (e.g. 'permissive_with_guards'); those reach here only via the
    // `parseYaml(...) as PatternsConfig` cast in loadPatterns(), which does not
    // narrow. In-file constructions (e.g. HARDENED_FALLBACK) must use a member below.
    mode: 'hardened-fallback' | 'operator-authored' | 'strict';
    principle: string;
  };
  bash: {
    trusted: Pattern[];
    blocked: Pattern[];
    confirm: Pattern[];
    alert: Pattern[];
  };
  paths: {
    zeroAccess: string[];
    readOnly: string[];
    confirmWrite: string[];
    noDelete: string[];
  };
  projects: Record<string, {
    path: string;
    rules: Array<{ action: string; reason: string }>;
  }>;
  // Optional; absent = skill-root checks disabled (fail-open)
  skillRoots?: SkillRootsConfig;
}

// Resolution-tier label for the patterns file that loaded.
type PatternsSource = 'project' | 'cwd' | 'user' | 'system' | 'none';

// ========================================
// Config Loading - 4-Layer Cascade via paths.ts helper
// ========================================
//
// Resolution order (first match wins) is delegated to getSecurityPatternsPath():
// 1. $CLAUDE_PROJECT_DIR/MEMORY/SECURITY/patterns.yaml   (project override)
// 2. process.cwd()/MEMORY/SECURITY/patterns.yaml          (cwd fallback)
// 3. ~/.claude/DOS/USER/DOSSECURITYSYSTEM/patterns.yaml   (global personal override)
// 4. ~/.claude/DOS/DOSSECURITYSYSTEM/patterns.example.yaml (installed default)

let patternsCache: PatternsConfig | null = null;
let patternsSource: PatternsSource = 'none';

function classifyPatternsSource(p: string): PatternsSource {
  if (p.includes('/MEMORY/SECURITY/patterns.yaml')) {
    const envDir = process.env.CLAUDE_PROJECT_DIR;
    if (envDir && p.startsWith(expandPathLib(envDir))) return 'project';
    return 'cwd';
  }
  if (p.includes('/DOS/USER/DOSSECURITYSYSTEM/')) return 'user';
  if (p.includes('/DOS/DOSSECURITYSYSTEM/')) return 'system';
  return 'none';
}

function getPatternsPath(): string | null {
  const found = getSecurityPatternsPath();
  patternsSource = found ? classifyPatternsSource(found) : 'none';
  return found;
}

// RFC-0112 A2: baked-in NON-permissive fallback. Used ONLY when `yaml` is
// unresolvable (see the resolution block near the top of this file). Mirrors
// the catastrophic `bash.blocked` set from patterns.example.yaml so a fresh
// DOS install with no provisioned `yaml` is still SECURED against root wipes,
// raw-disk writes, fork bombs, and curl|bash — not left inert. philosophy.mode
// is 'hardened-fallback', deliberately NOT 'permissive'.
const HARDENED_FALLBACK: PatternsConfig = {
  version: 'rfc-0112-hardened-fallback',
  philosophy: {
    mode: 'hardened-fallback',
    principle: '`yaml` unavailable — baked-in catastrophic-command blocking; fail-CLOSED, not permissive',
  },
  bash: {
    trusted: [],
    blocked: [
      { pattern: 'rm\\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\\s+/(\\s|$)', reason: 'rm -rf / — unrecoverable root wipe' },
      { pattern: 'rm\\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\\s+(~|\\$HOME)(/\\*|\\s|$)', reason: 'rm -rf ~ — would nuke the home directory' },
      { pattern: 'dd\\s+.*of=/dev/(disk|sd[a-z]|nvme|rdisk)', reason: 'Raw disk writes — guaranteed data loss' },
      { pattern: '(?:^|[\\s;|&])mkfs(\\.[a-z0-9]+)?\\s+(/dev/|/Volumes/)', reason: 'Filesystem creation on a device — destroys the target' },
      { pattern: '(?:^|[\\s;|&])format\\s+(/dev/|[A-Za-z]:|/Volumes/)|\\bdiskutil\\s+(eraseDisk|zeroDisk)\\b', reason: 'Disk formatting or erasure' },
      { pattern: ':\\(\\)\\s*\\{\\s*:\\|:\\&\\s*\\};\\s*:', reason: 'Fork bomb — denial of service' },
      { pattern: 'curl\\s+[^|]*\\|\\s*(sudo\\s+)?(bash|sh|zsh)\\b', reason: 'curl | bash — unreviewed remote code execution' },
      { pattern: 'wget\\s+[^|]*\\|\\s*(sudo\\s+)?(bash|sh|zsh)\\b', reason: 'wget | bash — unreviewed remote code execution' },
      { pattern: '\\bchmod\\s+-R?\\s*777\\s+/(\\s|$)', reason: 'World-writable root — catastrophic permission change' },
      { pattern: '\\bchown\\s+-R\\s+[^\\s]+\\s+/(\\s|$)', reason: 'Recursive chown of root filesystem' },
      { pattern: '>\\s*/dev/(disk|sd[a-z]|nvme|rdisk)', reason: 'Redirect into raw block device' },
    ],
    confirm: [
      { pattern: 'git\\s+push\\s+(-f|--force|--force-with-lease)\\b', reason: 'Force push rewrites remote history' },
      { pattern: 'git\\s+reset\\s+--hard\\b', reason: 'Hard reset discards uncommitted work' },
      { pattern: '(?:^|[\\s;|&"\'`])drop\\s+(database|table|schema)\\s+', reason: 'SQL DDL destruction' },
    ],
    alert: [],
  },
  paths: { zeroAccess: [], readOnly: [], confirmWrite: [], noDelete: [] },
  projects: {},
};

// RFC-0112 §11 Phase 2: DOS_VALIDATOR_MODE operator toggle. Read ONCE per
// process — PreToolUse spawns a fresh process per tool call, so a module-scope
// const is per-invocation stable and preserves the patternsCache memoization
// contract. Default 'hardened'. Any value other than 'strict' — including the
// removed 'permissive', unknown strings, or empty — resolves to 'hardened';
// there is deliberately NO allow-all mode (RFC-0112 §11.2 R3).
const VALIDATOR_MODE: 'hardened' | 'strict' =
  process.env.DOS_VALIDATOR_MODE === 'strict' ? 'strict' : 'hardened';

// strict mode unions the HARDENED_FALLBACK catastrophic floor onto whatever
// config loaded, so an operator patterns.yaml can ADD blocks but never DROP the
// baked-in floor (rm -rf /, raw-disk writes, mkfs, fork bombs, curl|bash). The
// floor source is the const above, never the loaded file. Idempotent: applying
// it to HARDENED_FALLBACK itself is a no-op (dedup by pattern string).
//
// Scope note (RFC-0112 §11.2 R7b — deferred to the parent build PRD): this does
// NOT touch bash.trusted, which validateBashCommand checks BEFORE bash.blocked.
// A catch-all operator `trusted` entry can still shadow the floor; that global
// precedence fix is out of this surgical scope.
function unionPatterns(operator: Pattern[], floor: Pattern[]): Pattern[] {
  const have = new Set(operator.map((p) => p.pattern));
  return [...operator, ...floor.filter((f) => !have.has(f.pattern))];
}

function applyValidatorMode(config: PatternsConfig): PatternsConfig {
  if (VALIDATOR_MODE !== 'strict') return config;
  return {
    ...config,
    bash: {
      ...config.bash,
      blocked: unionPatterns(config.bash.blocked, HARDENED_FALLBACK.bash.blocked),
      confirm: unionPatterns(config.bash.confirm, HARDENED_FALLBACK.bash.confirm),
    },
    paths: {
      ...config.paths,
      zeroAccess: Array.from(
        new Set([...config.paths.zeroAccess, ...HARDENED_FALLBACK.paths.zeroAccess]),
      ),
    },
  };
}

function loadPatterns(): PatternsConfig {
  if (patternsCache) return patternsCache;

  // RFC-0112 A2 carve-out: a missing `yaml` dependency cannot be parsed away
  // into a permissive fallback. Without a YAML parser patterns.yaml cannot be
  // read AT ALL — so fail CLOSED onto the baked-in hardened set. The parse-error
  // path below ALSO fails CLOSED (RFC-0112 §10 escalation: a patterns.yaml that
  // exists but is corrupted/tampered must not disable blocking). RFC-0112 §11
  // Phase 1 closes the LAST hole: the no-file path below now also fails CLOSED.
  if (!yamlAvailable) {
    patternsCache = applyValidatorMode(HARDENED_FALLBACK);
    return patternsCache;
  }

  const patternsPath = getPatternsPath();

  if (!patternsPath) {
    // RFC-0112 §11 Phase 1: no patterns.yaml resolved on ANY cascade layer
    // (project, cwd, user, system). This used to fail OPEN — an empty allow-all
    // config that silently disabled ALL blocking on a fresh install. It now
    // fails CLOSED onto the baked-in catastrophic-command set, mirroring the
    // !yamlAvailable and parse-error branches. The distinct stderr marker below
    // is the forensic discriminator that separates this arm from the
    // !yamlAvailable arm (both now return HARDENED_FALLBACK) — load-bearing for
    // the §11 negative test, which must prove it exercised THIS branch.
    console.error('[DOS SECURITY] no patterns.yaml found on any cascade layer — failing CLOSED onto HARDENED_FALLBACK');
    patternsCache = applyValidatorMode(HARDENED_FALLBACK);
    return patternsCache;
  }

  try {
    const content = readFileSync(patternsPath, 'utf-8');
    // Non-null assertion is safe: the `!yamlAvailable` branch above returned
    // early, so `parseYaml` is guaranteed resolved past this point.
    patternsCache = applyValidatorMode(parseYaml!(content) as PatternsConfig);
    return patternsCache;
  } catch (error) {
    // Parse error - fail CLOSED. A patterns.yaml that EXISTS but cannot be
    // parsed is a corrupted/tampered policy, not an absent one — degrading to
    // permissive here would let a malformed (or maliciously broken) policy file
    // disable all blocking. Mirror the RFC-0112 !yamlAvailable precedent and
    // fall back to the baked-in catastrophic-command set instead.
    console.error(`Failed to parse ${patternsSource} patterns.yaml — failing CLOSED onto HARDENED_FALLBACK:`, error);
    patternsCache = applyValidatorMode(HARDENED_FALLBACK);
    return patternsCache;
  }
}

// ========================================
// Command Normalization
// ========================================

/**
 * Strip leading environment variable assignments from a command.
 * Prevents bypass like: LANG=C rm -rf / or FOO="bar" dangerous-cmd
 * Also strips leading whitespace.
 */
function stripEnvVarPrefix(command: string): string {
  return command.replace(
    /^\s*(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|[^\s]*)\s+)*/,
    ''
  );
}

// ========================================
// Pattern Matching
// ========================================

function matchesPattern(command: string, pattern: string): boolean {
  // Convert pattern to regex
  // Patterns can use .* for wildcards
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(command);
  } catch {
    // Invalid regex - try literal match
    return command.toLowerCase().includes(pattern.toLowerCase());
  }
}

function expandPath(path: string): string {
  // Expand ~ to home directory
  if (path.startsWith('~')) {
    return path.replace('~', homedir());
  }
  return path;
}

function matchesPathPattern(filePath: string, pattern: string): boolean {
  const expandedPattern = expandPath(pattern);
  const expandedPath = expandPath(filePath);

  // Handle glob patterns via shared globToRegex helper (Tools/dos-toolchain/glob.ts,
  // mirrored here as ./lib/glob.ts; sync-check enforces byte-identical via aliases).
  if (pattern.includes('*')) {
    try {
      const regex = globToRegex(expandedPattern);
      return regex.test(expandedPath);
    } catch {
      return false;
    }
  }

  // Exact match or prefix match for directories
  return expandedPath === expandedPattern ||
         expandedPath.startsWith(expandedPattern.endsWith('/') ? expandedPattern : expandedPattern + '/');
}

// ========================================
// Bash Command Validation
// ========================================

function validateBashCommand(command: string): { action: 'allow' | 'block' | 'confirm' | 'alert'; reason?: string } {
  const patterns = loadPatterns();

  // Check trusted patterns FIRST (fast-path allow, no logging)
  for (const p of (patterns.bash.trusted || [])) {
    if (matchesPattern(command, p.pattern)) {
      return { action: 'allow' };
    }
  }

  // Check blocked patterns (hard block)
  for (const p of patterns.bash.blocked) {
    if (matchesPattern(command, p.pattern)) {
      return { action: 'block', reason: p.reason };
    }
  }

  // Check confirm patterns (prompt user)
  for (const p of patterns.bash.confirm) {
    if (matchesPattern(command, p.pattern)) {
      return { action: 'confirm', reason: p.reason };
    }
  }

  // Check alert patterns (log but allow)
  for (const p of patterns.bash.alert) {
    if (matchesPattern(command, p.pattern)) {
      return { action: 'alert', reason: p.reason };
    }
  }

  return { action: 'allow' };
}

// ========================================
// Path Validation
// ========================================

type PathAction = 'read' | 'write' | 'delete';

function validatePath(filePath: string, action: PathAction): { action: 'allow' | 'block' | 'confirm'; reason?: string } {
  const patterns = loadPatterns();

  // Check zeroAccess (complete denial)
  for (const p of patterns.paths.zeroAccess) {
    if (matchesPathPattern(filePath, p)) {
      return { action: 'block', reason: `Zero access path: ${p}` };
    }
  }

  // Check readOnly (can read, cannot write/delete)
  if (action === 'write' || action === 'delete') {
    for (const p of patterns.paths.readOnly) {
      if (matchesPathPattern(filePath, p)) {
        return { action: 'block', reason: `Read-only path: ${p}` };
      }
    }
  }

  // Check confirmWrite (can read, writing requires confirmation)
  if (action === 'write') {
    for (const p of patterns.paths.confirmWrite) {
      if (matchesPathPattern(filePath, p)) {
        return { action: 'confirm', reason: `Writing to protected file requires confirmation: ${p}` };
      }
    }
  }

  // Check noDelete (can read/write, cannot delete)
  if (action === 'delete') {
    for (const p of patterns.paths.noDelete) {
      if (matchesPathPattern(filePath, p)) {
        return { action: 'block', reason: `Cannot delete protected path: ${p}` };
      }
    }
  }

  return { action: 'allow' };
}

// ========================================
// Skill Roots Validation (shadow mode)
// ========================================
//
// Detects writes to managed paths (e.g., ~/.claude/MEMORY/** + DOS/USER/**)
// that fall outside any allowlist entry, and emits a SecurityEvent with
// category='skill_root_violation' to MEMORY/SECURITY/YYYY/MM/*.jsonl.
//
// Shipped in shadow mode: the function always returns 'allow'; the side
// effect is a JSONL log entry (suppressed by per-process dedup + cap).
//
// Honest framing: this measures DRIFT PRESSURE on managed paths. PreToolUse
// has no skill-context, so writes cannot be attributed to a specific skill.
// A shadow event is a prompt to review path declarations, not a verdict.
//
// Noise suppression:
//   - Allowlist matches short-circuit BEFORE dedup/cap so allowlisted paths
//     never consume cap budget (Sentinel, REFLECTIONS, STATE, SECURITY).
//   - PER-PROCESS dedup Map (sha256 key → TTL). Each PreToolUse spawns a
//     fresh process, so dedup is best-effort within a single hook invocation
//     (which can fan out internal writes via subagents). True cross-process
//     dedup happens at log-analysis time on the same (session, root, path)
//     tuple. The Map prevents intra-process write amplification.
//   - Per-session cap (default 20) within each process; same scope.

interface SkillRootsCheckResult {
  action: 'allow';
  emitted: boolean;
  matched_root?: string;
  matched_allow?: string;
}

interface CompiledGlob {
  raw: string;
  regex: RegExp | null;  // null if pattern had unresolved variables
}

const dedupMap: Map<string, number> = new Map();
const sessionEventCount: Map<string, number> = new Map();
const compiledGlobCache: Map<string, CompiledGlob> = new Map();

// Resolved once at module init; stable for process lifetime.
const PROCESS_HOME = homedir();
let PROCESS_PROJECT_ROOT: string | null = null;
{
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir) {
    try { PROCESS_PROJECT_ROOT = resolvePath(expandPathLib(envDir)); } catch { /* ignore */ }
  }
  if (!PROCESS_PROJECT_ROOT) {
    try { PROCESS_PROJECT_ROOT = process.cwd(); } catch { /* ignore */ }
  }
}

function compileGlob(pattern: string): CompiledGlob {
  const cached = compiledGlobCache.get(pattern);
  if (cached) return cached;

  let expanded = pattern
    .replace(/\$\{HOME\}/g, PROCESS_HOME)
    .replace(/^~(?=\/|$)/, PROCESS_HOME);

  // ${PROJECT} requires a resolvable project root; otherwise the pattern is
  // unmatchable and cached as null.
  if (expanded.includes('${PROJECT}')) {
    if (!PROCESS_PROJECT_ROOT) {
      const out: CompiledGlob = { raw: pattern, regex: null };
      compiledGlobCache.set(pattern, out);
      return out;
    }
    expanded = expanded.replace(/\$\{PROJECT\}/g, PROCESS_PROJECT_ROOT);
  }

  // Glob → regex via shared helper (same semantics as matchesPathPattern).
  let regex: RegExp | null = null;
  try { regex = globToRegex(expanded); } catch { /* invalid regex → null */ }

  const out: CompiledGlob = { raw: pattern, regex };
  compiledGlobCache.set(pattern, out);
  return out;
}

function checkSkillRoots(
  targetPath: string,
  sessionId: string,
  config: SkillRootsConfig
): SkillRootsCheckResult {
  const absPath = resolveAbsPath(targetPath);
  if (!absPath) return { action: 'allow', emitted: false };

  const matchedRoot = findMatchedRoot(absPath, config.managed_paths || []);
  if (!matchedRoot) return { action: 'allow', emitted: false };

  const matchedAllow = checkAllowlist(absPath, config.allowlist || []);
  if (matchedAllow) return { action: 'allow', emitted: false, matched_allow: matchedAllow };

  if (isRateLimited(absPath, sessionId, matchedRoot, config)) {
    return { action: 'allow', emitted: false, matched_root: matchedRoot };
  }

  emitShadowEvent(absPath, sessionId, matchedRoot, config);
  return { action: 'allow', emitted: true, matched_root: matchedRoot };
}

// ---- checkSkillRoots helpers (file-local) ----

function resolveAbsPath(targetPath: string): string | null {
  try { return resolvePath(targetPath); }
  catch { return null; }
}

function findMatchedRoot(absPath: string, managedPaths: string[]): string | undefined {
  for (const mp of managedPaths) {
    const cg = compileGlob(mp);
    if (cg.regex && cg.regex.test(absPath)) return mp;
  }
  return undefined;
}

function checkAllowlist(absPath: string, allowlist: AllowlistEntry[]): string | undefined {
  for (const entry of allowlist) {
    const cg = compileGlob(entry.pattern);
    if (cg.regex && cg.regex.test(absPath)) return entry.pattern;
  }
  return undefined;
}

function sweepExpiredDedupEntries(cap: number): void {
  if (dedupMap.size <= cap * 4) return;
  const now = Date.now();
  for (const [k, expiry] of dedupMap) {
    if (expiry <= now) dedupMap.delete(k);
  }
}

function isRateLimited(
  absPath: string,
  sessionId: string,
  matchedRoot: string,
  config: SkillRootsConfig
): boolean {
  const cap = config.per_session_cap ?? 20;
  const ttlMs = (config.dedup_ttl_hours ?? 24) * 3600 * 1000;
  const dedupKey = createHash('sha256').update(`${sessionId}::${matchedRoot}::${absPath}`).digest('hex');
  const now = Date.now();

  sweepExpiredDedupEntries(cap);

  if (dedupMap.has(dedupKey)) return true;

  const count = sessionEventCount.get(sessionId) ?? 0;
  if (count >= cap) return true;

  // Reserve slot — caller must emit an event after this returns false.
  dedupMap.set(dedupKey, now + ttlMs);
  sessionEventCount.set(sessionId, count + 1);
  return false;
}

function emitShadowEvent(
  absPath: string,
  sessionId: string,
  matchedRoot: string,
  config: SkillRootsConfig
): void {
  logSecurityEvent({
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    event_type: 'shadow',
    tool: 'skillRoots',
    category: 'skill_root_violation',
    target: absPath,
    target_root: matchedRoot,
    enforce_mode: config.enforce_mode,
    pattern_matched: matchedRoot,
    reason: `Write to managed path outside any declared root or allowlist entry (mode=${config.enforce_mode})`,
    action_taken: 'shadow_observed_allowed',
  });
}

// ========================================
// Tool-Specific Handlers
// ========================================

function handleBash(input: HookInput): void {
  const rawCommand = typeof input.tool_input === 'string'
    ? input.tool_input
    : (input.tool_input?.command as string) || '';

  if (!rawCommand) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  // Normalize: strip env var prefixes to prevent bypass (e.g., LANG=C rm -rf /)
  const command = stripEnvVarPrefix(rawCommand);
  const result = validateBashCommand(command);

  switch (result.action) {
    case 'block':
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: 'block',
        tool: 'Bash',
        category: 'bash_command',
        target: command.slice(0, 500),
        reason: result.reason,
        action_taken: 'Hard block - exit 2'
      });
      console.error(`[DOS SECURITY] 🚨 BLOCKED: ${result.reason}`);
      console.error(`Command: ${command.slice(0, 100)}`);
      process.exit(2);
      break;

    case 'confirm':
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: 'confirm',
        tool: 'Bash',
        category: 'bash_command',
        target: command.slice(0, 500),
        reason: result.reason,
        action_taken: 'Prompted user for confirmation'
      });
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `[DOS SECURITY] ⚠️ ${result.reason}\n\nCommand: ${command.slice(0, 200)}`
        }
      }));
      break;

    case 'alert':
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: 'alert',
        tool: 'Bash',
        category: 'bash_command',
        target: command.slice(0, 500),
        reason: result.reason,
        action_taken: 'Logged alert, allowed execution'
      });
      console.error(`[DOS SECURITY] ⚠️ ALERT: ${result.reason}`);
      console.error(`Command: ${command.slice(0, 100)}`);
      console.log(JSON.stringify({ continue: true }));
      break;

    default:
      console.log(JSON.stringify({ continue: true }));
  }
}

// Track unknown enforce_mode values once per process so a typo in patterns.yaml
// surfaces to stderr without flooding logs.
const seenUnknownModes = new Set<string>();

function handleFileWrite(input: HookInput, toolName: string): void {
  const filePath = typeof input.tool_input === 'string'
    ? input.tool_input
    : (input.tool_input?.file_path as string) || '';

  if (!filePath) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const patterns = loadPatterns();

  // Skill-roots check fires only for write-class tools (Edit/Write/MultiEdit).
  // Read and Bash never reach this branch by design — see main() routing.
  // Shadow is observe-only; warn/enforce land in PR5/PR6.
  const sr = patterns.skillRoots;
  if (sr) {
    if (sr.enforce_mode === 'shadow') {
      try { checkSkillRoots(filePath, input.session_id, sr); }
      catch { /* skill-roots check must never block — fail open silently */ }
    } else if (sr.enforce_mode !== 'warn' && sr.enforce_mode !== 'enforce') {
      const v = String(sr.enforce_mode);
      if (!seenUnknownModes.has(v)) {
        seenUnknownModes.add(v);
        console.error(`[DOS SECURITY] Unknown skillRoots.enforce_mode: '${v}' (expected shadow|warn|enforce)`);
      }
    }
  }

  const result = validatePath(filePath, 'write');

  switch (result.action) {
    case 'block':
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: 'block',
        tool: toolName,
        category: 'path_access',
        target: filePath,
        reason: result.reason,
        action_taken: 'Hard block - exit 2'
      });
      console.error(`[DOS SECURITY] 🚨 BLOCKED: ${result.reason}`);
      console.error(`Path: ${filePath}`);
      process.exit(2);
      break;

    case 'confirm':
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: 'confirm',
        tool: toolName,
        category: 'path_access',
        target: filePath,
        reason: result.reason,
        action_taken: 'Prompted user for confirmation'
      });
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: `[DOS SECURITY] ⚠️ ${result.reason}\n\nPath: ${filePath}`
        }
      }));
      break;

    default:
      console.log(JSON.stringify({ continue: true }));
  }
}

function handleRead(input: HookInput): void {
  const filePath = typeof input.tool_input === 'string'
    ? input.tool_input
    : (input.tool_input?.file_path as string) || '';

  if (!filePath) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const result = validatePath(filePath, 'read');

  switch (result.action) {
    case 'block':
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        event_type: 'block',
        tool: 'Read',
        category: 'path_access',
        target: filePath,
        reason: result.reason,
        action_taken: 'Hard block - exit 2'
      });
      console.error(`[DOS SECURITY] 🚨 BLOCKED: ${result.reason}`);
      console.error(`Path: ${filePath}`);
      process.exit(2);
      break;

    default:
      console.log(JSON.stringify({ continue: true }));
  }
}

// ========================================
// Main
// ========================================

async function main(): Promise<void> {
  let input: HookInput;

  try {
    // Streaming stdin read with hard timeout.
    // Bun.stdin.text() can hang forever if stdin never closes (known Bun issue).
    // Use streaming reader + setTimeout that forces process.exit on timeout.
    const reader = Bun.stdin.stream().getReader();
    let raw = '';
    const readLoop = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += new TextDecoder().decode(value, { stream: true });
      }
    })();

    // Hard timeout: if stdin doesn't close in 200ms, exit the process.
    // setTimeout keeps the event loop alive, so we use process.exit to force cleanup.
    const timeout = setTimeout(() => {
      if (!raw.trim()) {
        console.log(JSON.stringify({ continue: true }));
        process.exit(0);
      }
    }, 200);

    await Promise.race([readLoop, new Promise<void>(r => setTimeout(r, 200))]);
    clearTimeout(timeout);
    // Release stdin: a still-pending reader.read() on held-open stdin keeps the
    // event loop alive so this PreToolUse gate hangs after main() returns on any
    // branch that doesn't process.exit (e.g. the 'default: allow' handler). This
    // hook rolled its own pre-fix reader; mirror the shared readHookInput cancel
    // (H-062, the H-034 class).
    reader.cancel().catch(() => {});

    if (!raw.trim()) {
      console.log(JSON.stringify({ continue: true }));
      return;
    }

    input = JSON.parse(raw);
  } catch (err) {
    // Fail OPEN on parse/timeout error — never block real work over a transient
    // stdin glitch — but do it LOUDLY and audited. A silent fail-open on a
    // security gate leaves no trace if the payload is corrupt or tampered
    // (H-063); this matches the loud fail-behavior loadPatterns uses for a
    // corrupt patterns.yaml rather than the previous bare `catch { allow }`.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[SecurityValidator] stdin parse/timeout failed — failing OPEN (allow); payload unreadable: ${msg}`);
    try {
      logSecurityEvent({
        timestamp: new Date().toISOString(),
        session_id: 'unknown',
        event_type: 'allow',
        tool: 'unknown',
        category: 'bash_command',
        target: '(unparseable stdin payload)',
        reason: `SecurityValidator failed OPEN — stdin parse/timeout error: ${msg}`,
        action_taken: 'fail_open_parse_error',
      });
    } catch { /* audit is best-effort; never block on it */ }
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  // Route to appropriate handler
  switch (input.tool_name) {
    case 'Bash':
      handleBash(input);
      break;
    case 'Edit':
    case 'MultiEdit':
      handleFileWrite(input, input.tool_name);
      break;
    case 'Write':
      handleFileWrite(input, 'Write');
      break;
    case 'Read':
      handleRead(input);
      break;
    default:
      // Allow all other tools
      console.log(JSON.stringify({ continue: true }));
  }
}

// Run main, fail open on any error
const _t = startTimer('SecurityValidator');
process.on('exit', () => stopTimer(_t, 'PreToolUse'));
main().catch(() => {
  console.log(JSON.stringify({ continue: true }));
});
