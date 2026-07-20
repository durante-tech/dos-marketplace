#!/usr/bin/env bun
// ExecuteOpenTodos.ts — deterministic helpers for the ExecuteOpenTodos workflow.
//
// resolvePrArtifact() relocates the Phase 1 "scan latest artifact" prose
// (formerly an `ls -t ... | head -1` + `sed` one-liner) into tested code.
//
// Behavior preserved from the prose it replaces:
//   - artifacts dir resolves project-first ($CLAUDE_PROJECT_DIR/MEMORY/ARTIFACTS),
//     falling back to the global ~/.claude/MEMORY/ARTIFACTS only if the project
//     dir does not exist
//   - candidates match the glob `makerkit-pr-*-todos.json`
//   - the *latest by modification time* wins (mirrors `ls -t | head -1`)
//   - the PR number is extracted from the basename `makerkit-pr-<N>-todos.json`
//   - no artifact found -> { found: false }, leaving the workflow to abort

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { AgentId, Priority } from './ParsePrTodos';

// Matches `makerkit-pr-<digits>-todos.json` and captures the PR number.
const ARTIFACT_NAME = /^makerkit-pr-(\d+)-todos\.json$/;

export interface ResolvedPrArtifact {
  found: boolean;
  artifactsDir: string;
  artifactPath?: string;
  prNumber?: number;
}

// Resolve the artifacts directory the same way the workflow prose did:
// project-scoped first, global fallback only when the project dir is absent.
export function resolveArtifactsDir(
  projectDir: string | undefined = process.env.CLAUDE_PROJECT_DIR,
  home: string = homedir(),
): string {
  const projectArtifacts = join(projectDir && projectDir.length ? projectDir : '.', 'MEMORY', 'ARTIFACTS');
  if (existsSync(projectArtifacts)) return projectArtifacts;
  return join(home, '.claude', 'MEMORY', 'ARTIFACTS');
}

// Find the latest makerkit-pr-*-todos.json artifact and pull its PR number.
// `latest` = highest mtimeMs, mirroring `ls -t | head -1`. Ties broken by
// descending filename so the result is deterministic when mtimes collide.
export function resolvePrArtifact(artifactsDir: string): ResolvedPrArtifact {
  if (!existsSync(artifactsDir)) {
    return { found: false, artifactsDir };
  }
  let best: { path: string; name: string; prNumber: number; mtimeMs: number } | undefined;
  for (const name of readdirSync(artifactsDir)) {
    const m = name.match(ARTIFACT_NAME);
    if (!m) continue;
    const path = join(artifactsDir, name);
    let mtimeMs: number;
    try {
      mtimeMs = statSync(path).mtimeMs;
    } catch {
      continue; // disappeared between readdir and stat — skip
    }
    const prNumber = Number(m[1]);
    if (
      !best ||
      mtimeMs > best.mtimeMs ||
      (mtimeMs === best.mtimeMs && name > best.name)
    ) {
      best = { path, name, prNumber, mtimeMs };
    }
  }
  if (!best) {
    return { found: false, artifactsDir };
  }
  return {
    found: true,
    artifactsDir,
    artifactPath: best.path,
    prNumber: best.prNumber,
  };
}

// ---------------------------------------------------------------------------
// Artifact-todo helpers — relocate the Phase 4/5/7 jq transforms into tested code.
//
// The artifact JSON (schema in Workflows/_pr-loop-shared.md) carries todos whose
// `blocked` field is either a string reason, null, or omitted — wider than the
// ParsePrTodos `Todo` (whose `blocked?` is string|undefined). ArtifactTodo models
// the on-disk shape exactly so the transforms preserve null-vs-omitted fidelity.
// ---------------------------------------------------------------------------

export interface ArtifactTodo {
  agent: AgentId;
  priority: Priority;
  description: string;
  file?: string;
  done: boolean;
  blocked?: string | null;
}

export interface TodoArtifact {
  todos: ArtifactTodo[];
  [key: string]: unknown;
}

// One agent batch produced by groupAndSortTodos.
export interface TodoBatch {
  agent: AgentId;
  todos: ArtifactTodo[];
}

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

// A todo is "pending" when it is not done and not blocked (blocked null/empty/omitted).
// Mirrors the Phase 4 jq predicate: `.done == false and (.blocked == null or .blocked == "")`.
function isPending(t: ArtifactTodo): boolean {
  return t.done === false && (t.blocked === null || t.blocked === undefined || t.blocked === '');
}

