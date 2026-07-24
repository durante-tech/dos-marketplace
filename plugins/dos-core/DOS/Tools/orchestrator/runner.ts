/**
 * RFC-0001 orchestration runtime — the use-case loop.
 *
 * Extracted from index.ts per the G6 (Long-Class) refactor iter 9 (final).
 * This file is the runner's home. It owns:
 *   - request classification (effort, category)
 *   - phase-record construction + currentPhaseForRun lookup
 *   - VerificationMethod normalization
 *   - phase contract rendering for the model prompt
 *   - phase-gate evaluation + retry routing
 *   - the runOrchestration loop itself (the use case)
 *   - context compaction tiers + phaseRecordDigest
 *
 * Every other file in `orchestrator/` exists to support this loop. The loop
 * imports adapters (capability-authorization, tool-authorization, gates,
 * stores, prd-interop, extension-registry) and orchestrates them; it never
 * implements policy directly.
 */

import {
  EFFORT_DEFAULTS,
  PHASE_SPECS,
  normalizeEffortLevel,
  type Adapter,
  type AdapterInvokeResult,
  type CapabilityRegistry,
  type Criterion,
  type Diagnostic,
  type EffortLevel,
  type ExtensionRegistry,
  type GateResult,
  type GateRolloutMode,
  type LegacyPhaseId,
  type OrchestrationRun,
  type PhaseId,
  type PhaseRecord,
  type PhaseType,
  type RetryRecord,
  type Store,
  type ToolGateLevel,
  type VerificationMethod,
} from "./types";
import {
  criteriaCoverage,
  criteriaCriticalPass,
  criteriaHasAnti,
  criteriaHasTest,
  criteriaMinCountForEffort,
  slotFilled,
  type GateContext,
} from "./gates";
import { sha256, stableJson } from "./utils";
import { capabilityContractBlock } from "./capability-authorization";
import { extensionContractBlock } from "./extension-registry";
import { authorizeToolInvocation } from "./tool-authorization";
import { renderCriteriaMarkdown, renderPrdProjection } from "./prd-interop";
import { MemoryStore } from "./stores";

