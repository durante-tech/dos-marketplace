#!/usr/bin/env bun
/**
 * ValidateFileWrites.ts — Sentinel lint: enforce writeArtifact() discipline
 *
 * PROBLEM
 * -------
 * Skills that call `fs.writeFileSync` (or Bun.write, createWriteStream, etc.)
 * directly from their Tools bypass Claude Code's PostToolUse hooks. The
 * StreamEventDispatcher never sees those writes, so Studio gets no Artifact
 * row — even though the skill may have consumed Studio credits producing
 * the output. The canonical example: `media` saving a generated image to
 * ~/Downloads/. Gateway billed the generation; Artifact table is empty.
 *
 * THE RULE
 * --------
 * Any skill Tool that produces a user-visible output file MUST use
 * `hooks/lib/writeArtifact.ts`. Scratch/internal writes (session state,
 * sync-drift logs, tmpdir) are still allowed via plain fs.
 *
 * THIS TOOL
 * ---------
 * Walks every ~/.claude/skills/<Skill>/Tools/*.ts file and classifies
 * each file-write call site into three buckets:
 *
 *   SCRATCH  — writes to known internal/scratch paths. Plain fs is OK.
 *   EXEMPT   — writes marked with `// writeArtifact:exempt` pragma.
 *   FLAGGED  — everything else. Should be using writeArtifact().
 *
 * Prints a per-skill summary + detail table. Exits 1 when any FLAGGED
 * hits exist (wire into CI / pre-commit); 0 when clean.
 *
 * Usage:
 *   bun Tools/ValidateFileWrites.ts                  # scan ~/.claude/skills/
 *   bun Tools/ValidateFileWrites.ts --root <dir>     # override scan root
 *   bun Tools/ValidateFileWrites.ts --json           # machine-readable
 *
 * Exit codes:
 *   0  — no FLAGGED hits
 *   1  — at least one FLAGGED hit
 *   2  — bad args / no files found
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ─────────────────────────────────────────────────────────────────────
// Patterns
// ─────────────────────────────────────────────────────────────────────

// Write syscalls we care about. All are function-call shapes.
// `writeArtifact(` is excluded — that's the sanctioned helper.
// `appendFileSync(` is NOT flagged — append-only logs are scratch by nature.
const WRITE_CALL_RE =
  /\b(writeFileSync|writeFile|createWriteStream|Bun\.write|promises\.writeFile)\s*\(/;

// Path literals that indicate scratch/internal writes. If the line contains
// any of these and there's a literal string path arg, auto-classify as SCRATCH.
const SCRATCH_PATH_HINTS = [
  /\bMEMORY\/STATE\//,
  /\.sentinel\//,
  /\btmpdir\s*\(\)/,
  /\bos\.tmpdir\b/,
  /\/tmp\//,
  /\/var\/tmp\//,
  /\.pending\//,
  /\.streaming\//,
  /\.unfsynced\//,
  /\.quarantine\//,
  /\bhook-timing\.jsonl\b/,
  /\bsync-drift-/,
  /\bhook-bg\.jsonl\b/,
  /\balgorithm-reflections\.jsonl\b/,
  /\bratings\.jsonl\b/,
  /\bvoice-events\.jsonl\b/,
  /\bartifacts\.jsonl\b/,
  /\bhistory\.jsonl\b/,
  /\/\.cache\//,
  /\.gen\.json$/,
  /\.lock$/,
  /\.lockdir\b/,
  /\.log$/,
  /\/null\b/, // /dev/null
  /\.tmp-\$\{process\.pid\}/,  // atomic tmp-then-rename pattern
  /\.tmp['"`]/, // literal ".tmp" suffix
];

const EXEMPT_PRAGMA = /\/\/\s*writeArtifact:\s*exempt\b/i;

// Files allowlisted because they are infrastructure, not skills producing
// artifacts (the helper itself, test harnesses, examples).
const PATH_ALLOWLIST = [
  /\/writeArtifact\.ts$/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\/templates?\//i,
  /Template\//,  // e.g., Telos/DashboardTemplate/ — scaffold files that get copied to user apps
  /\/examples?\//i,
  /\/fixtures?\//i,
  /\/Save[A-Z]\w+ToStudio\.ts$/, // iter-1 DLQ infrastructure, not skill-artifact producers
];

// Skills that are DEVELOPER TOOLING, not producers of user-visible artifacts.
// Their writes are internal state (scan reports, skill scaffolding, eval
// infrastructure, agent configs). Auto-classified as EXEMPT without pragmas.
//
// Add a skill here only when you're confident NONE of its outputs are
// things the user would expect to see as an Artifact row in Studio. For
// skills with mixed output, pragma the scratch writes individually.
const SKILL_ALLOWLIST: ReadonlySet<string> = new Set([
  'Sentinel',           // Scan reports + convention cache — self-analysis
  'Agents',             // Agent configs — infrastructure
  'MemPalace',          // KG state — separately synced via SaveKgToStudio
  'Utilities/CreateSkill',  // Skill scaffolding — dev tooling
  'Utilities/Evals',        // Eval infrastructure — dev tooling
  'Utilities/Parser',       // Parsing state — dev tooling
]);

function isAllowlistedSkill(skill: string): boolean {
  if (SKILL_ALLOWLIST.has(skill)) return true;
  // also match nested sub-skill prefixes like "Utilities/Evals/..."
  for (const allow of SKILL_ALLOWLIST) {
    if (skill === allow || skill.startsWith(allow + '/')) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────
// Args
// ─────────────────────────────────────────────────────────────────────

interface Args {
  root: string;
  json: boolean;
  /**
   * Layout mode for the scan tree.
   *   `skills` — root is a `~/.claude/skills/`-shaped tree (Skill/Tools/X.ts).
   *   `packs`  — root is a `Packs/`-shaped tree (Family/src/[SubPack/]Tools/X.ts).
   * Auto-detect: any root whose basename is "Packs" defaults to `packs`.
   */
  mode: 'skills' | 'packs';
}