// Phase 4 — Group TODOs by Agent.
// Mirrors the jq pipeline exactly:
//   .todos
//   | map(select(.done == false and (.blocked == null or .blocked == "")))
//   | group_by(.agent)
//   | sort_by(- (map(priority->weight) | max))
//   | .[] | {agent: .[0].agent, todos: .}
//
// group_by(.agent) sorts groups by the group key first, then sort_by applies a
// STABLE sort on the descending max-priority weight. So ties in max-priority keep
// agent-key order. Both behaviors are reproduced here.
export function groupAndSortTodos(artifact: TodoArtifact): TodoBatch[] {
  const pending = artifact.todos.filter(isPending);
  // group_by(.agent): jq sorts by the grouping key, so emit groups in agent-key order.
  const byAgent = new Map<AgentId, ArtifactTodo[]>();
  for (const t of pending) {
    if (!byAgent.has(t.agent)) byAgent.set(t.agent, []);
    byAgent.get(t.agent)!.push(t);
  }
  const groups = [...byAgent.keys()]
    .sort() // jq group_by orders by key
    .map((agent) => ({ agent, todos: byAgent.get(agent)! }));
  // sort_by(- max-weight) — ascending sort on the negated max weight == descending
  // max weight. jq's sort is stable, so equal-weight groups keep agent-key order.
  const decorated = groups.map((g) => ({
    g,
    neg: -Math.max(...g.todos.map((t) => PRIORITY_WEIGHT[t.priority])),
  }));
  decorated.sort((a, b) => a.neg - b.neg);
  return decorated.map((d) => ({ agent: d.g.agent, todos: d.g.todos }));
}

// Phase 5 — Mark blocked TODOs on batch failure.
// Mirrors the jq transform:
//   .todos = (.todos | map(
//     if .agent == $agent and .done == false and (.blocked // "") == ""
//     then .blocked = $reason else . end))
//
// Returns a NEW artifact (does not mutate the input) with the matched todos'
// `blocked` set to `reason`. Note jq's `.blocked // ""` treats null AND omitted
// as empty, but NOT an explicit empty string already present (which also passes).
export function markTodosBlocked(
  artifact: TodoArtifact,
  agent: AgentId,
  reason: string,
): TodoArtifact {
  const todos = artifact.todos.map((t) => {
    const blockedEmpty = t.blocked === null || t.blocked === undefined || t.blocked === '';
    if (t.agent === agent && t.done === false && blockedEmpty) {
      return { ...t, blocked: reason };
    }
    return t;
  });
  return { ...artifact, todos };
}

// Phase 7 — Build JSON payload for RenderTodoComment.
// Mirrors the heredoc that builds:
//   { "todos": <artifact.todos>,
//     "meta": { "prNumber", "prTitle", "reviewers", "teamVerdict" } }
// where teamVerdict is the execution-status line "Execution: X/Y done, Z blocked".
//
// Counts: done = todos with done==true; total = all todos; blocked = todos with a
// non-empty blocked reason. The verdict string format is byte-preserved from the
// workflow prose ("Execution: $DONE_COUNT/$TOTAL_COUNT done, $BLOCKED_COUNT blocked").
export interface RenderCommentPayload {
  todos: ArtifactTodo[];
  meta: {
    prNumber: number;
    prTitle: string;
    reviewers: AgentId[];
    teamVerdict: string;
  };
}

export interface ArtifactWithMeta extends TodoArtifact {
  prNumber?: number;
  prTitle?: string;
  reviewers?: AgentId[];
}

export function buildRenderPayload(
  artifact: ArtifactWithMeta,
  prNumber: number,
): RenderCommentPayload {
  const total = artifact.todos.length;
  const done = artifact.todos.filter((t) => t.done === true).length;
  const blocked = artifact.todos.filter(
    (t) => t.blocked !== null && t.blocked !== undefined && t.blocked !== '',
  ).length;
  return {
    todos: artifact.todos,
    meta: {
      prNumber,
      prTitle: artifact.prTitle ?? '',
      reviewers: artifact.reviewers ?? [],
      teamVerdict: `Execution: ${done}/${total} done, ${blocked} blocked`,
    },
  };
}

// CLI entry: dispatch on the first argv when present, else print the resolved
// PR number to stdout (back-compat with `PR_NUMBER=$(bun ExecuteOpenTodos.ts)`).
//
// Subcommands (read JSON artifact from stdin):
//   bun ExecuteOpenTodos.ts group-todos             < artifact.json  -> TodoBatch[]
//   bun ExecuteOpenTodos.ts mark-blocked <agent> <reason> < artifact.json -> artifact
//   bun ExecuteOpenTodos.ts render-payload <prNumber>     < artifact.json -> payload
if (import.meta.main) {
  const sub = process.argv[2];
  if (sub === 'group-todos' || sub === 'mark-blocked' || sub === 'render-payload') {
    const { readStdin } = await import('./_shared');
    const artifact = JSON.parse(await readStdin()) as ArtifactWithMeta;
    if (sub === 'group-todos') {
      process.stdout.write(JSON.stringify(groupAndSortTodos(artifact), null, 2) + '\n');
    } else if (sub === 'mark-blocked') {
      const agent = process.argv[3] as AgentId;
      const reason = process.argv[4] ?? '';
      process.stdout.write(JSON.stringify(markTodosBlocked(artifact, agent, reason), null, 2) + '\n');
    } else {
      const prNumber = Number(process.argv[3]);
      process.stdout.write(JSON.stringify(buildRenderPayload(artifact, prNumber), null, 2) + '\n');
    }
  } else {
    const dir = resolveArtifactsDir();
    const resolved = resolvePrArtifact(dir);
    if (resolved.found) {
      process.stdout.write(String(resolved.prNumber) + '\n');
    } else {
      // empty stdout + nonzero exit so the workflow's "no artifact found" branch fires
      process.exit(1);
    }
  }
}
