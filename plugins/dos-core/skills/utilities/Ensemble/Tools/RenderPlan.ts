#!/usr/bin/env bun
/**
 * RenderPlan — compose DELIVERY-PLAN.md from extraction + discovery + inference.
 *
 * Pure markdown renderer. No I/O. Side-by-side display of discovered rails
 * vs operator-overridden rails so the operator sees what got overridden.
 */

import type { WorkUnit } from "./ExtractWorkUnits";
import type { ProjectRails } from "./DiscoverRails";
import type { RoleInference } from "./InferRoles";

export type PlanInput = {
  artifact: { path: string; sha256: string; title: string };
  generatedAt: string;
  rails: ProjectRails;
  discoveredRails: ProjectRails;
  preferences: Record<string, unknown>;
  units: WorkUnit[];
  roles: RoleInference;
  waves: string[][];
};

export function renderPlan(p: PlanInput): string {
  const out: string[] = [];
  out.push(`# Delivery Plan — ${p.artifact.title}`);
  out.push("");
  out.push(`_Generated: ${p.generatedAt}_`);
  out.push("");
  out.push("## Source artifact");
  out.push("");
  out.push(`- **path:** \`${p.artifact.path}\``);
  out.push(`- **sha256:** \`${p.artifact.sha256}\``);
  out.push(`- **title:** ${p.artifact.title}`);
  out.push("");

  out.push("## Target project rails");
  out.push("");
  out.push(`- **project_path:** \`${p.rails.project_path}\``);
  out.push(renderRailRow("four_copy_rule", p.rails.four_copy_rule, p.discoveredRails.four_copy_rule));
  out.push(renderRailRow("sync_check", p.rails.sync_check, p.discoveredRails.sync_check));
  out.push(renderRailRow("package_manager", p.rails.package_manager, p.discoveredRails.package_manager));
  out.push(renderRailRow("monorepo", p.rails.monorepo, p.discoveredRails.monorepo));
  out.push(renderRailRow("typecheck_cmd", p.rails.typecheck_cmd ?? "(null)", p.discoveredRails.typecheck_cmd ?? "(null)"));
  out.push(renderRailRow("test_cmd", p.rails.test_cmd ?? "(null)", p.discoveredRails.test_cmd ?? "(null)"));
  out.push(renderRailRow("precommit_hook", p.rails.precommit_hook, p.discoveredRails.precommit_hook));
  out.push(renderRailRow("commit_convention", p.rails.commit_convention ?? "(null)", p.discoveredRails.commit_convention ?? "(null)"));
  out.push(`- **submodule_paths:** ${p.rails.submodule_paths.length > 0 ? p.rails.submodule_paths.join(", ") : "(none)"}`);
  out.push(`- **available_skills:** ${p.rails.available_skills.length} detected`);
  if (Object.keys(p.preferences).length > 0) {
    out.push("");
    out.push(`  _L3 PREFERENCES overrode ${Object.keys(p.preferences).length} rail(s); discovered values shown alongside._`);
  }
  out.push("");

  out.push("## Roles");
  out.push("");
  out.push("| Role | Scope | File zones |");
  out.push("|------|-------|------------|");
  for (const role of p.roles.roles) {
    out.push(`| \`${role.name}\` | ${escapeCell(role.description)} | ${role.file_zones.map((z) => `\`${z}\``).join(", ") || "—"} |`);
  }
  out.push("");

  out.push("## Work units (DAG)");
  out.push("");
  out.push("| Unit | Title | Section | Owner | Deps | Acceptance count |");
  out.push("|------|-------|---------|-------|------|------------------|");
  for (const u of p.units) {
    const owner = p.roles.unit_assignments[u.id] ?? "(unassigned)";
    const deps = p.roles.deps[u.id] ?? [];
    out.push(
      `| ${u.id} | ${escapeCell(u.title)} | ${u.artifact_section} | \`${owner}\` | ${deps.length > 0 ? deps.join(", ") : "—"} | ${u.acceptance_criteria.length} |`,
    );
  }
  out.push("");

  out.push("## Waves");
  out.push("");
  for (let i = 0; i < p.waves.length; i++) {
    out.push(`- **Wave ${i}:** ${p.waves[i].join(", ")}`);
  }
  out.push("");

  out.push("## Gaps");
  out.push("");
  out.push("_Emit refuses to proceed while any `[ ]` item below is unchecked. Resolve by editing upstream (artifact, CLAUDE.md, PREFERENCES.md) then re-running Plan, or by editing this file directly and checking the gap._");
  out.push("");
  const gaps = buildGaps(p);
  if (gaps.length === 0) {
    out.push("- [x] _No gaps detected._");
  } else {
    for (const g of gaps) out.push(`- [ ] ${g}`);
  }
  out.push("");

  out.push("## Open questions");
  out.push("");
  out.push("_Populate during review. Nothing blocks Emit until moved into Gaps._");
  out.push("");

  return out.join("\n");
}

function renderRailRow(key: string, resolved: unknown, discovered: unknown): string {
  if (resolved === discovered) {
    return `- **${key}:** \`${formatVal(resolved)}\``;
  }
  return `- **${key}:** \`${formatVal(resolved)}\`  _(L3 override; discovered: \`${formatVal(discovered)}\`)_`;
}

function formatVal(v: unknown): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null || v === undefined) return "(null)";
  return String(v);
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildGaps(p: PlanInput): string[] {
  const gaps = [...p.rails.gaps];

  const zoneSeen = new Map<string, string>();
  for (const role of p.roles.roles) {
    for (const zone of role.file_zones) {
      const prev = zoneSeen.get(zone);
      if (prev && prev !== role.name) {
        gaps.push(`File zone \`${zone}\` claimed by both \`${prev}\` and \`${role.name}\` — assign to exactly one role.`);
      } else {
        zoneSeen.set(zone, role.name);
      }
    }
  }

  for (const u of p.units) {
    if (u.acceptance_criteria.length === 0) {
      gaps.push(`Work unit ${u.id} (${u.title}, ${u.artifact_section}) has no acceptance criteria — derive from the artifact or the role's Done-when.`);
    }
    if (!p.roles.unit_assignments[u.id]) {
      gaps.push(`Work unit ${u.id} has no role assignment — pick a role from the Roles table.`);
    }
  }

  return gaps;
}

if (import.meta.main) {
  const input = JSON.parse(process.argv[2] ?? "{}") as PlanInput;
  process.stdout.write(renderPlan(input));
}
