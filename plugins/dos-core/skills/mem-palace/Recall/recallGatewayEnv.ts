/**
 * recallGatewayEnv.ts — Phase 1 named recall function for the gateway-env primitive.
 *
 * RFC-0037 §5.1 evidence: gateway-env recurs in 3+ MEMORY.md entries (canonical
 * hardening 2026-04-29, hardpath followups 2026-04-29, migration from legacy
 * 2026-04-28). Active commercial-impact primitive — Studio billing depends on
 * gateway routing.
 *
 * Discipline (Shameless Green / SandiMetz 2016-01-20):
 *   - Local types only — no shared `types.ts` extracted yet
 *   - HARDCODED primitive_name='gateway-env'
 *   - Composes 2 backends (filesystem + palace); KG/mirror deferred to Phase 2
 *   - No abstraction; consolidation happens in WS-F if duplication speaks
 *
 * Security invariant (LOAD-BEARING):
 *   This function NEVER exposes raw key values. The returned Claim records
 *   presence booleans only. Callers can rely on this contract for safe
 *   logging, JSON serialization, and Studio sync.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
// MP-TS-03: daemon-relayed bridge accessor via the pack-local Lib shim
// (require()s ~/.claude/hooks/lib/mempalace.ts at runtime — resolves at both
// pack-source and deployed skill paths). Replaces the direct `uv run bridge.py`
// cold-spawn that opened a second ChromaDB handle on the live store.
import { bridgeSync } from "../Lib/mempalace";

// ─── LOCAL TYPES (do NOT share with WS-C/WS-D yet) ──────────────────────

type ClaimStatus =
  | "current"
  | "superseded"
  | "draft"
  | "stale"
  | "archived"
  | "conflicted"
  | "orphaned"
  | "contradicted";

type Precedence = "operator-wins" | "global-wins" | "newest-wins";

type BackendId = "palace" | "studio-mirror" | "kg" | "filesystem";

type GatewayEnvValue = {
  canonical_path?: string;
  canonical_path_exists?: boolean;
  legacy_path?: string;
  legacy_path_exists?: boolean;
  has_studio_endpoint?: boolean;
  has_gateway_api_key?: boolean;
  gateway_only_mode?: boolean;
  uses_canonical_names?: boolean;
  uses_legacy_names?: boolean;
};

type GatewayEnvClaim = {
  primitive_name: "gateway-env";
  claim_uuid: string;
  value: GatewayEnvValue;
  status: ClaimStatus;
  valid_from: string;
  valid_to?: string;
  source: BackendId;
  precedence: Precedence;
  supersedes?: string[];
};

type RecallGatewayEnvResult = {
  primitive: "gateway-env";
  current: GatewayEnvClaim | null;
  superseded: GatewayEnvClaim[];
  draft: GatewayEnvClaim[];
  sources: BackendId[];
  conflicts: Array<{ backendA: BackendId; backendB: BackendId; reason: string }>;
};

// ─── FILESYSTEM PATHS ───────────────────────────────────────────────────

const DOS_DIR = process.env.DOS_DIR ?? join(homedir(), ".claude");
const CANONICAL_PATH = join(homedir(), ".config", "DOS", ".gateway.env");
const LEGACY_PATH = join(DOS_DIR, ".gateway.env");

// Per MEMORY entry "ledger-drain-gateway-env" the runtime mapping is:
//   STUDIO_API_KEY → DOS_GATEWAY_API_KEY
//   STUDIO_API_URL → DOS_STUDIO_ENDPOINT
// We detect BOTH canonical and legacy names so the Claim surfaces drift
// (canonical-hardening landed 2026-04-29 but the canonical file may still
// carry legacy names mid-migration).
const CANONICAL_KEY_NAME = "DOS_GATEWAY_API_KEY";
const CANONICAL_ENDPOINT_NAME = "DOS_STUDIO_ENDPOINT";
const LEGACY_KEY_NAME = "STUDIO_API_KEY";
const LEGACY_ENDPOINT_NAME = "STUDIO_API_URL";
const GATEWAY_ONLY_NAME = "DOS_GATEWAY_ONLY";

// ─── HELPERS (no key values cross these boundaries) ─────────────────────

type EnvPresence = {
  fileExists: boolean;
  hasCanonicalKey: boolean;
  hasCanonicalEndpoint: boolean;
  hasLegacyKey: boolean;
  hasLegacyEndpoint: boolean;
  gatewayOnlyMode: boolean;
};

const ABSENT_FILE: EnvPresence = {
  fileExists: false,
  hasCanonicalKey: false,
  hasCanonicalEndpoint: false,
  hasLegacyKey: false,
  hasLegacyEndpoint: false,
  gatewayOnlyMode: false,
};

/**
 * Parse env file for the names listed. Returns presence booleans + the
 * one stat result we already paid for (TOCTOU-free downstream reads).
 * Raw values are read into a local scope and dropped immediately — they
 * never leave this function.
 */
