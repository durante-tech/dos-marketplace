#!/usr/bin/env bun
/**
 * RenderSessionPrompt — emit the Conductor's mission brief.
 *
 * Pure markdown renderer. Reads a fully-resolved PlanInput + parsed gaps list.
 * Output is paste-ready: open a fresh Claude Code session, paste, Conductor
 * spawns the ensemble via named Agent teammates + SendMessage.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { WorkUnit } from "./ExtractWorkUnits";
import type { ProjectRails } from "./DiscoverRails";
import type { RoleInference } from "./InferRoles";

/**
 * Resolve the active Algorithm doctrine version from ~/.claude/DOS/Algorithm/LATEST.
 * Inlined (rather than imported from DOS/Tools/resolve-active-doctrine.ts) because
 * pack source and live install sit at different relative depths and the same
 * relative import would resolve to different targets across the Four Copies.
 * Logic mirror: ~/Durante/Tools/resolve-active-doctrine.ts.
 */
function resolveDoctrineVersion(): string {
  // Fallback chain mirrors resolve-active-doctrine.ts (TOOLB-003):
  // LATEST → .default-LATEST → hardcoded last-resort.
  const HARDCODED_FALLBACK = "v0.0.10";
  const home = process.env.HOME ?? "";
  const algorithmDir = join(home, ".claude", "DOS", "Algorithm");
  try {
    const latest = join(algorithmDir, "LATEST");
    if (existsSync(latest)) {
      const raw = readFileSync(latest, "utf-8").trim();
      if (raw && /^v\d+\.\d+\.\d+(-\w+)?$/.test(raw)) return raw;
    }
  } catch {
  }
  try {
    const defaultLatest = join(algorithmDir, ".default-LATEST");
    if (existsSync(defaultLatest)) {
      const raw = readFileSync(defaultLatest, "utf-8").trim();
      if (raw && /^v\d+\.\d+\.\d+(-\w+)?$/.test(raw)) return raw;
    }
  } catch {
  }
  return HARDCODED_FALLBACK;
}

export type SessionPromptInput = {
  artifact: { path: string; sha256: string; title: string };
  generatedAt: string;
  rails: ProjectRails;
  units: WorkUnit[];
  roles: RoleInference;
  waves: string[][];
  slug: string;
};

