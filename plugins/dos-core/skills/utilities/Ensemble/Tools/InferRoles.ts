#!/usr/bin/env bun
/**
 * InferRoles — one Inference.ts (fast/Haiku) call returns role proposals,
 * unit→role assignments, and dep edges. Inline shape validator (no Zod dep).
 *
 * Roles are domain-appropriate per invocation — NOT a fixed taxonomy. A
 * Studio-like spec yields db / services / frontend / qa; a research sprint
 * yields researcher / synthesizer / fact-checker. The model picks.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { WorkUnit } from "./ExtractWorkUnits";
import type { ProjectRails } from "./DiscoverRails";

export type Role = {
  name: string;
  description: string;
  file_zones: string[];
};

export type RoleInference = {
  roles: Role[];
  unit_assignments: Record<string, string>;
  deps: Record<string, string[]>;
};

const SYSTEM_PROMPT = `You are a delivery-planning analyst. Given work units extracted from an artifact and a target project's rails, propose roles (domain-appropriate names, NOT a fixed taxonomy), assign each unit to a role, and infer dependency edges.

Return strict JSON of shape:
{
  "roles": [{"name": "role-name", "description": "1-sentence scope", "file_zones": ["dir1/", "dir2/"]}],
  "unit_assignments": {"W1": "role-name", ...},
  "deps": {"W1": [], "W2": ["W1"], ...}
}

Guidance:
- Roles should reflect the artifact's domain. DB/API/UI spec -> db / services / frontend / qa. Research sprint -> researcher / synthesizer / fact-checker. Security audit -> scanner / triager / reporter.
- Role count is typically 3-7 for v0 (too few = no parallelism; too many = coordination overhead).
- File zones should NOT overlap across roles (parallelism safety).
- Dep edges should be MINIMAL — include an edge only if unit A plainly cannot start until unit B produces its output. Prefer empty deps (Wave 0) when the relationship is unclear.
- Every work unit id (W1, W2, ...) MUST appear as a key in unit_assignments AND in deps.
- Return JSON only, no commentary.`;

export async function inferRoles(units: WorkUnit[], rails: ProjectRails): Promise<RoleInference> {
  const unitsBlock = units
    .map((u) => `**${u.id} — ${u.title}** (${u.artifact_section})\n${u.raw_content.slice(0, 1500)}`)
    .join("\n\n");
  const railsBlock = [
    `package_manager: ${rails.package_manager}`,
    `monorepo: ${rails.monorepo}`,
    `submodules: ${rails.submodule_paths.length > 0 ? rails.submodule_paths.join(", ") : "none"}`,
    `available_skills: ${rails.available_skills.slice(0, 30).join(", ")}`,
  ].join("\n");
  const user = `Project rails:\n${railsBlock}\n\nWork units:\n${unitsBlock}\n\nReturn JSON only.`;

  const inferencePath = join(homedir(), ".claude/DOS/Tools/Inference.ts");
  const out = execFileSync(
    "bun",
    [inferencePath, "--level", "fast", "--json", SYSTEM_PROMPT, user],
    { encoding: "utf8", timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
  );
  const parsed = extractParsed(out);
  if (!parsed) {
    throw new Error(
      `InferRoles: Inference.ts returned unparseable response (first 200 chars): ${out.slice(0, 200).replace(/\n/g, "\\n")}`,
    );
  }
  return validate(parsed, units);
}

function extractParsed(raw: string): unknown {
  let env: { parsed?: unknown; output?: string };
  try {
    env = JSON.parse(raw) as { parsed?: unknown; output?: string };
  } catch {
    return null;
  }
  if (env.parsed && typeof env.parsed === "object") return env.parsed;
  if (typeof env.output === "string") {
    try {
      return JSON.parse(env.output);
    } catch {
      return null;
    }
  }
  return null;
}

function validate(raw: unknown, units: WorkUnit[]): RoleInference {
  if (!raw || typeof raw !== "object") throw new Error("InferRoles: non-object response");
  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r.roles)) throw new Error("InferRoles: missing or non-array `roles`");
  const roles: Role[] = [];
  for (const role of r.roles) {
    if (!role || typeof role !== "object") {
      throw new Error(`InferRoles: malformed role entry ${JSON.stringify(role)}`);
    }
    const ro = role as Record<string, unknown>;
    if (typeof ro.name !== "string" || typeof ro.description !== "string" || !Array.isArray(ro.file_zones)) {
      throw new Error(`InferRoles: malformed role entry ${JSON.stringify(role)}`);
    }
    roles.push({
      name: ro.name,
      description: ro.description,
      file_zones: (ro.file_zones as unknown[]).filter((z): z is string => typeof z === "string"),
    });
  }

  if (!r.unit_assignments || typeof r.unit_assignments !== "object") {
    throw new Error("InferRoles: missing `unit_assignments`");
  }
  const assignments = r.unit_assignments as Record<string, unknown>;
  const unit_assignments: Record<string, string> = {};
  for (const u of units) {
    const v = assignments[u.id];
    if (typeof v !== "string") {
      throw new Error(`InferRoles: missing assignment for ${u.id}`);
    }
    unit_assignments[u.id] = v;
  }

  if (!r.deps || typeof r.deps !== "object") throw new Error("InferRoles: missing `deps`");
  const depsRaw = r.deps as Record<string, unknown>;
  const knownIds = new Set(units.map((u) => u.id));
  const deps: Record<string, string[]> = {};
  for (const u of units) {
    const v = depsRaw[u.id];
    if (v === undefined) {
      deps[u.id] = [];
      continue;
    }
    if (!Array.isArray(v)) {
      throw new Error(`InferRoles: deps[${u.id}] is not an array (got ${typeof v})`);
    }
    const strings = v.filter((x): x is string => typeof x === "string");
    const unknown = strings.filter((d) => !knownIds.has(d));
    if (unknown.length > 0) {
      throw new Error(`InferRoles: deps[${u.id}] references unknown unit id(s): ${unknown.join(", ")}`);
    }
    deps[u.id] = strings;
  }

  return { roles, unit_assignments, deps };
}

if (import.meta.main) {
  const unitsPath = process.argv[2];
  const railsPath = process.argv[3];
  if (!unitsPath || !railsPath) {
    process.stderr.write("usage: bun InferRoles.ts <units.json> <rails.json>\n");
    process.exit(2);
  }
  const units = JSON.parse(readFileSync(unitsPath, "utf8")) as WorkUnit[];
  const rails = JSON.parse(readFileSync(railsPath, "utf8")) as ProjectRails;
  inferRoles(units, rails).then((r) => {
    process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  });
}
