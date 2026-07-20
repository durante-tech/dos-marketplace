#!/usr/bin/env bun
/**
 * VerifyDigest — assert FrameworkDigest.md's machine-checkable version/fact pins
 * against the live kit AGENTS.md, so the digest can't silently rot (it is sliced
 * into all 13 agent briefs by BuildBrief.ts, so its drift propagates verbatim).
 *
 * Verify-by-script, NOT regenerate-by-script: the digest's prose synthesis is
 * hand-curated and can't be deterministically regenerated, but its load-bearing
 * PINS (Prisma major, Base UI version, Next major, workspace count, …) are
 * extractable from AGENTS.md and checkable here.
 *
 * Usage:
 *   bun run VerifyDigest.ts [--kit-repo <path>] [--digest <path>] [--json]
 *   # exit 0 = N>0 pins verified; exit 1 = drift (or a pin missing from the
 *   # digest); exit 2 = VACUOUS (zero pins extractable — digest unverified)
 *
 * Kit repo resolution (ResolveRepo.ts): --kit-repo > $KIT_REPO > git toplevel
 * from cwd. No hardcoded machine paths.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { resolveKitRepo } from './ResolveRepo';
import { collectFacts, verifyDigestAgainstFacts } from './BuildDigest';

export interface PinCheck {
  name: string;
  /** value extracted from the live AGENTS.md, or null if not found there */
  live: string | null;
  /** the string the digest must contain when `live` is known */
  expected: string | null;
  /** true=present, false=drift, null=skipped (couldn't resolve live value) */
  ok: boolean | null;
}

export interface VerifyResult {
  checks: PinCheck[];
  ok: boolean; // false if ANY check is a hard drift (ok === false)
  driftCount: number;
  /** pins whose live value was extractable from AGENTS.md (ok !== null) */
  extractableCount: number;
  /** pins verified present in the digest (ok === true) */
  verifiedCount: number;
}

interface PinSpec {
  name: string;
  /** regex with one capture group, run against AGENTS.md */
  live: RegExp;
  /** build the string the digest must contain from the captured group */
  expected: (captured: string) => string;
}

/** The load-bearing pins. Add a row here when a new fact becomes brief-critical. */
export const PIN_SPECS: PinSpec[] = [
  { name: 'Prisma major', live: /Prisma (\d+)/, expected: (v) => `Prisma ${v}` },
  { name: 'Base UI version', live: /Base UI (\d+\.\d+(?:\.\d+)?)/, expected: (v) => `Base UI ${v}` },
  { name: 'Next.js version', live: /Next\.js (\d+\.\d+)/, expected: (v) => `Next.js ${v}` },
  { name: 'Better Auth version', live: /Better Auth (\d+\.\d+)/, expected: (v) => `Better Auth ${v}` },
  { name: 'zod major', live: /zod (\d+)/, expected: (v) => `zod ${v}` },
  { name: 'workspace count', live: /(\d+) workspaces/, expected: (v) => `${v} workspaces` },
  { name: 'Oxc toolchain', live: /oxlint \+ oxfmt/, expected: () => 'oxlint + oxfmt' },
];

/** Pure core — testable without filesystem. */
export function verifyDigest(digestText: string, agentsText: string): VerifyResult {
  const checks: PinCheck[] = PIN_SPECS.map((spec) => {
    const m = agentsText.match(spec.live);
    if (!m) return { name: spec.name, live: null, expected: null, ok: null };
    const captured = m[1] ?? m[0];
    const expected = spec.expected(captured);
    return {
      name: spec.name,
      live: captured,
      expected,
      ok: digestText.includes(expected),
    };
  });
  const driftCount = checks.filter((c) => c.ok === false).length;
  const extractableCount = checks.filter((c) => c.ok !== null).length;
  const verifiedCount = checks.filter((c) => c.ok === true).length;
  return { checks, ok: driftCount === 0, driftCount, extractableCount, verifiedCount };
}

function parseArgs(argv: string[]): { kitRepo?: string; digest?: string; json: boolean } {
  const out: { kitRepo?: string; digest?: string; json: boolean } = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--kit-repo') out.kitRepo = argv[++i];
    else if (a === '--digest') out.digest = argv[++i];
    else if (a === '--json') out.json = true;
  }
  return out;
}

function main(): void {
  const args = parseArgs(Bun.argv.slice(2));
  let kitRepo: string;
  try {
    kitRepo = resolveKitRepo(args.kitRepo).root;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  const digestPath = args.digest ?? resolve(import.meta.dir, '../FrameworkDigest.md');
  const agentsPath = join(kitRepo, 'AGENTS.md');

  if (!existsSync(digestPath)) {
    console.error(`FrameworkDigest not found: ${digestPath}`);
    process.exit(1);
  }
  if (!existsSync(agentsPath)) {
    console.error(`Kit AGENTS.md not found: ${agentsPath} (set $KIT_REPO or pass --kit-repo)`);
    process.exit(1);
  }

  const digestText = readFileSync(digestPath, 'utf8');
  let result: VerifyResult = verifyDigest(digestText, readFileSync(agentsPath, 'utf8'));
  if (result.extractableCount === 0) {
    // AGENTS.md carries no extractable pins (e.g. upstream next-prisma-kit):
    // fall back to repo-derived facts — the same source BuildDigest.ts writes
    // into the digest's generated region (catalog pins, workspace count,
    // toolchain). Only if THOSE are also underivable is the run VACUOUS.
    const factResult = verifyDigestAgainstFacts(digestText, collectFacts(kitRepo));
    if (factResult.extractableCount > 0) {
      console.error(
        `note: 0 pins extractable from ${agentsPath} — verified against repo-derived facts instead`,
      );
      result = factResult;
    }
  }
  const vacuous = result.extractableCount === 0;

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    if (vacuous) {
      console.error(`VACUOUS: 0 pins extractable from ${kitRepo} — digest unverified`);
    }
  } else {
    for (const c of result.checks) {
      const mark = c.ok === true ? 'OK  ' : c.ok === false ? 'DRIFT' : 'skip';
      const detail =
        c.ok === false
          ? `digest missing "${c.expected}" (live AGENTS.md says ${c.live})`
          : c.ok === null
            ? '(could not extract from AGENTS.md)'
            : c.expected;
      console.log(`  [${mark}] ${c.name}: ${detail}`);
    }
    console.log(
      vacuous
        ? `\nVACUOUS: 0 pins extractable from ${kitRepo} — digest unverified`
        : result.ok
          ? `\nFrameworkDigest pins are current (${result.verifiedCount} verified).`
          : `\n${result.driftCount} stale pin(s) — update FrameworkDigest.md then re-run.`,
    );
  }
  // exit 0 = N>0 pins verified; 1 = drift; 2 = vacuous (zero pins extractable).
  process.exit(vacuous ? 2 : result.ok ? 0 : 1);
}

if (import.meta.main) main();
