/**
 * recallStudio.ts — RFC-0037 Phase 1 Workstream WS-C
 *
 * Hardcoded named recall function for the "Studio" primitive. Composes two
 * backends (palace via bridgeSync, Studio mirror via HTTP) into a single
 * RecallStudioResult. Local types only — no shared abstraction with
 * recallMemPalace / recallGatewayEnv. Per SandiMetz Shameless Green
 * (sandimetz.com 2016-01-20): "prefer duplication over the wrong abstraction."
 * Consolidation happens later in WS-F only if duplication speaks.
 *
 * Default precedence is operator-wins because the operator's local working state IS
 * canonical for Studio (he commits directly to main per the
 * studio-delivery-direct-to-main MEMORY entry).
 *
 * Errors are NEVER thrown to the caller — every failure mode degrades to
 * status='conflicted' with a reason in conflicts[].
 */

import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// ─── Local types — DO NOT share with other recall functions yet ─────────────

export type ClaimStatus =
  | 'current'
  | 'superseded'
  | 'draft'
  | 'stale'
  | 'archived'
  | 'conflicted'
  | 'orphaned'
  | 'contradicted';

export type Precedence = 'operator-wins' | 'global-wins' | 'newest-wins';

export type BackendId = 'palace' | 'studio-mirror' | 'kg' | 'filesystem';

export type StudioClaim = {
  primitive_name: 'Studio';
  claim_uuid: string;
  value: {
    deployment_url?: string;
    last_deploy?: string;
    active_version?: string;
    [key: string]: unknown;
  };
  status: ClaimStatus;
  valid_from: string;
  valid_to?: string;
  source: BackendId;
  precedence: Precedence;
  supersedes?: string[];
};

export type RecallStudioResult = {
  primitive: 'Studio';
  current: StudioClaim | null;
  superseded: StudioClaim[];
  draft: StudioClaim[];
  sources: BackendId[];
  conflicts: Array<{ backendA: BackendId; backendB: BackendId; reason: string }>;
};

// ─── Constants ──────────────────────────────────────────────────────────────

/** Threshold for status='stale' versus status='current'. */
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Default precedence for Studio per RFC-0037 §5.2 + studio-delivery-direct-to-main. */
const DEFAULT_PRECEDENCE: Precedence = 'operator-wins';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Canonical-JSON sha256 of an object's value field. Stable key ordering so the
 * same logical value always produces the same claim_uuid (Fowler Identity Map
 * per RFC-0037 §5.2).
 */
