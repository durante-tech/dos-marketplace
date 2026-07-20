#!/usr/bin/env bun
/**
 * @pack Sentinel
 * @workflow artifact-closure
 *
 * check-artifact-closure.ts — RFC-0092 §3.1 implementation (v1.1, minimum-viable + auto-local-only).
 *
 * Walks Plans/Specs/RFC-*.md and Plans/Roadmaps/*.md, extracts file-path
 * citations from each, and resolves them against the four RFC-0092 §2 states:
 *   - tracked     — `git ls-files --error-unmatch <path>` returns 0
 *   - archived    — path exists AND under MEMORY/ARCHIVE/
 *   - stub        — path exists with `status: draft-stub` in frontmatter
 *   - local-only  — line has the marker `(operator-local; not tracked)` or
 *                   `(transient; not committed)` OR path is auto-classified
 *                   local-only by convention (see AUTO_LOCAL_ONLY_PREFIXES).
 *
 * Auto-local-only conventions (tightened P1.7 — per-machine infrastructure only):
 *   - `~/...`              — home-relative (per-machine installation)
 *   - `/tmp/...`           — transient working files
 *   - `Releases/v0.0.X/.claude/...` paths (any v-prefixed release dir)
 *                          — submodule paths (tracked in submodule, not parent repo)
 *
 * NOT auto-classified (require inline `(operator-local; not tracked)` markers):
 *   - `MEMORY/WORK/`, `MEMORY/RESEARCH/`, `MEMORY/STATE/`, `MEMORY/ARTIFACTS/`,
 *     `MEMORY/SECURITY/`, `MEMORY/LEARNING/`, `MEMORY/CANONICAL/`, `MEMORY/VOICE/`,
 *     `MEMORY/RELATIONSHIP/`
 *                          — gitignored, but citation context matters. A claim of
 *                            "MEMORY/RESEARCH/foo.md is the durable source" MUST
 *                            NOT silently pass — that exact bug birthed RFC-0092.
 *   - `MEMORY/ARCHIVE/`     — tracked archive (resolves to `archived` if path exists)
 *
 * Skipped (category descriptions, not citations):
 *   - Glob/template patterns containing `*`, `?`, `[`, `]`, `<`, `>`, `{`, `}`
 *     (e.g., `Plans/Specs/RFC-*.md`, `~/.claude/hooks/<name>.hook.ts`)
 *
 * Exit codes:
 *   0 — all accepted+ RFCs/roadmaps pass; OR all draft/draft-stub (gate fires not_applicable)
 *   1 — one or more accepted+ files have unresolved citations
 *   2 — malformed frontmatter or unreadable path
 *
 * Usage:
 *   bun ~/Durante/Tools/check-artifact-closure.ts                 — scan all (corpus drift report; not a clean baseline yet)
 *   bun ~/Durante/Tools/check-artifact-closure.ts <path>          — scan single file (force-check regardless of status — kickoff promotion preview)
 *   bun ~/Durante/Tools/check-artifact-closure.ts --report-all    — print resolution for every citation, not just unresolved
 *
 * Operational note (P1.7): default scan-all currently exits 1 because the historical
 * accepted RFC corpus carries pre-existing citation drift the doctrine just made
 * visible. Targeted (single-file force-check) mode is the kickoff-promotion path;
 * default mode is a triage report, not a CI gate. Wire to CI only after the historical
 * corpus is cleaned OR an explicit baseline/allowlist is added.
 *
 * Scope (v1.1):
 *   - Backtick-wrapped path citations with recognized extensions (.md, .ts, .json, .jsonl, .sh, .py, .yml, .yaml)
 *   - Paths starting with `Plans/`, `Packs/`, `Docs/`, `Tools/`, `MEMORY/`, `Releases/`, `~/`, `/tmp/`, or absolute `/`
 *
 * Out of scope (deferred to v2 — V14/V15 work per RFC-0092 §3.1 ratchet):
 *   - Markdown link targets `[text](path)`
 *   - RFC-NNNN references (resolved at registry level)
 *   - V13.X / V14.X sprint slot references
 *   - File existence checks for auto-local-only paths
 *
 * Created 2026-05-10 P1.6 — closes Lucas P1.1 finding (tool absent vs spec ratified).
 * Refined P1.6.1 — auto-local-only rules for ~/, MEMORY/non-archive, Releases/<ver>/.claude/, /tmp/.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * REPO_ROOT — resolved dynamically (P1.8 — fixes hardcoded path).
 * Prefers the repo containing this script (deterministic for the Durante tree),
 * falls back to git rev-parse from cwd (worktrees/CI/other clones), then to cwd.
 */
