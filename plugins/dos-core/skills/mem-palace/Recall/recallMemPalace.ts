/**
 * recallMemPalace.ts — RFC-0037 Phase 1, Workstream WS-D.
 *
 * Named recall function for the MemPalace primitive. Composes two backends
 * (palace + Studio mirror) into a RecallMemPalaceResult. Per SandiMetz
 * Shameless Green discipline (RFC-0037 §5.4 + Council R2 ratification),
 * types are HARDCODED LOCAL — no shared types.ts. Workstreams C/E for
 * recallStudio/recallGatewayEnv do the same. Consolidation happens in WS-F
 * only if duplication speaks.
 *
 * Contract notes:
 *   - Never throws. All backend errors collapse into RecallMemPalaceResult
 *     with status=conflicted/orphaned and a conflicts[] entry.
 *   - precedence default = 'operator-wins' because palace state is local
 *     to the operator's machine; the fork-pointer is operator state.
 *   - claim_uuid = sha256 of canonical-JSON of the composed value field;
 *     deterministic for identical bytes (verified by test 2).
 */

import { createHash } from 'node:crypto';
// IMPORTANT: pack source cannot resolve sibling pack-internal imports because
// helper modules (./tab-constants, ./paths, ./atomic-write) only exist at the
// live install path. Per MEMORY.md "pack-install-runtime-path-quirk", this
// file MUST run from its installed location ~/.claude/skills/mem-palace/Recall/
// where ../../../hooks/lib/mempalace resolves to ~/.claude/hooks/lib/mempalace.
// Under symlink mode the live tree IS the submodule, so the same physical
// file backs both pack-source compile checks (after copy-to-live) and the
// production runtime path.
import { bridgeSync } from '../Lib/mempalace';

// ─── LOCAL types (do NOT extract to shared types.ts yet) ────────────────────

type ClaimStatus =
  | 'current'
  | 'superseded'
  | 'draft'
  | 'stale'
  | 'archived'
  | 'conflicted'
  | 'orphaned'
  | 'contradicted';

type Precedence = 'operator-wins' | 'global-wins' | 'newest-wins';

type BackendId = 'palace' | 'studio-mirror' | 'kg' | 'filesystem';

type MemPalaceClaim = {
  primitive_name: 'MemPalace';
  claim_uuid: string;
  value: {
    fork_version?: string;
    fork_sha?: string;
    bridge_actions?: number;
    chromadb_drawers_durante?: number;
    kg_facts_durante?: number;
    last_harvest?: string;
    [key: string]: unknown;
  };
  status: ClaimStatus;
  valid_from: string;
  valid_to?: string;
  source: BackendId;
  precedence: Precedence;
  supersedes?: string[];
};

type RecallMemPalaceResult = {
  primitive: 'MemPalace';
  current: MemPalaceClaim | null;
  superseded: MemPalaceClaim[];
  draft: MemPalaceClaim[];
  sources: BackendId[];
  conflicts: Array<{ backendA: BackendId; backendB: BackendId; reason: string }>;
};

// ─── Helpers (kept inline; no shared module yet) ────────────────────────────

const STALE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

/**
 * Canonical-JSON sha256 over the claim value. Object keys are sorted so the
 * UUID is deterministic regardless of JS property-insertion order.
 */
