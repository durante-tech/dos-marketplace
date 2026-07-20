#!/usr/bin/env bun
/// <reference types="node" />
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
/**
 * mine-historical-prds.ts — Backfill the MemPalace semantic index from
 * historical WORK PRDs (RFC-0027 §5.5.2 companion).
 *
 * The audit found that 237 PRD.md files in MEMORY/WORK/ were never indexed
 * by MemPalace because `mine_file` was never auto-fired on PRD writes. With
 * the §5.5.2 PRDSync wire landing alongside this tool, future PRDs land in
 * the index automatically — but the historical corpus needs a one-shot pass
 * to become searchable. This is that pass.
 *
 * USAGE:
 *   bun mine-historical-prds.ts --help
 *   bun mine-historical-prds.ts                   # default: --dry-run
 *   bun mine-historical-prds.ts --dry-run         # print what would mine
 *   bun mine-historical-prds.ts --apply           # actually call bridge.mine_file
 *   bun mine-historical-prds.ts --apply --rate 5  # custom rate (PRDs/sec)
 *
 * SAFETY:
 *   - Default mode is --dry-run (prevents accidental mass-mine)
 *   - Rate-limited at 10 PRDs/sec by default (R-5 from §9: lib's tested
 *     concurrent-write ceiling is unknown; 10/s is conservative)
 *   - Bridge `mine_file` takes NO mode parameter; re-run idempotency is
 *     delegated to add_drawer's deterministic dup-detection (keyed on
 *     source_file + content), not a 'mode' flag this tool passes.
 *   - Aborts on first 5 consecutive failures to avoid wedging the bridge
 *
 * DESIGN: this tool is byte-identical between live (~/.claude/DOS/Tools/)
 * and pack source (Packs/mem-palace/src/Tools/). It deliberately avoids
 * importing from hooks/lib so the same file ships to both copies. Bridge
 * invocation goes through execSync — same pattern as MemoryHygiene.ts.
 */

import { readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execFileSync } from 'child_process';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');
const BRIDGE_PATH = join(DOS_DIR, 'DOS', 'Tools', 'mempalace_bridge.py');
const MEMPALACE_PKG_SPEC = process.env.MEMPALACE_PKG_SPEC || 'mempalace>=3.4.1,<4';

interface CliOptions {
  apply: boolean;
  rate: number;       // PRDs per second
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { apply: false, rate: 10, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--apply') opts.apply = true;
    else if (a === '--dry-run') opts.apply = false;
    else if (a === '--rate') {
      const next = argv[++i];
      const n = Number(next);
      if (Number.isFinite(n) && n > 0 && n <= 100) opts.rate = n;
      else throw new Error(`--rate must be a positive number ≤ 100 (got: ${next})`);
    } else if (a.startsWith('--rate=')) {
      const n = Number(a.slice('--rate='.length));
      if (Number.isFinite(n) && n > 0 && n <= 100) opts.rate = n;
      else throw new Error(`--rate must be a positive number ≤ 100 (got: ${a})`);
    }
  }
  return opts;
}

function printHelp(): void {
  process.stdout.write(`mine-historical-prds.ts — backfill MemPalace from historical WORK PRDs

USAGE:
  bun mine-historical-prds.ts [--dry-run|--apply] [--rate N] [--help]

OPTIONS:
  --dry-run     (default) walk WORK/ and print what would be mined; no bridge calls
  --apply       call bridge.mine_file for each PRD (idempotent via add_drawer dedup)
  --rate N      PRDs per second (default 10, max 100). Lib's concurrent-write
                ceiling is unknown; the default is conservative.
  --help, -h    print this help

EXIT CODES:
  0  all PRDs processed (in --apply mode) or scan complete (dry-run)
  1  bridge unavailable, or aborted after 5 consecutive failures
  2  argv parse error

NOTES:
  - Walks MEMORY/WORK/ across project-eligible subdirs (resolver-aware).
  - Safe to re-run: mempalace's add_drawer dedupes chunks deterministically by
    (source_file, content); this tool passes no 'mode' flag (the bridge has none).
  - Output is one human line per PRD plus a summary at end.
`);
}

interface PrdEntry {
  workDir: string;     // root WORK/ dir this PRD belongs to
  dirName: string;     // YYYYMMDD-HHMMSS_slug
  prdPath: string;     // absolute path to PRD.md
}

