#!/usr/bin/env bun
/**
 * ResumeProbe.hook.ts — Mechanical post-compact state recovery (SessionStart:compact)
 *
 * V21-W3-S2 spike (eval-gated). Predicate: post-compact decision-contradiction
 * rate ≤10% with probe, scored against the pre-compact PRD ledger on the
 * class-5 eval (post-compact-resume-fidelity) at its committed sample bar.
 *
 * PURPOSE:
 * Doctrine §8 (Context Recovery) tells the AGENT to go read the most-recent
 * PRD after a compaction; MemPalacePreCompact saves a digest BEFORE the
 * compaction. Nothing mechanically closes the loop at the recovery boundary.
 * This hook does: at SessionStart with source=compact it assembles the
 * mechanical recovery bundle and injects it as session context —
 *
 *   1. ACTIVE-PRD DELTA        — most-recent PRD under MEMORY/WORK
 *                                (active/ preferred, legacy flat fallback):
 *                                frontmatter state + criteria progress +
 *                                latest decisions.
 *   2. GIT-DIFF-SINCE-SNAPSHOT — working-tree delta vs the SessionBaseline
 *                                snapshot (MEMORY/STATE/session-{id}-baseline
 *                                .json), i.e. what THIS session touched.
 *   3. OPEN-THREAD DELTA       — Open Threads section of the wing's
 *                                next-session-context snapshot + the
 *                                PreCompact digest breadcrumb for this
 *                                session (precompact-saves.jsonl).
 *
 * ADVISORY BY CONSTRUCTION: informs, never blocks. Every section is
 * fail-open (absent source → explicit "none recorded" line); any crash
 * emits nothing and exits 0. No writes except one telemetry line.
 *
 * TRIGGER: SessionStart, matcher "compact" (settings.json). Defense-in-depth:
 * exits silently if stdin source != "compact".
 *
 * INPUT:
 * - stdin: { session_id, source, hook_event_name, cwd? }
 * - files: MEMORY/WORK/**, MEMORY/STATE/session-{id}-baseline.json,
 *          MEMORY/STATE/next-session-context-<wing>.md,
 *          ~/.claude/MEMORY/STATE/precompact-saves.jsonl
 * - env:   CLAUDE_PROJECT_DIR / cwd (git root), DOS_DIR
 *
 * OUTPUT:
 * - stdout: { hookSpecificOutput: { hookEventName: "SessionStart",
 *             additionalContext: <bundle> } }   (silent {} when not compact)
 * - exit(0): always
 *
 * SIDE EFFECTS:
 * - Appends one JSONL line (schema resume-probe/v1) to
 *   MEMORY/STATE/resume-probe.jsonl (project-first via getMemorySubdir).
 *
 * BUDGET: foreground <500ms typical (file reads + one git spawn); the git
 * spawn is hard-capped at 1.5s so a locked/huge repo degrades the section
 * instead of stalling the recovery boundary.
 */

import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { readHookInput, startTimer, stopTimer } from './lib/hook-io';
import { getMemorySubdir, getWorkDir, loadProjectEnv } from './lib/paths';
import { countCriteria, prdAvailable } from './lib/prd-utils';
import { resolveProjectWingFromEnv } from './lib/project-resolver';

// Module-init work runs OUTSIDE main()'s .catch — guard it so an env-file
// parse error can never make this hook exit non-zero (advisory contract).
try {
  loadProjectEnv();
} catch (err) {
  console.error('[ResumeProbe] loadProjectEnv failed (continuing without project env):', err);
}

const SECTION_CAP = 1400; // chars per section
const BUNDLE_CAP = 4200; // chars total (defense against pathological inputs)
const FILE_LIST_CAP = 20;

interface ProbeInput {
  session_id?: string;
  source?: string;
  cwd?: string;
  hook_event_name?: string;
}

