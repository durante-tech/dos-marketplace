#!/usr/bin/env bun
/**
 * @pack MemPalace
 * @workflow memory-health-radiator
 *
 * dos-memory-status.ts — RFC-0037 §7 Information Radiator
 *
 * Cockburn's Heart of Agile: "a thing on the wall that tells you what is going on."
 * No analytics, no alerting, no fancy visuals — just sections rendered every time,
 * even when empty / N/A. The discipline is presence, not prettiness.
 *
 * Three modes:
 *   bun ~/Durante/Tools/dos-memory-status.ts            # human-readable
 *   bun ~/Durante/Tools/dos-memory-status.ts --json     # machine-readable
 *   bun ~/Durante/Tools/dos-memory-status.ts --check    # silent, exit code only
 *
 * Exit codes (per RFC-0037 §7.1 + brief):
 *   0 = healthy
 *   1 = warn (1+ warn signals)
 *   2 = stale (1+ stale signals — palace unreachable, KG empty, etc.)
 *
 * Phase 1 metrics:
 *   measurable now: fork, bridge, mcp, chromadb, kg, drift, events, hooks,
 *                   work-volume, canonical
 *   measurable now (post WS-F): recall-coverage, expect-recall counts
 *     populate from MEMORY/LEARNING/SIGNALS/{recall-coverage,expect-recall}.jsonl
 *     written by IntentRetrieval.hook.ts on CANONICAL/EXPECT_RECALL dispatch
 *
 * Implementation discipline:
 *   - Never throw. Every probe degrades to "unavailable" / null on failure.
 *   - Cheap probes only — total wall-clock budget ~3s on a healthy host.
 *   - bridgeSync calls use 5s timeout; fall through on degrade.
 *   - No emojis in code; status glyphs ✓ ⚠ ✗ in human output are conventional
 *     radiator markers, not emojis.
 */

