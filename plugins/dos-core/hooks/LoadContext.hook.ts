#!/usr/bin/env bun
/**
 * LoadContext.hook.ts — Inject DOS dynamic context at SessionStart.
 *
 * DOS v4.0: Core context (identity, rules, format) is in CLAUDE.md, loaded
 * natively by Claude Code. This hook injects DYNAMIC context only:
 * - Relationship context (recent opinions + notes)
 * - Learning readback (signals, wisdom, failure patterns)
 * - Active work summary (last 48h sessions + tracked projects)
 * - Project KG facts + drift detection + four-copy banner
 *
 * Architecture: plugin pattern. Each concern is a `ContextLoader` in
 * `loaders/`. `safeLoad` wraps every call so any one loader failing
 * cannot fail the SessionStart hook (fail-open by contract).
 *
 * TRIGGER: SessionStart
 * INPUT: env DOS_DIR, files under MEMORY/RELATIONSHIP, MEMORY/LEARNING,
 *        MEMORY/WORK, MEMORY/STATE/progress, DOS/USER/OPINIONS.md
 * OUTPUT: stdout system-reminder blocks; stderr progress logs; exit(0)
 * PERFORMANCE: blocking; <50ms typical; skipped for subagents
 */

import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { atomicWriteSync } from './lib/atomic-write';
import { getDosDir, loadProjectEnv } from './lib/paths';

loadProjectEnv();
import { recordSessionStart } from './lib/notifications';
import { startTimer, stopTimer } from './lib/hook-io';
import { ensureConfigSynced } from './lib/config-sync';
import { runHook } from './lib/hookRunner';
import { spawnSyncCheckBackground, writeHealth } from './lib/health';

import { CONTEXT_LOADERS } from './loaders';
import { safeLoad } from './loaders/safe';
import { loadSettings, checkVersion, formatVersionCheck } from './loaders/helpers';
import type { BootContext, ContextLoader, FragmentSlot } from './loaders/types';

// ─── Helpers ───────────────────────────────────────────────

function isSubagent(): boolean {
  const claudeProjectDir = process.env.CLAUDE_PROJECT_DIR || '';
  return claudeProjectDir.includes('/.claude/Agents/')
    || process.env.CLAUDE_AGENT_TYPE !== undefined;
}

function captureCurrentHead(): string {
  const durante = join(homedir(), 'Durante');
  if (!existsSync(join(durante, '.git'))) return '';
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: durante,
      encoding: 'utf8',
      timeout: 500,
    }).trim();
  } catch {
    return '';
  }
}

function spawnBackgroundSyncCheckSafe(currentHead: string): void {
  try {
    const syncCheckPath = join(homedir(), 'Durante', 'Tools', 'sync-check.ts');
    if (existsSync(syncCheckPath)) {
      spawnSyncCheckBackground({ syncCheckPath, head: currentHead });
    }
  } catch { /* silent */ }
}

// ─── Confidence decay (correction-triple aging) ────────────
// Once-per-day SQLite UPDATE on the MemPalace KG. Lives in main() because
// it's a maintenance one-shot, not a context loader. Bob diagnosed this as
// "not what main is for" — extracting to a dedicated MaintenanceWindow hook
// is a follow-up; for now it stays here behind its own try/catch.

function decayConfidenceCorrections(dosDir: string): void {
  try {
    const decayCachePath = join(dosDir, 'MEMORY', 'STATE', 'confidence-decay-last.txt');
    const today = new Date().toISOString().split('T')[0];
    let lastDecay = '';
    try {
      lastDecay = readFileSync(decayCachePath, 'utf-8').trim();
    } catch { /* missing or unreadable */ }

    if (lastDecay === today) return;

    const memDir = process.env.MEMPALACE_DIR || join(dosDir.replace('.claude', ''), '.mempalace');
    const kgPath = join(memDir, 'knowledge_graph.db');
    if (!existsSync(kgPath)) return;

    try {
      execFileSync('sqlite3', [kgPath,
        "UPDATE triples SET confidence = ROUND(confidence * 0.95, 3) WHERE predicate = 'correction' AND confidence > 0.1 AND extracted_at < datetime('now', '-1 day');"
      ], { timeout: 2000 });
      atomicWriteSync(decayCachePath, today);
      console.error('📉 Confidence decay applied to correction triples');
    } catch (err) {
      console.error(`⚠️ Confidence decay failed: ${err}`);
    }
  } catch (err) {
    console.error(`⚠️ Confidence decay check failed: ${err}`);
  }
}

// ─── Loader phase orchestration ────────────────────────────

interface FragmentSlots {
  project: string;
  relationship: string;
  learning: string;
}