function cap(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}\n… [truncated]`;
}

/** Last non-empty lines of a file WITHOUT reading the whole file — append-only
 *  ledgers (precompact-saves.jsonl) grow without bound and this sits on the
 *  SessionStart foreground path. Reads at most `budget` bytes from EOF. */
function tailLines(path: string, maxLines: number, budget = 64 * 1024): string[] {
  const size = statSync(path).size;
  const start = Math.max(0, size - budget);
  const buf = Buffer.alloc(size - start);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buf, 0, buf.length, start);
  } finally {
    closeSync(fd);
  }
  const lines = buf.toString('utf-8').split('\n').filter(Boolean);
  // Drop the first line when we started mid-file (it is almost surely partial).
  if (start > 0 && lines.length > 0) lines.shift();
  return lines.slice(-maxLines);
}

// ── section 1: active-PRD delta ──────────────────────────────────────────────

function latestPrd(): { path: string; mtimeMs: number } | null {
  const workDir = getWorkDir();
  const roots = [join(workDir, 'active'), workDir];
  let best: { path: string; mtimeMs: number } | null = null;
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (entry === 'active' || entry === 'archived') continue;
      const prd = join(root, entry, 'PRD.md');
      try {
        const st = statSync(prd);
        if (!best || st.mtimeMs > best.mtimeMs) best = { path: prd, mtimeMs: st.mtimeMs };
      } catch {
        /* not a PRD dir */
      }
    }
  }
  return best;
}

function sectionPrdDelta(): string {
  const found = latestPrd();
  if (!found) return 'ACTIVE-PRD DELTA: none recorded (no PRD under MEMORY/WORK).';
  const raw = readFileSync(found.path, 'utf-8');
  const lines = raw.split('\n');

  // Frontmatter state lines (phase/status/task/slice/effort/updated) wherever the
  // `key: value` block lives (top-of-file or below the H1, both PRD styles exist).
  const stateKeys = /^(phase|status|task|slice|effort|mode|progress|updated|started|branch):\s/;
  const stateLines = lines.filter((l) => stateKeys.test(l)).slice(0, 8);

  // Criteria-scoped counting via the canonical parser (RFC-0112 fail-soft
  // loader) — a whole-file checkbox sweep over-counts task lists/verification
  // tables. The sweep remains the fallback on a degraded fresh install (or a
  // PRD format the parser does not recognize).
  let checked: number;
  let unchecked: number;
  const scoped = prdAvailable ? countCriteria(raw) : { checked: 0, total: 0 };
  if (scoped.total > 0) {
    checked = scoped.checked;
    unchecked = scoped.total - scoped.checked;
  } else {
    unchecked = lines.filter((l) => /^\s*- \[ \]/.test(l)).length;
    checked = lines.filter((l) => /^\s*- \[x\]/i.test(l)).length;
  }

  // Latest decision entries: lines starting "- D-" (vNext decision log style).
  const decisions = lines.filter((l) => /^\s*- D-\d{4}/.test(l) || /^\s*- D-20\d\d/.test(l)).slice(-3);

  const parts = [
    `ACTIVE-PRD DELTA (most-recent by mtime):`,
    `  PRD: ${found.path} (mtime ${new Date(found.mtimeMs).toISOString()})`,
    ...stateLines.map((l) => `  ${l}`),
    `  criteria: ${checked} checked / ${unchecked} open`,
    ...(decisions.length ? ['  latest decisions:', ...decisions.map((d) => `  ${d.trim()}`)] : []),
  ];
  return cap(parts.join('\n'), SECTION_CAP);
}

// ── section 2: git-diff-since-snapshot ───────────────────────────────────────

interface Baseline {
  modified?: string[];
  untracked?: string[];
  submodules_dirty?: string[];
}

/** Mirror of Tools/session-baseline.ts repoRoot(): the baseline PRODUCER
 *  anchors its `git status` (and its baseline file, at <root>/MEMORY/STATE)
 *  at the canonical repo root — DOS_REPO_ROOT env, else walk up from cwd to
 *  a `.git` DIRECTORY (a `.git` FILE is a worktree/submodule pointer whose
 *  relative paths would not match the producer's), else ~/Durante. Anchoring
 *  the consumer identically keeps the before/after path sets comparable in
 *  worktree sessions. */
function baselineAnchorRoot(cwd: string): string {
  const env = process.env.DOS_REPO_ROOT;
  if (env && existsSync(env)) return env;
  let cur = cwd;
  while (cur) {
    const gitPath = join(cur, '.git');
    try {
      if (existsSync(gitPath) && statSync(gitPath).isDirectory()) return cur;
    } catch {
      /* unreadable .git — keep walking */
    }
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return join(homedir(), 'Durante');
}

function gitPorcelain(cwd: string): string[] {
  // 1.5s hard cap: a locked or huge repo degrades this section instead of
  // stalling the recovery boundary (typical case is tens of ms).
  // Paths are slice(3) WITHOUT trim — identical to the producer's parsing in
  // Tools/session-baseline.ts, so set-membership comparison holds.
  const r = spawnSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf-8', timeout: 1500 });
  if (r.status !== 0 || typeof r.stdout !== 'string') return [];
  return r.stdout.split('\n').filter(Boolean).map((l) => l.slice(3));
}

function sectionGitDelta(sessionId: string, cwd: string, stateDir: string): string {
  const anchorRoot = baselineAnchorRoot(cwd);
  // Candidate order matches the PRODUCER: Tools/session-baseline.ts writes to
  // <anchorRoot>/MEMORY/STATE; the SessionBaseline hook's own STATE_DIR is
  // ~/Durante/MEMORY/STATE on the maintainer install. Project-first
  // resolution stays first for parity with the other sections.
  const stateCandidates = [stateDir, join(anchorRoot, 'MEMORY', 'STATE'), join(homedir(), 'Durante', 'MEMORY', 'STATE')];
  let baseline: Baseline | null = null;
  let baselinePath = '';
  for (const dir of stateCandidates) {
    const p = join(dir, `session-${sessionId}-baseline.json`);
    if (existsSync(p)) {
      try {
        baseline = JSON.parse(readFileSync(p, 'utf-8')) as Baseline;
        baselinePath = p;
        break;
      } catch {
        /* unreadable baseline — treated as absent */
      }
    }
  }

  // Run status at the SAME anchor the producer used, not at raw cwd — in a
  // worktree session the two path sets would otherwise never intersect.
  const now = gitPorcelain(anchorRoot);
  if (now.length === 0 && !baseline) {
    return 'GIT-DIFF-SINCE-SNAPSHOT: none recorded (clean tree or not a git repo; no session baseline).';
  }

  const before = new Set([
    ...(baseline?.modified ?? []),
    ...(baseline?.untracked ?? []),
    ...(baseline?.submodules_dirty ?? []),
  ]);
  const sessionTouched = baseline ? now.filter((p) => !before.has(p)) : now;
  const shown = sessionTouched.slice(0, FILE_LIST_CAP);

  const header = baseline
    ? `GIT-DIFF-SINCE-SNAPSHOT (vs ${baselinePath}):`
    : 'GIT-DIFF-SINCE-SNAPSHOT: no session baseline found — full dirty set shown:';
  const parts = [
    header,
    `  files changed since snapshot: ${sessionTouched.length} (dirty total now: ${now.length})`,
    ...shown.map((p) => `  ${p}`),
    ...(sessionTouched.length > shown.length ? [`  … +${sessionTouched.length - shown.length} more`] : []),
  ];
  return cap(parts.join('\n'), SECTION_CAP);
}

// ── section 3: open-thread delta ─────────────────────────────────────────────

function sectionOpenThreads(sessionId: string, wing: string, stateDir: string): string {
  const parts: string[] = ['OPEN-THREAD DELTA:'];

  // Open Threads block from the wing snapshot (SessionContextSnapshot output).
  // Line-based extraction (a lazy regex with the m flag stops at the first
  // line end via `$` — it silently dropped every thread after the first).
  // Fallback matches the producers here: SessionContextSnapshot + the
  // PreCompact daemon write under ~/.claude/MEMORY/STATE.
  const stateCandidates = [stateDir, join(homedir(), '.claude', 'MEMORY', 'STATE')];
  let threads = '';
  for (const dir of stateCandidates) {
    for (const name of [`next-session-context-${wing}.md`, 'next-session-context-global.md']) {
      const p = join(dir, name);
      if (!existsSync(p)) continue;
      const lines = readFileSync(p, 'utf-8').split('\n');
      const start = lines.findIndex((l) => l.startsWith('## Open Threads'));
      if (start === -1) continue;
      const block: string[] = [];
      for (let i = start + 1; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) break;
        block.push(lines[i]);
      }
      const content = block.join('\n').trim();
      if (content) {
        threads = `  open threads (${name}):\n${content.split('\n').slice(0, 10).map((l) => `  ${l}`).join('\n')}`;
        break;
      }
    }
    if (threads) break;
  }
  parts.push(threads || '  open threads: none recorded.');

  // PreCompact digest breadcrumb (this session's save, else none) — project-first
  // STATE resolution, then the global install path (same order as the other sections).
  let savesPath = '';
  for (const dir of stateCandidates) {
    const p = join(dir, 'precompact-saves.jsonl');
    if (existsSync(p)) {
      savesPath = p;
      break;
    }
  }
  let digest = '';
  if (savesPath) {
    const lines = tailLines(savesPath, 50);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const rec = JSON.parse(lines[i]) as Record<string, unknown>;
        if (rec.session_id === sessionId) {
          const head = String(rec.git_head ?? '').slice(0, 12);
          digest =
            `  precompact digest: drawer ${rec.drawer_id ?? '?'} — task "${rec.prd_task ?? '?'}" ` +
            `(phase ${rec.prd_phase ?? '?'}, progress ${rec.prd_progress ?? '?'}${head ? `, git ${head}` : ''})`;
          break;
        }
      } catch {
        /* skip malformed line */
      }
    }
  }
  parts.push(digest || '  precompact digest: none recorded for this session.');
  return cap(parts.join('\n'), SECTION_CAP);
}

// ── telemetry ────────────────────────────────────────────────────────────────

function writeTelemetry(stateDir: string, record: Record<string, unknown>): void {
  try {
    mkdirSync(stateDir, { recursive: true });
    appendFileSync(join(stateDir, 'resume-probe.jsonl'), `${JSON.stringify(record)}\n`, 'utf-8');
  } catch {
    /* telemetry is best-effort — never fail the hook on it */
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const t0 = performance.now();
  const input = (await readHookInput()) as ProbeInput | null;
  const source = input?.source ?? '';

  // Matcher already scopes us to compact; defense-in-depth for manual invocation.
  if (source !== 'compact') {
    console.log('{}');
    return;
  }

  const sessionId = input?.session_id ?? 'unknown';
  const cwd = process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd();
  const { wing } = resolveProjectWingFromEnv();
  // Resolve the project-first STATE dir ONCE per fire (the getMemorySubdir
  // cascade stats + can self-heal-mkdir; no need to repeat it per section).
  const stateDir = getMemorySubdir('STATE');

  const safe = (fn: () => string, label: string): string => {
    try {
      return fn();
    } catch (err) {
      console.error(`[ResumeProbe] ${label} failed: ${err}`);
      return `${label}: unavailable (probe error — recover manually per doctrine §8).`;
    }
  };

  const prd = safe(() => sectionPrdDelta(), 'ACTIVE-PRD DELTA');
  const git = safe(() => sectionGitDelta(sessionId, cwd, stateDir), 'GIT-DIFF-SINCE-SNAPSHOT');
  const threads = safe(() => sectionOpenThreads(sessionId, wing || 'global', stateDir), 'OPEN-THREAD DELTA');

  const bundle = cap(
    [
      '🧭 RESUME PROBE — mechanical post-compact state recovery (advisory; V21-W3-S2).',
      'The compact summary above is prose; the state below is read from disk just now.',
      'If they disagree, TRUST THIS BUNDLE and re-verify before acting on summarized decisions.',
      '',
      prd,
      '',
      git,
      '',
      threads,
    ].join('\n'),
    BUNDLE_CAP,
  );

  const ms = Math.round(performance.now() - t0);
  writeTelemetry(stateDir, {
    v: 'resume-probe/v1',
    ts: new Date().toISOString(),
    session_id: sessionId,
    wing: wing || 'global',
    sections: {
      prd: !prd.includes('none recorded') && !prd.includes('unavailable'),
      git: !git.includes('none recorded') && !git.includes('unavailable'),
      threads: !threads.includes('none recorded for this session') || threads.includes('open threads ('),
    },
    bundle_bytes: bundle.length,
    ms,
  });

  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: bundle },
    }),
  );
}

const _t = startTimer('ResumeProbe');
process.on('exit', () => stopTimer(_t, 'SessionStart'));
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[ResumeProbe] Fatal:', err);
    // Advisory hook: never break SessionStart.
    console.log('{}');
    process.exit(0);
  });
