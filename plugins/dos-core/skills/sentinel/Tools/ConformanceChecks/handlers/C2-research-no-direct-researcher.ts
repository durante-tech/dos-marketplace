/**
 * C2 — research-no-direct-researcher (RFC-0015 §11.5).
 *
 * Workflows outside `Packs/research/src/` MUST NOT invoke any
 * `subagent_type: "<Brave|Claude|Gemini|Perplexity|Grok|Codex>Researcher"`
 * directly. Callers belong on `Research.searchPerspectives(query, opts)`
 * exposed by `Packs/research/src/index.ts` — the router owns perspective
 * selection, parallelism, and synthesis.
 *
 * Handler shape mirrors C1: walk `*.md` under `Packs/` whose path contains
 * `/Workflows/`, exclude the allowlisted `Packs/research/src/` subtree,
 * flag lines matching the banned pattern. Exempt via
 * `<!-- conformance:C2-exempt -->` HTML comment on or above the line.
 */

import { readFileSync } from "fs";
import { relative, resolve } from "path";
import { walkFiles } from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const BANNED_RE = /subagent_type:\s*["'](?:Brave|Claude|Gemini|Perplexity|Grok|Codex)Researcher["']/;
const EXEMPT_RE = /<!--\s*conformance:C2-exempt/;
const ALLOWLIST_SUBTREE = "Packs/research/src";
const FAILURE_HINT =
  "Use Research.searchPerspectives from Packs/research/src instead of direct Researcher subagent_type calls (RFC-0015 §11.4).";

export async function c2ResearchNoDirectResearcher(
  ctx: CheckContext,
): Promise<CheckResult> {
  const packsRoot = resolve(ctx.repoRoot, "Packs");
  const allowlistPrefix = resolve(ctx.repoRoot, ALLOWLIST_SUBTREE) + "/";

  const mdFiles = walkFiles(packsRoot, (name) => name.endsWith(".md"));
  const testFixtureSubpath =
    "Packs/sentinel/src/Tools/ConformanceChecks/__fixtures__/";
  const workflowFiles = mdFiles.filter((f) => {
    const rel = relative(ctx.repoRoot, f);
    return (
      f.includes("/Workflows/") &&
      !f.startsWith(allowlistPrefix) &&
      !rel.startsWith(testFixtureSubpath)
    );
  });

  if (workflowFiles.length === 0) {
    return {
      rId: "C2",
      requirement:
        "No Workflows/*.md outside Packs/research/src/ invokes direct Researcher subagent_type",
      status: "not_applicable",
      evidence: [`no non-allowlisted Workflows/*.md found under ${packsRoot}`],
    };
  }

  const evidence: string[] = [];
  for (const file of workflowFiles) {
    const lines = readFileSync(file, "utf-8").split("\n");
    const rel = relative(ctx.repoRoot, file);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!BANNED_RE.test(line)) continue;
      const prev = i > 0 ? lines[i - 1] : "";
      if (EXEMPT_RE.test(line) || EXEMPT_RE.test(prev)) continue;
      evidence.push(`${rel}:${i + 1}  ${FAILURE_HINT}`);
    }
  }

  return {
    rId: "C2",
    requirement:
      "No Workflows/*.md outside Packs/research/src/ invokes direct Researcher subagent_type",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence:
      evidence.length === 0
        ? [`${workflowFiles.length} workflow file(s) clean`]
        : evidence,
  };
}