function readEnvPresence(path: string): EnvPresence {
  if (!existsSync(path)) return ABSENT_FILE;
  let body: string;
  try {
    body = readFileSync(path, "utf-8");
  } catch {
    return ABSENT_FILE;
  }
  const presence: EnvPresence = { ...ABSENT_FILE, fileExists: true };
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const name = line.slice(0, eq).trim();
    // value is parsed only to check truthiness for gateway_only_mode;
    // it never escapes this function or enters returned data structures.
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    const hasValue = value.length > 0;
    if (name === CANONICAL_KEY_NAME && hasValue) presence.hasCanonicalKey = true;
    else if (name === CANONICAL_ENDPOINT_NAME && hasValue)
      presence.hasCanonicalEndpoint = true;
    else if (name === LEGACY_KEY_NAME && hasValue) presence.hasLegacyKey = true;
    else if (name === LEGACY_ENDPOINT_NAME && hasValue)
      presence.hasLegacyEndpoint = true;
    else if (name === GATEWAY_ONLY_NAME && hasValue) {
      presence.gatewayOnlyMode = value === "1" || value.toLowerCase() === "true";
    }
  }
  return presence;
}

/**
 * Canonical-JSON sha256 of the value field. Stable hash for content-addressed
 * claim_uuid (Fowler Identity Map per RFC-0037 §2 Glossary).
 */
function contentHash(value: GatewayEnvValue): string {
  const canonical = Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a.localeCompare(b)),
  );
  return createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}

/**
 * Best-effort palace search for canonical-hardening PRD lineage. Failure is
 * non-fatal — recall returns successfully without palace evidence. Only
 * returns the hit count; we never propagate raw drawer text since this
 * primitive is security-sensitive.
 *
 * Bypass with DOS_RECALL_SKIP_PALACE=1 (test/CI use).
 */
function palaceLineageHits(): number {
  if (process.env.DOS_RECALL_SKIP_PALACE === "1") return 0;
  try {
    // MP-TS-03: daemon-relayed search (single ChromaDB accessor). bridgeSync
    // routes through the live daemon when it is up and only cold-falls-back via
    // the one canonical path — it never opens an independent second handle on
    // the store the way the old `uv run bridge.py` spawn did. recordFailure=false
    // keeps this best-effort lineage probe out of the failure ring buffer; the
    // discriminated result means a miss/timeout returns cleanly (ok:false).
    const search = bridgeSync(
      "search",
      { query: "gateway-env canonical hardening", wing: "durante", limit: 3 },
      3000,
      false,
    );
    if (!search.ok) return 0;
    // The bridge surfaces search hits under EITHER `results` or `matches`
    // (canonical consumer hooks/lib/mempalace.ts uses results||matches||[]).
    // Counting only `results` dropped palace lineage evidence when hits came
    // back under `matches` (MP-097), omitting 'palace' from sources[].
    const hits = (search.data.results || search.data.matches || []) as unknown[];
    return hits.length;
  } catch {
    return 0;
  }
}

