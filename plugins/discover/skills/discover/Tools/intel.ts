/**
 * intel — /discover's INTEL stage (PRD 20260530-225649): a NON-BLOCKING, READ-ONLY query of the
 * operator's GLOBAL palace wing, keyed on the resolved fork name, run AFTER GROUND and BEFORE the
 * interview. Its only job is to surface prior context the interview can CITE — it must never gate.
 *
 * Design contract (ISC-25..32, ANTI-4/5):
 *   - subject = the resolved fork name (basename of the fork root)            [ISC-25]
 *   - wing    = the operator's GLOBAL wing ('global' — mempalace resolves      [ISC-26]
 *               `wing || 'global'`), never the project/fork wing
 *   - 6000ms timeout ceiling passed to the query call                          [ISC-27]
 *   - timeout (AbortError) → zero hits, never throws                           [ISC-28, ANTI-4]
 *   - any query failure (non-zero exit / bad JSON) → zero hits, never throws   [ISC-29, ANTI-5]
 *   - a fresh-fork unknown name simply finds nothing in an empty wing          [ISC-30]
 *   - the result is advisory input to the interview                           [ISC-31]
 *   - READ-ONLY: only the `search` action is ever invoked — no add_drawer /    [ISC-32]
 *     add_kg_fact / any write
 *
 * The bridge call is behind an injectable `QueryRunner` so the timeout/abort/degrade paths are unit
 * testable without a live palace (the default runner spawns the bridge; tests pass a stub).
 */

import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

/** mempalace.ts resolves an unset/null wing to 'global' — the operator's cross-project wing. */
export const GLOBAL_WING = 'global'; // ISC-26
export const INTEL_TIMEOUT_MS = 6000; // ISC-27

export interface IntelHit {
  title?: string;
  content?: string;
  score?: number;
}

export interface IntelResult {
  hits: IntelHit[];
  count: number;
  degraded: boolean; // true = query failed/timed out (NOT "found nothing")
  reason: string | null;
}

/** The only actions this stage may invoke — both READ-ONLY. Writes are unrepresentable (ISC-32 as a type invariant). */
export type ReadAction = 'search' | 'kg_query';

/** Runs one read-only bridge action with a timeout; resolves {status, stdout}, rejects on abort/spawn error. */
export interface QueryRunner {
  (action: ReadAction, payload: Record<string, unknown>, timeoutMs: number): Promise<{ status: number; stdout: string }>;
}

const BRIDGE = join(homedir(), '.claude', 'DOS', 'Tools', 'mempalace_bridge.py');

/** ISC-25: the intel subject is the resolved fork name — the basename of the fork root. */
export function resolveForkName(forkRoot: string): string {
  return basename((forkRoot || '').trim().replace(/\/+$/, '')).trim();
}

/** Default runner: spawns the bridge action, aborting at `timeoutMs` (→ AbortError → degrade). */
export const defaultRunner: QueryRunner = (action, payload, timeoutMs) =>
  new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let out = '';
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn('python3', [BRIDGE, action, JSON.stringify(payload)], { signal: ctrl.signal });
    } catch (err) {
      clearTimeout(timer);
      reject(err);
      return;
    }
    child.stdout?.on('data', (d) => {
      out += d;
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err); // AbortError lands here on timeout
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ status: code ?? 1, stdout: out });
    });
  });

function degraded(reason: string): IntelResult {
  return { hits: [], count: 0, degraded: true, reason };
}

/**
 * Query the GLOBAL palace wing by fork name for advisory prior context. Read-only, 6s ceiling,
 * degrade-to-zero on any failure, NEVER throws (the interview must always proceed — ANTI-4/5).
 */
export async function gatherIntel(
  forkName: string,
  opts: { wing?: string; timeoutMs?: number; limit?: number } = {},
  runQuery: QueryRunner = defaultRunner,
): Promise<IntelResult> {
  const wing = opts.wing ?? GLOBAL_WING; // ISC-26
  const timeoutMs = opts.timeoutMs ?? INTEL_TIMEOUT_MS; // ISC-27
  const payload = { query: forkName, wing, limit: opts.limit ?? 10 }; // ISC-25 subject · ISC-32 read-only `search`
  try {
    const r = await runQuery('search', payload, timeoutMs);
    if (r.status !== 0) return degraded('bridge-nonzero-exit'); // ISC-29
    const text = (r.stdout || '').trim();
    if (!text || (text[0] !== '{' && text[0] !== '[')) return degraded('non-json');
    const parsed = JSON.parse(text) as { error?: unknown; status?: string; results?: unknown; drawers?: unknown };
    if (parsed.error || parsed.status === 'error') return degraded('bridge-error'); // exit-0 error payload ≠ empty wing
    const raw = parsed.results ?? parsed.drawers ?? [];
    const hits = Array.isArray(raw) ? (raw as IntelHit[]) : []; // a non-array payload is malformed → treat as 0, never crash
    return { hits, count: hits.length, degraded: false, reason: null }; // ISC-30: empty wing → 0 hits, NOT degraded
  } catch (err) {
    const reason = (err as Error)?.name === 'AbortError' ? 'timeout' : 'query-error'; // ISC-28 / ISC-29
    return degraded(reason); // ANTI-4/5: never throw — caller proceeds
  }
}

/** ISC-31: fold the intel result into advisory lines the interview can cite. Advisory only — never gates. */
export function intelAdvisory(r: IntelResult): string[] {
  if (r.degraded || !Array.isArray(r.hits) || r.hits.length === 0) return [];
  return r.hits
    .slice(0, 5)
    .map((h) => (h.title || h.content || '').slice(0, 120).trim())
    .filter(Boolean);
}

// CLI: `bun intel.ts <forkRoot>` — prints the advisory result; ALWAYS exits 0 (ANTI-5: degrade is never fatal).
if (import.meta.main) {
  const forkRoot = process.argv[2] || process.cwd();
  const forkName = resolveForkName(forkRoot);
  gatherIntel(forkName)
    .then((r) => {
      process.stdout.write(`${JSON.stringify({ forkName, ...r, advisory: intelAdvisory(r) }, null, 2)}\n`);
      process.exit(0);
    })
    .catch(() => {
      // ANTI-5: degrade is never fatal. Any throw inside the callback
      // (intelAdvisory / stdout.write) still exits 0 with a degraded payload.
      process.stdout.write(`${JSON.stringify({ forkName, degraded: true }, null, 2)}\n`);
      process.exit(0);
    });
}