import { createHash } from 'crypto';
import { closeSync, existsSync, lstatSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'fs';
import { spawnSync } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

import { bridgeSync } from '../Lib/mempalace';
import { getDosDir, getMemoryDir, getMemorySubdir } from '../Lib/paths';

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Collapse $HOME prefix to ~ for compact display. Display-only; never used for path resolution. */
function tilde(path: string): string {
  return path.replace(homedir(), '~');
}

// ─── Types ─────────────────────────────────────────────────────────────────

type SectionStatus = 'ok' | 'warn' | 'stale' | 'na';

interface Section {
  key: string;
  display: string;
  status: SectionStatus;
  data: Record<string, unknown>;
}

interface Report {
  ok: boolean;
  generated_at: string;
  exit_code: 0 | 1 | 2;
  sections: Section[];
  status_lines: Array<{ marker: '✓' | '⚠' | '✗'; section: string; note: string }>;
}

// ─── Probes ────────────────────────────────────────────────────────────────

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

function runCommand(
  command: string,
  args: readonly string[],
  timeout: number,
  cwd?: string,
): string | null {
  const result = spawnSync(command, [...args], {
    cwd,
    timeout,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) return null;
  return typeof result.stdout === 'string' ? result.stdout : null;
}

function sha256OfFile(path: string): string | null {
  return safe(() => {
    const buf = readFileSync(path);
    return createHash('sha256').update(buf).digest('hex').slice(0, 12);
  }, null);
}

function probeFork(): Section {
  let version: string | null = null;
  let sha: string | null = null;
  let editable: string | null = null;

  // pip3 show mempalace
  try {
    const out = runCommand('pip3', ['show', 'mempalace'], 3000);
    if (!out) throw new Error('pip3 show mempalace failed');
    version = out.match(/^Version:\s*(.+)$/m)?.[1]?.trim() ?? null;
    editable = out.match(/^Editable project location:\s*(.+)$/m)?.[1]?.trim() ?? null;
  } catch { /* missing pip / package — leave null */ }

  // git -C <editable-dir> rev-parse HEAD
  if (editable && existsSync(editable)) {
    try {
      const head = runCommand('git', ['rev-parse', 'HEAD'], 3000, editable);
      if (!head) throw new Error('git rev-parse failed');
      sha = head.trim().slice(0, 12);
    } catch { /* not a git repo or git missing — leave null */ }
  }

  const status: SectionStatus = version ? 'ok' : 'stale';
  const display = version
    ? `mempalace ${version}${sha ? ` @ ${sha}` : ''}${editable ? ` (editable: ${tilde(editable)})` : ''}`
    : 'unavailable (pip3 show mempalace failed)';
  return { key: 'fork', display, status, data: { version, sha, editable } };
}

// ─── Vendored patches (memory-solution campaign Wave 0, CANDIDATES.md rank #1) ──
//
// The mempalace pip package carries DOS-PATCH-marked edits that live in
// site-packages OUTSIDE git and are wiped by any `pip install --upgrade`
// (measured incident: 3.4.0→3.5.0 wiped both patches, found 11 days later —
// VENDORED-PATCHES.md Re-application log 2026-07-01). This probe compares the
// installed package against the pin in vendored-patches.lock.json (shipped
// next to this tool) on every radiator run, collapsing detection latency from
// days to the next status call. Maintainer-host concern only: on installs
// where ~/.claude is a real directory (customer machines) the probe is n/a.

export interface VendoredPatchManifest {
  pinned_version: string;
  target_file: string;
  expected_markers: number;
  patches: Array<{ id: string; markers: number; desc: string }>;
}

/** Pure classification: fixed inputs → status+note (fixture-testable).
 *  markerCount null = target file missing/unreadable/package unresolvable. */
export function classifyVendoredPatches(
  manifest: VendoredPatchManifest,
  installedVersion: string | null,
  markerCount: number | null,
): { status: SectionStatus; note: string } {
  const n = manifest.expected_markers;
  if (markerCount === null) {
    return { status: 'stale', note: `mempalace ${manifest.target_file} unresolvable — patches presumed WIPED (expected ${n} markers)` };
  }
  if (markerCount === 0) {
    return { status: 'stale', note: `PATCHES WIPED: 0/${n} DOS-PATCH markers in ${manifest.target_file}` };
  }
  if (installedVersion === null) {
    return { status: 'warn', note: `markers ${markerCount}/${n} but installed version unknown` };
  }
  if (installedVersion !== manifest.pinned_version) {
    return { status: 'warn', note: `version drift: installed ${installedVersion} vs pinned ${manifest.pinned_version} — re-verify patches (markers ${markerCount}/${n})` };
  }
  if (markerCount !== n) {
    return { status: 'warn', note: `marker mismatch: ${markerCount}/${n} (partial wipe or upstream absorption)` };
  }
  return { status: 'ok', note: `${markerCount}/${n} markers, mempalace ${installedVersion} == pin` };
}

function probeVendoredPatches(): Section {
  const manifestPath = join(import.meta.dir, 'vendored-patches.lock.json');
  const manifest = safe<VendoredPatchManifest | null>(
    () => JSON.parse(readFileSync(manifestPath, 'utf-8')) as VendoredPatchManifest,
    null,
  );
  if (!manifest) {
    return { key: 'vendored-patches', display: 'n/a (no vendored-patches.lock.json)', status: 'na', data: { manifest: null } };
  }

  // Maintainer gate: the pin describes Lucas's symlink-mode host. A customer
  // install (~/.claude is a real dir) has an unpatched pip by design — n/a.
  const maintainerMode = safe(() => lstatSync(join(homedir(), '.claude')).isSymbolicLink(), false);
  if (!maintainerMode) {
    return {
      key: 'vendored-patches',
      display: 'n/a (not a maintainer install — no vendored-patch pin applies)',
      status: 'na',
      data: { manifest_pin: manifest.pinned_version, maintainer_mode: false },
    };
  }

  // One python spawn resolves both the installed version and the package dir.
  // find_spec (not import) — never executes package code, so a future heavy
  // mempalace __init__ cannot blow the radiator's wall-clock budget.
  let installedVersion: string | null = null;
  let sitePackages: string | null = null;
  const out = runCommand('python3', [
    '-c',
    "import importlib.util as u, importlib.metadata as md; s=u.find_spec('mempalace'); print(md.version('mempalace')); print(list(s.submodule_search_locations)[0])",
  ], 5000);
  if (out) {
    const [v, dir] = out.trim().split('\n');
    installedVersion = v?.trim() || null;
    sitePackages = dir?.trim() || null;
  }

  let markerCount: number | null = null;
  if (sitePackages) {
    const target = join(sitePackages, manifest.target_file);
    markerCount = safe<number | null>(
      () => (readFileSync(target, 'utf-8').match(/DOS-PATCH/g) ?? []).length,
      null,
    );
  }

  const { status, note } = classifyVendoredPatches(manifest, installedVersion, markerCount);
  return {
    key: 'vendored-patches',
    display: note,
    status,
    data: {
      manifest_pin: manifest.pinned_version,
      expected_markers: manifest.expected_markers,
      installed_version: installedVersion,
      markers: markerCount,
      site_packages: sitePackages,
      maintainer_mode: true,
    },
  };
}

function probeBridge(): Section {
  const path = join(getDosDir(), 'DOS', 'Tools', 'mempalace_bridge.py');
  if (!existsSync(path)) {
    return {
      key: 'bridge',
      display: `unavailable (${tilde(path)} missing)`,
      status: 'stale',
      data: { path, action_count: null, sha256: null },
    };
  }

  // Action count — ask the bridge directly via --version (canonical post-V11.13
  // facade split; the historic regex over `ACTIONS = { ... }` no longer matches
  // the `_build_actions_table()` factory call).
  let actionCount: number | null = null;
  try {
    const result = spawnSync('python3', [path, '--version'], { encoding: 'utf-8', timeout: 3000 });
    if (result.status === 0) {
      const parsed = JSON.parse(result.stdout) as { actions?: string[] };
      if (Array.isArray(parsed.actions)) actionCount = parsed.actions.length;
    }
  } catch { /* leave null */ }

  const sha = sha256OfFile(path);
  const status: SectionStatus = actionCount && actionCount > 0 ? 'ok' : 'warn';
  const display = `${actionCount ?? '?'} actions, sha256=${sha ?? 'unknown'}`;
  return { key: 'bridge', display, status, data: { path, action_count: actionCount, sha256: sha } };
}

function probeMcp(): Section {
  // Prefer `which`; fall back to common locations.
  let mcpPath: string | null = null;
  try {
    const out = runCommand('which', ['mempalace-mcp'], 2000);
    if (!out) throw new Error('which mempalace-mcp failed');
    mcpPath = out.trim() || null;
  } catch { /* `which` returned non-zero — fall through */ }

  if (!mcpPath) {
    for (const cand of [
      join(homedir(), '.local', 'bin', 'mempalace-mcp'),
      '/usr/local/bin/mempalace-mcp',
      '/opt/homebrew/bin/mempalace-mcp',
    ]) {
      if (existsSync(cand)) { mcpPath = cand; break; }
    }
  }

  const status: SectionStatus = mcpPath ? 'ok' : 'stale';
  const display = mcpPath ? tilde(mcpPath) : 'missing';
  return { key: 'mcp', display, status, data: { path: mcpPath } };
}

function probeChromadb(): Section {
  // MP-027: 'status' is NOT in PER_ACTION_TIMEOUT_MS, so it resolves to the 5s
  // DEFAULT_BRIDGE_TIMEOUT_MS — too short for a 35k+ drawer corpus (~10s wall).
  // Pass an explicit 30s timeout so a healthy large corpus does not false-alarm.
  const r = bridgeSync('status', {}, 30000);
  if (!r.ok) {
    return {
      key: 'chromadb',
      display: `unavailable (${r.reason.slice(0, 60)})`,
      status: 'stale',
      data: { reason: r.reason },
    };
  }
  const total = (r.data.total_drawers as number | undefined) ?? 0;
  const wingsRaw = (r.data.wings as Record<string, { total?: number }> | undefined) ?? {};
  const wings = Object.entries(wingsRaw)
    .map(([name, w]) => ({ wing: name, drawers: w.total ?? 0 }))
    .sort((a, b) => b.drawers - a.drawers);
  const top5 = wings.slice(0, 5);

  // MP-001/MP-002/MP-028: drawer count comes from ChromaDB's SQLite metadata
  // (collection.count()) and never exercises the HNSW vector index — a corrupt/
  // unloadable index still reports a high count. Issue one cheap vector-liveness
  // search; if it errors while drawers exist, the vector path is dead even though
  // metadata says 'ok'. Guard behind total>0 to stay within the ~3s budget.
  let vectorOk = true;
  let vectorReason: string | null = null;
  if (total > 0) {
    const s = bridgeSync('search', { query: '_healthcheck', limit: 1 }, 10000);
    if (!s.ok) {
      vectorOk = false;
      vectorReason = s.reason.slice(0, 60);
    }
  }

  const status: SectionStatus = total > 0 ? (vectorOk ? 'ok' : 'warn') : 'warn';
  const display = vectorOk
    ? `${total} drawers across ${wings.length} wings; top: ${top5.map(w => `${w.wing}:${w.drawers}`).join(', ')}`
    : `${total} drawers present but vector index unreachable (${vectorReason}) — semantic search degraded`;
  return { key: 'chromadb', display, status, data: { total_drawers: total, wing_count: wings.length, top5, vector_ok: vectorOk, vector_reason: vectorReason } };
}

function probeKg(): Section {
  // Phase 1: prefer direct sqlite3 — faster, gives triples + entities + top
  // predicates in one round-trip, and the bridge `kg_stats` action returns
  // room/edge stats not fact stats. Bridge fallback is reserved for the case
  // where sqlite3 is unavailable or the db file is missing.
  // RFC-0100 Option C (2026-05-15): MEMPALACE relocated to project-level path
  // (~/Durante/MEMORY/MEMPALACE/) to survive submodule deinit. Resolver returns
  // project-first per getMemorySubdir's three-step chain.
  const dbPath = join(getMemorySubdir('MEMPALACE'), 'knowledge_graph.sqlite3');
  if (!existsSync(dbPath)) {
    return {
      key: 'kg',
      display: `unavailable (${tilde(dbPath)} missing)`,
      status: 'stale',
      data: { path: dbPath },
    };
  }

  const sqlite3 = (sql: string): string | null => {
    try {
      // NOTE: `-readonly` flag dropped 2026-05-15. macOS sqlite3 CLI's
      // `-readonly` + absolute-path combination returns SQLITE_CANTOPEN against
      // the post-RFC-0100-migration MEMPALACE db (works against the legacy path
      // but not the project-level one — quirk reproducible with both `/Users/...`
      // and `$HOME/...` forms). All queries here are SELECT-only by SQL semantics;
      // dropping the defensive flag eliminates the quirk without introducing
      // write risk. Bridge KG access remains fully functional.
      const r = spawnSync('sqlite3', [dbPath, sql], { encoding: 'utf-8', timeout: 3000 });
      return r.status === 0 ? r.stdout.trim() : null;
    } catch { return null; }
  };

  const tables = sqlite3(".tables");
  if (tables === null) {
    return {
      key: 'kg',
      display: 'unavailable (sqlite3 cli missing or db locked)',
      status: 'stale',
      data: { path: dbPath, sqlite3: 'unavailable' },
    };
  }

  // Heuristic: mempalace KG schemas vary. Try canonical fact/entity table names; degrade if neither.
  const tableNames = tables.split(/\s+/);
  const tableName = tableNames.find(t => /^(facts|triples|kg_facts)$/.test(t));
  const entitiesTable = tableNames.find(t => /^(entities|kg_entities|nodes)$/.test(t));
  const triples = tableName ? Number(sqlite3(`SELECT COUNT(*) FROM ${tableName};`)) : null;
  const entities = entitiesTable ? Number(sqlite3(`SELECT COUNT(*) FROM ${entitiesTable};`)) : null;

  const top3: Array<{ predicate: string; count: number }> = [];
  if (tableName) {
    const out = sqlite3(`SELECT predicate, COUNT(*) FROM ${tableName} GROUP BY predicate ORDER BY 2 DESC LIMIT 3;`);
    if (out) {
      for (const line of out.split('\n')) {
        const [pred, n] = line.split('|');
        if (pred && n) top3.push({ predicate: pred, count: Number(n) });
      }
    }
  }

  const status: SectionStatus = (triples ?? 0) > 0 ? 'ok' : 'warn';
  const display = `${triples ?? '?'} triples, ${entities ?? '?'} entities; top: ${top3.length > 0 ? top3.map(p => `${p.predicate}:${p.count}`).join(', ') : 'unknown'} (sqlite3)`;
  return {
    key: 'kg',
    display,
    status,
    data: { triples, entities, top3, source: 'sqlite3', path: dbPath },
  };
}

function probeDrift(): Section {
  const palaceDir = join(homedir(), '.mempalace', 'palace');
  if (!existsSync(palaceDir)) {
    return {
      key: 'drift',
      display: `unavailable (${tilde(palaceDir)} missing)`,
      status: 'stale',
      data: { path: palaceDir, drift_count: 0, oldest: null, ttl_due: 0 },
    };
  }

  // Drift dirs follow `<uuid>.drift-YYYYMMDD-HHMMSS` pattern (atomic-write protection).
  // TTL: anything older than 30 days is "ttl-due" for cleanup.
  const TTL_MS = 30 * 24 * 3600 * 1000;
  const now = Date.now();
  let count = 0;
  let oldestMtime = Number.POSITIVE_INFINITY;
  let oldestName: string | null = null;
  let ttlDue = 0;

  try {
    for (const entry of readdirSync(palaceDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/\.drift-\d{8}-\d{6}$/.test(entry.name)) continue;
      count++;
      const mtime = safe(() => statSync(join(palaceDir, entry.name)).mtimeMs, now);
      if (mtime < oldestMtime) { oldestMtime = mtime; oldestName = entry.name; }
      if (now - mtime > TTL_MS) ttlDue++;
    }
  } catch { /* readdir failed — leave count=0 */ }

  // Status: warn when ttl-due > 0; ok otherwise (drift dirs are normal).
  const status: SectionStatus = ttlDue > 0 ? 'warn' : 'ok';
  const oldestAgeDays = oldestName ? Math.round((now - oldestMtime) / 86400000) : null;
  const oldestLabel = oldestName ? `${oldestName} (${oldestAgeDays}d)` : 'none';
  const display = `${count} dirs; oldest=${oldestLabel}; ttl-due=${ttlDue}`;
  return {
    key: 'drift',
    display,
    status,
    data: { drift_count: count, oldest: oldestName, oldest_age_days: oldestAgeDays, ttl_due: ttlDue },
  };
}

function probeEvents(): Section {
  const path = join(getMemoryDir(), 'STATE', 'memory-events.jsonl');
  if (!existsSync(path)) {
    return {
      key: 'events',
      display: 'unavailable (memory-events.jsonl missing)',
      status: 'stale',
      data: { path, tail_count: 0, last_op: null, last_ts: null },
    };
  }

  // Tail-count: read at most last 64KB so files of any size stay cheap.
  // tailCount is the count of *whole* lines in the tail window, not the file —
  // sufficient for the "is the stream still flowing?" radiator question.
  let tailCount = 0;
  let lastOp: string | null = null;
  let lastTs: string | null = null;
  try {
    const sz = statSync(path).size;
    const tailBytes = Math.min(sz, 64 * 1024);
    const fd = openSync(path, 'r');
    const buf = Buffer.alloc(tailBytes);
    readSync(fd, buf, 0, tailBytes, sz - tailBytes);
    closeSync(fd);
    const lines = buf.toString('utf-8').split('\n').filter(l => l.trim().length > 0);
    tailCount = lines.length;
    // MP-103: scan backward for the most recent line carrying a parseable ts
    // so a ts-less / partial trailing line does not suppress the staleness
    // check (which only escalates inside `if (lastTs)`). lastOp still reflects
    // the literal last line for display fidelity.
    const last = lines[lines.length - 1];
    if (last) {
      try {
        const parsed = JSON.parse(last) as { op_kind?: string };
        lastOp = parsed.op_kind ?? null;
      } catch { /* trailing partial line — ignore */ }
    }
    for (let i = lines.length - 1; i >= 0 && lastTs === null; i--) {
      try {
        const ts = (JSON.parse(lines[i]!) as { ts?: string }).ts;
        if (typeof ts === 'string') lastTs = ts;
      } catch { /* skip unparseable line */ }
    }
  } catch { /* leave defaults */ }

  // Status: stale if last event > 7 days old.
  let status: SectionStatus = 'ok';
  if (lastTs) {
    const ageMs = Date.now() - new Date(lastTs).getTime();
    if (ageMs > 7 * 86400000) status = 'stale';
  } else if (tailCount === 0) {
    status = 'warn';
  }
  const display = `${tailCount} tail lines; last=${lastOp ?? 'unknown'}@${lastTs ?? 'unknown'}`;
  return { key: 'events', display, status, data: { path, tail_count: tailCount, last_op: lastOp, last_ts: lastTs } };
}

// RFC-0128 D3: the cross-file `bridge-event-ratio` is RETIRED. A parity ratio
// between two independently-written logs (memory-events.jsonl numerator /
// bridge-actions.jsonl denominator) is structurally fragile — a SIGTERM between
// the two appends tears the pair, and there is no correlation id to rejoin them
// (GregYoung ratification). The health signal moves WITHIN one log
// (memory-events.jsonl): write-success-rate (are mutations persisting?) and the
// served-by distribution (relay/spawn/cli mix). bridge-actions.jsonl is KEPT —
// it has independent consumers (R26 audit invariant, R-FW-7 silent-debt
// baseline); it is simply no longer half of a parity ratio.

// W1-S1 review (#14): 'classify' removed — the bridge classify action is
// read-only text classification (MemPalaceClassifyOnAddDrawer.hook.ts
// documents it as such); it sat in this set by accident of name and counted
// read outcomes against the mutation success rate. Keep in lockstep with
// hooks/lib/mempalace.ts WRITE_ACTIONS.
// PRD-B: single source of truth is the bridge-write-actions fixture (pack
// layout: ../Hooks/lib/fixtures/; the pack_pair deploys the same shape to the
// skills leg). Never re-inline a literal — the fixture test catches it.
import bridgeWriteActionsFixture from '../Hooks/lib/fixtures/bridge-write-actions.json';
const WRITE_ACTIONS = new Set<string>(bridgeWriteActionsFixture.write_actions);

interface BridgeEvent {
  ts?: string;
  // W1-S1: schema version. v>=2 lines are classified by the shared truth table
  // (TS summarizeBridgeResult port + Python _classify_result_status, both
  // stamping v:2 from 2026-06-10). v:1 TS lines systematically misclassified
  // payload-shaped read successes as 'degraded' — metrics that must not mix
  // pre-fix rows filter on v>=2 (D7 forward-only windowing).
  v?: number;
  op_kind?: string;
  via?: string;
  relay?: boolean;
  status?: string;
  result_summary?: string;
}

// W1-S1 ISC-29: by-design rejection markers in result_summary — input
// validation (missing_arg) and predicate-gate blocks are policy outcomes, not
// bridge failures. They are separated out of the write-success denominator and
// surfaced as their own radiator count so they stay visible (GregYoung: the
// metric must not hide them, just stop miscounting them).
// ANCHORED (review finding #3): both writers emit the marker as the structured
// PREFIX of result_summary — Python writes `error:<detail>`, TS writes
// `err:<error_type>`. An unanchored substring match was spoofable by any
// genuine failure whose free-text stderr tail mentioned the words (e.g. a
// predicate-gate WARN line captured into an unrelated crash's stderr).
const REJECTED_BY_DESIGN_RE = /^err(or)?:(missing_arg|predicate-gate)\b/;

/**
 * RFC-0128 D3 (pure): how a bridge invocation was served, derived from the
 * existing `via` + `relay` fields — NO write-path change needed. relay > cli >
 * spawn: a relayed call has relay:true; a direct Python-CLI call carries
 * via:"bridgeCli"; everything else (bridgeSync/bridgeFire/batchOps cold) is a
 * cold subprocess spawn.
 */
export function servedByOf(e: BridgeEvent): 'relay' | 'spawn' | 'cli' {
  if (e.relay === true) return 'relay';
  if (e.via === 'bridgeCli') return 'cli';
  return 'spawn';
}

/**
 * RFC-0128 D3 (pure): write-success-rate over the answerable write actions.
 * Fire-and-forget writes are EXCLUDED — bridgeFire never reads the result, so
 * their success is genuinely unknown and would poison the rate either way.
 */
export function writeSuccessRate(
  events: BridgeEvent[],
  opts?: { minVersion?: number },
): { total: number; ok: number; rejected: number; noop: number; rate: number | null } {
  let total = 0;
  let ok = 0;
  let rejected = 0;
  let noop = 0;
  for (const e of events) {
    if (!e.op_kind || !WRITE_ACTIONS.has(e.op_kind)) continue;
    if (e.status === 'fire-and-forget') continue; // result unknown — not answerable
    // W1-S1 ISC-32: optional post-fix window — only rows classified by the
    // shared truth table (v>=2). Default unfiltered for backward-compatible
    // direct callers/tests.
    if (opts?.minVersion != null && (e.v ?? 1) < opts.minVersion) continue;
    // W1-S1 ISC-29: by-design rejections leave the denominator but stay counted.
    if (e.status === 'error' && REJECTED_BY_DESIGN_RE.test(e.result_summary ?? '')) {
      rejected++;
      continue;
    }
    // Review #9/#13: by-design no-ops (duplicate/skip/not_found/partial — the
    // 'noop' status both writers now emit) are NOT failed mutations and NOT
    // successes either; they leave the denominator and surface as their own
    // count, symmetric with rejected-by-design.
    if (e.status === 'noop') {
      noop++;
      continue;
    }
    total++;
    if (e.status === 'ok') ok++;
  }
  return { total, ok, rejected, noop, rate: total > 0 ? Math.round((ok / total) * 1000) / 1000 : null };
}

/** RFC-0128 D3 (pure): relay/spawn/cli histogram over all events. */
export function servedByDistribution(events: BridgeEvent[]): { relay: number; spawn: number; cli: number; total: number } {
  const d = { relay: 0, spawn: 0, cli: 0, total: 0 };
  for (const e of events) {
    d[servedByOf(e)]++;
    d.total++;
  }
  return d;
}

/** Read the trailing-24h bridge events from memory-events.jsonl (single source). */
function readBridgeEvents24h(eventsPath: string, nowMs: number): BridgeEvent[] {
  return safe(() => {
    const content = readFileSync(eventsPath, 'utf-8');
    const cutoff = nowMs - 24 * 3600 * 1000;
    const out: BridgeEvent[] = [];
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const o = JSON.parse(line) as BridgeEvent;
        if (typeof o.ts !== 'string') continue;
        const t = Date.parse(o.ts);
        if (Number.isNaN(t) || t < cutoff) continue;
        out.push(o);
      } catch { /* malformed line — skip */ }
    }
    return out;
  }, [] as BridgeEvent[]);
}

