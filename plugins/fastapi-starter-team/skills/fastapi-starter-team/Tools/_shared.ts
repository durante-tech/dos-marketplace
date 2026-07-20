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

export function formatVerdict(v: Verdict): string {
  switch (v.kind) {
    case 'PASS':
      return v.detail ? `PASS — ${v.detail}` : 'PASS — ready to merge after CI green';
    case 'BLOCK':
      return `BLOCK — ${v.reason}`;
    case 'CHANGES':
      return `CHANGES — ${v.severity}`;
  }
}
