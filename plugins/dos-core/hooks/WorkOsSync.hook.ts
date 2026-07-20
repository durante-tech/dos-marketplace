#!/usr/bin/env bun
/**
 * WorkOsSync.hook.ts — RFC-0133: mirror a DOS PRD's phase to the Durante Work OS
 * GitHub Project, as a HOOK-OWNED side effect. Agents never hand-invoke board
 * sync; this hook owns it (the Algorithm §5 ritual stays off-limits).
 *
 * TRIGGER: PostToolUse (Write, Edit, MultiEdit) on MEMORY/WORK/.../PRD.md
 *
 * Design: fire-and-forget. On a PRD phase change (or first-seen), spawn the
 * standalone `Tools/work-os.ts from-prd` DETACHED. That command is idempotent
 * (RFC-0133): it creates+attaches a Project item the first time and re-stamps
 * the item's Status from the PRD phase thereafter, keyed on the `work_os_item`
 * KG fact. This hook NEVER blocks the tool call and ALWAYS emits
 * {continue: true}; stderr drains to MEMORY/STATE/work-os-errors.jsonl.
 *
 * Soft prerequisite: the gh token needs the `project` scope. Without it
 * from-prd exits non-zero — captured in the error log, never surfaced to the
 * agent (board sync is best-effort, not a gate).
 */
import { readFileSync, existsSync, openSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { parseFrontmatter, getScalarField, readRegistry, prdAvailable } from './lib/prd-utils';
import { prdPathFromHookPayload } from './lib/prd-kg';
import { startTimer, stopTimer, readHookInput } from './lib/hook-io';
import { getMemorySubdir } from './lib/paths';

// Home repo for DOS PRDs. RFC-0133 v1 targets the dos monorepo; a later slice
// can derive this from the project registry's git remote.
const HOME_REPO = 'dos';

async function main() {
  // Shared cancel-safe reader (H-034) instead of a top-level synchronous
  // readFileSync(0): the sync read blocks to stdin-EOF with no interrupt AND
  // ran before startTimer, so a hang left no breadcrumb (invisible to the
  // SIGKILL/hang detector). Reading inside main() — after startTimer below —
  // also restores that breadcrumb visibility (H-057).
  const input = await readHookInput();
  if (!input) return;
  const prdPath = prdPathFromHookPayload(input as { tool_input?: { file_path?: unknown } });
  if (!prdPath || !existsSync(prdPath)) return;
  if (!prdAvailable) return; // RFC-0112 fail-soft: parser unresolved — skip this fire.

  const content = readFileSync(prdPath, 'utf-8');
  const fm = parseFrontmatter(content);
  if (!fm) return;
  const slug = getScalarField(fm, 'slug');
  const newPhase = (getScalarField(fm, 'phase') ?? '').toUpperCase();
  if (!slug || !newPhase) return;

  // Fire only on a phase change (or first-seen) — work-os.ts from-prd is
  // idempotent, but each call hits the GitHub API, so don't fire on every save.
  let oldPhase = '';
  try {
    const existing = readRegistry().sessions[slug];
    if (existing) oldPhase = (existing.phase || '').toUpperCase();
  } catch { /* silent */ }
  if (oldPhase && oldPhase === newPhase) return;

  // RFC-0151 P1 cheap early gate (council F3 threshold): a sub-threshold PRD that
  // is FIRST-SEEN provably has no GitHub issue (nothing could have created one),
  // so skip the from-prd spawn entirely — the firehose of agent sub-task noise is
  // the root failure this fork closes. We only skip first-seen sub-threshold PRDs:
  // a seen-before PRD is still handed to from-prd (the authoritative gate) so an
  // already-existing issue's Status can fold on later phase changes. Threshold =
  // effort in {advanced, deep, xhigh, comprehensive} OR explicit work_os: promote.
  const CREATE_EFFORTS = new Set(['advanced', 'deep', 'xhigh', 'comprehensive']);
  const effort = (getScalarField(fm, 'effort') ?? '').toLowerCase();
  const promote = (getScalarField(fm, 'work_os') ?? '').toLowerCase() === 'promote';
  const supraThreshold = CREATE_EFFORTS.has(effort) || promote;
  const firstSeen = oldPhase === '';
  if (!supraThreshold && firstSeen) return;

  // work-os.ts is a standalone Tools/ util (not graduated/four-copied). Resolve
  // it from the project root (set by Claude Code), falling back to the checkout.
  const repoRoot = process.env.CLAUDE_PROJECT_DIR || join(process.env.HOME ?? '', 'Durante');
  const tool = join(repoRoot, 'Tools', 'work-os.ts');
  if (!existsSync(tool)) return;

  // Fire-and-forget: detached child, stderr → work-os-errors.jsonl (best-effort).
  try {
    let stderrTarget: 'ignore' | number = 'ignore';
    try {
      const stateDir = getMemorySubdir('STATE');
      mkdirSync(stateDir, { recursive: true });
      stderrTarget = openSync(join(stateDir, 'work-os-errors.jsonl'), 'a');
    } catch { /* log dir unavailable — spawn without capturing stderr */ }
    const child = spawn('bun', [tool, 'from-prd', prdPath, '--repo', HOME_REPO], {
      detached: true,
      stdio: ['ignore', 'ignore', stderrTarget],
    });
    child.unref();
  } catch { /* fire-and-forget — board sync is best-effort, never blocks */ }
}

const _t = startTimer('WorkOsSync');
process.on('exit', () => stopTimer(_t, 'PostToolUse'));
main().catch(() => {}).finally(() => {
  console.log(JSON.stringify({ continue: true }));
  process.exit(0);
});
