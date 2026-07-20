#!/usr/bin/env bun
/// <reference types="node" />
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
/**
 * seed-personal-facts.ts — Extract personal/family/relational facts from
 * MEMORY/RELATIONSHIP and TELOS documents and emit them as MemPalace KG
 * triples (RFC-0028 §5.3 deliverable).
 *
 * The 2026-04-25 acceptance battery surfaced that the live KG holds 9 facts
 * about Lucas — none of them family or personal-relationship facts. The MCP
 * surface returns nothing useful for queries like "who is Lucas's partner"
 * or "where does Lucas live" because the facts were never seeded. This tool
 * is the one-shot seeder.
 *
 * USAGE:
 *   bun seed-personal-facts.ts --help
 *   bun seed-personal-facts.ts                   # default: --dry-run
 *   bun seed-personal-facts.ts --dry-run         # print extracted candidate facts
 *   bun seed-personal-facts.ts --apply           # write to KG via bridge.add_kg_fact
 *
 * SAFETY:
 *   - Default mode is --dry-run.
 *   - Default subject is "user". Override with --subject "lucas" if you want
 *     a named entity instead.
 *   - Emits one fact per pattern match. Candidate facts are deduped by the
 *     (subject, predicate, object) tuple WITHIN a single run. Cross-run
 *     idempotency (re-running --apply) is delegated to the upstream KG
 *     add_kg_fact path — this tool does not query the existing KG first.
 *   - No KG writes happen without --apply.
 *
 * PREDICATE VOCABULARY:
 *   Uses canonical predicates per `Packs/mem-palace/PREDICATES.md`:
 *     is_partner_of, is_child_of, is_parent_of, is_sibling_of,
 *     lives_in, works_at, has_role
 *
 * DESIGN: byte-identical between live (~/.claude/DOS/Tools/) and pack source
 * (Packs/mem-palace/src/Tools/). Mirrors mine-historical-prds.ts pattern.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), '.claude');
const BRIDGE_PATH = join(DOS_DIR, 'DOS', 'Tools', 'mempalace_bridge.py');
const MEMPALACE_PKG_SPEC = process.env.MEMPALACE_PKG_SPEC || 'mempalace>=3.4.1,<4';

interface CliOptions {
  apply: boolean;
  subject: string;
  help: boolean;
  showAll: boolean;
}

interface CandidateFact {
  subject: string;
  predicate: string;
  object: string;
  source: string;       // human-readable origin (file:line or pattern name)
  confidence: 'high' | 'medium' | 'low';
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { apply: false, subject: 'user', help: false, showAll: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--apply') opts.apply = true;
    else if (a === '--dry-run') opts.apply = false;
    else if (a === '--show-all') opts.showAll = true;
    else if (a === '--subject') {
      const next = argv[++i];
      if (typeof next !== 'string' || next.length === 0) {
        throw new Error('--subject requires a value');
      }
      opts.subject = next;
    } else if (a.startsWith('--subject=')) {
      opts.subject = a.slice('--subject='.length);
    }
  }
  return opts;
}

function printHelp(): void {
  process.stdout.write(`seed-personal-facts.ts — seed MemPalace KG with personal/family facts

USAGE:
  bun seed-personal-facts.ts [--dry-run|--apply] [--subject NAME] [--show-all] [--help]

OPTIONS:
  --dry-run        (default) extract candidate facts and print them; no KG writes
  --apply          write the extracted facts to the KG via bridge.add_kg_fact
  --subject NAME   subject for triples (default: "user"). Use a slug like
                   "lucas" if you want a named entity instead.
  --show-all       in dry-run mode, print all candidates (not just the top 20)
  --help, -h       print this help

EXIT CODES:
  0  scan complete (dry-run) or all facts written (apply)
  1  bridge unavailable, write failures, or no source files found
  2  argv parse error

SOURCES:
  - MEMORY/RELATIONSHIP/*.md  (resolver-aware: project + global)
  - ~/.durante/user/TELOS/*.md       (mission, beliefs, narratives)
  - MEMORY/WORK/*/PRD.md      (mentions of family / partner / city — narrow patterns)