/**
 * RFC-0128 D3: write-success-rate health (replaces the retired cross-file
 * bridge-event-ratio). The real question — are mutations persisting? — answered
 * from memory-events.jsonl ALONE, so it can never desync the way a two-file
 * parity ratio did.
 */
function probeBridgeWriteSuccess(): Section {
  const eventsPath = join(getMemoryDir(), 'STATE', 'memory-events.jsonl');
  if (!existsSync(eventsPath)) {
    return { key: 'bridge-write-success', display: 'unavailable (no memory-events.jsonl)', status: 'na', data: { events_exists: false } };
  }
  // W1-S1: v>=2 = honest post-fix window (shared-truth-table rows only).
  const w = writeSuccessRate(readBridgeEvents24h(eventsPath, Date.now()), { minVersion: 2 });
  const rej = (w.rejected > 0 ? ` · ${w.rejected} rejected-by-design` : '')
    + (w.noop > 0 ? ` · ${w.noop} noop` : '');
  let status: SectionStatus;
  let display: string;
  if (w.rate === null) {
    status = 'na';
    display = `no answerable v2 writes in 24h (post-fix window warming)${rej}`;
  } else if (w.rate >= 0.98) {
    status = 'ok';
    display = `${w.ok}/${w.total} writes ok (${(w.rate * 100).toFixed(1)}%)${rej}`;
  } else {
    status = 'warn';
    display = `${w.ok}/${w.total} writes ok (${(w.rate * 100).toFixed(1)}% < 98% — mutations failing)${rej}`;
  }
  return { key: 'bridge-write-success', display, status, data: { window_hours: 24, min_version: 2, ...w, healthy_floor: 0.98 } };
}

