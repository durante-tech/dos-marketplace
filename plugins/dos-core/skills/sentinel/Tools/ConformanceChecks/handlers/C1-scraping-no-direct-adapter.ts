/**
 * C1 — scraping-no-direct-adapter (RFC-0015 §11.5).
 *
 * Workflows outside `Packs/scraping/src/` MUST NOT reference adapter class
 * names (`SmartFetch`, `BrightData.`, `Firecrawl.`, `Apify.`) or the
 * `~/.claude/skills/scraping/` skill path. Callers belong on the
 * `Scrape.*` intent API exposed by `Packs/scraping/src/index.ts` — the
 * router owns adapter selection, escalation, and cleanup.
 *
 * The handler walks every `*.md` under `Packs/` whose path contains
 * `/Workflows/`, filters out the allowlisted `Packs/scraping/src/`
 * subtree, and flags each line matching the banned pattern. Exempt a
 * single line with an adjacent or same-line `<!-- conformance:C1-exempt -->`
 * HTML comment (use sparingly — intended for prose that legitimately
 * names an adapter in a non-call-site context, e.g. release notes).
 */

import { readFileSync } from "fs";
import { relative, resolve } from "path";
import { walkFiles } from "../lib/ast-utils.ts";
import type { CheckContext, CheckResult } from "../types.ts";

const BANNED_RE = /SmartFetch|BrightData\.|Firecrawl\.|Apify\.|\.claude\/skills\/scraping\//;
const EXEMPT_RE = /<!--\s*conformance:C1-exempt/;
const ALLOWLIST_SUBTREE = "Packs/scraping/src";
const FAILURE_HINT =
  "Use Scrape.* intent API from Packs/scraping/src instead of direct adapter calls (RFC-0015 §11.3).";

export async function c1ScrapingNoDirectAdapter(
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
      rId: "C1-RFC0015",
      requirement:
        "No Workflows/*.md outside Packs/scraping/src/ references adapter class names",
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
    rId: "C1-RFC0015",
    requirement:
      "No Workflows/*.md outside Packs/scraping/src/ references adapter class names",
    status: evidence.length === 0 ? "pass" : "fail",
    evidence:
      evidence.length === 0
        ? [`${workflowFiles.length} workflow file(s) clean`]
        : evidence,
  };
}
