#!/usr/bin/env bun
/**
 * SaveWorkflowReceiptsToStudio — workflow run receipts (ISC-30 / audit F6).
 *
 * Native Workflow scripts run with NO filesystem access (Workflow tool
 * contract), so a script cannot append its own receipt. But the harness
 * already persists, per run, a `journal.jsonl` (one `started` + one `result`
 * record per subagent) under
 *   <DOS_DIR>/projects/<project-slug>/<session>/subagents/workflows/wf_<id>/
 * and the run's compiled script at
 *   <DOS_DIR>/projects/<project-slug>/<session>/workflows/scripts/<name>-wf_<id>.js
 *
 * This tool SCANS those (a producer, not a script-side write), synthesizes a
 * receipt per SETTLED run — run_id, workflow name, agents_spawned/completed/
 * errored, timestamp — appends new ones to MEMORY/STATE/workflow-receipts.jsonl,
 * and (when enabled) DLQ-syncs them. A workflow that silently degraded to its
 * skeleton spawns few/no agents, so `agents_spawned` is the observable
 * degradation signal (F6's whole point).
 *
 * Correctness guards (from ISC-30 /code-review):
 *  - TENANT SCOPE: scans only the CURRENT project's transcript slug (derived
 *    from CLAUDE_PROJECT_DIR). Foreign-tenant projects are never read. A
 *    crossTenantGate on the run's absolute transcript path is defense-in-depth
 *    before any post (RFC-0062 F3, mirrors the sibling producers).
 *  - SETTLED-ONLY: a run whose journal.jsonl was modified within STALE_MS is
 *    skipped — a mid-flight run has spawned > completed for a benign reason, so
 *    emitting it would report phantom `agents_errored`. Only quiescent runs are
 *    receipted, so `spawned - completed` is genuine.
 *  - STABLE DEDUP: idempotency key is run_id alone; a settled run posts once and
 *    never refloods (the receipt is immutable once the run is quiescent).
 *  - ROBUST PARSE: journal lines are parsed per-line; a truncated final line
 *    (crashed run) drops that line, not the whole receipt.
 *  - ROUTE GATE: the NET-NEW /api/v1/workflow/receipts route ships in a separate
 *    Platform/studio PR; until then DOS_WORKFLOW_RECEIPTS_SYNC=1 is required to
 *    POST (mirrors SaveTelosToStudio). The local receipts log is always written.
 *
 * Enrichment NOT derivable from the journal (args echo, __argsDegraded flag,
 * budget spent) lives in the MAIN session transcript's Workflow tool-result —
 * a follow-on; those fields are present in the schema as `null`.
 *
 * KNOWN v1 LIMITATIONS (ISC-30 high /code-review — deferred, not blocking):
 *  - COUNT HONESTY: agents_errored = spawned - completed treats every `result`
 *    record as success, so a subagent that errors but still writes a `result`
 *    is counted completed. agents_spawned stays the reliable degradation signal.
 *  - SETTLED HEURISTIC: a run quiet >STALE_MS mid-flight (a wave blocked on a
 *    slow tool) is read as settled and its receipt frozen by run_id dedup. A
 *    completion-aware settled signal is the proper fix (needs a terminal marker
 *    the journal does not yet carry).
 *  - SLUG SCOPE: exact-string slug match scopes to the base project only; git-
 *    worktree sessions carry a suffixed slug and are not yet receipted, and the
 *    crossTenantGate is redundant for same-root (~/.claude) paths — the slug
 *    filter is the real tenant boundary.
 *
 * USAGE:  bun SaveWorkflowReceiptsToStudio.ts --import-all
 */