/**
 * Discover candidate WORK directories. Mirrors getMemorySubdir resolution:
 *   1. CLAUDE_PROJECT_DIR/MEMORY/WORK   (if exists)
 *   2. process.cwd()/MEMORY/WORK         (if exists)
 *   3. ~/.claude/MEMORY/WORK             (always)
 * Plus a sweep of the canonical .dos-projects.json registry to pick up
 * cross-project WORK trees (mirrors the bridge's resolver). Reimplemented here
 * so this tool stays import-free against hooks/lib (see file-level DESIGN note).
 */
function discoverWorkDirs(): string[] {
  const dirs: string[] = [];
  const seen = new Set<string>();

  const tryPush = (p: string): void => {
    if (!seen.has(p) && existsSync(p)) {
      dirs.push(p);
      seen.add(p);
    }
  };

  // Global fallback first (always present)
  tryPush(join(DOS_DIR, 'MEMORY', 'WORK'));

  // CLAUDE_PROJECT_DIR
  const projectEnv = process.env.CLAUDE_PROJECT_DIR;
  if (projectEnv) {
    const expanded = projectEnv.replace(/^~(?=\/|$)/, homedir());
    tryPush(join(expanded, 'MEMORY', 'WORK'));
  }

  // cwd
  try {
    tryPush(join(process.cwd(), 'MEMORY', 'WORK'));
  } catch { /* cwd may not be accessible */ }

  // .dos-projects.json sweep — the CANONICAL project registry. reconcile
  // migrated off PROJECTS.md to this JSON (the old markdown table no longer
  // exists at DOS/USER/PROJECTS/PROJECTS.md), so the prior PROJECTS.md sweep
  // here was a dead no-op: it left every non-cwd project's PRDs unmined, which
  // is the root cause of 113 cross-project PRD orphans (2026-05-30). Probe
  // `Tools/.dos-projects.json` then `.dos-projects.json` walking cwd up to
  // $HOME, mirroring the bridge's registry resolver, and push each project's
  // <root_path>/MEMORY/WORK.
  try {
    const fs = require('fs') as any;
    const path = require('path') as any;
    const home = homedir();
    let dir = process.cwd();
    let registryPath: string | null = null;
    while (true) {
      for (const rel of ['Tools/.dos-projects.json', '.dos-projects.json']) {
        const candidate = join(dir, rel);
        if (existsSync(candidate)) { registryPath = candidate; break; }
      }
      if (registryPath || dir === home || dir === '/') break;
      const parent = path.resolve(join(dir, '..'));
      if (parent === dir) break;
      dir = parent;
    }
    if (registryPath) {
      const reg = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
      for (const proj of (reg.projects || [])) {
        const rawPath = proj && proj.root_path;
        if (!rawPath || typeof rawPath !== 'string') continue;
        const expanded = rawPath.replace(/^~(?=\/|$)/, homedir());
        tryPush(join(expanded, 'MEMORY', 'WORK'));
      }
    }
  } catch { /* non-critical */ }

  return dirs;
}

function discoverPrds(): PrdEntry[] {
  const workDirs = discoverWorkDirs();
  const prds: PrdEntry[] = [];
  const seen = new Set<string>();
  const isPrdDir = (name: string) => /^\d{8}-\d{6}_/.test(name);

  // Scan a base dir (the WORK root OR a WORK/active | WORK/archived bucket) for
  // PRD slug dirs. RFC-0037 §4.1 nests new PRDs under active/ — scanning only the
  // top level left them "unindexed" (the false-forever backlog warning).
  const scanBase = (workDir: string, baseDir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(baseDir, { withFileTypes: true })
        .filter((d: { isDirectory(): boolean; name: string }) => d.isDirectory() && isPrdDir(d.name))
        .map((d: { name: string }) => d.name)
        .sort();
    } catch {
      return;
    }
    for (const dirName of entries) {
      const prdPath = join(baseDir, dirName, 'PRD.md');
      if (!existsSync(prdPath)) continue;
      if (seen.has(prdPath)) continue;
      seen.add(prdPath);
      prds.push({ workDir, dirName, prdPath });
    }
  };

  for (const workDir of workDirs) {
    scanBase(workDir, workDir);                                   // legacy flat
    scanBase(workDir, join(workDir, 'active'));                   // RFC-0037 §4.1
    scanBase(workDir, join(workDir, 'archived'));
  }
  return prds;
}

interface MineResult {
  ok: boolean;
  data?: Record<string, unknown>;
  reason?: string;
}