function parseArgs(argv: string[]): Args {
  let root = join(homedir(), '.claude', 'skills');
  let json = false;
  let mode: 'skills' | 'packs' | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--root' && argv[i + 1]) {
      root = argv[i + 1]!;
      i += 1;
    } else if (a === '--mode' && argv[i + 1]) {
      const m = argv[i + 1]!;
      if (m === 'skills' || m === 'packs') {
        mode = m;
      } else {
        console.error(`unknown --mode value: ${m} (expected 'skills' or 'packs')`);
        process.exit(2);
      }
      i += 1;
    }
  }
  if (mode === null) {
    // Auto-detect: ".../Packs" or ".../Packs/" → packs mode; else skills mode.
    const basename = root.replace(/\/+$/, '').split('/').pop() ?? '';
    mode = basename === 'Packs' ? 'packs' : 'skills';
  }
  return { root, json, mode };
}

// ─────────────────────────────────────────────────────────────────────
// File walker
// ─────────────────────────────────────────────────────────────────────

function isToolsTsFile(path: string): boolean {
  if (!path.endsWith('.ts')) return false;
  if (PATH_ALLOWLIST.some((re) => re.test(path))) return false;
  return true;
}

/**
 * In packs mode, scope the scan to *Tools/* directories — the canonical
 * location for runnable pack code. Workflows/, Partials/, DashboardTemplate/,
 * Lib/, Hooks/ etc. host different concerns (prose, scaffolds, hook-bound
 * code that PostToolUse already covers) and would balloon the false-positive
 * rate. Pack lib code that genuinely produces artifacts gets pulled into
 * Tools/ by convention; if it lives elsewhere, opt it in via --root override.
 */
function isPackToolsTsFile(path: string): boolean {
  if (!path.endsWith('.ts')) return false;
  if (PATH_ALLOWLIST.some((re) => re.test(path))) return false;
  return /\/Tools\//.test(path);
}