import { readFileSync, readdirSync, existsSync, statSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

import { queueOrPost, crossTenantGate } from '../Lib/dlq';
import { loadAckedKeys } from '../Lib/dlq-dedup';
import { loadEnv } from '../Lib/env';
import { requireStudioConfigOrSkip } from '../Lib/studioClient';

loadEnv();

/** A run is "settled" once its journal has been quiescent this long. */
const STALE_MS = 120_000;

export interface WorkflowReceipt {
  schema: 'dos-workflow-receipt/v1';
  run_id: string;
  workflow: string;
  agents_spawned: number;
  agents_completed: number;
  agents_errored: number;
  /** Best-effort — needs the session transcript; null until enriched. */
  args_present: boolean | null;
  degraded: boolean | null;
  budget_spent: number | null;
  timestamp: string;
  transcript_dir: string;
  session_id: string;
}

const RUN_ID_RE = /^wf_[a-z0-9-]+$/i;
/** `<name>-wf_<id>.js` → captures the leading workflow name. */
const SCRIPT_NAME_RE = /^(.+)-wf_[a-z0-9-]+\.js$/i;
/** `meta.name` inside `export const meta = { … name: '…' … }` — anchored to the meta block. */
const META_NAME_RE = /export\s+const\s+meta\s*=\s*\{[\s\S]*?\bname:\s*['"]([^'"]+)['"]/;

/** DOS root — matches how loadAckedKeys / queueOrPost resolve MEMORY/STATE (DOS_DIR || homedir/.claude). */
export function dosDir(): string {
  return process.env.DOS_DIR || join(homedir(), '.claude');
}

/**
 * The current tenant's transcript project slug — Claude Code encodes a project
 * dir as its path with every non-alphanumeric run replaced by '-'
 * (`<home>/Durante` → `-home-Durante`). Foreign projects get a different
 * slug and are never scanned.
 */
export function currentProjectSlug(): string | null {
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!dir) return null;
  return dir.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * PURE. Synthesize a receipt from a settled run's parsed journal records and
 * resolved metadata. The counts are the F6-observable facts; because the run is
 * quiescent, `spawned - completed` is genuine error/abandonment, not in-flight.
 */
export function synthesizeReceipt(
  runId: string,
  workflow: string,
  journal: Array<{ type?: string }>,
  meta: { timestamp: string; transcriptDir: string; sessionId: string },
): WorkflowReceipt {
  const spawned = journal.filter((r) => r.type === 'started').length;
  const completed = journal.filter((r) => r.type === 'result').length;
  return {
    schema: 'dos-workflow-receipt/v1',
    run_id: runId,
    workflow,
    agents_spawned: spawned,
    agents_completed: completed,
    agents_errored: Math.max(0, spawned - completed),
    args_present: null,
    degraded: null,
    budget_spent: null,
    timestamp: meta.timestamp,
    transcript_dir: meta.transcriptDir,
    session_id: meta.sessionId,
  };
}

/** Parse a journal.jsonl per-line so one truncated/bad line (a crashed run) never drops the whole receipt. */
export function parseJournalLines(text: string): Array<{ type?: string }> {
  const out: Array<{ type?: string }> = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* skip the bad/truncated line, keep the rest */
    }
  }
  return out;
}

/** Resolve the workflow name for a run: script filename first, else meta.name in the script, else "unknown". */
export function resolveWorkflowName(runId: string, scriptsDir: string): string {
  if (!existsSync(scriptsDir)) return 'unknown';
  for (const f of safeList(scriptsDir)) {
    if (!f.endsWith(`${runId}.js`)) continue;
    const m = f.match(SCRIPT_NAME_RE);
    if (m?.[1]) return m[1];
    try {
      const nm = readFileSync(join(scriptsDir, f), 'utf8').match(META_NAME_RE);
      if (nm?.[1]) return nm[1];
    } catch {
      /* fall through */
    }
  }
  return 'unknown';
}

export interface DiscoverOpts {
  /** Restrict to one transcript project slug (the current tenant). null = all (test only). */
  onlyProjectSlug?: string | null;
  /** Wall-clock ms; a run whose journal mtime is newer than nowMs - STALE_MS is skipped as in-flight. */
  nowMs: number;
}

/** fs ADAPTER: scan the projects root for every SETTLED workflow run's journal → receipts. */
export function discoverReceipts(projectsRoot: string, opts: DiscoverOpts): WorkflowReceipt[] {
  const out: WorkflowReceipt[] = [];
  if (!existsSync(projectsRoot)) return out;
  for (const project of safeDir(projectsRoot)) {
    if (opts.onlyProjectSlug && project !== opts.onlyProjectSlug) continue;
    const projPath = join(projectsRoot, project);
    for (const session of safeDir(projPath)) {
      const wfRoot = join(projPath, session, 'subagents', 'workflows');
      const scriptsDir = join(projPath, session, 'workflows', 'scripts');
      if (!existsSync(wfRoot)) continue;
      for (const runId of safeDir(wfRoot)) {
        if (!RUN_ID_RE.test(runId)) continue;
        const journalPath = join(wfRoot, runId, 'journal.jsonl');
        if (!existsSync(journalPath)) continue;
        let journal: Array<{ type?: string }>;
        let mtimeMs: number;
        let mtimeIso: string;
        try {
          const st = statSync(journalPath);
          mtimeMs = st.mtimeMs;
          mtimeIso = st.mtime.toISOString();
          // SETTLED-ONLY: skip runs still being written (avoids phantom errored).
          if (opts.nowMs - mtimeMs < STALE_MS) continue;
          journal = parseJournalLines(readFileSync(journalPath, 'utf8'));
        } catch {
          continue;
        }
        out.push(
          synthesizeReceipt(runId, resolveWorkflowName(runId, scriptsDir), journal, {
            timestamp: mtimeIso,
            transcriptDir: join(wfRoot, runId),
            sessionId: session,
          }),
        );
      }
    }
  }
  return out;
}