const REPO_ROOT = (() => {
  try {
    return execFileSync('git', ['-C', import.meta.dir, 'rev-parse', '--show-toplevel'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
  } catch {
    // Script-dir lookup failed (rare); try cwd.
    try {
      return execFileSync('git', ['rev-parse', '--show-toplevel'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      }).toString().trim();
    } catch {
      return process.cwd();
    }
  }
})();
const RECOGNIZED_EXT = ['md', 'ts', 'json', 'jsonl', 'sh', 'py', 'yml', 'yaml'];
const PATH_PREFIXES = ['Plans/', 'Packs/', 'Docs/', 'Tools/', 'MEMORY/', 'Releases/'];

// Note (P1.7): MEMORY/{WORK,RESEARCH,STATE,...} are gitignored per RFC-0037 §3 BUT
// the doctrine demands they carry inline (operator-local; not tracked) markers when
// cited — otherwise a load-bearing "MEMORY/RESEARCH/foo.md is the durable source"
// claim silently passes. They are NOT auto-classified. See isAutoLocalOnly() below.

interface Citation {
  path: string;
  line_number: number;
  line_text: string;
}

interface Resolution {
  state: 'tracked' | 'archived' | 'stub' | 'local-only' | 'unresolved';
  reason?: string;
}

interface Frontmatter {
  status: string;
}

function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const statusLine = match[1].match(/^status:\s*(.+)$/m);
    if (statusLine) return { status: statusLine[1].trim() };
  }
  // P1.8 — roadmaps carry status in Markdown prose, not YAML frontmatter.
  // Recognize `**Status:** **DRAFT…**` or `**Status:** ACCEPTED` patterns.
  // First **bolded** word after the Status: label wins; case-insensitive.
  const proseStatus = content.match(/^\*\*Status:\*\*\s*\*?\*?([A-Za-z][A-Za-z-]+)/m);
  if (proseStatus) {
    const word = proseStatus[1].toLowerCase();
    // Anything containing "draft" maps to draft (covers DRAFT, DRAFT-STUB, SCOPE-DRAFT, MASTER-DRAFT).
    if (word.includes('draft')) return { status: word === 'draft-stub' ? 'draft-stub' : 'draft' };
    if (['accepted', 'implemented', 'superseded', 'retired', 'shipped'].includes(word)) {
      return { status: word };
    }
  }
  return { status: 'unknown' };
}

function extractCitations(content: string): Citation[] {
  const cites: Citation[] = [];
  const lines = content.split('\n');
  const extPattern = RECOGNIZED_EXT.join('|');
  const prefixPattern = PATH_PREFIXES.map((p) => p.replace('/', '\\/')).join('|');
  const re = new RegExp(`\`((?:~\\/|\\/|${prefixPattern})[^\`\\s]+\\.(?:${extPattern}))\``, 'g');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const match of line.matchAll(re)) {
      const path = match[1];
      // Skip globs, templates, and placeholders — these are category descriptions,
      // not citations. (P1.7: glob expansion through shell would falsely resolve
      // `Plans/Specs/RFC-*.md` as tracked.)
      if (looksLikeGlobOrTemplate(path)) continue;
      cites.push({ path, line_number: i + 1, line_text: line });
    }
  }
  return cites;
}

