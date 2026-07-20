#!/usr/bin/env bun
/**
 * RunPlan — Ensemble Plan workflow CLI entrypoint.
 *
 * Orchestrates: discoverRails + loadPreferences + extractWorkUnits +
 * inferRoles + buildWaves + renderPlan. Writes DELIVERY-PLAN.md and a
 * machine-readable PLAN-META.json that Emit consumes.
 *
 * Exit codes:
 *   0  plan written (or dry-run printed)
 *   2  bad args / IO error
 *   3  inference error (InferRoles failed)
 */

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { discoverRails, type ProjectRails } from "./DiscoverRails";
import { extractWorkUnits } from "./ExtractWorkUnits";
import { inferRoles, type RoleInference } from "./InferRoles";
import { buildWaves } from "./BuildWaves";
import { loadPreferences } from "./LoadPreferences";
import { renderPlan, type PlanInput } from "./RenderPlan";

const RAIL_FIELDS: ReadonlySet<keyof ProjectRails> = new Set([
  "project_path",
  "claude_md_present",
  "four_copy_rule",
  "submodule_paths",
  "sync_check",
  "package_manager",
  "monorepo",
  "typecheck_cmd",
  "test_cmd",
  "precommit_hook",
  "commit_convention",
  "available_skills",
  "gaps",
] as const);

type Args = {
  artifact?: string;
  project?: string;
  llmFallback: boolean;
  out?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { llmFallback: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    switch (k) {
      case "--artifact": a.artifact = next(); break;
      case "--project": a.project = next(); break;
      case "--llm-fallback": a.llmFallback = true; break;
      case "--out": a.out = next(); break;
      case "--dry-run": a.dryRun = true; break;
      case "-h": case "--help":
        process.stdout.write("usage: bun RunPlan.ts --artifact <path> [--project <dir>] [--llm-fallback] [--out <dir>] [--dry-run]\n");
        process.exit(0);
    }
  }
  return a;
}

function resolveWorkDir(outFlag: string | undefined): string {
  if (outFlag) return resolve(outFlag);
  const cascade = [
    process.env.CLAUDE_PROJECT_DIR ? join(process.env.CLAUDE_PROJECT_DIR, "MEMORY/WORK") : null,
    join(process.cwd(), "MEMORY/WORK"),
    join(homedir(), ".claude/MEMORY/WORK"),
  ].filter((x): x is string => Boolean(x));
  for (const c of cascade) if (existsSync(c)) return c;
  const fallback = cascade[0] ?? join(homedir(), ".claude/MEMORY/WORK");
  mkdirSync(fallback, { recursive: true });
  return fallback;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : "untitled";
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function detectWing(projectPath: string): string | undefined {
  const base = basename(projectPath).toLowerCase();
  if (base === "durante") return "durante";
  if (base === "studio" || projectPath.includes("Platform/studio")) return "studio";
  return undefined;
}

function detectGitRemote(projectPath: string): string | undefined {
  try {
    return execSync("git remote get-url origin", { cwd: projectPath, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.artifact) {
    process.stderr.write("error: --artifact is required\n");
    process.exit(2);
  }
  const artifactPath = resolve(args.artifact);
  if (!existsSync(artifactPath)) {
    process.stderr.write(`error: artifact not found at ${artifactPath}\n`);
    process.exit(2);
  }

  const projectPath = resolve(args.project ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  const md = readFileSync(artifactPath, "utf8");
  const sha256 = createHash("sha256").update(md).digest("hex");
  const title = extractTitle(md);

  const discovered = await discoverRails(projectPath, { llmFallback: args.llmFallback });
  const overrides = loadPreferences({
    projectPath,
    projectWing: detectWing(projectPath),
    gitRemote: detectGitRemote(projectPath),
  });
  const typedOverrides: Partial<ProjectRails> = {};
  const rejectedKeys: string[] = [];
  for (const [k, v] of Object.entries(overrides)) {
    if (RAIL_FIELDS.has(k as keyof ProjectRails)) {
      (typedOverrides as Record<string, unknown>)[k] = v;
    } else {
      rejectedKeys.push(k);
    }
  }
  const rails: ProjectRails = Object.assign({}, discovered, typedOverrides);
  if (rejectedKeys.length > 0) {
    rails.gaps.push(`PREFERENCES override(s) with unknown rail field(s): ${rejectedKeys.join(", ")}`);
  }

  const units = extractWorkUnits(artifactPath);
  if (units.length === 0) {
    process.stderr.write(`error: no work units extracted from ${artifactPath} (artifact needs ≥1 heading at depth ≥2 with content)\n`);
    process.exit(2);
  }

  let roles: RoleInference;
  try {
    roles = await inferRoles(units, rails);
  } catch (err) {
    process.stderr.write(`InferRoles error: ${(err as Error).message}\n`);
    process.exit(3);
  }

  const waves = buildWaves(roles.deps);

  const planInput: PlanInput = {
    artifact: { path: artifactPath, sha256, title },
    generatedAt: new Date().toISOString(),
    rails,
    discoveredRails: discovered,
    preferences: overrides,
    units,
    roles,
    waves,
  };
  const planMd = renderPlan(planInput);

  if (args.dryRun) {
    process.stdout.write(planMd);
    return;
  }

  const ts = timestamp();
  const slug = `${ts}_ensemble-${slugify(title)}`;
  const outDir = join(resolveWorkDir(args.out), slug);
  mkdirSync(outDir, { recursive: true });
  const planPath = join(outDir, "DELIVERY-PLAN.md");
  const metaPath = join(outDir, "PLAN-META.json");
  // writeArtifact:exempt — v0 defers writeArtifact() adoption to a follow-on; artifacts.jsonl append below provides cross-session tracking. Migration blocked on hooks/lib/ import resolution for distributable skills.
  writeFileSync(planPath, planMd, "utf8");
  // writeArtifact:exempt — same as line above; co-located PLAN-META.json consumed by Emit only.
  writeFileSync(metaPath, JSON.stringify(planInput, null, 2), "utf8");
  appendArtifactLog(planPath, slug);

  process.stdout.write(`wrote ${planPath}\n`);
  process.stdout.write(`wrote ${metaPath}\n`);
  if (planInput.rails.gaps.length > 0) {
    process.stdout.write(`\n${planInput.rails.gaps.length} gap(s) detected — resolve before Emit.\n`);
  }
}

function appendArtifactLog(planPath: string, slug: string): void {
  const dir = process.env.CLAUDE_PROJECT_DIR
    ? join(process.env.CLAUDE_PROJECT_DIR, "MEMORY/ARTIFACTS")
    : join(homedir(), ".claude/MEMORY/ARTIFACTS");
  if (!existsSync(dir)) return;
  const entry = {
    timestamp: new Date().toISOString(),
    pack: "Utilities",
    workflow: "Ensemble.Plan",
    type: "delivery-plan",
    title: slug,
    path: planPath,
    sessionId: process.env.CLAUDE_SESSION_ID ?? null,
  };
  try {
    appendFileSync(join(dir, "artifacts.jsonl"), JSON.stringify(entry) + "\n");
  } catch {
    /* best-effort */
  }
}

if (import.meta.main) {
  main().catch((err) => {
    process.stderr.write(`RunPlan error: ${err.message}\n`);
    process.exit(2);
  });
}
