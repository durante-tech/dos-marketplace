#!/usr/bin/env bun
/**
 * bulk-migrate — V13.1 bulk PRD migration tool (RFC-0080 §migration grammar).
 *
 * Walks every v2.1 PRD in MEMORY/WORK/, runs `migrateV2toV3` from
 * @durante/prd/Migrate, and writes the migrated content back. Default mode
 * is dry-run: captures a golden-snapshot diff so the operator can review
 * before committing. `--apply` actually writes the migrated content.
 *
 * Pre-condition discipline (Feathers + KentBeck pin-down-before-transform):
 *   1. Capture pre-snapshot via `golden-snapshot capture` BEFORE running this tool
 *   2. Run this tool in dry-run, review the diff
 *   3. Run with --apply
 *   4. Capture post-snapshot
 *   5. Diff: every PRD shifted from format_version=2 → 3 (or recorded in
 *      RFC-0088 residual archive)
 *
 * USAGE:
 *   bun bulk-migrate.ts                      (dry-run: show what would change)
 *   bun bulk-migrate.ts --apply              (actually write migrated content)
 *   bun bulk-migrate.ts --json               (machine-readable per-PRD result)
 *   bun bulk-migrate.ts --filter=<regex>     (only PRDs whose path matches)
 *   bun bulk-migrate.ts --help
 *
 * EXIT CODES:
 *   0 — migration completed (dry-run OR apply); zero unrecoverable errors
 *   1 — at least one PRD failed to migrate (per-PRD details in output)
 *   2 — preflight error (corpus missing, parser unavailable)
 *
 * AUTHORITY: read-only by default. `--apply` writes back to MEMORY/WORK/ in
 * place. Operator MUST run snapshot capture BEFORE --apply for rollback
 * safety. The tool does NOT auto-commit.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { detectFormatVersion } from '../Parser/index.ts';
import { migrateV2toV3, type MigrationWarning } from '../Migrate/v2_to_v3.ts';

interface PrdResult {
  path: string;
  status: 'migrated' | 'skipped-already-v3' | 'skipped-invalid' | 'error';
  fromVersion: 2 | 3 | null;
  toVersion: 2 | 3 | null;
  bytesBefore: number;
  bytesAfter: number;
  warnings: MigrationWarning[];
  error?: string;
}

interface RunReport {
  mode: 'dry-run' | 'apply';
  started_at: string;
  finished_at: string;
  prd_count: number;
  migrated: number;
  skipped: number;
  errors: number;
  results: PrdResult[];
}

function resolveWorkDir(): string {
  const cwd = process.cwd();
  const candidates = [
    join(process.env.CLAUDE_PROJECT_DIR ?? '', 'MEMORY', 'WORK'),
    join(cwd, 'MEMORY', 'WORK'),
    join(homedir(), 'Durante', 'MEMORY', 'WORK'),
  ];
  for (const c of candidates) if (c && existsSync(c)) return c;
  throw new Error('No MEMORY/WORK directory found');
}

function listPrdPaths(workDir: string): string[] {
  const out: string[] = [];
  for (const layer of ['active', 'archived', '']) {
    const base = layer ? join(workDir, layer) : workDir;
    if (!existsSync(base)) continue;
    try {
      for (const dir of readdirSync(base)) {
        const prd = join(base, dir, 'PRD.md');
        try { if (statSync(prd).isFile()) out.push(prd); } catch {}
      }
    } catch {}
  }
  return [...new Set(out)].sort();
}

function migrateOne(path: string, apply: boolean): PrdResult {
  let content: string;
  try { content = readFileSync(path, 'utf-8'); } catch (e) {
    return { path, status: 'error', fromVersion: null, toVersion: null, bytesBefore: 0, bytesAfter: 0, warnings: [], error: `read: ${(e as Error).message}` };
  }
  const bytesBefore = content.length;
  const version = detectFormatVersion(content);
  if (version.status === 'invalid') {
    return { path, status: 'skipped-invalid', fromVersion: null, toVersion: null, bytesBefore, bytesAfter: bytesBefore, warnings: [{ code: 'invalid-format-version', message: `raw=${JSON.stringify(version.raw)}` }] };
  }
  if (version.version === 3) {
    return { path, status: 'skipped-already-v3', fromVersion: 3, toVersion: 3, bytesBefore, bytesAfter: bytesBefore, warnings: [] };
  }
  // v2 → v3 migration
  try {
    const { content: migrated, warnings } = migrateV2toV3(content);
    // No-op guard: writeFrontmatterField returns content unchanged when there
    // is no `---` frontmatter block (or the target field is a block-list).
    // A byte-identical result means format_version was NOT stamped, so this is
    // not a real migration — report it as an error rather than false success.
    if (migrated === content) {
      return {
        path,
        status: 'error',
        fromVersion: 2,
        toVersion: 2,
        bytesBefore,
        bytesAfter: bytesBefore,
        warnings,
        error: 'no frontmatter block — format_version not stamped (manual migration required)',
      };
    }
    if (apply) {
      // writeArtifact:exempt — Tool CLI rewrites the PRD file in place at an operator-supplied path (in-place migration, not a skill artifact)
      try { writeFileSync(path, migrated, 'utf-8'); } catch (e) {
        return { path, status: 'error', fromVersion: 2, toVersion: 2, bytesBefore, bytesAfter: bytesBefore, warnings, error: `write: ${(e as Error).message}` };
      }
    }
    return {
      path,
      status: 'migrated',
      fromVersion: 2,
      toVersion: 3,
      bytesBefore,
      bytesAfter: migrated.length,
      warnings,
    };
  } catch (e) {
    return { path, status: 'error', fromVersion: 2, toVersion: null, bytesBefore, bytesAfter: bytesBefore, warnings: [], error: `migrate: ${(e as Error).message}` };
  }
}

function runMigration(apply: boolean, filter?: RegExp): RunReport {
  const startedAt = new Date().toISOString();
  const workDir = resolveWorkDir();
  let prds = listPrdPaths(workDir);
  if (filter) prds = prds.filter(p => filter.test(p));
  const results = prds.map(p => migrateOne(p, apply));
  const finishedAt = new Date().toISOString();
  return {
    mode: apply ? 'apply' : 'dry-run',
    started_at: startedAt,
    finished_at: finishedAt,
    prd_count: prds.length,
    migrated: results.filter(r => r.status === 'migrated').length,
    skipped: results.filter(r => r.status === 'skipped-already-v3' || r.status === 'skipped-invalid').length,
    errors: results.filter(r => r.status === 'error').length,
    results,
  };
}

function renderHuman(report: RunReport): string {
  const lines: string[] = [];
  lines.push(`bulk-migrate v0.0.13 V13.1 — mode: ${report.mode}`);
  lines.push(`window: ${report.started_at} → ${report.finished_at}`);
  lines.push('─'.repeat(72));
  lines.push(`scanned: ${report.prd_count}`);
  lines.push(`migrated: ${report.migrated} (${report.mode === 'dry-run' ? 'WOULD-WRITE; rerun with --apply' : 'WRITTEN to disk'})`);
  lines.push(`skipped (already v3): ${report.results.filter(r => r.status === 'skipped-already-v3').length}`);
  lines.push(`skipped (invalid version): ${report.results.filter(r => r.status === 'skipped-invalid').length}`);
  lines.push(`errors: ${report.errors}`);
  lines.push('─'.repeat(72));
  const migrated = report.results.filter(r => r.status === 'migrated').slice(0, 10);
  if (migrated.length > 0) {
    lines.push('first 10 migrated paths (preview):');
    for (const r of migrated) {
      const sigil = report.mode === 'apply' ? '✓' : '→';
      const Δ = r.bytesAfter - r.bytesBefore;
      lines.push(`  ${sigil} ${r.path}  (Δ ${Δ >= 0 ? '+' : ''}${Δ} bytes)`);
    }
  }
  const errors = report.results.filter(r => r.status === 'error');
  if (errors.length > 0) {
    lines.push('errors:');
    for (const r of errors.slice(0, 10)) lines.push(`  ✗ ${r.path} — ${r.error}`);
  }
  // Loud partial-migration banner: migrateV2toV3 only stamps format_version:3;
  // the v2 body (## Context split, ## Constraints rename) is NOT transformed
  // until the V12.4 migrate-to-vnext workflow ships (RFC-0080 §5.1). Surface it
  // so an operator never reads "migrated" as a clean v3 body.
  const partial = report.results.filter(
    r => r.status === 'migrated' && r.warnings.some(w => w.code === 'migrate-v2-to-v3-partial'),
  );
  if (partial.length > 0) {
    lines.push('─'.repeat(72));
    lines.push(`⚠ PARTIAL MIGRATION: ${partial.length} PRD(s) had format_version stamped to 3 but the v2 body was NOT transformed.`);
    lines.push('  Body migration (## Context split, ## Constraints rename) ships in the V12.4 migrate-to-vnext workflow (RFC-0080 §5.1).');
    lines.push('  These PRDs carry format_version:3 with a v2-shaped body until then.');
  }
  return lines.join('\n');
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
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`bulk-migrate — V13.1 bulk PRD migration tool

USAGE:
  bun bulk-migrate.ts                    (dry-run)
  bun bulk-migrate.ts --apply            (write migrated content)
  bun bulk-migrate.ts --json             (machine-readable)
  bun bulk-migrate.ts --filter=<regex>   (only PRDs whose path matches)

PRE-CONDITION: capture golden-snapshot BEFORE --apply.
  bun ~/Durante/Packs/prd/src/Tools/golden-snapshot.ts capture
  bun bulk-migrate.ts                    # dry-run review
  bun bulk-migrate.ts --apply
  bun ~/Durante/Packs/prd/src/Tools/golden-snapshot.ts diff   # validate post-state

The migrator runs @durante/prd/Migrate.migrateV2toV3 per PRD; V12.2 only
stamps format_version: 3 (partial). Full body migration ships in V12.4
MigrateToVNext workflow per RFC-0080 §5.1 grammar.`);
    process.exit(0);
  }
  const apply = args.includes('--apply');
  const wantJson = args.includes('--json');
  const filterStr = parseFlag(args, '--filter');
  const filter = filterStr ? new RegExp(filterStr) : undefined;
  let report: RunReport;
  try { report = runMigration(apply, filter); } catch (e) {
    console.error((e as Error).message);
    process.exit(2);
  }
  if (wantJson) console.log(JSON.stringify(report, null, 2));
  else console.log(renderHuman(report));
  process.exit(report.errors > 0 ? 1 : 0);
}

if (import.meta.main) {
  await main();
}
