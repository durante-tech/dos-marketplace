#!/usr/bin/env bun
/**
 * ResearchCli - deterministic helpers for the research pack's workflows.
 *
 * This CLI owns logic that was previously hand-typed as bash prose inside
 * the Research workflows (RFC-0126 B3 remediation). Relocating it here gives
 * one tested owner instead of N drifting copies.
 *
 * SUBCOMMANDS
 * -----------
 *   resolve-dir [subdir]
 *     Resolve the MEMORY/{subdir} directory using the canonical DOS
 *     project -> cwd -> global precedence chain and print the absolute
 *     path to stdout. Defaults subdir to RESEARCH.
 *
 *     This mirrors getMemorySubdir() in ~/.claude/hooks/lib/paths.ts
 *     (the canonical owner). It is re-implemented in-pack on purpose:
 *     cross-pack relative imports into the live hooks tree are fragile
 *     and do not resolve from the pack source layout. The precedence
 *     chain is small and stable; the unit test pins it.
 *
 *     Resolution order (identical to the bash blocks it replaces):
 *       1. $CLAUDE_PROJECT_DIR/MEMORY/{subdir}   (if it exists)
 *       2. $(pwd)/MEMORY/{subdir}                (if it exists)
 *       3. $HOME/.claude/MEMORY/{subdir}         (global fallback)
 *
 *     The global fallback is self-healed with mkdir -p (never throws),
 *     matching the canonical getMemorySubdir() RFC-0020 P0-2 behavior.
 *
 *   detect-domain <text>
 *     Classify content into a focus domain (Security / Business / Research /
 *     Wisdom / General) by keyword match. Replaces the per-workflow prose
 *     keyword list in ExtractKnowledge Step 2 (RFC-0126 section 9 B7). Pure,
 *     deterministic, first-match-wins on a fixed precedence order.
 *
 *   search-queries <question>
 *     Decompose a research question into up-to-8 targeted WebSearch query
 *     strings. Replaces the generateSearchQueries() body inlined in the
 *     ClaudeResearch workflow markdown (RFC-0126 section 9 B7).
 *
 *   standard-clis <query>
 *     Emit the four direct-CLI fallback command strings for StandardResearch
 *     Step 2 with the query interpolated (RFC-0126 section 9 B7). One command
 *     per line.
 *
 *   should-escalate-docs <refCount> <fallbackCount> <partial> <stale>
 *     Pure escalation predicate for DocsLookup Step 5 (RFC-0126 section 9 B5).
 *     Prints "true"/"false". The "docs partial" and "docs stale" inputs are
 *     agent-judged booleans; this owns only the deterministic boolean
 *     composition that previously drifted in prose.
 *
 *   load-news-files [dir]
 *     List AI-news research files one-per-line in chronological order
 *     (RFC-0126 section 9 B8). Default dir is the resolved MEMORY/RESEARCH
 *     vault (repointed 2026-07-10 — the legacy ~/.claude/History/research is
 *     write-orphaned); walks the {YYYY-MM} month layout two levels deep.
 *
 * USAGE
 * -----
 *   bun ResearchCli.ts resolve-dir            # prints the RESEARCH base dir
 *   bun ResearchCli.ts resolve-dir RESEARCH   # explicit subdir
 *   bun ResearchCli.ts detect-domain "exploit chain in the kernel"
 *   bun ResearchCli.ts search-queries "vector databases"
 *   bun ResearchCli.ts standard-clis "vector databases"
 *   bun ResearchCli.ts should-escalate-docs 0 0 false false
 *   bun ResearchCli.ts load-news-files
 *
 * EXIT CODES
 * ----------
 *   0  success
 *   1  CLI usage error (unknown subcommand)
 */

import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Resolve a MEMORY subdirectory using the canonical DOS precedence chain.
 *
 * Mirror of getMemorySubdir() in ~/.claude/hooks/lib/paths.ts. The global
 * fallback is self-healed on miss and never throws (filesystem errors are
 * swallowed so the caller still receives a path).
 *
 * @param subdir   MEMORY subdir name (e.g. "RESEARCH")
 * @param env      environment map (defaults to process.env) — injectable for tests
 * @param cwd      working directory (defaults to process.cwd()) — injectable for tests
 * @param home     home directory (defaults to os.homedir()) — injectable for tests
 */
export function resolveMemorySubdir(
  subdir: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  home: string = homedir(),
): string {
  // 1. CLAUDE_PROJECT_DIR/MEMORY/{subdir}
  const envDir = env.CLAUDE_PROJECT_DIR;
  if (envDir) {
    const projectDir = join(envDir, "MEMORY", subdir);
    if (existsSync(projectDir)) return projectDir;
  }

  // 2. cwd/MEMORY/{subdir}
  const cwdDir = join(cwd, "MEMORY", subdir);
  if (existsSync(cwdDir)) return cwdDir;

  // 3. global fallback — self-heal on miss, never throw
  const globalDir = join(home, ".claude", "MEMORY", subdir);
  if (!existsSync(globalDir)) {
    try {
      mkdirSync(globalDir, { recursive: true });
    } catch {
      /* swallow — caller surfaces a clearer ENOENT later if the mkdir truly failed */
    }
  }
  return globalDir;
}

