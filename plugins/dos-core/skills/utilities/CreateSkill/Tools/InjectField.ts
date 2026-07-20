#!/usr/bin/env bun
/**
 * InjectField.ts — Zero-dep CLI to inject or replace a single top-level key
 * in a Markdown file's YAML frontmatter.
 *
 * Part of storage-root-enforcement PR2 (see Plans/Specs/storage-root-enforcement.md).
 * Initial use: backfill `roots:` declarations across ~70 SKILL.md files in DOS.
 *
 * Scope:
 *   - Top-level keys only (col 0 within frontmatter fences)
 *   - Inline scalar, flow sequence, flow mapping, AND block sequence/scalar values
 *   - Single-key mutation per invocation
 *
 * Out of scope (will refuse or misbehave):
 *   - Nested key paths (foo.bar.baz)
 *   - YAML anchors / aliases / tags that cross keys
 *   - Structural rewrites
 *
 * Usage:
 *   bun InjectField.ts --skill PATH --field KEY --value 'YAML' [--comment TEXT] [--overwrite]
 *   bun InjectField.ts --batch --manifest PATH --field KEY [--overwrite]
 *   bun InjectField.ts --help
 *
 * Exit codes:
 *   0  success (inserted, replaced, or skipped)
 *   1  refused (malformed frontmatter, invalid args) or batch had any failure
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ============================================================================
// Types
// ============================================================================

export type InjectOptions = {
  overwrite?: boolean;
  comment?: string;
};

export type InjectAction = 'inserted' | 'replaced' | 'skipped' | 'refused';

export type InjectResult = {
  ok: boolean;
  action: InjectAction;
  reason?: string;
};

type BatchEntry = {
  skill: string;
  value: string;
  comment?: string;
  overwrite?: boolean;
};

// ============================================================================
// Path resolution — INLINED from hooks/lib/paths.ts (getMemorySubdir logic).
// Kept inline so this tool is fully standalone: no relative imports across
// the 4-copy universe (live / submodule / Pack / Agent).
// ============================================================================

function expandPath(p: string): string {
  const home = homedir();
  return p
    .replace(/^\$HOME(?=\/|$)/, home)
    .replace(/^\$\{HOME\}(?=\/|$)/, home)
    .replace(/^~(?=\/|$)/, home);
}

function dosMemory(subdir: string): string {
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir) {
    const projectDir = join(expandPath(envDir), 'MEMORY', subdir);
    if (existsSync(projectDir)) return projectDir;
  }

  try {
    const cwdDir = join(process.cwd(), 'MEMORY', subdir);
    if (existsSync(cwdDir)) return cwdDir;
  } catch { /* cwd unreadable */ }

  const dosDir = process.env.DOS_DIR
    ? expandPath(process.env.DOS_DIR)
    : join(homedir(), '.claude');
  return join(dosDir, 'MEMORY', subdir);
}

// ============================================================================
// Frontmatter parsing — line-oriented, CRLF/BOM aware
// ============================================================================

const TOP_LEVEL_KEY_RE = /^([a-zA-Z_][a-zA-Z0-9_-]*):/;
const MAX_FRONTMATTER_LINES = 200;

type FrontmatterShape = {
  openIdx: number;
  closeIdx: number;
};

/**
 * Locate opening and closing `---` fences.
 * Uses trim-compare to accept CRLF (trailing `\r`) and trailing whitespace.
 * Returns null if the file is missing a fence within MAX_FRONTMATTER_LINES.
 */
function locateFrontmatter(lines: string[]): FrontmatterShape | null {
  if (lines.length === 0 || lines[0].trim() !== '---') return null;
  const limit = Math.min(MAX_FRONTMATTER_LINES, lines.length);
  for (let i = 1; i < limit; i++) {
    if (lines[i].trim() === '---') {
      return { openIdx: 0, closeIdx: i };
    }
  }
  return null;
}

/**
 * Find the contiguous block of lines owned by a top-level key within
 * the frontmatter region (inclusive start, exclusive end).
 *
 * - Single-line `key: value`             → { startIdx, endIdx = startIdx + 1 }
 * - Flow sequence/map `key: [ ... ]`     → { startIdx, endIdx = startIdx + 1 }
 * - Block sequence / block scalar        → endIdx extends through indented (>=1) and blank lines
 *
 * Non-matching keys are skipped past their own continuation so their content
 * never shadows a later match (RedTeam Q1 mitigation).
 */
