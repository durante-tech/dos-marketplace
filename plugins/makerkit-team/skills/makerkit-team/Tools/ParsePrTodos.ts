#!/usr/bin/env bun
// ParsePrTodos.ts — parse a GitHub PR comment markdown checklist into typed Todo[].
//
// Input format (one todo per line, order preserved):
//   - [ ] (agent:Backend) (priority:high) (file:apps/web/auth/action.ts:42) Move auth check
//   - [x] (agent:DB) (priority:medium) Add organizationId index
//   - [ ] (agent:E2E) (priority:low) Add Playwright spec <!-- blocked: needs PR-A merge first -->
//
// Required fields per row: agent, priority, description.
// Optional fields per row: file (path:line), blocked (reason from HTML comment).
// Done state from `[x]` mark; blocked state from `<!-- blocked: ... -->` comment.
//
// Malformed rows (missing agent/priority, or non-checklist lines) are SKIPPED
// silently — keeps the parser robust against operator-edited comments and
// reviewer-agent freeform text mixed into the checklist.

export type AgentId =
  | 'pm' | 'sm' | 'ux' | 'ui' | 'architect' | 'frontend' | 'backend'
  | 'database' | 'security' | 'qa' | 'e2e' | 'devops' | 'writer';

export type Priority = 'high' | 'medium' | 'low';

export interface Todo {
  agent: AgentId;
  priority: Priority;
  description: string;
  file?: string;
  done: boolean;
  blocked?: string;
}

const VALID_AGENTS: ReadonlySet<AgentId> = new Set([
  'pm', 'sm', 'ux', 'ui', 'architect', 'frontend', 'backend',
  'database', 'security', 'qa', 'e2e', 'devops', 'writer',
]);

const VALID_PRIORITIES: ReadonlySet<Priority> = new Set(['high', 'medium', 'low']);

// Regex captures: 1=mark ( |x), 2=full body
const ROW = /^\s*-\s\[([ x])\]\s+(.+)$/;
const AGENT_TAG = /\(agent:\s*([A-Za-z][A-Za-z0-9]*)\s*\)/i;
const PRIORITY_TAG = /\(priority:\s*(high|medium|low)\s*\)/i;
const FILE_TAG = /\(file:\s*([^)]+?)\s*\)/i;
const BLOCKED_HTML = /<!--\s*blocked:\s*(.+?)\s*-->/i;

export function parseTodos(markdown: string): Todo[] {
  const out: Todo[] = [];
  for (const rawLine of markdown.split('\n')) {
    const m = rawLine.match(ROW);
    if (!m) continue;
    const mark = m[1] as ' ' | 'x';
    const body = m[2]!;
    const agentMatch = body.match(AGENT_TAG);
    const prioMatch = body.match(PRIORITY_TAG);
    if (!agentMatch || !prioMatch) continue;
    const agent = agentMatch[1]!.toLowerCase() as AgentId;
    if (!VALID_AGENTS.has(agent)) continue;
    const priority = prioMatch[1]!.toLowerCase() as Priority;
    if (!VALID_PRIORITIES.has(priority)) continue;
    const fileMatch = body.match(FILE_TAG);
    const blockedMatch = body.match(BLOCKED_HTML);
    const description = body
      .replace(AGENT_TAG, '')
      .replace(PRIORITY_TAG, '')
      .replace(FILE_TAG, '')
      .replace(BLOCKED_HTML, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!description) continue;
    out.push({
      agent,
      priority,
      description,
      ...(fileMatch ? { file: fileMatch[1]!.trim() } : {}),
      done: mark === 'x',
      ...(blockedMatch ? { blocked: blockedMatch[1]!.trim() } : {}),
    });
  }
  return out;
}

// CLI entry: read markdown from stdin, emit JSON to stdout.
//   cat comment.md | bun ParsePrTodos.ts
if (import.meta.main) {
  const { readStdin } = await import('./_shared');
  const md = await readStdin();
  process.stdout.write(JSON.stringify(parseTodos(md), null, 2) + '\n');
}
