#!/usr/bin/env bun
/**
 * ValidateScopeBlock — mechanize SeedScope's "never silently absent" obligation table.
 *
 * SeedScope.md emits scope ISCs as `- [ ] ISC-S<n> [T<tier> <row-id>]: <text>` with states
 * build | DEFERRED | WAIVED. Until now the obligation table was agent diligence — and it
 * silently dropped its own row once (media-delete pilot, kit PR #15 VERIFY). This validator
 * turns the table into an enforced check (Tailor T10(a), operator-signed 2026-07-09):
 *
 *   T1 unconditional row absent from the PRD ................ ERROR
 *   T1 DEFERRED without a version target + reason ........... ERROR
 *   T2 unconditional row absent ............................. FINDING
 *   T2 DEFERRED without a reason ............................ FINDING
 *   row-id in PRD but not in the archetype .................. FINDING
 *   duplicate row-id in the scope block ..................... FINDING
 *   contextRider rows ....................................... exempt from absence checks
 *      (deployment shape unknowable here); reported as info when present.
 *
 * Coordination (Archer H7): this validates the EMITTED block; SeedScope invocation logging /
 * auto-fire instrumentation stays H7's seam — no invocation telemetry is added here.
 *
 * Usage:
 *   bun run ValidateScopeBlock.ts --prd <PRD.md path> --archetype <kebab-name> [--json]
 * Exit: 0 clean · 1 findings · 2 usage/load error.
 */
import { parseArgs } from 'util';
import { readFileSync } from 'fs';
import { loadCorpus } from './LoadCorpus';
import type { ArchetypeRow } from '../Schema/Archetype';

export interface ScopeFinding {
  severity: 'error' | 'finding' | 'info';
  rowId: string;
  message: string;
}

export interface ScopeEntry {
  rowId: string;
  tier: string;
  line: string;
  state: 'build' | 'deferred' | 'waived';
}

/** Parse `- [ ] ISC-S1 [T1 single-delete]: ...` lines out of a PRD's scope block. */
export function parseScopeEntries(prdText: string): ScopeEntry[] {
  const entries: ScopeEntry[] = [];
  const re = /^\s*-\s\[[ x]\]\s+ISC-[SA]\d+\s+\[(T\d)\s+([a-z0-9-]+)\]:\s*(.*)$/gim;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prdText)) !== null) {
    const body = m[3];
    const state = /\bDEFERRED\b/i.test(body) ? 'deferred'
      : /\bWAIVED\b/i.test(body) ? 'waived' : 'build';
    entries.push({ tier: m[1], rowId: m[2], line: body, state });
  }
  return entries;
}

/** Pure obligation check — corpus rows vs parsed scope entries. */
export function validateScopeBlock(rows: ArchetypeRow[], prdText: string): ScopeFinding[] {
  const findings: ScopeFinding[] = [];
  const entries = parseScopeEntries(prdText);
  const byId = new Map<string, ScopeEntry[]>();
  for (const e of entries) {
    byId.set(e.rowId, [...(byId.get(e.rowId) ?? []), e]);
  }

  for (const [rowId, list] of byId) {
    if (list.length > 1) {
      findings.push({ severity: 'finding', rowId, message: `duplicate scope entries (${list.length})` });
    }
  }

  const known = new Set(rows.map((r) => r.id));
  for (const rowId of byId.keys()) {
    if (!known.has(rowId)) {
      findings.push({ severity: 'finding', rowId, message: 'row-id not in the archetype corpus' });
    }
  }

  for (const row of rows) {
    const anti = row.id.startsWith('a-');
    const rider = (row as { contextRider?: unknown }).contextRider != null;
    const present = byId.get(row.id)?.[0];
    if (!present) {
      if (anti) continue; // anti rows attach per built capability; absence handled at VERIFY
      if (rider) {
        continue; // deployment-conditional — absence is not checkable here
      }
      if (row.tier === 'T1') {
        findings.push({ severity: 'error', rowId: row.id, message: 'T1 row silently absent from PRD scope block' });
      } else if (row.tier === 'T2') {
        findings.push({ severity: 'finding', rowId: row.id, message: 'T2 row absent without a DEFERRED line' });
      }
      continue;
    }
    if (rider) {
      findings.push({ severity: 'info', rowId: row.id, message: 'contextRider row present — rider judged active by the seeding agent' });
    }
    if (present.state === 'deferred') {
      const hasReason = /reason\s*:/i.test(present.line);
      const hasTarget = /v\d+\.\d+|\bnext\b|\bbacklog\b/i.test(present.line);
      if (row.tier === 'T1' && !(hasReason && hasTarget)) {
        findings.push({ severity: 'error', rowId: row.id, message: 'T1 DEFERRED without version target + reason' });
      } else if (row.tier === 'T2' && !hasReason) {
        findings.push({ severity: 'finding', rowId: row.id, message: 'T2 DEFERRED without a reason' });
      }
    }
    if (present.state === 'waived' && row.tier !== 'T3') {
      findings.push({ severity: 'error', rowId: row.id, message: `WAIVED is T3-only; ${row.tier} rows must build or defer` });
    }
  }
  return findings;
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      prd: { type: 'string' },
      archetype: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || !values.prd || !values.archetype) {
    console.log('Usage: bun run ValidateScopeBlock.ts --prd <PRD.md> --archetype <kebab-name> [--json]');
    process.exit(values.help ? 0 : 2);
  }
  try {
    const archetypes = await loadCorpus(values.archetype);
    const arch = archetypes.find((a) => a.name === values.archetype);
    if (!arch) {
      console.error(`archetype not found in corpus: ${values.archetype}`);
      process.exit(2);
    }
    const prdText = readFileSync(values.prd!, 'utf-8');
    const findings = validateScopeBlock(arch.rows, prdText);
    const real = findings.filter((f) => f.severity !== 'info');
    if (values.json) {
      console.log(JSON.stringify({ archetype: values.archetype, findings }, null, 2));
    } else {
      for (const f of findings) console.log(`${f.severity.toUpperCase().padEnd(7)} ${f.rowId}: ${f.message}`);
      console.log(`${real.length} finding(s) (${findings.filter((f) => f.severity === 'error').length} errors)`);
    }
    process.exit(real.length === 0 ? 0 : 1);
  } catch (e) {
    console.error(`scope-block validation failed: ${e}`);
    process.exit(2);
  }
}