function isLocalOnlyLine(lineText: string): boolean {
  // Recognized markers (RFC-0092 §2 Local-only state):
  //   (operator-local; not tracked) — per-machine infrastructure
  //   (transient; not committed)    — short-lived working file
  //   (deferred; <reason>)          — RFC ratifies the spec but the tool/file is explicitly deferred (P1.9)
  //   (planned; <reason>)           — known future work not yet shipped (P1.9)
  //   (historical; <reason>)        — was shipped, since removed; citation kept for archeology (P1.9)
  return (
    /\(operator-local; not tracked\)/.test(lineText) ||
    /\(transient; not committed\)/.test(lineText) ||
    /\(deferred;[^)]+\)/.test(lineText) ||
    /\(planned;[^)]+\)/.test(lineText) ||
    /\(historical;[^)]+\)/.test(lineText)
  );
}

function isAutoLocalOnly(path: string): boolean {
  // P1.7 tightening: auto-classify only paths that are unambiguously
  // per-machine infrastructure. MEMORY/* paths (WORK/RESEARCH/STATE/...) are
  // gitignored but their citation context matters — a load-bearing claim of
  // `MEMORY/RESEARCH/foo.md` as "durable source" must NOT silently pass.
  // Require inline `(operator-local; not tracked)` markers for those.
  //
  // Auto-classified (no inline marker required):
  //   - `~/...`             — per-machine home installation
  //   - `/tmp/...`           — transient working files
  //   - `Releases/v0.0.X/.claude/...` — submodule scope (tracked elsewhere)
  if (path.startsWith('~/')) return true;
  if (path.startsWith('/tmp/')) return true;
  if (/^Releases\/v\d+\.\d+\.\d+\/\.claude\//.test(path)) return true;
  return false;
}

/**
 * Reject glob/template patterns explicitly. `Plans/Specs/RFC-*.md` is a category
 * description, not a citation — it would silently resolve as "tracked" via
 * shell-expansion in v1, falsely passing the gate. Globs MUST be classified
 * separately (operator marks them as category descriptions or skips them).
 */
function looksLikeGlobOrTemplate(path: string): boolean {
  return /[*?[\]<>{}]/.test(path);
}

function isTracked(path: string): boolean {
  // Array form — no shell interpolation, no glob expansion. The path arg is
  // passed literally to git ls-files; metacharacters (?, *, [, etc.) cannot
  // execute or alter behavior. (P1.7 — fixes shell-injection + false-positive
  // glob expansion that was making `Plans/Specs/RFC-*.md` resolve as tracked.)
  try {
    execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '--error-unmatch', path], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isStub(absPath: string): boolean {
  if (!existsSync(absPath) || !absPath.endsWith('.md')) return false;
  try {
    const content = readFileSync(absPath, 'utf8');
    return parseFrontmatter(content).status === 'draft-stub';
  } catch {
    return false;
  }
}

function resolveCitation(cite: Citation): Resolution {
  if (isLocalOnlyLine(cite.line_text)) {
    return { state: 'local-only', reason: 'inline marker' };
  }

  const path = cite.path;

  if (isAutoLocalOnly(path)) {
    return { state: 'local-only', reason: 'auto-classified per RFC-0037 §3' };
  }

  if (path.startsWith('/')) {
    return { state: 'unresolved', reason: 'absolute path without local-only marker' };
  }

  const relPath = path.replace(/^\.\//, '');
  const absPath = join(REPO_ROOT, relPath);

  if (relPath.startsWith('MEMORY/ARCHIVE/') && existsSync(absPath)) {
    // P1.8 — "archived" requires git tracking, not just existence. An untracked
    // stub under MEMORY/ARCHIVE/ would silently pass under v1.1 — the doctrine
    // calls this scope the "git-tracked archive scope" per RFC-0092 §2.
    if (isTracked(relPath)) return { state: 'archived' };
    return { state: 'unresolved', reason: 'under MEMORY/ARCHIVE/ but not git-tracked' };
  }

  if (isTracked(relPath)) {
    return { state: 'tracked' };
  }

  if (isStub(absPath)) {
    return { state: 'stub' };
  }

  if (existsSync(absPath)) {
    return { state: 'unresolved', reason: 'exists but neither tracked nor stub nor archived' };
  }

  return { state: 'unresolved', reason: 'path does not exist' };
}

function checkFile(targetPath: string, forceCheck: boolean, reportAll: boolean): number {
  if (!existsSync(targetPath)) {
    console.error(`✗ ${targetPath}: file does not exist`);
    return 2;
  }
  const content = readFileSync(targetPath, 'utf8');
  const fm = parseFrontmatter(content);

  // P1.9: lowercase YAML status for case-insensitive matching ('Draft' → 'draft').
  // Skip-set expanded (operator decision): superseded + retired join draft/draft-stub/unknown
  // as not_applicable — the gate is about ratification-readiness, retired RFCs aren't candidates.
  const statusLower = fm.status.toLowerCase();
  const SKIP_STATUSES = new Set(['draft', 'draft-stub', 'unknown', 'superseded', 'retired']);
  if (!forceCheck && SKIP_STATUSES.has(statusLower)) {
    if (reportAll) console.log(`${targetPath.replace(REPO_ROOT + '/', '')} [status: ${fm.status}] — not_applicable (gate fires only for accepted/shipped/implemented)`);
    return 0;
  }

  const citations = extractCitations(content);
  const results: Array<{ cite: Citation; res: Resolution }> = citations.map((c) => ({ cite: c, res: resolveCitation(c) }));
  const unresolved = results.filter((r) => r.res.state === 'unresolved');

  if (reportAll) {
    console.log(`\n${targetPath.replace(REPO_ROOT + '/', '')} [status: ${fm.status}] — ${citations.length} citation(s)`);
    for (const { cite, res } of results) {
      const marker = res.state === 'unresolved' ? '✗' : '✓';
      console.log(`  ${marker} L${cite.line_number} ${cite.path} → ${res.state}${res.reason ? ' (' + res.reason + ')' : ''}`);
    }
  } else if (unresolved.length > 0) {
    console.log(`\n${targetPath.replace(REPO_ROOT + '/', '')} [status: ${fm.status}] — ${unresolved.length} unresolved citation(s):`);
    for (const { cite, res } of unresolved) {
      console.log(`  ✗ L${cite.line_number} ${cite.path} (${res.reason})`);
    }
  }

  return unresolved.length > 0 ? 1 : 0;
}

function main(): number {
  const args = process.argv.slice(2);
  const reportAll = args.includes('--report-all');
  const targetArg = args.find((a) => !a.startsWith('--'));

  if (targetArg) {
    return checkFile(targetArg.startsWith('/') ? targetArg : join(REPO_ROOT, targetArg), true, reportAll);
  }

  const rfcDir = join(REPO_ROOT, 'Plans', 'Specs');
  const roadmapDir = join(REPO_ROOT, 'Plans', 'Roadmaps');
  const targets: string[] = [];

  for (const f of readdirSync(rfcDir)) {
    if (f.startsWith('RFC-') && f.endsWith('.md')) targets.push(join(rfcDir, f));
  }
  for (const f of readdirSync(roadmapDir)) {
    if (f.endsWith('.md')) targets.push(join(roadmapDir, f));
  }

  let worstExit = 0;
  let scanned = 0;
  let failed = 0;
  for (const t of targets) {
    const rc = checkFile(t, false, reportAll);
    scanned++;
    if (rc !== 0) failed++;
    if (rc > worstExit) worstExit = rc;
  }

  if (worstExit === 0) {
    console.log(`\nartifact-closure-gate: all ${scanned} target(s) pass (accepted+ files only; draft/draft-stub return not_applicable).`);
  } else {
    console.log(`\nartifact-closure-gate: ${failed} of ${scanned} target(s) have unresolved citations.`);
  }
  return worstExit;
}

process.exit(main());