/**
 * RFC-0128 D3: served-by distribution (informational — no band). The relay/
 * spawn/cli mix IS the migration-progress radiator for Symptom B (too many
 * `cli` = callers bypassing the warm daemon) and answers OQ2/OQ3's frequency
 * question for free.
 */
function probeBridgeServedBy(): Section {
  const eventsPath = join(getMemoryDir(), 'STATE', 'memory-events.jsonl');
  if (!existsSync(eventsPath)) {
    return { key: 'bridge-served-by', display: 'unavailable (no memory-events.jsonl)', status: 'na', data: { events_exists: false } };
  }
  const d = servedByDistribution(readBridgeEvents24h(eventsPath, Date.now()));
  const pct = (n: number): string => (d.total > 0 ? `${Math.round((n / d.total) * 100)}%` : '0%');
  const display = d.total === 0
    ? 'no events in 24h'
    : `relay ${d.relay} (${pct(d.relay)}), spawn ${d.spawn} (${pct(d.spawn)}), cli ${d.cli} (${pct(d.cli)}) of ${d.total}`;
  return { key: 'bridge-served-by', display, status: d.total === 0 ? 'na' : 'ok', data: { window_hours: 24, ...d } };
}

function probeHooks(): Section {
  const hookDir = join(getDosDir(), 'hooks');
  if (!existsSync(hookDir)) {
    return {
      key: 'hooks',
      display: 'unavailable (hooks/ missing)',
      status: 'stale',
      data: { count: 0, last_mtime: null },
    };
  }

  let count = 0;
  let lastMtime = 0;
  try {
    for (const entry of readdirSync(hookDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.hook.ts')) continue;
      count++;
      const m = safe(() => statSync(join(hookDir, entry.name)).mtimeMs, 0);
      if (m > lastMtime) lastMtime = m;
    }
  } catch { /* leave defaults */ }

  const status: SectionStatus = count > 0 ? 'ok' : 'warn';
  const display = `${count} hooks; last mtime=${lastMtime ? new Date(lastMtime).toISOString() : 'unknown'}`;
  return { key: 'hooks', display, status, data: { count, last_mtime: lastMtime ? new Date(lastMtime).toISOString() : null } };
}

// Project-first MEMORY subdir resolution WITHOUT getMemorySubdir's mkdirSync
// self-heal. A read-only status probe must not mutate disk, and probeCanonical
// needs the genuine "missing" signal — a self-healed dir would always look
// present, masking the exact un-scaffolded state the probe exists to detect.
// Mirrors getMemorySubdir's project-first chain (CLAUDE_PROJECT_DIR → cwd →
// global) by existence, creating nothing.
function resolveMemorySubdirReadOnly(subdir: string): string {
  for (const base of [process.env.CLAUDE_PROJECT_DIR, process.cwd()]) {
    if (!base) continue;
    const p = join(base, 'MEMORY', subdir);
    if (existsSync(p)) return p;
  }
  return join(getMemoryDir(), subdir); // global fallback (existence checked by caller)
}

function probeWorkVolume(): Section {
  // ISC-14: resolve WORK project-first (not the GLOBAL getMemoryDir tree, which
  // counts ~/.claude/MEMORY/WORK instead of the project's ~/Durante/MEMORY/WORK —
  // the radiator reported 12 PRDs instead of 254). Read-only resolver: no mkdir.
  const workDir = resolveMemorySubdirReadOnly('WORK');
  const activeDir = join(workDir, 'active');
  const archivedDir = join(workDir, 'archived');
  // MP-104: resolve the RFC corpus relative to the active project root rather
  // than hardcoding ~/Durante, so off-canonical / customer / CI installs still
  // find Plans/Specs instead of silently reading 0 RFCs.
  const rfcGlob = join(process.env.CLAUDE_PROJECT_DIR ?? join(homedir(), 'Durante'), 'Plans', 'Specs');

  const countDirs = (path: string): number => safe(() => {
    if (!existsSync(path)) return 0;
    return readdirSync(path, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{8}-\d{6}_/.test(d.name))
      .length;
  }, 0);

  // ISC-14: total = flat (top-level YYYYMMDD-HHMMSS_ dirs) + the nested active/ +
  // archived/ buckets (RFC-0037 §4.1). Top-level-only under-counted the split — the
  // active/ PRDs (every PRD authored under the split) were missing from the total.
  // countDirs returns 0 for missing dirs — no pre-check needed.
  const flat = countDirs(workDir);
  const active = countDirs(activeDir);
  const archived = countDirs(archivedDir);
  const total = flat + active + archived;
  const hasSplit = existsSync(activeDir) || existsSync(archivedDir);

  const rfcCount = safe(() =>
    readdirSync(rfcGlob).filter(n => /^RFC-\d{4}.*\.md$/.test(n)).length, 0);

  // RFC-0037 §1.3: 13:1 receipts-to-canon is the diagnosis. Ratio = WORK/RFC.
  const ratio = rfcCount > 0 ? Math.round((total / rfcCount) * 10) / 10 : null;

  // Status: warn when ratio > 10:1 (Pragmatic Boiled Frog).
  const status: SectionStatus = ratio !== null && ratio > 10 ? 'warn' : 'ok';
  const splitState = hasSplit
    ? `flat=${flat}, active=${active}, archived=${archived}`
    : 'flat (no active/archived split)';
  const display = `${total} PRDs (${splitState}); RFCs=${rfcCount}; ratio=${ratio ?? 'n/a'}`;
  return {
    key: 'work-volume',
    display,
    status,
    data: { total, flat, active, archived, rfc_count: rfcCount, ratio, has_split: hasSplit },
  };
}

function probeCanonical(): Section {
  // ISC-14: project-first, not GLOBAL. Read-only resolver (no mkdir self-heal) so
  // the "missing (Phase 0a)" signal below still fires on a genuinely absent dir.
  const dir = resolveMemorySubdirReadOnly('CANONICAL');
  if (!existsSync(dir)) {
    return {
      key: 'canonical',
      display: 'missing (Phase 0a deliverable)',
      status: 'stale',
      data: { path: dir, file_count: 0, exists: false },
    };
  }
  const count = safe(() => readdirSync(dir).filter(n => n.endsWith('.md')).length, 0);
  const status: SectionStatus = count > 0 ? 'ok' : 'warn';
  return { key: 'canonical', display: `${count} files`, status, data: { path: dir, file_count: count, exists: true } };
}

function probeRecallCoverage(): Section {
  // RFC-0037 §5.6 WS-F shipped 2026-05-02 — IntentRetrieval.hook.ts now logs
  // CANONICAL dispatches to MEMORY/LEARNING/SIGNALS/recall-coverage.jsonl.
  // Phase 1 surfaces the cumulative count; ratio computation (RecallAdapter
  // hits / total OBSERVE-phase memory reads) is Phase 2 work pending a
  // denominator — for now, count is the radiator's primary signal.
  const path = join(getMemoryDir(), 'LEARNING', 'SIGNALS', 'recall-coverage.jsonl');
  if (!existsSync(path)) {
    return {
      key: 'recall-coverage',
      display: '0 canonical dispatches logged',
      status: 'ok',
      data: { path, exists: false, count: 0 },
    };
  }
  const lines = safe(
    () => readFileSync(path, 'utf-8').split('\n').filter(l => l.trim().length > 0).length,
    0,
  );
  return {
    key: 'recall-coverage',
    display: `${lines} canonical dispatches logged`,
    status: 'ok',
    data: { path, exists: true, count: lines },
  };
}

function probeExpectRecall(): Section {
  const path = join(getMemoryDir(), 'LEARNING', 'SIGNALS', 'expect-recall.jsonl');
  if (!existsSync(path)) {
    // WS-F shipped — log path is now real even when no events have fired yet.
    // Report 0 rather than n/a so the radiator surfaces presence not absence.
    return {
      key: 'expect-recall',
      display: '0 signal events logged',
      status: 'ok',
      data: { path, exists: false, count: 0 },
    };
  }
  // Log exists — surface tail count; no rate computation in Phase 1.
  const lines = safe(() => readFileSync(path, 'utf-8').split('\n').filter(l => l.trim().length > 0).length, 0);
  return {
    key: 'expect-recall',
    display: `${lines} signal events logged`,
    status: 'ok',
    data: { path, exists: true, count: lines },
  };
}

// 28D delivery sprint D18 — destructive_attempts_blocked counter.
// RmGuard.hook.ts records every blocked rm/git-clean/etc. attempt to
// MEMORY/STATE/destructive-attempts-blocked.jsonl. Per indydevdan "DELETE
// the BASH Tool" thesis: when the blocked-rate rises across model
// upgrades, agents are becoming more goal-seeking-at-any-cost — escalate
// security level (L3 → L4 → L5). 7-day rolling window surfaces the trend.
function probeDestructiveAttempts(): Section {
  const path = join(getMemorySubdir('STATE'), 'destructive-attempts-blocked.jsonl');
  if (!existsSync(path)) {
    return { key: 'destructive-blocks', display: 'no destructive attempts logged', status: 'ok', data: { exists: false } };
  }
  const lines = safe(() => readFileSync(path, 'utf-8').split('\n').filter(l => l.trim().length > 0), [] as string[]);
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
  let count7d = 0;
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as { timestamp?: string };
      if (entry.timestamp && new Date(entry.timestamp).getTime() >= sevenDaysAgo) count7d += 1;
    } catch {
      // skip malformed lines silently
    }
  }
  // Threshold: 0 = healthy, 1-9 = ok-but-watch, 10+ = warn (escalation signal)
  const status: SectionStatus = count7d >= 10 ? 'warn' : 'ok';
  return {
    key: 'destructive-blocks',
    display: `${count7d} blocked in 7d (${lines.length} total)`,
    status,
    data: { path, exists: true, total: lines.length, last_7d: count7d },
  };
}

