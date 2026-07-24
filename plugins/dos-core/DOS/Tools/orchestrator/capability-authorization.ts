/**
 * RFC-0001 orchestration runtime — capability authorization + contracts.
 *
 * Extracted from index.ts per the G6 (Long-Class) refactor iter 4. Owns:
 *   - gate-level capability admission (capabilityAllowedByGate, private)
 *   - per-invocation authorization with shadow/block modes
 *   - rendering the human-readable capability contract block for prompts
 *
 * Sister module to capability-registry.ts: this file ANSWERS "is invocation
 * X allowed at phase Y under gate Z?" while capability-registry.ts answers
 * "what capabilities does this surface have?". Separation by who-asks-what.
 */

import {
  CAPABILITY_FLAGS,
  type CapabilityDecision,
  type CapabilityFlag,
  type CapabilityRegistry,
  type CapabilityRegistryEntry,
  type GateRolloutMode,
  type PhaseId,
  type ToolGateLevel,
} from "./types";
import {
  ALWAYS_BLOCKED_CAPABILITIES,
  READ_ONLY_CAPABILITIES,
  VERIFY_CAPABILITIES,
} from "./capability-registry";

function capabilityAllowedByGate(flag: CapabilityFlag, phase: PhaseId, gate: ToolGateLevel): boolean {
  if (ALWAYS_BLOCKED_CAPABILITIES.has(flag)) return false;
  if (gate === "read-only") {
    if (flag === "criteria.define" || flag === "criteria.update") return phase === "DEFINE";
    return READ_ONLY_CAPABILITIES.has(flag);
  }
  if (gate === "verify") return VERIFY_CAPABILITIES.has(flag);
  if (flag === "criteria.define") return phase === "DEFINE";
  return true;
}

export function authorizeCapabilityInvocation(args: {
  phase: PhaseId;
  gate: ToolGateLevel;
  surfaceId: string;
  entry?: CapabilityRegistryEntry;
  mode?: GateRolloutMode;
}): CapabilityDecision {
  const mode = args.mode ?? "shadow";
  if (!args.entry) {
    const reason = `capability surface '${args.surfaceId}' missing from registry`;
    const allowed = mode === "shadow";
    return {
      surfaceId: args.surfaceId,
      capabilities: [],
      allowed,
      mode,
      reason,
      diagnostic: {
        code: mode === "shadow" ? "capability_registry_missing_shadow" : "capability_registry_missing",
        severity: mode === "shadow" ? "warn" : "error",
        phase: args.phase,
        message: reason,
        details: { surfaceId: args.surfaceId, gate: args.gate },
      },
    };
  }
  const phaseUse = args.entry.phaseUse?.[args.phase];
  const blockedByPhase = phaseUse === "blocked";
  const blockedCapabilities = args.entry.capabilities.filter((flag) => !capabilityAllowedByGate(flag, args.phase, args.gate));
  const allowed = !blockedByPhase && blockedCapabilities.length === 0;
  const effectiveAllowed = allowed || mode === "shadow";
  const reason = allowed
    ? `capability surface '${args.surfaceId}' allowed by ${args.gate} gate`
    : blockedByPhase
      ? `capability surface '${args.surfaceId}' is blocked in ${args.phase}`
      : `capability surface '${args.surfaceId}' violates ${args.gate} gate in ${args.phase}: ${blockedCapabilities.join(", ")}`;
  return {
    surfaceId: args.surfaceId,
    capabilities: args.entry.capabilities,
    allowed: effectiveAllowed,
    mode,
    reason,
    diagnostic: allowed
      ? undefined
      : {
          code: mode === "shadow" ? "capability_gate_shadow_violation" : "capability_gate_block",
          severity: mode === "shadow" ? "warn" : "error",
          phase: args.phase,
          message: reason,
          details: { surfaceId: args.surfaceId, capabilities: args.entry.capabilities, gate: args.gate },
        },
  };
}

function capabilityFlagsForGate(phase: PhaseId, gate: ToolGateLevel): CapabilityFlag[] {
  return CAPABILITY_FLAGS.filter((flag) => capabilityAllowedByGate(flag, phase, gate));
}

export function capabilityContractBlock(phase: PhaseId, gate: ToolGateLevel, registry?: CapabilityRegistry): string {
  const allowedFlags = capabilityFlagsForGate(phase, gate);
  const byExplicitSource = (a: CapabilityRegistryEntry, b: CapabilityRegistryEntry) => {
    const score = (entry: CapabilityRegistryEntry) => (entry.source === "sidecar" ? 0 : entry.source === "built-in" ? 1 : 2);
    return score(a) - score(b) || a.id.localeCompare(b.id);
  };
  const allowedSurfaces = (registry?.entries ?? [])
    .filter((entry) => authorizeCapabilityInvocation({ phase, gate, surfaceId: entry.id, entry, mode: "block" }).allowed)
    .sort(byExplicitSource)
    .map((entry) => entry.id)
    .slice(0, 8);
  const blockedSurfaces = (registry?.entries ?? [])
    .filter((entry) => !authorizeCapabilityInvocation({ phase, gate, surfaceId: entry.id, entry, mode: "block" }).allowed)
    .filter((entry) => entry.source === "sidecar")
    .sort(byExplicitSource)
    .map((entry) => `${entry.id} (${entry.capabilities.join(", ") || "none"})`)
    .slice(0, 8);
  return [
    `Allowed capabilities this phase: ${allowedFlags.join(", ") || "none"}`,
    allowedSurfaces.length > 0 ? `Allowed registered surfaces: ${allowedSurfaces.join(", ")}` : `Allowed registered surfaces: registry unavailable or no explicit matches`,
    blockedSurfaces.length > 0 ? `Blocked registered surfaces: ${blockedSurfaces.join("; ")}` : `Blocked registered surfaces: none listed`,
  ].join("\n");
}
