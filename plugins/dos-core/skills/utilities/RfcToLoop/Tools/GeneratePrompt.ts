#!/usr/bin/env bun
/**
 * RfcToLoop / Generate
 *
 * Packs an RFC slice into a self-contained /loop block + pre-committed PRD stub.
 * Paste the emitted block into a fresh Claude Code session → full Algorithm delivery.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EFFORT_TIERS = ["standard", "extended", "advanced", "deep", "xhigh", "comprehensive"] as const;
type EffortTier = typeof EFFORT_TIERS[number];

type Args = {
  rfc?: string;
  slice?: string;
  effort: EffortTier;
  out?: string;
  dryRun: boolean;
};

type Slice = {
  heading: string;
  level: number;
  body: string;
  startLine: number;
  endLine: number;
};

const EXIT_BAD_ARGS = 2;
const EXIT_AMBIGUOUS = 3;

function parseArgs(argv: string[]): Args {
  const args: Args = { effort: "extended", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--rfc": args.rfc = next(); break;
      case "--slice": args.slice = next(); break;
      case "--effort": {
        const v = next();
        if (!(EFFORT_TIERS as readonly string[]).includes(v)) {
          process.stderr.write(`invalid --effort "${v}" — allowed: ${EFFORT_TIERS.join(", ")}\n`);
          process.exit(EXIT_BAD_ARGS);
        }
        args.effort = v as EffortTier;
        break;
      }
      case "--out": args.out = next(); break;
      case "--dry-run": args.dryRun = true; break;
      case "-h": case "--help": printUsage(); process.exit(0);
    }
  }
  return args;
}

function printUsage() {
  process.stdout.write(`usage: GeneratePrompt.ts --rfc <name-or-id> [--slice <heading>] [--effort ${EFFORT_TIERS.join("|")}] [--out <dir>] [--dry-run]\n`);
}

function findSpecsRoot(): string {
  const candidates = [
    process.env.CLAUDE_PROJECT_DIR ? join(process.env.CLAUDE_PROJECT_DIR, "Plans/Specs") : null,
    join(process.cwd(), "Plans/Specs"),
    join(homedir(), "Durante/Plans/Specs"),
  ].filter((x): x is string => Boolean(x));
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error(`no Plans/Specs directory found (checked: ${candidates.join(", ")})`);
}

function resolveWorkDir(outFlag: string | undefined): string {
  if (outFlag) return resolve(outFlag);
  const cascade = [
    process.env.CLAUDE_PROJECT_DIR ? join(process.env.CLAUDE_PROJECT_DIR, "MEMORY/WORK") : null,
    join(process.cwd(), "MEMORY/WORK"),
    join(homedir(), ".claude/MEMORY/WORK"),
  ].filter((x): x is string => Boolean(x));
  for (const c of cascade) if (existsSync(c)) return c;
  const first = cascade[0] ?? join(homedir(), ".claude/MEMORY/WORK");
  mkdirSync(first, { recursive: true });
  return first;
}

/**
 * Resolve a fuzzy needle against a set of candidates using successive tiers
 * (exact → prefix → substring). Exits with a candidate list on ambiguity,
 * exits with a not-found message on zero matches.
 */
function findUnique<T>(
  label: string,
  needle: string,
  candidates: T[],
  tiers: Array<(c: T, n: string) => boolean>,
  describe: (c: T) => string,
): T {
  for (const match of tiers) {
    const hits = candidates.filter(c => match(c, needle));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      process.stderr.write(`ambiguous --${label} "${needle}" — ${hits.length} candidates:\n`);
      for (const h of hits) process.stderr.write(`  ${describe(h)}\n`);
      process.exit(EXIT_AMBIGUOUS);
    }
  }
  process.stderr.write(`no ${label} matched "${needle}"\n`);
  process.stderr.write(`available:\n`);
  for (const c of candidates.slice(0, 20)) process.stderr.write(`  ${describe(c)}\n`);
  process.exit(EXIT_AMBIGUOUS);
}

