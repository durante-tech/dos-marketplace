#!/usr/bin/env bun
/**
 * BuildWaves — derive dependency waves from a DAG of work-unit IDs.
 *
 * Pure, synchronous. Throws `CycleError` on cycle detection.
 *
 * Wave 0 = units with zero deps.
 * Wave N = units all of whose deps are in waves ≤ N-1.
 * Maximal parallelism inside a wave; strict gate across waves.
 *
 * CLI usage: `echo '{"W1":[],"W2":["W1"]}' | bun BuildWaves.ts`
 */

export type DepsMap = Record<string, string[]>;
export type WaveMap = string[][];

export class CycleError extends Error {
  readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`dependency cycle detected: ${cycle.join(" -> ")}`);
    this.name = "CycleError";
    this.cycle = cycle;
  }
}

/**
 * Partition a DAG into wave layers. Deterministic alphabetical sort within each wave.
 *
 * @param deps Mapping node -> list of predecessor node ids. Unknown predecessors
 *             are treated as nodes with empty deps (permissive, to tolerate
 *             partial DAGs from heuristic extraction).
 * @throws CycleError if a cycle is detected.
 */
export function buildWaves(deps: DepsMap): WaveMap {
  const nodes = new Set<string>();
  for (const [n, ds] of Object.entries(deps)) {
    nodes.add(n);
    for (const d of ds) nodes.add(d);
  }
  if (nodes.size === 0) return [];

  for (const [n, ds] of Object.entries(deps)) {
    if (ds.includes(n)) throw new CycleError([n, n]);
  }

  const remaining = new Map<string, Set<string>>();
  for (const n of nodes) {
    remaining.set(n, new Set(deps[n] ?? []));
  }

  const waves: WaveMap = [];
  while (remaining.size > 0) {
    const wave: string[] = [];
    for (const [n, ds] of remaining) {
      if (ds.size === 0) wave.push(n);
    }

    if (wave.length === 0) {
      throw new CycleError(findCycle(remaining));
    }

    wave.sort();
    waves.push(wave);

    for (const n of wave) remaining.delete(n);
    for (const ds of remaining.values()) {
      for (const done of wave) ds.delete(done);
    }
  }

  return waves;
}

function findCycle(remaining: Map<string, Set<string>>): string[] {
  const visited = new Set<string>();
  const stack: string[] = [];
  const inStack = new Set<string>();

  const dfs = (n: string): string[] | null => {
    if (inStack.has(n)) {
      const start = stack.indexOf(n);
      return stack.slice(start).concat(n);
    }
    if (visited.has(n)) return null;
    visited.add(n);
    inStack.add(n);
    stack.push(n);
    for (const d of remaining.get(n) ?? []) {
      const cycle = dfs(d);
      if (cycle) return cycle;
    }
    stack.pop();
    inStack.delete(n);
    return null;
  };

  for (const n of remaining.keys()) {
    const cycle = dfs(n);
    if (cycle) return cycle;
  }
  return Array.from(remaining.keys());
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

if (import.meta.main) {
  const input = await readStdin();
  const deps = JSON.parse(input) as DepsMap;
  try {
    process.stdout.write(JSON.stringify(buildWaves(deps), null, 2) + "\n");
  } catch (err) {
    if (err instanceof CycleError) {
      process.stderr.write(`CycleError: ${err.message}\n`);
      process.exit(3);
    }
    throw err;
  }
}