function computeClaimUuid(value: Record<string, unknown>): string {
  const canonical = JSON.stringify(value, Object.keys(value).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Resolve the path to the live mempalace.ts module. Pack source imports
 * cannot reach hooks/lib/ via relative path (per MEMORY entry
 * pack-install-runtime-path-quirk), so we compute the absolute path at
 * runtime via DOS_DIR and dynamic-import.
 */
function mempalaceLibPath(): string {
  const dosDir = process.env.DOS_DIR || join(homedir(), '.claude');
  return join(dosDir, 'hooks', 'lib', 'mempalace.ts');
}

/**
 * Lazy import of bridgeSync. Returns null if mempalace.ts is unreachable
 * (e.g. running on a host without DOS installed). Caller must handle null.
 */
async function loadBridgeSync(): Promise<
  ((action: string, args: Record<string, unknown>, timeoutMs?: number) => unknown) | null
> {
  const path = mempalaceLibPath();
  if (!existsSync(path)) return null;
  try {
    const mod = (await import(path)) as {
      bridgeSync?: (action: string, args: Record<string, unknown>, timeoutMs?: number) => unknown;
    };
    return mod.bridgeSync ?? null;
  } catch {
    return null;
  }
}

type BridgeResultLike =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; reason: string };

/**
 * Extract a representative timestamp + free-text content from a palace search
 * hit. Both fields may be missing — caller treats absence as no-signal.
 */
function extractPalaceHit(
  hit: Record<string, unknown>,
): { timestamp?: string; content?: string } {
  const meta = (hit.metadata as Record<string, unknown>) || {};
  const timestamp =
    (meta.filed_at as string | undefined) ||
    (meta.created_at as string | undefined) ||
    (meta.timestamp as string | undefined);
  const content =
    (hit.content as string | undefined) ||
    (hit.document as string | undefined) ||
    (hit.text as string | undefined);
  return { timestamp, content };
}

/**
 * Compose palace search results into a partial Studio value. Returns null
 * when the search produced no usable hits.
 */
function palaceHitsToValue(
  hits: Array<Record<string, unknown>>,
): { value: Record<string, unknown>; latestTimestamp?: string } | null {
  if (!hits || hits.length === 0) return null;

  let latestTimestamp: string | undefined;
  const summaries: string[] = [];

  for (const hit of hits.slice(0, 5)) {
    const { timestamp, content } = extractPalaceHit(hit);
    if (timestamp && (!latestTimestamp || timestamp > latestTimestamp)) {
      latestTimestamp = timestamp;
    }
    if (content) summaries.push(content.slice(0, 200));
  }

  return {
    value: {
      palace_hit_count: hits.length,
      palace_summary: summaries.join(' | ').slice(0, 600),
      palace_latest_timestamp: latestTimestamp,
    },
    latestTimestamp,
  };
}

/**
 * Build a Studio Claim from palace search output. Returns null if no usable
 * data was returned.
 */
function buildPalaceClaim(
  bridgeResult: BridgeResultLike | null,
  validFrom: string,
): StudioClaim | null {
  if (!bridgeResult || !bridgeResult.ok) return null;

  const data = bridgeResult.data;
  const results =
    ((data.results as Array<Record<string, unknown>> | undefined) ||
      (data.matches as Array<Record<string, unknown>> | undefined) ||
      []) as Array<Record<string, unknown>>;

  const composed = palaceHitsToValue(results);
  if (!composed) return null;

  const value = composed.value;
  const claim_uuid = computeClaimUuid(value);
  const status = computeStatus(composed.latestTimestamp);

  return {
    primitive_name: 'Studio',
    claim_uuid,
    value,
    status,
    valid_from: validFrom,
    source: 'palace',
    precedence: DEFAULT_PRECEDENCE,
  };
}

/**
 * Hit the Studio mirror /api/v1/work read endpoint. Tolerant of unset env —
 * returns { ok: false } silently rather than throwing.
 */
async function fetchStudioMirror(): Promise<
  { ok: true; rows: Array<Record<string, unknown>> } | { ok: false; reason: string }
> {
  // studioClient:exempt — fallback pattern chosen by parallel session (commit c090085e); see submodule f93ed21
  const endpoint = process.env.STUDIO_API_URL ?? process.env.DOS_STUDIO_ENDPOINT;
  const apiKey = process.env.STUDIO_API_KEY ?? process.env.DOS_GATEWAY_API_KEY;
  if (!endpoint || !apiKey) {
    return { ok: false, reason: 'env-unset' };
  }

  const url = `${endpoint.replace(/\/+$/, '')}/api/v1/work?slug=*studio*&limit=5`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      return { ok: false, reason: `http-${response.status}` };
    }
    const body = (await response.json()) as Record<string, unknown>;
    const rows =
      ((body.work as Array<Record<string, unknown>> | undefined) ||
        (body.items as Array<Record<string, unknown>> | undefined) ||
        (body.results as Array<Record<string, unknown>> | undefined) ||
        (Array.isArray(body) ? (body as Array<Record<string, unknown>>) : [])) as Array<
        Record<string, unknown>
      >;
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, reason: `fetch-error:${(err as Error).message}` };
  }
}

/**
 * Build a Studio Claim from Studio-mirror rows. Returns null when no rows
 * came back.
 */
