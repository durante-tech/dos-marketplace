/**
 * R-ACL-2 (RFC-0061) — No DOS file outside declared PAI-mirror paths contains PAI vocabulary tokens.
 *
 * PAI vocabulary tokens (per RFC-0061 §13.1 R-ACL-2):
 *   1. {{PRINCIPAL_NAME}}       — template placeholder from PAI identity system
 *   2. ~/.claude/PAI/           — PAI-specific path fragment
 *   3. standalone "PAI"         — word-boundary match on non-comment lines
 *
 * Exclusions (files/dirs that may legitimately carry PAI vocabulary by design):
 *   - Any dosPath listed in PAI_PORT_REGISTRY (declared mirror paths)
 *   - Releases/      (frozen snapshots — read-only historical artifacts)
 *   - MEMORY/        (runtime buffers — not subject to ACL at write time)
 *   - .git/          (VCS internals)
 *   - .sentinel/     (scan artifacts)
 *   - Plans/Specs/RFC-0061  (this RFC — references PAI by definition)
 *   - Plans/Specs/RFC-0042, RFC-0057  (PAI-lift and substitution-table RFCs)
 *   - node_modules/  (vendored dependencies)
 *   - Binary file extensions
 *
 * Resolution chain:
 *   1. (ctx as ExtendedCheckContext).paiPortRegistry — test seam
 *   2. dynamic import({repoRoot}/Tools/pai-port.ts)  — production
 *   3. registry unavailable → scan with no mirror-path exclusions (conservative)
 *
 * Failure modes:
 *   - File outside exclusion set contains a PAI vocab token → fail
 *   - No files to scan → pass
 *
 * Cross-references:
 *   RFC-0061 §13.1 R-ACL-2 (check: pai-acl.no-pai-vocabulary-leak)
 *   RFC-0057 Policy 3 — substitution table for PAI→DOS vocab migration
 *   Tools/pai-port.ts — PAI_PORT_REGISTRY dosPath exclusion list
 *
 * Enhancement notes:
 *   2026-05-05 — initial authorship (Stream G, RFC-0061 delivery)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { extname, join, relative } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const R_ID = "R-ACL-2";
const REQUIREMENT =
  "No DOS file outside declared PAI-mirror paths contains PAI vocabulary tokens";

/** Minimal shape mirroring PaiPortEntry in Tools/pai-port.ts. */
interface PaiPortEntry {
  dosPath: string;
  paiPatternSlug: string;
  upstreamCommitSha: string;
  translationStatus: string;
  dosNamespace: string;
}

/** Local context extension for test-seam injection — types.ts is NOT modified. */
type CheckContextWithRegistry = CheckContext & { paiPortRegistry?: PaiPortEntry[] };

/** Binary extensions — skip reading these. */
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp4", ".mp3", ".wav", ".ogg",
  ".pdf", ".zip", ".tar", ".gz", ".bz2",
  ".db", ".sqlite", ".sqlite3",
  ".lock",   // package-lock, bun.lockb
]);

/** Directory/path prefixes that are always excluded from the scan. */
const ALWAYS_EXCLUDED_PREFIXES = [
  "Releases/",
  "MEMORY/",
  ".git/",
  ".sentinel/",
  ".claude/worktrees/",  // sibling agent worktrees — transient mirror of repo, not part of canonical tree
  "node_modules/",
  "dist/",
  ".turbo/",
  ".next/",
  ".cache/",
  "Plans/Specs/RFC-0061",
  "Plans/Specs/RFC-0042",
  "Plans/Specs/RFC-0057",
  // Self-exemption: R-ACL handlers contain the regex literals they detect.
  // Same pattern as R15 (no-xapikey-against-studio) which contains "X-API-Key".
  "Packs/sentinel/src/Tools/ConformanceChecks/handlers/R-ACL-",
  "Tools/merge-upstream.ts",  // contains VOCAB_PATTERNS by design
  "Tools/hooks/pre-commit-pai-vocab-scan.sh",  // contains the same literals
  "Packs/sentinel/src/Tools/containment-zones.ts",  // contains 'Releases/v*/.claude/PAI/**' glob pattern by design (release-prep exclusion list)
];

/** Directory basename matchers — exclude regardless of where they appear in the tree. */
const ALWAYS_EXCLUDED_BASENAMES = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".next",
  ".cache",
  ".git",
]);

/** Hard cap on files scanned — protects against pathological trees. */
const MAX_FILES_SCANNED = 10000;

/** PAI vocabulary token matchers per RFC-0061 §13.1 R-ACL-2. */
const VOCAB_PRINCIPAL_NAME = "{{PRINCIPAL_NAME}}";
const VOCAB_PAI_PATH = "~/.claude/PAI/";
// Standalone "PAI" at word boundary in non-comment lines.
const RE_STANDALONE_PAI = /\bPAI\b/;
// Lines starting with common comment markers — these are excluded from the PAI standalone check.
const RE_COMMENT_LINE = /^\s*(#|\/\/|\*|<!--|\*\/|---)/;

interface VocabHit {
  token: string;
  line: number;
}

/** Code-file extensions where standalone "PAI" is treated as a leak.
 *  Markdown / docs may legitimately reference PAI when describing the upstream
 *  relationship (README, CLAUDE.md, AGENTS.md, RFC bodies). The literal tokens
 *  ({{PRINCIPAL_NAME}} and ~/.claude/PAI/) remain binary-fail in ALL files —
 *  those are concrete leaks regardless of file type. */
const CODE_EXTENSIONS_FOR_STANDALONE_PAI = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".sh", ".bash", ".zsh",
]);

