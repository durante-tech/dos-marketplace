/**
 * Typed MemPalace bridge client — RFC-0035 §3 item 1, RFC-0078 retiral, V11.12.
 *
 * Hex-2 port closure: hooks should NOT pass action strings + opaque
 * `Record<string, unknown>` arg blobs into bridgeSync/bridgeAsync/bridgeFire.
 * That contract leaks the bridge action vocabulary and serialization shape
 * across every consumer, and rename refactors became multi-file scavenger
 * hunts. This module wraps the 36 live bridge actions in a typed
 * function-per-action surface that delegates to the existing helpers in
 * `./mempalace.ts` — meaning every audit log, ring buffer, drift probe,
 * memory-event, and predicate-gate side effect that the helpers already
 * implement is preserved unchanged.
 *
 * Architectural rules (load-bearing, per RFC-0078 council convergence):
 *   1. NEVER spawn directly here — always delegate to bridgeSync/bridgeAsync/
 *      bridgeFire so the audit-log-collector wiring (V11.7) keeps recording.
 *   2. NEVER bypass the predicate gate — `addKgFact` MUST go through
 *      bridgeSync so DOS_PREDICATE_GATE blocks unknown predicates.
 *   3. NEVER reinvent error handling — return BridgeResult<T> verbatim from
 *      the underlying helper; consumers branch on `.ok` exactly as today.
 *   4. NEVER redeclare action names as magic strings outside this module —
 *      this file is the canonical TypeScript-side mirror of `_build_actions_table`
 *      in `Packs/mem-palace/src/Tools/_bridge_palace.py`. New actions land here
 *      first, then in the Python dispatch table.
 *
 * What this module is NOT (per V11.12 scope limit):
 *   - It is NOT the migration. Hooks continue calling bridgeSync directly
 *     until an operator-decided rollout migrates each call site to its
 *     typed equivalent. This file is the wrapper; the wiring is separate.
 *   - It does NOT add new bridge actions. V11.14 + V11.21 own that surface.
 *   - It does NOT change behavior. Pure refactor — every typed function
 *     returns the same JSON shape the bridge action returns today.
 *
 * Two parallel function flavors per action:
 *   - `client.foo()`        — sync, returns BridgeResult<TFooResult>
 *   - `client.fooAsync()`   — async, returns Promise<BridgeResult<TFooResult>>
 *
 * Where the bridge action is genuinely fire-and-forget (write-only paths
 * that hooks do not await — `addReflection` is the canonical example), a
 * `*Fire` flavor is also exposed: returns `void`, matches `bridgeFire`.
 *
 * V11.12 status: sprout-only — hooks not yet migrated. Imported nowhere
 * at landing; the next sprint cycle decides whether to migrate hot-path
 * callers (intent-classifier, SessionContextEnrich, MemoryHarvest) first
 * or do a global sweep.
 */

import {
  bridgeSync,
  bridgeAsync,
  bridgeFire,
  type BridgeResult,
  type BridgeOp,
  batchOps as batchOpsRunner,
  type BatchExecResult,
  type BatchCallbacks,
} from './mempalace.ts';

// ─── Re-exports for callers that want the type contracts ──────────────────
//
// Consumers importing this module shouldn't have to reach into mempalace.ts
// for the result envelope — they get everything they need from the client
// surface. BridgeOp + BatchExecResult escape because the batch helper
// (batchOps) is callback-shaped and consumers build the op array themselves.

export type { BridgeResult, BridgeOp, BatchExecResult, BatchCallbacks };

// ─── Shared shapes ────────────────────────────────────────────────────────

/** Opts accepted by every sync method. Centralizing here means renaming
 * `callerHook` becomes a single-line edit. */
export interface SyncOpts {
  timeoutMs?: number;
  callerHook?: string;
}

/**
 * The `Record<string, unknown>` cast every method needs to satisfy
 * bridgeSync's positional contract. Centralized so a future signature
 * change in mempalace.ts (e.g. typed Args generic) fans out from one
 * line instead of 93. The cast is necessary because TypeScript cannot
 * prove that an arbitrary action's arg interface is structurally a
 * `Record<string, unknown>` — the bridge accepts any JSON-serializable
 * shape, but the type system has no narrower contract.
 */
function toBridgeArgs<T extends object>(args: T): Record<string, unknown> {
  return args as unknown as Record<string, unknown>;
}

/**
 * Canonical bridge action names — must stay in lockstep with
 * `_build_actions_table` in `Packs/mem-palace/src/Tools/_bridge_palace.py`.
 * Drift here is the only way an action call site can typo into silent
 * failure, so the registry is the single source of truth.
 */
export const BRIDGE_ACTIONS = {
  // Drawer writes
  ADD_DRAWER: 'add_drawer',
  UPSERT_DRAWER: 'upsert_drawer',
  UPDATE_DRAWER: 'update_drawer',
  DELETE_DRAWER: 'delete_drawer',
  // Drawer reads
  LIST_DRAWERS: 'list_drawers',
  SEARCH: 'search',
  AUDIT_DRAWER: 'audit_drawer',
  // Mining
  MINE_FILE: 'mine_file',
  MINE_DIR: 'mine_dir',
  MINE_CONVOS: 'mine_convos',
  // Knowledge graph writes
  ADD_KG_FACT: 'add_kg_fact',
  INVALIDATE: 'invalidate',
  UPDATE_ENTITY: 'update_entity',
  MERGE_ENTITIES: 'merge_entities',
  // Knowledge graph reads
  KG_QUERY: 'kg_query',
  KG_QUERY_PREDICATE: 'kg_query_predicate',
  KG_TIMELINE: 'kg_timeline',
  KG_STATS: 'kg_stats',
  // Palace lifecycle
  INIT: 'init',
  STATUS: 'status',
  // Wake-up / classification / navigation
  WAKE_UP: 'wake_up',
  CLASSIFY: 'classify',
  TRAVERSE: 'traverse',
  FIND_TUNNELS: 'find_tunnels',
  CREATE_TUNNEL: 'create_tunnel',
  // Suggest parent
  SUGGEST_PARENT: 'suggest_parent',
  // Diary
  DIARY: 'diary',
  // Batch
  BATCH: 'batch',
  // Fact check
  FACT_CHECK: 'fact_check',
  // Closets
  BUILD_CLOSETS: 'build_closets',
  REBUILD_CLOSETS: 'rebuild_closets',
  BACKFILL_CLOSETS: 'backfill_closets',
  // Reconcile
  RECONCILE: 'reconcile',
  // Reflection
  APPEND_REFLECTION: 'append_reflection',
  // Fork-canonical aliases (RFC-0028 + v3.3.4)
  GRAPH_STATS: 'graph_stats',
  LAST_CHECKPOINT: 'last_checkpoint',
  LAST_CHECKPOINT_AT: 'last_checkpoint_at',
  MEMORIES_FILED_AWAY: 'memories_filed_away',
} as const;