function classifyRequest(request: string, explicitEffort?: EffortLevel): { effort: EffortLevel; category: string; skill?: string } {
  if (explicitEffort) return { effort: explicitEffort, category: inferCategory(request) };
  const trimmed = request.trim();
  if (/^(hi|hello|thanks|thank you)[.! ]*$/i.test(trimmed)) return { effort: "minimal", category: "greeting" };
  if (/\b(deep investigation|extensive research|deep research|comprehensive research|detailed research|market research|competitive research)\b/i.test(request)) {
    return { effort: "extended", category: inferCategory(request) };
  }
  const signals = [
    /```/.test(request),
    /(?:^|\s)(?:\/|\.\/|[A-Za-z0-9_-]+\.(?:ts|tsx|js|json|md|prisma))/.test(request),
    /https?:\/\//.test(request),
    /\b(thorough|comprehensive|refactor|design|careful|full|conformance|implement|investigate|research)\b/i.test(request),
    request.length > 500,
  ].filter(Boolean).length;
  if (signals >= 3) return { effort: "extended", category: inferCategory(request) };
  if (signals >= 1) return { effort: "standard", category: inferCategory(request) };
  return { effort: "fast", category: inferCategory(request) };
}

function inferCategory(request: string): string {
  if (/\b(research|analyze|analysis|compare|review|investigate|competitive intelligence|market landscape)\b/i.test(request)) return "analysis";
  if (/\b(test|fix|code|implement|refactor|file|repo|schema|runtime|CLI)\b/i.test(request)) return "code";
  if (/\b(write|create|draft|build)\b/i.test(request)) return "creation";
  return "action";
}

function defaultPrompt(phase: PhaseId): string {
  return `RFC-0001 ${phase}: produce the required structured slots and respect the phase tool gate.`;
}

export function makePhaseRecord(args: {
  runId: string;
  phase: PhaseId;
  type: PhaseType;
  toolGate: ToolGateLevel;
  slots: Record<string, unknown>;
  output?: string;
  diagnostics?: Diagnostic[];
  retryOf?: string;
  legacyPhase?: LegacyPhaseId;
}): PhaseRecord {
  const completedAt = "1970-01-01T00:00:00.000Z";
  return {
    id: `${args.runId}:${args.phase}:${String(args.retryOf ?? "0")}`,
    phase: args.phase,
    legacyPhase: args.legacyPhase,
    type: args.type,
    toolGate: args.toolGate,
    startedAt: completedAt,
    completedAt,
    slots: args.slots,
    output: args.output,
    diagnostics: args.diagnostics ?? [],
    retryOf: args.retryOf,
  };
}

export function currentPhaseForRun(run: OrchestrationRun): PhaseId | null {
  if (run.status === "complete" || run.activePhases.length === 0) return null;
  const completed = new Set(run.phaseRecords.map((r) => r.phase));
  for (const phase of run.activePhases) {
    if (!completed.has(phase)) return phase;
  }
  return null;
}

export function normalizeVerificationMethod(input: unknown): VerificationMethod {
  const fallback: VerificationMethod = { type: "subjective", hint: "Verify against the criterion description." };
  if (input == null) return fallback;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new Error("verification must be a JSON object");
  }

  const raw = input as Record<string, unknown>;
  const type = typeof raw.type === "string" ? raw.type : typeof raw.kind === "string" ? raw.kind : "";
  const allowed = new Set(["command", "grep", "read", "subjective", "adapter", "file_exists", "text_in_file"]);
  if (!allowed.has(type)) {
    throw new Error("verification.type must be one of command, grep, read, subjective, adapter, file_exists, text_in_file");
  }

  const method: VerificationMethod = { type: type as VerificationMethod["type"] };
  if (typeof raw.command === "string") method.command = raw.command;
  if (Array.isArray(raw.args) && raw.args.every((v) => typeof v === "string")) method.args = raw.args as string[];
  if (typeof raw.expectExit === "number") method.expectExit = raw.expectExit;
  if (typeof raw.pattern === "string") method.pattern = raw.pattern;
  if (typeof raw.path === "string") method.path = raw.path;
  if (Array.isArray(raw.paths) && raw.paths.every((v) => typeof v === "string")) method.paths = raw.paths as string[];
  if (typeof raw.contains === "string") method.contains = raw.contains;
  if (typeof raw.hint === "string") method.hint = raw.hint;
  if (typeof raw.adapter === "string") method.adapter = raw.adapter;

  if (method.type === "command" && !method.command) throw new Error("verification.command is required for type=command");
  if (method.type === "grep" && (!method.path || !method.pattern)) throw new Error("verification.path and verification.pattern are required for type=grep");
  if (method.type === "read" && !method.path) throw new Error("verification.path is required for type=read");
  if (method.type === "adapter" && !method.adapter) throw new Error("verification.adapter is required for type=adapter");
  if (method.type === "file_exists" && !method.path && (!method.paths || method.paths.length === 0)) {
    throw new Error("verification.path or verification.paths is required for type=file_exists");
  }
  if (method.type === "text_in_file" && (!method.path || !method.contains)) {
    throw new Error("verification.path and verification.contains are required for type=text_in_file");
  }
  if (method.type === "subjective" && !method.hint) method.hint = fallback.hint;

  return method;
}

export function phaseContract(run: OrchestrationRun, phase: PhaseId, registry?: CapabilityRegistry, extensionRegistry?: ExtensionRegistry): string {
  const spec = PHASE_SPECS[phase];
  const criteriaLines = run.criteria.length > 0 ? renderCriteriaMarkdown(run.criteria) : "- No structured criteria defined yet.";
  const session = run.id.replace(/'/g, "'\\''");
  return [
    `RFC-0001 Runtime Contract`,
    `Run: ${run.id}`,
    `Phase: ${phase}`,
    `Effort: ${run.effort}`,
    `Tool gate: ${spec.toolGate}`,
    `Required slots: ${spec.slots.length > 0 ? spec.slots.join(", ") : "none"}`,
    capabilityContractBlock(phase, spec.toolGate, registry),
    extensionContractBlock(extensionRegistry),
    ``,
    `Runtime authority: this contract is binding for Algorithm mode.`,
    `Do not advance this phase in prose. Use the orchestrator CLI for every criteria mutation and phase transition.`,
    `Status: bun "$DOS_DIR/DOS/Tools/orchestrator/cli.ts" status --session '${session}'`,
    `Define criteria: bun "$DOS_DIR/DOS/Tools/orchestrator/cli.ts" criteria define --session '${session}' --phase DEFINE --id C1 --description '<atomic criterion>' --verification '{"type":"command","command":"pnpm typecheck","expectExit":0}'`,
    `Update criteria: bun "$DOS_DIR/DOS/Tools/orchestrator/cli.ts" criteria update --session '${session}' --phase ${phase} --id C1 --status completed --evidence '<evidence>'`,
    `Complete phase: bun "$DOS_DIR/DOS/Tools/orchestrator/cli.ts" phase complete ${phase} --session '${session}' --slots '<json>'`,
    `After completing a phase, run status again and follow the next reported currentPhase.`,
    phase === "VERIFY"
      ? `VERIFY gate permits Read, Bash verification commands, and criteria updates only. Do not spawn agents, navigate MCP browsers, edit files, or create new criteria in VERIFY.`
      : ``,
    ``,
    `Criteria:`,
    criteriaLines,
  ].join("\n");
}

function applyPhaseGates(phase: PhaseId, run: OrchestrationRun, record: PhaseRecord): GateResult[] {
  const ctx: GateContext = {
    lastPhaseRecord: record,
    criteria: run.criteria,
    effort: run.effort,
    category: run.category,
    phaseRecords: run.phaseRecords,
  };
  if (phase === "OBSERVE") return ["wants", "implied", "response_mode"].map((slot) => slotFilled(ctx, slot));
  if (phase === "DEFINE") return [criteriaMinCountForEffort(ctx), criteriaHasAnti(ctx), criteriaHasTest(ctx)];
  if (phase === "THINK") return ["verification_plan", "effort_recalibration"].map((slot) => slotFilled(ctx, slot));
  if (phase === "PLAN") return ["execution_steps", "criteria_coverage", "risks", "dependencies"].map((slot) => slotFilled(ctx, slot)).concat(criteriaCoverage(ctx));
  if (phase === "VERIFY") return [criteriaCriticalPass(ctx)];
  if (phase === "LEARN") return ["reflection", "wisdom", "reusable_takeaways"].map((slot) => slotFilled(ctx, slot));
  return [];
}

function pickRetryOrigin(run: OrchestrationRun, failedPhase: PhaseId, failures: GateResult[]): PhaseId {
  if (failedPhase !== "VERIFY") return failedPhase;
  if (failures.some((g) => g.gate === "criteria_coverage")) return "PLAN";
  if (run.activePhases.includes("SYNTHESIZE") && failures.some((g) => /synth/i.test(stableJson(g.diagnostics ?? {})))) return "SYNTHESIZE";
  return run.activePhases.includes("PLAN") && failures.some((g) => /coverage|plan/i.test(g.message)) ? "PLAN" : "MAKE";
}

function buildRetryNote(failedPhase: PhaseId, originPhase: PhaseId, failures: GateResult[], criteria: readonly Criterion[]): string {
  return [
    `Retry from ${failedPhase} to ${originPhase}.`,
    `Failed gates: ${failures.map((g) => `${g.gate}: ${g.message}`).join("; ")}`,
    `Criteria: ${criteria.map((c) => `${c.id}=${c.status}${c.evidence ? " evidence" : " no-evidence"}`).join(", ")}`,
  ].join("\n");
}

export interface RunOptions {
  runId?: string;
  effort?: EffortLevel | string;
  gateMode?: GateRolloutMode;
  maxVerifyRetries?: number;
  store?: Store;
  extensionRegistry?: ExtensionRegistry;
}

export async function runOrchestration(request: string, adapter: Adapter, opts: RunOptions = {}): Promise<OrchestrationRun> {
  const store = opts.store ?? new MemoryStore(request, opts.runId ?? "run");
  const explicitEffort = opts.effort ? normalizeEffortLevel(opts.effort) : undefined;
  const classified = classifyRequest(request, explicitEffort);
  const activePhases = EFFORT_DEFAULTS[classified.effort].activePhases;
  store.setEffort(classified.effort, classified.category, activePhases);
  if (classified.effort === "minimal") {
    store.setStatus("complete");
    return store.getRun();
  }

  let phaseIndex = 0;
  let retryNote: string | undefined;
  let retries = 0;

  while (phaseIndex < activePhases.length) {
    const phase = activePhases[phaseIndex]!;
    const spec = PHASE_SPECS[phase];
    const runBefore = store.getRun();
    for (const diagnostic of opts.extensionRegistry?.diagnostics ?? []) {
      if (!runBefore.diagnostics.some((d) => d.code === diagnostic.code && d.message === diagnostic.message)) {
        store.appendDiagnostic(diagnostic);
      }
    }
    let result: AdapterInvokeResult;
    if (phase === "CLASSIFY") {
      result = { slots: { effort: classified.effort, category: classified.category, skill: classified.skill ?? null } };
    } else {
      result = await adapter.invokeModel({
        runId: runBefore.id,
        request,
        phase,
        effort: runBefore.effort,
        systemPrompt: defaultPrompt(phase),
        toolGate: spec.toolGate,
        criteria: runBefore.criteria,
        priorRecords: runBefore.phaseRecords,
        retryNote,
      });
    }

    if (result.criteria) store.setCriteria(result.criteria);
    if (result.criteriaUpdates) store.updateCriteria(result.criteriaUpdates, phase);

    const tools = new Map((await adapter.listTools()).map((t) => [t.id, t]));
    const diagnostics = [...(result.diagnostics ?? [])];
    for (const tr of result.toolRequests ?? []) {
      const tool = tools.get(tr.toolId) ?? { id: tr.toolId };
      let decision = authorizeToolInvocation({ phase, gate: spec.toolGate, tool, mode: opts.gateMode ?? "shadow" });
      if (adapter.authorizeTool) decision = await adapter.authorizeTool(decision);
      if (decision.diagnostic) {
        diagnostics.push(decision.diagnostic);
        await adapter.emitDiagnostic?.(decision.diagnostic);
      }
      if (!decision.allowed) {
        store.appendDiagnostic(decision.diagnostic ?? { code: "tool_gate_block", severity: "error", phase, message: decision.reason });
      }
    }

    const record = makePhaseRecord({
      runId: runBefore.id,
      phase,
      type: spec.type,
      toolGate: spec.toolGate,
      slots: result.slots ?? {},
      output: result.output,
      diagnostics,
      retryOf: retryNote ? String(retries) : undefined,
    });
    store.appendPhaseRecord(record);
    await adapter.persistEvent?.({ type: "phase_record", payload: record });

    const gateRun = store.getRun();
    const gates = applyPhaseGates(phase, gateRun, record);
    const failed = gates.filter((g) => !g.pass);
    if (failed.length > 0 && phase === "VERIFY" && retries < (opts.maxVerifyRetries ?? 1)) {
      const originPhase = pickRetryOrigin(gateRun, phase, failed);
      const note = buildRetryNote(phase, originPhase, failed, gateRun.criteria);
      const retryRecord: RetryRecord = {
        id: `${gateRun.id}:retry:${retries + 1}`,
        failedPhase: phase,
        originPhase,
        gateResults: failed,
        note,
        createdAt: "1970-01-01T00:00:00.000Z",
      };
      store.appendRetry(retryRecord);
      retryNote = note;
      retries += 1;
      phaseIndex = activePhases.indexOf(originPhase);
      continue;
    }
    if (failed.length > 0) {
      for (const gate of failed) {
        store.appendDiagnostic({ code: `gate_failed:${gate.gate}`, severity: "error", phase, message: gate.message, details: gate.diagnostics });
      }
      store.setStatus("failed");
      return store.getRun();
    }

    if (phase === "PLAN" && (gateRun.effort === "extended" || gateRun.effort === "advanced")) {
      const approval = await adapter.requestApproval?.({
        runId: gateRun.id,
        phase,
        plan: record.slots,
        criteria: gateRun.criteria,
      });
      if (approval === "modify") {
        retryNote = "User requested PLAN modifications before MAKE.";
        phaseIndex = activePhases.indexOf("PLAN");
        continue;
      }
      if (approval === "abort" || approval === undefined) {
        store.setStatus(approval === "abort" ? "aborted" : "paused");
        return store.getRun();
      }
    }

    retryNote = undefined;
    phaseIndex += 1;
  }

  store.setStatus("complete");
  const completed = store.getRun();
  return { ...completed, prdMarkdown: renderPrdProjection(request, completed.effort, completed.criteria, completed.phaseRecords) };
}

export interface ContextSnapshot {
  currentPrompt: string;
  currentCriteria: readonly Criterion[];
  mostRecentPhaseRecord?: PhaseRecord;
  pendingRetryNotes: readonly RetryRecord[];
  compactedToolResults: unknown[];
  utilization: number;
}

export function compactContextTier1(args: {
  currentPrompt: string;
  criteria: readonly Criterion[];
  phaseRecords: readonly PhaseRecord[];
  retryRecords: readonly RetryRecord[];
  toolResults: unknown[];
  keepRecentToolResults?: number;
}): ContextSnapshot {
  const keep = args.keepRecentToolResults ?? 5;
  return {
    currentPrompt: args.currentPrompt,
    currentCriteria: args.criteria,
    mostRecentPhaseRecord: args.phaseRecords.at(-1),
    pendingRetryNotes: args.retryRecords,
    compactedToolResults: args.toolResults.slice(-keep),
    utilization: 0,
  };
}

export function compactContextTier2(snapshot: ContextSnapshot, utilization: number, threshold = 0.85): ContextSnapshot {
  return utilization >= threshold ? { ...snapshot, utilization, compactedToolResults: snapshot.compactedToolResults.slice(-2) } : { ...snapshot, utilization };
}

export async function phaseRecordDigest(run: OrchestrationRun): Promise<string> {
  return sha256(stableJson(run.phaseRecords.map((r) => ({ phase: r.phase, slots: r.slots, output: r.output, retryOf: r.retryOf }))));
}
