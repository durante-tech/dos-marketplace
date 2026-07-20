#!/usr/bin/env bun
/**
 * golden-snapshot — V13.1 prerequisite (Feathers + KentBeck pin-down before
 * transform). Walks every PRD on disk, parses it via @durante/prd, and
 * serializes canonical structural data to a JSON snapshot. Diff-mode compares
 * subsequent re-runs against the snapshot — any drift indicates a
 * characterization gap that must be resolved before the V13.1 bulk-migration
 * tool may write.
 *
 * Pre-condition discipline (RFC-0080 §migration grammar): bulk migration of
 * 120+ historical PRDs is only safe when "what the parser observes today" is
 * frozen as evidence. Re-parse after migration must match this snapshot for
 * every PRD whose semantics did not change — divergence is a smoking gun for
 * unintended migration side-effects.
 *
 * USAGE:
 *   bun golden-snapshot.ts capture            write snapshot.json (overwrite)
 *   bun golden-snapshot.ts capture --output=<path>
 *   bun golden-snapshot.ts diff               compare current vs snapshot.json
 *   bun golden-snapshot.ts diff --snapshot=<path>
 *   bun golden-snapshot.ts list               list snapshot contents (no compare)
 *   bun golden-snapshot.ts --help             this message
 *
 * Exit codes (diff mode):
 *   0   no drift
 *   1   drift detected
 *   2   error (snapshot missing, parser error, etc.)
 *
 * AUTHORITY: snapshot is operator-local evidence. Default path is
 * MEMORY/STATE/prd-golden-snapshot.json (project-first via getMemorySubdir
 * fallback chain).
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import {
  parsePRDContent,
  detectFormatVersion,
  type FormatVersionDetection,
} from '../Parser/index.ts';

interface SnapshotEntry {
  path: string;
  format_version: 2 | 3 | null;
  format_version_status: FormatVersionDetection['status'];
  frontmatter_keys: string[];
  frontmatter_hash: string;
  section_headers: string[];
  section_order_class: string;
  criteria_count: number;
  positive_isc_ids: string[];
  anti_isc_ids: string[];
  body_byte_length: number;
  parser_errors: string[];
}

interface Snapshot {
  schema_version: 1;
  captured_at: string;
  prd_count: number;
  entries: SnapshotEntry[];
}

function resolveWorkDir(): string {
  // Project-first resolution per CLAUDE.md getMemorySubdir convention.
  const cwd = process.cwd();
  const candidates = [
    join(process.env.CLAUDE_PROJECT_DIR ?? '', 'MEMORY', 'WORK'),
    join(cwd, 'MEMORY', 'WORK'),
    join(homedir(), '.claude', 'MEMORY', 'WORK'),
    join(homedir(), 'Durante', 'MEMORY', 'WORK'),
  ];
  for (const c of candidates) {
    if (c && existsSync(c)) return resolve(c);
  }
  throw new Error('No MEMORY/WORK directory found — set CLAUDE_PROJECT_DIR or cd into a DOS-shaped repo');
}

function resolveDefaultSnapshotPath(workDir: string): string {
  const stateDir = join(dirname(workDir), 'STATE');
  return join(stateDir, 'prd-golden-snapshot.json');
}

function listPrdPaths(workDir: string): string[] {
  const out: string[] = [];
  for (const layer of ['active', 'archived', '']) {
    const base = layer ? join(workDir, layer) : workDir;
    if (!existsSync(base)) continue;
    try {
      for (const dir of readdirSync(base)) {
        const prd = join(base, dir, 'PRD.md');
        try {
          if (statSync(prd).isFile()) out.push(prd);
        } catch {}
      }
    } catch {}
  }
  // Stable sort for reproducible snapshots.
  return [...new Set(out)].sort();
}

function djb2(s: string): string {
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

function captureEntry(path: string): SnapshotEntry {
  const content = readFileSync(path, 'utf-8');
  const versionInfo = detectFormatVersion(content);
  const errors: string[] = [];

  let formatVersion: 2 | 3 | null = null;
  let frontmatterKeys: string[] = [];
  let frontmatterHash = '';
  let sectionHeaders: string[] = [];
  let sectionOrderClass = 'unknown';
  let criteriaCount = 0;
  let positiveIscIds: string[] = [];
  let antiIscIds: string[] = [];

  if (versionInfo.status === 'invalid') {
    errors.push(`format_version invalid: ${JSON.stringify(versionInfo.raw)}`);
  } else {
    try {
      const doc = parsePRDContent(content);
      formatVersion = doc.formatVersion;
      frontmatterKeys = Object.keys(doc.frontmatter).sort();
      // Stable canonical serialization of frontmatter (sorted keys).
      const fmCanonical = frontmatterKeys.map(k => `${k}=${(doc.frontmatter as Record<string, unknown>)[k]}`).join('\n');
      frontmatterHash = djb2(fmCanonical);
      sectionHeaders = doc.sections.map(s => s.heading);
      sectionOrderClass = doc.sections.length > 0 ? 'ordered' : 'empty';
      criteriaCount = doc.criteria.length;
      positiveIscIds = doc.criteria.filter(c => /^ISC-\d/.test(c.id)).map(c => c.id);
      // Match criteria.ts's own anti rule (`/^ISC-A/i`) so the pack's own
      // ISC-ANTI-N output (prd-isc-fanout.workflow.js), ISC-A-1, and ISC-A1 all
      // land in the anti bucket consistently. `/^ISC-A-?\d/` missed ISC-ANTI-N
      // because it required a digit immediately after `ISC-A`/`ISC-A-`.
      antiIscIds = doc.criteria.filter(c => /^ISC-A/i.test(c.id)).map(c => c.id);
    } catch (e) {
      errors.push(`parse error: ${(e as Error).message}`);
    }
  }

  return {
    path,
    format_version: formatVersion,
    format_version_status: versionInfo.status,
    frontmatter_keys: frontmatterKeys,
    frontmatter_hash: frontmatterHash,
    section_headers: sectionHeaders,
    section_order_class: sectionOrderClass,
    criteria_count: criteriaCount,
    positive_isc_ids: positiveIscIds,
    anti_isc_ids: antiIscIds,
    body_byte_length: content.length,
    parser_errors: errors,
  };
}

export function captureSnapshot(workDir?: string): Snapshot {
  const dir = workDir ?? resolveWorkDir();
  const prds = listPrdPaths(dir);
  const entries = prds.map(captureEntry);
  return {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    prd_count: entries.length,
    entries,
  };
}

interface DriftReport {
  added: string[];
  removed: string[];
  changed: Array<{ path: string; fields: string[] }>;
}

export function diffSnapshots(prev: Snapshot, curr: Snapshot): DriftReport {
  const prevByPath = new Map(prev.entries.map(e => [e.path, e]));
  const currByPath = new Map(curr.entries.map(e => [e.path, e]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: Array<{ path: string; fields: string[] }> = [];

  for (const path of currByPath.keys()) if (!prevByPath.has(path)) added.push(path);
  for (const path of prevByPath.keys()) if (!currByPath.has(path)) removed.push(path);

  for (const [path, currEntry] of currByPath) {
    const prevEntry = prevByPath.get(path);
    if (!prevEntry) continue;
    const fields: string[] = [];
    if (prevEntry.format_version !== currEntry.format_version) fields.push('format_version');
    if (prevEntry.format_version_status !== currEntry.format_version_status) fields.push('format_version_status');
    if (prevEntry.frontmatter_hash !== currEntry.frontmatter_hash) fields.push('frontmatter');
    if (JSON.stringify(prevEntry.section_headers) !== JSON.stringify(currEntry.section_headers)) fields.push('section_headers');
    if (prevEntry.criteria_count !== currEntry.criteria_count) fields.push('criteria_count');
    if (JSON.stringify(prevEntry.positive_isc_ids) !== JSON.stringify(currEntry.positive_isc_ids)) fields.push('positive_isc_ids');
    if (JSON.stringify(prevEntry.anti_isc_ids) !== JSON.stringify(currEntry.anti_isc_ids)) fields.push('anti_isc_ids');
    if (JSON.stringify(prevEntry.parser_errors) !== JSON.stringify(currEntry.parser_errors)) fields.push('parser_errors');
    if (fields.length > 0) changed.push({ path, fields });
  }

  return { added, removed, changed };
}

function writeSnapshot(snapshot: Snapshot, path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  // writeArtifact:exempt — Tool CLI writes a golden snapshot JSON at an operator-supplied path (not a skill artifact)
  writeFileSync(path, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
}

function readSnapshot(path: string): Snapshot {
  if (!existsSync(path)) {
    throw new Error(`snapshot not found: ${path} — run 'capture' first`);
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as Snapshot;
}

function parseFlag(args: string[], flag: string): string | undefined {
  const idx = args.findIndex(a => a === flag || a.startsWith(`${flag}=`));
  if (idx < 0) return undefined;
  const arg = args[idx];
  if (arg.includes('=')) return arg.split('=', 2)[1];
  return args[idx + 1];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(
`golden-snapshot — V13.1 characterization harness (RFC-0080 §migration)

USAGE:
  bun golden-snapshot.ts capture [--output=<path>]
  bun golden-snapshot.ts diff [--snapshot=<path>]
  bun golden-snapshot.ts list [--snapshot=<path>]
  bun golden-snapshot.ts --help

Default snapshot path: <project>/MEMORY/STATE/prd-golden-snapshot.json`,
    );
    process.exit(0);
  }

  const subcommand = args[0];
  const workDir = resolveWorkDir();
  const defaultSnapshotPath = resolveDefaultSnapshotPath(workDir);

  if (subcommand === 'capture') {
    const outPath = parseFlag(args, '--output') ?? defaultSnapshotPath;
    const snapshot = captureSnapshot(workDir);
    writeSnapshot(snapshot, outPath);
    console.log(`captured ${snapshot.prd_count} PRDs → ${outPath}`);
    const parseErrors = snapshot.entries.filter(e => e.parser_errors.length > 0);
    if (parseErrors.length > 0) {
      console.log(`  ${parseErrors.length} PRDs had parser errors (recorded in snapshot)`);
    }
    process.exit(0);
  }

  if (subcommand === 'diff') {
    const snapshotPath = parseFlag(args, '--snapshot') ?? defaultSnapshotPath;
    const prev = readSnapshot(snapshotPath);
    const curr = captureSnapshot(workDir);
    const drift = diffSnapshots(prev, curr);
    const totalDrift = drift.added.length + drift.removed.length + drift.changed.length;
    if (totalDrift === 0) {
      console.log(`no drift (${curr.prd_count} PRDs vs snapshot @ ${prev.captured_at})`);
      process.exit(0);
    }
    console.log(`drift detected: ${drift.added.length} added, ${drift.removed.length} removed, ${drift.changed.length} changed`);
    for (const p of drift.added.slice(0, 5)) console.log(`  + ${p}`);
    for (const p of drift.removed.slice(0, 5)) console.log(`  - ${p}`);
    for (const c of drift.changed.slice(0, 10)) console.log(`  ~ ${c.path} [${c.fields.join(', ')}]`);
    if (totalDrift > 20) console.log(`  ... (truncated; ${totalDrift - 20} more)`);
    process.exit(1);
  }

  if (subcommand === 'list') {
    const snapshotPath = parseFlag(args, '--snapshot') ?? defaultSnapshotPath;
    const snapshot = readSnapshot(snapshotPath);
    console.log(`snapshot @ ${snapshot.captured_at} (${snapshot.prd_count} PRDs)`);
    const byVersion: Record<string, number> = {};
    for (const e of snapshot.entries) {
      const key = e.format_version === null ? `error/${e.format_version_status}` : `v${e.format_version}`;
      byVersion[key] = (byVersion[key] ?? 0) + 1;
    }
    for (const [k, n] of Object.entries(byVersion)) console.log(`  ${k}: ${n}`);
    process.exit(0);
  }

  console.error(`unknown subcommand: ${subcommand}`);
  process.exit(2);
}

if (import.meta.main) {
  await main();
}
