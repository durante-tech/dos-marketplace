#!/usr/bin/env bun
/**
 * LoadPreferences — operator customization layer (L3) for Ensemble.
 *
 * Reads `~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Ensemble/PREFERENCES.md`.
 * Supports three PREFERENCES shapes (first that matches wins):
 *   1. YAML frontmatter block (---\n...\n---)
 *   2. Fenced ```yaml``` block
 *   3. Whole file parsed as YAML
 *
 * Expected document shape:
 *   default:
 *     <rail_key>: <value>
 *   rails:
 *     - when: { path_matches: "~/Durante", project_wing: "durante", git_remote: "..." }
 *       rails:
 *         <rail_key>: <value>
 *
 * Merge order: default → every matching rule in order → last override wins.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

export type WhenClause = {
  path_matches?: string;
  project_wing?: string;
  git_remote?: string;
};

export type PrefRule = { when?: WhenClause; rails?: Record<string, unknown> };
export type PrefsFile = { default?: Record<string, unknown>; rails?: PrefRule[] };

export type LoadContext = {
  projectPath: string;
  projectWing?: string;
  gitRemote?: string;
};

const DEFAULT_PREFS_PATH = join(
  homedir(),
  ".claude/DOS/USER/SKILLCUSTOMIZATIONS/Ensemble/PREFERENCES.md",
);

/** Load + merge operator preferences. Returns empty object when file is absent. */
export function loadPreferences(
  ctx: LoadContext,
  opts?: { path?: string },
): Record<string, unknown> {
  const path = opts?.path ?? DEFAULT_PREFS_PATH;
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8");
  const yamlText = extractYaml(raw);
  if (!yamlText) return {};
  let parsed: PrefsFile | null = null;
  try {
    parsed = parseYaml(yamlText) as PrefsFile | null;
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};

  const out: Record<string, unknown> = { ...(parsed.default ?? {}) };
  for (const rule of parsed.rails ?? []) {
    if (matches(rule.when, ctx)) {
      Object.assign(out, rule.rails ?? {});
    }
  }
  return out;
}

function extractYaml(md: string): string | null {
  const fm = md.match(/^---\s*\n([\s\S]*?)\n---\s*/m);
  if (fm) return fm[1];
  const fence = md.match(/```ya?ml\s*\n([\s\S]*?)\n```/);
  if (fence) return fence[1];
  return md.trim().length > 0 ? md : null;
}

function matches(when: WhenClause | undefined, ctx: LoadContext): boolean {
  if (!when) return true;
  if (when.path_matches) {
    const expanded = expandTilde(when.path_matches);
    if (!resolve(ctx.projectPath).startsWith(resolve(expanded))) return false;
  }
  if (when.project_wing && when.project_wing !== ctx.projectWing) return false;
  if (when.git_remote && ctx.gitRemote && !ctx.gitRemote.includes(when.git_remote)) return false;
  if (when.git_remote && !ctx.gitRemote) return false;
  return true;
}

function expandTilde(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}

if (import.meta.main) {
  const projectPath = process.argv[2] ?? process.cwd();
  const projectWing = process.argv[3];
  const gitRemote = process.argv[4];
  process.stdout.write(
    JSON.stringify(
      loadPreferences({ projectPath, projectWing, gitRemote }),
      null,
      2,
    ) + "\n",
  );
}