function findKeyBlock(
  lines: string[],
  key: string,
  fm: FrontmatterShape
): { startIdx: number; endIdx: number } | null {
  let i = fm.openIdx + 1;
  while (i < fm.closeIdx) {
    const line = lines[i];
    const m = line.match(TOP_LEVEL_KEY_RE);
    if (!m) {
      i++;
      continue;
    }

    const matchedKey = m[1];
    const startIdx = i;
    let endIdx = i + 1;
    while (endIdx < fm.closeIdx) {
      const l = lines[endIdx];
      if (l.trim() === '') { endIdx++; continue; }
      if (/^[ \t]/.test(l)) { endIdx++; continue; }
      break;
    }

    if (matchedKey === key) {
      return { startIdx, endIdx };
    }
    i = endIdx;
  }
  return null;
}

function formatInsertionLine(key: string, value: string, comment?: string): string {
  const base = `${key}: ${value}`;
  return comment ? `${base}  # ${comment}` : base;
}

// ============================================================================
// Failure logger — NDJSON to MEMORY/LEARNING/inject-field-failures.jsonl
// ============================================================================

function logFailure(skill: string, field: string, reason: string): void {
  const learningDir = dosMemory('LEARNING');
  try {
    mkdirSync(learningDir, { recursive: true });
  } catch { /* already exists or unwritable; try append regardless */ }
  const logPath = join(learningDir, 'inject-field-failures.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    skill,
    field,
    reason,
  };
  try {
    appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch { /* log is best-effort */ }
}

// ============================================================================
// Core API
// ============================================================================

export function injectField(
  filePath: string,
  key: string,
  value: string,
  opts: InjectOptions = {}
): InjectResult {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    const reason = `read failed: ${err?.message ?? String(err)}`;
    logFailure(filePath, key, reason);
    return { ok: false, action: 'refused', reason };
  }

  // Detect and preserve BOM
  const hasBOM = raw.charCodeAt(0) === 0xFEFF;
  if (hasBOM) raw = raw.slice(1);

  // Detect line-ending convention (CRLF anywhere means file is CRLF)
  const usesCRLF = raw.includes('\r\n');
  const sep = usesCRLF ? '\r\n' : '\n';

  const lines = raw.split(/\r?\n/);
  const fm = locateFrontmatter(lines);
  if (!fm) {
    const reason = 'malformed frontmatter (opening --- missing at line 1 or closing --- not within 200 lines)';
    logFailure(filePath, key, reason);
    return { ok: false, action: 'refused', reason };
  }

  const block = findKeyBlock(lines, key, fm);
  const insertionLine = formatInsertionLine(key, value, opts.comment);

  let newLines: string[];
  let action: InjectAction;

  if (block) {
    if (!opts.overwrite) {
      return {
        ok: true,
        action: 'skipped',
        reason: `key '${key}' already present; use --overwrite to replace`,
      };
    }
    newLines = [
      ...lines.slice(0, block.startIdx),
      insertionLine,
      ...lines.slice(block.endIdx),
    ];
    action = 'replaced';
  } else {
    newLines = [
      ...lines.slice(0, fm.closeIdx),
      insertionLine,
      ...lines.slice(fm.closeIdx),
    ];
    action = 'inserted';
  }

  const output = (hasBOM ? '\uFEFF' : '') + newLines.join(sep);
  // writeArtifact:exempt — in-place skill file edit (tooling, not a produced artifact)
  writeFileSync(filePath, output);
  return { ok: true, action };
}

// ============================================================================
// Batch processor
// ============================================================================

