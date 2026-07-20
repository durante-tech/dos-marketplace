/**
 * ground — /discover's GROUND stage (PRD 20260530-225649): the deterministic, READ-ONLY fork
 * facade read that runs BEFORE any interview question.
 *
 * Resolves the fork AGENTS.md @-import to .claude/kit-conventions.md (authoritative layer-2), reads
 * the AGENTS.md remainder as layer-3 EXCEPT the @-import line and the nextjs-agent-rules block —
 * keeping prose ABOVE the marker (the council-verified correction: the marker is NOT the layer
 * boundary). Asserts .fork-slot != 0, branches fresh-vs-established, and compares the layer-2 content
 * hash to the kit root: divergence is ADVISORY (proceed), a MISSING kit-conventions.md is a loud
 * BLOCK. Never mutates the fork; never runs `pnpm dos:extract-conventions`.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export interface GroundResult {
  ok: boolean;                         // false = hard block (precondition / missing layer-2)
  block: string | null;
  forkSlot: number | null;
  freshness: 'fresh' | 'STALE' | 'unknown';
  forkClass: 'fresh' | 'established';
  priorPrdCount: number;
  layer2: string | null;               // kit-conventions.md, full
  layer3: string | null;               // AGENTS.md prose minus @-import line + nextjs block
  advisories: string[];
  status: string;
  kitConventionsPath: string | null;
}

const NEXTJS_BEGIN = /BEGIN:nextjs-agent-rules/;
const NEXTJS_END = /END:nextjs-agent-rules/;
const IMPORT_RE = /^@.*kit-conventions\.md$/;

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex').slice(0, 12);
}

/** Strip the @-import line and the nextjs-agent-rules block; KEEP all other prose (ISC-7..10, ANTI-1). */
export function stripLayer3(agentsMd: string): string {
  const out: string[] = [];
  let inBlock = false;
  for (const line of agentsMd.split('\n')) {
    if (NEXTJS_BEGIN.test(line)) { inBlock = true; continue; }
    if (NEXTJS_END.test(line)) { inBlock = false; continue; }
    if (inBlock) continue;
    if (IMPORT_RE.test(line.trim())) continue;
    out.push(line);
  }
  return out.join('\n').trim();
}

export function ground(forkRoot: string, opts: { kitRoot?: string } = {}): GroundResult {
  const advisories: string[] = [];
  const block = (msg: string): GroundResult => ({
    ok: false, block: msg, forkSlot: null, freshness: 'unknown', forkClass: 'fresh',
    priorPrdCount: 0, layer2: null, layer3: null, advisories, status: msg, kitConventionsPath: null,
  });

  // Precondition: .fork-slot present + non-zero integer (ISC-11/67/68; ISC-19/ANTI-16 DOS-repo guard).
  const slotPath = join(forkRoot, '.fork-slot');
  if (!existsSync(slotPath)) {
    return block('BLOCK: no .fork-slot at fork root — /discover requires a dos-prisma-saas-kit fork (refusing, incl. its own non-kit birthplace)');
  }
  const slotRaw = readFileSync(slotPath, 'utf-8').trim();
  const forkSlot = Number(slotRaw);
  if (!Number.isInteger(forkSlot) || forkSlot === 0) {
    return block(`BLOCK: invalid .fork-slot "${slotRaw}" (expected a non-zero integer)`);
  }

  // AGENTS.md + @-import (ISC-2/70).
  const agentsPath = join(forkRoot, 'AGENTS.md');
  if (!existsSync(agentsPath)) return block('BLOCK: AGENTS.md absent at fork root');
  const agentsMd = readFileSync(agentsPath, 'utf-8');
  const importLine = agentsMd.split('\n').find((l) => IMPORT_RE.test(l.trim()));
  if (!importLine) return block('BLOCK: AGENTS.md has no @-import to kit-conventions.md');
  const importTarget = importLine.trim().replace(/^@/, '');
  const kitConventionsPath = join(forkRoot, importTarget);

  // MISSING kit-conventions.md => loud block (ISC-17/18); STALE => advisory (ISC-16, ANTI-2).
  if (!existsSync(kitConventionsPath)) {
    return block(`BLOCK: ${importTarget} is missing — regenerate with: pnpm dos:extract-conventions`);
  }
  const layer2 = readFileSync(kitConventionsPath, 'utf-8');
  const layer3 = stripLayer3(agentsMd);

  // Read-only hash comparison (ISC-13/14/15/24; ANTI-3 — never mutate, never run extract).
  let freshness: GroundResult['freshness'] = 'unknown';
  const forkHash = sha256(layer2);
  if (opts.kitRoot) {
    const kitConv = join(opts.kitRoot, importTarget);
    if (existsSync(kitConv)) {
      const kitHash = sha256(readFileSync(kitConv, 'utf-8'));
      if (kitHash === forkHash) {
        freshness = 'fresh';
      } else {
        freshness = 'STALE';
        advisories.push(`layer-2 STALE: fork=${forkHash} kit=${kitHash}; tier/boundary claims MAY be stale — run pnpm dos:extract-conventions before relying on them`);
      }
    }
  }

  // fresh-vs-established (ISC-12/22/23).
  const workDir = join(forkRoot, 'MEMORY', 'WORK');
  let priorPrdCount = 0;
  if (existsSync(workDir)) {
    priorPrdCount = readdirSync(workDir).filter((n) => {
      try { return statSync(join(workDir, n)).isDirectory(); } catch { return false; }
    }).length;
  }
  const forkClass: GroundResult['forkClass'] = priorPrdCount > 0 ? 'established' : 'fresh';

  // One-line status (ISC-20/21/22/23). Fresh forks read 'fresh' even without a kit-root compare.
  const freshToken = freshness === 'unknown' ? (forkClass === 'fresh' ? 'fresh' : 'unknown') : freshness;
  const status = `layer-2 ${freshToken}, slot ${forkSlot}, ${forkClass} fork, ${priorPrdCount} prior PRDs`;

  return { ok: true, block: null, forkSlot, freshness, forkClass, priorPrdCount, layer2, layer3, advisories, status, kitConventionsPath };
}

if (import.meta.main) {
  const forkRoot = process.argv[2] || process.cwd();
  const g = ground(forkRoot);
  console.error(g.status);
  console.log(JSON.stringify({ ...g, layer2: g.layer2 ? `<${g.layer2.length} chars>` : null }, null, 2));
  process.exit(g.ok ? 0 : 1);
}
