#!/usr/bin/env bun
/**
 * RFC-0001 headless orchestration runtime — barrel module.
 *
 * After the G6 (Long-Class) refactor (iters 1-9), this file is now a pure
 * barrel that re-exports the orchestrator's public API from leaf modules.
 * All implementation lives in siblings:
 *   - types.ts                     — type contracts + CANONICAL_PHASES, EFFORT_DEFAULTS, PHASE_SPECS, normalize*
 *   - utils.ts                     — stableJson, sha256
 *   - gates.ts                     — gate evaluators + GateContext
 *   - capability-registry.ts       — registry building, walking, hashing
 *   - capability-authorization.ts  — authorize + capabilityContractBlock
 *   - tool-authorization.ts        — authorizeToolInvocation
 *   - prd-interop.ts               — Criterion <-> markdown
 *   - extension-registry.ts        — manifest discovery + extensionContractBlock
 *   - stores.ts                    — MemoryStore, FileStore, DEFAULT_ORCHESTRATOR_STATE_DIR
 *   - runner.ts                    — runOrchestration loop + phase records + retry + context
 *   - claude-adapter.ts            — Claude CLI Adapter implementation
 *   - cli.ts                       — orchestrator CLI entry
 *
 * External callers continue importing from `./orchestrator` (this barrel)
 * unchanged. Internal sibling files import from each other directly.
 */

export {
  CANONICAL_PHASES,
  CAPABILITY_FLAGS,
  EFFORT_DEFAULTS,
  PHASE_SPECS,
  normalizeEffortLevel,
  normalizePhaseId,
} from "./types";
export type {
  Adapter,
  AdapterInvokeRequest,
  AdapterInvokeResult,
  CapabilityDecision,
  CapabilityFlag,
  CapabilityPhaseUse,
  CapabilityRegistry,
  CapabilityRegistryEntry,
  CapabilitySource,
  CapabilitySurface,
  CriteriaSet,
  Criterion,
  CriterionPriority,
  CriterionStatus,
  Diagnostic,
  EffortDefaults,
  EffortLevel,
  ExtensionContribution,
  ExtensionRegistry,
  GateResult,
  GateRolloutMode,
  LegacyPhaseId,
  OrchestrationRun,
  PhaseId,
  PhaseRecord,
  PhaseType,
  RegisteredTool,
  RetryRecord,
  Store,
  ToolDecision,
  ToolGateLevel,
  ToolRequest,
  VerificationMethod,
} from "./types";

export { sha256 } from "./utils";

export {
  criteriaCoverage,
  criteriaCriticalPass,
  criteriaHasAnti,
  criteriaHasTest,
  criteriaMinCount,
  criteriaMinCountForEffort,
  evaluateGate,
  slotFilled,
} from "./gates";
export type { GateContext } from "./gates";

export {
  buildCapabilityRegistry,
  capabilityRegistryPath,
  findCapabilityEntry,
  loadCapabilityRegistry,
  writeCapabilityRegistry,
} from "./capability-registry";

export {
  authorizeCapabilityInvocation,
  capabilityContractBlock,
} from "./capability-authorization";

export { authorizeToolInvocation } from "./tool-authorization";

export {
  importLegacyCriteriaMarkdown,
  renderCriteriaMarkdown,
  renderPrdProjection,
} from "./prd-interop";

export {
  createExtensionRegistry,
  extensionContractBlock,
  loadExtensionRegistry,
} from "./extension-registry";
export type { LoadExtensionRegistryOptions } from "./extension-registry";

export { DEFAULT_ORCHESTRATOR_STATE_DIR, FileStore, MemoryStore } from "./stores";

export {
  compactContextTier1,
  compactContextTier2,
  currentPhaseForRun,
  makePhaseRecord,
  normalizeVerificationMethod,
  phaseContract,
  phaseRecordDigest,
  runOrchestration,
} from "./runner";
export type { ContextSnapshot, RunOptions } from "./runner";