/** Convenience wrapper for the common RESEARCH case. */
export function resolveResearchDir(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  home: string = homedir(),
): string {
  return resolveMemorySubdir("RESEARCH", env, cwd, home);
}

// ---------------------------------------------------------------------------
// detectContentDomain — ExtractKnowledge Step 2 keyword classifier (B7)
// ---------------------------------------------------------------------------

/** Focus domain a piece of content is classified into. */
export type ContentDomain =
  | "Security"
  | "Business"
  | "Research"
  | "Wisdom"
  | "General";

/**
 * Domain -> trigger keywords, in PRECEDENCE order. First domain with any
 * keyword match wins. The keyword sets reproduce the ExtractKnowledge Step 2
 * prose list exactly; the precedence order (Security, Business, Research,
 * Wisdom) matches the order the prose listed them, with General as the
 * everything-else fallback.
 */
const DOMAIN_KEYWORDS: ReadonlyArray<readonly [ContentDomain, readonly string[]]> = [
  ["Security", ["vulnerability", "hack", "exploit", "cybersecurity", "attack", "defense"]],
  ["Business", ["money", "revenue", "profit", "market", "strategy", "business"]],
  ["Research", ["study", "experiment", "methodology", "findings", "academic"]],
  ["Wisdom", ["philosophy", "principle", "life", "wisdom", "insight", "experience"]],
];

/**
 * Classify content text into a focus domain by case-insensitive keyword match.
 *
 * Deterministic and first-match-wins on the fixed precedence order above.
 * Returns "General" when no keyword from any domain appears. Pure: same input
 * always yields the same domain. This is the single tested owner for the
 * keyword list that was previously hand-typed in ExtractKnowledge prose.
 */
export function detectContentDomain(text: string): ContentDomain {
  const haystack = text.toLowerCase();
  for (const [domain, keywords] of DOMAIN_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return domain;
  }
  return "General";
}

// ---------------------------------------------------------------------------
// generateSearchQueries — ClaudeResearch query decomposition (B7)
// ---------------------------------------------------------------------------

/**
 * Decompose a research question into up-to-8 targeted WebSearch queries.
 *
 * Byte-for-byte the generateSearchQueries() body that was inlined in the
 * ClaudeResearch workflow markdown. The current-year interpolation is
 * injectable so the unit test can pin the output deterministically (the live
 * default reads new Date().getFullYear()).
 *
 * @param question  the operator's research question
 * @param year      the year used in the "latest news" / "recent developments"
 *                  queries; defaults to the current year
 */
export function generateSearchQueries(
  question: string,
  year: number = new Date().getFullYear(),
): string[] {
  const queries: string[] = [];

  // Always include the original question
  queries.push(question);

  // Add context/background query
  queries.push(`what is ${question} background context`);

  // Add recent developments query
  queries.push(`${question} latest news ${year}`);
  queries.push(`${question} recent developments ${year}`);

  // Add technical/detailed query
  queries.push(`${question} technical details explained`);

  // Add comparison/alternatives query
  queries.push(`${question} comparison alternatives options`);

  // Add expert analysis query
  queries.push(`${question} expert analysis opinion`);

  // Add practical implications query
  queries.push(`${question} implications impact consequences`);

  return queries.slice(0, 8); // Limit to 8 queries max
}

// ---------------------------------------------------------------------------
// buildStandardResearchClis — StandardResearch Step 2 fallback commands (B7)
// ---------------------------------------------------------------------------

/**
 * Emit the four direct-CLI fallback commands for StandardResearch Step 2 with
 * the query interpolated. Replaces the hand-typed command block so the flag
 * conventions (model, recency, type, count) have one tested owner instead of
 * drifting copies across workflows. Returns the commands in the fixed
 * Perplexity / Brave / Gemini / Grok order the prose listed.
 */