// 28D delivery sprint D25 — verifier-cost-ratio metric.
// Per indydevdan "GPT-5.5 VERIFIED Opus 4.7" — verifier sub-agents typically
// consume 2-5× builder tokens (Opus 4% / GPT-5.5 23% in their demo). Surface
// the ratio so operators see whether the verifier is well-budgeted vs over/under.
// Source: MEMORY/STATE/verifier-reports/*.json (one per Stop hook fire).
function probeVerifierCostRatio(): Section {
  const dir = join(getMemorySubdir('STATE'), 'verifier-reports');
  if (!existsSync(dir)) {
    return { key: 'verifier-cost', display: 'no verifier reports yet', status: 'ok', data: { exists: false } };
  }
  const files = safe(() => readdirSync(dir).filter(f => f.endsWith('.json')), [] as string[]);
  if (files.length === 0) {
    return { key: 'verifier-cost', display: 'verifier-reports dir empty', status: 'ok', data: { exists: true, count: 0 } };
  }
  // Phase 1: surface count + most-recent-file age; full token-ratio computation
  // requires the schema port (D2 follow-up sprint) to land structured cost fields.
  const stat = safe(() => statSync(join(dir, files[files.length - 1]!)), null);
  const ageMs = stat ? Date.now() - stat.mtime.getTime() : null;
  const ageDays = ageMs != null ? Math.floor(ageMs / (24 * 3600 * 1000)) : null;
  const display = ageDays != null
    ? `${files.length} reports; most recent ${ageDays}d ago`
    : `${files.length} reports`;
  return {
    key: 'verifier-cost',
    display,
    status: 'ok',
    data: { path: dir, count: files.length, last_report_age_days: ageDays },
  };
}