function buildMirrorClaim(
  rows: Array<Record<string, unknown>>,
  validFrom: string,
): StudioClaim | null {
  if (!rows || rows.length === 0) return null;

  let latestTimestamp: string | undefined;
  const slugs: string[] = [];
  for (const row of rows) {
    const ts =
      (row.updated_at as string | undefined) ||
      (row.created_at as string | undefined) ||
      (row.timestamp as string | undefined);
    if (ts && (!latestTimestamp || ts > latestTimestamp)) {
      latestTimestamp = ts;
    }
    const slug = row.slug as string | undefined;
    if (slug) slugs.push(slug);
  }

  const value: Record<string, unknown> = {
    mirror_row_count: rows.length,
    mirror_slugs: slugs.slice(0, 5),
    mirror_latest_timestamp: latestTimestamp,
  };
  const claim_uuid = computeClaimUuid(value);
  const status = computeStatus(latestTimestamp);

  return {
    primitive_name: 'Studio',
    claim_uuid,
    value,
    status,
    valid_from: validFrom,
    source: 'studio-mirror',
    precedence: DEFAULT_PRECEDENCE,
  };
}

/**
 * Status decision per the brief:
 *   - both backends non-empty + within 7 days → 'current'
 *   - data exists but >7 days old → 'stale'
 *   - no data at all → 'orphaned'
 * This helper is per-claim; agreement across backends is computed elsewhere.
 */
function computeStatus(latestTimestamp: string | undefined): ClaimStatus {
  if (!latestTimestamp) return 'orphaned';
  const ageMs = Date.now() - new Date(latestTimestamp).getTime();
  if (Number.isNaN(ageMs)) return 'orphaned';
  return ageMs <= STALE_THRESHOLD_MS ? 'current' : 'stale';
}

/**
 * Resolve precedence between two claims. operator-wins favors palace (local);
 * global-wins favors studio-mirror; newest-wins compares timestamps.
 */
function resolvePrecedence(
  palace: StudioClaim,
  mirror: StudioClaim,
): StudioClaim {
  switch (DEFAULT_PRECEDENCE) {
    case 'operator-wins':
      return palace;
    case 'global-wins':
      return mirror;
    case 'newest-wins': {
      const palaceTs =
        (palace.value.palace_latest_timestamp as string | undefined) || palace.valid_from;
      const mirrorTs =
        (mirror.value.mirror_latest_timestamp as string | undefined) || mirror.valid_from;
      return palaceTs > mirrorTs ? palace : mirror;
    }
  }
}

/**
 * Compare two non-null claims for agreement. Backends "agree" when their
 * status fields match — both 'current', both 'stale', etc. Different statuses
 * mean the world looks different from each backend's vantage point and
 * surfaces as a conflict to the caller.
 */
function backendsAgree(palace: StudioClaim, mirror: StudioClaim): boolean {
  return palace.status === mirror.status;
}

// ─── Entry point ────────────────────────────────────────────────────────────

/** Per-backend result shape returned by the two readers below. */
type BackendOutcome = { claim: StudioClaim | null; conflictReason: string | null };

/**
 * Construct a conflict entry. The recallStudio function only ever pairs
 * palace ↔ studio-mirror, so the backend pair is fixed by construction.
 */
function pushConflict(
  conflicts: Array<{ backendA: BackendId; backendB: BackendId; reason: string }>,
  reason: string,
): void {
  conflicts.push({ backendA: 'palace', backendB: 'studio-mirror', reason });
}

/** Read the palace backend and translate failures into a non-throwing outcome. */
async function readPalaceBackend(validFrom: string): Promise<BackendOutcome> {
  try {
    const bridgeSync = await loadBridgeSync();
    if (!bridgeSync) {
      return { claim: null, conflictReason: 'palace-unreachable: mempalace lib not loadable' };
    }
    const raw = bridgeSync(
      'search',
      { query: 'Studio deployment status', wing: 'durante', limit: 5 },
      5000,
    ) as BridgeResultLike;
    if (raw && raw.ok) {
      // Distinguish reachable-but-empty from unreachable (MP-059): a healthy
      // palace that simply has no Studio-topic hits must surface a conflict
      // reason instead of vanishing silently from sources[] like an outage.
      const claim = buildPalaceClaim(raw, validFrom);
      return {
        claim,
        conflictReason: claim ? null : 'palace-reachable-but-no-studio-hits',
      };
    }
    const reason = raw && !raw.ok ? raw.reason : 'palace-empty';
    return { claim: null, conflictReason: `palace-error: ${reason}` };
  } catch (err) {
    return { claim: null, conflictReason: `palace-throw: ${(err as Error).message}` };
  }
}

