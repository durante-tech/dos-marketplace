#!/usr/bin/env bun
/**
 * RunEmit — Ensemble Emit workflow CLI entrypoint.
 *
 * Reads an operator-approved DELIVERY-PLAN.md + co-located PLAN-META.json.
 * Strict Gaps gate: any `- [ ]` item remaining in the `## Gaps` section
 * aborts with exit code 2 and writes nothing.
 *
 * On success: writes session-prompt.md + rollout-state.md next to the plan.
 *
 * Exit codes:
 *   0  emitted (or dry-run printed)
 *   2  gaps unchecked / bad args / IO error
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { renderSessionPrompt, type SessionPromptInput } from "./RenderSessionPrompt";
import { renderRolloutState, type RolloutStateInput } from "./RenderRolloutState";
import type { PlanInput } from "./RenderPlan";

type Args = {
  plan?: string;
  out?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    switch (k) {
      case "--plan": a.plan = next(); break;
      case "--out": a.out = next(); break;
      case "--dry-run": a.dryRun = true; break;
      case "-h": case "--help":
        process.stdout.write("usage: bun RunEmit.ts --plan <DELIVERY-PLAN.md> [--out <dir>] [--dry-run]\n");
        process.exit(0);
    }
  }
  return a;
}

export type UncheckedGap = { raw: string; line: number };

export function findUncheckedGaps(planMd: string): UncheckedGap[] {
  const lines = planMd.split("\n");
  let inGapsSection = false;
  const gaps: UncheckedGap[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const headingMatch = l.match(/^(##)\s+(.+?)\s*$/);
    if (headingMatch) {
      inGapsSection = /^gaps\b/i.test(headingMatch[2].trim());
      continue;
    }
    if (!inGapsSection) continue;
    const uncheckedMatch = l.match(/^\s*-\s*\[\s\]\s+(.+?)\s*$/);
    if (uncheckedMatch) {
      gaps.push({ raw: uncheckedMatch[1], line: i + 1 });
    }
  }
  return gaps;
}

function slugFromMeta(meta: PlanInput): string {
  const title = meta.artifact.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  const stamp = meta.generatedAt.replace(/[-:T]/g, "").replace(/\..*/, "").slice(0, 14);
  return `${stamp}_ensemble-${title || "untitled"}`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!args.plan) {
    process.stderr.write("error: --plan is required\n");
    process.exit(2);
  }
  const planPath = resolve(args.plan);
  if (!existsSync(planPath)) {
    process.stderr.write(`error: plan not found at ${planPath}\n`);
    process.exit(2);
  }
  const planMd = readFileSync(planPath, "utf8");

  const unchecked = findUncheckedGaps(planMd);
  if (unchecked.length > 0) {
    process.stderr.write(`error: ${unchecked.length} unchecked gap(s) in ${planPath}. Emit refuses to proceed.\n\n`);
    for (const g of unchecked) {
      process.stderr.write(`  L${g.line}: ${g.raw}\n`);
    }
    process.exit(2);
  }

  const metaPath = join(dirname(planPath), "PLAN-META.json");
  if (!existsSync(metaPath)) {
    process.stderr.write(`error: PLAN-META.json not found next to plan at ${metaPath}\n`);
    process.exit(2);
  }
  let meta: PlanInput;
  try {
    meta = JSON.parse(readFileSync(metaPath, "utf8")) as PlanInput;
  } catch (err) {
    process.stderr.write(`error: PLAN-META.json malformed: ${(err as Error).message}\n`);
    process.exit(2);
  }

  const slug = slugFromMeta(meta);
  const sessionInput: SessionPromptInput = {
    artifact: meta.artifact,
    generatedAt: meta.generatedAt,
    rails: meta.rails,
    units: meta.units,
    roles: meta.roles,
    waves: meta.waves,
    slug,
  };
  const rolloutInput: RolloutStateInput = {
    slug,
    generatedAt: meta.generatedAt,
    rails: meta.rails,
    units: meta.units,
    roles: meta.roles,
    waves: meta.waves,
  };
  const sessionMd = renderSessionPrompt(sessionInput);
  const rolloutMd = renderRolloutState(rolloutInput);

  if (args.dryRun) {
    process.stdout.write("=== session-prompt.md ===\n");
    process.stdout.write(sessionMd);
    process.stdout.write("\n=== rollout-state.md ===\n");
    process.stdout.write(rolloutMd);
    return;
  }

  const outDir = args.out ? resolve(args.out) : dirname(planPath);
  const sessionPath = join(outDir, "session-prompt.md");
  const rolloutPath = join(outDir, "rollout-state.md");
  // writeArtifact:exempt — v0 defers writeArtifact() adoption to a follow-on; artifacts.jsonl append below provides cross-session tracking. Migration blocked on hooks/lib/ import resolution for distributable skills.
  writeFileSync(sessionPath, sessionMd, "utf8");
  // writeArtifact:exempt — same as line above; paired output with session-prompt.md.
  writeFileSync(rolloutPath, rolloutMd, "utf8");
  appendArtifactLog(sessionPath, slug, "session-prompt");
  appendArtifactLog(rolloutPath, slug, "rollout-state");

  process.stdout.write(`wrote ${sessionPath}\n`);
  process.stdout.write(`wrote ${rolloutPath}\n`);
}

function appendArtifactLog(path: string, slug: string, type: string): void {
  const dir = process.env.CLAUDE_PROJECT_DIR
    ? join(process.env.CLAUDE_PROJECT_DIR, "MEMORY/ARTIFACTS")
    : join(homedir(), ".claude/MEMORY/ARTIFACTS");
  if (!existsSync(dir)) return;
  const entry = {
    timestamp: new Date().toISOString(),
    pack: "Utilities",
    workflow: "Ensemble.Emit",
    type,
    title: slug,
    path,
    sessionId: process.env.CLAUDE_SESSION_ID ?? null,
  };
  try {
    appendFileSync(join(dir, "artifacts.jsonl"), JSON.stringify(entry) + "\n");
  } catch {
    /* best-effort */
  }
}

if (import.meta.main) {
  main();
}
