#!/usr/bin/env bun
/**
 * DiscoverRails — extract project conventions from filesystem + git + CLAUDE.md.
 *
 * Runs 10 grep/filesystem signals in parallel (conceptually — node:fs is
 * synchronous so we batch the reads without Promise.all, but the cost is all
 * local ms-level I/O). With `--llm-fallback`, any remaining unfilled fields
 * get a single Inference.ts (fast/Haiku) digest call against CLAUDE.md.
 *
 * Gaps are accumulated, not thrown. DiscoverRails is permissive — missing
 * rails become explicit `gaps` entries the operator resolves in
 * DELIVERY-PLAN.md before Emit.
 */

import { execSync, execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun" | "unknown";
export type Monorepo = "turbo" | "nx" | "pnpm-workspaces" | "none";

export type ProjectRails = {
  project_path: string;
  claude_md_present: boolean;
  four_copy_rule: boolean;
  submodule_paths: string[];
  sync_check: boolean;
  package_manager: PackageManager;
  monorepo: Monorepo;
  typecheck_cmd: string | null;
  test_cmd: string | null;
  precommit_hook: boolean;
  commit_convention: string | null;
  available_skills: string[];
  gaps: string[];
};

const GAP_NO_CLAUDE_MD = "No CLAUDE.md detected in target project — rails discovery runs blind.";
const GAP_NO_TYPECHECK = "No typecheck script found in package.json — specify manually.";
const GAP_NO_TEST = "No test script found in package.json — specify manually.";

export async function discoverRails(
  projectPath: string,
  opts?: { llmFallback?: boolean },
): Promise<ProjectRails> {
  const root = resolve(projectPath);
  const rails: ProjectRails = {
    project_path: root,
    claude_md_present: false,
    four_copy_rule: false,
    submodule_paths: [],
    sync_check: false,
    package_manager: "unknown",
    monorepo: "none",
    typecheck_cmd: null,
    test_cmd: null,
    precommit_hook: false,
    commit_convention: null,
    available_skills: [],
    gaps: [],
  };

  // Signal 1: CLAUDE.md presence + Four Copies mention. Hoist the file contents
  // so the LLM fallback below can reuse it without re-reading.
  const claudePath = join(root, "CLAUDE.md");
  let claudeContent: string | null = null;
  if (existsSync(claudePath)) {
    rails.claude_md_present = true;
    claudeContent = readFileSync(claudePath, "utf8");
    rails.four_copy_rule = /four.cop|4.cop/i.test(claudeContent);
  } else {
    rails.gaps.push(GAP_NO_CLAUDE_MD);
  }

  // Signal 2: submodules
  try {
    const out = execSync("git submodule status", { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (out.length > 0) {
      rails.submodule_paths = out
        .split("\n")
        .map((l) => l.trim().split(/\s+/)[1])
        .filter((s): s is string => Boolean(s));
    }
  } catch {
    /* not a git repo or no submodules */
  }

  // Signal 3: sync-check manifest
  rails.sync_check = existsSync(join(root, ".dos-sync-manifest.json"));

  // Signal 4: package manager
  if (existsSync(join(root, "pnpm-lock.yaml"))) rails.package_manager = "pnpm";
  else if (existsSync(join(root, "yarn.lock"))) rails.package_manager = "yarn";
  else if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) rails.package_manager = "bun";
  else if (existsSync(join(root, "package-lock.json"))) rails.package_manager = "npm";

  // Signal 5: monorepo shape
  if (existsSync(join(root, "turbo.json"))) rails.monorepo = "turbo";
  else if (existsSync(join(root, "nx.json"))) rails.monorepo = "nx";
  else if (existsSync(join(root, "pnpm-workspace.yaml"))) rails.monorepo = "pnpm-workspaces";

  // Signal 6 + 7: typecheck + test commands (package.json scripts)
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { scripts?: Record<string, string> };
      const scripts = pkg.scripts ?? {};
      rails.typecheck_cmd = scripts["typecheck"] ?? scripts["type-check"] ?? scripts["tsc"] ?? null;
      rails.test_cmd = scripts["test"] ?? scripts["test:unit"] ?? null;
    } catch (err) {
      rails.gaps.push(`package.json parse failed: ${(err as Error).message}`);
    }
  }
  if (!rails.typecheck_cmd) rails.gaps.push(GAP_NO_TYPECHECK);
  if (!rails.test_cmd) rails.gaps.push(GAP_NO_TEST);

  // Signal 8: pre-commit hook
  rails.precommit_hook = existsSync(join(root, ".husky/pre-commit")) || existsSync(join(root, ".git/hooks/pre-commit"));

  // Signal 9: commit convention (heuristic)
  try {
    const gitLog = execSync("git log --oneline -20 --format=%s", {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = gitLog.split("\n").filter(Boolean);
    const conventional = lines.filter((l) =>
      /^(feat|fix|chore|refactor|docs|test|style|perf|build|ci)(\([^)]+\))?:\s/.test(l),
    ).length;
    if (lines.length > 0 && conventional / lines.length >= 0.7) {
      rails.commit_convention = "feat(<scope>): <what>";
    }
  } catch {
    /* not a git repo */
  }

  // Signal 10: available skills
  const skillsDir = join(homedir(), ".claude/skills");
  if (existsSync(skillsDir)) {
    try {
      rails.available_skills = readdirSync(skillsDir).filter((n) => !n.startsWith("."));
    } catch {
      /* perm error — leave empty */
    }
  }

  // Optional LLM fallback for remaining gaps (reuses the CLAUDE.md contents
  // already loaded by Signal 1 — no second read).
  if (opts?.llmFallback && claudeContent && rails.gaps.length > 0) {
    try {
      const digest = await llmDigestClaudeMd(claudeContent);
      applyDigest(rails, digest);
    } catch (err) {
      rails.gaps.push(`LLM fallback failed: ${(err as Error).message}`);
    }
  }

  return rails;
}

async function llmDigestClaudeMd(content: string): Promise<Record<string, unknown>> {
  const sliced = content.slice(0, 20_000);
  const system =
    "You are a DOS project-rails extractor. Given a CLAUDE.md, return a strict JSON object with fields: commit_convention (string|null), typecheck_cmd (string|null), test_cmd (string|null), four_copy_rule (boolean). Return ONLY the JSON object.";
  const user = `CLAUDE.md content:\n\n${sliced}`;
  const inferencePath = join(homedir(), ".claude/DOS/Tools/Inference.ts");
  const out = execFileSync(
    "bun",
    [inferencePath, "--level", "fast", "--json", system, user],
    { encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024 },
  );
  let envelope: { parsed?: unknown; output?: string };
  try {
    envelope = JSON.parse(out);
  } catch {
    return {};
  }
  if (envelope.parsed && typeof envelope.parsed === "object") return envelope.parsed as Record<string, unknown>;
  if (typeof envelope.output === "string") {
    try {
      return JSON.parse(envelope.output) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function applyDigest(rails: ProjectRails, digest: Record<string, unknown>): void {
  if (!rails.commit_convention && typeof digest.commit_convention === "string") {
    rails.commit_convention = digest.commit_convention;
  }
  if (!rails.typecheck_cmd && typeof digest.typecheck_cmd === "string") {
    rails.typecheck_cmd = digest.typecheck_cmd;
    rails.gaps = rails.gaps.filter((g) => g !== GAP_NO_TYPECHECK);
  }
  if (!rails.test_cmd && typeof digest.test_cmd === "string") {
    rails.test_cmd = digest.test_cmd;
    rails.gaps = rails.gaps.filter((g) => g !== GAP_NO_TEST);
  }
  if (!rails.four_copy_rule && typeof digest.four_copy_rule === "boolean") {
    rails.four_copy_rule = digest.four_copy_rule;
  }
}

if (import.meta.main) {
  const projectPath = process.argv[2] ?? process.cwd();
  const llm = process.argv.includes("--llm-fallback");
  discoverRails(projectPath, { llmFallback: llm }).then((r) => {
    process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  });
}
