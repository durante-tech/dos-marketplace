/**
 * RFC-0001 orchestration runtime — type definitions and pure config tables.
 *
 * Extracted from `index.ts` per the G6 (Long-Class) refactor. This module owns
 * the SHAPE of the orchestrator domain: phases, criteria, gates, capabilities,
 * adapter contracts, store contracts, extension contributions, effort defaults.
 *
 * Zero side effects, zero I/O, zero process.env. Importable from anywhere
 * inside `orchestrator/` and re-exported via the `index.ts` barrel for
 * backward compatibility with external callers.
 */

export const CANONICAL_PHASES = [
  "CLASSIFY",
  "OBSERVE",
  "DEFINE",
  "THINK",
  "PLAN",
  "MAKE",
  "SYNTHESIZE",
  "VERIFY",
  "LEARN",
] as const;

export type PhaseId = (typeof CANONICAL_PHASES)[number];
export type LegacyPhaseId = "BUILD" | "EXECUTE" | "COMPLETE";
export type EffortLevel = "minimal" | "compressed" | "fast" | "standard" | "extended" | "advanced";
export type ToolGateLevel = "read-only" | "verify" | "full";
export type GateRolloutMode = "shadow" | "block";
export type PhaseType = "code" | "llm" | "hybrid";
export type CriterionPriority = "critical" | "important" | "nice";
export type CriterionStatus = "pending" | "in_progress" | "completed" | "failed";

export interface VerificationMethod {
  type: "command" | "grep" | "read" | "subjective" | "adapter" | "file_exists" | "text_in_file";
  command?: string;
  args?: string[];
  expectExit?: number;
  pattern?: string;
  path?: string;
  paths?: string[];
  contains?: string;
  hint?: string;
  adapter?: string;
}

export interface Criterion {
  id: string;
  subject: string;
  description: string;
  priority: CriterionPriority;
  isAnti: boolean;
  status: CriterionStatus;
  verificationMethod?: VerificationMethod;
  evidence?: string;
  createdInPhase: PhaseId;
  updatedInPhase?: PhaseId;
}

export interface CriteriaSet {
  criteria: Criterion[];
}

export interface PhaseRecord {
  id: string;
  phase: PhaseId;
  legacyPhase?: LegacyPhaseId;
  type: PhaseType;
  toolGate: ToolGateLevel;
  startedAt: string;
  completedAt: string;
  slots: Record<string, unknown>;
  output?: string;
  diagnostics: Diagnostic[];
  retryOf?: string;
}

export interface Diagnostic {
  code: string;
  severity: "info" | "warn" | "error";
  phase?: PhaseId;
  message: string;
  details?: Record<string, unknown>;
}

export interface GateResult {
  gate: string;
  pass: boolean;
  message: string;
  diagnostics?: Record<string, unknown>;
}

export interface RetryRecord {
  id: string;
  failedPhase: PhaseId;
  originPhase: PhaseId;
  gateResults: GateResult[];
  note: string;
  createdAt: string;
}

export interface OrchestrationRun {
  id: string;
  request: string;
  effort: EffortLevel;
  category: string;
  activePhases: PhaseId[];
  phaseRecords: PhaseRecord[];
  criteria: Criterion[];
  retries: RetryRecord[];
  status: "complete" | "paused" | "aborted" | "failed";
  diagnostics: Diagnostic[];
  prdMarkdown: string;
  prdProjection?: {
    renderedAt: string;
    criteriaCount: number;
    phaseRecordCount: number;
    source: "structured-criteria";
    legacyImportedAt?: string;
  };
}

export interface RegisteredTool {
  id: string;
  readOnly?: boolean;
  destructive?: boolean;
  concurrencySafe?: boolean;
  kind?: "read" | "write" | "shell" | "verification" | "criteria_define" | "criteria_update" | "status_update" | "approval";
  phaseTools?: PhaseId[];
  surfaceId?: string;
  capabilities?: CapabilityFlag[];
  capabilityMissing?: boolean;
  capabilitySource?: string;
}

export const CAPABILITY_FLAGS = [
  "fs.read",
  "fs.write",
  "shell.read",
  "shell.write",
  "web.read",
  "mcp.read",
  "mcp.write",
  "memory.read",
  "memory.write",
  "criteria.define",
  "criteria.update",
  "phase.status",
  "agent.spawn",
  "artifact.write",
  "approval.request",
  "voice.emit",
  "format.only",
] as const;

