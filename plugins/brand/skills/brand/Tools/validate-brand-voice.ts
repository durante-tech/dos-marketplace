#!/usr/bin/env bun
/**
 * @pack Brand
 * @workflow voice-lint
 *
 * validate-brand-voice.ts — Brand voice linter
 *
 * Scans canonical copy surfaces for POSITIONING.md §11 violations:
 *   - Forbidden vocabulary (guarantee, leverage, agentic, production-grade, ...)
 *   - Banned multipliers (200×, work of 10, bare "multiplies"/"multiplier", ...)
 *   - Register-restricted terms (cognition layer — platform-partner only per §9.3)
 *
 * Surfaces scanned (extensions: .md, .mdoc, .json). See DEFAULT_GLOBS below for
 * the canonical list; currently covers Docs Markdown (canon + messaging), Studio
 * i18n landing.json across locales, and in-app .mdoc documentation.
 *
 * Modes:
 *   Default         — scan only git-staged files with scannable extensions
 *                      (PRD-A v0.0.15 ISC-2 default-scope-flip 2026-05-13)
 *   --staged        — explicit form of the default (back-compat with pre-commit Gate 3)
 *   --full          — scan the canonical surfaces (Docs/**, i18n landing.json, .mdoc).
 *                      Used by nightly/CI sweeps; was the pre-2026-05-13 default.
 *   --json          — machine-readable output
 *   --help          — print usage
 *
 * Exit codes: 0 = clean, 1 = violations found
 *
 * Allowlist:
 *   - Full-file skip (meta-reference files that document the ban list)
 *   - Line-level pragma: `<!-- brand-voice:exempt — reason -->` suppresses
 *     violations on the same line OR the immediately following line.
 *     Pragma works in .md, .mdoc, and JSON files (it's just a substring match
 *     against the line).
 *
 * Adding a term: append to FORBIDDEN or MULTIPLIERS below. Regexes.
 * Adding an exempt file: append to FULL_FILE_ALLOWLIST (relative to repo root).
 * Adding a scanned surface: append to DEFAULT_GLOBS and/or SCANNABLE_EXTENSIONS.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { Glob } from 'bun';

const REPO_ROOT = resolve(import.meta.dir, '..');

type Pattern = { pattern: RegExp; label: string; category: 'forbidden' | 'multiplier' };

const FORBIDDEN: Pattern[] = [
  // v1.0 §11 entries
  { pattern: /\bguarantee(s|d)?\b/gi, label: 'guarantee/guarantees/guaranteed', category: 'forbidden' },
  { pattern: /\bfirst platform\b/gi, label: 'first platform', category: 'forbidden' },
  { pattern: /\bthe only (platform|system|tool|one)\b/gi, label: 'the only X', category: 'forbidden' },
  { pattern: /\bverified delivery( layer)?\b/gi, label: 'verified delivery', category: 'forbidden' },
  { pattern: /\bproduction[-\s]ready\b/gi, label: 'production-ready', category: 'forbidden' },
  { pattern: /\btrustworthy enough\b/gi, label: 'trustworthy enough', category: 'forbidden' },
  { pattern: /\bsafe to ship\b/gi, label: 'safe to ship', category: 'forbidden' },
  { pattern: /\brevolutioniz(e|es|ed|ing)\b/gi, label: 'revolutionize', category: 'forbidden' },
  { pattern: /\bgame[-\s]changing\b/gi, label: 'game-changing', category: 'forbidden' },
  { pattern: /\bleverag(e|es|ed|ing)\b/gi, label: 'leverage', category: 'forbidden' },
  { pattern: /\bsynergy\b/gi, label: 'synergy', category: 'forbidden' },
  { pattern: /\bsupercharg(e|es|ed|ing)\b/gi, label: 'supercharge', category: 'forbidden' },
  { pattern: /\bempower(s|ed|ing|ment)?\b/gi, label: 'empower/empowered/empowerment', category: 'forbidden' },
  { pattern: /\bseamless(ly)?\b/gi, label: 'seamless/seamlessly', category: 'forbidden' },
  // v1.1 §11 entries
  { pattern: /\bagentic\b/gi, label: 'agentic (Matt\'s public hill)', category: 'forbidden' },
  { pattern: /\boperating system for AI engineering\b/gi, label: 'operating system for AI engineering (crowded cliché)', category: 'forbidden' },
  { pattern: /\bcompounding flywheel\b/gi, label: 'compounding flywheel (stale VC vocabulary)', category: 'forbidden' },
  // v1.2 §11 entries (added 2026-04-19)
  { pattern: /\boperational layer\b/gi, label: 'operational layer (Netlify-register collision)', category: 'forbidden' },
  { pattern: /\bobservability for AI( agents| coding)?\b/gi, label: 'observability for AI agents (Langfuse/Arize own it)', category: 'forbidden' },
  { pattern: /\bproduction[-\s]grade\b/gi, label: 'production-grade (JFrog/Endor own it)', category: 'forbidden' },
  { pattern: /\bAI[-\s]generated (code|systems?|software|content)\b/gi, label: 'AI-generated [X] as primary noun (orphans non-code packs)', category: 'forbidden' },
  { pattern: /\bAI[-\s]built (software|systems?)\b/gi, label: 'AI-built software/systems (orphans non-code packs)', category: 'forbidden' },
  // v1.5 §11 — register-restricted (platform-partner only per §9.3); suppress legitimate
  // uses via FULL_FILE_ALLOWLIST or line pragma `<!-- brand-voice:exempt — §9.3 platform-partner register -->`.
  { pattern: /\bcognition layer\b/gi, label: 'cognition layer (platform-partner register only — §9.3)', category: 'forbidden' },
  { pattern: /\bcamada de cogni[çc][ãa]o\b/gi, label: 'camada de cognição (pt-br — platform-partner register only, §9.3)', category: 'forbidden' },
];

const MULTIPLIERS: Pattern[] = [
  // Numeric N× forms (velocity-claim v1.1 memory)
  { pattern: /\b200\s?×\b/g, label: '200× multiplier', category: 'multiplier' },
  { pattern: /\b33\s?×\b/g, label: '33× multiplier', category: 'multiplier' },
  { pattern: /\b6\s?×\b/g, label: '6× multiplier', category: 'multiplier' },
  { pattern: /\b2-4\s?×\b/g, label: '2-4× multiplier', category: 'multiplier' },
  { pattern: /\bwork of (10|ten|3|three)\b/gi, label: 'work of N', category: 'multiplier' },
  { pattern: /\b(3|three) people (do|doing)\b/gi, label: '3 people doing/do', category: 'multiplier' },
  { pattern: /\bteams of (3|three) doing\b/gi, label: 'teams of 3 doing', category: 'multiplier' },
  { pattern: /\bequivalent of hiring \d+/gi, label: 'equivalent of hiring N', category: 'multiplier' },
  // Bare verb/noun forms — catches "multiplies your team", "productivity multiplier",
  // "Install, Configure, Multiply". Does NOT match "multiple", "multiples", "multiplex",
  // "multiplexer", "multiplication" — the alternation enumerates valid suffixes only.
  { pattern: /\bmultipl(ies|ier|iers|y|ying|ied)\b/gi, label: 'bare multiplier verb/noun (multiplies/multiplier/multiply/multiplying/multiplied)', category: 'multiplier' },
];

// Files that document the ban list itself — skipping entirely.
const FULL_FILE_ALLOWLIST: string[] = [
  'Docs/brand-audit-scorecard.md',
  'Docs/GTM/Messaging/POSITIONING.md',
  'Docs/GTM/Messaging/brand-dna.md',
  'Docs/GTM/Messaging/SDLC-LENS.md',
  'Docs/Lucas/BRAND.md',
  'Packs/brand/src/Tools/validate-brand-voice.ts',
  // .dos-projects.json — operator's project registry. Contains literal
  // filesystem paths (e.g. agentic-store) that are physical directory
  // names, not brand prose. Brand-voice rules don't apply to a config
  // registry of paths the operator chose on their own machine.
  'Tools/.dos-projects.json',
  // Cockburn skill — verbatim quotation from Writing Effective Use Cases
  // (2000) by Alistair Cockburn. "Minimal Guarantees" / "Success Guarantees"
  // are canonical use case template field names, not marketing prose.
  'Packs/cockburn/src/Principles.md',
  'Packs/cockburn/src/Workflows/WriteUseCase.md',
  // Pragmatic skill — verbatim quotation from The Pragmatic Programmer
  // (1999, 20th Anniv 2019) by Andy Hunt + Dave Thomas. The book's
  // verbatim Tip wording uses words like "leverage" that the brand-voice
  // gate flags but which are canonical in the source.
  'Packs/pragmatic/src/Principles.md',
  // VoiceChannelingSkill template — meta-document that catalogues the
  // banned-vocabulary precedents from earlier voice-channeling skill runs
  // (Cockburn=Guarantees, Fowler=multiplies, Pragmatic=leverage). The
  // template REFERS to those terms to teach future skill authors the
  // allowlist-addition pattern; it is not marketing prose.
  'Packs/utilities/src/CreateSkill/Templates/VoiceChannelingSkill.md',
  // voice-channeling-ip-policy — sibling meta-document for the same
  // template family. Catalogues the FORBIDDEN-list terms by name
  // (guarantee, leverage, etc.) to teach future skill authors the
  // verbatim/paraphrase tagging stance and the own-prose grep recipe.
  // Same allowlist-as-meta-document case as VoiceChannelingSkill.md.
  'Packs/utilities/src/CreateSkill/Templates/voice-channeling-ip-policy.md',
  // RFC-0073 — defines "Operational Layer" as the entity-of-discourse
  // for MemPalace's hygiene/health surface (autonomous Gardener, soak
  // gates, KG health_score). The phrase is the doc's subject, not
  // marketing prose. Banning it inside its own definition makes the
  // RFC unwriteable.
  'Plans/Specs/RFC-0073-mempalace-operational-layer-and-published-language-staging.md',

  // DESIGN/Artifacts/ + Docs/Artifacts/ — design-system + artifact-spec
  // corpora. Reference operator-machine project names (agentic-store,
  // donne, etc. from .dos-projects.json) as literal data, and use
  // "guaranteed" / "guarantees" in technical contexts (POSIX O_APPEND
  // atomicity, RFC-0062 quarantine semantics). Not marketing prose.
  'DESIGN/Artifacts/atoms/jsonl-field.md',
  'DESIGN/Artifacts/molecules/drawer.md',
  'DESIGN/Artifacts/organisms/wing-collection.md',
  'DESIGN/Artifacts/templates/mempalace-wing-taxonomy.md',
  'DESIGN/Artifacts/templates/studio-sync-surface-contract.md',
  'Docs/Artifacts/atoms/jsonl-field.md',
  'Docs/Artifacts/molecules/drawer.md',
  'Docs/Artifacts/organisms/wing-collection.md',
  'Docs/Artifacts/templates/mempalace-wing-taxonomy.md',
  'Docs/Artifacts/templates/studio-sync-surface-contract.md',

  // stream-rig pack — livestream operations skill. The "content multiplier"
  // phrase is the pack's load-bearing product description (a single
  // recording fans out to 7 deliverables across 5 channels). Renaming
  // would break the pack's primary intent vocabulary.
  'Packs/stream-rig/INSTALL.md',
  'Packs/stream-rig/README.md',
  'Packs/stream-rig/src/SKILL.md',
  'Packs/stream-rig/src/SKILL.partials.md',
  'Packs/stream-rig/src/Workflows/PostStream.md',
];

// Directory prefixes that are always skipped (memory artifacts, research vaults, PRDs).
const DIR_PREFIX_ALLOWLIST: string[] = [
  'MEMORY/',
  'node_modules/',
  '.git/',
  'Releases/',
  // Atomic-design catalog corpus — 85-spec artifact-type catalog + IDE-dark
  // design system + LLM-readable index layer. Council-ratified 2026-05-13;
  // 5-seat verdict at MEMORY/WORK/20260513-023538_atomic-artifact-specs/PRD.md.
  // Internal documentation, not customer-facing brand copy — forbidden-word
  // matches are technical terms in spec context (e.g., "agentic" as part of
  // the literal wing name `agentic-store`, "guaranteed" as a 404 status-code
  // contract). Mirrors precedent 9129ee2e (same corpus allowlisted for
  // secret-scan when authored at DESIGN/Artifacts/ + Docs/Artifacts/).
  'Docs/AtomicDesign/',
  // RFC-0006 Phase 6 (2026-04-18) consolidated the Phase[1-2]/Source/
  // staging dirs out of the repo root — historical brand-voice exemption
  // entries (`Phase1/Source/`, `Phase2/Source/`) removed alongside.
  // Partial-using SKILL.md sources now live at Packs/<Family>/src/<Pack>/
  // SKILL.partials.md and are exempt via their MEMORY/ARCHIVE/ ancestry
  // when relevant; see RFC-0006 §12.5.
  'Plans/Specs/moat-relocation-2026-04-17.md',
];

const EXEMPT_PRAGMA = /<!--\s*brand-voice:exempt(\s*(—|--|-).*)?-->/;

type Violation = {
  file: string;
  line: number;
  column: number;
  term: string;
  category: 'forbidden' | 'multiplier';
  snippet: string;
};

function isAllowedFile(relPath: string): boolean {
  if (FULL_FILE_ALLOWLIST.includes(relPath)) return true;
  return DIR_PREFIX_ALLOWLIST.some(prefix => relPath.startsWith(prefix) || relPath === prefix.replace(/\/$/, ''));
}

// Generic line-scanner: shared by the DOS self-governance default mode and the
// --project mode (ISC-28). Pragma suppression + snippet logic preserved verbatim
// from the original scanFile; only the pattern list is parameterized.
function scanFileWithPatterns(absPath: string, relPath: string, patterns: Pattern[]): Violation[] {
  const content = readFileSync(absPath, 'utf8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const prevLine = i > 0 ? lines[i - 1]! : '';
    // Line-level pragma suppresses same-line or next-line
    if (EXEMPT_PRAGMA.test(line) || EXEMPT_PRAGMA.test(prevLine)) continue;

    for (const { pattern, label, category } of patterns) {
      pattern.lastIndex = 0; // regex-state reset (regexes are module-scope with /g flag)
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(line)) !== null) {
        violations.push({
          file: relPath,
          line: i + 1,
          column: m.index + 1,
          term: label,
          category,
          snippet: line.length > 160 ? line.slice(0, 80) + '…' + line.slice(m.index, m.index + 80) : line,
        });
      }
    }
  }

  return violations;
}

// DOS self-governance scan (default/--staged/--full/--paths modes): POSITIONING.md
// §11 FORBIDDEN + velocity MULTIPLIERS. Unchanged contract — thin delegate.
function scanFile(absPath: string, relPath: string): Violation[] {
  return scanFileWithPatterns(absPath, relPath, [...FORBIDDEN, ...MULTIPLIERS]);
}

// Scannable extensions. Kept narrow to avoid scanning generated files, lockfiles, etc.
// `.json` is scanned only for files matched by the default globs below (i18n messages) or
// explicitly staged — not arbitrary JSON in the repo.
const SCANNABLE_EXTENSIONS = ['.md', '.mdoc', '.json'] as const;

// Default-mode scan globs. Each glob is scanned and the union is deduped.
const DEFAULT_GLOBS = [
  'Docs/**/*.md',
  'Platform/studio/apps/web/i18n/messages/*/landing.json',
  'Platform/studio/apps/web/content/documentation/**/*.mdoc',
] as const;

