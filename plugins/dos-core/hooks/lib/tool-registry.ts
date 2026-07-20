/**
 * tool-registry.ts — Single source of truth for the StudioSync spawn fleet.
 *
 * Every Save*ToStudio.ts orchestrated by StudioSync.hook.ts is enumerated
 * here. The hook's main() iterates over SYNC_TOOLS instead of hardcoding
 * spawnTool calls, so adding a new sync tool is a one-line registry edit.
 *
 * mode semantics:
 *   - 'queue':   tool calls queueOrPost() and is gated by DOS_DLQ_QUEUE_ONLY=1.
 *                Hook spawns it with that env so .pending/ envelopes land
 *                without network I/O during SessionEnd. DrainPending.hook.ts
 *                ships them out-of-band.
 *   - 'direct':  RESERVED — currently UNUSED (count 0). Historically meant
 *                "bypasses the DLQ and POSTs straight to Studio with its own
 *                retry". Security/Artifacts/Deferrals/Commitments all migrated
 *                to 'queue' in Phase-3, so no live entry carries this mode. The
 *                union member is retained so pin_sync_tools_list_count.test.ts
 *                can pin the direct-count-is-0 Phase-3 invariant.
 *   - 'special': non-standard env. SaveProjectsToStudio runs WITHOUT
 *                DOS_DLQ_QUEUE_ONLY because it intentionally talks directly
 *                to /api/v1/projects (project registry is the prerequisite
 *                for x-dos-project-slug → projectId resolution upstream of
 *                the queue itself).
 *
 * Source-of-truth for ordering: the historical sequence in
 * StudioSync.hook.ts:142-160, then the orphan slots (deferrals, commitments)
 * appended in their natural KG-derived order, then projects last.
 *
 * NOTE: Adding a new sync tool? Append a SyncToolSpec entry here. Do NOT
 * edit StudioSync.hook.ts main() — it iterates this array automatically.
 */

import type { DLQTool } from './dlq';

export interface SyncToolSpec {
  /** Filename relative to TOOLS_DIR (e.g., "SaveSessionsToStudio.ts") */
  filename: string;
  /** DLQTool name when mode === 'queue', else null */
  dlqTool: DLQTool | null;
  /** API endpoint relative to /api/v1/ */
  endpoint: string;
  /** 'queue' = uses DLQ; 'direct' = bypasses DLQ; 'special' = non-standard env (Projects) */
  mode: 'queue' | 'direct' | 'special';
  /** Optional spawn-arg override. Defaults to ['--import-all'] in callers. */
  args?: string[];
}