export function renderSessionPrompt(p: SessionPromptInput): string {
  const out: string[] = [];
  const algorithmVersion = resolveDoctrineVersion();

  out.push(`# Session Prompt — ${p.artifact.title} (Ensemble)`);
  out.push("");
  out.push(`**Type:** Multi-teammate delivery against a frozen artifact. NOT authoring, NOT re-debate.`);
  out.push(`**Artifact:** \`${p.artifact.path}\` (sha256 \`${p.artifact.sha256}\`)`);
  out.push(`**Target project:** \`${p.rails.project_path}\``);
  out.push("");
  out.push("---");
  out.push("");

  out.push("## Role");
  out.push("");
  out.push("You are the **Conductor** for this delivery. Your job is to orchestrate the ensemble via named teammate spawns + `SendMessage`, verify hard gates, coordinate handoffs, and declare shipping only when every Done-gate is green. **You do not write production code yourself** — teammates do. You verify.");
  out.push("");

  out.push("## Mode");
  out.push("");
  out.push(`ALGORITHM mode at session start. Load \`DOS/Algorithm/${algorithmVersion}.md\` (active doctrine resolved at render time from \`DOS/Algorithm/LATEST\`). Teammates inherit ALGORITHM or operate in NATIVE per their scope.`);
  out.push("");
  out.push("---");
  out.push("");

  out.push("## Entry Gates (verify before spawning the ensemble)");
  out.push("");
  out.push("Run in parallel at session start. If any fails, STOP and report.");
  out.push("");
  out.push(`- [ ] Target project clean: \`cd ${p.rails.project_path} && git status\` shows no in-progress branches or uncommitted changes.`);
  if (p.rails.typecheck_cmd) {
    out.push(`- [ ] Typecheck baseline green: \`${p.rails.typecheck_cmd}\` in target project.`);
  }
  if (p.rails.test_cmd) {
    out.push(`- [ ] Test baseline green: \`${p.rails.test_cmd}\` in target project.`);
  }
  if (p.rails.sync_check) {
    out.push(`- [ ] Four-copy sync clean: \`bun ~/Durante/Tools/sync-check.ts\` exit 0.`);
  }
  if (p.rails.submodule_paths.length > 0) {
    out.push(`- [ ] Submodule(s) at clean HEAD: ${p.rails.submodule_paths.map((s) => `\`${s}\``).join(", ")}.`);
  }
  out.push("- [ ] Artifact sha256 matches: re-hash the artifact file and confirm it equals the one above.");
  out.push("");
  out.push("---");
  out.push("");

  out.push("## Ground Truth — read these FIRST, in parallel (MANDATORY)");
  out.push("");
  out.push(`1. **Artifact:** \`${p.artifact.path}\` — read every work-unit section enumerated in the ensemble briefs below.`);
  out.push(`2. **Target project CLAUDE.md** (if present) — authoritative conventions.`);
  out.push(`3. **Available skills:** ${p.rails.available_skills.slice(0, 15).map((s) => `\`${s}\``).join(", ")}${p.rails.available_skills.length > 15 ? ", …" : ""}`);
  out.push("");
  out.push("---");
  out.push("");

  out.push("## Ensemble Structure");
  out.push("");
  out.push("Spawn each teammate via the `Agent` tool with a `name:` (the session has a single implicit team). Each teammate is long-lived and addressable by name via `SendMessage`. Conductor verifies Done-gates; teammates do not ship independently.");
  out.push("");

  for (let roleIdx = 0; roleIdx < p.roles.roles.length; roleIdx++) {
    const role = p.roles.roles[roleIdx];
    const ownedUnits = p.units.filter((u) => p.roles.unit_assignments[u.id] === role.name);
    const activationWave = findRoleActivationWave(role.name, p.roles.unit_assignments, p.waves);

    out.push(`### ${roleIdx + 1}. \`${role.name}\``);
    out.push("");
    out.push(`**Activates when:** ${activationWave === 0 ? "immediately (Wave 0)" : `Wave ${activationWave} — dependencies from Wave ${activationWave - 1} are green`}`);
    out.push("");
    out.push(`**Scope:** ${role.description}`);
    out.push("");
    out.push(`**File zones (exclusive):** ${role.file_zones.map((z) => `\`${z}\``).join(", ") || "_(none claimed)_"}`);
    out.push("");
    out.push(`**Work units:**`);
    for (const u of ownedUnits) {
      out.push(`- **${u.id}** — ${u.title} (${u.artifact_section})`);
    }
    out.push("");

    const allAcceptance = ownedUnits.flatMap((u) => u.acceptance_criteria);
    if (allAcceptance.length > 0) {
      out.push(`**Done-gates (from artifact acceptance):**`);
      for (const gate of allAcceptance) out.push(`- [ ] ${gate}`);
      out.push("");
    }

    out.push(`**Ship protocol:**`);
    if (p.rails.commit_convention) {
      out.push(`- Commit message format: \`${p.rails.commit_convention}\``);
    }
    out.push("- Explicit pathspec only (\`git commit -- <file1> <file2>\`); never \`git add .\` / \`git add -A\`.");
    if (p.rails.submodule_paths.length > 0) {
      out.push("- Submodule commits FIRST, parent-repo submodule-bump AFTER push.");
    }
    out.push("- Post-BUILD `/code-review` on own diff before Done-gate SendMessage.");
    out.push("- SendMessage back to Conductor with a receipt block: `{ unit_id, commit_sha, tests_passed, simplify_findings }`.");
    out.push("");
    out.push("---");
    out.push("");
  }

  out.push("## Wave Handoff Table");
  out.push("");
  out.push("| Wave | Active units | Gate to advance |");
  out.push("|-----:|--------------|-----------------|");
  for (let i = 0; i < p.waves.length; i++) {
    const unitsInWave = p.waves[i]
      .map((uid) => {
        const u = p.units.find((x) => x.id === uid);
        const owner = p.roles.unit_assignments[uid];
        return u ? `${uid} (${owner})` : uid;
      })
      .join(", ");
    const gate = i === p.waves.length - 1 ? "All Done-gates green → ship" : `Every unit in Wave ${i} has a received receipt`;
    out.push(`| ${i} | ${unitsInWave} | ${gate} |`);
  }
  out.push("");
  out.push("**No dates.** Waves advance when dep-sets are green. Conductor ticks `rollout-state.md` as receipts arrive.");
  out.push("");
  out.push("---");
  out.push("");

  out.push("## Verification Protocol (before declaring shipped)");
  out.push("");
  out.push("Execute in order. Any failure → STOP, do not declare shipped, escalate.");
  out.push("");
  const steps: Array<{ header: string; body: string }> = [];
  steps.push({ header: "All Done-gates green", body: "every unit in every wave has a receipt with `tests_passed: true`." });
  if (p.rails.typecheck_cmd) steps.push({ header: "Full typecheck pass", body: `\`${p.rails.typecheck_cmd}\` exit 0.` });
  if (p.rails.test_cmd) steps.push({ header: "Full test suite pass", body: `\`${p.rails.test_cmd}\` exit 0.` });
  if (p.rails.sync_check) steps.push({ header: "Four-copy parity", body: "`bun ~/Durante/Tools/sync-check.ts` exit 0." });
  steps.push({ header: "Artifact coverage", body: "every work unit has an associated commit or staging artifact linked." });
  for (let i = 0; i < steps.length; i++) {
    out.push(`${i + 1}. **${steps[i].header}:** ${steps[i].body}`);
  }
  out.push("");
  out.push("---");
  out.push("");

  out.push("## Shipping Receipt");
  out.push("");
  out.push("Output this only when the Verification Protocol is fully green:");
  out.push("");
  out.push("```yaml");
  out.push("---");
  out.push(`delivery: ${p.slug}`);
  out.push(`artifact_sha256: ${p.artifact.sha256}`);
  out.push("declared: <ISO 8601 timestamp>");
  out.push("declared_by: Ensemble Conductor (DOS)");
  out.push(`waves_completed: ${p.waves.length}/${p.waves.length}`);
  out.push(`units_shipped: ${p.units.length}/${p.units.length}`);
  out.push("final_commits: <list of commit SHAs, one per work unit>");
  out.push("---");
  out.push("```");
  out.push("");
  out.push("---");
  out.push("");

  out.push("## Anti-patterns (do NOT)");
  out.push("");
  out.push("- Do NOT re-debate the artifact. It's the frozen contract.");
  out.push("- Do NOT extend scope beyond the listed work units.");
  out.push("- Do NOT `git add .` / `git add -A`.");
  if (p.rails.submodule_paths.length > 0) {
    out.push("- Do NOT commit the parent-repo submodule bump BEFORE pushing the submodule commit (orphans the ref).");
  }
  out.push("- Do NOT declare shipped because \"it works in dev\" — the Verification Protocol is non-negotiable.");
  out.push("- Do NOT install new npm packages without explicit approval.");
  out.push("- Do NOT skip `/code-review` on code-producing units.");
  out.push("");
  out.push("---");
  out.push("");
  out.push("*End of mission prompt. Self-contained; do not require follow-up context to proceed.*");
  out.push("");

  return out.join("\n");
}

function findRoleActivationWave(
  roleName: string,
  assignments: Record<string, string>,
  waves: string[][],
): number {
  for (let i = 0; i < waves.length; i++) {
    for (const uid of waves[i]) {
      if (assignments[uid] === roleName) return i;
    }
  }
  return 0;
}

if (import.meta.main) {
  const input = JSON.parse(process.argv[2] ?? "{}") as SessionPromptInput;
  process.stdout.write(renderSessionPrompt(input));
}