async function runPhase(
  loaders: readonly ContextLoader[],
  ctx: BootContext,
  slots: FragmentSlots,
): Promise<void> {
  for (const loader of loaders) {
    if (loader.enabled && !loader.enabled(ctx.settings)) {
      console.error(`⏭️ Skipped ${loader.name} (disabled)`);
      continue;
    }
    const result = await safeLoad(loader, ctx);
    if (result.emit) console.log(result.emit);
    if (result.fragment) {
      const slot: FragmentSlot = result.slot ?? 'project';
      slots[slot] += result.fragment;
    }
    if (result.log) console.error(result.log);
  }
}

function emitDynamicContext(slots: FragmentSlots): void {
  // R5′ (Amendment R companion, 2026-07-08): the two signal-backed critical
  // rules ride the dynamic-context block EVERY session — including the
  // empty-slots path (the prior early-return skipped injection entirely;
  // /code-review finding, fixed same-day). Single edit site by design — the
  // full rules live in AISTEERINGRULES; these are reinforcement one-liners,
  // not a second authoritative copy.
  const criticalRuleReinforcement =
    '⚠ Critical-rule reinforcement:\n' +
    '• ONE ITEM at a time on multi-issue lists — bundle only on explicit "all of them".\n' +
    '• Never assert STATE without tool verification — evidence lands in the same message as the claim (claims about state only; statements of intent exempt).';
  if (!slots.project && !slots.relationship && !slots.learning) {
    console.log(`<system-reminder>\n${criticalRuleReinforcement}\n</system-reminder>`);
    console.log('\n✅ DOS session ready...');
    return;
  }
  const learningSection = slots.learning ? '\n---\n' + slots.learning : '';
  const message = `<system-reminder>
DOS Dynamic Context (Auto-loaded at Session Start)
${slots.project}${slots.relationship}${learningSection}
---
${criticalRuleReinforcement}
---
Dynamic context loaded. Core identity, rules, and format are in CLAUDE.md.
</system-reminder>`;
  console.log(message);
  console.log('\n✅ DOS dynamic context loaded...');
}

// ─── Main ──────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    if (isSubagent()) {
      console.error('🤖 Subagent session - skipping context loading');
      process.exit(0);
    }

    const dosDir = getDosDir();
    const currentHead = captureCurrentHead();
    spawnBackgroundSyncCheckSafe(currentHead);

    // Pull Studio config FIRST so version check + downstream settings reads
    // see remote state. SessionStart hooks run in parallel per Claude Code,
    // so the standalone ConfigSync hook may not finish before this one.
    await ensureConfigSynced();

    recordSessionStart();
    console.error('⏱️ Session start time recorded');

    // Version check — pre-registry because settings.json must load AFTER
    // it (preserves original stderr log sequence) and the check has no
    // fragment/emit, so the plugin shape would be a misfit.
    try {
      formatVersionCheck(checkVersion(dosDir));
    } catch (err) {
      console.error(`⚠️ Version check failed: ${err}`);
    }

    const settings = loadSettings(dosDir);
    console.error('✅ Loaded settings.json');

    // E4.3 (2026-05-04): schema check — flag missing voiceId so the operator
    // knows why voice output is silent rather than seeing a cryptic 502 later.
    try {
      const voiceId = (settings as any)?.daidentity?.voices?.algorithm?.voiceId;
      if (!voiceId || typeof voiceId !== 'string' || voiceId.trim() === '') {
        console.error('⚠️ Voice config missing: daidentity.voices.algorithm.voiceId not set in settings.json — voice output will be silent');
      }
    } catch { /* schema check is best-effort; never block session startup */ }

    const ctx: BootContext = { dosDir, settings, prevHead: currentHead };
    const slots: FragmentSlots = { project: '', relationship: '', learning: '' };

    const preLoaders = CONTEXT_LOADERS.filter(l => (l.phase ?? 'pre') === 'pre');
    const postLoaders = CONTEXT_LOADERS.filter(l => l.phase === 'post');

    await runPhase(preLoaders, ctx, slots);
    decayConfidenceCorrections(dosDir);
    emitDynamicContext(slots);
    await runPhase(postLoaders, ctx, slots);

    // RFC-0020 P0-4: atomic rewrite of health.json (best-effort).
    try {
      writeHealth({ head: currentHead });
    } catch { /* health.json best-effort */ }

    console.error('✅ DOS session initialization complete (v4.0)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error in LoadContext hook:', error);
    process.exit(0); // Non-fatal — don't block session startup
  }
}

const _t = startTimer('LoadContext');
process.on('exit', () => stopTimer(_t, 'SessionStart'));

// RFC-0020 P0-1: wrap through the hook-runner. Any thrown error persists to
// ~/.claude/MEMORY/STATE/hook-errors.jsonl via the 3-tier fallback ladder.
// main() already swallows its own errors and exits 0 to stay fail-open;
// the wrap catches anything that escapes that guard.
runHook({ name: 'LoadContext', phase: 'SessionStart' }, main).catch(() => {
  // runHook already wrote the error line; failing silently here keeps
  // the session startup from aborting on a wrapper-caught throw.
});
