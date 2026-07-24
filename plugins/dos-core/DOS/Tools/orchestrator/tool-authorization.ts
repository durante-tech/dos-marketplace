/**
 * RFC-0001 orchestration runtime — tool invocation authorization.
 *
 * Extracted from index.ts per the G6 (Long-Class) refactor iter 5. Owns:
 *   - per-tool gate authorization (read-only / verify / full gate enforcement)
 *   - delegation to capability authorization for tools that declare capabilities
 *   - shadow vs block mode handling for staged gate rollout
 *
 * Sister to capability-authorization.ts: capabilities authorize the registry-
 * declared surfaces, this module authorizes the harness-registered tools.
 * Both delegate gate semantics through authorizeCapabilityInvocation when a
 * tool declares its capabilities.
 */

import {
  type CapabilityRegistryEntry,
  type GateRolloutMode,
  type PhaseId,
  type RegisteredTool,
  type ToolDecision,
  type ToolGateLevel,
} from "./types";
import { authorizeCapabilityInvocation } from "./capability-authorization";

export function authorizeToolInvocation(args: {
  phase: PhaseId;
  gate: ToolGateLevel;
  tool: RegisteredTool;
  mode?: GateRolloutMode;
}): ToolDecision {
  const mode = args.mode ?? "shadow";
  if (args.tool.capabilityMissing || args.tool.capabilities) {
    const surfaceId = args.tool.surfaceId ?? args.tool.id;
    const entry: CapabilityRegistryEntry | undefined = args.tool.capabilities
      ? {
          id: surfaceId,
          surface: "tool",
          capabilities: args.tool.capabilities,
          source: args.tool.capabilitySource === "sidecar" ? "sidecar" : args.tool.capabilitySource === "built-in" ? "built-in" : "generated",
        }
      : undefined;
    const decision = authorizeCapabilityInvocation({
      phase: args.phase,
      gate: args.gate,
      surfaceId,
      entry,
      mode,
    });
    return {
      toolId: surfaceId,
      allowed: decision.allowed,
      mode,
      reason: decision.reason,
      diagnostic: decision.diagnostic,
    };
  }

  const kind = args.tool.kind;
  const readOnly = args.tool.readOnly === true || kind === "read";
  const phaseSpecific = args.tool.phaseTools?.includes(args.phase) === true;
  const criteriaDefine = kind === "criteria_define";
  const criteriaUpdate = kind === "criteria_update";
  const statusUpdate = kind === "status_update";
  let allowed = false;

  if (args.gate === "read-only") {
    allowed = readOnly || (statusUpdate && phaseSpecific) || (args.phase === "DEFINE" && (criteriaDefine || criteriaUpdate));
  } else if (args.gate === "verify") {
    allowed = readOnly || kind === "shell" || kind === "verification" || criteriaUpdate || (statusUpdate && phaseSpecific);
  } else {
    allowed = args.phase === "DEFINE" || !criteriaDefine;
  }

  const effectiveAllowed = allowed || mode === "shadow";
  const reason = allowed
    ? `tool '${args.tool.id}' allowed by ${args.gate} gate`
    : `tool '${args.tool.id}' violates ${args.gate} gate in ${args.phase}`;
  return {
    toolId: args.tool.id,
    allowed: effectiveAllowed,
    mode,
    reason,
    diagnostic: allowed
      ? undefined
      : {
          code: mode === "shadow" ? "tool_gate_shadow_violation" : "tool_gate_block",
          severity: mode === "shadow" ? "warn" : "error",
          phase: args.phase,
          message: reason,
          details: { tool: args.tool, gate: args.gate },
        },
  };
}