export type CapabilityFlag = (typeof CAPABILITY_FLAGS)[number];
export type CapabilitySurface = "skill" | "workflow" | "partial" | "agent" | "mcp" | "tool";
export type CapabilityPhaseUse = "allowed" | "allowed-with-evidence-only" | "blocked";
export type CapabilitySource = "generated" | "sidecar" | "built-in";

export interface CapabilityRegistryEntry {
  id: string;
  surface: CapabilitySurface;
  path?: string;
  capabilities: CapabilityFlag[];
  phaseUse?: Partial<Record<PhaseId, CapabilityPhaseUse>>;
  source: CapabilitySource;
  confidence?: "explicit" | "inferred";
  diagnostics?: Diagnostic[];
  /**
   * USE-WHEN trigger corpus projected from SKILL.md / workflow / agent frontmatter
   * `description` (RFC-0134 slice 0b). Optional — entries without a frontmatter
   * description carry no trigger text and the old registry shape is unchanged for
   * them. Consumed by the capability-select scorer; never read by the gate.
   */
  useWhen?: string;
  /** Token count of `useWhen`, for the scorer's breadth penalty (RFC-0134). */
  surfaceTokenCount?: number;
}

export interface CapabilityRegistry {
  schema: "dos-capability-registry/v1";
  generatedAt: string;
  root: string;
  entries: CapabilityRegistryEntry[];
  diagnostics: Diagnostic[];
  hash: string;
}

export interface CapabilityDecision {
  surfaceId: string;
  capabilities: CapabilityFlag[];
  allowed: boolean;
  mode: GateRolloutMode;
  reason: string;
  diagnostic?: Diagnostic;
}

export interface ToolRequest {
  toolId: string;
  input?: unknown;
}

export interface ToolDecision {
  toolId: string;
  allowed: boolean;
  mode: GateRolloutMode;
  reason: string;
  diagnostic?: Diagnostic;
}

export interface AdapterInvokeRequest {
  runId: string;
  request: string;
  phase: PhaseId;
  effort: EffortLevel;
  systemPrompt: string;
  toolGate: ToolGateLevel;
  criteria: readonly Criterion[];
  priorRecords: readonly PhaseRecord[];
  retryNote?: string;
}

export interface AdapterInvokeResult {
  output?: string;
  slots?: Record<string, unknown>;
  criteria?: Criterion[];
  criteriaUpdates?: Array<Partial<Criterion> & { id: string }>;
  toolRequests?: ToolRequest[];
  diagnostics?: Diagnostic[];
}

export interface Adapter {
  invokeModel(request: AdapterInvokeRequest): Promise<AdapterInvokeResult>;
  listTools(): Promise<RegisteredTool[]>;
  authorizeTool?(decision: ToolDecision): Promise<ToolDecision>;
  requestApproval?(request: {
    runId: string;
    phase: PhaseId;
    plan: Record<string, unknown>;
    criteria: readonly Criterion[];
  }): Promise<"approved" | "modify" | "abort">;
  emitDiagnostic?(diagnostic: Diagnostic): Promise<void>;
  persistEvent?(event: { type: string; payload: unknown }): Promise<void>;
}

export interface Store {
  getRun(): OrchestrationRun;
  setEffort(effort: EffortLevel, category: string, activePhases: PhaseId[]): void;
  appendPhaseRecord(record: PhaseRecord): void;
  setCriteria(criteria: Criterion[]): void;
  updateCriteria(updates: Array<Partial<Criterion> & { id: string }>, phase: PhaseId): void;
  appendRetry(record: RetryRecord): void;
  appendDiagnostic(diagnostic: Diagnostic): void;
  setStatus(status: OrchestrationRun["status"]): void;
}

export interface ExtensionContribution {
  surface: "phase" | "gate" | "tool_gate_level" | "handler" | "criterion_type" | "slot_type" | "effort_level" | "model_routing_strategy";
  id: string;
  extensionId: string;
  path?: string;
  raw: Record<string, unknown>;
}

export interface ExtensionRegistry {
  contributions: ExtensionContribution[];
  diagnostics: Diagnostic[];
  manifestCount?: number;
  getBySurface(surface: ExtensionContribution["surface"]): ExtensionContribution[];
}

export interface EffortDefaults {
  activePhases: PhaseId[];
  criteriaFloor: number;
  budgetSeconds: number;
}

