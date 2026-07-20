#!/usr/bin/env bun
/**
 * PRDSync.hook.ts — Read-only PRD → work.json sync via PostToolUse
 *
 * TRIGGER: PostToolUse (Write, Edit, MultiEdit)
 *
 * v3.2.0: Hooks are READ-ONLY from PRD's perspective.
 * The AI writes all PRD content directly (criteria, checkboxes, frontmatter).
 * This hook ONLY reads the PRD and syncs to work.json for the dashboard.
 *
 * - Write/Edit/MultiEdit on PRD.md → read frontmatter + criteria → sync to work.json
 */

import { readFileSync, existsSync } from 'fs';
// V12.3-β split migration (RFC-0082 §1): parsing functions sourced from
// @durante/prd library; state-mutating work.json functions (syncToWorkJson,
// readRegistry) remain in local prd-utils.ts pending V12.4 Skills/PRD scaffold.
// RFC-0112 D1: PRD-parser primitives route THROUGH ./lib/prd-utils (the
// fail-soft loader) — never a direct static `@durante/prd` import, which
// would crash this hook's module load on a fresh install with no node_modules.
import { parseFrontmatter, getScalarField, syncToWorkJson, readRegistry, prdAvailable } from './lib/prd-utils';
import { setPhaseTab } from './lib/tab-setter';
import { PRD_AUTHORED_PHASES, type AlgorithmTabPhase } from './lib/tab-constants';
import { startTimer, stopTimer } from './lib/hook-io';
import { bridgeObserved, bridgeFire } from './lib/mempalace';
import { buildPrdPhaseOp, buildPrdSessionWorkedOnOp, prdPathFromHookPayload } from './lib/prd-kg';

// RFC-0037 §4.1 path guard, EXPORTED so tests exercise THIS regex, not a copy.
// PRDs live flat (WORK/{slug}) OR nested (WORK/active/{slug}, WORK/archived/{slug}).
// The optional bucket segment keeps active/ PRDs — every PRD authored under the
// split — from being silently skipped by the mine_file fire (the path trap).
export const WORK_PRD_PATH_RE =
  /\/MEMORY\/WORK\/(?:active\/|archived\/)?[^/]+\/PRD\.md$/;

async function main(input: any) {
  // Only trigger for PRD.md files in MEMORY/WORK/
  const filePath = prdPathFromHookPayload(input);
  if (!filePath) return;

  // Use the actual file path that was just written/edited, not findLatestPRD()
  // findLatestPRD() scans all PRDs by mtime and can return the wrong file
  // when multiple sessions exist or when a file's mtime is bumped by git ops.
  const prdPath = filePath;
  if (!existsSync(prdPath)) return;

  // RFC-0112: fail-soft degradation. With the PRD parser unresolved, the
  // work.json sync cannot run — skip it loudly and continue (the Stop path
  // still emits {continue: true}). Never crash.
  if (!prdAvailable) {
    console.error('[PRDSync] @durante/prd degraded (RFC-0112) — skipping work.json sync this fire');
    return;
  }

  const content = readFileSync(prdPath, 'utf-8');
  const fm = parseFrontmatter(content);
  if (!fm) return;

  // Check existing phase before sync to detect phase changes
  const newPhase = (getScalarField(fm, 'phase') ?? '').toUpperCase();
  const slug = getScalarField(fm, 'slug');
  let oldPhase = '';
  let priorSessionUUID: string | null = null;
  if (slug) {
    try {
      const registry = readRegistry();
      const existing = registry.sessions[slug];
      if (existing) {
        oldPhase = (existing.phase || '').toUpperCase();
        priorSessionUUID = existing.sessionUUID || null;
      }
    } catch { /* silent */ }
  }

  // Sync frontmatter + criteria to work.json (pass session_id for session name lookup)
  syncToWorkJson(fm, prdPath, content, input.session_id);

  // RFC-0024 §5.3 fix: emit a KG fact so kg_timeline over a rolling window
  // returns facts for PRDs landed in that window. Before this, MinePRDOnWrite
  // created drawers in room=prds but never called add_kg_fact, so the timeline
  // came up empty (0 facts over 7 days despite 25 drawers).
  const phaseOp = buildPrdPhaseOp(fm, oldPhase);
  if (phaseOp) bridgeObserved(phaseOp.action, phaseOp.args, { hook: 'PRDSync', timeoutMs: 5000 });

  // RFC-0060 §6 / [R-session-attribution-3]: write worked_on on first PRD edit
  // per slug. PhaseCompleteGate.hook.ts:188 requires this fact at LEARN; before
  // this wiring no automation produced it and agents had to fire add_kg_fact
  // manually — and frequently forgot.
  const workedOnOp = buildPrdSessionWorkedOnOp(fm, oldPhase, input.session_id, priorSessionUUID);
  if (workedOnOp) bridgeObserved(workedOnOp.action, workedOnOp.args, { hook: 'PRDSync', timeoutMs: 5000 });

  // Update tab color when algorithm phase changes
  if (newPhase !== oldPhase && PRD_AUTHORED_PHASES.has(newPhase) && input.session_id) {
    try {
      setPhaseTab(newPhase as AlgorithmTabPhase, input.session_id);
    } catch (err) {
      console.error('[PRDSync] setPhaseTab failed:', err);
    }
  }

  // RFC-0027 §5.5.2: auto-fire `mine_file` so PRD content lands in semantic
  // search within minutes of any write. Before this, 237 historical PRDs were
  // invisible to mempalace_search; new PRDs would have inherited the same
  // gap. Fire-and-forget — never block the PostToolUse path on bridge latency.
  // Path guard is conservative: an absolute path ending in /PRD.md under a
  // MEMORY/WORK/ tree, flat or active/archived-nested (see WORK_PRD_PATH_RE).
  if (WORK_PRD_PATH_RE.test(prdPath)) {
    try {
      bridgeFire('mine_file', { filepath: prdPath });
    } catch {
      // Fire-and-forget — bridge unavailability is fine.
    }
  }

}

// Guard execution so importing this module (e.g. from tests, to exercise
// WORK_PRD_PATH_RE) does not read stdin / run the hook. Direct `bun PRDSync.hook.ts`
// invocation keeps import.meta.main true, so the live hook is unchanged.
if (import.meta.main) {
  let input: any;
  try {
    input = JSON.parse(readFileSync(0, 'utf-8'));
  } catch {
    process.exit(0);
  }
  const _t = startTimer('PRDSync');
  process.on('exit', () => stopTimer(_t, 'PostToolUse'));
  main(input).catch(() => {}).finally(() => {
    console.log(JSON.stringify({ continue: true }));
    process.exit(0);
  });
}
