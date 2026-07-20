/**
 * emit — /discover's EMIT stage (PRD 20260530-225649): writes the rich selection record forge
 * Tier 0 consumes. Validator-GATED (D1): if the constraint-first task string fails, emit aborts and
 * writes NO folder (ISC-62, ANTI-12). Each of the five files is written via a .pending temp then
 * atomic rename (ISC-64, ANTI-13). Writes stay under the RESEARCH folder (ANTI-22); nothing touches
 * settings.json (ANTI-14). Concurrent same-name runs get distinct folders (ISC-65).
 */

import { existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { validateTaskString } from './task-string-validator';

export interface EmitInput {
  researchRoot: string;      // getMemorySubdir('RESEARCH') in production
  name: string;              // human feature name -> slug
  taskString: string;        // the validated constraint-first string
  brief?: string;
  lockedDecisions?: string;
  capabilitySelection?: string;
  buildOrder?: string;
  advisories?: string[];     // staleness etc. -> appended to locked-decisions.md
}

export interface EmitResult { ok: boolean; reason: string; folder: string | null; files: string[]; }

const FILES = ['brief.md', 'locked-decisions.md', 'capability-selection.md', 'build-order.md', 'task-string.md'] as const;

function slugify(name: string): string {
  const s = (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'feature';
}

export function emit(input: EmitInput): EmitResult {
  // Validator-gated before any write (ISC-62, ANTI-12): fail closed, emit nothing.
  const v = validateTaskString(input.taskString);
  if (!v.ok) return { ok: false, reason: `emit aborted (validator): ${v.reason}`, folder: null, files: [] };

  const ts = Date.now();
  const slug = slugify(input.name);
  let folder = join(input.researchRoot, `${ts}_${slug}`);
  for (let n = 2; existsSync(folder); n++) folder = join(input.researchRoot, `${ts}_${slug}-${n}`); // ISC-65
  mkdirSync(folder, { recursive: true });

  const locked = [
    input.lockedDecisions ?? '# Locked Decisions\n',
    ...(input.advisories?.length ? ['', '## Advisories', ...input.advisories.map((a) => `- ${a}`)] : []),
  ].join('\n');

  const content: Record<string, string> = {
    'brief.md': input.brief ?? '# Brief\n',
    'locked-decisions.md': locked,
    'capability-selection.md': input.capabilitySelection ?? '# Capability Selection\n',
    'build-order.md': input.buildOrder ?? '# Build Order\n',
    'task-string.md': input.taskString,
  };

  // Atomic .pending-then-rename (ISC-64, ANTI-13).
  for (const f of FILES) {
    const pending = join(folder, `${f}.pending`);
    // writeArtifact:exempt — atomic .pending-then-rename (ISC-64/ANTI-13); writeArtifact has no atomic-rename mode
    writeFileSync(pending, content[f]);
    renameSync(pending, join(folder, f));
  }

  return { ok: true, reason: 'emitted', folder, files: [...FILES] };
}