PREDICATE VOCABULARY (per PREDICATES.md):
  is_partner_of, is_child_of, is_parent_of, is_sibling_of,
  lives_in, works_at, has_role
`);
}

// -----------------------------------------------------------------------------
// Source discovery
// -----------------------------------------------------------------------------

function discoverSources(): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const tryAdd = (p: string): void => {
    if (!seen.has(p) && existsSync(p)) {
      result.push(p);
      seen.add(p);
    }
  };

  // RELATIONSHIP — project-eligible subdir
  const relRoots = [
    join(DOS_DIR, 'MEMORY', 'RELATIONSHIP'),
  ];
  const projectEnv = process.env.CLAUDE_PROJECT_DIR;
  if (projectEnv) {
    const expanded = projectEnv.replace(/^~(?=\/|$)/, homedir());
    relRoots.unshift(join(expanded, 'MEMORY', 'RELATIONSHIP'));
  }
  try {
    relRoots.unshift(join(process.cwd(), 'MEMORY', 'RELATIONSHIP'));
  } catch { /* cwd may be unreadable */ }

  for (const root of relRoots) {
    if (!existsSync(root)) continue;
    try {
      const entries = readdirSync(root, { withFileTypes: true });
      for (const e of entries) {
        if (typeof (e as { isFile?: () => boolean }).isFile === 'function' && (e as { isFile: () => boolean }).isFile()) {
          if ((e as { name: string }).name.endsWith('.md')) {
            tryAdd(join(root, (e as { name: string }).name));
          }
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  // TELOS — global, fixed location
  // Lockstep with getTelosDir() (hooks/lib/paths.ts) — live corpus is operator data.
const telosDir = process.env.DURANTE_TELOS_DIR || join(homedir(), '.durante', 'user', 'TELOS');
  if (existsSync(telosDir)) {
    try {
      for (const e of readdirSync(telosDir)) {
        if (e.endsWith('.md')) tryAdd(join(telosDir, e));
      }
    } catch { /* skip */ }
  }

  // WORK PRDs — narrow scan; only files mentioning family/partner keywords
  // qualify. We do a cheap grep first to keep the candidate set tractable.
  const workRoots = [
    join(DOS_DIR, 'MEMORY', 'WORK'),
  ];
  if (projectEnv) {
    const expanded = projectEnv.replace(/^~(?=\/|$)/, homedir());
    workRoots.unshift(join(expanded, 'MEMORY', 'WORK'));
  }
  for (const root of workRoots) {
    if (!existsSync(root)) continue;
    try {
      const subdirs = readdirSync(root, { withFileTypes: true })
        .filter((d: { isDirectory(): boolean; name: string }) => d.isDirectory() && /^\d{8}/.test(d.name))
        .map((d: { name: string }) => d.name);
      for (const sub of subdirs) {
        const prd = join(root, sub, 'PRD.md');
        if (!existsSync(prd)) continue;
        try {
          const content = readFileSync(prd, 'utf-8');
          // Narrow keyword filter — only PRDs that plausibly mention personal facts
          if (/\b(partner|spouse|wife|husband|girlfriend|boyfriend|family|son|daughter|parent|mother|father|sister|brother|São Paulo|Sao Paulo|Brazil)\b/i.test(content)) {
            tryAdd(prd);
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return result;
}

// -----------------------------------------------------------------------------
// Pattern extraction
// -----------------------------------------------------------------------------

interface Pattern {
  name: string;
  predicate: string;
  // Returns the captured object string, or null if no match.
  // Confidence is set per-match.
  regex: RegExp;
  confidence: 'high' | 'medium' | 'low';
}

const PATTERNS: Pattern[] = [
  // Partner / spouse
  { name: 'partner-name',     predicate: 'is_partner_of', regex: /\b(?:partner|wife|husband|spouse|girlfriend|boyfriend)(?:\s+is\s+|:\s+|\s+named\s+)([A-Z][a-zA-ZÀ-ÿÀ-ſ'-]+)/g, confidence: 'high' },

  // Children
  { name: 'child-named',      predicate: 'is_parent_of',  regex: /\b(?:my|our)\s+(?:son|daughter|child|kid)\s+([A-Z][a-zA-ZÀ-ÿÀ-ſ'-]+)/g, confidence: 'high' },

  // Parents
  { name: 'parent-named',     predicate: 'is_child_of',   regex: /\b(?:my)\s+(?:mother|mom|father|dad|mum)\s+([A-Z][a-zA-ZÀ-ÿÀ-ſ'-]+)/g, confidence: 'high' },

  // Sibling
  { name: 'sibling-named',    predicate: 'is_sibling_of', regex: /\b(?:my)\s+(?:sister|brother|sibling)\s+([A-Z][a-zA-ZÀ-ÿÀ-ſ'-]+)/g, confidence: 'medium' },

  // Location — explicit residence
  { name: 'lives-in-explicit', predicate: 'lives_in',     regex: /\b(?:I\s+live\s+in|lives\s+in|based\s+in|residence:?)\s+([A-Z][A-Za-zÀ-ÿÀ-ſ\s]+?)(?:[.,;\n]|$)/g, confidence: 'high' },

  // Employer
  { name: 'works-at',         predicate: 'works_at',      regex: /\b(?:I\s+work\s+(?:at|for)|employed\s+at|works\s+at)\s+([A-Z][A-Za-z0-9À-ÿÀ-ſ\s.&-]+?)(?:[.,;\n]|$)/g, confidence: 'high' },

  // Role / title
  { name: 'has-role',         predicate: 'has_role',      regex: /\b(?:I\s+am(?:\s+a)?|my\s+role\s+is|title:?)\s+([A-Z][A-Za-z0-9À-ÿÀ-ſ\s/-]+?)(?:[.,;\n]|$)/g, confidence: 'low' },
];

function extractFromFile(path: string, subject: string): CandidateFact[] {
  let content: string;
  try {
    content = readFileSync(path, 'utf-8');
  } catch {
    return [];
  }
  const facts: CandidateFact[] = [];
  const seenTuples = new Set<string>();

  for (const pat of PATTERNS) {
    pat.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pat.regex.exec(content)) !== null) {
      const obj = (m[1] || '').trim();
      if (!obj || obj.length < 2 || obj.length > 80) continue;
      // De-noise: drop obvious common words
      if (/^(?:the|and|but|with|that|this|when|where|because)$/i.test(obj)) continue;
      const tuple = `${pat.predicate}::${obj.toLowerCase()}`;
      if (seenTuples.has(tuple)) continue;
      seenTuples.add(tuple);
      facts.push({
        subject,
        predicate: pat.predicate,
        object: obj,
        source: `${path} (pattern=${pat.name})`,
        confidence: pat.confidence,
      });
    }
  }
  return facts;
}

// -----------------------------------------------------------------------------
// Bridge invocation
// -----------------------------------------------------------------------------

function bridgeAddFact(fact: CandidateFact): { ok: boolean; reason?: string } {
  const today = new Date().toISOString().slice(0, 10);
  const args = JSON.stringify({
    subject: fact.subject,
    predicate: fact.predicate,
    object: fact.object,
    valid_from: today,
  });
  try {
    // shell-safe: args single-quote-escaped inline (replace(/'/g, ...))
    const stdout = execSync(
      `uv run --quiet --with '${MEMPALACE_PKG_SPEC}' python "${BRIDGE_PATH}" add_kg_fact '${args.replace(/'/g, "'\\''")}'`,
      { encoding: 'utf-8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    if (!stdout.trim()) return { ok: false, reason: 'empty stdout' };
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stdout) as Record<string, unknown>;
    } catch (e) {
      return { ok: false, reason: `parse-error: ${e}` };
    }
    if (parsed.isError === true || parsed.status === 'error') {
      return { ok: false, reason: `bridge-error: ${parsed.message ?? parsed.error_type ?? 'unspecified'}` };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `spawn-error: ${msg.slice(0, 200)}` };
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

