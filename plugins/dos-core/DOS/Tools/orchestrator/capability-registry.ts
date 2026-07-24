/**
 * RFC-0001 orchestration runtime — capability registry building + loading.
 *
 * Extracted from index.ts per the G6 (Long-Class) refactor iter 3. Owns:
 *   - filesystem walking (walkFiles)
 *   - capability inference from skill/workflow/partial/agent content
 *   - sidecar JSON merging
 *   - registry building, hashing, persistence, lookup
 *
 * Authorization (`authorizeCapabilityInvocation`, `capabilityContractBlock`,
 * etc.) lives in a sibling module — separation by who-asks-what:
 *   - this file answers "what capabilities does this surface have?"
 *   - sibling answers "is invocation X allowed at phase Y under gate Z?"
 *
 * Replaced the local `canonicalize` helper with `stableJson` from utils.ts —
 * they were structurally identical (G5 cleanup folded into G6 cut).
 */

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join, relative } from "node:path";

import {
  CAPABILITY_FLAGS,
  normalizePhaseId,
  type CapabilityFlag,
  type CapabilityPhaseUse,
  type CapabilityRegistry,
  type CapabilityRegistryEntry,
  type CapabilitySurface,
  type Diagnostic,
  type PhaseId,
} from "./types";
import { stableJson } from "./utils";

const READ_ONLY_CAPABILITIES = new Set<CapabilityFlag>([
  "fs.read",
  "shell.read",
  "web.read",
  "mcp.read",
  "memory.read",
  "phase.status",
  "format.only",
]);

const VERIFY_CAPABILITIES = new Set<CapabilityFlag>([
  ...READ_ONLY_CAPABILITIES,
  "criteria.update",
]);

const ALWAYS_BLOCKED_CAPABILITIES = new Set<CapabilityFlag>(["voice.emit"]);

export { READ_ONLY_CAPABILITIES, VERIFY_CAPABILITIES, ALWAYS_BLOCKED_CAPABILITIES };

function uniqueCapabilities(values: unknown[]): CapabilityFlag[] {
  const allowed = new Set<string>(CAPABILITY_FLAGS);
  return [...new Set(values.filter((v): v is CapabilityFlag => typeof v === "string" && allowed.has(v)).sort())];
}

function registryHash(registry: Omit<CapabilityRegistry, "hash">): string {
  return `sha256:${createHash("sha256").update(stableJson(registry), "utf8").digest("hex")}`;
}

function safeReadJson(path: string): Record<string, unknown> | null {
  try {
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function walkFiles(root: string, predicate: (path: string) => boolean): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const skip = new Set(["node_modules", ".git", ".next", "dist", "build"]);
  function walk(dir: string): void {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (skip.has(name)) continue;
      const full = join(dir, name);
      let stat: ReturnType<typeof lstatSync>;
      try {
        stat = lstatSync(full);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(full);
      else if (stat.isFile() && predicate(full)) out.push(full);
    }
  }
  walk(root);
  return out.sort();
}

export { walkFiles };

function frontmatterName(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const name = match[1]?.match(/^name:\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim();
  return name || null;
}

/**
 * USE-WHEN trigger corpus = the frontmatter `description` field (which carries the
 * "USE WHEN ..." clause for DOS skills). RFC-0134 slice 0b. Single-line descriptions
 * are the common case; a folded/multi-line description yields its first line — a known
 * v1 limitation tracked by the C4 surfaced-but-not-selected list for targeted repair.
 */
function frontmatterDescription(content: string): string | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const desc = match[1]?.match(/^description:\s*"?(.+?)"?\s*$/m)?.[1]?.trim();
  return desc || null;
}

/** Token count proxy for the scorer's breadth penalty: alphanumeric words of length ≥2. */
function countTriggerTokens(text: string): number {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2).length;
}