function walkSkills(root: string, mode: 'skills' | 'packs'): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const accept = mode === 'packs' ? isPackToolsTsFile : isToolsTsFile;

  const walk = (dir: string, depth: number): void => {
    if (depth > 6) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      // __fixtures__/__mocks__ deliberately contain rule-violating code
      // (e.g. the R2-fail bad.hook.ts) — skip them like lint-skills does.
      if (name.startsWith('.') || name === 'node_modules' || name === '__fixtures__' || name === '__mocks__') continue;
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        walk(full, depth + 1);
      } else if (accept(full)) {
        out.push(full);
      }
    }
  };
  walk(root, 0);
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// Classification
// ─────────────────────────────────────────────────────────────────────

type Verdict = 'scratch' | 'exempt' | 'flagged';

interface Hit {
  file: string;
  line: number;
  snippet: string;
  call: string;
  verdict: Verdict;
  reason: string;
}

function classifyLine(line: string, prevLine: string, nextLine: string): {
  call: string;
  verdict: Verdict;
  reason: string;
} | null {
  const m = line.match(WRITE_CALL_RE);
  if (!m) return null;
  const call = m[1]!;

  // Exempt pragma on this line or adjacent ±1 line.
  if (EXEMPT_PRAGMA.test(line) || EXEMPT_PRAGMA.test(prevLine) || EXEMPT_PRAGMA.test(nextLine)) {
    return { call, verdict: 'exempt', reason: 'pragma' };
  }

  // Scratch hint on this line.
  for (const re of SCRATCH_PATH_HINTS) {
    if (re.test(line)) {
      return { call, verdict: 'scratch', reason: `hint:${re.source.slice(0, 40)}` };
    }
  }

  return { call, verdict: 'flagged', reason: 'no scratch hint, no pragma' };
}

function scanFile(path: string): Hit[] {
  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch {
    return [];
  }
  const lines = content.split('\n');
  const hits: Hit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const prev = lines[i - 1] ?? '';
    const next = lines[i + 1] ?? '';
    const classification = classifyLine(line, prev, next);
    if (!classification) continue;
    hits.push({
      file: path,
      line: i + 1,
      snippet: line.trim().slice(0, 120),
      ...classification,
    });
  }
  return hits;
}

// ─────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────

interface SkillReport {
  skill: string;
  counts: { scratch: number; exempt: number; flagged: number };
  flaggedHits: Hit[];
}

function skillOf(path: string, root: string, mode: 'skills' | 'packs'): string {
  const rel = path.slice(root.length + 1);
  const segments = rel.split('/');
  if (mode === 'packs') {
    // Pack layout: <Family>/src/[<SubPack>/]Tools/<file>.ts
    // Returns "Family" for top-level Tools, "Family/SubPack" for nested.
    if (segments.length >= 4 && segments[1] === 'src') {
      if (segments[2] === 'Tools') return segments[0]!;
      if (segments.length >= 5 && segments[3] === 'Tools') {
        return `${segments[0]}/${segments[2]}`;
      }
    }
    return segments[0] ?? rel;
  }
  // Skills layout (legacy): <Skill>/[Tools/]<file>.ts, with Utilities nesting.
  if (segments.length >= 2 && segments[0] === 'Utilities') {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0] ?? rel;
}

function aggregate(hits: Hit[], root: string, mode: 'skills' | 'packs'): SkillReport[] {
  const bySkill = new Map<string, SkillReport>();
  for (const h of hits) {
    const skill = skillOf(h.file, root, mode);
    // Auto-reclassify: skill-level allowlist demotes flagged → exempt.
    if (h.verdict === 'flagged' && isAllowlistedSkill(skill)) {
      h.verdict = 'exempt';
      h.reason = `skill-allowlist:${skill}`;
    }
    let rep = bySkill.get(skill);
    if (!rep) {
      rep = { skill, counts: { scratch: 0, exempt: 0, flagged: 0 }, flaggedHits: [] };
      bySkill.set(skill, rep);
    }
    rep.counts[h.verdict]++;
    if (h.verdict === 'flagged') rep.flaggedHits.push(h);
  }
  return [...bySkill.values()].sort((a, b) =>
    b.counts.flagged - a.counts.flagged || a.skill.localeCompare(b.skill),
  );
}