function resolveRfc(specsRoot: string, needle: string): string {
  const files = readdirSync(specsRoot).filter(f => /^RFC-\d{4}.*\.md$/i.test(f));
  const titles = new Map<string, string>();
  const titleOf = (f: string) => {
    if (!titles.has(f)) {
      titles.set(f, readFileSync(join(specsRoot, f), "utf8").match(/^#\s+(.+)$/m)?.[1] ?? "");
    }
    return titles.get(f) ?? "";
  };

  const match = findUnique(
    "rfc", needle, files,
    [
      (f, n) => f === n || f === `${n}.md`,
      (f, n) => f.toLowerCase().startsWith(n.toLowerCase())
        || f.toLowerCase().startsWith(`rfc-${n.toLowerCase().padStart(4, "0")}`),
      (f, n) => titleOf(f).toLowerCase().includes(n.toLowerCase()),
    ],
    f => f,
  );
  return join(specsRoot, match);
}

function parseSlices(body: string): Slice[] {
  const lines = body.split("\n");
  const headings: { heading: string; level: number; startLine: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,6})\s+(.+?)\s*$/);
    if (m) headings.push({ heading: m[2], level: m[1].length, startLine: i });
  }
  const slices: Slice[] = [];
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    if (h.level < 3) continue;
    const end = headings.slice(i + 1).find(x => x.level <= h.level)?.startLine ?? lines.length;
    slices.push({
      heading: h.heading,
      level: h.level,
      startLine: h.startLine,
      endLine: end,
      body: lines.slice(h.startLine, end).join("\n"),
    });
  }
  return slices;
}

function findSliceByNeedle(slices: Slice[], needle: string): Slice {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const n = norm(needle);
  return findUnique(
    "slice", needle, slices,
    [
      (s) => norm(s.heading) === n,
      (s) => norm(s.heading).includes(n),
    ],
    s => `${"#".repeat(s.level)} ${s.heading}`,
  );
}

function findNextUnfinishedSlice(slices: Slice[]): Slice {
  const signals = /(^|\s)(Pending|Not started|Planned|TODO|DEFERRED)(\s|$|:|\.)/i;
  const uncheckedBox = /^\s*[-*]\s+\[ \]\s+/m;
  const candidates = slices.filter(s => signals.test(s.body) || uncheckedBox.test(s.body));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) {
    process.stderr.write(`no unfinished slice detected — pass --slice "<heading>"\n`);
    process.stderr.write(`available slices:\n`);
    for (const s of slices.slice(0, 20)) process.stderr.write(`  ${"#".repeat(s.level)} ${s.heading}\n`);
    process.exit(EXIT_AMBIGUOUS);
  }
  process.stderr.write(`multiple unfinished slice candidates (${candidates.length}) — pass --slice "<heading>":\n`);
  for (const s of candidates) process.stderr.write(`  ${"#".repeat(s.level)} ${s.heading}\n`);
  process.exit(EXIT_AMBIGUOUS);
}

function extractIscSeeds(slice: Slice): string[] {
  const seeds: string[] = [];
  for (const line of slice.body.split("\n")) {
    const m = line.match(/^\s*[-*]\s+\[[ xX]\]\s+(.+?)\s*$/);
    if (m) seeds.push(m[1]);
  }
  return seeds;
}

function slugify(s: string, max = 40): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max);
}

function rfcShortId(rfcFileBase: string): string {
  const m = rfcFileBase.match(/^RFC-(\d{4})/i);
  return m ? `rfc${m[1]}` : slugify(rfcFileBase, 12);
}

function timestampSlugPrefix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function loadTemplate(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(here, "loop-template.md"), "utf8");
}

