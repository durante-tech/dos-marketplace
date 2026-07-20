#!/usr/bin/env bun
/**
 * OrchestratorGate.hook.ts — RFC-0001 PreToolUse gate.
 *
 * Default mode is shadow: diagnostics are persisted and tool calls continue.
 * Set DOS_ORCH_GATE_MODE=block to return Claude hook block decisions.
 * Set DOS_ORCH_ENABLED=0 to disable entirely.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  FileStore,
  PHASE_SPECS,
  authorizeToolInvocation,
  currentPhaseForRun,
  findCapabilityEntry,
  loadCapabilityRegistry,
  type CapabilityRegistry,
  type CapabilityFlag,
  type GateRolloutMode,
  type PhaseId,
  type RegisteredTool,
  normalizePhaseId,
} from "../DOS/Tools/orchestrator/index";
import { startTimer, stopTimer } from "./lib/hook-io";
import { traceOrchestrator } from "./lib/orchestrator-trace";
import { loadProjectEnv } from "./lib/paths";

loadProjectEnv();

const DOS_DIR = process.env.DOS_DIR || join(homedir(), ".claude");
const STATE_DIR = process.env.DOS_ORCH_STATE_DIR || join(DOS_DIR, "MEMORY", "STATE", "orchestrator");
const ENABLED = process.env.DOS_ORCH_ENABLED !== "0";

interface HookInput {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

async function readInput(): Promise<HookInput | null> {
  try {
    const raw = await Promise.race([
      Bun.stdin.text(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 500)),
    ]);
    return raw.trim() ? (JSON.parse(raw) as HookInput) : null;
  } catch {
    return null;
  }
}

function commandText(input?: Record<string, unknown>): string {
  const command = input?.command;
  return typeof command === "string" ? command : "";
}

function parsePhaseToken(value: string | undefined, fallback: PhaseId): PhaseId {
  if (!value) return fallback;
  try {
    return normalizePhaseId(value).phase;
  } catch {
    return fallback;
  }
}

function orchestratorCliMetadata(command: string, phase: PhaseId): RegisteredTool | null {
  if (!/\bDOS\/Tools\/orchestrator\/cli\.ts\b/.test(command)) return null;
  const phaseComplete = command.match(/\bphase\s+complete\s+([A-Za-z_ -]+)/);
  if (phaseComplete) {
    return {
      id: "orchestrator.phase.complete",
      kind: "status_update",
      phaseTools: [parsePhaseToken(phaseComplete[1]?.trim().split(/\s+/)[0], phase)],
    };
  }
  if (/\bcriteria\s+define\b/.test(command)) {
    const explicitPhase = command.match(/--phase\s+['"]?([A-Za-z_ -]+)/);
    return {
      id: "orchestrator.criteria.define",
      kind: "criteria_define",
      phaseTools: [parsePhaseToken(explicitPhase?.[1]?.trim().split(/\s+/)[0], "DEFINE")],
    };
  }
  if (/\bcriteria\s+update\b/.test(command)) {
    const explicitPhase = command.match(/--phase\s+['"]?([A-Za-z_ -]+)/);
    return {
      id: "orchestrator.criteria.update",
      kind: "criteria_update",
      phaseTools: [parsePhaseToken(explicitPhase?.[1]?.trim().split(/\s+/)[0], phase)],
    };
  }
  if (/\b(retry\s+note|complete|start)\b/.test(command)) {
    return { id: "orchestrator.status", kind: "status_update", phaseTools: [phase] };
  }
  if (/\b(status|contract|prd\s+render)\b/.test(command)) {
    return { id: "orchestrator.read", readOnly: true, kind: "read" };
  }
  return { id: "orchestrator.cli", kind: "shell" };
}

const READ_ONLY_COMMANDS = new Set([
  "awk",
  "basename",
  "cat",
  "date",
  "dirname",
  "du",
  "echo",
  "file",
  "find",
  "git",
  "grep",
  "head",
  "jq",
  "ls",
  "md5",
  "nl",
  "printf",
  "pwd",
  "rg",
  "sed",
  "shasum",
  "sort",
  "stat",
  "tail",
  "test",
  "tree",
  "tr",
  "uniq",
  "wc",
  "which",
]);

const READ_ONLY_GIT_SUBCOMMANDS = new Set([
  "branch",
  "diff",
  "grep",
  "log",
  "ls-files",
  "rev-parse",
  "show",
  "show-ref",
  "status",
  "tag",
]);

function shellWords(segment: string): string[] {
  return segment.match(/"[^"]*"|'[^']*'|\S+/g)?.map((word) => word.replace(/^['"]|['"]$/g, "")) ?? [];
}

function hasShellWriteSyntax(command: string): boolean {
  return /(^|[^\\])(?:>>?|<<)/.test(command) || /\b(?:tee|chmod|chown|rm|rmdir|mv|cp|mkdir|touch|install|ln|truncate|patch|apply_patch)\b/.test(command);
}

function isSafeCurl(words: string[]): boolean {
  const joined = words.join(" ");
  // `\b` before a `-` flag never matches after a space (space→hyphen is non-word
  // to non-word, no boundary), so these mutation/write checks were DEAD for a normal
  // `curl -X POST ... -d ...` — a mutating curl passed as read-only through the write
  // gate. Anchor on start-or-whitespace instead. (Forge Gen 32; verified.)
  if (/(?:^|\s)(?:-X|--request)\s*(?:POST|PUT|PATCH|DELETE)\b/i.test(joined)) return false;
  if (/(?:^|\s)(?:-d|--data|--data-raw|--data-binary|-F|--form|-T|--upload-file|-o|-O|--output|--remote-name)\b/.test(joined)) return false;
  return words.some((word) => /^https?:\/\//.test(word));
}

function isReadOnlyShellSegment(segment: string): boolean {
  const words = shellWords(segment);
  while (/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(words[0] ?? "")) words.shift();
  while (["command", "builtin", "time"].includes(words[0] ?? "")) words.shift();
  const command = words[0] ?? "";
  if (!command) return true;
  if (command === "cd") return true;
  if (command === "[") return true;
  if (!READ_ONLY_COMMANDS.has(command) && command !== "curl") return false;
  if (["sed", "awk"].includes(command) && words.some((word) => word === "-i" || word.startsWith("-i."))) return false;
  if (command === "find" && words.some((word) => word === "-delete" || word === "-exec" || word === "-execdir")) return false;
  if (command === "git") {
    const subcommand = words.find((word, index) => index > 0 && !word.startsWith("-"));
    return Boolean(subcommand && READ_ONLY_GIT_SUBCOMMANDS.has(subcommand));
  }
  if (command === "curl") return isSafeCurl(words);
  return true;
}

function readOnlyBashCapabilities(command: string): CapabilityFlag[] | null {
  const trimmed = command.trim();
  if (!trimmed || hasShellWriteSyntax(trimmed)) return null;
  if (/\b(?:npm|pnpm|bun|npx|node|python|python3|ruby|perl|tsx|ts-node)\b/.test(trimmed)) return null;
  const segments = trimmed
    .split(/&&|\|\||[|;]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0 || !segments.every(isReadOnlyShellSegment)) return null;
  const capabilities = new Set<CapabilityFlag>(["shell.read"]);
  if (/\bcurl\b/.test(trimmed)) capabilities.add("web.read");
  if (/\b(cat|find|grep|head|ls|nl|rg|sed|stat|tail|tree|wc)\b/.test(trimmed)) capabilities.add("fs.read");
  return [...capabilities].sort();
}

function stringField(input: Record<string, unknown> | undefined, keys: string[]): string {
  for (const key of keys) {
    const value = input?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const args = input?.args;
  if (args && typeof args === "object" && !Array.isArray(args)) {
    for (const key of keys) {
      const value = (args as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
}

function workflowName(input: Record<string, unknown> | undefined): string {
  const explicit = stringField(input, ["workflow", "technicalName", "workflow_name"]);
  const workflowMap: Record<string, string> = {
    quickresearch: "QuickResearch",
    "quick research": "QuickResearch",
    claude: "ClaudeResearch",
    clauderesearch: "ClaudeResearch",
    "claude research": "ClaudeResearch",
    standard: "StandardResearch",
    standardresearch: "StandardResearch",
    "standard research": "StandardResearch",
    extensive: "ExtensiveResearch",
    extensiveresearch: "ExtensiveResearch",
    "extensive research": "ExtensiveResearch",
    deep: "ExtensiveResearch",
    "deep research": "ExtensiveResearch",
    deepinvestigation: "DeepInvestigation",
    "deep investigation": "DeepInvestigation",
    "investigation vault": "DeepInvestigation",
  };
  if (explicit) return workflowMap[explicit.toLowerCase()] ?? explicit.replace(/\s+/g, "");
  const mode = stringField(input, ["mode", "depth"]).toLowerCase();
  const modeMap: Record<string, string> = {
    quick: "QuickResearch",
    minor: "QuickResearch",
    claude: "ClaudeResearch",
    standard: "StandardResearch",
    default: "StandardResearch",
    extensive: "ExtensiveResearch",
    deep: "ExtensiveResearch",
    investigation: "DeepInvestigation",
  };
  if (modeMap[mode]) return modeMap[mode];
  const haystack = JSON.stringify(input ?? {});
  const match = haystack.match(/\b(QuickResearch|ClaudeResearch|StandardResearch|ExtensiveResearch|DeepInvestigation)\b/);
  if (match?.[1]) return match[1];
  if (/quick research/i.test(haystack)) return "QuickResearch";
  if (/claude research/i.test(haystack)) return "ClaudeResearch";
  if (/standard research/i.test(haystack)) return "StandardResearch";
  if (/deep investigation|investigation vault/i.test(haystack)) return "DeepInvestigation";
  if (/deep research|extensive research/i.test(haystack)) return "ExtensiveResearch";
  return "";
}

function registeredSurfaceMetadata(registry: CapabilityRegistry, surfaceId: string, fallbackId: string, missingKind: RegisteredTool["kind"] = "write"): RegisteredTool {
  const entry = findCapabilityEntry(registry, surfaceId);
  if (entry) {
    return {
      id: fallbackId,
      surfaceId,
      capabilities: entry.capabilities,
      capabilitySource: entry.source,
    };
  }
  return { id: fallbackId, surfaceId, capabilityMissing: true, kind: missingKind };
}

function skillSurfaceId(input: Record<string, unknown> | undefined): string {
  const skill = stringField(input, ["skill", "name", "skill_name", "skillName"]) || "unknown";
  const workflow = workflowName(input);
  return workflow ? `skill:${skill}/workflow:${workflow}` : `skill:${skill}`;
}

function taskSurfaceId(input: Record<string, unknown> | undefined): string {
  const agent = stringField(input, ["subagent_type", "agent", "agent_name", "name"]);
  return agent ? `agent:${agent}` : "";
}

function toolMetadata(toolName: string, input: Record<string, unknown> | undefined, phase: PhaseId, registry: CapabilityRegistry): RegisteredTool {
  if (["Read", "Grep", "Glob", "LS", "NotebookRead", "WebFetch", "WebSearch"].includes(toolName)) {
    return { id: toolName, readOnly: true, kind: "read" };
  }
  if (toolName === "Bash") {
    const command = commandText(input);
    const cliMetadata = orchestratorCliMetadata(command, phase);
    if (cliMetadata) return cliMetadata;
    const capabilities = readOnlyBashCapabilities(command);
    if (capabilities) return { id: toolName, surfaceId: "tool:Bash/read-only", capabilities, capabilitySource: "built-in", readOnly: true, kind: "read" };
    return { id: toolName, kind: "shell" };
  }
  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(toolName)) {
    return { id: toolName, kind: "write" };
  }
  if (toolName === "Task") {
    const surfaceId = taskSurfaceId(input);
    return surfaceId ? registeredSurfaceMetadata(registry, surfaceId, toolName) : { id: toolName, kind: "write" };
  }
  if (toolName === "Skill") return registeredSurfaceMetadata(registry, skillSurfaceId(input), toolName);
  if (/^mcp__/.test(toolName)) {
    const surfaceId = `mcp:${toolName}`;
    const entry = findCapabilityEntry(registry, surfaceId);
    if (entry) return { id: toolName, surfaceId, capabilities: entry.capabilities, capabilitySource: entry.source };
    const writeish = /(write|edit|move|create|delete|merge|push|apply|reset|seed|update|execute|navigate|screenshot)/i.test(toolName);
    return { id: toolName, kind: writeish ? "write" : "read", readOnly: !writeish };
  }
  return { id: toolName };
}

async function main(): Promise<void> {
  traceOrchestrator({ hook: "gate", event: "start", details: { state_dir: STATE_DIR } });
  if (!ENABLED) {
    traceOrchestrator({ hook: "gate", event: "env-disabled", details: { state_dir: STATE_DIR } });
    process.exit(0);
  }
  const input = await readInput();
  if (!input?.session_id || !input.tool_name) {
    traceOrchestrator({
      hook: "gate",
      event: "invalid-input",
      session_id: input?.session_id,
      tool_name: input?.tool_name,
    });
    process.exit(0);
  }

  const statePath = join(STATE_DIR, `${input.session_id}.json`);
  if (!existsSync(statePath)) {
    traceOrchestrator({
      hook: "gate",
      event: "no-state",
      session_id: input.session_id,
      tool_name: input.tool_name,
      state_path: statePath,
    });
    process.exit(0);
  }

  const store = new FileStore("", input.session_id, STATE_DIR);
  const run = store.getRun();
  const phase = currentPhaseForRun(run);
  if (!phase) {
    traceOrchestrator({
      hook: "gate",
      event: "no-active-phase",
      session_id: input.session_id,
      tool_name: input.tool_name,
      state_path: store.path,
    });
    process.exit(0);
  }

  const mode: GateRolloutMode = process.env.DOS_ORCH_GATE_MODE === "block" ? "block" : "shadow";
  const capabilityRegistry = loadCapabilityRegistry(DOS_DIR, STATE_DIR);
  const metadata = toolMetadata(input.tool_name, input.tool_input, phase, capabilityRegistry);
  const decision = authorizeToolInvocation({
    phase,
    gate: PHASE_SPECS[phase].toolGate,
    tool: metadata,
    mode,
  });
  traceOrchestrator({
    hook: "gate",
    event: "decision",
    session_id: input.session_id,
    phase,
    mode,
    tool_name: input.tool_name,
    state_path: store.path,
    reason: decision.reason,
    details: {
      allowed: decision.allowed,
      diagnostic: Boolean(decision.diagnostic),
      surface_id: metadata.surfaceId,
      capabilities: metadata.capabilities,
      registry_source: metadata.capabilitySource,
      capability_missing: Boolean(metadata.capabilityMissing),
      registry_hash: capabilityRegistry.hash,
      tool_input_keys: Object.keys(input.tool_input || {}),
    },
  });

  if (decision.diagnostic) {
    store.appendDiagnostic(decision.diagnostic);
    console.error(`[OrchestratorGate] ${decision.reason} (${mode})`);
  }

  if (!decision.allowed) {
    console.log(JSON.stringify({ decision: "block", reason: decision.reason }));
    process.exit(0);
  }

  console.log(JSON.stringify({ continue: true }));
}

const _t = startTimer("OrchestratorGate");
process.on("exit", () => stopTimer(_t, "PreToolUse"));
main().catch((error) => {
  traceOrchestrator({
    hook: "gate",
    event: "error",
    reason: error instanceof Error ? error.message : String(error),
  });
  console.error(`[OrchestratorGate] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(0);
});