export function buildStandardResearchClis(query: string): string[] {
  // Shell-safe single-quoting so a query containing quotes/backticks/$ cannot break or
  // inject the generated command. POSIX: close the quote, emit an escaped ', reopen.
  const q = "'" + query.replace(/'/g, "'\\''") + "'";
  return [
    `bun ~/.claude/skills/research/Tools/Perplexity.ts --model sonar --recency week --json-only ${q}`,
    `bun ~/.claude/skills/research/Tools/BraveSearch.ts --type web --count 10 --extra-snippets --json-only ${q}`,
    `bun ~/.claude/skills/research/Tools/Gemini.ts --json-only ${q}`,
    `bun ~/.claude/skills/research/Tools/Grok.ts --json-only ${q}`,
  ];
}

// ---------------------------------------------------------------------------
// shouldEscalateDocsLookup — DocsLookup Step 5 escalation gate (B5)
// ---------------------------------------------------------------------------

/**
 * Pure escalation predicate for DocsLookup Step 5.
 *
 * Escalate to StandardResearch if ANY of:
 *   - Ref returned zero AND the operator-local fallback also returned zero
 *   - the docs answer is partial (multi-version synthesis / cross-library)
 *   - the docs are present but stale
 *
 * `partial` and `stale` are agent-judged booleans (the agent reads the docs
 * and decides). This function owns only the deterministic boolean composition
 * that previously lived as a prose bullet list and could silently drift.
 *
 * @param refCount       number of results Ref returned
 * @param fallbackCount  number of results the operator-local fallback returned
 * @param partial        agent judgment: is the docs answer only partial?
 * @param stale          agent judgment: are the docs stale vs the user's version?
 */
export function shouldEscalateDocsLookup(
  refCount: number,
  fallbackCount: number,
  partial: boolean,
  stale: boolean,
): boolean {
  const bothZero = refCount === 0 && fallbackCount === 0;
  return bothZero || partial || stale;
}

// ---------------------------------------------------------------------------
// loadNewsFiles — AnalyzeAiTrends historical-log discovery (B8)
// ---------------------------------------------------------------------------

/**
 * List AI-news research files in chronological order.
 *
 * The deterministic part of AnalyzeAiTrends Step 1: enumerate the markdown
 * research logs and chronological-sort them. Default source (repointed
 * 2026-07-10, operator-signed — the legacy ~/.claude/History/research dir is
 * write-orphaned): the research vault `MEMORY/RESEARCH/` via the canonical
 * precedence chain, walking its {YYYY-MM} month layout up to two levels deep
 * (month dirs may hold per-entry subdirectories). Paths sort lexicographically
 * by relative path — the {YYYY-MM}/ prefix (and YYYY-MM-DD filename prefixes
 * inside) make lexicographic == chronological; that equivalence is the
 * load-bearing invariant this helper pins. Returns absolute paths. Missing
 * dir -> empty list (never throws).
 *
 * The "filter for AI news files" judgment from the prose stays with the agent;
 * this helper applies a conservative *.md filter and leaves finer selection to
 * the caller. Sort and listing are the deterministic core.
 *
 * @param dir       directory to scan (default: resolved MEMORY/RESEARCH vault)
 * @param readdir   directory reader (injectable for tests)
 * @param isDir     directory probe (injectable for tests)
 */
export function loadNewsFiles(
  dir: string = resolveMemorySubdir("RESEARCH"),
  readdir: (d: string) => string[] = (d) => readdirSync(d),
  isDir: (p: string) => boolean = (p) => {
    try { return statSync(p).isDirectory(); } catch { return false; }
  },
): string[] {
  const out: string[] = [];
  const walk = (d: string, depth: number): void => {
    let names: string[];
    try {
      names = readdir(d);
    } catch {
      return; // missing/unreadable dir -> nothing from this branch
    }
    for (const n of names.sort()) {
      const p = join(d, n);
      if (n.endsWith(".md")) out.push(p);
      else if (depth < 2 && isDir(p)) walk(p, depth + 1);
    }
  };
  walk(dir, 0);
  return out; // depth-first over sorted names == chronological by prefix
}

function main(argv: string[]): number {
  const [subcommand, ...rest] = argv;

  switch (subcommand) {
    case "resolve-dir": {
      const subdir = rest[0] ?? "RESEARCH";
      process.stdout.write(resolveMemorySubdir(subdir) + "\n");
      return 0;
    }
    case "detect-domain": {
      const text = rest.join(" ");
      process.stdout.write(detectContentDomain(text) + "\n");
      return 0;
    }
    case "search-queries": {
      const question = rest.join(" ");
      process.stdout.write(generateSearchQueries(question).join("\n") + "\n");
      return 0;
    }
    case "standard-clis": {
      const query = rest.join(" ");
      process.stdout.write(buildStandardResearchClis(query).join("\n") + "\n");
      return 0;
    }
    case "should-escalate-docs": {
      const refCount = Number(rest[0] ?? "0");
      const fallbackCount = Number(rest[1] ?? "0");
      const partial = rest[2] === "true";
      const stale = rest[3] === "true";
      process.stdout.write(
        String(shouldEscalateDocsLookup(refCount, fallbackCount, partial, stale)) + "\n",
      );
      return 0;
    }
    case "load-news-files": {
      const dir = rest[0];
      const files = dir ? loadNewsFiles(dir) : loadNewsFiles();
      process.stdout.write(files.join("\n") + (files.length ? "\n" : ""));
      return 0;
    }
    default:
      process.stderr.write(
        `ResearchCli: unknown subcommand '${subcommand ?? ""}'.\n` +
          `Usage: bun ResearchCli.ts resolve-dir [subdir] | detect-domain <text> | ` +
          `search-queries <question> | standard-clis <query> | ` +
          `should-escalate-docs <ref> <fallback> <partial> <stale> | load-news-files [dir]\n`,
      );
      return 1;
  }
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