function inferCapabilities(content: string, surface: CapabilitySurface): CapabilityFlag[] {
  const caps: CapabilityFlag[] = [];
  const add = (flag: CapabilityFlag) => caps.push(flag);
  if (surface === "partial" && !/(Write|Edit|Task\(|Skill\(|curl|notify|MEMORY\/|mcp__|Bash|bun |python|node )/i.test(content)) add("format.only");
  if (/(Read|Grep|Glob|LS|NotebookRead|readFileSync|cat |rg )/i.test(content)) add("fs.read");
  if (/(Write|Edit|MultiEdit|NotebookEdit|writeFileSync|appendFileSync|mkdir|rename|rm |cp )/i.test(content)) add("fs.write");
  if (/(Bash|bun |python|node |curl |npx |pnpm |npm )/i.test(content)) add("shell.read");
  if (/(writeFileSync|appendFileSync|mkdir|rename|rm |mv |cp |apply_migrations|db_seed|db_reset)/i.test(content)) add("shell.write");
  if (/(WebFetch|WebSearch|https?:\/\/|Perplexity|BraveSearch|Firecrawl|BrightData|Apify|SearchPerspectives)/i.test(content)) add("web.read");
  if (/mcp__/i.test(content)) add(/(write|edit|move|create|delete|merge|push|apply|reset|seed|update|execute|navigate|screenshot)/i.test(content) ? "mcp.write" : "mcp.read");
  if (/(MEMORY\/|mempalace_bridge\.py|kg_query|current-work\.json)/i.test(content)) add("memory.read");
  if (/(MEMORY\/.*(write|append|jsonl)|add_observations|create_entities|Save.*ToStudio|artifacts\.jsonl)/i.test(content)) add("memory.write");
  if (/(criteria define|TaskCreate|ISC|IDEAL STATE CRITERIA)/i.test(content)) add("criteria.define");
  if (/(criteria update|TaskUpdate|completed|evidence)/i.test(content)) add("criteria.update");
  if (/(phase complete|orchestrator\/cli\.ts|status --session)/i.test(content)) add("phase.status");
  if (/(Task\(|subagent_type|Agent\(|spawn)/i.test(content)) add("agent.spawn");
  if (/(artifact|draft|PRD\.md|Write the candidate|output files|MEMORY\/ARTIFACTS|MEMORY\/RESEARCH)/i.test(content)) add("artifact.write");
  if (/(approval|ApproveDraft|AskUserQuestion|requires explicit)/i.test(content)) add("approval.request");
  if (/(localhost:8888\/notify|voice\.sh|voice curl|Voice Notification|notify)/i.test(content)) add("voice.emit");
  return uniqueCapabilities(caps);
}

function normalizePhaseUse(raw: unknown): Partial<Record<PhaseId, CapabilityPhaseUse>> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const out: Partial<Record<PhaseId, CapabilityPhaseUse>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    let phase: PhaseId;
    try {
      phase = normalizePhaseId(key).phase;
    } catch {
      continue;
    }
    if (value === "allowed" || value === "allowed-with-evidence-only" || value === "blocked") out[phase] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function mergeCapabilitySidecar(entry: CapabilityRegistryEntry, sidecarPath: string): CapabilityRegistryEntry {
  const sidecar = safeReadJson(sidecarPath);
  if (!sidecar) return entry;
  return {
    ...entry,
    id: typeof sidecar.id === "string" ? sidecar.id : entry.id,
    surface: typeof sidecar.surface === "string" ? (sidecar.surface as CapabilitySurface) : entry.surface,
    capabilities: Array.isArray(sidecar.capabilities) ? uniqueCapabilities(sidecar.capabilities) : entry.capabilities,
    phaseUse: normalizePhaseUse(sidecar.phaseUse) ?? entry.phaseUse,
    source: "sidecar",
    confidence: "explicit",
  };
}

function makeCapabilityEntry(args: {
  id: string;
  surface: CapabilitySurface;
  path: string;
  root: string;
  content: string;
  sidecarPath: string;
}): CapabilityRegistryEntry {
  const entry: CapabilityRegistryEntry = {
    id: args.id,
    surface: args.surface,
    path: relative(args.root, args.path),
    capabilities: inferCapabilities(args.content, args.surface),
    source: "generated",
    confidence: "inferred",
  };
  // RFC-0134 slice 0b: project the USE-WHEN trigger corpus (optional — entries
  // without a frontmatter description keep the pre-projection shape exactly).
  const useWhen = frontmatterDescription(args.content);
  if (useWhen) {
    entry.useWhen = useWhen;
    entry.surfaceTokenCount = countTriggerTokens(useWhen);
  }
  return mergeCapabilitySidecar(entry, args.sidecarPath);
}

export function buildCapabilityRegistry(root: string): CapabilityRegistry {
  const entries: CapabilityRegistryEntry[] = [];
  const diagnostics: Diagnostic[] = [];
  const skillsRoot = join(root, "skills");
  const partialsRoot = join(root, "DOS", "PARTIALS");
  const agentsRoot = join(root, "agents");

  for (const skillPath of walkFiles(skillsRoot, (p) => basename(p) === "SKILL.md")) {
    const content = readFileSync(skillPath, "utf8");
    const skillDir = dirname(skillPath);
    const rel = relative(skillsRoot, skillDir).split(/[\\/]/).join("/");
    const skillName = frontmatterName(content) ?? rel.replace(/\/?$/, "");
    entries.push(
      makeCapabilityEntry({
        id: `skill:${skillName}`,
        surface: "skill",
        path: skillPath,
        root,
        content,
        sidecarPath: join(skillDir, "capabilities.json"),
      }),
    );
    for (const workflowPath of walkFiles(join(skillDir, "Workflows"), (p) => p.endsWith(".md"))) {
      const workflowContent = readFileSync(workflowPath, "utf8");
      const workflowName = basename(workflowPath, ".md");
      entries.push(
        makeCapabilityEntry({
          id: `skill:${skillName}/workflow:${workflowName}`,
          surface: "workflow",
          path: workflowPath,
          root,
          content: workflowContent,
          sidecarPath: join(dirname(workflowPath), `${workflowName}.capabilities.json`),
        }),
      );
    }
  }

  for (const partialPath of walkFiles(partialsRoot, (p) => p.endsWith(".md"))) {
    const content = readFileSync(partialPath, "utf8");
    const name = basename(partialPath, ".md");
    entries.push(
      makeCapabilityEntry({
        id: `partial:${name}`,
        surface: "partial",
        path: partialPath,
        root,
        content,
        sidecarPath: join(dirname(partialPath), `${name}.capabilities.json`),
      }),
    );
  }

  for (const agentPath of walkFiles(agentsRoot, (p) => p.endsWith(".md"))) {
    const content = readFileSync(agentPath, "utf8");
    const name = frontmatterName(content) ?? basename(agentPath, ".md");
    entries.push(
      makeCapabilityEntry({
        id: `agent:${name}`,
        surface: "agent",
        path: agentPath,
        root,
        content,
        sidecarPath: join(dirname(agentPath), `${name}.capabilities.json`),
      }),
    );
  }

  entries.sort((a, b) => a.id.localeCompare(b.id));
  const withoutHash: Omit<CapabilityRegistry, "hash"> = {
    schema: "dos-capability-registry/v1",
    generatedAt: "1970-01-01T00:00:00.000Z",
    root,
    entries,
    diagnostics,
  };
  return { ...withoutHash, hash: registryHash(withoutHash) };
}

export function capabilityRegistryPath(root: string, stateDir?: string): string {
  return join(stateDir || join(root, "MEMORY", "STATE", "orchestrator"), "capability-registry.json");
}

export function writeCapabilityRegistry(root: string, outPath = capabilityRegistryPath(root)): CapabilityRegistry {
  const registry = buildCapabilityRegistry(root);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(registry, null, 2) + "\n", "utf8");
  return registry;
}

export function loadCapabilityRegistry(root: string, stateDir?: string): CapabilityRegistry {
  const path = capabilityRegistryPath(root, stateDir);
  const parsed = safeReadJson(path);
  if (parsed?.schema === "dos-capability-registry/v1" && Array.isArray(parsed.entries)) return parsed as unknown as CapabilityRegistry;
  return buildCapabilityRegistry(root);
}

export function findCapabilityEntry(registry: CapabilityRegistry | undefined, id: string): CapabilityRegistryEntry | undefined {
  return registry?.entries.find((entry) => entry.id === id);
}