function renderTemplate(tmpl: string, vars: Record<string, string>): string {
  return tmpl.replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

type BuildContext = {
  rfcPath: string;
  rfcId: string;
  slice: Slice;
  iscSeeds: string[];
  effort: EffortTier;
  slug: string;
  workDir: string;
};

function buildLoopBlock(ctx: BuildContext): string {
  const iscLines = ctx.iscSeeds.length > 0
    ? ctx.iscSeeds.map((s, i) => `   - [ ] ISC-${i + 1}: ${s}`).join("\n")
    : `   - [ ] (derive atomic ISC from the slice body in OBSERVE — floor per effort tier)`;

  return renderTemplate(loadTemplate(), {
    RFC_ID: ctx.rfcId,
    SLICE_HEADING: ctx.slice.heading,
    RFC_FILE: basename(ctx.rfcPath),
    SLICE_LINE: String(ctx.slice.startLine + 1),
    EFFORT: ctx.effort,
    SLUG: ctx.slug,
    WORK_DIR: ctx.workDir,
    SLICE_BODY: ctx.slice.body.trim(),
    ISC_LINES: iscLines,
  });
}

function writePrdStub(path: string, opts: { task: string; slug: string; effort: EffortTier; iscCount: number }) {
  const now = new Date().toISOString();
  const body = `---
task: ${opts.task}
slug: ${opts.slug}
effort: ${opts.effort}
phase: observe
progress: 0/${opts.iscCount}
mode: interactive
started: ${now}
updated: ${now}
---
`;
  // writeArtifact:exempt — operator-local PRD scaffold under MEMORY/WORK/<slug>/; cross-session tracking via the artifacts.jsonl logArtifact() call below
  writeFileSync(path, body, "utf8");
}

function logArtifact(opts: { rfcId: string; slice: string; promptPath: string }) {
  const artifactsDir = process.env.CLAUDE_PROJECT_DIR
    ? join(process.env.CLAUDE_PROJECT_DIR, "MEMORY/ARTIFACTS")
    : join(process.cwd(), "MEMORY/ARTIFACTS");
  mkdirSync(artifactsDir, { recursive: true });
  const entry = {
    timestamp: new Date().toISOString(),
    pack: "Utilities",
    workflow: "RfcToLoop.Generate",
    type: "loop-prompt",
    title: `${opts.rfcId} :: ${opts.slice}`,
    path: opts.promptPath,
    sessionId: process.env.CLAUDE_SESSION_ID ?? "",
  };
  appendFileSync(join(artifactsDir, "artifacts.jsonl"), JSON.stringify(entry) + "\n");
}

export function generatePrompt(argv: string[]): { block: string; slugDir?: string } {
  const args = parseArgs(argv);
  if (!args.rfc) { printUsage(); process.exit(EXIT_BAD_ARGS); }

  const specsRoot = findSpecsRoot();
  const rfcPath = resolveRfc(specsRoot, args.rfc);
  const rfcFileBase = basename(rfcPath).replace(/\.md$/, "");
  const rfcId = rfcShortId(rfcFileBase);
  const body = readFileSync(rfcPath, "utf8");

  const slices = parseSlices(body);
  const slice = args.slice
    ? findSliceByNeedle(slices, args.slice)
    : findNextUnfinishedSlice(slices);

  const iscSeeds = extractIscSeeds(slice);
  const slug = `${timestampSlugPrefix()}_${rfcId}-${slugify(slice.heading, 30)}`;

  const workDir = resolveWorkDir(args.out);
  const slugDir = join(workDir, slug);

  const block = buildLoopBlock({
    rfcPath, rfcId, slice, iscSeeds,
    effort: args.effort, slug, workDir,
  });

  if (!args.dryRun) {
    mkdirSync(slugDir, { recursive: true });
    writePrdStub(join(slugDir, "PRD.md"), {
      task: `${rfcFileBase} :: ${slice.heading}`,
      slug,
      effort: args.effort,
      iscCount: iscSeeds.length,
    });
    // writeArtifact:exempt — operator-local PROMPT.md under MEMORY/WORK/<slug>/; cross-session tracking via the adjacent logArtifact() call
    writeFileSync(join(slugDir, "PROMPT.md"), block, "utf8");
    logArtifact({ rfcId: rfcFileBase, slice: slice.heading, promptPath: join(slugDir, "PROMPT.md") });
  }

  return { block, slugDir: args.dryRun ? undefined : slugDir };
}

function main() {
  const { block, slugDir } = generatePrompt(process.argv.slice(2));
  process.stdout.write(block);
  if (slugDir) {
    process.stderr.write(`\nwrote ${slugDir}/PRD.md\nwrote ${slugDir}/PROMPT.md\n`);
  }
}

if (import.meta.main) main();