function dedupeFacts(facts: CandidateFact[]): CandidateFact[] {
  const seen = new Set<string>();
  const out: CandidateFact[] = [];
  for (const f of facts) {
    const key = `${f.subject}|${f.predicate}|${f.object.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

function main(): number {
  let opts: CliOptions;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`[seed-personal-facts] arg error: ${(err as Error).message}\n`);
    return 2;
  }
  if (opts.help) {
    printHelp();
    return 0;
  }

  const sources = discoverSources();
  if (sources.length === 0) {
    process.stdout.write(
      '[seed-personal-facts] No source files found in RELATIONSHIP/, TELOS/, or qualifying WORK PRDs.\n'
    );
    return 0;
  }

  process.stdout.write(`[seed-personal-facts] scanning ${sources.length} source file(s)...\n`);

  let allFacts: CandidateFact[] = [];
  for (const path of sources) {
    const facts = extractFromFile(path, opts.subject);
    if (facts.length > 0) {
      const sizeKb = Math.round(statSync(path).size / 1024);
      process.stdout.write(`  ${path} (${sizeKb}KB) — ${facts.length} candidate(s)\n`);
      allFacts = allFacts.concat(facts);
    }
  }

  allFacts = dedupeFacts(allFacts);

  if (allFacts.length === 0) {
    process.stdout.write('[seed-personal-facts] No candidate facts extracted. Patterns may need tuning.\n');
    process.stdout.write('  Add a curated note to MEMORY/RELATIONSHIP/personal-facts.md and re-run.\n');
    return 0;
  }

  const mode = opts.apply ? 'APPLY' : 'DRY-RUN';
  process.stdout.write(
    `\n[seed-personal-facts] ${mode} — ${allFacts.length} unique candidate fact(s)\n`
  );

  if (!opts.apply) {
    const limit = opts.showAll ? allFacts.length : Math.min(20, allFacts.length);
    for (let i = 0; i < limit; i++) {
      const f = allFacts[i];
      process.stdout.write(
        `  [${i + 1}/${allFacts.length}] (${f.confidence}) ${f.subject} --${f.predicate}--> "${f.object}"\n`
      );
      process.stdout.write(`           src: ${f.source.slice(0, 120)}\n`);
    }
    if (limit < allFacts.length) {
      process.stdout.write(`  ... and ${allFacts.length - limit} more (pass --show-all to see all, --apply to write)\n`);
    }
    process.stdout.write(
      '\n  Review the candidates. False positives are normal — add --apply only when satisfied.\n'
    );
    return 0;
  }

  // Apply mode — bridge availability check first
  if (!existsSync(BRIDGE_PATH)) {
    process.stderr.write(`[seed-personal-facts] bridge not found at ${BRIDGE_PATH}\n`);
    return 1;
  }

  let written = 0;
  let failed = 0;
  for (let i = 0; i < allFacts.length; i++) {
    const f = allFacts[i];
    const result = bridgeAddFact(f);
    if (result.ok) {
      written++;
      process.stdout.write(
        `  [${i + 1}/${allFacts.length}] wrote: ${f.subject} --${f.predicate}--> "${f.object}"\n`
      );
    } else {
      failed++;
      process.stdout.write(
        `  [${i + 1}/${allFacts.length}] FAIL: ${f.subject} --${f.predicate}--> "${f.object}" — ${(result.reason ?? '').slice(0, 120)}\n`
      );
    }
  }

  process.stdout.write(
    `\n[seed-personal-facts] DONE — wrote ${written}, failed ${failed}, total ${allFacts.length}\n`
  );
  return failed > 0 && written === 0 ? 1 : 0;
}

const code = main();
process.exit(code);
