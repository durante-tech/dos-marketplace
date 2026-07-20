#!/usr/bin/env bun
// ClassifyPrShape.ts — map PR file paths to which kit-native MakerkitTeam
// reviewer agents should be spawned. Pure function, no I/O.
//
// Input: array of file paths (relative to repo root).
// Output: ReviewerSet — Set<AgentId> indicating which roles must review.
//
// Rules (priority order; first matching lens table row contributes its agents):
//   1. database  — packages/database/**
//   2. backend   — apps/web/**/*.action.ts, apps/web/**/server-actions/**
//   3. frontend  — apps/web/**/page.tsx, apps/web/**/layout.tsx, apps/web/**/_components/**
//   4. e2e       — apps/e2e/**
//   5. ui        — packages/ui/**
//   6. devops    — tooling/**, *.config.{ts,js,mjs,cjs}, .github/**, Dockerfile*
//   7. writer    — *.md, *.mdoc, docs/**
//   8. fallback  — PM + QA when no lens matched
//   9. crosscut  — full 13-agent team when ≥3 distinct top-level packages touched
//
// Lens contributions accumulate, so a PR touching schema.prisma + an action.ts
// gets database + backend + security (security auto-added when backend included).

import type { AgentId } from './ParsePrTodos';

export type ReviewerSet = Set<AgentId>;

const ALL_AGENTS: readonly AgentId[] = [
  'pm', 'sm', 'ux', 'ui', 'architect', 'frontend', 'backend',
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
    match: (p) => p.startsWith('packages/database/'),
    contributes: ['database', 'backend', 'security'],
  },
  {
    id: 'backend-action',
    match: (p) => /^apps\/web\/.*\.action\.ts$/.test(p) || /^apps\/web\/.*server-actions\//.test(p),
    contributes: ['backend', 'security', 'architect'],
  },
  {
    id: 'frontend-rsc',
    match: (p) =>
      /^apps\/web\/.*\/page\.tsx$/.test(p) ||
      /^apps\/web\/.*\/layout\.tsx$/.test(p) ||
      /^apps\/web\/.*\/_components\//.test(p),
    contributes: ['frontend', 'architect', 'ux'],
  },
  {
    id: 'e2e',
    match: (p) => p.startsWith('apps/e2e/'),
    contributes: ['e2e', 'qa'],
  },
  {
    id: 'ui',
    match: (p) => p.startsWith('packages/ui/'),
    contributes: ['ui', 'frontend'],
  },
  {
    id: 'devops',
    match: (p) =>
      p.startsWith('tooling/') ||
      /\.config\.(ts|js|mjs|cjs)$/.test(p) ||
      p.startsWith('.github/') ||
      /(^|\/)Dockerfile($|\.)/.test(p),
    contributes: ['devops', 'architect'],
  },
  {
    id: 'docs',
    match: (p) => p.endsWith('.md') || p.endsWith('.mdoc') || p.startsWith('docs/'),
    contributes: ['writer'],
  },
];

function topLevelPackage(path: string): string | null {
  // packages/<X>/, apps/<X>/, tooling/<X>/, docs, .github
  const m = path.match(/^(packages|apps|tooling)\/([^/]+)\//);
  if (m) return `${m[1]}/${m[2]}`;
  if (path.startsWith('docs/')) return 'docs';
  if (path.startsWith('.github/')) return '.github';
  return null;
}

export interface ClassifyResult {
  agents: ReviewerSet;
  matchedLenses: readonly string[];
  topLevelPackages: readonly string[];
  isCrosscut: boolean;
  isPureDocs: boolean;
}

export function classifyShape(filePaths: readonly string[]): ClassifyResult {
  const agents: ReviewerSet = new Set<AgentId>();
  const matched = new Set<string>();
  const packages = new Set<string>();
  let nonDocsCount = 0;

  for (const path of filePaths) {
    const pkg = topLevelPackage(path);
    if (pkg) packages.add(pkg);
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
  const isCrosscut = packages.size >= 3 && !isPureDocs;

  // QA always rides along on any non-docs change
  if (!isPureDocs && agents.size > 0) agents.add('qa');

  // Crosscut → full team
  if (isCrosscut) {
    for (const a of ALL_AGENTS) agents.add(a);
  }

  // Fallback: no lens matched and at least one path → PM + QA + relevant defaults
  if (agents.size === 0 && filePaths.length > 0) {
    agents.add('pm');
    agents.add('qa');
  }

  return {
    agents,
    matchedLenses: [...matched],
    topLevelPackages: [...packages],
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
        topLevelPackages: result.topLevelPackages,
        isCrosscut: result.isCrosscut,
        isPureDocs: result.isPureDocs,
      },
      null,
      2,
    ) + '\n',
  );
}