// 2026-05-18 — R-FW Phase 1 silent-debt radiator. Reads the R-FW-7 baseline
// at MEMORY/STATE/closure-debt-baseline.json and reports new (post-baseline)
// silent-verification-debt PRD count. Gracefully no-ops if baseline absent
// (pre-R-FW-7 environments). Live count is the baseline's
// total_legacy_prds, refreshed by re-running build-closure-debt-baseline.ts.
// To get the LIVE (current) count separate from the historical baseline,
// re-run the builder script and re-read this file. Phase 2 may add a
// dos-memory-status.ts subprocess call that recomputes live count on each
// status invocation; Phase 1 keeps it cheap and reads-only.
function probeSilentDebt(): Section {
  const path = join(homedir(), '.claude', 'MEMORY', 'STATE', 'closure-debt-baseline.json');
  if (!existsSync(path)) {
    return { key: 'silent-debt', display: 'no R-FW-7 baseline yet (run Tools/build-closure-debt-baseline.ts)', status: 'ok', data: { exists: false } };
  }
  try {
    const baseline = JSON.parse(readFileSync(path, 'utf-8')) as {
      total_legacy_prds?: number;
      total_legacy_unchecked_iscs?: number;
      by_project?: Record<string, { prds: number; unchecked_iscs: number }>;
      ship_date?: string;
    };
    const legacy = baseline.total_legacy_prds ?? 0;
    const unchecked = baseline.total_legacy_unchecked_iscs ?? 0;
    return {
      key: 'silent-debt',
      display: `${legacy} legacy PRDs (${unchecked} unchecked ISCs grandfathered as of ${baseline.ship_date ?? 'unknown'})`,
      // Baseline is informational by design — these are pre-rule PRDs already
      // grandfathered. NEW (post-baseline) silent debt would be surfaced by
      // R71 directly via Sentinel scan, not by this radiator line. Phase 2
      // may add a `live_count` field to the baseline that this probe can
      // compare and warn when it grows.
      status: 'ok',
      data: { path, baseline },
    };
  } catch (err) {
    return { key: 'silent-debt', display: `baseline parse error: ${err instanceof Error ? err.message : String(err)}`, status: 'warn', data: { path } };
  }
}


