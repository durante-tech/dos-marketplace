#!/usr/bin/env bun
/**
 * RenderArchetype — projects a typed archetype into a markdown matrix
 * (schema-first: the TS module is the source, this output is the projection).
 *
 * Usage:
 *   bun RenderArchetype.ts media-asset-library           # markdown to stdout
 *   bun RenderArchetype.ts media-asset-library --out FILE
 *   bun RenderArchetype.ts --list                        # list archetype names
 *   bun RenderArchetype.ts --all                         # render every archetype in one process
 *                                                        # (per-name OK/FAIL status lines, no markdown output)
 *
 * Exit codes: 0 = rendered, 2 = not found / load error / empty corpus with --all.
 * Zero external deps by design.
 */
import { writeFileSync } from 'node:fs';
import type { Archetype, ArchetypeRow } from '../Schema/Archetype';
import { loadCorpus } from './LoadCorpus';

/** Escape pipes so free-text fields cannot split markdown table columns. */
function cell(s: string): string {
  return s.replace(/\|/g, '\\|');
}

function evidenceCell(row: ArchetypeRow): string {
  if (row.evidence.length === 0) {
    return row.contextRider ? `context rider: ${row.contextRider}` : '—';
  }
  return row.evidence
    .map((e) => `${e.shipping}/${e.of} ${e.cohort}${e.note ? ` (${e.note})` : ''}`)
    .join('; ');
}

function render(a: Archetype): string {
  const lines: string[] = [];
  lines.push(`# ${a.title} — Archetype Matrix v${a.version}`);
  lines.push('');
  lines.push(`_Generated projection — source of truth is \`Data/\` (updated ${a.updated}). Do not edit by hand._`);
  lines.push('');
  lines.push('## Tiers');
  lines.push('');
  for (const [tier, def] of Object.entries(a.tierDefinitions)) {
    lines.push(`- **${tier}** — ${def}`);
  }
  lines.push('');
  lines.push('## Cohorts');
  lines.push('');
  for (const c of a.cohorts) {
    lines.push(`- **${c.id}** (${c.label}): ${c.references.join(', ')}`);
  }
  const dims = [...new Set(a.rows.map((r) => r.dimension))];
  for (const dim of dims) {
    lines.push('');
    lines.push(`## ${dim}`);
    lines.push('');
    lines.push('| id | Capability | Tier | Market grounding | Seed ISC |');
    lines.push('|---|---|---|---|---|');
    for (const row of a.rows.filter((r) => r.dimension === dim)) {
      const cap = row.notes ? `${cell(row.capability)} †` : cell(row.capability);
      lines.push(`| \`${row.id}\` | ${cap} | ${row.tier} | ${cell(evidenceCell(row))} | ${cell(row.seedISC)} |`);
    }
    const noted = a.rows.filter((r) => r.dimension === dim && r.notes);
    for (const row of noted) lines.push(`\n† \`${row.id}\`: ${row.notes}`);
  }
  lines.push('');
  lines.push('## Anti-criteria (ISC-A seeds)');
  lines.push('');
  lines.push('| id | Rule | Why |');
  lines.push('|---|---|---|');
  for (const anti of a.antiCriteria) {
    lines.push(`| \`${anti.id}\` | ${cell(anti.rule)} | ${cell(anti.why)} |`);
  }
  if (a.sources?.length) {
    lines.push('');
    lines.push('## Sources');
    lines.push('');
    for (const s of a.sources) lines.push(`- ${s}`);
  }
  lines.push('');
  return lines.join('\n');
}

const args = process.argv.slice(2);
const archetypes = await loadCorpus().catch((err) => {
  console.error(`load error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});

if (args.includes('--list')) {
  for (const a of archetypes) console.log(`${a.name}\tv${a.version}\t${a.rows.length} rows`);
  process.exit(0);
}

// Batch mode (archer gen-14, operator-approved kernel change): render every
// archetype in THIS process — corpus-regression previously paid one bun spawn
// per archetype plus one for --list. Exercises the full render path; emits
// status lines instead of markdown. Empty corpus stays RED (exit 2).
if (args.includes('--all')) {
  if (archetypes.length === 0) {
    console.error('no Data/*.archetype.ts files found');
    process.exit(2);
  }
  let fail = 0;
  for (const a of archetypes) {
    try {
      render(a);
      console.log(`OK   render ${a.name}`);
    } catch (err) {
      console.log(`FAIL render ${a.name} — ${err instanceof Error ? err.message : String(err)}`);
      fail = 1;
    }
  }
  process.exit(fail ? 2 : 0);
}

// Positional = first token that is neither a flag nor a flag's value
// (so `--out out.md media-asset-library` binds the name correctly).
const FLAGS_WITH_VALUE = new Set(['--out']);
let name: string | undefined;
for (let i = 0; i < args.length; i++) {
  const tok = args[i];
  if (FLAGS_WITH_VALUE.has(tok)) {
    i++; // skip the flag's value
    continue;
  }
  if (tok.startsWith('--')) continue;
  name = tok;
  break;
}
if (!name) {
  console.error('usage: bun RenderArchetype.ts <archetype-name> [--out FILE] | --list');
  process.exit(2);
}
const target = archetypes.find((a) => a.name === name);
if (!target) {
  console.error(`no archetype named "${name}" (try --list)`);
  process.exit(2);
}
const md = render(target);
const outIdx = args.indexOf('--out');
if (outIdx >= 0 && args[outIdx + 1]) {
  // writeArtifact:exempt — operator-directed projection to a caller-chosen path; artifact logging is the invoking workflow's Step (SKILL.md Artifact Tracking)
  writeFileSync(args[outIdx + 1], md);
  console.log(`wrote ${args[outIdx + 1]}`);
} else {
  console.log(md);
}