// ─── PUBLIC API ─────────────────────────────────────────────────────────

type Conflict = { backendA: BackendId; backendB: BackendId; reason: string };

function fsConflict(reason: string): Conflict {
  return { backendA: "filesystem", backendB: "filesystem", reason };
}

export async function recallGatewayEnv(): Promise<RecallGatewayEnvResult> {
  const validFrom = new Date().toISOString();
  const conflicts: Conflict[] = [];

  // Backend 1: filesystem (this primitive's natural home).
  // readEnvPresence already swallows IO errors and returns ABSENT_FILE; the
  // single stat it pays for surfaces as fileExists, so downstream code never
  // re-stats (no TOCTOU window).
  const canonical = readEnvPresence(CANONICAL_PATH);
  const legacy = readEnvPresence(LEGACY_PATH);
  const sources: BackendId[] = ["filesystem"];

  // Backend 2: palace (best-effort lineage hits, count only)
  if (palaceLineageHits() > 0) sources.push("palace");

  // Compose value field (booleans only — NEVER raw key values)
  const hasStudioEndpoint =
    canonical.hasCanonicalEndpoint ||
    canonical.hasLegacyEndpoint ||
    legacy.hasCanonicalEndpoint ||
    legacy.hasLegacyEndpoint;
  const hasGatewayApiKey =
    canonical.hasCanonicalKey ||
    canonical.hasLegacyKey ||
    legacy.hasCanonicalKey ||
    legacy.hasLegacyKey;

  // value field is content-hashed; palace lineage hits are observability
  // (recorded via `sources`), NOT identity, so they stay out of value.
  const value: GatewayEnvValue = {
    canonical_path: CANONICAL_PATH,
    canonical_path_exists: canonical.fileExists,
    legacy_path: LEGACY_PATH,
    legacy_path_exists: legacy.fileExists,
    has_studio_endpoint: hasStudioEndpoint,
    has_gateway_api_key: hasGatewayApiKey,
    gateway_only_mode: canonical.gatewayOnlyMode || legacy.gatewayOnlyMode,
    uses_canonical_names:
      canonical.hasCanonicalKey || canonical.hasCanonicalEndpoint,
    uses_legacy_names:
      canonical.hasLegacyKey ||
      canonical.hasLegacyEndpoint ||
      legacy.hasLegacyKey ||
      legacy.hasLegacyEndpoint,
  };

  // Status decision table per RFC-0037 §5 spec
  let status: ClaimStatus;
  if (canonical.fileExists && legacy.fileExists) {
    status = "conflicted";
    conflicts.push(
      fsConflict(
        `both canonical (${CANONICAL_PATH}) and legacy (${LEGACY_PATH}) gateway-env files exist — operator should remove legacy after migration`,
      ),
    );
  } else if (!canonical.fileExists && !legacy.fileExists) {
    status = "orphaned";
  } else if (canonical.fileExists && hasStudioEndpoint && hasGatewayApiKey) {
    status = "current";
  } else {
    status = "stale";
    if (!canonical.fileExists && legacy.fileExists) {
      conflicts.push(
        fsConflict(
          `legacy path exists but canonical migration incomplete — see MEMORY entry gateway-env-migrated-to-config-dos (2026-04-28)`,
        ),
      );
    }
  }

  const claim: GatewayEnvClaim = {
    primitive_name: "gateway-env",
    claim_uuid: contentHash(value),
    value,
    status,
    valid_from: validFrom,
    source: "filesystem",
    precedence: "operator-wins",
  };

  return {
    primitive: "gateway-env",
    // Return the claim for ALL non-throwing statuses (MP-060/MP-063): the
    // value booleans + conflicts[] carry the mid-migration drift signal for
    // stale/orphaned too. Dropping it to null discarded diagnostic state and
    // diverged from the sibling recall fns (recallMemPalace/recallStudio both
    // keep their stale/orphaned claim). status already encodes the gradation.
    current: claim,
    superseded: [],
    draft: [],
    sources,
    conflicts,
  };
}