function safeDir(p: string): string[] {
  return safeList(p).filter((n) => {
    try {
      return statSync(join(p, n)).isDirectory();
    } catch {
      return false;
    }
  });
}

function safeList(p: string): string[] {
  try {
    return readdirSync(p);
  } catch {
    return [];
  }
}

/**
 * Append receipts whose run_id is not already in the durable log; returns the
 * count newly written. Independent of Studio config by construction — the F6
 * audit trail is written on EVERY host, per the docstring "always written"
 * contract. (Settled-only means a logged receipt is already final, so run_id
 * dedup is safe.)
 */
export function appendNewReceipts(logPath: string, receipts: WorkflowReceipt[]): number {
  mkdirSync(dirname(logPath), { recursive: true });
  const loggedRuns = existsSync(logPath)
    ? new Set(
        parseJournalLines(readFileSync(logPath, 'utf8')).map(
          (r) => (r as unknown as WorkflowReceipt).run_id,
        ),
      )
    : new Set<string>();
  let logged = 0;
  for (const receipt of receipts) {
    if (loggedRuns.has(receipt.run_id)) continue;
    appendFileSync(logPath, JSON.stringify(receipt) + '\n');
    loggedRuns.add(receipt.run_id);
    logged++;
  }
  return logged;
}

async function importAll(): Promise<void> {
  const receipts = discoverReceipts(join(dosDir(), 'projects'), {
    onlyProjectSlug: currentProjectSlug(),
    nowMs: Date.now(),
  });
  if (receipts.length === 0) {
    console.error('No settled workflow runs found for this project');
    return;
  }

  // Durable local receipts log — written on EVERY host, independent of Studio
  // config. This is the F6 audit trail the docstring guarantees is "always
  // written"; the Studio POST below is a gated, secondary concern.
  // [ISC-30 /code-review fix: requireStudioConfigOrSkip used to precede this and
  //  process.exit(0)'d on non-Studio hosts, silently producing zero receipts.]
  const logPath = join(dosDir(), 'MEMORY', 'STATE', 'workflow-receipts.jsonl');
  const logged = appendNewReceipts(logPath, receipts);

  // Route gate: the /api/v1/workflow/receipts route is NET-NEW (separate
  // Platform/studio PR). Until DOS_WORKFLOW_RECEIPTS_SYNC=1, log locally and
  // skip the POST so we never flood quarantine-route (SaveTelosToStudio pattern).
  const syncEnabled = process.env.DOS_WORKFLOW_RECEIPTS_SYNC === '1';
  if (!syncEnabled) {
    console.error(
      `Import complete: ${receipts.length} settled runs (${logged} newly logged; ` +
        'sync disabled (set DOS_WORKFLOW_RECEIPTS_SYNC=1 once the Studio route ships))',
    );
    return;
  }

  // Studio POST path — safe to require config now: the local log is already durable.
  requireStudioConfigOrSkip('SaveWorkflowReceiptsToStudio');
  const acked = loadAckedKeys('wfreceipt:');
  let synced = 0;
  let skipped = 0;
  let gated = 0;

  for (const receipt of receipts) {
    // Cross-tenant defense: block a foreign transcript path from egress.
    const gate = crossTenantGate({
      tool: 'workflow-receipts',
      endpoint: '/api/v1/workflow/receipts',
      absPath: receipt.transcript_dir.startsWith('/') ? receipt.transcript_dir : null,
      source: 'SaveWorkflowReceiptsToStudio',
      payload: receipt,
    });
    if (!gate.ok) {
      gated++;
      continue;
    }

    // Stable dedup: settled run → immutable receipt → key on run_id alone.
    const key = `wfreceipt:${receipt.run_id}`;
    if (acked.has(key)) {
      skipped++;
      continue;
    }
    try {
      const res = await queueOrPost(receipt, '/api/v1/workflow/receipts', {
        tool: 'workflow-receipts',
        idempotencyKey: key,
      });
      if (res.outcome === 'dropped') console.error(`  dropped ${receipt.run_id}: ${res.reason}`);
      else synced++;
    } catch (err) {
      console.error(`  network error ${receipt.run_id}: ${(err as Error).message}`);
    }
  }

  console.error(
    `Import complete: ${receipts.length} settled runs (${logged} newly logged; ` +
      `${synced} synced, ${skipped} acked, ${gated} cross-tenant-gated)`,
  );
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--import-all') {
    await importAll();
  } else {
    console.error('Usage: bun SaveWorkflowReceiptsToStudio.ts --import-all');
    process.exit(1);
  }
}

export const __testing__ = {
  synthesizeReceipt,
  resolveWorkflowName,
  discoverReceipts,
  parseJournalLines,
  currentProjectSlug,
  appendNewReceipts,
  STALE_MS,
};