function checkFileForVocab(content: string, fileExt: string): VocabHit | null {
  const isCodeFile = CODE_EXTENSIONS_FOR_STANDALONE_PAI.has(fileExt.toLowerCase());
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Literal token checks — apply to all file types (concrete leaks).
    if (line.includes(VOCAB_PRINCIPAL_NAME)) {
      return { token: VOCAB_PRINCIPAL_NAME, line: i + 1 };
    }
    if (line.includes(VOCAB_PAI_PATH)) {
      return { token: VOCAB_PAI_PATH, line: i + 1 };
    }
    // Standalone PAI — only flag in code files, only in non-comment prose.
    // Docs/RFCs/README naturally reference the upstream by name.
    if (isCodeFile && !RE_COMMENT_LINE.test(line) && RE_STANDALONE_PAI.test(line)) {
      return { token: "standalone PAI", line: i + 1 };
    }
  }
  return null;
}

function collectFiles(dir: string, repoRoot: string, mirrorPaths: Set<string>): string[] {
  // Iterative walk with hard cap. Recursion + spread-push blew the stack on the
  // 7,500-file DOS repo. Iterative + cap protects against pathological trees
  // (vendored node_modules, build artifacts, etc.).
  const results: string[] = [];
  const stack: string[] = [dir];

  while (stack.length > 0 && results.length < MAX_FILES_SCANNED) {
    const cur = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(cur);
    } catch {
      continue;
    }

    for (const entry of entries) {
      // Cheapest check first — basename exclusion before any path math.
      if (ALWAYS_EXCLUDED_BASENAMES.has(entry)) continue;

      const full = join(cur, entry);
      const rel = relative(repoRoot, full);

      if (ALWAYS_EXCLUDED_PREFIXES.some((p) => rel === p.replace(/\/$/, "") || rel.startsWith(p))) {
        continue;
      }
      if (mirrorPaths.has(full) || mirrorPaths.has(rel)) continue;

      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }

      if (st.isDirectory()) {
        // Skip __fixtures__ trees — they intentionally contain vocab tokens for test detection.
        if (entry === "__fixtures__") continue;
        stack.push(full);
      } else if (st.isFile()) {
        // Skip test files — they intentionally contain vocab tokens to test the regex.
        if (full.endsWith(".test.ts") || full.endsWith(".test.tsx") || full.endsWith(".test.js")) continue;
        if (full.endsWith(".spec.ts") || full.endsWith(".spec.tsx") || full.endsWith(".spec.js")) continue;
        if (!BINARY_EXTENSIONS.has(extname(full).toLowerCase())) {
          results.push(full);
          if (results.length >= MAX_FILES_SCANNED) break;
        }
      }
    }
  }
  return results;
}

async function loadRegistry(ctx: CheckContextWithRegistry): Promise<PaiPortEntry[]> {
  if (ctx.paiPortRegistry !== undefined) return ctx.paiPortRegistry;

  const registryPath = join(ctx.repoRoot, "Tools", "pai-port.ts");
  if (!existsSync(registryPath)) return [];

  try {
    const mod = await import(registryPath);
    const reg = mod.PAI_PORT_REGISTRY;
    return Array.isArray(reg) ? (reg as PaiPortEntry[]) : [];
  } catch {
    return [];
  }
}

export async function rAcl2NoPaiVocabularyLeak(ctx: CheckContext): Promise<CheckResult> {
  const registry = await loadRegistry(ctx as CheckContextWithRegistry);

  // Build set of declared mirror paths to exclude from scan.
  // Normalize to both absolute and repo-relative forms for robust comparison.
  const mirrorPaths = new Set<string>();
  for (const entry of registry) {
    const abs = entry.dosPath.startsWith("/")
      ? entry.dosPath
      : join(ctx.repoRoot, entry.dosPath);
    mirrorPaths.add(abs);
    mirrorPaths.add(relative(ctx.repoRoot, abs));
  }

  const allFiles = collectFiles(ctx.repoRoot, ctx.repoRoot, mirrorPaths);
  const violations: string[] = [];

  for (const file of allFiles) {
    let content: string;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const hit = checkFileForVocab(content, extname(file));
    if (hit) {
      const rel = relative(ctx.repoRoot, file);
      violations.push(`${rel}:${hit.line} — '${hit.token}'`);
    }
  }

  if (violations.length === 0) {
    return {
      rId: R_ID,
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [
        `Scanned ${allFiles.length} file(s) — no PAI vocabulary tokens outside declared mirror paths`,
      ],
    };
  }

  const preview = violations.slice(0, 5).join("; ");
  const overflow = violations.length > 5 ? ` (+${violations.length - 5} more)` : "";
  return {
    rId: R_ID,
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${violations.length} PAI vocabulary leak(s) detected: ${preview}${overflow}`,
      "fix: add to PAI_PORT_REGISTRY as a declared mirror path, OR apply RFC-0057 Policy 3 substitution",
    ],
  };
}