/** Read the Studio-mirror backend and translate failures into a non-throwing outcome. */
async function readMirrorBackend(validFrom: string): Promise<BackendOutcome> {
  try {
    const mirror = await fetchStudioMirror();
    if (mirror.ok) {
      // Mirror reachable but zero rows is a distinct signal from unreachable
      // (MP-059) — surface it as a conflict rather than dropping silently.
      const claim = buildMirrorClaim(mirror.rows, validFrom);
      return {
        claim,
        conflictReason: claim ? null : 'mirror-reachable-but-no-studio-rows',
      };
    }
    return { claim: null, conflictReason: `mirror-error: ${mirror.reason}` };
  } catch (err) {
    return { claim: null, conflictReason: `mirror-throw: ${(err as Error).message}` };
  }
}

/**
 * Compose palace + Studio-mirror reads into a single Claim about the Studio
 * primitive. Never throws — error paths emerge as status='conflicted' with
 * an entry in `conflicts[]`. The two backends are queried concurrently;
 * wall-clock is bounded by the slower of the two, not their sum.
 */
export async function recallStudio(): Promise<RecallStudioResult> {
  const validFrom = new Date().toISOString();
  const sources: BackendId[] = [];
  const conflicts: Array<{ backendA: BackendId; backendB: BackendId; reason: string }> = [];

  // Run both backends concurrently — they share no state, and palace's bridge
  // call alone can take 5s on cold ChromaDB.
  const [palaceOutcome, mirrorOutcome] = await Promise.all([
    readPalaceBackend(validFrom),
    readMirrorBackend(validFrom),
  ]);

  if (palaceOutcome.claim) sources.push('palace');
  else if (palaceOutcome.conflictReason) pushConflict(conflicts, palaceOutcome.conflictReason);

  if (mirrorOutcome.claim) sources.push('studio-mirror');
  else if (mirrorOutcome.conflictReason) pushConflict(conflicts, mirrorOutcome.conflictReason);

  const palaceClaim = palaceOutcome.claim;
  const mirrorClaim = mirrorOutcome.claim;

  // Compose into a final claim per the agreement rule.
  let current: StudioClaim | null = null;

  if (palaceClaim && mirrorClaim) {
    if (backendsAgree(palaceClaim, mirrorClaim)) {
      current = resolvePrecedence(palaceClaim, mirrorClaim);
    } else {
      pushConflict(
        conflicts,
        `status-disagreement: palace=${palaceClaim.status} mirror=${mirrorClaim.status}`,
      );
      const winner = resolvePrecedence(palaceClaim, mirrorClaim);
      current = { ...winner, status: 'conflicted' };
    }
  } else if (palaceClaim) {
    current = palaceClaim;
  } else if (mirrorClaim) {
    current = mirrorClaim;
  } else if (conflicts.length > 0) {
    // Both backends failed — synthesize an orphaned/conflicted placeholder
    // so callers always have a claim shape to read.
    const value = { error_count: conflicts.length };
    current = {
      primitive_name: 'Studio',
      claim_uuid: computeClaimUuid(value),
      value,
      status: 'conflicted',
      valid_from: validFrom,
      source: 'palace',
      precedence: DEFAULT_PRECEDENCE,
    };
  }

  return {
    primitive: 'Studio',
    current,
    superseded: [],
    draft: [],
    sources,
    conflicts,
  };
}
