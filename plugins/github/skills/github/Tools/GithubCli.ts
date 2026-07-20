#!/usr/bin/env bun
/**
 * GithubCli — deterministic render helpers for the DOS Github PR-review skill.
 *
 * The reviewer panel (Cockburn/Fowler/UncleBob/Sentinel/QA), the per-reviewer
 * verdicts, the aggregated team verdict, and the one-line asks are all JUDGMENT
 * produced by the agent. These render helpers take that already-decided structured
 * data and assemble the EXACT operator-facing markdown the workflow prose used to
 * hand-interpolate per run. Pure functions, no I/O, no inference.
 *
 * Extracted from prose templates (RFC-0126 section 9 B1 render-family remediation):
 *   - renderReviewReport   <- ReviewSinglePR.md Step 4 structured report (lines 72-113)
 *   - renderPRCommentBody  <- ReviewPRs.md Step 6 summary comment (lines 121-145)
 *
 * Plus the deterministic decision predicates (RFC-0126 section 9 B5 gate remediation).
 * These are NOT inference — the per-reviewer verdicts and the PR field values are
 * judgment produced by the agent, but the team-verdict precedence and the fleet
 * ranking order are fixed rules; they belong in tested code, not hand-applied prose:
 *   - aggregateVerdicts    <- ReviewSinglePR.md Step 4 + ReviewPRs.md Step 5 verdict table
 *   - rankPRs              <- ReviewPRs.md Step 2 Filter & Rank ranking rule
 *
 * Precedent: Sentinel renderDuranteNative() in Packs/sentinel/src/Tools/SentinelScan.ts.
 *
 * Usage:
 *   bun GithubCli.ts render-review-report <data.json>
 *   bun GithubCli.ts render-comment <data.json>
 *   bun GithubCli.ts aggregate-verdicts <data.json>
 *   bun GithubCli.ts rank-prs <data.json>
 * Output: rendered markdown (render-*) or JSON (aggregate/rank) to stdout.
 */

import { existsSync, readFileSync } from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// One reviewer's contribution to the structured report. Verdict + the one-line
// "top ask" populate the summary table; reasoning is the reviewer's full text.
export interface ReviewerEntry {
  verdict: string;
  topAsk: string;
  reasoning: string;
}

// The five fixed reviewer seats of the panel. The skeleton always renders all
// five rows/sections in this order, byte-identical to the prose template — even
// when a reviewer was not consulted (then the agent passes the placeholder text).
export interface ReviewReportData {
  prNumber: number | string;
  title: string;
  teamVerdict: string;
  ciSummary: string;
  recommendation: string;
  architecture: ReviewerEntry; // Cockburn
  refactoring: ReviewerEntry; // Fowler
  cleanCode: ReviewerEntry; // UncleBob
  conventions: ReviewerEntry; // Sentinel
  qa: ReviewerEntry;
}

// Per-PR summary comment posted via `gh pr comment`. The reviewer list and the
// three top asks are agent-decided; the helper assembles the comment body.
export interface PRCommentData {
  teamVerdict: string;
  reviewersConsulted: string[];
  architecture: { verdict: string; summary: string }; // Cockburn
  refactoring: { verdict: string; summary: string }; // Fowler
  cleanCode: { verdict: string; summary: string }; // UncleBob
  conventions: { verdict: string; summary: string }; // Sentinel
  qa: { verdict: string; summary: string };
  asks: [string, string, string];
}

// ---------------------------------------------------------------------------
// Render helpers (pure)
// ---------------------------------------------------------------------------

/**
 * Structured team-review report for one PR (ReviewSinglePR.md Step 4).
 *
 * Byte-identical to the prose `markdown` block: the H1 with PR number + title,
 * the team-verdict line, the 5-row reviewer table (Top ask column), the Reasoning
 * section with one H3 per reviewer, the CI section, and the Recommendation section.
 */
export function renderReviewReport(d: ReviewReportData): string {
  return `# DOS team review — PR #${d.prNumber}: ${d.title}

**Team verdict:** ${d.teamVerdict}

| Reviewer | Verdict | Top ask |
|---|---|---|
| Architecture (Cockburn) | ${d.architecture.verdict} | ${d.architecture.topAsk} |
| Refactoring (Fowler) | ${d.refactoring.verdict} | ${d.refactoring.topAsk} |
| Clean Code (UncleBob) | ${d.cleanCode.verdict} | ${d.cleanCode.topAsk} |
| Conventions (Sentinel) | ${d.conventions.verdict} | ${d.conventions.topAsk} |
| QA | ${d.qa.verdict} | ${d.qa.topAsk} |

## Reasoning

### Architecture (Cockburn)
${d.architecture.reasoning}

### Refactoring (Fowler)
${d.refactoring.reasoning}

### Clean Code (UncleBob)
${d.cleanCode.reasoning}

### Conventions (Sentinel)
${d.conventions.reasoning}

### QA
${d.qa.reasoning}

## CI

${d.ciSummary}

## Recommendation

${d.recommendation}
`;
}

