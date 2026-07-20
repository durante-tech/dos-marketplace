// Shared primitives for the PR review-execute loop helpers.
// Pure functions, zero I/O state. Importable from ParsePrTodos / ClassifyPrShape /
// RenderTodoComment and any future tool that needs the same surface.

export function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (c) => chunks.push(c as Buffer));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

// Discriminated union — captures the 4 verdict shapes the workflow aggregator emits.
// PASS allows optional detail; BLOCK requires a reason; CHANGES carries severity.
export type Verdict =
  | { kind: 'PASS'; detail?: string }
  | { kind: 'BLOCK'; reason: string }
  | { kind: 'CHANGES'; severity: 'minor' | 'substantial' };

export function formatVerdict(v: Verdict | string): string {
  // The execution-status path (buildRenderPayload) supplies a pre-formatted string
  // (e.g. "Execution: 1/3 done, 1 blocked"); the PR-review path supplies a Verdict union.
  if (typeof v === 'string') return v;
  switch (v.kind) {
    case 'PASS':
      return v.detail ? `PASS — ${v.detail}` : 'PASS — ready to merge after CI green';
    case 'BLOCK':
      return `BLOCK — ${v.reason}`;
    case 'CHANGES':
      return `CHANGES — ${v.severity}`;
  }
}

// ---------------------------------------------------------------------------
// Vacuous-input contract for gate subcommands.
//
// A gate given ZERO items to verify must never exit 0 (a silent PASS over
// nothing is how vacuous evidence sneaks into a PRD). Gates exit EXIT_VACUOUS
// (distinct from 1 = gate failed and 2 = usage error) with a stderr message.
// ---------------------------------------------------------------------------

export const EXIT_VACUOUS = 3;

export function vacuousMessage(gate: string, what: string): string {
  return `VACUOUS: ${gate} — 0 ${what} to verify; gate did not run`;
}

// ---------------------------------------------------------------------------
// findMissingUnitTests — the ONE unit-sibling pyramid heuristic (TV-5).
//
// Canonical spec (_test-pyramid-gate.md "QA + E2E Pyramid Reviewer Framing" +
// ReviewOpenPRs.md Phase 4 qa row, union of the two): for every changed source
// file under packages/** with a .ts OR .tsx extension — excluding test files
// (.test.*, .spec.*, anything already inside __tests__/), declaration files
// (.d.ts), and config files (*.config.*) — that lacks a sibling
// __tests__/<name>.test.ts IN THE SAME changed set, emit one byte-faithful
// QA TODO. File-level heuristic only — no branch-coverage parsing.
//
// The TODO's target path and the existence check are computed from the SAME
// sibling path (audit fix: one consumer previously pointed the TODO at the
// package-root __tests__/ while checking the adjacent dir).
// Both MakerkitCli pyramid-missing-tests and ReviewOpenPRsCli qa-gaps consume
// this function — the spec lives here and nowhere else.
// ---------------------------------------------------------------------------

// X.ts / X.tsx -> <dir>/__tests__/X.test.ts (File Conventions table,
// _test-pyramid-gate.md: unit tests are always .test.ts, adjacent __tests__/).
export function unitSiblingPath(path: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash);
  const file = slash === -1 ? path : path.slice(slash + 1);
  const base = file.replace(/\.tsx?$/, '');
  return (dir ? `${dir}/` : '') + `__tests__/${base}.test.ts`;
}

function isUnitSource(path: string): boolean {
  if (!path.startsWith('packages/')) return false;
  if (!/\.tsx?$/.test(path)) return false;
  if (path.endsWith('.d.ts')) return false;
  if (/\.(test|spec)\.tsx?$/.test(path)) return false;
  if (path.includes('/__tests__/')) return false;
  if (/\.config\.[^/]+$/.test(path)) return false;
  return true;
}

export interface MissingUnitTest {
  source: string; // the changed source file
  sibling: string; // the expected __tests__/<name>.test.ts path
  todo: string; // byte-faithful "- [ ] (agent:qa) ..." checklist row
}

export interface MissingUnitTestsResult {
  ok: boolean;
  sourcesChecked: number;
  missing: MissingUnitTest[];
  todos: string[]; // missing[].todo, kept for consumer convenience
}

export interface FindMissingUnitTestsOptions {
  // Files known to exist OUTSIDE the changed set (e.g. already on disk).
  extraPresent?: readonly string[];
}

export function findMissingUnitTests(
  changedFiles: readonly string[],
  opts: FindMissingUnitTestsOptions = {},
): MissingUnitTestsResult {
  const present = new Set([...changedFiles, ...(opts.extraPresent ?? [])]);
  const sources = changedFiles.filter(isUnitSource).sort();
  const missing: MissingUnitTest[] = [];
  for (const source of sources) {
    const sibling = unitSiblingPath(source);
    if (present.has(sibling)) continue;
    // TODO dir + module name derive from the SAME sibling path the check used.
    const cut = sibling.lastIndexOf('/');
    const todoDir = sibling.slice(0, cut + 1); // "<dir>/__tests__/"
    const moduleName = sibling.slice(cut + 1).replace(/\.test\.ts$/, '');
    missing.push({
      source,
      sibling,
      todo: `- [ ] (agent:qa) (priority:high) Add Vitest unit test for ${moduleName} in ${todoDir}`,
    });
  }
  return {
    ok: missing.length === 0,
    sourcesChecked: sources.length,
    missing,
    todos: missing.map((m) => m.todo),
  };
}