/**
 * Invoke bridge.mine_file via uv. Mirrors the bridgeSync invocation pattern
 * (cmd = ['uv','run','--with', spec, 'python', BRIDGE_PATH, action, jsonArgs])
 * but stays self-contained — execSync, not Bun.spawnSync — so the tool runs
 * unmodified from both live and pack-source copies.
 */
function bridgeMineFile(absPath: string): MineResult {
  const args = JSON.stringify({ filepath: absPath });
  try {
    const stdout = execFileSync(
      'uv',
      ['run', '--quiet', '--with', MEMPALACE_PKG_SPEC, 'python', BRIDGE_PATH, 'mine_file', args],
      { encoding: 'utf-8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (!stdout.trim()) return { ok: false, reason: 'empty stdout' };
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stdout) as Record<string, unknown>;
    } catch (e) {
      return { ok: false, reason: `parse-error: ${e}` };
    }
    if (parsed.isError === true || parsed.status === 'error') {
      return { ok: false, reason: `bridge-error: ${parsed.message ?? parsed.error_type ?? 'unspecified'}` };
    }
    return { ok: true, data: parsed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `spawn-error: ${msg.slice(0, 200)}` };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function main(): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`[mine-historical-prds] arg error: ${(err as Error).message}\n`);
    return 2;
  }
  if (opts.help) {
    printHelp();
    return 0;
  }

  if (!existsSync(BRIDGE_PATH)) {
    process.stderr.write(`[mine-historical-prds] bridge not found at ${BRIDGE_PATH}\n`);
    return 1;
  }

  const prds = discoverPrds();
  if (prds.length === 0) {
    process.stdout.write('[mine-historical-prds] No PRDs discovered under any WORK/ tree.\n');
    return 0;
  }

  const mode = opts.apply ? 'APPLY' : 'DRY-RUN';
  process.stdout.write(
    `[mine-historical-prds] ${mode} — discovered ${prds.length} PRD(s) across ${new Set(prds.map((p) => p.workDir)).size} WORK tree(s); rate=${opts.rate}/s\n`
  );

  if (!opts.apply) {
    for (const p of prds.slice(0, 20)) {
      const sizeKb = Math.round(statSync(p.prdPath).size / 1024);
      process.stdout.write(`  would mine: ${p.dirName} (${sizeKb}KB)\n`);
    }
    if (prds.length > 20) {
      process.stdout.write(`  ... and ${prds.length - 20} more (pass --apply to mine all)\n`);
    }
    return 0;
  }

  const intervalMs = Math.ceil(1000 / opts.rate);
  let mined = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let aborted = false;

  for (let i = 0; i < prds.length; i++) {
    const prd = prds[i];
    const t0 = Date.now();
    const result = bridgeMineFile(prd.prdPath);
    if (result.ok) {
      mined++;
      consecutiveFailures = 0;
      const data = result.data as { chunks_added?: number; status?: string };
      const chunks = data.chunks_added !== undefined ? `${data.chunks_added} chunk(s)` : data.status ?? 'ok';
      process.stdout.write(`  [${i + 1}/${prds.length}] mined: ${prd.dirName} — ${chunks}\n`);
    } else {
      failed++;
      consecutiveFailures++;
      process.stdout.write(`  [${i + 1}/${prds.length}] FAIL: ${prd.dirName} — ${(result.reason ?? '').slice(0, 120)}\n`);
      if (consecutiveFailures >= 5) {
        process.stderr.write(
          `[mine-historical-prds] aborting: 5 consecutive failures (last reason: ${(result.reason ?? '').slice(0, 200)})\n`
        );
        aborted = true;
        break;
      }
    }
    const elapsed = Date.now() - t0;
    if (elapsed < intervalMs && i < prds.length - 1) {
      await sleep(intervalMs - elapsed);
    }
  }

  process.stdout.write(
    `\n[mine-historical-prds] DONE — mined ${mined}, failed ${failed}, total processed ${mined + failed}\n`
  );
  // MP-105: a consecutive-failure abort must surface as exit 1 even if some
  // earlier files mined, so cron/automation does not treat a wedged bridge as
  // a clean backfill (mirrors mine-historical-transcripts.ts).
  return aborted || (failed > 0 && mined === 0) ? 1 : 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  process.stderr.write(`[mine-historical-prds] fatal: ${err}\n`);
  process.exit(1);
});