export async function processBatch(
  manifestPath: string,
  field: string,
  opts: InjectOptions = {}
): Promise<{ passed: number; failed: number }> {
  const raw = readFileSync(manifestPath, 'utf-8');
  let manifest: BatchEntry[];
  try {
    manifest = JSON.parse(raw);
  } catch (err: any) {
    throw new Error(`manifest parse failed: ${err?.message ?? String(err)}`);
  }
  if (!Array.isArray(manifest)) {
    throw new Error('manifest must be a JSON array of {skill, value, comment?, overwrite?} entries');
  }

  let passed = 0;
  let failed = 0;
  for (const entry of manifest) {
    if (!entry || typeof entry.skill !== 'string' || typeof entry.value !== 'string') {
      console.log(`[skip] invalid entry: ${JSON.stringify(entry)}`);
      failed++;
      continue;
    }
    const effective: InjectOptions = {
      overwrite: entry.overwrite ?? opts.overwrite,
      comment: entry.comment ?? opts.comment,
    };
    const result = injectField(entry.skill, field, entry.value, effective);
    console.log(formatResultLine(result.ok ? result.action : 'refused', entry.skill, result.reason));
    if (result.ok) passed++; else failed++;
  }
  return { passed, failed };
}

// ============================================================================
// CLI
// ============================================================================

type ParsedArgs = {
  help?: boolean;
  batch?: boolean;
  overwrite?: boolean;
  field?: string;
  skill?: string;
  value?: string;
  comment?: string;
  manifest?: string;
};

const BOOLEAN_FLAGS = new Set(['help', 'batch', 'overwrite']);

function parseArgs(argv: string[]): ParsedArgs {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (BOOLEAN_FLAGS.has(key)) {
      out[key] = true;
      continue;
    }
    // Value-taking flags (everything not in BOOLEAN_FLAGS) always consume the
    // next token as their value — even one that starts with '--' (UTIL-07 in
    // DEFECT-REGISTRY-2026-07-03, "--value --dashy" was silently swallowed to
    // boolean true). Only a truly missing operand falls back to a bare flag.
    const next = argv[i + 1];
    if (next === undefined) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out as ParsedArgs;
}

function formatResultLine(action: InjectAction | 'refused', skill: string, reason?: string): string {
  const note = reason ? ` — ${reason}` : '';
  return `[${action}] ${skill}${note}`;
}

function printUsage(): void {
  const lines = [
    'InjectField.ts — mutate a top-level key in a Markdown YAML frontmatter file.',
    '',
    'USAGE:',
    "  bun InjectField.ts --skill PATH --field KEY --value 'YAML' [--comment TEXT] [--overwrite]",
    '  bun InjectField.ts --batch --manifest PATH --field KEY [--overwrite]',
    '  bun InjectField.ts --help',
    '',
    'SINGLE MODE',
    '  --skill       absolute path to a .md file with YAML frontmatter',
    "  --field       the top-level key to insert or replace (e.g. 'roots')",
    "  --value       the YAML value as a string (e.g. '[PROJECT.WORK, PROTECTED_LOCAL]')",
    "  --comment     optional inline '# comment' appended after the value",
    '  --overwrite   replace existing key block (default: skip with notice)',
    '',
    'BATCH MODE',
    '  --batch       enables batch mode',
    '  --manifest    JSON file: array of {skill, value, comment?, overwrite?} entries',
    '  --field       the shared key applied to every manifest entry',
    "  --overwrite   default overwrite policy (per-entry 'overwrite' wins over this)",
    '',
    'EXIT CODES',
    '  0   success — inserted, replaced, or skipped (single) / all passed (batch)',
    '  1   refused (malformed input or args) / batch had any failure',
  ];
  console.log(lines.join('\n'));
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || Object.keys(args).length === 0) {
    printUsage();
    return 0;
  }

  if (!args.field) {
    console.error('error: --field is required');
    return 1;
  }

  const opts: InjectOptions = {
    overwrite: args.overwrite ?? false,
    comment: args.comment,
  };

  if (args.batch) {
    if (!args.manifest) {
      console.error('error: --batch requires --manifest PATH');
      return 1;
    }
    try {
      const { passed, failed } = await processBatch(args.manifest, args.field, opts);
      console.log(`\ntotal: ${passed} passed, ${failed} failed`);
      return failed === 0 ? 0 : 1;
    } catch (err: any) {
      console.error(`error: ${err?.message ?? String(err)}`);
      return 1;
    }
  }

  if (!args.skill || args.value === undefined) {
    console.error('error: single mode requires --skill PATH and --value YAML');
    return 1;
  }

  const result = injectField(args.skill, args.field, args.value, opts);
  const line = formatResultLine(result.ok ? result.action : 'refused', args.skill, result.reason);
  if (result.ok) {
    console.log(line);
    return 0;
  }
  console.error(line);
  return 1;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