function printTable(reports: SkillReport[], root: string): number {
  let totalFlagged = 0;
  const dirty = reports.filter((r) => r.counts.flagged > 0);
  const clean = reports.filter((r) => r.counts.flagged === 0 && (r.counts.scratch + r.counts.exempt) > 0);

  console.log(`ValidateFileWrites — scanned ${reports.length} skill(s) under ${root}\n`);
  const nameWidth = Math.max(
    ...reports.map((r) => r.skill.length),
    'Skill'.length,
  );
  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));

  if (dirty.length > 0) {
    console.log(`${pad('Skill', nameWidth)}  Flagged  Scratch  Exempt`);
    console.log(`${'-'.repeat(nameWidth)}  -------  -------  ------`);
    for (const r of dirty) {
      console.log(
        `${pad(r.skill, nameWidth)}  ${pad(String(r.counts.flagged), 7)}  ` +
        `${pad(String(r.counts.scratch), 7)}  ${pad(String(r.counts.exempt), 6)}`,
      );
      totalFlagged += r.counts.flagged;
    }
    console.log('');
    console.log('Flagged call sites (should migrate to writeArtifact()):');
    for (const r of dirty) {
      for (const h of r.flaggedHits) {
        const rel = h.file.slice(root.length + 1);
        console.log(`  ${rel}:${h.line}  ${h.call}(  ← ${h.snippet}`);
      }
    }
    console.log('');
  }

  console.log(
    `Summary: ${totalFlagged} flagged, ` +
    `${reports.reduce((n, r) => n + r.counts.scratch, 0)} scratch (ok), ` +
    `${reports.reduce((n, r) => n + r.counts.exempt, 0)} exempt (ok) ` +
    `across ${dirty.length + clean.length} skill(s) with writes.`,
  );

  if (totalFlagged === 0) {
    console.log('PASS: every skill write is either routed through writeArtifact(), marked exempt, or targets a scratch path.');
  } else {
    console.error(
      `\nFAIL: ${totalFlagged} writes bypass writeArtifact(). Either:\n` +
      `  1. Replace the call with writeArtifact(path, content, { pack, ... })\n` +
      `  2. If the write is scratch/internal, add a pragma above the line:\n` +
      `        // writeArtifact:exempt — <reason>\n` +
      `  3. If the target path pattern is genuinely scratch (e.g., a new\n` +
      `     log file), add the regex to SCRATCH_PATH_HINTS in this file.`,
    );
  }

  return totalFlagged;
}

// ─────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────

function main(): number {
  const { root, json, mode } = parseArgs(process.argv.slice(2));
  const files = walkSkills(root, mode);
  if (files.length === 0) {
    console.error(`ValidateFileWrites: no .ts files found under ${root} (mode=${mode})`);
    return 2;
  }

  const allHits: Hit[] = [];
  for (const f of files) allHits.push(...scanFile(f));
  const reports = aggregate(allHits, root, mode);

  if (json) {
    const totalFlagged = reports.reduce((n, r) => n + r.counts.flagged, 0);
    console.log(
      JSON.stringify(
        {
          root,
          filesScanned: files.length,
          skills: reports.length,
          totalFlagged,
          totalScratch: reports.reduce((n, r) => n + r.counts.scratch, 0),
          totalExempt: reports.reduce((n, r) => n + r.counts.exempt, 0),
          reports,
          ok: totalFlagged === 0,
        },
        null,
        2,
      ),
    );
    return totalFlagged === 0 ? 0 : 1;
  }

  const flagged = printTable(reports, root);
  return flagged === 0 ? 0 : 1;
}

process.exit(main());
