/**
 * R101 — presence.archetype-scope-completeness (Archer Stage-2, WRIT_RUN4 scope #5).
 *
 * Background: SeedScope (archetypes pack) seeds feature PRDs with a scope block
 * whose header records the match — `seeded from archetype <name> v<version>` —
 * and whose rows carry `ISC-S<n> [T<tier> <row-id>]` obligations with states
 * build | DEFERRED | WAIVED. The obligation law ("every T1 built or explicitly
 * deferred — never silently absent") is mechanized in the archetypes pack's
 * `ValidateScopeBlock.ts`; SeedScope tells the seeding agent to run it, but
 * nothing audits the corpus after the fact. The ISC-A2 class has two live
 * catches on record (media picker row; billing-settings-hub) — both found by
 * downstream review, not by a mechanical owner. This rule is that owner.
 *
 * Detection — applicable PRDs (flat MEMORY/WORK/<slug>/ + active/<slug>/):
 *   • modified within the recency window (default 14d, `recencyDays` seam)
 *   • body contains the SeedScope match marker (regex below)
 *
 * For each applicable PRD the handler invokes the archetypes CLI —
 * `bun <cli> --prd <PRD.md> --archetype <name> --json` — and surfaces
 * error-severity findings (T1 silently absent / T1 DEFERRED without
 * target+reason / non-T3 WAIVED) as evidence. The CLI is the single source
 * of truth for the obligation law; this handler owns detection + reporting
 * only. Install-state read (live skills CLI) is sanctioned for advisory
 * rules per the R90 resolution (install→advisory; gate only f(HEAD)).
 *
 * Warn-only ship (R80/R91/R93-R98 advisory precedent): ALWAYS returns
 * `status: "pass"` once applicable PRDs exist; violations surface via
 * evidence only. Promote to blocking after FP-rate soak — operator call.
 * Ship itself is operator-gated per WRIT_RUN4 scope #5.
 *
 * Failure modes:
 *   - No MEMORY/WORK/ → not_applicable
 *   - No recent PRD carries the match marker → not_applicable
 *   - CLI unavailable / spawn degraded → pass, degradation in evidence
 *     (advisory never blocks on install state)
 *   - Findings → pass (warn-only), per-PRD evidence lines
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "PRDs seeded from an archetype must keep every T1 row built or explicitly deferred — never silently absent (ISC-A2; ValidateScopeBlock is the obligation law)";

const DEFAULT_RECENCY_DAYS = 14;

// SeedScope Step 2 emits: `## Criteria (scope layer — seeded from archetype <name> v<version>)`
const MATCH_MARKER = /seeded from archetype\s+([a-z0-9-]+)\s+v(\d+\.\d+\.\d+)/;

function listRecentPrdFiles(workRoot: string, recencyMs: number, nowMs: number): string[] {
  const files: string[] = [];
  const roots = [workRoot, join(workRoot, "active")];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry === "active" || entry === "archived") continue;
      const prd = join(root, entry, "PRD.md");
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(prd);
      } catch {
        continue;
      }
      if (nowMs - st.mtimeMs > recencyMs) continue;
      files.push(prd);
    }
  }
  return files;
}

function resolveCli(ctx: CheckContext): string | null {
  const override = (ctx as { archetypeScopeCliPath?: string }).archetypeScopeCliPath;
  const candidates = [
    override,
    join(homedir(), ".claude", "skills", "archetypes", "Tools", "ValidateScopeBlock.ts"),
    join(ctx.repoRoot, "Packs", "archetypes", "src", "Tools", "ValidateScopeBlock.ts"),
  ].filter((c): c is string => typeof c === "string");
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

export async function r101ArchetypeScopeCompleteness(
  ctx: CheckContext,
): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");
  if (!existsSync(workRoot)) {
    return {
      rId: "R101",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${workRoot} not found — no PRD corpus to audit`],
    };
  }

  const nowMs = ctx.nowMs ?? Date.now();
  const recencyDays =
    (ctx as { recencyDays?: number }).recencyDays ?? DEFAULT_RECENCY_DAYS;
  const recencyMs = recencyDays * 24 * 60 * 60 * 1000;

  const seeded: Array<{ prd: string; archetype: string }> = [];
  for (const prd of listRecentPrdFiles(workRoot, recencyMs, nowMs)) {
    let body: string;
    try {
      body = readFileSync(prd, "utf-8");
    } catch {
      continue;
    }
    const m = body.match(MATCH_MARKER);
    if (m) seeded.push({ prd, archetype: m[1] });
  }

  if (seeded.length === 0) {
    return {
      rId: "R101",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [
        `No PRD modified in last ${recencyDays} days carries a "seeded from archetype" scope block`,
      ],
    };
  }

  const cli = resolveCli(ctx);
  if (cli === null) {
    return {
      rId: "R101",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `DEGRADED: ValidateScopeBlock.ts not found (live install or repo) — ${seeded.length} seeded PRD(s) unaudited`,
      ],
    };
  }

  const exec =
    ctx.exec ??
    ((cmd: string, args: string[]) => {
      const r = spawnSync(cmd, args, { encoding: "utf-8", timeout: 30_000 });
      return {
        status: r.status,
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
      };
    });

  const evidence: string[] = [];
  let violations = 0;
  for (const { prd, archetype } of seeded) {
    const r = exec("bun", [cli, "--prd", prd, "--archetype", archetype, "--json"]);
    if (r.status === 2 || r.status === null) {
      evidence.push(`DEGRADED ${prd}: CLI exited ${r.status ?? "null"} (${r.stderr.split("\n")[0] ?? ""})`);
      continue;
    }
    let findings: Array<{ severity: string; rowId: string; message: string }>;
    try {
      findings = JSON.parse(r.stdout).findings ?? [];
    } catch {
      evidence.push(`DEGRADED ${prd}: unparseable CLI output`);
      continue;
    }
    const errors = findings.filter((f) => f.severity === "error");
    violations += errors.length;
    for (const f of errors) {
      evidence.push(`${prd} [${archetype}] ${f.rowId}: ${f.message}`);
    }
  }

  if (violations === 0) {
    evidence.push(
      `0 obligation errors across ${seeded.length} seeded PRD(s) in window`,
    );
  }

  // Warn-only AUDIT tier: violations are evidence, never a fail verdict.
  return {
    rId: "R101",
    requirement: REQUIREMENT,
    status: "pass",
    evidence,
  };
}