function isScannableExtension(path: string): boolean {
  return SCANNABLE_EXTENSIONS.some(ext => path.endsWith(ext));
}

function getStagedFiles(): string[] {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) return [];
  return result.stdout.split('\n').filter(f => f.length > 0 && isScannableExtension(f));
}

async function getAllScannableFiles(): Promise<string[]> {
  const seen = new Set<string>();
  for (const pattern of DEFAULT_GLOBS) {
    const glob = new Glob(pattern);
    for await (const f of glob.scan({ cwd: REPO_ROOT })) {
      seen.add(f as string);
    }
  }
  return [...seen];
}

async function getPathsMatching(patterns: string[]): Promise<string[]> {
  const seen = new Set<string>();
  for (const pattern of patterns) {
    const glob = new Glob(pattern);
    for await (const f of glob.scan({ cwd: REPO_ROOT })) {
      if (isScannableExtension(f as string)) seen.add(f as string);
    }
  }
  return [...seen];
}

// ─── --project mode (ISC-28/29) ──────────────────────────────────────────────
// Lints a GENERATED brand's copy against THAT project's VoiceGuide forbidden
// list — NOT DOS's own POSITIONING.md §11. The whole point: an EXPLICIT project
// root (`--project <dir>`), never `import.meta.dir/..` inference (which resolves
// to the DOS repo and makes the default mode a DOS-self-governance linter, not a
// check of a customer project's copy). This is a self-contained code path; it
// shares only the line-scanner (scanFileWithPatterns) with the default mode and
// touches neither REPO_ROOT nor the DOS-monorepo allowlists.