// ─── TELOS freshness + purpose coverage (v0.0.20 slice 0b) ─────────────────
//
// The TELOS frame's authority depends on (a) a fresh corpus and (b) the KG
// actually holding the goals the corpus declares (campaign §6). GREEN when the
// corpus is <30d old AND KG goal-fact count == corpus anchor count; RED when
// the counts diverge (SyncTelos drifted) — a diverged frame must not rank work.

/**
 * G1 (dos#369 review #2, pure): distinct-goal count from raw bridge CLI
 * stdout, or -1 for "unavailable". The bridge exits 0 with an in-band error
 * envelope on failure (its documented contract) — including the new
 * daemon-relay-miss suppression envelope ({isError:true, status:'error',
 * error_type:'daemon_relay_miss', NO facts key}). Naively reading
 * `.facts ?? []` on such an envelope misread "bridge degraded" as
 * "KG holds 0 goals" → a FALSE 'DIVERGED 0/N' verdict. Any error-shaped or
 * non-object payload maps to -1 → the existing 'unavailable' sentinel; a
 * genuine `{facts: []}` still counts as 0 (a real divergence signal).
 */
export function kgGoalsFromBridgeOut(out: string): number {
  try {
    const parsed: unknown = JSON.parse(out);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return -1;
    const p = parsed as { isError?: unknown; status?: unknown; facts?: unknown };
    if (p.isError === true || p.status === 'error') return -1;
    if (!Array.isArray(p.facts)) return -1;
    return new Set(
      p.facts
        .filter((fc: { subject?: unknown }) => String(fc?.subject).startsWith('goal:'))
        .map((fc: { subject?: unknown }) => String(fc?.subject)),
    ).size;
  } catch {
    return -1;
  }
}