/**
 * Per-PR summary comment body (ReviewPRs.md Step 6), posted via
 * `gh pr comment {N} --body @-`.
 *
 * Byte-identical to the prose `markdown` block: the H2 title, the verdict line,
 * the comma-separated reviewers-consulted line, the Per-reviewer bullet list (the
 * fixed five seats), the Top asks ordered list, and the trailing generated-by note.
 */
export function renderPRCommentBody(d: PRCommentData): string {
  return `## DOS team review

**Verdict:** ${d.teamVerdict}

**Reviewers consulted:** ${d.reviewersConsulted.join(", ")}

### Per-reviewer
- **Architecture (Cockburn):** ${d.architecture.verdict} — ${d.architecture.summary}
- **Refactoring (Fowler):** ${d.refactoring.verdict} — ${d.refactoring.summary}
- **Clean Code (UncleBob):** ${d.cleanCode.verdict} — ${d.cleanCode.summary}
- **Conventions (Sentinel):** ${d.conventions.verdict} — ${d.conventions.summary}
- **QA:** ${d.qa.verdict} — ${d.qa.summary}

### Top asks
1. ${d.asks[0]}
2. ${d.asks[1]}
3. ${d.asks[2]}

_Generated by DOS github skill. Comments are auto. Merges require human approval._
`;
}

// ---------------------------------------------------------------------------
// Decision predicates (pure) — RFC-0126 section 9 B5
// ---------------------------------------------------------------------------

// The four team-verdict categories the workflow tables resolve to. The category
// is invariant across ReviewSinglePR.md Step 4 and ReviewPRs.md Step 5; the two
// prose tables differ only in the human suffix on BLOCK ("see {reviewer}" vs
// "see {reviewer} reasoning"), which the prose composes from blockingReviewer.
export type TeamVerdictCategory =
  | "PASS"
  | "BLOCK"
  | "CHANGES-minor"
  | "CHANGES-substantial";

export interface TeamVerdict {
  category: TeamVerdictCategory;
  // The canonical operator-facing line both workflows use VERBATIM for the three
  // non-BLOCK categories. For BLOCK it is the bare prefix; prose appends the
  // reviewer reference, so this stays "BLOCK — see " + the blocking reviewer name
  // when one is provided, or just "BLOCK" when the names array is omitted.
  line: string;
  // Index into the input verdicts array of the FIRST reviewer that returned BLOCK
  // (precedence is positional — first BLOCK wins), or -1 when none blocked.
  blockingIndex: number;
}

// Normalize a single reviewer's verdict token to one of the three recognized
// states. Reviewers emit "PASS" / "CHANGES" / "BLOCK" (case/space-insensitive);
// anything unrecognized is treated as CHANGES (the conservative non-blocking
// non-passing state) so an unknown token never silently produces a PASS verdict.
function normalizeVerdict(v: string): "PASS" | "CHANGES" | "BLOCK" {
  const t = v.trim().toUpperCase();
  if (t === "PASS") return "PASS";
  if (t === "BLOCK") return "BLOCK";
  return "CHANGES";
}

/**
 * Aggregate a reviewer-verdict array into the single team verdict
 * (ReviewSinglePR.md Step 4 + ReviewPRs.md Step 5).
 *
 * Precedence, highest first (effect-identical to both prose tables):
 *   1. Any BLOCK            -> BLOCK (first blocking reviewer wins)
 *   2. All PASS             -> PASS — ready to merge after CI green
 *   3. All CHANGES          -> CHANGES — substantial
 *   4. Mixed PASS/CHANGES   -> CHANGES — minor
 *
 * `reviewerNames` is optional and only used to compose the BLOCK line suffix
 * ("BLOCK — see {reviewer}"). When omitted, the BLOCK line is the bare "BLOCK".
 * An empty verdicts array is treated as "no PASS, no BLOCK" => CHANGES — minor,
 * matching the prose default of never emitting PASS without an all-PASS panel.
 */