export const SYNC_TOOLS: ReadonlyArray<SyncToolSpec> = [
  // ─── queue-mode (full registry total is 23 queue + 3 special = 26) ─
  // These match the existing StudioSync.hook.ts:142-160 spawn order
  // 1:1 — preserve the sequence so iteration is observably identical
  // to the prior hardcoded fleet when DOS_DLQ_QUEUE_ONLY=1 is the env.
  { filename: 'SaveSessionsToStudio.ts',          dlqTool: 'sessions',            endpoint: 'sessions',                 mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveWorkToStudio.ts',              dlqTool: 'work',                endpoint: 'work',                     mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveReflectionsToStudio.ts',       dlqTool: 'reflections',         endpoint: 'reflections',              mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveSignalsToStudio.ts',           dlqTool: 'signals',             endpoint: 'signals',                  mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveKgToStudio.ts',                dlqTool: 'kg',                  endpoint: 'kg/sync',                  mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveCorrectionsToStudio.ts',       dlqTool: 'corrections',         endpoint: 'corrections',              mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveFailuresToStudio.ts',          dlqTool: 'failures',            endpoint: 'failures',                 mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveLearningsToStudio.ts',         dlqTool: 'learnings',           endpoint: 'learnings',                mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveMemoryStatsToStudio.ts',       dlqTool: 'memory-snapshots',    endpoint: 'memory/snapshots',         mode: 'queue',  args: ['--import-all'] },
  // F1 (RFC-0062 follow-up, 2026-05-05): SaveMemoryEventsToStudio removed from
  // registry. The /api/v1/memory/events route does not exist on Studio, so every
  // emission was a guaranteed 404 → quarantine. Producer file kept in
  // Packs/research/src/Tools/SaveMemoryEventsToStudio.ts for audit; restore the
  // entry here if Studio adds the route.
  { filename: 'SaveHookMetricsToStudio.ts',       dlqTool: 'hook-metrics',        endpoint: 'hooks/metrics',            mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveVoiceEventsToStudio.ts',       dlqTool: 'voice-events',        endpoint: 'voice/events',             mode: 'queue',  args: ['--import-all'] },
  // SaveSecurityEventsToStudio — Phase-3 migrated: custom DLQ deleted, now uses queueOrPost.
  { filename: 'SaveSecurityEventsToStudio.ts',    dlqTool: 'security-events',     endpoint: 'security/events',          mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveRelationshipNotesToStudio.ts', dlqTool: 'relationships-notes', endpoint: 'relationships/notes',      mode: 'queue',  args: ['--import-all'] },
  { filename: 'SaveResearchVaultsToStudio.ts',    dlqTool: 'research',            endpoint: 'research',                 mode: 'queue',  args: ['--import-all'] },
  { filename: 'SavePlansToStudio.ts',             dlqTool: 'plans',               endpoint: 'plans',                    mode: 'queue',  args: ['--import-all'] },
  // v0.0.20 slice 0b — gated producer: SaveTelosToStudio exits 0 unless
  // DOS_TELOS_SYNC=1 (the /api/v1/telos Studio route is a roadmap slice;
  // posting before it exists would mint quarantine-route noise every drain).
  { filename: 'SaveTelosToStudio.ts',             dlqTool: 'telos',               endpoint: 'telos',                    mode: 'queue',  args: ['--import-all'] },
  // ISC-30 / audit F6 — workflow run receipts. SaveWorkflowReceiptsToStudio
  // synthesizes a receipt per Workflow run from the harness-persisted transcript
  // journals (wf_*/journal.jsonl → agent fan-out counts) into
  // MEMORY/STATE/workflow-receipts.jsonl, then drains to /api/v1/workflow/receipts
  // (NET-NEW Studio route). Makes silent skeleton-degradation observable:
  // a degraded run spawns few/no agents, visible in agents_spawned.
  { filename: 'SaveWorkflowReceiptsToStudio.ts',  dlqTool: 'workflow-receipts',   endpoint: 'workflow/receipts',        mode: 'queue',  args: ['--import-all'] },
  // SaveArtifactsToStudio — Phase-3 migrated: custom DLQ deleted, now uses queueOrPost.
  { filename: 'SaveArtifactsToStudio.ts',         dlqTool: 'artifacts',           endpoint: 'artifacts',                mode: 'queue',  args: ['--import-all'] },
  // SaveInnerArtifactsToStudio — RFC-0032 Phase A W1: closes the MEMORY/* coverage
  // gap by walking ARTIFACTS+SECURITY+LEARNING for files NOT owned by the per-tool
  // readers above. Table-driven kind dispatch; sensitive-file allowlist; tier=content
  // (≤256KiB) or tier=reference. Lives in skills/research/Tools/ alongside the
  // other generic substrate tools.
  { filename: 'SaveInnerArtifactsToStudio.ts',    dlqTool: 'inner-artifacts',     endpoint: 'inner-artifacts',          mode: 'queue',  args: ['--import-all'] },
  // RFC-0068 ISC-10 — drain MEMORY/STATE/skill-activations.jsonl to the
  // /api/v1/skills/activations route. Producer (claude_code.skill_activated
  // OTEL emitter / Mode Classifier banner hook) is out of scope for ISC-10;
  // ratification only requires that the sync surface ship end-to-end.
  { filename: 'SaveSkillActivationsToStudio.ts',  dlqTool: 'skill-activations',   endpoint: 'skills/activations',       mode: 'queue',  args: ['--import-all'] },
  // RFC-0074 V11.19 — drain MEMORY/STATE/banner-fire-events.jsonl (produced
  // by Tools/banner-fire-analyzer.ts, V11.8 shipped 2026-05-09) to the
  // /api/v1/banner-fire route. Studio persistence is intentionally deferred
  // to v0.0.12+; route is auth+Zod+idempotency-keyed 201 stub. Panel reads
  // local JSONL directly (no DB read needed for v0.0.11 panel).
  { filename: 'SaveBannerFireToStudio.ts',        dlqTool: 'banner-fire',         endpoint: 'banner-fire',              mode: 'queue',  args: ['--import-all'] },

  // ─── queue-mode KG-driven (Phase-3 migrated) ──────────────────────
  // Previously direct-POST with server-side upsert idempotency; Phase-3
  // moved them onto queueOrPost so they get the DLQ envelope + retry.
  { filename: 'SaveDeferralsToStudio.ts',         dlqTool: 'deferrals',           endpoint: 'deferrals',                mode: 'queue',  args: ['--import-all'] },
  // commitments was orphan in Phase-1; added to registry in Phase-2;
  // migrated to queueOrPost in Phase-3 alongside the other KG-driven tool.
  { filename: 'SaveCommitmentsToStudio.ts',       dlqTool: 'commitments',         endpoint: 'commitments',              mode: 'queue',  args: ['--import-all'] },

  // ─── special-mode (1) ─────────────────────────────────────────────
  // Projects must run WITHOUT DOS_DLQ_QUEUE_ONLY so it can perform direct
  // POSTs against /api/v1/projects to seed the slug→Project.id table that
  // every other tool's auth-bearer needs. No --import-all; tool reads the
  // canonical .dos-projects.json on its own.
  { filename: 'SaveProjectsToStudio.ts',          dlqTool: null,                  endpoint: 'projects',                 mode: 'special' },

  // ─── special-mode: local spawn, no Studio POST (2) ─────────────────
  // WorkOsReconcile is NOT a Save*ToStudio producer — it POSTs nothing to
  // Studio. It rides the SessionEnd detached fan-out (RFC-0133 P2 / RFC-0151
  // council §8 P3 "special-mode SYNC_TOOLS entry") to fire
  // `bun Tools/work-os.ts reconcile` in the dos repo out-of-band: debounced
  // (30 min timestamp in MEMORY/STATE/work-os-last-reconcile.json) and a clean
  // no-op on customer installs without Work OS. special mode → the daemon
  // spawns it with the FULL env (no DOS_DLQ_QUEUE_ONLY), so DOS_WORK_OS_TOKEN
  // reaches work-os.ts → gh as the single bot identity (RFC-0151 F4 residual
  // #1). endpoint is a LOCAL route label (never hit over the wire — kept
  // non-empty + unique to satisfy the registry contract); dlqTool null.
  { filename: 'WorkOsReconcile.ts',               dlqTool: null,                  endpoint: 'work-os/reconcile',        mode: 'special' },

  // BannerFireCollect gives the RFC-0074 banner-fire producer a real cadence
  // (T20 ruling (a), decision 01KXA71MHMCQG6QP8KDZPNT94Y — Forge Gen 118):
  // the events file had a live drainer (SaveBannerFireToStudio) + Studio panel
  // but the producer was a manual CLI with zero invokers (59-day rot). Same
  // pattern as WorkOsReconcile: local detached spawn of
  // `bun Tools/banner-fire-analyzer.ts --last 5` in the dos repo, debounced
  // 30 min (MEMORY/STATE/banner-fire-last-collect.json), clean no-op on
  // customer installs. The analyzer is append-idempotent on
  // (session_id, turn_uuid) — added the same gen — so overlap is free.
  // POSTs nothing; endpoint is a LOCAL route label; dlqTool null.
  { filename: 'BannerFireCollect.ts',             dlqTool: null,                  endpoint: 'banner-fire/collect',      mode: 'special' },
];
