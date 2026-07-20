/**
 * R14 — INTEL-FIRST rule + intel-context.ts CLI must both be present.
 *
 * The Algorithm OBSERVE phase declares INTEL-FIRST (formerly INTEL-BEFORE-WEB)
 * as a mandatory bullet that requires `intel-context.ts <subject>` to fire on
 * every entity-subject session. This rule fires if EITHER:
 *   (a) the active Algorithm file lacks BOTH `INTEL-FIRST` and the legacy
 *       `INTEL-BEFORE-WEB` token — i.e., the rule was removed, leaving the
 *       CLI orphaned and the agent free to reach for ad-hoc internal walks
 *       or WebFetch reflexively; OR
 *   (b) `Tools/intel-context.ts` does not exist at the canonical path —
 *       i.e., the CLI was deleted while the rule still references it,
 *       breaking every entity-subject OBSERVE.
 *
 * Token list is a tuple to support the 2026-05-03 rename
 * (INTEL-BEFORE-WEB → INTEL-FIRST) without a flag-day; either name passes.
 *
 * Why: RFC-0029 (intel-context read-port, 2026-05-03) shipped both the CLI
 * and the algorithm gate. The two are load-bearing as a pair — drift in
 * either direction is the failure mode the Rich McVey audit (2026-04-29)
 * documented. R14 catches that drift at scan time, before the next
 * entity-subject session degrades to bare WebFetch.
 *
 * Resolution paths checked (in order):
 *   - $CLAUDE_PROJECT_DIR/Tools/intel-context.ts (project canonical)
 *   - $HOME/Durante/Tools/intel-context.ts (maintainer canonical)
 *
 *   - $HOME/.claude/DOS/Algorithm/LATEST (pointer file containing version
 *     string like "v0.0.1"; resolved to v{pointer}.md in the same dir)
 *   - $HOME/.claude/DOS/Algorithm/v0.0.1.md (direct fallback if LATEST absent)
 *   - $HOME/.claude/DOS/Algorithm/v0.0.7.md (prior active version, last resort)
 *
 * Exemption: there is no exemption pragma. If a project genuinely does not
 * adopt INTEL-BEFORE-WEB, the rule returns `not_applicable` rather than
 * `fail` — detected by absence of BOTH the CLI and any Algorithm file
 * containing the token (i.e., DOS not installed at the project level).
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { CheckContext, CheckResult } from "../types.ts";

const RULE_TOKENS = ["INTEL-FIRST", "INTEL-BEFORE-WEB"] as const;

function resolveCli(ctx: CheckContext): string | null {
  const candidates = [
    ctx.repoRoot ? join(ctx.repoRoot, "Tools", "intel-context.ts") : null,
    join(homedir(), "Durante", "Tools", "intel-context.ts"),
  ].filter(Boolean) as string[];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Returns the set of algorithm files R14 must verify. Both the LATEST-pointed
 * file AND any "agent-loadable" prior versions are checked, because empirical
 * evidence (2026-05-03 fresh-session test) shows agents may load v0.0.6.md
 * even when CLAUDE.md + LATEST point at v0.0.1 — likely from training memory
 * heuristics. Defense in depth: rule must live in every loadable version.
 */
function resolveAlgorithmFiles(): string[] {
  const algoDir = join(homedir(), ".claude", "DOS", "Algorithm");
  if (!existsSync(algoDir)) return [];

  const files = new Set<string>();

  // 1. LATEST-pointed file (canonical active version)
  const latest = join(algoDir, "LATEST");
  if (existsSync(latest)) {
    try {
      const pointer = readFileSync(latest, "utf-8").trim();
      if (pointer) {
        const pointed = join(algoDir, `${pointer}.md`);
        if (existsSync(pointed)) files.add(pointed);
      }
    } catch {
      // ignore
    }
  }

  // 2. v0.0.6.md — known agent-loadable via training-memory heuristic
  const v006 = join(algoDir, "v0.0.6.md");
  if (existsSync(v006)) files.add(v006);

  // 3. v0.0.1.md — fallback if LATEST broken
  const v001 = join(algoDir, "v0.0.1.md");
  if (existsSync(v001)) files.add(v001);

  return [...files];
}

function ruleTokenPresent(file: string): { present: boolean; matched: string | null } {
  try {
    const content = readFileSync(file, "utf-8");
    for (const token of RULE_TOKENS) {
      if (content.includes(token)) return { present: true, matched: token };
    }
    return { present: false, matched: null };
  } catch {
    return { present: false, matched: null };
  }
}

export async function r14IntelPreFlightRulePresent(ctx: CheckContext): Promise<CheckResult> {
  const requirement = "INTEL-FIRST rule + intel-context.ts CLI must both be present (defense-in-depth across all loadable Algorithm versions)";
  const cliPath = resolveCli(ctx);
  const algorithmFiles = resolveAlgorithmFiles();

  // Not applicable: DOS not installed (no algorithm files AND no CLI)
  if (algorithmFiles.length === 0 && !cliPath) {
    return {
      rId: "R14",
      requirement,
      status: "not_applicable",
      evidence: ["no DOS Algorithm files under ~/.claude/DOS/Algorithm/ and no Tools/intel-context.ts — DOS not installed for this project"],
    };
  }

  const findings: string[] = [];
  const passedFiles: string[] = [];

  if (algorithmFiles.length === 0) {
    findings.push("Algorithm directory ~/.claude/DOS/Algorithm/ has no checkable v*.md files (expected v0.0.1.md and/or v0.0.6.md)");
  } else {
    for (const file of algorithmFiles) {
      const check = ruleTokenPresent(file);
      if (check.present) {
        passedFiles.push(`${file} contains '${check.matched}'`);
      } else {
        findings.push(`${file}: neither '${RULE_TOKENS.join("' nor '")}' present — agent loading this version would skip INTEL-FIRST entirely`);
      }
    }
  }

  if (!cliPath) {
    findings.push("Tools/intel-context.ts not found at project root or ~/Durante/Tools/ — Algorithm rule references a missing CLI");
  }

  if (findings.length === 0) {
    return {
      rId: "R14",
      requirement,
      status: "pass",
      evidence: [
        ...passedFiles,
        `cli: ${cliPath} exists`,
      ],
    };
  }

  return {
    rId: "R14",
    requirement,
    status: "fail",
    evidence: findings,
  };
}
