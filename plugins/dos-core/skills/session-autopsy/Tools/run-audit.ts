#!/usr/bin/env bun
/**
 * run-audit.ts — Cadenced council audit runner (RFC-0024 §5.8)
 *
 * Orchestrates the 5-agent council audit over a rolling 7-day window.
 * Writes findings to MEMORY/WORK/YYYYMMDD-council-audit-auto/findings.md
 * and diffs against the most recent prior audit to surface new patterns.
 *
 * Manual invocation:
 *   bun Packs/session-autopsy/Tools/run-audit.ts [--window-days 7] [--dry-run]
 *
 * Scheduled invocation via /schedule — cron runs every 14 days at 9am.
 *
 * NOTE: This is a scaffolding runner. Agent spawning is stubbed — the
 * intended implementation is to invoke Task tool from a Claude Code
 * session primary, which this CLI can't do directly. Instead, this tool
 * writes a "spawn plan" that an orchestrating skill session reads, spawns
 * the 5 agents, and fills in their outputs. See `cadenced-audit.md` for
 * the human-facing routine.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const HOME = homedir();
const DURANTE = join(HOME, "Durante");
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PACK_DIR = join(SCRIPT_DIR, "..");
const DEFAULT_WORK_DIR = join(DURANTE, "MEMORY", "WORK");
const DEFAULT_SPECS_DIR = join(DURANTE, "Plans", "Specs");
const PROMPTS_DIR = process.env.DOS_AUDIT_PROMPTS_DIR || join(PACK_DIR, "Prompts");
const AGENTS = ["reflections", "session", "signals-failures", "work-palace", "capability-utilization"] as const;

// Specialist-seat mapping (RFC-0024 §5.8 / cadenced-audit.md): each audit prompt is
// spawned under the council specialist whose lens fits it, now that those specialists
// are deployed to the agent registry (~/.claude/agents/). Falls back to general-purpose
// for any prompt without a mapped specialist — the analysis structure is carried by the
// prompt, so the fallback degrades gracefully (cadenced-audit.md § Fallback).
const SPECIALISTS: Record<string, string> = {
  reflections: "Feathers",
  session: "Cockburn",
  "signals-failures": "Pragmatic",
  "work-palace": "Fowler",
  "capability-utilization": "KentBeck",
};

interface Args {
  windowDays: number;
  dryRun: boolean;
  workDir: string;
  specsDir: string;
  date: string;
  syntheticPatterns: PatternCount[];
  noStubs: boolean;
}

interface PatternCount {
  slug: string;
  count: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let windowDays = 7;
  let dryRun = false;
  let workDir = process.env.DOS_AUDIT_WORK_DIR || DEFAULT_WORK_DIR;
  let specsDir = process.env.DOS_AUDIT_SPECS_DIR || DEFAULT_SPECS_DIR;
  let date = process.env.DOS_AUDIT_DATE || todaySlugPrefix();
  const syntheticPatterns: PatternCount[] = [];
  let noStubs = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--window-days") windowDays = parseInt(argv[++i], 10);
    else if (argv[i] === "--dry-run") dryRun = true;
    else if (argv[i] === "--work-dir") workDir = argv[++i];
    else if (argv[i] === "--specs-dir") specsDir = argv[++i];
    else if (argv[i] === "--date") date = argv[++i];
    else if (argv[i] === "--synthetic-pattern") syntheticPatterns.push(parsePattern(argv[++i]));
    else if (argv[i] === "--no-stubs") noStubs = true;
  }
  if (!Number.isFinite(windowDays) || windowDays < 1 || windowDays > 90) windowDays = 7;
  if (!/^\d{8}$/.test(date)) date = todaySlugPrefix();
  return { windowDays, dryRun, workDir, specsDir, date, syntheticPatterns, noStubs };
}

function computeWindow(windowDays: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function todaySlugPrefix(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parsePattern(raw: string): PatternCount {
  const [slugRaw, countRaw] = raw.split(/[=:]/);
  const slug = normalizeSlug(slugRaw || "synthetic-pattern");
  const count = parseInt(countRaw || "3", 10);
  return { slug, count: Number.isFinite(count) ? count : 3 };
}

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "pattern";
}

function renderPrompt(name: string, window: { start: string; end: string }): string {
  const path = join(PROMPTS_DIR, `${name}.md`);
  if (!existsSync(path)) throw new Error(`missing prompt: ${path}`);
  const raw = readFileSync(path, "utf8");
  return raw.replace(/\{\{WINDOW_START\}\}/g, window.start).replace(/\{\{WINDOW_END\}\}/g, window.end);
}

function promptVersion(name: string): number {
  const path = join(PROMPTS_DIR, `${name}.md`);
  const raw = readFileSync(path, "utf8");
  const m = raw.match(/^version:\s*(\d+)/m);
  return m ? parseInt(m[1], 10) : 1;
}

function findPreviousAudit(workDir: string, excludeDir?: string): string | null {
  if (!existsSync(workDir)) return null;
  const excluded = excludeDir ? basename(excludeDir) : null;
  const dirs = readdirSync(workDir)
    .filter((d) => /^\d{8}.*-council-audit-auto/.test(d))
    .filter((d) => d !== excluded)
    .map((d) => ({ dir: d, mtime: statSync(join(workDir, d)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (dirs.length === 0) return null;
  return join(workDir, dirs[0].dir, "findings.md");
}

function writeSpawnPlan(outputDir: string, window: { start: string; end: string }, previousAudit: string | null): string {
  const plan: {
    window: { start: string; end: string };
    prompt_versions: Record<string, number>;
    agents: Array<{ name: string; prompt_path: string; subagent_type: string }>;
    previous_audit: string | null;
    findings_path: string;
  } = {
    window,
    prompt_versions: Object.fromEntries(AGENTS.map((a) => [a, promptVersion(a)])),
    agents: AGENTS.map((a) => ({
      name: a,
      prompt_path: join(PROMPTS_DIR, `${a}.md`),
      subagent_type: SPECIALISTS[a] ?? "general-purpose",
    })),
    previous_audit: previousAudit,
    findings_path: join(outputDir, "findings.md"),
  };
  const planPath = join(outputDir, "spawn-plan.json");
  // writeArtifact:exempt — internal audit infrastructure; SessionAutopsy is a standalone cron tool, not mirrored to ~/.claude/skills, so the relative-path import to writeArtifact doesn't resolve at runtime
  writeFileSync(planPath, JSON.stringify(plan, null, 2));
  return planPath;
}

function renderSyntheticPatterns(patterns: PatternCount[]): string {
  if (patterns.length === 0) return "_(primary opens Plans/Specs/RFC-XXXX-auto-<slug>.md for each new pattern with >=3 occurrences absent from previous audit)_";
  return patterns
    .map((pattern) => `- pattern: ${pattern.slug}\n  count: ${pattern.count}\n  evidence:\n    - synthetic:rfc-0024-5.8`)
    .join("\n");
}

function writeFindingsSkeleton(
  outputDir: string,
  date: string,
  window: { start: string; end: string },
  promptVersions: Record<string, number>,
  syntheticPatterns: PatternCount[],
): string {
  const body = `---
generated_at: ${new Date().toISOString()}
window_start: ${window.start}
window_end: ${window.end}
window_days: ${Math.round((new Date(window.end).getTime() - new Date(window.start).getTime()) / 86400000)}
prompt_versions: ${JSON.stringify(promptVersions)}
status: draft (awaiting primary-session agent spawns)
---

# Council Audit ${date} — auto-generated skeleton

> Primary session: run the 5 agents in parallel using the rendered prompts at
> \`spawn-plan.json\`. Paste their YAML outputs under the respective sections
> below, then run the cross-agent synthesis at the end.

## Reflections agent

_(awaiting agent output)_

## Session-pattern agent

_(awaiting agent output)_

## Signals + Failures agent

_(awaiting agent output)_

## WORK + Palace agent

_(awaiting agent output)_

## Capability-utilization agent

_(awaiting agent output)_

## Cross-agent synthesis

_(written by primary after all 5 agents return)_

## Diff against previous audit

_(written by primary; path to previous in spawn-plan.json -> previous_audit)_

## New recurring patterns (RFC stubs)

${renderSyntheticPatterns(syntheticPatterns)}
`;
  const findingsPath = join(outputDir, "findings.md");
  // writeArtifact:exempt — internal audit infrastructure; SessionAutopsy is a standalone cron tool, not mirrored to ~/.claude/skills
  writeFileSync(findingsPath, body);
  return findingsPath;
}

function extractPatterns(findingsPath: string | null): Map<string, number> {
  const result = new Map<string, number>();
  if (!findingsPath || !existsSync(findingsPath)) return result;
  const lines = readFileSync(findingsPath, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const patternMatch = lines[i].match(/^\s*-\s*(?:pattern|theme):\s*["']?([^"']+)["']?\s*$/);
    if (!patternMatch) continue;
    const slug = normalizeSlug(patternMatch[1]);
    let count = 1;
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      const countMatch = lines[j].match(/^\s*count:\s*(\d+)/);
      if (countMatch) {
        count = parseInt(countMatch[1], 10);
        break;
      }
      if (/^\s*-\s*(?:pattern|theme):/.test(lines[j])) break;
    }
    result.set(slug, Math.max(result.get(slug) ?? 0, count));
  }
  return result;
}

function nextAutoRfcPath(specsDir: string, slug: string): string {
  const existing = existsSync(specsDir) ? readdirSync(specsDir) : [];
  const max = existing.reduce((highest, file) => {
    const match = file.match(/^RFC-(\d{4})-/);
    return match ? Math.max(highest, parseInt(match[1], 10)) : highest;
  }, 0);
  const next = Math.max(max + 1, 27);
  return join(specsDir, `RFC-${String(next).padStart(4, "0")}-auto-${slug}.md`);
}

function writeRfcStub(specsDir: string, pattern: PatternCount, auditPath: string, previousAudit: string | null): string {
  mkdirSync(specsDir, { recursive: true });
  const path = nextAutoRfcPath(specsDir, pattern.slug);
  const body = `---
parent: [RFC-0024]
supersedes: []
status: Draft
project: dos-authoring
created: ${new Date().toISOString().slice(0, 10)}
status_note: Auto-seeded by RFC-0024 Fix 5.8 cadenced audit diff. Investigation required before implementation.
---

# ${pattern.slug.replace(/-/g, " ")}

## Pattern

- Slug: \`${pattern.slug}\`
- Recurrence count: ${pattern.count}
- Current audit: \`${auditPath}\`
- Previous audit: \`${previousAudit ?? "none"}\`

## Recommended Investigation

1. Verify the recurrence count against source evidence.
2. Identify the producer surface responsible for the pattern.
3. Decide whether this becomes a source fix, operator documentation, or no-op.
4. Replace this auto-stub with a full RFC if the pattern is real and recurring.
`;
  // writeArtifact:exempt — internal audit infrastructure; SessionAutopsy is a standalone cron tool, not mirrored to ~/.claude/skills
  writeFileSync(path, body);
  return path;
}

function diffAndWriteStubs(
  findingsPath: string,
  previousAudit: string | null,
  specsDir: string,
  noStubs: boolean,
): Array<{ slug: string; count: number; stubPath: string | null }> {
  const current = extractPatterns(findingsPath);
  const previous = extractPatterns(previousAudit);
  const newPatterns: Array<{ slug: string; count: number; stubPath: string | null }> = [];
  for (const [slug, count] of current.entries()) {
    if (count < 3) continue;
    if ((previous.get(slug) ?? 0) >= 1) continue;
    const pattern = { slug, count };
    const stubPath = noStubs ? null : writeRfcStub(specsDir, pattern, findingsPath, previousAudit);
    newPatterns.push({ ...pattern, stubPath });
  }
  return newPatterns;
}

function uniqueOutputDir(workDir: string, baseSlug: string): string {
  const suffixes = ["", "-b", "-c", "-d", "-e", "-f"];
  for (const suffix of suffixes) {
    const candidate = join(workDir, `${baseSlug}${suffix}`);
    if (!existsSync(candidate)) return candidate;
  }
  return join(workDir, `${baseSlug}-${Date.now()}`);
}

function main(): void {
  const args = parseArgs();
  const window = computeWindow(args.windowDays);

  const slug = `${args.date}-council-audit-auto`;
  const outputDir = uniqueOutputDir(args.workDir, slug);
  const previousAudit = findPreviousAudit(args.workDir, outputDir);

  if (args.dryRun) {
    console.log(`DRY RUN — would create: ${outputDir}`);
    console.log(`Window: ${window.start} -> ${window.end}`);
    const rendered = {
      reflections: renderPrompt("reflections", window).length,
      session: renderPrompt("session", window).length,
      "signals-failures": renderPrompt("signals-failures", window).length,
      "work-palace": renderPrompt("work-palace", window).length,
    };
    console.log(`Rendered prompt sizes: ${JSON.stringify(rendered)}`);
    console.log(`Previous audit: ${previousAudit ?? "(none — this would be baseline)"}`);
    if (args.syntheticPatterns.length > 0) {
      console.log(`Synthetic patterns: ${JSON.stringify(args.syntheticPatterns)}`);
    }
    return;
  }

  mkdirSync(outputDir, { recursive: true });
  const planPath = writeSpawnPlan(outputDir, window, previousAudit);
  const promptVersions = Object.fromEntries(AGENTS.map((a) => [a, promptVersion(a)]));
  const findingsPath = writeFindingsSkeleton(outputDir, args.date, window, promptVersions, args.syntheticPatterns);
  const newPatterns = diffAndWriteStubs(findingsPath, previousAudit, args.specsDir, args.noStubs);
  console.log(`Audit scaffold written:`);
  console.log(`  dir:        ${outputDir}`);
  console.log(`  plan:       ${planPath}`);
  console.log(`  findings:   ${findingsPath}`);
  console.log(`  prev audit: ${previousAudit ?? "(none — baseline run)"}`);
  console.log(`  new RFCs:   ${newPatterns.length}`);
  for (const pattern of newPatterns) {
    console.log(`    - ${pattern.slug} (${pattern.count}) -> ${pattern.stubPath ?? "(stub disabled)"}`);
  }
  console.log(`\nNext: a Claude Code primary session reads spawn-plan.json and runs the 5 agents,`);
  console.log(`      populating findings.md with their YAML outputs + cross-agent synthesis.`);
}

main();