function canonicalClaimUuid(value: Record<string, unknown>): string {
  const sortedKeys = Object.keys(value).sort();
  const canonical: Record<string, unknown> = {};
  for (const k of sortedKeys) canonical[k] = value[k];
  const bytes = JSON.stringify(canonical);
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Read palace status + a small MemPalace-topic search. Returns the composed
 * value fragment plus a flag for whether palace responded at all. Never
 * throws; bridgeSync already returns a discriminated result.
 */
// Injectable bridge surface (MP-024): readPalace/recallMemPalace accept a
// bridge fn so tests can stub palace responses without spawning the real uv
// subprocess. Defaults to the imported bridgeSync. Mirrors how recallStudio
// keeps its bridge call mockable via a runtime boundary.
type BridgeFn = typeof bridgeSync;

function readPalace(bridge: BridgeFn = bridgeSync): {
  reachable: boolean;
  value: Record<string, unknown>;
  reason?: string;
} {
  const value: Record<string, unknown> = {};
  let reachable = false;
  let reason: string | undefined;

  const status = bridge('status', {}, 5000, false);
  if (status.ok) {
    reachable = true;
    const data = status.data as Record<string, unknown>;
    // bridge.status returns counts under the keys defined at
    // _bridge_palace.py:783-792: { total_drawers, knowledge_graph, version, ... }.
    // The drawer count is total_drawers; KG facts are nested under
    // knowledge_graph (kg.stats() returns { entities, triples, current_facts,
    // ... }). The flat keys read previously (drawers/kg_facts/actions/
    // last_harvest) never existed in the payload, so every field except
    // fork_version was silently undefined (MP-039).
    if (typeof data.total_drawers === 'number') value.chromadb_drawers_durante = data.total_drawers;
    const kg = data.knowledge_graph as Record<string, unknown> | undefined;
    if (kg && typeof kg.triples === 'number') value.kg_facts_durante = kg.triples;
    if (typeof data.version === 'string') value.fork_version = data.version;
  } else {
    reason = status.reason;
  }

  // The search is best-effort context; failure here does NOT mark the palace
  // unreachable. We only care about top-hit recency for downstream `last_harvest`
  // inference if the status call didn't expose one.
  if (reachable && !value.last_harvest) {
    const search = bridge(
      'search',
      { query: 'MemPalace fork version status', wing: 'durante', limit: 3 },
      5000,
      false,
    );
    if (search.ok) {
      const results = (search.data.results || search.data.matches || []) as Array<{
        metadata?: { created_at?: string; timestamp?: string };
      }>;
      const topTs = results[0]?.metadata?.created_at || results[0]?.metadata?.timestamp;
      if (typeof topTs === 'string') value.last_harvest = topTs;
    }
  }

  return { reachable, value, reason };
}

/**
 * Probe Studio mirror for recent MemPalace-related WorkSession rows. Falls
 * back to { reachable: false } when STUDIO_API_URL is unset OR the HTTP
 * call fails for any reason. The contract is "soft" — Studio is a read-side
 * convenience here, not authoritative.
 */
async function readStudioMirror(): Promise<{
  reachable: boolean;
  value: Record<string, unknown>;
  reason?: string;
}> {
  // studioClient:exempt — fallback pattern chosen by parallel session (commit c090085e); see submodule f93ed21
  const endpoint = process.env.STUDIO_API_URL ?? process.env.DOS_STUDIO_ENDPOINT;
  if (!endpoint) {
    return { reachable: false, value: {}, reason: 'STUDIO_API_URL unset' };
  }
  const apiKey = process.env.STUDIO_API_KEY ?? process.env.DOS_GATEWAY_API_KEY;
  const url = `${endpoint.replace(/\/+$/, '')}/api/v1/work?slug=*mempalace*&limit=5`;
  try {
    // 3s timeout — Studio mirror is best-effort context, never a blocker.
    // AbortSignal.timeout protects against connection-refused hangs on macOS
    // where bare fetch can stall indefinitely.
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) {
      return { reachable: false, value: {}, reason: `studio http ${res.status}` };
    }
    const body = (await res.json()) as Record<string, unknown>;
    // Studio /api/v1/work returns rows under `work` (sibling recallStudio.ts
    // proves this; recallStudio.test.ts stubs { work: [...] }). The previous
    // `body.rows` key never matched, so studio_mempalace_rows_recent was
    // permanently 0 and studio-mirror was never added as a source (MP-023/MP-025).
    const rows = (body.work ||
      body.items ||
      body.results ||
      (Array.isArray(body) ? body : [])) as Array<Record<string, unknown>>;
    const value: Record<string, unknown> = { studio_mempalace_rows_recent: rows.length };
    return { reachable: true, value };
  } catch (err) {
    return {
      reachable: false,
      value: {},
      reason: `studio fetch error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function decideStatus(
  palaceReachable: boolean,
  composedValue: Record<string, unknown>,
): ClaimStatus {
  if (!palaceReachable) return 'orphaned';
  if (!composedValue.fork_version) {
    // Palace responded but didn't expose fork_version. Soft-degrade to stale
    // rather than current — the operator should know the bridge metadata is
    // thinner than expected.
    return 'stale';
  }
  const lastHarvest = composedValue.last_harvest;
  if (typeof lastHarvest === 'string') {
    const harvestMs = Date.parse(lastHarvest);
    // A present-but-unparseable last_harvest must NOT optimistically read as
    // fresh (MP-099b). recallStudio.computeStatus guards Number.isNaN and
    // degrades; mirror that here instead of falling through to 'current'.
    if (!Number.isFinite(harvestMs)) {
      return 'stale';
    }
    if (Date.now() - harvestMs > STALE_THRESHOLD_MS) {
      return 'stale';
    }
  }
  return 'current';
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function recallMemPalace(
  bridge: BridgeFn = bridgeSync,
): Promise<RecallMemPalaceResult> {
  const validFrom = new Date().toISOString();
  const sources: BackendId[] = [];
  const conflicts: Array<{ backendA: BackendId; backendB: BackendId; reason: string }> = [];

  // Independent backends → fan out concurrently. readPalace() and
  // readStudioMirror() each own their failure handling (bridgeSync returns
  // a discriminated result; fetch is wrapped in its own try). Promise.all
  // is safe because neither helper rejects. The optional `bridge` param
  // (default = imported bridgeSync) lets tests inject a palace stub (MP-024).
  const [palace, mirror] = await Promise.all([
    Promise.resolve(readPalace(bridge)),
    readStudioMirror(),
  ]);

  if (palace.reachable) sources.push('palace');
  else if (palace.reason) {
    conflicts.push({ backendA: 'palace', backendB: 'palace', reason: palace.reason });
  }
  if (mirror.reachable) sources.push('studio-mirror');
  // Mirror unreachable is NOT a conflict — Studio is optional context here.

  // Compose: palace value wins on key collisions because precedence='operator-wins'
  // applies at the *value* level too. Mirror contributes net-new keys only.
  const composedValue: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(mirror.value)) composedValue[k] = v;
  for (const [k, v] of Object.entries(palace.value)) {
    if (k in composedValue && composedValue[k] !== v && palace.reachable && mirror.reachable) {
      conflicts.push({
        backendA: 'palace',
        backendB: 'studio-mirror',
        reason: `value mismatch on key '${k}': ${JSON.stringify(palace.value[k])} vs ${JSON.stringify(mirror.value[k])}`,
      });
    }
    composedValue[k] = v;
  }

  const status = decideStatus(palace.reachable, composedValue);
  const resolvedStatus: ClaimStatus = conflicts.length > 0 && status === 'current' ? 'conflicted' : status;

  // Even when palace is unreachable we still mint a Claim — the orphaned
  // status carries the signal. `current` is null only when we have literally
  // zero useful data (no palace, no mirror).
  const haveAnyData =
    Object.keys(composedValue).length > 0 || palace.reachable || mirror.reachable;

  if (!haveAnyData) {
    return {
      primitive: 'MemPalace',
      current: null,
      superseded: [],
      draft: [],
      sources,
      conflicts,
    };
  }

  const claim: MemPalaceClaim = {
    primitive_name: 'MemPalace',
    claim_uuid: canonicalClaimUuid(composedValue),
    value: composedValue as MemPalaceClaim['value'],
    status: resolvedStatus,
    valid_from: validFrom,
    source: palace.reachable ? 'palace' : 'studio-mirror',
    precedence: 'operator-wins',
  };

  return {
    primitive: 'MemPalace',
    current: claim,
    superseded: [],
    draft: [],
    sources,
    conflicts,
  };
}