// VoiceGuide candidate locations within a generated project, priority order.
// Convention: Verbal/VoiceGuide documents the brand's verbal identity; the brand
// definition hub (Strategy/Define → Docs/brand-definition.md) may also carry it.
const PROJECT_VOICE_GUIDE_CANDIDATES = [
  'Docs/brand-voice.md',
  'Docs/brand-messaging/voice-guide.md',
  'Docs/brand-messaging/brand-voice.md',
  'brand-voice.md',
  'Docs/brand-definition.md',
] as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function relFrom(root: string, abs: string): string {
  return relative(root, abs).split('\\').join('/');
}

function findVoiceGuide(projectRoot: string, override?: string): string | null {
  if (override) {
    const abs = resolve(projectRoot, override);
    return existsSync(abs) && statSync(abs).isFile() ? abs : null;
  }
  for (const rel of PROJECT_VOICE_GUIDE_CANDIDATES) {
    const abs = resolve(projectRoot, rel);
    if (existsSync(abs) && statSync(abs).isFile()) return abs;
  }
  return null;
}

function splitTableRow(line: string): string[] | null {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  return t.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
}

function cleanTerm(cell: string): string {
  // Strip surrounding quotes/backticks/emphasis markers; collapse whitespace.
  return cell
    .trim()
    .replace(/^["'`*_“‘]+/, '')
    .replace(/["'`*_”’]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse a project VoiceGuide into forbidden-vocabulary patterns. Two recognized
// conventions, both produced by Verbal/VoiceGuide:
//   1. The "We Don't Say" column of a markdown table (Step 4 We-Say/Don't-Say list).
//   2. A bulleted list under a heading matching /forbidden|avoid|don't say|banned/i.
// Each harvested term becomes a case-insensitive word-boundary regex.
function parseVoiceGuideForbidden(voiceGuidePath: string): { terms: string[]; patterns: Pattern[] } {
  const lines = readFileSync(voiceGuidePath, 'utf8').split('\n');
  const terms = new Set<string>();
  const isDontSayHeader = (c: string) => /\b(we\s+)?don['’]?t\s+say\b/i.test(c) || /^avoid$/i.test(c.trim());

  // Strategy 1 — "We Don't Say" table column.
  let dontSayCol = -1;
  for (const raw of lines) {
    const cells = splitTableRow(raw);
    if (!cells) { dontSayCol = -1; continue; } // table boundary
    if (cells.every(c => /^:?-+:?$/.test(c.trim()))) continue; // separator row
    const headerIdx = cells.findIndex(isDontSayHeader);
    if (headerIdx !== -1) { dontSayCol = headerIdx; continue; } // header row
    if (dontSayCol !== -1 && cells[dontSayCol]) {
      const term = cleanTerm(cells[dontSayCol]!);
      if (term) terms.add(term);
    }
  }

  // Strategy 2 — bulleted forbidden section.
  let inForbidden = false;
  for (const raw of lines) {
    if (/^#{1,6}\s/.test(raw)) {
      inForbidden = /forbidden|words?\s+to\s+avoid|do\s+not\s+use|banned|don['’]?t\s+say/i.test(raw);
      continue;
    }
    if (inForbidden) {
      const m = raw.match(/^\s*[-*]\s+(.+)$/);
      if (m) {
        const term = cleanTerm(m[1]!);
        if (term) terms.add(term);
      }
    }
  }

  const patterns: Pattern[] = [...terms].map(t => ({
    pattern: new RegExp('\\b' + escapeRegExp(t) + '\\b', 'gi'),
    label: `${t} (project VoiceGuide: do not say)`,
    category: 'forbidden' as const,
  }));
  return { terms: [...terms], patterns };
}

type ProjectModeOpts = { jsonMode: boolean; voiceGuide?: string; paths: string[] };

async function runProjectMode(projectDir: string, opts: ProjectModeOpts): Promise<number> {
  const projectRoot = resolve(projectDir);
  if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
    console.error(`--project: directory not found: ${projectRoot}`);
    return 2;
  }

  const guideAbs = findVoiceGuide(projectRoot, opts.voiceGuide);
  if (!guideAbs) {
    // No VoiceGuide ⇒ nothing to enforce. Exit clean so the mode is portable to
    // a bare/temp project (and the DOS repo is never inferred as a fallback).
    if (opts.jsonMode) {
      console.log(JSON.stringify({ mode: 'project', projectRoot, voiceGuide: null, forbiddenTerms: [], scanned: 0, totalViolations: 0, violations: [] }, null, 2));
    } else {
      console.log(`✓ brand-voice[project]: no VoiceGuide under ${projectRoot} (looked for: ${PROJECT_VOICE_GUIDE_CANDIDATES.join(', ')}). Nothing to enforce.`);
    }
    return 0;
  }

  const guideRel = relFrom(projectRoot, guideAbs);
  const { terms, patterns } = parseVoiceGuideForbidden(guideAbs);
  if (patterns.length === 0) {
    if (opts.jsonMode) {
      console.log(JSON.stringify({ mode: 'project', projectRoot, voiceGuide: guideRel, forbiddenTerms: [], scanned: 0, totalViolations: 0, violations: [] }, null, 2));
    } else {
      console.log(`✓ brand-voice[project]: ${guideRel} declares no "We Don't Say"/forbidden terms. Nothing to enforce.`);
    }
    return 0;
  }

  // Scan surfaces: explicit --paths (relative to <dir>), else the project's Markdown.
  const globs = opts.paths.length > 0 ? opts.paths : ['Docs/**/*.md', '*.md'];
  const seen = new Set<string>();
  for (const pattern of globs) {
    const glob = new Glob(pattern);
    for await (const f of glob.scan({ cwd: projectRoot })) {
      if (isScannableExtension(f as string)) seen.add(f as string);
    }
  }
  seen.delete(guideRel); // never lint the VoiceGuide against itself

  const allViolations: Violation[] = [];
  let scannedCount = 0;
  for (const relPath of seen) {
    if (relPath.startsWith('node_modules/') || relPath.startsWith('.git/')) continue;
    const abs = resolve(projectRoot, relPath);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    scannedCount++;
    allViolations.push(...scanFileWithPatterns(abs, relPath, patterns));
  }

  if (opts.jsonMode) {
    console.log(JSON.stringify({
      mode: 'project',
      projectRoot,
      voiceGuide: guideRel,
      forbiddenTerms: terms,
      scanned: scannedCount,
      totalViolations: allViolations.length,
      violations: allViolations,
    }, null, 2));
    return allViolations.length === 0 ? 0 : 1;
  }

  if (allViolations.length === 0) {
    console.log(`✓ brand-voice[project]: ${scannedCount} file(s) scanned against ${terms.length} forbidden term(s) from ${guideRel}, 0 violations`);
    return 0;
  }

  console.error(`✗ brand-voice[project]: ${allViolations.length} violation(s) across ${new Set(allViolations.map(v => v.file)).size} file(s) (forbidden list from ${guideRel})\n`);
  const byFile = new Map<string, Violation[]>();
  for (const v of allViolations) {
    const arr = byFile.get(v.file) ?? [];
    arr.push(v);
    byFile.set(v.file, arr);
  }
  for (const [file, vs] of byFile) {
    console.error(`  ${file}`);
    for (const v of vs) {
      console.error(`    ${v.line}:${v.column}  [${v.category}]  ${v.term}`);
      console.error(`      ${v.snippet.trim()}`);
    }
    console.error('');
  }
  console.error(`Fix: rephrase per the project VoiceGuide "We Say" column.`);
  console.error(`Exempt a line: add <!-- brand-voice:exempt — reason --> on that line or the line above.`);
  return 1;
}

function printHelp(): void {
  console.log(`validate-brand-voice — DOS brand voice linter

USAGE
  bun Tools/validate-brand-voice.ts [--staged | --full | --paths <globs>] [--json] [--help]
  bun Tools/validate-brand-voice.ts --project <dir> [--voice-guide <path>] [--paths <globs>] [--json]

TWO SCOPES
  DOS self-governance (default/--staged/--full/--paths): scans THIS DOS monorepo
    against POSITIONING.md §11 (the hardcoded FORBIDDEN/MULTIPLIERS below).
  Project (--project <dir>): scans a GENERATED brand's copy against THAT project's
    own VoiceGuide forbidden list. Portable — never infers the DOS repo root.

MODES
  (default)         Scan git-staged files with scannable extensions (PRD-A ISC-2,
                    flipped 2026-05-13). Same as --staged.
  --staged          Explicit form of the default. Back-compat with pre-commit Gate 3.
  --full            Scan canonical surfaces (was the pre-2026-05-13 default):
                      Docs/**/*.md
                      Platform/studio/apps/web/i18n/messages/*/landing.json
                      Platform/studio/apps/web/content/documentation/**/*.mdoc
                    Use for nightly/CI sweeps.
  --paths <globs>   Scan explicit glob patterns (e.g. new pack pre-flight before git add)
                      Example: --paths 'Packs/MyPack/src/**/*.md'
  --project <dir>   Lint a generated brand at <dir> against ITS OWN VoiceGuide
                    "We Don't Say" list (ISC-28/29). Forbidden terms are derived
                    from the project's VoiceGuide, NOT POSITIONING.md. Uses <dir>
                    as an explicit root — never import.meta.dir/.. inference.
                    VoiceGuide auto-discovered at (first match):
                      Docs/brand-voice.md, Docs/brand-messaging/voice-guide.md,
                      Docs/brand-messaging/brand-voice.md, brand-voice.md,
                      Docs/brand-definition.md
                    No VoiceGuide ⇒ nothing to enforce ⇒ exit 0.
  --voice-guide <p> Override the VoiceGuide path (relative to <dir> or absolute).
                    Only meaningful with --project.
  --json            Machine-readable JSON output
  --help            Print this help

EXIT CODES
  0  No violations
  1  Violations found

ALLOWLIST
  Files that document the ban list itself are skipped entirely.
  See FULL_FILE_ALLOWLIST in Tools/validate-brand-voice.ts.

LINE-LEVEL EXEMPTION
  Add this on the line before or same line as a violation to suppress it:
    <!-- brand-voice:exempt — reason here -->
  Works in .md, .mdoc, and JSON files (line-level substring match).
  For register-restricted terms (e.g. "cognition layer" is §9.3 platform-partner
  only), use: <!-- brand-voice:exempt — §9.3 platform-partner register -->

SOURCE OF TRUTH
  POSITIONING.md §11 Forbidden (v1.0 base + v1.1 + v1.2 + v1.5 register-restricted)
  + velocity-claim v1.1 memory (multipliers, including bare verb/noun forms).
  To add a term, append to FORBIDDEN[] or MULTIPLIERS[] in this file.
  To scan another surface, append to DEFAULT_GLOBS and (if a new extension)
  SCANNABLE_EXTENSIONS.`);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  // PRD-A ISC-2 (2026-05-13): default scope is staged. --full opts back into
  // the pre-2026-05-13 canonical-surface scan for nightly/CI use.
  const fullMode = args.includes('--full');
  const stagedFlag = args.includes('--staged');
  const jsonMode = args.includes('--json');

  // --project <dir> (ISC-28/29): lint a GENERATED brand's copy against THAT
  // project's VoiceGuide forbidden list, using an EXPLICIT root. Distinct code
  // path — returns before any REPO_ROOT/staged/full logic runs. Default mode is
  // unchanged when --project is absent.
  const projectIdx = args.indexOf('--project');
  if (projectIdx !== -1) {
    const projectDir = args[projectIdx + 1];
    if (!projectDir || projectDir.startsWith('--')) {
      console.error('--project requires a directory argument: --project <dir>');
      return 1;
    }
    const vgIdx = args.indexOf('--voice-guide');
    const voiceGuide = vgIdx !== -1 ? args[vgIdx + 1] : undefined;
    const pIdx = args.indexOf('--paths');
    const projPaths = pIdx !== -1 ? args.slice(pIdx + 1).filter(a => !a.startsWith('--')) : [];
    return runProjectMode(projectDir, { jsonMode, voiceGuide, paths: projPaths });
  }

  // --paths consumes the remaining positional args after the flag, treating each
  // as a glob to scan (useful for new-pack pre-flight before git add).
  const pathsIdx = args.indexOf('--paths');
  const pathsMode = pathsIdx !== -1;
  const pathArgs = pathsMode
    ? args.slice(pathsIdx + 1).filter(a => !a.startsWith('--'))
    : [];

  // Effective mode: --paths > --full > staged (default).
  // --staged is back-compat noise (same as default) and is honored explicitly.
  const stagedMode = !pathsMode && !fullMode;

  let files: string[];
  if (pathsMode) {
    if (pathArgs.length === 0) {
      console.error('--paths requires at least one glob argument');
      return 1;
    }
    files = await getPathsMatching(pathArgs);
  } else if (fullMode) {
    files = await getAllScannableFiles();
  } else {
    // staged-by-default (PRD-A ISC-2). Honors --staged for explicit callers.
    void stagedFlag;
    files = getStagedFiles();
  }

  const allViolations: Violation[] = [];
  let scannedCount = 0;
  let skippedCount = 0;

  for (const relPath of files) {
    const abs = resolve(REPO_ROOT, relPath);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    if (isAllowedFile(relPath)) {
      skippedCount++;
      continue;
    }
    scannedCount++;
    const fileViolations = scanFile(abs, relPath);
    allViolations.push(...fileViolations);
  }

  if (jsonMode) {
    const mode = pathsMode ? 'paths' : (fullMode ? 'full' : 'staged');
    console.log(JSON.stringify({
      mode,
      scanned: scannedCount,
      skipped: skippedCount,
      totalViolations: allViolations.length,
      violations: allViolations,
    }, null, 2));
    return allViolations.length === 0 ? 0 : 1;
  }

  // Human output
  if (allViolations.length === 0) {
    console.log(`✓ brand-voice: ${scannedCount} file(s) scanned, 0 violations (${skippedCount} file(s) skipped via allowlist)`);
    return 0;
  }

  console.error(`✗ brand-voice: ${allViolations.length} violation(s) across ${new Set(allViolations.map(v => v.file)).size} file(s)\n`);
  const byFile = new Map<string, Violation[]>();
  for (const v of allViolations) {
    const arr = byFile.get(v.file) ?? [];
    arr.push(v);
    byFile.set(v.file, arr);
  }
  for (const [file, vs] of byFile) {
    console.error(`  ${file}`);
    for (const v of vs) {
      console.error(`    ${v.line}:${v.column}  [${v.category}]  ${v.term}`);
      console.error(`      ${v.snippet.trim()}`);
    }
    console.error('');
  }
  console.error(`Fix: remove or rephrase per POSITIONING.md §11.`);
  console.error(`Exempt a line: add <!-- brand-voice:exempt — reason --> on that line or the line above.`);
  console.error(`Exempt a file: add to FULL_FILE_ALLOWLIST in Tools/validate-brand-voice.ts.`);
  console.error(`Bypass (discouraged): git commit --no-verify`);
  return 1;
}

// Natural exit (exitCode, not process.exit) — under Bun, process.exit() after
// console.log truncates a piped stdout mid-flush (the --json contract broke
// exactly this way: empty stdout at the test's JSON.parse). No keep-alive
// handles exist here, so setting exitCode exits promptly with streams flushed.
main().then(code => { process.exitCode = code; }).catch(err => {
  console.error('validate-brand-voice: error:', err?.message || err);
  process.exitCode = 2;
});
