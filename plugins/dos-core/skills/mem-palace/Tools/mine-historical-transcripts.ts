#!/usr/bin/env bun
/// <reference types="node" />
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
/**
 * mine-historical-transcripts.ts — Backfill MemPalace from historical Claude
 * Code session transcripts at ~/.claude/projects/.
 *
 * Companion to mine-historical-prds.ts. MemoryHarvest.hook.ts harvests
 * NEW sessions at SessionEnd, but the historical corpus (647 JSONL files,
 * ~65 MB at audit time) was never mined. This tool runs the upstream
 * `mempalace mine --mode convos --extract general` recipe via the bridge's
 * `mine_convos` action, one project directory at a time.
 *
 * USAGE:
 *   bun mine-historical-transcripts.ts --help
 *   bun mine-historical-transcripts.ts                    # dry-run plan
 *   bun mine-historical-transcripts.ts --apply            # actually mine
 *   bun mine-historical-transcripts.ts --apply --limit 3  # only first 3 dirs
 *   bun mine-historical-transcripts.ts --apply --only durante   # one project
 *
 * SAFETY:
 *   - Default mode is --dry-run (prevents accidental mass-mine)
 *   - Mines one project dir at a time, sequentially (bridge serializes
 *     embeds; concurrent calls would just queue inside chromadb)
 *   - 1-second delay between dirs to let chromadb settle
 *   - extract_mode='general' classifies into 5 types (decisions, preferences,
 *     milestones, problems, emotional context) — upstream recipe
 *   - Idempotent: bridge.mine_convos uses deterministic chunk keys per
 *     (source_file, chunk_index), so re-runs dedupe automatically
 *   - Aborts on 3 consecutive bridge failures
 *
 * WING RESOLUTION:
 *   1. Decode path-encoded dir name (e.g. `-foo-bar-baz` → `/foo/bar/baz`)
 *   2. Match against PROJECTS.md entries via longest-prefix-of-encoded-path
 *   3. Use the matching entry's `wing` column
 *   4. Fallback: deriveWing(basename) if no PROJECTS.md match
 *   5. Worktree dirs (`*--claude-worktrees-agent-*`) inherit parent project wing
 */

import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');
const BRIDGE_PATH = join(DOS_DIR, 'DOS', 'Tools', 'mempalace_bridge.py');
const MEMPALACE_PKG_SPEC = process.env.MEMPALACE_PKG_SPEC || 'mempalace>=3.4.1,<4';
const PROJECTS_DIR = process.env.CLAUDE_PROJECTS_DIR || join(homedir(), '.claude', 'projects');

interface CliOptions {
  apply: boolean;
  help: boolean;
  limit: number;
  only?: string;
  dirDelayMs: number;
  extractMode: 'general' | 'exchange';
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    apply: false,
    help: false,
    limit: 0,
    dirDelayMs: 1000,
    extractMode: 'general',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--apply') opts.apply = true;
    else if (a === '--dry-run') opts.apply = false;
    else if (a === '--limit') opts.limit = Math.max(0, Number(argv[++i]) || 0);
    else if (a === '--only') opts.only = argv[++i];
    else if (a === '--delay-ms') opts.dirDelayMs = Math.max(0, Number(argv[++i]) || 1000);
    else if (a === '--extract') {
      const v = argv[++i];
      if (v === 'general' || v === 'exchange') opts.extractMode = v;
    }
  }
  return opts;
}

function printHelp(): void {
  console.error(`mine-historical-transcripts.ts — backfill MemPalace from ~/.claude/projects/

USAGE:
  bun mine-historical-transcripts.ts [--dry-run|--apply] [--limit N] [--only WING] [--extract general|exchange] [--delay-ms MS] [--help]

OPTIONS:
  --dry-run     (default) print the plan; no bridge calls
  --apply       call bridge.mine_convos for each project dir with extract_mode='general'
  --limit N     process only the first N dirs (in transcript-count order, descending)
  --only WING   process only the dir(s) mapping to this wing
  --extract     classification mode: 'general' (5-type) or 'exchange' (Q+A pairs). Default 'general'.
  --delay-ms    pause between dirs (default 1000ms — lets chromadb settle)
  --help, -h    print this help

WING RESOLUTION:
  Decodes the Claude Code path-encoded dir name (e.g. '-foo-bar-baz'
  → '/foo/bar/baz'), then matches against PROJECTS.md via
  longest-prefix lookup. Worktrees inherit parent project wing.

EXIT CODES:
  0  all dirs processed (or scan complete in dry-run)
  1  bridge unavailable, or aborted after 3 consecutive failures
  2  argv parse error
`);
}