export type BridgeActionName = typeof BRIDGE_ACTIONS[keyof typeof BRIDGE_ACTIONS];

// ─── Shared primitive types (mirror bridge.py JSON shape) ─────────────────

/**
 * Standard bridge response envelope. Most actions return at least
 * `{status: 'ok' | 'error' | ...}`; this is the lowest common denominator.
 * Per-action types extend this with their specific payload fields.
 */
export interface BridgeStatusResponse {
  status: 'ok' | 'error' | 'partial' | 'duplicate' | 'skip' | 'no_palace' | 'quiet' | 'degraded' | string;
  message?: string;
  error_type?: string;
  recovery?: string;
}

// ─── Drawer write operations ──────────────────────────────────────────────

/** Trust-type prefix on `added_by` strings — see `_bridge_drawers.add_drawer`. */
export type AddedByPrefix = 'mechanical' | 'human' | 'llm_judge';

/** Common drawer-write argument set. */
export interface DrawerWriteArgs {
  wing: string;
  room: string;
  content: string;
  source_file?: string;
  /**
   * Free-form attribution. Convention: `<prefix>:<author>` where prefix is
   * one of `mechanical`, `human`, `llm_judge` so downstream consumers can
   * filter on `metadata.trust_type`. Defaults to `dos-hook` when omitted.
   */
  added_by?: string | `${AddedByPrefix}:${string}`;
  /** Override duplicate-detection threshold (0.0-2.0). Lower = stricter. */
  dup_threshold?: number;
  /**
   * Explicit drawer ID. When provided, add_drawer takes the upsert path
   * (skips dup-detection). Used by `update_drawer` and slug-bearing decision
   * archives.
   */
  drawer_id?: string;
}

export interface AddDrawerResult extends BridgeStatusResponse {
  /** Always present on `status: 'ok'` and `status: 'duplicate'`. */
  drawer_id?: string;
  wing?: string;
  room?: string;
}

export interface UpdateDrawerArgs {
  drawer_id: string;
  content: string;
  wing?: string;
  room?: string;
  source_file?: string;
  added_by?: string;
  /**
   * Classify-derived semantic label (decision/preference/fact/...). The bridge's
   * update_drawer accepts it (_bridge_drawers.py: `args.get('type')`) and
   * MemPalaceClassifyOnAddDrawer sends it; it was missing from the typed mirror,
   * so a migration to this client would silently drop it (MP-092 / ISC-31).
   */
  type?: string;
}

export interface UpdateDrawerResult extends BridgeStatusResponse {
  drawer_id: string;
  action: 'updated';
}

export interface DeleteDrawerArgs {
  drawer_id: string;
}

export interface DeleteDrawerResult extends BridgeStatusResponse {
  drawer_id: string;
  /** Present on successful delete. */
  action?: 'deleted';
  /** Metadata captured before deletion, when the drawer existed. */
  wing?: string;
  room?: string;
}

// ─── Drawer read / search operations ──────────────────────────────────────

export interface ListDrawersArgs {
  wing?: string;
  room?: string;
  /** Default 50. */
  limit?: number;
  /** Default 0. */
  offset?: number;
  /** Default 200. Set to 0 for full content. */
  preview_chars?: number;
}

export interface ListDrawerItem {
  id: string;
  wing?: string | null;
  room?: string | null;
  source_file?: string | null;
  added_by?: string | null;
  content: string;
  truncated: boolean;
  full_length: number;
}

export interface ListDrawersResult extends BridgeStatusResponse {
  drawers: ListDrawerItem[];
  count: number;
  wing: string | null;
  room: string | null;
  limit: number;
  offset: number;
  preview_chars: number;
  total_in_collection: number;
}

export type SearchPath = 'hybrid' | 'layer3';

export interface SearchArgs {
  query: string;
  limit?: number;
  wing?: string;
  room?: string;
  hall?: string;
  /** 'hybrid' (BM25 + vector + closet boost) | 'layer3' (raw ChromaDB vector). */
  path?: SearchPath;
  /** Layer3 cosine distance ceiling. 0 disables filtering. */
  max_distance?: number;
}

