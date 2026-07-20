#!/usr/bin/env bun
/**
 * RenderRolloutState — DAG-structured queue file, survives compaction.
 *
 * Pure markdown renderer. Output shape mirrors sprint-5a-rollout-state.md
 * (YAML frontmatter + wave sections with checkboxes + iteration log +
 * termination conditions + safety rails) but waves-first, not linear.
 */

import type { WorkUnit } from "./ExtractWorkUnits";
import type { ProjectRails } from "./DiscoverRails";
import type { RoleInference } from "./InferRoles";

export type RolloutStateInput = {
  slug: string;
  generatedAt: string;
  rails: ProjectRails;
  units: WorkUnit[];
  roles: RoleInference;
  waves: string[][];
};

export function renderRolloutState(p: RolloutStateInput): string {
  const out: string[] = [];

  out.push("---");
  out.push(`scope: ${p.slug}`);
  out.push(`created: ${p.generatedAt}`);
  out.push(`updated: ${p.generatedAt}`);
  out.push("current_wave: 0");
  out.push("current_unit: null");
  out.push("status: pending");
  out.push("abort: false");
  out.push("failure_count: 0");
  out.push("last_failed_unit: null");
  out.push("---");
  out.push("");
  out.push(`# Rollout state — ${p.slug}`);
  out.push("");
  out.push("Consumed by the Conductor on every wake. Re-derived from disk each fire — never cached across turns.");
  out.push("");

  for (let waveIdx = 0; waveIdx < p.waves.length; waveIdx++) {
    const label = waveIdx === 0 ? "Wave 0 (no deps)" : `Wave ${waveIdx}`;
    out.push(`## ${label}`);
    out.push("");
    for (const uid of p.waves[waveIdx]) {
      const u = p.units.find((x) => x.id === uid);
      if (!u) continue;
      const owner = p.roles.unit_assignments[uid] ?? "(unassigned)";
      const deps = p.roles.deps[uid] ?? [];
      const depsLabel = deps.length > 0 ? ` — deps: ${deps.join(", ")}` : "";
      out.push(`- [ ] **${uid}** — ${u.title} (${u.artifact_section}) — owner: \`${owner}\`${depsLabel}`);
    }
    out.push("");
  }

  out.push("## Iteration log");
  out.push("");
  out.push("| # | Wave | Unit | Started | Finished | Owner | Commit | Tests | /code-review |");
  out.push("|---|------|------|---------|----------|-------|--------|-------|-----------|");
  out.push("");

  out.push("## Termination conditions");
  out.push("");
  out.push("Conductor stops advancing when ANY of:");
  out.push("");
  out.push("1. All units are `[x]` checked across all waves.");
  out.push("2. Frontmatter `abort: true`.");
  out.push("3. Frontmatter `failure_count >= 3` AND `last_failed_unit == current_unit` (same unit failed thrice).");
  out.push("");

  out.push("## Safety rails");
  out.push("");
  if (p.rails.commit_convention) {
    out.push(`- Commit messages follow \`${p.rails.commit_convention}\`.`);
  }
  out.push("- Explicit pathspec on every commit: `git commit -- <files>` never bare `git commit`.");
  out.push("- No `--no-verify`. No `--amend` on published commits. No force push.");
  if (p.rails.sync_check) {
    out.push("- `bun ~/Durante/Tools/sync-check.ts` must exit 0 after any multi-copy edit.");
  }
  if (p.rails.submodule_paths.length > 0) {
    out.push("- Submodule commits FIRST, then parent-repo submodule-bump AFTER push (no orphaned submodule refs).");
  }
  out.push("- `/code-review` invoked on every unit that produces code changes (captured in iteration log).");
  out.push("");

  out.push("## Escape hatches");
  out.push("");
  out.push("- Operator sets `abort: true` in frontmatter → Conductor terminates cleanly on next check.");
  out.push("- Operator can skip a unit by flipping `[ ]` to `[~]` with a one-line reason inline.");
  out.push("- Reordering within a wave is allowed; across waves violates the dep ladder.");
  out.push("");

  return out.join("\n");
}

if (import.meta.main) {
  const input = JSON.parse(process.argv[2] ?? "{}") as RolloutStateInput;
  process.stdout.write(renderRolloutState(input));
}
