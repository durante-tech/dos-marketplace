#!/usr/bin/env bun
/**
 * ValidateSyncMode.ts — PR3c Sentinel validator for syncMode SKILL.md frontmatter
 *
 * Scans every SKILL.md under ~/.claude/skills/ (or a provided root) and
 * validates the optional `syncMode` frontmatter field. Per
 * Plans/Specs/studio-sync-streaming.md §The Three Primitives §3:
 *
 *   syncMode: stream | batch | disabled
 *
 *   stream   — events flow through PostToolUse + streamEvent (only valid
 *              for the 7 streaming-eligible categories)
 *   batch    — events stay in iter-1 SessionEnd path (default for the 9
 *              batch-only tools)
 *   disabled — tool writes locally but nothing syncs (NAS / external-drive
 *              escape hatch)
 *
 * Rules enforced:
 *   - If `syncMode` present, value must be one of {stream, batch, disabled}.
 *   - Missing `syncMode` is treated as batch (implicit default); reported
 *     but not a failure.
 *
 * Usage:
 *   bun Tools/ValidateSyncMode.ts                       # default root
 *   bun Tools/ValidateSyncMode.ts --root <dir>          # override
 *   bun Tools/ValidateSyncMode.ts --json                # machine-readable
 *
 * Exit codes:
 *   0  — all declared syncMode values are valid
 *   1  — at least one SKILL.md has an invalid value
 *   2  — invalid arguments / no skills found
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const VALID_VALUES = new Set<string>(['stream', 'batch', 'disabled']);

interface SkillReport {
  skill: string;
  path: string;
  syncMode: string | null;
  valid: boolean;
  reason?: string;
}

interface Args {
  root: string;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  let root = join(homedir(), '.claude', 'skills');
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--root' && argv[i + 1]) {
      root = argv[i + 1]!;
      i += 1;
    }
  }
  return { root, json };
}

function findSkillFiles(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const walk = (dir: string, depth: number): void => {
    if (depth > 4) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name.startsWith('.') || name === 'node_modules') continue;
      const full = join(dir, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full, depth + 1);
        } else if (name === 'SKILL.md') {
          out.push(full);
        }
      } catch { /* skip */ }
    }
  };
  walk(root, 0);
  return out;
}

function extractFrontmatter(md: string): Record<string, string> | null {
  if (!md.startsWith('---')) return null;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = md.slice(4, end);
  const fm: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) fm[key] = val;
  }
  return fm;
}

function validateSkillFile(path: string): SkillReport {
  const skill = path.replace(/^.*\/skills\//, '').replace(/\/SKILL\.md$/, '');
  const report: SkillReport = {
    skill,
    path,
    syncMode: null,
    valid: true,
  };
  let md: string;
  try {
    md = readFileSync(path, 'utf-8');
  } catch (err) {
    report.valid = false;
    report.reason = `read failed: ${err instanceof Error ? err.message : String(err)}`;
    return report;
  }
  const fm = extractFrontmatter(md);
  if (!fm) return report; // no frontmatter → OK (implicit batch)
  const mode = fm.syncMode;
  if (!mode) return report; // not declared → OK (implicit batch)
  report.syncMode = mode;
  if (!VALID_VALUES.has(mode)) {
    report.valid = false;
    report.reason = `invalid syncMode value '${mode}'; expected one of stream|batch|disabled`;
  }
  return report;
}

function main(): number {
  const { root, json } = parseArgs(process.argv.slice(2));
  const files = findSkillFiles(root);
  if (files.length === 0) {
    console.error(`ValidateSyncMode: no SKILL.md files found under ${root}`);
    return 2;
  }
  const reports = files.map(validateSkillFile);
  const invalid = reports.filter((r) => !r.valid);
  const declared = reports.filter((r) => r.syncMode !== null);
  const byMode: Record<string, number> = { stream: 0, batch: 0, disabled: 0 };
  for (const r of declared) {
    if (r.syncMode && r.valid) byMode[r.syncMode] = (byMode[r.syncMode] ?? 0) + 1;
  }

  if (json) {
    console.log(JSON.stringify({
      root,
      totalSkills: reports.length,
      declared: declared.length,
      implicitBatch: reports.length - declared.length,
      byMode,
      invalid,
      ok: invalid.length === 0,
    }, null, 2));
  } else {
    console.log(`ValidateSyncMode — scanned ${reports.length} SKILL.md file(s) under ${root}\n`);
    console.log(`  declared syncMode:    ${declared.length}`);
    console.log(`  implicit (batch):     ${reports.length - declared.length}`);
    console.log(`  by mode:              stream=${byMode.stream}  batch=${byMode.batch}  disabled=${byMode.disabled}`);
    if (invalid.length > 0) {
      console.error(`\nFAIL: ${invalid.length} skill(s) have invalid syncMode values:`);
      for (const r of invalid) {
        console.error(`  - ${r.skill}: ${r.reason}`);
      }
    } else {
      console.log('\nPASS: every declared syncMode value is valid.');
    }
  }
  return invalid.length === 0 ? 0 : 1;
}

process.exit(main());