export const EFFORT_DEFAULTS: Record<EffortLevel, EffortDefaults> = {
  minimal: { activePhases: [], criteriaFloor: 0, budgetSeconds: 15 },
  compressed: { activePhases: ["CLASSIFY", "MAKE", "LEARN"], criteriaFloor: 1, budgetSeconds: 60 },
  fast: { activePhases: ["CLASSIFY", "OBSERVE", "DEFINE", "MAKE", "VERIFY", "LEARN"], criteriaFloor: 2, budgetSeconds: 120 },
  standard: { activePhases: ["CLASSIFY", "OBSERVE", "DEFINE", "MAKE", "VERIFY", "LEARN"], criteriaFloor: 4, budgetSeconds: 480 },
  extended: { activePhases: ["CLASSIFY", "OBSERVE", "DEFINE", "PLAN", "MAKE", "VERIFY", "LEARN"], criteriaFloor: 8, budgetSeconds: 1200 },
  advanced: {
    activePhases: ["CLASSIFY", "OBSERVE", "DEFINE", "THINK", "PLAN", "MAKE", "SYNTHESIZE", "VERIFY", "LEARN"],
    criteriaFloor: 12,
    budgetSeconds: 2400,
  },
};

export const PHASE_SPECS: Record<PhaseId, { type: PhaseType; toolGate: ToolGateLevel; slots: string[] }> = {
  CLASSIFY: { type: "code", toolGate: "read-only", slots: ["effort", "category", "skill"] },
  OBSERVE: { type: "llm", toolGate: "read-only", slots: ["wants", "implied", "response_mode"] },
  DEFINE: { type: "hybrid", toolGate: "read-only", slots: ["criteria"] },
  THINK: { type: "llm", toolGate: "read-only", slots: ["verification_plan", "effort_recalibration"] },
  PLAN: { type: "hybrid", toolGate: "read-only", slots: ["execution_steps", "criteria_coverage", "risks", "dependencies"] },
  MAKE: { type: "llm", toolGate: "full", slots: [] },
  SYNTHESIZE: { type: "llm", toolGate: "full", slots: [] },
  VERIFY: { type: "hybrid", toolGate: "verify", slots: [] },
  LEARN: { type: "hybrid", toolGate: "read-only", slots: ["reflection", "wisdom", "reusable_takeaways"] },
};

// ─── Normalization (legacy alias resolution) ────────────────────────────────
// Pure functions over the type domain. Live with the types they normalize so
// that "what is a PhaseId" and "how to coerce a value into a PhaseId" share
// one home. Avoids circular imports — capability-registry.ts and other leaf
// modules can `import { normalizePhaseId } from "./types"` without going
// through the index.ts barrel.

const LEGACY_PHASE_ALIASES: Record<string, PhaseId> = {
  BUILD: "MAKE",
  EXECUTE: "MAKE",
  COMPLETE: "LEARN",
};

const LEGACY_EFFORT_ALIASES: Record<string, EffortLevel> = {
  Instant: "minimal",
  instant: "minimal",
  Minimal: "minimal",
  MINIMAL: "minimal",
  minimal: "minimal",
  Fast: "fast",
  FAST: "fast",
  fast: "fast",
  Standard: "standard",
  STANDARD: "standard",
  standard: "standard",
  Extended: "extended",
  EXTENDED: "extended",
  extended: "extended",
  Advanced: "advanced",
  ADVANCED: "advanced",
  advanced: "advanced",
  Deep: "advanced",
  DEEP: "advanced",
  deep: "advanced",
  XHigh: "advanced",
  xhigh: "advanced",
  Comprehensive: "advanced",
  COMPREHENSIVE: "advanced",
  comprehensive: "advanced",
  compressed: "compressed",
  COMPRESSED: "compressed",
};

export function normalizePhaseId(value: string): { phase: PhaseId; legacyPhase?: LegacyPhaseId } {
  if ((CANONICAL_PHASES as readonly string[]).includes(value)) return { phase: value as PhaseId };
  const mapped = LEGACY_PHASE_ALIASES[value];
  if (!mapped) throw new Error(`unknown phase id: ${value}`);
  return { phase: mapped, legacyPhase: value as LegacyPhaseId };
}

export function normalizeEffortLevel(value: string | undefined): EffortLevel {
  if (!value) return "standard";
  const mapped = LEGACY_EFFORT_ALIASES[value];
  if (!mapped) throw new Error(`unknown effort level: ${value}`);
  return mapped;
}
