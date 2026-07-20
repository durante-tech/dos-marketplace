#!/usr/bin/env bun
// ReviewOpenPRsCli.ts — deterministic helpers for the ReviewOpenPRs workflow.
//
// Phase 8 of ReviewOpenPRs.md resolves the ARTIFACTS dir (project-first, global
// fallback), writes makerkit-pr-{N}-todos.json, then appends an index line to
// artifacts.jsonl. The two deterministic pieces are extracted here:
//
//   - renderArtifactIndexEntry() — build the artifacts.jsonl index line (field
//     set + order, 500-char contentPreview truncation) as the prose echo did.
//   - writeArtifactJson() — the I/O orchestration (resolve dir, mkdir, write the
//     canonical JSON, append the index line). Reuses resolveArtifactsDir from
//     ExecuteOpenTodos.ts so the fallback chain lives in exactly one place.
//
// The prose echo (ReviewOpenPRs.md Phase 8) emitted a single-line JSON object with
// keys in this order: timestamp, pack, workflow, type, title, path, contentPreview,
// wing, sessionId. The contentPreview was the first 500 chars of the artifact JSON
// with embedded double-quotes backslash-escaped. JSON.stringify reproduces both the
// quote-escaping and the key order (insertion order) deterministically.

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveArtifactsDir } from './ExecuteOpenTodos';
import { findMissingUnitTests, vacuousMessage, EXIT_VACUOUS } from './_shared';

// ---------------------------------------------------------------------------
// Phase 2 — Filter & Rank (B5 gate/predicate)
//
// Relocates the Phase 2 prose conditional out of ReviewOpenPRs.md:
//   1. Skip isDraft unless --include-drafts
//   2. Skip updatedAt > 30d ago unless --include-stale
//   3. Tag CI state: green / red / pending / none from statusCheckRollup
//   4. Tag size: small (<50 lines), medium (50-500), large (>500)
//   Rank: red CI first, then large diffs, then oldest, then everything else.
//
// The line-count for size comes from the agent (gh pr diff | wc -l) and is passed
// in; everything else (skip predicates, CI tag, size bucket, rank order) is pure.
// ---------------------------------------------------------------------------

export type CiState = 'green' | 'red' | 'pending' | 'none';
export type PrSize = 'small' | 'medium' | 'large';

// One PR row as returned by `gh pr list --json ...` (only the fields the
// filter/rank reads). statusCheckRollup is the raw gh shape (array of check
// entries with a `conclusion`/`state`), reduced to a CiState by tagCiState.
export interface PrCheckEntry {
  // gh emits StatusContext (state) and CheckRun (conclusion/status) entries.
  conclusion?: string | null;
  state?: string | null;
  status?: string | null;
}

export interface RawPr {
  number: number;
  title?: string;
  isDraft?: boolean;
  updatedAt: string; // ISO-8601
  statusCheckRollup?: PrCheckEntry[] | null;
  // diffLineCount supplied by the agent (gh pr diff {N} --patch | wc -l).
  diffLineCount?: number;
}

export interface FilterRankOptions {
  includeDrafts?: boolean;
  includeStale?: boolean;
  now?: number; // epoch ms; defaults to Date.now() — injectable for tests
}

