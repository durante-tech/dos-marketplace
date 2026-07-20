#!/usr/bin/env bun
// ClassifyPrShape.ts — map PR file paths to which starter-native FastAPIStarterTeam
// reviewer agents should be spawned. Pure function, no I/O.
//
// Input: array of file paths (relative to dos-fastapi-starter repo root).
// Output: ReviewerSet — Set<AgentId> indicating which roles must review.
//
// Lens table (Python/FastAPI flavor — sibling to MakerkitTeam ClassifyPrShape):
//   1. database  — src/app/models/**, src/migrations/**
//   2. backend   — src/app/api/v1/**, src/app/crud/**, src/app/middleware/**, src/app/core/security*
//   3. agent     — src/app/agents/** (Pydantic AI Agent surface)
//   4. schema    — src/app/schemas/** (Pydantic v2 DTOs)
//   5. e2e       — tests/integration/**
//   6. qa        — tests/unit/**, tests/conftest.py, tests/helpers/**
//   7. devops    — scripts/**, .github/**, Dockerfile*, docker-compose*, tooling/mcp_server/**, pyproject.toml, uv.lock, .env.example, alembic.ini
//   8. writer    — *.md, *.mdoc, docs/**, mkdocs.yml, AGENTS.md
//   9. apidx     — auto-added when new routes appear (router file under src/app/api/v1/) — handled at lens 2
//  10. fallback  — PM + QA when no lens matched
//  11. crosscut  — full 13-agent team when ≥3 distinct top-level src/app/ subdirs touched
//
// Lens contributions accumulate: a PR touching models + api/v1 gets
// database + backend + security + qa.

import type { AgentId } from './ParsePrTodos';

export type ReviewerSet = Set<AgentId>;

const ALL_AGENTS: readonly AgentId[] = [
  'pm', 'sm', 'apidx', 'schema', 'architect', 'agent', 'backend',
  'database', 'security', 'qa', 'e2e', 'devops', 'writer',
];

interface Lens {
  id: string;
  match: (path: string) => boolean;
  contributes: readonly AgentId[];
}

const LENSES: readonly Lens[] = [
  {
    id: 'database',
    match: (p) =>
      p.startsWith('src/app/models/') ||
      p.startsWith('src/migrations/') ||
      p === 'src/alembic.ini',
    contributes: ['database', 'backend', 'security'],
  },
  {
    id: 'backend-api',
    match: (p) =>
      p.startsWith('src/app/api/') ||
      p.startsWith('src/app/crud/') ||
      p.startsWith('src/app/middleware/') ||
      /^src\/app\/core\/security(\.|\/)/.test(p),
    contributes: ['backend', 'apidx', 'security', 'architect'],
  },
  {
    id: 'agent-engineer',
    match: (p) => p.startsWith('src/app/agents/'),
    contributes: ['agent', 'apidx', 'security', 'architect'],
  },
  {
    id: 'schema',
    match: (p) => p.startsWith('src/app/schemas/'),
    contributes: ['schema', 'apidx', 'backend'],
  },
  {
    id: 'integration-tests',
    match: (p) => p.startsWith('tests/integration/'),
    contributes: ['e2e', 'qa'],
  },
  {
    id: 'unit-tests',
    match: (p) =>
      p.startsWith('tests/unit/') ||
      p === 'tests/conftest.py' ||
      p.startsWith('tests/helpers/'),
    contributes: ['qa'],
  },
  {
    id: 'devops',
    match: (p) =>
      p.startsWith('scripts/') ||
      p.startsWith('.github/') ||
      /(^|\/)Dockerfile($|\.)/.test(p) ||
      /(^|\/)docker-compose(\.|$)/.test(p) ||
      p.startsWith('tooling/mcp_server/') ||
      p === 'pyproject.toml' ||
      p === 'uv.lock' ||
      p === '.env.example' ||
      p === 'Makefile',
    contributes: ['devops', 'architect'],
  },
  {
    id: 'docs',
    match: (p) =>
      p.endsWith('.md') ||
      p.endsWith('.mdoc') ||
      p.startsWith('docs/') ||
      p === 'mkdocs.yml',
    contributes: ['writer'],
  },
];

function topLevelSubsystem(path: string): string | null {
  // src/app/<X>/, tests/<X>/, scripts/<X>/, tooling/<X>/, .github/<X>/, docs/, plus a few one-offs
  const m = path.match(/^src\/app\/([^/]+)\//);
  if (m) return `src/app/${m[1]}`;
  const t = path.match(/^tests\/([^/]+)\//);
  if (t) return `tests/${t[1]}`;
  const s = path.match(/^scripts\/([^/]+)\//);
  if (s) return `scripts/${s[1]}`;
  const tg = path.match(/^tooling\/([^/]+)\//);
  if (tg) return `tooling/${tg[1]}`;
  if (path.startsWith('docs/')) return 'docs';
  if (path.startsWith('.github/')) return '.github';
  if (path.startsWith('src/migrations/')) return 'src/migrations';
  return null;
}

export interface ClassifyResult {
  agents: ReviewerSet;
  matchedLenses: readonly string[];
  topLevelSubsystems: readonly string[];
  isCrosscut: boolean;
  isPureDocs: boolean;
}

export function classifyShape(filePaths: readonly string[]): ClassifyResult {
  const agents: ReviewerSet = new Set<AgentId>();
  const matched = new Set<string>();
  const subsystems = new Set<string>();
  let nonDocsCount = 0;

  for (const path of filePaths) {
    const sub = topLevelSubsystem(path);
    if (sub) subsystems.add(sub);
    let hit = false;
    for (const lens of LENSES) {
      if (lens.match(path)) {
        matched.add(lens.id);
        for (const a of lens.contributes) agents.add(a);
        hit = true;
        if (lens.id !== 'docs') nonDocsCount++;
        break;
      }
    }
    if (!hit) nonDocsCount++;
  }

  const isPureDocs = matched.size > 0 && [...matched].every((m) => m === 'docs') && nonDocsCount === 0;

  // Crosscut threshold: ≥3 distinct src/app/ subsystems
  const srcAppSubs = [...subsystems].filter((s) => s.startsWith('src/app/'));
  const isCrosscut = (srcAppSubs.length >= 3 || subsystems.size >= 4) && !isPureDocs;

  // QA always rides along on any non-docs change
  if (!isPureDocs && agents.size > 0) agents.add('qa');

  // Crosscut → full team
  if (isCrosscut) {
    for (const a of ALL_AGENTS) agents.add(a);
  }

  // Fallback: no lens matched and at least one path → PM + QA
  if (agents.size === 0 && filePaths.length > 0) {
    agents.add('pm');
    agents.add('qa');
  }

  return {
    agents,
    matchedLenses: [...matched],
    topLevelSubsystems: [...subsystems],
    isCrosscut,
    isPureDocs,
  };
}

// CLI entry: read newline-delimited paths from stdin, emit JSON.
//   git diff --name-only origin/main | bun ClassifyPrShape.ts
if (import.meta.main) {
  const { readStdin } = await import('./_shared');
  const input = await readStdin();
  const paths = input.split('\n').filter(Boolean);
  const result = classifyShape(paths);
  process.stdout.write(
    JSON.stringify(
      {
        agents: [...result.agents],
        matchedLenses: result.matchedLenses,
        topLevelSubsystems: result.topLevelSubsystems,
        isCrosscut: result.isCrosscut,
        isPureDocs: result.isPureDocs,
      },
      null,
      2,
    ) + '\n',
  );
}