export function aggregateVerdicts(verdicts: string[], reviewerNames?: string[]): TeamVerdict {
  const norm = verdicts.map(normalizeVerdict);
  const blockingIndex = norm.findIndex((v) => v === "BLOCK");
  if (blockingIndex !== -1) {
    const name = reviewerNames?.[blockingIndex];
    return {
      category: "BLOCK",
      line: name ? `BLOCK — see ${name}` : "BLOCK",
      blockingIndex,
    };
  }
  if (norm.length > 0 && norm.every((v) => v === "PASS")) {
    return { category: "PASS", line: "PASS — ready to merge after CI green", blockingIndex: -1 };
  }
  if (norm.length > 0 && norm.every((v) => v === "CHANGES")) {
    return { category: "CHANGES-substantial", line: "CHANGES — substantial", blockingIndex: -1 };
  }
  return { category: "CHANGES-minor", line: "CHANGES — minor", blockingIndex: -1 };
}

// One PR's rank-relevant fields, as read from `gh pr list --json`. ci is the
// tag derived in ReviewPRs.md Step 2 from statusCheckRollup; sizeLines is the
// diff size (lines); createdAt is the ISO timestamp ("oldest" tiebreak).
export interface RankablePR {
  number: number;
  ci: "green" | "red" | "pending" | "none";
  sizeLines: number;
  createdAt: string;
}

/**
 * Rank a PR fleet for review order (ReviewPRs.md Step 2 Filter & Rank).
 *
 * Rule, verbatim from the prose: "red CI first, then large diffs, then oldest,
 * then everything else." Implemented as a total order:
 *   1. red CI before non-red CI
 *   2. larger diff before smaller diff
 *   3. older createdAt before newer
 *   4. lower PR number before higher (stable, deterministic final tiebreak)
 *
 * Pure: returns a new sorted array, does not mutate the input.
 */
export function rankPRs(prs: RankablePR[]): RankablePR[] {
  return [...prs].sort((a, b) => {
    const aRed = a.ci === "red" ? 0 : 1;
    const bRed = b.ci === "red" ? 0 : 1;
    if (aRed !== bRed) return aRed - bRed;
    if (a.sizeLines !== b.sizeLines) return b.sizeLines - a.sizeLines;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.number - b.number;
  });
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`GithubCli — deterministic render + decision helpers for the DOS Github PR-review skill

USAGE
  bun GithubCli.ts render-review-report <data.json>
  bun GithubCli.ts render-comment <data.json>
  bun GithubCli.ts aggregate-verdicts <data.json>
  bun GithubCli.ts rank-prs <data.json>

SUBCOMMANDS
  render-review-report <data.json>  Print the structured single-PR team-review
                                    report (ReviewSinglePR.md Step 4). <data.json>
                                    matches ReviewReportData.
  render-comment <data.json>        Print the per-PR summary comment body
                                    (ReviewPRs.md Step 6). <data.json> matches
                                    PRCommentData.
  aggregate-verdicts <data.json>    Resolve a reviewer-verdict array into the team
                                    verdict (ReviewSinglePR Step 4 / ReviewPRs Step 5).
                                    <data.json> = { "verdicts": ["PASS",...],
                                    "reviewerNames": ["Cockburn",...] }. Prints the
                                    TeamVerdict object as JSON.
  rank-prs <data.json>              Sort a PR fleet for review order (ReviewPRs
                                    Step 2). <data.json> = { "prs": [RankablePR,...] }.
                                    Prints the ranked array as JSON.

OPTIONS
  --help   Show this help message

OUTPUT
  Rendered markdown (render-*) or JSON (aggregate-verdicts / rank-prs) to stdout.`);
}

function readJson(path: string): unknown {
  if (!path) {
    console.error("Error: missing <data.json> argument");
    process.exit(1);
  }
  if (!existsSync(path)) {
    console.error(`Error: file not found: ${path}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    printHelp();
    process.exit(0);
  }
  const cmd = argv[0];
  if (cmd === "render-review-report") {
    process.stdout.write(renderReviewReport(readJson(argv[1]) as ReviewReportData));
    return;
  }
  if (cmd === "render-comment") {
    process.stdout.write(renderPRCommentBody(readJson(argv[1]) as PRCommentData));
    return;
  }
  if (cmd === "aggregate-verdicts") {
    const d = readJson(argv[1]) as { verdicts: string[]; reviewerNames?: string[] };
    process.stdout.write(JSON.stringify(aggregateVerdicts(d.verdicts, d.reviewerNames), null, 2) + "\n");
    return;
  }
  if (cmd === "rank-prs") {
    const d = readJson(argv[1]) as { prs: RankablePR[] };
    process.stdout.write(JSON.stringify(rankPRs(d.prs), null, 2) + "\n");
    return;
  }
  console.error(
    `Error: unknown subcommand '${cmd}'. Expected: render-review-report | render-comment | aggregate-verdicts | rank-prs`,
  );
  process.exit(1);
}

if (import.meta.main) {
  main();
}