export interface RankedPr {
  number: number;
  ci: CiState;
  size: PrSize;
  updatedAt: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Stale when updatedAt is strictly more than 30 days before `now`.
export function isStale(updatedAt: string, now: number): boolean {
  return now - new Date(updatedAt).getTime() > THIRTY_DAYS_MS;
}

// Reduce the gh statusCheckRollup array to one CiState.
//   any failure/error  -> red
//   else any pending/in-progress/queued -> pending
//   else any success    -> green
//   else (empty/no checks) -> none
export function tagCiState(rollup: PrCheckEntry[] | null | undefined): CiState {
  if (!rollup || rollup.length === 0) return 'none';
  const norm = (e: PrCheckEntry) =>
    (e.conclusion ?? e.state ?? e.status ?? '').toString().toLowerCase();
  const states = rollup.map(norm);
  if (states.some((s) => s === 'failure' || s === 'error' || s === 'failing' || s === 'cancelled' || s === 'timed_out'))
    return 'red';
  if (states.some((s) => s === 'pending' || s === 'in_progress' || s === 'queued' || s === 'waiting' || s === 'expected'))
    return 'pending';
  if (states.some((s) => s === 'success' || s === 'neutral' || s === 'skipped')) return 'green';
  return 'none';
}

// Size bucket from the diff line count. <50 small, 50-500 medium, >500 large.
export function tagSize(diffLineCount: number | undefined): PrSize {
  const n = diffLineCount ?? 0;
  if (n < 50) return 'small';
  if (n <= 500) return 'medium';
  return 'large';
}

// Rank weight for the primary sort key: red CI first, then large diffs.
// Lower weight sorts earlier. Within a tie, oldest updatedAt sorts first.
const CI_RANK: Record<CiState, number> = { red: 0, green: 2, pending: 2, none: 2 };
const SIZE_RANK: Record<PrSize, number> = { large: 0, medium: 1, small: 2 };

// Filter (drop drafts/stale per flags), tag CI + size, and rank.
// Rank order: red CI first; then larger diffs; then oldest updatedAt; then PR number.
export function filterAndRankPRs(prs: readonly RawPr[], opts: FilterRankOptions = {}): RankedPr[] {
  const now = opts.now ?? Date.now();
  const kept: RankedPr[] = [];
  for (const pr of prs) {
    if (pr.isDraft && !opts.includeDrafts) continue;
    if (isStale(pr.updatedAt, now) && !opts.includeStale) continue;
    kept.push({
      number: pr.number,
      ci: tagCiState(pr.statusCheckRollup),
      size: tagSize(pr.diffLineCount),
      updatedAt: pr.updatedAt,
    });
  }
  kept.sort((a, b) => {
    // 1. red CI first
    if (CI_RANK[a.ci] !== CI_RANK[b.ci]) return CI_RANK[a.ci] - CI_RANK[b.ci];
    // 2. larger diffs first
    if (SIZE_RANK[a.size] !== SIZE_RANK[b.size]) return SIZE_RANK[a.size] - SIZE_RANK[b.size];
    // 3. oldest updatedAt first
    const ta = new Date(a.updatedAt).getTime();
    const tb = new Date(b.updatedAt).getTime();
    if (ta !== tb) return ta - tb;
    // 4. deterministic final tiebreak
    return a.number - b.number;
  });
  return kept;
}

// ---------------------------------------------------------------------------
// Phase 4 — Pyramid completeness file-level heuristics (B5 gate/predicate)
//
// Relocates the Phase 4 QA + E2E pyramid prose out of ReviewOpenPRs.md /
// _test-pyramid-gate.md. File-level heuristic ONLY (no branch-coverage parsing):
//   - QA  : every changed source file under packages/** (.ts AND .tsx) that
//           lacks a sibling __tests__/<basename>.test.ts -> emit a unit-test
//           TODO. The heuristic lives in _shared.findMissingUnitTests, shared
//           with MakerkitCli pyramid-missing-tests (TV-5).
//   - E2E : every new user-facing flow file (apps/web/**/page.tsx or
//           apps/web/**/_components/<form>) whose feature segment has no
//           apps/e2e/tests/<feature>/ spec present in the changed set -> emit a
//           Playwright-spec TODO.
//
// The functions take the changed-file path set and return TODO strings in the
// exact `(agent:X) (priority:high) ...` markdown form the prose specified.
// ---------------------------------------------------------------------------

// The sibling unit-test path for a given source file:
//   packages/x/src/a/b/foo.ts -> packages/x/src/a/b/__tests__/foo.test.ts
// Re-exported from _shared so the path rule has exactly one definition.
export { unitSiblingPath as siblingUnitTestPath } from './_shared';

// QA pyramid gaps: changed source files under packages/** missing a sibling
// __tests__ test. `changed` is the full diff file set (so we can tell whether the
// test sibling was added in the same PR). Returns TODO strings, sorted by path.
// The TODO's target dir is computed by the SAME function that checks existence.
export function checkQAPyramidGaps(changed: readonly string[]): string[] {
  return findMissingUnitTests(changed).todos;
}

// Extract the feature segment of a user-facing file:
//   apps/web/app/(app)/billing/page.tsx -> billing
//   apps/web/app/(app)/team/_components/invite-form.tsx -> team
// Returns null when the path is not a user-facing flow file.
export function userFacingFeature(path: string): string | null {
  const isPage = /^apps\/web\/.*\/page\.tsx$/.test(path);
  const isComponentForm =
    /^apps\/web\/.*\/_components\/.*$/.test(path) && /form/i.test(path);
  if (!isPage && !isComponentForm) return null;
  // feature = the last path segment before page.tsx, or before _components/.
  if (isPage) {
    const segs = path.split('/');
    return segs[segs.length - 2] ?? null;
  }
  const m = path.match(/^apps\/web\/.*\/([^/]+)\/_components\//);
  return m ? m[1] : null;
}

// E2E pyramid gaps: new user-facing flow files whose feature has no
// apps/e2e/tests/<feature>/ spec in the changed set. One TODO per feature.
export function checkE2EPyramidGaps(changed: readonly string[]): string[] {
  const features = new Set<string>();
  for (const path of changed) {
    const f = userFacingFeature(path);
    if (f) features.add(f);
  }
  const hasSpec = (feature: string) =>
    changed.some((p) => p.startsWith(`apps/e2e/tests/${feature}/`));
  const todos: string[] = [];
  for (const feature of [...features].sort()) {
    if (hasSpec(feature)) continue;
    todos.push(
      `- [ ] (agent:e2e) (priority:high) Add Playwright spec for ${feature} in apps/e2e/tests/${feature}/`,
    );
  }
  return todos;
}

// ---------------------------------------------------------------------------
// Phase 5 — Verdict aggregation (B5 gate/predicate)
//
// Relocates the Phase 5 aggregation rules out of ReviewOpenPRs.md:
//   All PASS                -> "PASS — ready to merge after CI green"
//   Any BLOCK               -> "BLOCK — see {reviewer} reasoning"
//   Mixed PASS / CHANGES    -> "CHANGES — minor"
//   All CHANGES             -> "CHANGES — substantial"
// ---------------------------------------------------------------------------

export type ReviewerVerdict = 'PASS' | 'CHANGES' | 'BLOCK';

export interface ReviewerOutcome {
  reviewer: string;
  verdict: ReviewerVerdict;
}

export interface TeamVerdict {
  kind: 'PASS' | 'CHANGES' | 'BLOCK';
  detail: string; // "minor" | "substantial" for CHANGES, reviewer for BLOCK
  line: string; // the operator-facing rendered string
}

export function aggregateReviewVerdicts(outcomes: readonly ReviewerOutcome[]): TeamVerdict {
  const verdicts = outcomes.map((o) => o.verdict);
  const blocker = outcomes.find((o) => o.verdict === 'BLOCK');
  if (blocker) {
    return {
      kind: 'BLOCK',
      detail: blocker.reviewer,
      line: `BLOCK — see ${blocker.reviewer} reasoning`,
    };
  }
  const allPass = verdicts.length > 0 && verdicts.every((v) => v === 'PASS');
  if (allPass) {
    return { kind: 'PASS', detail: '', line: 'PASS — ready to merge after CI green' };
  }
  const allChanges = verdicts.length > 0 && verdicts.every((v) => v === 'CHANGES');
  if (allChanges) {
    return { kind: 'CHANGES', detail: 'substantial', line: 'CHANGES — substantial' };
  }
  // Mixed PASS / CHANGES (no BLOCK, not all-PASS, not all-CHANGES).
  return { kind: 'CHANGES', detail: 'minor', line: 'CHANGES — minor' };
}

// ---------------------------------------------------------------------------
// Phase 9 — Merge gate (B5 gate/predicate)
//
// Relocates the Phase 9 merge-eligibility conditional out of ReviewOpenPRs.md:
//   surface the merge AskUserQuestion only for PRs where
//     team verdict == PASS  AND  CI == green  AND  author is current user.
// Pure boolean — the actual `gh pr merge` stays gated behind AskUserQuestion in
// the workflow. This only decides which PRs are OFFERED as merge options.
// ---------------------------------------------------------------------------

export interface MergeGateInput {
  teamVerdictKind: 'PASS' | 'CHANGES' | 'BLOCK';
  ci: CiState;
  author: string;
  currentUser: string;
}

export interface MergeGateResult {
  eligible: boolean;
  reasons: string[]; // why NOT eligible (empty when eligible)
}

export function validateMergeGates(input: MergeGateInput): MergeGateResult {
  const reasons: string[] = [];
  if (input.teamVerdictKind !== 'PASS') reasons.push(`team verdict is ${input.teamVerdictKind}, not PASS`);
  if (input.ci !== 'green') reasons.push(`CI is ${input.ci}, not green`);
  if (input.author !== input.currentUser) reasons.push('PR author is not the current user');
  return { eligible: reasons.length === 0, reasons };
}

// The index entry shape, in the exact key order the prose echo produced.
export interface ArtifactIndexEntry {
  timestamp: string;
  pack: 'MakerkitTeam';
  workflow: 'ReviewOpenPRs';
  type: 'pr-todo-list';
  title: string;
  path: string;
  contentPreview: string;
  wing: string;
  sessionId: string;
}

export interface IndexEntryInput {
  prNumber: number;
  artifactJson: string; // raw artifact JSON string (contentPreview source)
  artifactPath: string; // absolute path written
  timestamp: string; // ISO-8601 UTC (date -u +%Y-%m-%dT%H:%M:%SZ)
  sessionId: string;
  wing?: string;
}

// Build the artifacts.jsonl index entry. contentPreview is the first 500 chars of
// the artifact JSON (matching `head -c 500`); JSON.stringify handles the quote
// escaping the prose did manually with `sed 's/"/\\"/g'`.
export function renderArtifactIndexEntry(input: IndexEntryInput): ArtifactIndexEntry {
  return {
    timestamp: input.timestamp,
    pack: 'MakerkitTeam',
    workflow: 'ReviewOpenPRs',
    type: 'pr-todo-list',
    title: `PR #${input.prNumber} team review`,
    path: input.artifactPath,
    contentPreview: input.artifactJson.slice(0, 500),
    wing: input.wing ?? 'general',
    sessionId: input.sessionId,
  };
}

// Serialize the index entry to the single-line JSONL form the prose appended.
export function renderArtifactIndexLine(input: IndexEntryInput): string {
  return JSON.stringify(renderArtifactIndexEntry(input));
}

export interface WriteArtifactResult {
  artifactsDir: string;
  artifactPath: string;
  indexLine: string;
}

// I/O orchestration: resolve dir, mkdir -p, write canonical artifact, append the
// index line. Mirrors ReviewOpenPRs.md Phase 8 step-for-step.
export function writeArtifactJson(input: {
  prNumber: number;
  artifactJson: string;
  timestamp: string;
  sessionId: string;
  wing?: string;
  projectDir?: string;
  home?: string;
}): WriteArtifactResult {
  const artifactsDir = resolveArtifactsDir(input.projectDir, input.home);
  if (!existsSync(artifactsDir)) mkdirSync(artifactsDir, { recursive: true });
  const artifactPath = join(artifactsDir, `makerkit-pr-${input.prNumber}-todos.json`);
  // Pack-specific artifact; tracking is the custom golden-tested renderArtifactIndexLine()
  // appended just below (mirrors ReviewOpenPRs.md Phase 8), not the generic helper.
  // writeArtifact:exempt — custom pack index-line tracking appended below
  writeFileSync(artifactPath, input.artifactJson);
  const indexLine = renderArtifactIndexLine({
    prNumber: input.prNumber,
    artifactJson: input.artifactJson,
    artifactPath,
    timestamp: input.timestamp,
    sessionId: input.sessionId,
    wing: input.wing,
  });
  appendFileSync(join(artifactsDir, 'artifacts.jsonl'), indexLine + '\n');
  return { artifactsDir, artifactPath, indexLine };
}

// CLI entry: subcommand dispatch. The default (no subcommand) is the Phase 8
// artifact write, preserving back-compat with the prose's piped jq invocation.
//
//   echo '{"prNumber":42,"artifactJson":"{...}","sessionId":"..."}' | bun ReviewOpenPRsCli.ts
//   echo '{"prs":[...],"includeDrafts":false}' | bun ReviewOpenPRsCli.ts filter-rank   -> RankedPr[]
//   echo '["packages/x/src/a.ts",...]'         | bun ReviewOpenPRsCli.ts qa-gaps        -> TODO lines
//   echo '["apps/web/.../page.tsx",...]'       | bun ReviewOpenPRsCli.ts e2e-gaps       -> TODO lines
//   echo '[{"reviewer":"qa","verdict":"PASS"}]'| bun ReviewOpenPRsCli.ts aggregate      -> TeamVerdict
//   echo '{"teamVerdictKind":"PASS",...}'      | bun ReviewOpenPRsCli.ts merge-gate     -> MergeGateResult
//
// Vacuous-input contract: a gate subcommand given zero items to verify exits
// EXIT_VACUOUS (3) with a stderr message — never a silent 0.
if (import.meta.main) {
  const { readStdin } = await import('./_shared');
  const sub = process.argv[2];
  const raw = await readStdin();
  const vacuous = (gate: string, what: string): never => {
    process.stderr.write(vacuousMessage(gate, what) + '\n');
    process.exit(EXIT_VACUOUS);
  };
  if (sub === 'filter-rank') {
    const input = JSON.parse(raw);
    const ranked = filterAndRankPRs(input.prs ?? input, {
      includeDrafts: input.includeDrafts,
      includeStale: input.includeStale,
      now: input.now,
    });
    process.stdout.write(JSON.stringify(ranked, null, 2) + '\n');
  } else if (sub === 'qa-gaps') {
    const paths = JSON.parse(raw) as string[];
    if (!Array.isArray(paths) || paths.length === 0) vacuous('qa-gaps', 'changed paths');
    process.stdout.write(checkQAPyramidGaps(paths).join('\n') + '\n');
  } else if (sub === 'e2e-gaps') {
    const paths = JSON.parse(raw) as string[];
    if (!Array.isArray(paths) || paths.length === 0) vacuous('e2e-gaps', 'changed paths');
    process.stdout.write(checkE2EPyramidGaps(paths).join('\n') + '\n');
  } else if (sub === 'aggregate') {
    const outcomes = JSON.parse(raw) as ReviewerOutcome[];
    if (!Array.isArray(outcomes) || outcomes.length === 0) {
      vacuous('aggregate', 'reviewer outcomes');
    }
    process.stdout.write(JSON.stringify(aggregateReviewVerdicts(outcomes), null, 2) + '\n');
  } else if (sub === 'merge-gate') {
    const input = JSON.parse(raw) as MergeGateInput;
    if (!input || typeof input !== 'object' || Object.keys(input).length === 0) {
      vacuous('merge-gate', 'merge inputs');
    }
    const result = validateMergeGates(input);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (!result.eligible) process.exit(1);
  } else {
    const input = JSON.parse(raw);
    const timestamp =
      input.timestamp ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const result = writeArtifactJson({
      prNumber: input.prNumber,
      artifactJson: input.artifactJson,
      timestamp,
      sessionId: input.sessionId ?? process.env.CLAUDE_SESSION_ID ?? '',
      wing: input.wing,
    });
    process.stdout.write(result.artifactPath + '\n');
  }
}