interface DirSummary {
  dirName: string;
  fullPath: string;
  decodedPath: string;
  wing: string;
  resolution: 'projects-md' | 'derived' | 'fallback';
  jsonlCount: number;
  totalBytes: number;
}

function decodePath(dirName: string): string {
  // Claude Code encodes absolute paths by replacing `/` with `-` and
  // prefixing with `-`. So `-foo-bar-baz` ↔ `/foo/bar/baz`.
  // The encoding is lossy when the original path contains literal `-`, so
  // we use longest-prefix match against PROJECTS.md to disambiguate.
  if (!dirName.startsWith('-')) return '/' + dirName.replace(/-/g, '/');
  return '/' + dirName.slice(1).replace(/-/g, '/');
}

function stripWorktreeSuffix(dirName: string): string {
  return dirName.replace(/--claude-worktrees-agent-.*$/, '');
}

function encodePath(p: string): string {
  // /foo/bar/baz → -foo-bar-baz
  return p.replace(/\//g, '-');
}

interface ProjectEntry { project: string; path: string; wing: string }

/**
 * Inline PROJECTS.md reader. Mirrors the canonical hooks/lib/project-resolver.ts
 * loadProjects() but is self-contained so this tool stays byte-identical
 * across the four-copy install (no hooks/lib import path coupling).
 */
/**
 * MP-030: read the canonical .dos-projects.json registry (root_path + wing) and
 * map it to ProjectEntry[]. Probes Tools/.dos-projects.json then .dos-projects.json
 * walking cwd up to $HOME (mirrors the registry resolver in
 * mine-historical-prds.ts:147-172). The registry superseded PROJECTS.md.
 */
function loadProjectsFromRegistry(): ProjectEntry[] {
  try {
    const home = homedir();
    let dir = process.cwd();
    let registryPath: string | null = null;
    while (true) {
      for (const rel of ['Tools/.dos-projects.json', '.dos-projects.json']) {
        const candidate = join(dir, rel);
        if (existsSync(candidate)) { registryPath = candidate; break; }
      }
      if (registryPath || dir === home || dir === '/') break;
      const parent = join(dir, '..').replace(/\/[^/]+\/\.\.$/, '');
      if (parent === dir) break;
      dir = parent;
    }
    if (!registryPath) return [];
    const reg = JSON.parse(readFileSync(registryPath, 'utf-8'));
    const out: ProjectEntry[] = [];
    for (const proj of (reg.projects || [])) {
      const rawPath = proj && proj.root_path;
      if (!rawPath || typeof rawPath !== 'string') continue;
      const expanded = rawPath.replace(/^~(?=\/|$)/, homedir());
      const name = (proj.name || proj.slug || expanded) as string;
      const rawWing = proj.wing;
      const wing = (typeof rawWing === 'string' && rawWing.trim())
        ? rawWing.trim().toLowerCase()
        : deriveWingFromName(name);
      out.push({ project: name, path: expanded, wing });
    }
    return out;
  } catch {
    return [];
  }
}

/** MP-030: derive a wing slug from a project name (PROJECTS.md fallback parity). */
function deriveWingFromName(name: string): string {
  const cleaned = name.replace(/\s*\(.*?\)\s*/g, '').trim();
  const first = cleaned.split(/\s+/)[0] || name;
  return first.replace(/OS$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '') || first.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function loadProjectsInline(): ProjectEntry[] {
  // MP-030: reconcile migrated off the PROJECTS.md markdown table to the
  // canonical .dos-projects.json registry; the old table no longer exists at
  // DOS/USER/PROJECTS/PROJECTS.md, so the PROJECTS.md-only reader returned []
  // and EVERY transcript dir fell back to the fuzzy wing heuristic. Prefer the
  // JSON registry (mirrors mine-historical-prds.ts), keep PROJECTS.md as a
  // legacy fallback.
  const fromRegistry = loadProjectsFromRegistry();
  if (fromRegistry.length > 0) return fromRegistry;

  const path = join(DOS_DIR, 'DOS', 'USER', 'PROJECTS', 'PROJECTS.md');
  if (!existsSync(path)) {
    console.error('[mine-historical-transcripts] WARNING: 0 projects loaded (no .dos-projects.json registry and no PROJECTS.md) — ALL wings will be guessed via fuzzy fallback.');
    return [];
  }
  let content: string;
  try { content = readFileSync(path, 'utf-8'); } catch { return []; }
  const lines = content.split('\n');
  const headerIdx = lines.findIndex(l => /\|\s*Project\s*\|/.test(l));
  if (headerIdx === -1) return [];
  const headerCells = lines[headerIdx].split('|').map(c => c.trim()).filter(Boolean);
  const colIdx: Record<string, number> = {};
  headerCells.forEach((c, i) => { colIdx[c.toLowerCase()] = i; });
  const projectCol = colIdx['project'] ?? -1;
  const pathCol = colIdx['path'] ?? -1;
  const wingCol = colIdx['wing'] ?? -1;
  if (projectCol === -1 || pathCol === -1) return [];
  const expandTilde = (p: string) => p.startsWith('~') ? p.replace(/^~/, homedir()) : p;
  const deriveWing = (name: string) => {
    const cleaned = name.replace(/\s*\(.*?\)\s*/g, '').trim();
    const first = cleaned.split(/\s+/)[0] || name;
    return first.replace(/OS$/i, '').toLowerCase().replace(/[^a-z0-9-]/g, '') || first.toLowerCase().replace(/[^a-z0-9-]/g, '');
  };
  const entries: ProjectEntry[] = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || !line.startsWith('|')) continue;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    const project = cells[projectCol];
    const rawPath = cells[pathCol];
    if (!project || !rawPath || rawPath === '-') continue;
    const rawWing = wingCol !== -1 ? cells[wingCol] : undefined;
    const wing = rawWing && rawWing !== '-' ? rawWing.replace(/`/g, '').trim().toLowerCase() : deriveWing(project);
    entries.push({ project, path: expandTilde(rawPath), wing });
  }
  return entries;
}

function resolveWing(dirName: string, projects: ProjectEntry[]): { wing: string; resolution: DirSummary['resolution'] } {
  const stripped = stripWorktreeSuffix(dirName);

  // Try longest-prefix match against PROJECTS.md encoded paths
  let best: ProjectEntry | null = null;
  let bestLen = -1;
  for (const p of projects) {
    const enc = encodePath(p.path);
    if (stripped === enc || stripped.startsWith(enc + '-')) {
      if (enc.length > bestLen) {
        best = p;
        bestLen = enc.length;
      }
    }
  }
  if (best) return { wing: best.wing, resolution: 'projects-md' };

  // Fallback: strip path-prefix to Users/<name>/<workroot> and take the rest as wing.
  // E.g. [REDACTED:operator-project-slug] → [REDACTED:operator-client-slug] (not "us").
  const parts = stripped.split('-').filter(Boolean);
  const workrootMarkers = new Set(['Developer', 'Experiments', 'Github', 'Code', 'Personal', 'Projects', 'Repos', 'Work']);
  for (let i = 0; i < parts.length; i++) {
    if (workrootMarkers.has(parts[i]) && i + 1 < parts.length) {
      const w = parts.slice(i + 1).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (w) return { wing: w, resolution: 'fallback' };
    }
  }
  // No workroot marker found — last meaningful segment
  const last = parts.pop() || 'general';
  return { wing: last.toLowerCase().replace(/[^a-z0-9-]/g, ''), resolution: 'fallback' };
}

function summarizeDir(dirName: string, projects: ProjectEntry[]): DirSummary {
  const fullPath = join(PROJECTS_DIR, dirName);
  let jsonlCount = 0;
  let totalBytes = 0;
  try {
    for (const f of readdirSync(fullPath)) {
      if (!f.endsWith('.jsonl')) continue;
      const st = statSync(join(fullPath, f));
      jsonlCount++;
      totalBytes += st.size;
    }
  } catch { /* unreadable dir */ }

  const decodedPath = decodePath(stripWorktreeSuffix(dirName));
  const { wing, resolution } = resolveWing(dirName, projects);
  return { dirName, fullPath, decodedPath, wing, resolution, jsonlCount, totalBytes };
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(1)}MB`;
}

function mineDir(d: DirSummary, extractMode: 'general' | 'exchange'): { ok: boolean; output: string; durationMs: number } {
  const t0 = Date.now();
  const args = JSON.stringify({
    dir: d.fullPath,
    wing: d.wing,
    extract_mode: extractMode,
  }).replace(/'/g, "'\\''");

  try {
    // shell-safe: `args` is single-quote-escaped at construction (replace(/'/g, ...))
    const out = execSync(
      `uv run --quiet --with '${MEMPALACE_PKG_SPEC}' python "${BRIDGE_PATH}" mine_convos '${args}'`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 600_000 },
    );
    return { ok: true, output: out.trim(), durationMs: Date.now() - t0 };
  } catch (err: any) {
    const stderr = err?.stderr?.toString?.() || '';
    const stdout = err?.stdout?.toString?.() || '';
    return { ok: false, output: (stderr || stdout || String(err)).slice(0, 500), durationMs: Date.now() - t0 };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { printHelp(); return 0; }

  if (!existsSync(PROJECTS_DIR)) {
    console.error(`No transcripts dir at ${PROJECTS_DIR}`);
    return 1;
  }
  if (!existsSync(BRIDGE_PATH)) {
    console.error(`Bridge not found at ${BRIDGE_PATH}`);
    return 1;
  }

  const projects = loadProjectsInline();
  const subdirs = readdirSync(PROJECTS_DIR)
    .filter(name => {
      try { return statSync(join(PROJECTS_DIR, name)).isDirectory(); }
      catch { return false; }
    });

  let summaries = subdirs.map(name => summarizeDir(name, projects));
  // Skip empties and sort by transcript count (descending)
  summaries = summaries.filter(s => s.jsonlCount > 0)
    .sort((a, b) => b.jsonlCount - a.jsonlCount);

  if (opts.only) {
    summaries = summaries.filter(s => s.wing === opts.only);
    if (summaries.length === 0) {
      console.error(`No dirs map to wing="${opts.only}"`);
      return 0;
    }
  }
  if (opts.limit > 0) summaries = summaries.slice(0, opts.limit);

  // Plan summary
  const totalFiles = summaries.reduce((a, s) => a + s.jsonlCount, 0);
  const totalBytes = summaries.reduce((a, s) => a + s.totalBytes, 0);
  const wingsDistinct = new Set(summaries.map(s => s.wing)).size;

  console.log(`Plan: ${summaries.length} dirs, ${totalFiles} transcripts, ${fmtBytes(totalBytes)}, ${wingsDistinct} distinct wings`);
  console.log(`Mode: ${opts.apply ? '--apply (will mine)' : '--dry-run (no bridge calls)'} · extract=${opts.extractMode} · delay=${opts.dirDelayMs}ms`);
  console.log('');
  console.log('  files   bytes   wing                  resolution     dir');
  console.log('  -----   -----   --------------------  -------------  ' + '-'.repeat(50));
  for (const s of summaries) {
    console.log(`  ${String(s.jsonlCount).padStart(5)} ${fmtBytes(s.totalBytes).padStart(7)}   ${s.wing.padEnd(20)}  ${s.resolution.padEnd(13)}  ${s.dirName}`);
  }

  if (!opts.apply) {
    console.log('');
    console.log('Dry-run complete. Re-run with --apply to mine.');
    return 0;
  }

  // Apply
  console.log('');
  console.log('Mining…');
  let consecutiveFailures = 0;
  let mined = 0;
  let failed = 0;
  for (const s of summaries) {
    process.stdout.write(`  [${mined + failed + 1}/${summaries.length}] ${s.dirName} → wing="${s.wing}"… `);
    const r = mineDir(s, opts.extractMode);
    if (r.ok) {
      console.log(`OK (${r.durationMs}ms)`);
      mined++;
      consecutiveFailures = 0;
    } else {
      console.log(`FAIL (${r.durationMs}ms): ${r.output.slice(0, 160)}`);
      failed++;
      consecutiveFailures++;
      if (consecutiveFailures >= 3) {
        console.error('Aborted: 3 consecutive bridge failures.');
        return 1;
      }
    }
    if (mined + failed < summaries.length && opts.dirDelayMs > 0) {
      await sleep(opts.dirDelayMs);
    }
  }

  console.log('');
  console.log(`Done. ${mined} mined, ${failed} failed, of ${summaries.length} total.`);
  return failed > 0 ? 1 : 0;
}

const code = await main();
process.exit(code);