/** A single search result. Field set varies between hybrid + layer3 paths. */
export interface SearchResultItem {
  /** Hybrid path may rename `text` → `content`; layer3 always sets `content`. */
  content?: string;
  text?: string;
  id?: string | null;
  /** Layer3 only — cosine distance. */
  distance?: number | null;
  /** Hybrid only — fused score. */
  score?: number;
  /** Top-level on current upstream; nested on older. Both are valid. */
  wing?: string;
  room?: string;
  hall?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult extends BridgeStatusResponse {
  query: string;
  results: SearchResultItem[];
  count: number;
  path: SearchPath;
}

// ─── Mining operations ────────────────────────────────────────────────────

export interface MineFileArgs {
  filepath: string;
  wing?: string;
  room?: string;
  /** Default 2000 chars. Smart-chunker respects YAML frontmatter + code fences. */
  chunk_size?: number;
}

export interface MineFileResult extends BridgeStatusResponse {
  filepath: string;
  chunks: number;
  results: AddDrawerResult[];
}

export interface MineDirArgs {
  dir: string;
  wing?: string;
  room?: string;
  /** Default `['.md', '.jsonl', '.txt']`. */
  extensions?: string[];
}

export interface MineDirResult extends BridgeStatusResponse {
  directory: string;
  wing: string;
  room: string;
  drawers_filed: number;
  skipped: number;
  errors: number;
}

export interface MineConvosArgs {
  dir: string;
  wing?: string;
  /** 'exchange' (Q+A pairs, default) or memory-type-based extraction. */
  extract_mode?: 'exchange' | 'memory_type' | string;
  /** 0 = unlimited. */
  limit?: number;
}

export interface MineConvosResult extends BridgeStatusResponse {
  directory: string;
  wing?: string;
  extract_mode: string;
  /** Last 500 chars of progress output. */
  output: string;
}

// ─── Knowledge graph operations ───────────────────────────────────────────

export interface AddKgFactArgs {
  subject: string;
  /**
   * Predicate name. Validated against PREDICATES.md vocabulary by
   * bridgeSync's predicate gate (block/warn/off via DOS_PREDICATE_GATE).
   * Unknown predicates return `{ok: false, reason: 'predicate-gate: ...'}`
   * in BLOCK mode without invoking Python.
   */
  predicate: string;
  object: string;
  /** ISO date string. Defaults to today (UTC) when omitted. */
  valid_from?: string;
  /** Confidence weight 0.0-1.0. Default 1.0. */
  confidence?: number;
}

export interface AddKgFactResult extends BridgeStatusResponse {
  fact: string;
}

export interface InvalidateArgs {
  subject: string;
  predicate: string;
  object: string;
  /** ISO date when fact stopped being true. Defaults to today (UTC). */
  ended?: string;
}

export interface InvalidateResult extends BridgeStatusResponse {
  fact: string;
  ended: string;
}

export interface UpdateEntityArgs {
  entity: string;
  /** New type label. Pass `undefined` to leave unchanged. */
  type?: string;
  /** JSON string OR object (the bridge accepts both and stringifies). */
  properties?: string | Record<string, unknown>;
}

export interface UpdateEntityResult extends BridgeStatusResponse {
  entity: string;
  entity_id?: number | string;
  updated_fields?: string[];
}

export interface MergeEntitiesArgs {
  source: string;
  target: string;
  /** Default true — drops the source entity row after repointing triples. */
  delete_source?: boolean;
}

export interface MergeEntitiesResult extends BridgeStatusResponse {
  source: string;
  target: string;
  repointed: number;
  skipped_duplicates: number;
  source_deleted: boolean;
}

export type KgQueryDirection = 'outgoing' | 'incoming' | 'both';

export interface KgQueryArgs {
  entity: string;
  direction?: KgQueryDirection;
  /** ISO date — facts valid on this day only. */
  as_of?: string;
  /** Client-side filter on `predicate`. */
  predicate?: string;
}

/** Single triple. Shape mirrors `KnowledgeGraph.query_entity` output. */
export interface KgFact {
  subject: string;
  predicate: string;
  object: string;
  valid_from?: string;
  ended?: string | null;
  confidence?: number;
  /** Defaults true; consumers should treat absent as true. */
  current?: boolean;
}

export interface KgQueryResult extends BridgeStatusResponse {
  entity: string;
  direction: KgQueryDirection;
  as_of: string | null;
  predicate_filter: string | null;
  facts: KgFact[];
  count: number;
}

export interface KgQueryPredicateArgs {
  predicate: string;
  /** Post-query filter on `subject`. */
  subject?: string;
  /** Post-query filter on `object`. */
  object?: string;
  /** ISO date — facts valid on this day only. */
  as_of?: string;
}

export interface KgQueryPredicateResult extends BridgeStatusResponse {
  predicate: string;
  subject: string | null;
  object: string | null;
  as_of: string | null;
  facts: KgFact[];
  count: number;
}

export interface KgTimelineArgs {
  /** Omit to query the entire KG timeline. */
  entity?: string;
  /** ISO date cutoff — facts on/after this date. */
  since?: string;
  /** Convenience window: only facts within the last N days. */
  window_days?: number;
}

export interface KgTimelineResult extends BridgeStatusResponse {
  entity?: string;
  timeline: KgFact[];
  count: number;
  since?: string;
  window_days?: number;
}

export interface KgStatsResult extends BridgeStatusResponse {
  entities?: number;
  triples?: number;
  current_triples?: number;
  /** Counts grouped by predicate. */
  predicates?: Record<string, number>;
  /** Counts grouped by entity type. */
  entity_types?: Record<string, number>;
  /**
   * List of distinct predicate strings the KG contains. The installed mempalace
   * library's KnowledgeGraph.stats() returns this (KgEntityHygiene reads it);
   * it was absent from the typed mirror, so consumers mistyped the shape (MP-095).
   */
  relationship_types?: string[];
}

// ─── Palace overview / lifecycle ──────────────────────────────────────────

export interface InitResult extends BridgeStatusResponse {
  palace_path: string;
  palace_db: string;
  kg_db: string;
  collection_count: number;
}

export interface StatusArgs {
  /** Skip wing/room breakdown — return total only. */
  skip_wings?: boolean;
  /** Force rebuild of wing_index from ChromaDB before querying. */
  rebuild_index?: boolean;
}

export interface StatusResult {
  total_drawers: number;
  wings: Record<string, { rooms: Record<string, number>; total: number }>;
  wing_count: number;
  halls: Record<string, number>;
  knowledge_graph: KgStatsResult;
  palace_path: string;
  /** 'wing_index' on the fast path; 'metadata_fallback' or 'error: ...' otherwise. */
  index_source: string;
  version: string;
}

// ─── Wake-up / classification / graph navigation ──────────────────────────

export interface WakeUpArgs {
  wing?: string;
}

export interface WakeUpResult extends BridgeStatusResponse {
  context?: string;
  token_estimate?: number;
  wing?: string;
}

export interface ClassifyArgs {
  text: string;
  /** Default 0.3. Lower = noisier. */
  min_confidence?: number;
}

export interface ClassifyMemory {
  memory_type: 'decision' | 'preference' | 'milestone' | 'problem' | 'emotional' | string;
  text?: string;
  confidence?: number;
  [key: string]: unknown;
}

export interface ClassifyResult extends BridgeStatusResponse {
  memories: ClassifyMemory[];
  count: number;
  types_found: string[];
}

export interface TraverseArgs {
  start_room: string;
  /** Default 2. */
  max_hops?: number;
}

export interface TraverseResult extends BridgeStatusResponse {
  start_room: string;
  max_hops: number;
  /** Connected rooms — exact shape depends on `mempalace.palace_graph.traverse`. */
  connected: unknown[];
  count: number;
}

export interface FindTunnelsArgs {
  wing_a?: string;
  wing_b?: string;
}

export interface FindTunnelsResult extends BridgeStatusResponse {
  wing_a: string | null;
  wing_b: string | null;
  tunnels: unknown[];
  count: number;
}

export interface CreateTunnelArgs {
  source_wing: string;
  source_room: string;
  target_wing: string;
  target_room: string;
  label?: string;
  source_drawer_id?: string;
  target_drawer_id?: string;
  /** Default 'explicit'. */
  kind?: string;
}

export interface CreateTunnelResult extends BridgeStatusResponse {
  tunnel?: unknown;
  source_wing: string;
  source_room: string;
  target_wing: string;
  target_room: string;
  kind: string;
}

// ─── Suggest parent (RFC-0010 §9) ─────────────────────────────────────────

export interface SuggestParentArgs {
  task: string;
  /** Max returned candidates. Default 3. */
  limit?: number;
  /** Confidence floor in [0, 1]. Default 0.15 (corpus-calibrated). */
  min_confidence?: number;
  wing?: string;
  /** Hard-gate: bail without invoking MemPalace if no `.dos-projects.json`. */
  require_projects_file?: boolean;
}

export type SuggestParentSignalSource = 'hybrid' | 'distance';

export interface SuggestParentCandidate {
  artifactId: string;
  title: string;
  /** Normalized to [0, 1]. */
  confidence: number;
  signal_source: SuggestParentSignalSource;
}

export interface SuggestParentResult {
  query: string;
  threshold: number;
  candidates: SuggestParentCandidate[];
  count: number;
  /** Set when an early-exit path fired (gated, empty task, search error). */
  reason?: string;
  /** Set only when `require_projects_file` was true and the file was missing. */
  gated?: boolean;
}

// ─── Diary ────────────────────────────────────────────────────────────────

export interface DiaryReadArgs {
  agent_name: string;
  action?: 'read';
  /** Default 10. */
  last_n?: number;
}

export interface DiaryWriteArgs {
  agent_name: string;
  action: 'write';
  entry: string;
  /** Default 'general'. */
  topic?: string;
}

export type DiaryArgs = DiaryReadArgs | DiaryWriteArgs;

export interface DiaryEntry {
  timestamp: string;
  agent_name: string;
  topic: string;
  entry: string;
}

export interface DiaryResult extends BridgeStatusResponse {
  agent_name: string;
  /** Present on read; absent on write. */
  entries?: DiaryEntry[];
  count?: number;
  /** Present on write. */
  topic?: string;
}

// ─── Batch ────────────────────────────────────────────────────────────────

export interface BatchArgs {
  operations: BridgeOp[];
}

export interface BatchOpResult extends BridgeStatusResponse {
  index?: number;
  [key: string]: unknown;
}

export interface BatchResult extends BridgeStatusResponse {
  results: BatchOpResult[];
  count: number;
  errors: number;
  validation_errors?: Array<{ index: number; reason: string; available?: string[] }>;
}

// ─── Fact check ───────────────────────────────────────────────────────────

export interface FactCheckArgs {
  text: string;
}

export interface FactCheckIssue {
  type: 'similar_name' | 'relationship_mismatch' | 'stale_fact' | string;
  [key: string]: unknown;
}

export interface FactCheckResult extends BridgeStatusResponse {
  issues: FactCheckIssue[];
  count: number;
  types_found: string[];
}

// ─── Closets ──────────────────────────────────────────────────────────────

export interface BuildClosetsArgs {
  source_file: string;
}

export interface BuildClosetsResult extends BridgeStatusResponse {
  source_file: string;
  drawers_found?: number;
  closets_created: number;
}

export interface RebuildClosetsArgs {
  /** Filter to a single wing. */
  wing?: string;
}

export interface RebuildClosetsResult extends BridgeStatusResponse {
  drawers_processed?: number;
  closets_created: number;
  wing_filter?: string;
}

export interface BackfillClosetsArgs {
  /** Filter to a single wing. */
  wing?: string;
  /** Default 0 = no cap. */
  max_files?: number;
  /** Default false. */
  dry_run?: boolean;
}

export interface BackfillClosetsResult extends BridgeStatusResponse {
  starting_coverage?: number;
  ending_coverage?: number;
  drawers_total?: number;
  drawers_in_scope?: number;
  drawers_covered?: number;
  drawers_uncovered?: number;
  files_processed: number;
  closets_created: number;
  wing_filter?: string | null;
  max_files: number;
  dry_run: boolean;
}

// ─── Reconcile (orphan/ghost audit) ───────────────────────────────────────

export interface ReconcileArgs {
  paths?: string[];
  wing?: string;
  fix?: boolean;
  skip?: string[];
  /** Skip files larger than this. Default 100. */
  max_size_kb?: number;
}

export interface ReconcileResult extends BridgeStatusResponse {
  scan_paths?: string[];
  projects_scanned?: number;
  files_on_disk?: number;
  files_indexed?: number;
  total_drawers?: number;
  orphaned_count?: number;
  orphaned_by_category?: Record<string, number>;
  ghost_count?: number;
  skipped_oversize?: number;
  max_size_kb?: number;
  closet_coverage?: string;
  kg_health?: KgStatsResult;
  fix_applied?: boolean;
  fixed_count?: number;
  fix_errors?: number;
}

// ─── Reflection append (atomic JSONL write) ───────────────────────────────

export interface AppendReflectionArgs {
  /** Object that becomes the JSON line. */
  entry: Record<string, unknown>;
  /** Override target path. Defaults to global algorithm-reflections.jsonl. */
  path?: string;
}

export interface AppendReflectionResult extends BridgeStatusResponse {
  path: string;
  bytes: number;
}

// ─── Fork-canonical aliases (RFC-0028 + v3.3.4) ───────────────────────────

export interface GraphStatsResult extends BridgeStatusResponse {
  nodes?: number;
  edges?: number;
  tunnels?: unknown[];
  [key: string]: unknown;
}

export interface LastCheckpointResult extends BridgeStatusResponse {
  /** 'ok' | 'quiet' | 'error'. Quiet = no recent journal entry. */
  status: 'ok' | 'quiet' | 'error' | string;
  message: string;
  count: number;
  timestamp: string | null;
}

// ─── Default timeout calibration ──────────────────────────────────────────
//
// Per-action defaults chosen to match historical bridgeSync call sites.
// Read-mostly (search, kg_query, status) keep the 5s default; long-form
// admin actions (mine_dir, rebuild_closets, reconcile) get 30s; init gets
// 60s to absorb first-time chromadb collection creation.

const TIMEOUT_DEFAULT_MS = 5000;
const TIMEOUT_LONG_MS = 30_000;
const TIMEOUT_INIT_MS = 60_000;

// ─── Internal call helpers ────────────────────────────────────────────────
//
// callSync / callAsync / callFire are the three thunk shapes that every
// public method in this module reduces to. Centralizing the cast + opts
// resolution + return-type narrowing here means each public method body
// is one line, and the four cross-cutting concerns (action constant,
// arg cast, default timeout, callerHook plumbing) live in one place.

function callSync<TResult, TArgs extends object>(
  action: BridgeActionName,
  args: TArgs,
  defaultTimeoutMs: number,
  opts?: SyncOpts,
): BridgeResult<TResult> {
  return bridgeSync(
    action,
    toBridgeArgs(args),
    opts?.timeoutMs ?? defaultTimeoutMs,
    true,
    opts?.callerHook,
  ) as BridgeResult<TResult>;
}

function callAsync<TResult, TArgs extends object>(
  action: BridgeActionName,
  args: TArgs,
  timeoutMs: number,
): Promise<BridgeResult<TResult>> {
  return bridgeAsync(action, toBridgeArgs(args), timeoutMs) as Promise<BridgeResult<TResult>>;
}

function callFire<TArgs extends object>(action: BridgeActionName, args: TArgs): void {
  bridgeFire(action, toBridgeArgs(args));
}

// ─── Sync flavor ───────────────────────────────────────────────────────────

/**
 * Synchronous typed bridge calls. Each method delegates to bridgeSync,
 * preserving every side effect (predicate gate, audit log, ring buffer,
 * memory-events, drift probe) and the BridgeResult discriminated union.
 *
 * `callerHook` is an optional opts field that flows into the
 * audit-log-collector record, letting downstream daemon-baseline analysis
 * attribute latency to specific hooks. Mirrors bridgeSync's existing param.
 */
export const mempalaceClient = {
  // ── Drawer writes ──
  addDrawer(args: DrawerWriteArgs, opts?: SyncOpts): BridgeResult<AddDrawerResult> {
    return callSync<AddDrawerResult, DrawerWriteArgs>(BRIDGE_ACTIONS.ADD_DRAWER, args, TIMEOUT_DEFAULT_MS, opts);
  },

  upsertDrawer(args: DrawerWriteArgs, opts?: SyncOpts): BridgeResult<AddDrawerResult> {
    return callSync<AddDrawerResult, DrawerWriteArgs>(BRIDGE_ACTIONS.UPSERT_DRAWER, args, TIMEOUT_DEFAULT_MS, opts);
  },

  updateDrawer(args: UpdateDrawerArgs, opts?: SyncOpts): BridgeResult<UpdateDrawerResult> {
    return callSync<UpdateDrawerResult, UpdateDrawerArgs>(BRIDGE_ACTIONS.UPDATE_DRAWER, args, TIMEOUT_DEFAULT_MS, opts);
  },

  deleteDrawer(args: DeleteDrawerArgs, opts?: SyncOpts): BridgeResult<DeleteDrawerResult> {
    return callSync<DeleteDrawerResult, DeleteDrawerArgs>(BRIDGE_ACTIONS.DELETE_DRAWER, args, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Drawer reads ──
  listDrawers(args: ListDrawersArgs = {}, opts?: SyncOpts): BridgeResult<ListDrawersResult> {
    return callSync<ListDrawersResult, ListDrawersArgs>(BRIDGE_ACTIONS.LIST_DRAWERS, args, TIMEOUT_DEFAULT_MS, opts);
  },

  search(args: SearchArgs, opts?: SyncOpts): BridgeResult<SearchResult> {
    return callSync<SearchResult, SearchArgs>(BRIDGE_ACTIONS.SEARCH, args, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Mining ──
  mineFile(args: MineFileArgs, opts?: SyncOpts): BridgeResult<MineFileResult> {
    return callSync<MineFileResult, MineFileArgs>(BRIDGE_ACTIONS.MINE_FILE, args, TIMEOUT_LONG_MS, opts);
  },

  mineDir(args: MineDirArgs, opts?: SyncOpts): BridgeResult<MineDirResult> {
    return callSync<MineDirResult, MineDirArgs>(BRIDGE_ACTIONS.MINE_DIR, args, TIMEOUT_LONG_MS, opts);
  },

  mineConvos(args: MineConvosArgs, opts?: SyncOpts): BridgeResult<MineConvosResult> {
    return callSync<MineConvosResult, MineConvosArgs>(BRIDGE_ACTIONS.MINE_CONVOS, args, TIMEOUT_LONG_MS, opts);
  },

  // ── Knowledge graph writes ──
  addKgFact(args: AddKgFactArgs, opts?: SyncOpts): BridgeResult<AddKgFactResult> {
    return callSync<AddKgFactResult, AddKgFactArgs>(BRIDGE_ACTIONS.ADD_KG_FACT, args, TIMEOUT_DEFAULT_MS, opts);
  },

  invalidate(args: InvalidateArgs, opts?: SyncOpts): BridgeResult<InvalidateResult> {
    return callSync<InvalidateResult, InvalidateArgs>(BRIDGE_ACTIONS.INVALIDATE, args, TIMEOUT_DEFAULT_MS, opts);
  },

  updateEntity(args: UpdateEntityArgs, opts?: SyncOpts): BridgeResult<UpdateEntityResult> {
    return callSync<UpdateEntityResult, UpdateEntityArgs>(BRIDGE_ACTIONS.UPDATE_ENTITY, args, TIMEOUT_DEFAULT_MS, opts);
  },

  mergeEntities(args: MergeEntitiesArgs, opts?: SyncOpts): BridgeResult<MergeEntitiesResult> {
    return callSync<MergeEntitiesResult, MergeEntitiesArgs>(BRIDGE_ACTIONS.MERGE_ENTITIES, args, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Knowledge graph reads ──
  kgQuery(args: KgQueryArgs, opts?: SyncOpts): BridgeResult<KgQueryResult> {
    return callSync<KgQueryResult, KgQueryArgs>(BRIDGE_ACTIONS.KG_QUERY, args, TIMEOUT_DEFAULT_MS, opts);
  },

  kgQueryPredicate(args: KgQueryPredicateArgs, opts?: SyncOpts): BridgeResult<KgQueryPredicateResult> {
    return callSync<KgQueryPredicateResult, KgQueryPredicateArgs>(BRIDGE_ACTIONS.KG_QUERY_PREDICATE, args, TIMEOUT_DEFAULT_MS, opts);
  },

  kgTimeline(args: KgTimelineArgs = {}, opts?: SyncOpts): BridgeResult<KgTimelineResult> {
    return callSync<KgTimelineResult, KgTimelineArgs>(BRIDGE_ACTIONS.KG_TIMELINE, args, TIMEOUT_DEFAULT_MS, opts);
  },

  kgStats(opts?: SyncOpts): BridgeResult<KgStatsResult> {
    return callSync<KgStatsResult, {}>(BRIDGE_ACTIONS.KG_STATS, {}, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Palace lifecycle ──
  init(opts?: SyncOpts): BridgeResult<InitResult> {
    return callSync<InitResult, {}>(BRIDGE_ACTIONS.INIT, {}, TIMEOUT_INIT_MS, opts);
  },

  status(args: StatusArgs = {}, opts?: SyncOpts): BridgeResult<StatusResult> {
    return callSync<StatusResult, StatusArgs>(BRIDGE_ACTIONS.STATUS, args, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Wake-up / classification / navigation ──
  wakeUp(args: WakeUpArgs = {}, opts?: SyncOpts): BridgeResult<WakeUpResult> {
    return callSync<WakeUpResult, WakeUpArgs>(BRIDGE_ACTIONS.WAKE_UP, args, TIMEOUT_DEFAULT_MS, opts);
  },

  classify(args: ClassifyArgs, opts?: SyncOpts): BridgeResult<ClassifyResult> {
    return callSync<ClassifyResult, ClassifyArgs>(BRIDGE_ACTIONS.CLASSIFY, args, TIMEOUT_DEFAULT_MS, opts);
  },

  traverse(args: TraverseArgs, opts?: SyncOpts): BridgeResult<TraverseResult> {
    return callSync<TraverseResult, TraverseArgs>(BRIDGE_ACTIONS.TRAVERSE, args, TIMEOUT_DEFAULT_MS, opts);
  },

  findTunnels(args: FindTunnelsArgs = {}, opts?: SyncOpts): BridgeResult<FindTunnelsResult> {
    return callSync<FindTunnelsResult, FindTunnelsArgs>(BRIDGE_ACTIONS.FIND_TUNNELS, args, TIMEOUT_DEFAULT_MS, opts);
  },

  createTunnel(args: CreateTunnelArgs, opts?: SyncOpts): BridgeResult<CreateTunnelResult> {
    return callSync<CreateTunnelResult, CreateTunnelArgs>(BRIDGE_ACTIONS.CREATE_TUNNEL, args, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Suggest parent (RFC-0010 §9) ──
  suggestParent(args: SuggestParentArgs, opts?: SyncOpts): BridgeResult<SuggestParentResult> {
    return callSync<SuggestParentResult, SuggestParentArgs>(BRIDGE_ACTIONS.SUGGEST_PARENT, args, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Diary ──
  diary(args: DiaryArgs, opts?: SyncOpts): BridgeResult<DiaryResult> {
    return callSync<DiaryResult, DiaryArgs>(BRIDGE_ACTIONS.DIARY, args, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Batch ──
  /**
   * Raw batch — pass an `operations: BridgeOp[]` array. For most use cases,
   * prefer `batchOps()` (callback-shaped, with per-call fallback). The raw
   * form is exposed for callers that need direct access to the batch
   * payload (e.g. a one-shot migration that wants to inspect the full
   * `BatchResult.results` array without registering callbacks).
   */
  batch(args: BatchArgs, opts?: SyncOpts): BridgeResult<BatchResult> {
    return callSync<BatchResult, BatchArgs>(BRIDGE_ACTIONS.BATCH, args, TIMEOUT_LONG_MS, opts);
  },

  /**
   * Callback-shaped batch driver. Delegates to `mempalace.batchOps` so the
   * batch-fallback semantics (per-op bridgeSync retry on outright batch
   * failure) match every existing call site verbatim.
   */
  batchOps<T extends { op: BridgeOp }>(items: T[], callbacks: BatchCallbacks<T>): BatchExecResult {
    return batchOpsRunner(items, callbacks);
  },

  // ── Fact check ──
  factCheck(args: FactCheckArgs, opts?: SyncOpts): BridgeResult<FactCheckResult> {
    return callSync<FactCheckResult, FactCheckArgs>(BRIDGE_ACTIONS.FACT_CHECK, args, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Closets ──
  buildClosets(args: BuildClosetsArgs, opts?: SyncOpts): BridgeResult<BuildClosetsResult> {
    return callSync<BuildClosetsResult, BuildClosetsArgs>(BRIDGE_ACTIONS.BUILD_CLOSETS, args, TIMEOUT_LONG_MS, opts);
  },

  rebuildClosets(args: RebuildClosetsArgs = {}, opts?: SyncOpts): BridgeResult<RebuildClosetsResult> {
    return callSync<RebuildClosetsResult, RebuildClosetsArgs>(BRIDGE_ACTIONS.REBUILD_CLOSETS, args, TIMEOUT_LONG_MS, opts);
  },

  backfillClosets(args: BackfillClosetsArgs = {}, opts?: SyncOpts): BridgeResult<BackfillClosetsResult> {
    return callSync<BackfillClosetsResult, BackfillClosetsArgs>(BRIDGE_ACTIONS.BACKFILL_CLOSETS, args, TIMEOUT_LONG_MS, opts);
  },

  // ── Reconcile ──
  reconcile(args: ReconcileArgs = {}, opts?: SyncOpts): BridgeResult<ReconcileResult> {
    return callSync<ReconcileResult, ReconcileArgs>(BRIDGE_ACTIONS.RECONCILE, args, TIMEOUT_LONG_MS, opts);
  },

  // ── Reflection ──
  appendReflection(args: AppendReflectionArgs, opts?: SyncOpts): BridgeResult<AppendReflectionResult> {
    return callSync<AppendReflectionResult, AppendReflectionArgs>(BRIDGE_ACTIONS.APPEND_REFLECTION, args, TIMEOUT_DEFAULT_MS, opts);
  },

  // ── Fork-canonical aliases (RFC-0028 + v3.3.4) ──
  graphStats(opts?: SyncOpts): BridgeResult<GraphStatsResult> {
    return callSync<GraphStatsResult, {}>(BRIDGE_ACTIONS.GRAPH_STATS, {}, TIMEOUT_DEFAULT_MS, opts);
  },

  lastCheckpoint(opts?: SyncOpts): BridgeResult<LastCheckpointResult> {
    return callSync<LastCheckpointResult, {}>(BRIDGE_ACTIONS.LAST_CHECKPOINT, {}, TIMEOUT_DEFAULT_MS, opts);
  },

  /** Legacy alias — same behavior as `lastCheckpoint`. Both names preserved
   * because the upstream MCP server exposes both and renaming the bridge
   * action would break canonical-name parity. */
  memoriesFiledAway(opts?: SyncOpts): BridgeResult<LastCheckpointResult> {
    return callSync<LastCheckpointResult, {}>(BRIDGE_ACTIONS.MEMORIES_FILED_AWAY, {}, TIMEOUT_DEFAULT_MS, opts);
  },
} as const;

// ─── Async flavor ──────────────────────────────────────────────────────────
//
// Mirrors the sync surface 1:1 but routes through `bridgeAsync` so consumers
// that need to `Promise.all` independent calls can do so without burning
// wall-clock on serialized subprocess spawns. The async helper does NOT
// thread `callerHook` through (bridgeAsync's existing signature drops it),
// so the audit-log records are tagged at spawn-time only — same as today's
// async call sites.

export const mempalaceClientAsync = {
  // ── Drawer writes ──
  addDrawer(args: DrawerWriteArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<AddDrawerResult>> {
    return callAsync<AddDrawerResult, DrawerWriteArgs>(BRIDGE_ACTIONS.ADD_DRAWER, args, timeoutMs);
  },

  upsertDrawer(args: DrawerWriteArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<AddDrawerResult>> {
    return callAsync<AddDrawerResult, DrawerWriteArgs>(BRIDGE_ACTIONS.UPSERT_DRAWER, args, timeoutMs);
  },

  updateDrawer(args: UpdateDrawerArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<UpdateDrawerResult>> {
    return callAsync<UpdateDrawerResult, UpdateDrawerArgs>(BRIDGE_ACTIONS.UPDATE_DRAWER, args, timeoutMs);
  },

  deleteDrawer(args: DeleteDrawerArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<DeleteDrawerResult>> {
    return callAsync<DeleteDrawerResult, DeleteDrawerArgs>(BRIDGE_ACTIONS.DELETE_DRAWER, args, timeoutMs);
  },

  // ── Drawer reads ──
  listDrawers(args: ListDrawersArgs = {}, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<ListDrawersResult>> {
    return callAsync<ListDrawersResult, ListDrawersArgs>(BRIDGE_ACTIONS.LIST_DRAWERS, args, timeoutMs);
  },

  search(args: SearchArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<SearchResult>> {
    return callAsync<SearchResult, SearchArgs>(BRIDGE_ACTIONS.SEARCH, args, timeoutMs);
  },

  // ── Mining ──
  mineFile(args: MineFileArgs, timeoutMs: number = TIMEOUT_LONG_MS): Promise<BridgeResult<MineFileResult>> {
    return callAsync<MineFileResult, MineFileArgs>(BRIDGE_ACTIONS.MINE_FILE, args, timeoutMs);
  },

  mineDir(args: MineDirArgs, timeoutMs: number = TIMEOUT_LONG_MS): Promise<BridgeResult<MineDirResult>> {
    return callAsync<MineDirResult, MineDirArgs>(BRIDGE_ACTIONS.MINE_DIR, args, timeoutMs);
  },

  mineConvos(args: MineConvosArgs, timeoutMs: number = TIMEOUT_LONG_MS): Promise<BridgeResult<MineConvosResult>> {
    return callAsync<MineConvosResult, MineConvosArgs>(BRIDGE_ACTIONS.MINE_CONVOS, args, timeoutMs);
  },

  // ── Knowledge graph writes ──
  addKgFact(args: AddKgFactArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<AddKgFactResult>> {
    return callAsync<AddKgFactResult, AddKgFactArgs>(BRIDGE_ACTIONS.ADD_KG_FACT, args, timeoutMs);
  },

  invalidate(args: InvalidateArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<InvalidateResult>> {
    return callAsync<InvalidateResult, InvalidateArgs>(BRIDGE_ACTIONS.INVALIDATE, args, timeoutMs);
  },

  updateEntity(args: UpdateEntityArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<UpdateEntityResult>> {
    return callAsync<UpdateEntityResult, UpdateEntityArgs>(BRIDGE_ACTIONS.UPDATE_ENTITY, args, timeoutMs);
  },

  mergeEntities(args: MergeEntitiesArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<MergeEntitiesResult>> {
    return callAsync<MergeEntitiesResult, MergeEntitiesArgs>(BRIDGE_ACTIONS.MERGE_ENTITIES, args, timeoutMs);
  },

  // ── Knowledge graph reads ──
  kgQuery(args: KgQueryArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<KgQueryResult>> {
    return callAsync<KgQueryResult, KgQueryArgs>(BRIDGE_ACTIONS.KG_QUERY, args, timeoutMs);
  },

  kgQueryPredicate(args: KgQueryPredicateArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<KgQueryPredicateResult>> {
    return callAsync<KgQueryPredicateResult, KgQueryPredicateArgs>(BRIDGE_ACTIONS.KG_QUERY_PREDICATE, args, timeoutMs);
  },

  kgTimeline(args: KgTimelineArgs = {}, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<KgTimelineResult>> {
    return callAsync<KgTimelineResult, KgTimelineArgs>(BRIDGE_ACTIONS.KG_TIMELINE, args, timeoutMs);
  },

  kgStats(timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<KgStatsResult>> {
    return callAsync<KgStatsResult, {}>(BRIDGE_ACTIONS.KG_STATS, {}, timeoutMs);
  },

  // ── Palace lifecycle ──
  init(timeoutMs: number = TIMEOUT_INIT_MS): Promise<BridgeResult<InitResult>> {
    return callAsync<InitResult, {}>(BRIDGE_ACTIONS.INIT, {}, timeoutMs);
  },

  status(args: StatusArgs = {}, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<StatusResult>> {
    return callAsync<StatusResult, StatusArgs>(BRIDGE_ACTIONS.STATUS, args, timeoutMs);
  },

  // ── Wake-up / classification / navigation ──
  wakeUp(args: WakeUpArgs = {}, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<WakeUpResult>> {
    return callAsync<WakeUpResult, WakeUpArgs>(BRIDGE_ACTIONS.WAKE_UP, args, timeoutMs);
  },

  classify(args: ClassifyArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<ClassifyResult>> {
    return callAsync<ClassifyResult, ClassifyArgs>(BRIDGE_ACTIONS.CLASSIFY, args, timeoutMs);
  },

  traverse(args: TraverseArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<TraverseResult>> {
    return callAsync<TraverseResult, TraverseArgs>(BRIDGE_ACTIONS.TRAVERSE, args, timeoutMs);
  },

  findTunnels(args: FindTunnelsArgs = {}, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<FindTunnelsResult>> {
    return callAsync<FindTunnelsResult, FindTunnelsArgs>(BRIDGE_ACTIONS.FIND_TUNNELS, args, timeoutMs);
  },

  createTunnel(args: CreateTunnelArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<CreateTunnelResult>> {
    return callAsync<CreateTunnelResult, CreateTunnelArgs>(BRIDGE_ACTIONS.CREATE_TUNNEL, args, timeoutMs);
  },

  // ── Suggest parent (RFC-0010 §9) ──
  suggestParent(args: SuggestParentArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<SuggestParentResult>> {
    return callAsync<SuggestParentResult, SuggestParentArgs>(BRIDGE_ACTIONS.SUGGEST_PARENT, args, timeoutMs);
  },

  // ── Diary ──
  diary(args: DiaryArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<DiaryResult>> {
    return callAsync<DiaryResult, DiaryArgs>(BRIDGE_ACTIONS.DIARY, args, timeoutMs);
  },

  // ── Batch ──
  batch(args: BatchArgs, timeoutMs: number = TIMEOUT_LONG_MS): Promise<BridgeResult<BatchResult>> {
    return callAsync<BatchResult, BatchArgs>(BRIDGE_ACTIONS.BATCH, args, timeoutMs);
  },

  // ── Fact check ──
  factCheck(args: FactCheckArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<FactCheckResult>> {
    return callAsync<FactCheckResult, FactCheckArgs>(BRIDGE_ACTIONS.FACT_CHECK, args, timeoutMs);
  },

  // ── Closets ──
  buildClosets(args: BuildClosetsArgs, timeoutMs: number = TIMEOUT_LONG_MS): Promise<BridgeResult<BuildClosetsResult>> {
    return callAsync<BuildClosetsResult, BuildClosetsArgs>(BRIDGE_ACTIONS.BUILD_CLOSETS, args, timeoutMs);
  },

  rebuildClosets(args: RebuildClosetsArgs = {}, timeoutMs: number = TIMEOUT_LONG_MS): Promise<BridgeResult<RebuildClosetsResult>> {
    return callAsync<RebuildClosetsResult, RebuildClosetsArgs>(BRIDGE_ACTIONS.REBUILD_CLOSETS, args, timeoutMs);
  },

  backfillClosets(args: BackfillClosetsArgs = {}, timeoutMs: number = TIMEOUT_LONG_MS): Promise<BridgeResult<BackfillClosetsResult>> {
    return callAsync<BackfillClosetsResult, BackfillClosetsArgs>(BRIDGE_ACTIONS.BACKFILL_CLOSETS, args, timeoutMs);
  },

  // ── Reconcile ──
  reconcile(args: ReconcileArgs = {}, timeoutMs: number = TIMEOUT_LONG_MS): Promise<BridgeResult<ReconcileResult>> {
    return callAsync<ReconcileResult, ReconcileArgs>(BRIDGE_ACTIONS.RECONCILE, args, timeoutMs);
  },

  // ── Reflection ──
  appendReflection(args: AppendReflectionArgs, timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<AppendReflectionResult>> {
    return callAsync<AppendReflectionResult, AppendReflectionArgs>(BRIDGE_ACTIONS.APPEND_REFLECTION, args, timeoutMs);
  },

  // ── Fork-canonical aliases ──
  graphStats(timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<GraphStatsResult>> {
    return callAsync<GraphStatsResult, {}>(BRIDGE_ACTIONS.GRAPH_STATS, {}, timeoutMs);
  },

  lastCheckpoint(timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<LastCheckpointResult>> {
    return callAsync<LastCheckpointResult, {}>(BRIDGE_ACTIONS.LAST_CHECKPOINT, {}, timeoutMs);
  },

  memoriesFiledAway(timeoutMs: number = TIMEOUT_DEFAULT_MS): Promise<BridgeResult<LastCheckpointResult>> {
    return callAsync<LastCheckpointResult, {}>(BRIDGE_ACTIONS.MEMORIES_FILED_AWAY, {}, timeoutMs);
  },
} as const;

// ─── Fire-and-forget flavor (write-only, exit-status unobserved) ──────────
//
// Limited to actions that hooks already invoke fire-and-forget today —
// reflection-append (high-volume LEARN-phase writes) and a small set of
// drawer writes that do not need confirmation (MemoryHarvest's bulk path
// already uses bridgeFire for these). We deliberately do NOT expose a
// `*Fire` for kg_query, search, or any read action — those have meaningful
// return values and a void-returning helper would silently lose them.

export const mempalaceClientFire = {
  /** Fire-and-forget reflection append. Returns immediately. */
  appendReflection(args: AppendReflectionArgs): void {
    callFire(BRIDGE_ACTIONS.APPEND_REFLECTION, args);
  },

  /** Fire-and-forget drawer write — used by MemoryHarvest. */
  addDrawer(args: DrawerWriteArgs): void {
    callFire(BRIDGE_ACTIONS.ADD_DRAWER, args);
  },

  /** Fire-and-forget upsert drawer — same shape as addDrawer. */
  upsertDrawer(args: DrawerWriteArgs): void {
    callFire(BRIDGE_ACTIONS.UPSERT_DRAWER, args);
  },

  /**
   * Fire-and-forget KG fact write. Note: the predicate gate is enforced
   * inside `bridgeSync`, NOT `bridgeFire` — so unknown predicates skip
   * the warn/block path here. Callers that need the gate must use the
   * sync flavor.
   */
  addKgFact(args: AddKgFactArgs): void {
    callFire(BRIDGE_ACTIONS.ADD_KG_FACT, args);
  },

  /** Fire-and-forget invalidate — used by hygiene scans that don't await. */
  invalidate(args: InvalidateArgs): void {
    callFire(BRIDGE_ACTIONS.INVALIDATE, args);
  },

  /**
   * Fire-and-forget diary WRITE. Returns immediately so a slow ChromaDB
   * write cannot block SessionEnd hooks past Claude Code's reaper budget
   * (surface symptom: "Hook cancelled"). The diary read path stays on the
   * sync flavor — read callers need the returned entries.
   */
  diary(args: DiaryWriteArgs): void {
    callFire(BRIDGE_ACTIONS.DIARY, args);
  },
} as const;

// ─── Default export — convenience namespace ───────────────────────────────
//
// Importers can pick whichever surface fits the call site:
//   import { mempalaceClient } from './mempalace-client.ts';
//   const r = mempalaceClient.kgStats();
// or:
//   import client from './mempalace-client.ts';
//   const r = client.sync.kgStats();
//   const p = client.async.search({query: 'foo'});
//   client.fire.appendReflection({entry: {...}});

const client = {
  sync: mempalaceClient,
  async: mempalaceClientAsync,
  fire: mempalaceClientFire,
} as const;

export default client;
