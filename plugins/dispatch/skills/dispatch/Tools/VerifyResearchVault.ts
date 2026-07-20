#!/usr/bin/env bun
/**
 * VerifyResearchVault — deterministic research-vault gate for the dispatch pack.
 *
 * Promotes the pack's HEADLINE invariant ("mandatory metered research") from
 * honor-system prose (WeeklyDispatch.md "Do not proceed to Step 2 until the vault file
 * exists ... with at least 5 verified citations" — which nothing mechanically checked)
 * to a real fail-closed gate, mechanically SYMMETRIC with VerifyUrlBatch. It hard-gates
 * the MECHANICALLY checkable — the vault file exists, carries >= N citations, and is not
 * an empty stub — before the draft step. It does NOT judge research QUALITY (primary /
 * on-topic / non-circular); that stays the agent's judgment, exactly as the URL-gate
 * leaves "the judgment is yours".
 *
 * The pure decisioning (count + floor + non-emptiness) is pinned by the oracle test;
 * only the file read is thin, non-deterministic I/O.
 *
 * Usage (CLI):
 *   bun VerifyResearchVault.ts check <vault-path> [--min-citations N]
 *     Exits non-zero (gate BLOCKS the draft) when the vault is MISSING, has fewer than
 *     N citations, or is an empty stub. N defaults to 5 (the long-form floor).
 */
import { existsSync, readFileSync } from "node:fs";

/** Default citation floor — WeeklyDispatch's prose ">= 5 verified citations". */
export const DEFAULT_MIN_CITATIONS = 5;

export interface VaultVerifyResult {
  path: string;
  exists: boolean;
  citationCount: number;
  nonEmpty: boolean;
  minCitations: number;
  /** Gate verdict: true only when exists AND citationCount >= minCitations AND nonEmpty. */
  passed: boolean;
  reason: string;
}

/** Strip a leading `--- ... ---` YAML frontmatter block (pure). */
export function stripFrontmatter(text: string): string {
  const m = text.match(/^\s*---\n[\s\S]*?\n---\n?/);
  return m ? text.slice(m[0].length) : text;
}

/**
 * countCitations — distinct http(s) URLs cited in the vault (markdown links OR bare).
 * Pure. Trailing sentence punctuation is trimmed; the Set dedupes a URL cited twice
 * (a markdown link and a bare repeat of the same URL count once).
 */
export function countCitations(vaultText: string): number {
  const urls = new Set<string>();
  const re = /https?:\/\/[^\s)<>\]"']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(vaultText))) urls.add(m[0].replace(/[.,;:]+$/, ""));
  return urls.size;
}

/** vaultMeetsFloor — pure floor predicate; both sides of the N boundary pinned by the oracle. */
export function vaultMeetsFloor(citationCount: number, minCitations: number): boolean {
  return citationCount >= minCitations;
}

/**
 * isVaultNonEmpty — block the empty-stub evasion. After stripping frontmatter and a lone
 * leading H1 title, the body must carry real research content (>= 40 non-whitespace chars).
 */
export function isVaultNonEmpty(vaultText: string): boolean {
  const body = stripFrontmatter(vaultText)
    .replace(/^#.*$/m, "") // drop a single leading H1 title line
    .replace(/\s+/g, " ")
    .trim();
  return body.length >= 40;
}

/** evaluateVault — pure verdict over the vault text (null text = file absent). No I/O. */
export function evaluateVault(path: string, text: string | null, minCitations: number): VaultVerifyResult {
  if (text === null) {
    return {
      path, exists: false, citationCount: 0, nonEmpty: false, minCitations, passed: false,
      reason: `vault file does not exist: ${path}`,
    };
  }
  const citationCount = countCitations(text);
  const nonEmpty = isVaultNonEmpty(text);
  const meets = vaultMeetsFloor(citationCount, minCitations);
  const passed = meets && nonEmpty;
  const reason = passed
    ? `vault has ${citationCount} citation(s) (>= ${minCitations}) and real content`
    : !nonEmpty
      ? `vault is an empty stub (no real research body)`
      : `vault has only ${citationCount} citation(s), below the floor of ${minCitations}`;
  return { path, exists: true, citationCount, nonEmpty, minCitations, passed, reason };
}

/** resolveResearchVault — thin I/O: read the vault file, or null when absent. */
export function resolveResearchVault(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

function printHelp(): void {
  console.log(`VerifyResearchVault — Dispatch research-vault gate

USAGE
  bun VerifyResearchVault.ts check <vault-path> [--min-citations N]

Gates the pre-draft step on the "mandatory metered research" mandate. PASS only when the
vault file exists, carries >= N citations (default ${DEFAULT_MIN_CITATIONS}), and is not an
empty stub. Exits non-zero (BLOCKS the draft) otherwise. It checks EXISTENCE, COUNT, and
NON-EMPTINESS only — research QUALITY (primary / on-topic / non-circular) stays the agent's
judgment.`);
}

function getMinCitations(argv: string[]): number {
  const i = argv.indexOf("--min-citations");
  if (i >= 0 && argv[i + 1]) {
    const n = Number.parseInt(argv[i + 1]!, 10);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return DEFAULT_MIN_CITATIONS;
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const sub = argv[0];
  if (sub !== "check") {
    console.error(`Error: unknown subcommand '${sub ?? ""}'. Expected: check`);
    process.exit(1);
  }
  const path = argv.slice(1).find((a) => !a.startsWith("--"));
  if (!path) {
    console.error("Error: check requires a <vault-path> argument");
    process.exit(1);
  }
  const minCitations = getMinCitations(argv);
  const r = evaluateVault(path, resolveResearchVault(path), minCitations);
  console.log(`${r.passed ? "PASS" : "FAIL"} ${r.citationCount} ${r.path} — ${r.reason}`);
  process.exit(r.passed ? 0 : 1);
}

if (import.meta.main) {
  main();
}