function probeTelos(): Section {
  return safe(() => {
    const { execFileSync } = require('child_process') as typeof import('child_process');
    const { existsSync, readFileSync, readdirSync, statSync } = require('fs') as typeof import('fs');
    const { join } = require('path') as typeof import('path');
    const { homedir } = require('os') as typeof import('os');
    const envDir = process.env.DURANTE_TELOS_DIR;
    const dir = envDir
      ? envDir.replace(/^~(?=\/|$)/, homedir()).replace(/^\$HOME(?=\/|$)/, homedir())
      : join(homedir(), '.durante', 'user', 'TELOS');
    if (!existsSync(dir)) {
      return { key: 'telos', display: `corpus absent at ${dir}`, status: 'warn', data: { dir } } as Section;
    }
    const goalsPath = join(dir, 'goals.md');
    const anchors = existsSync(goalsPath)
      ? [...readFileSync(goalsPath, 'utf8').matchAll(/<!-- telos:[a-f0-9-]{36} -->/g)].length
      : 0;
    const newestMtime = readdirSync(dir)
      .filter((x: string) => x.endsWith('.md'))
      .reduce((acc: number, x: string) => Math.max(acc, statSync(join(dir, x)).mtimeMs), 0);
    const ageDays = Math.round((Date.now() - newestMtime) / 86_400_000);
    let kgGoals = -1;
    try {
      const bridge = join(process.env.DOS_DIR || join(homedir(), '.claude'), 'DOS', 'Tools', 'mempalace_bridge.py');
      const out = execFileSync('python3', [bridge, 'kg_query_predicate', JSON.stringify({ predicate: 'targets' })], { timeout: 15000, encoding: 'utf8' });
      // G1 (dos#369 review #2): error envelopes (exit 0 by bridge contract,
      // incl. the daemon-relay-miss suppression envelope) → -1 'unavailable',
      // NOT a false 'DIVERGED 0/N'. Pure helper, tested with canned envelopes.
      kgGoals = kgGoalsFromBridgeOut(out);
    } catch { /* bridge degraded — kgGoals stays -1 */ }
    const coverageOk = kgGoals === anchors && anchors > 0;
    const fresh = ageDays < 30;
    const display = `freshness ${ageDays}d ${fresh ? '(fresh)' : '(STALE >30d)'} · purpose-coverage KG ${kgGoals < 0 ? 'unavailable' : kgGoals}/${anchors} goals${coverageOk ? '' : ' — DIVERGED (run SyncTelos)'}`;
    const status: SectionStatus = kgGoals < 0 ? 'warn' : coverageOk && fresh ? 'ok' : coverageOk ? 'warn' : 'stale';
    return { key: 'telos', display, status, data: { dir, age_days: ageDays, kg_goals: kgGoals, corpus_anchors: anchors } } as Section;
  }, { key: 'telos', display: 'probe error', status: 'warn', data: {} } as Section);
}

// ─── Composition ───────────────────────────────────────────────────────────

export function buildReport(): Report {
  const sections: Section[] = [
    probeFork(),
    probeVendoredPatches(), // memory-solution campaign Wave 0 — wipe probe
    probeBridge(),
    probeMcp(),
    probeChromadb(),
    probeKg(),
    probeDrift(),
    probeEvents(),
    probeBridgeWriteSuccess(),
    probeBridgeServedBy(),
    probeHooks(),
    probeWorkVolume(),
    probeCanonical(),
    probeRecallCoverage(),
    probeExpectRecall(),
    probeDestructiveAttempts(), // 28D sprint D18
    probeVerifierCostRatio(),   // 28D sprint D25
    probeSilentDebt(),          // R-FW Phase 1 — 2026-05-18 silent-verification-debt
    probeTelos(),               // v0.0.20 slice 0b — telos-freshness + purpose-coverage
  ];

  // Status lines: only emit for non-ok / non-na sections (radiator surfaces problems).
  const statusLines: Report['status_lines'] = [];
  let anyStale = false;
  let anyWarn = false;
  for (const s of sections) {
    if (s.status === 'stale') {
      anyStale = true;
      statusLines.push({ marker: '✗', section: s.key, note: s.display });
    } else if (s.status === 'warn') {
      anyWarn = true;
      statusLines.push({ marker: '⚠', section: s.key, note: s.display });
    } else if (s.status === 'ok') {
      statusLines.push({ marker: '✓', section: s.key, note: s.display });
    }
  }

  const exit_code: 0 | 1 | 2 = anyStale ? 2 : anyWarn ? 1 : 0;
  return {
    ok: exit_code === 0,
    generated_at: new Date().toISOString(),
    exit_code,
    sections,
    status_lines: statusLines,
  };
}

// ─── Renderers ─────────────────────────────────────────────────────────────

const RULE = '─'.repeat(45);

const SECTION_ORDER: Array<{ key: string; label: string }> = [
  { key: 'fork',            label: 'fork:           ' },
  { key: 'vendored-patches', label: 'vendored-patches:' },
  { key: 'bridge',          label: 'bridge:         ' },
  { key: 'mcp',             label: 'mcp:            ' },
  { key: 'chromadb',        label: 'chromadb:       ' },
  { key: 'kg',              label: 'kg:             ' },
  { key: 'drift',           label: 'drift:          ' },
  { key: 'events',          label: 'events:         ' },
  { key: 'bridge-write-success', label: 'bridge-write-success:' },
  { key: 'bridge-served-by', label: 'bridge-served-by:' },
  { key: 'hooks',           label: 'hooks:          ' },
  { key: 'work-volume',     label: 'work-volume:    ' },
  { key: 'canonical',       label: 'canonical:      ' },
  { key: 'recall-coverage', label: 'recall-coverage:' },
  { key: 'expect-recall',   label: 'expect-recall:  ' },
  { key: 'destructive-blocks', label: 'destructive-blocks:' },
  { key: 'verifier-cost',   label: 'verifier-cost:  ' },
  { key: 'silent-debt',     label: 'silent-debt:    ' },
];

export function renderHuman(report: Report): string {
  const lines: string[] = [];
  lines.push(`DOS Memory Status — ${report.generated_at}`);
  lines.push(RULE);
  const byKey = new Map(report.sections.map(s => [s.key, s]));
  for (const { key, label } of SECTION_ORDER) {
    const s = byKey.get(key);
    lines.push(`${label} ${s ? s.display : 'n/a'}`);
  }
  lines.push(RULE);
  for (const sl of report.status_lines) {
    lines.push(`${sl.marker} ${sl.section}: ${sl.note}`);
  }
  return lines.join('\n');
}

export function renderJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}

// ─── Entry point ───────────────────────────────────────────────────────────

function main(argv: string[]): { stdout: string; exitCode: number } {
  const isJson = argv.includes('--json');
  const isCheck = argv.includes('--check');

  const report = buildReport();

  if (isCheck) {
    return { stdout: '', exitCode: report.exit_code };
  }
  if (isJson) {
    return { stdout: renderJson(report), exitCode: report.exit_code };
  }
  return { stdout: renderHuman(report), exitCode: report.exit_code };
}

if (import.meta.main) {
  const result = main(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout + '\n');
  process.exit(result.exitCode);
}

// Exports for testing.
export { main };
