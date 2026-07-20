#!/usr/bin/env bun
/**
 * ResolveRepo — resolve the target kit repo and profile it, with NO hardcoded
 * machine paths. Every substrate tool (VerifyDigest, MakerkitCli preflight, ...)
 * consumes resolveKitRepo() so the pack works on any clone — fork or upstream.
 *
 * Resolution order:
 *   1. explicit argument (CLI --kit-repo / function arg)
 *   2. $KIT_REPO env var (stderr warning so overrides are never silent)
 *   3. `git rev-parse --show-toplevel` from the current working directory
 *   4. throw with an actionable message
 *
 * Usage:
 *   bun run ResolveRepo.ts [path]   # prints the profile JSON
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { spawnSync } from 'child_process';

export type RepoKind = 'fork' | 'upstream' | 'unknown';
export type LintTool = 'oxlint' | 'eslint' | 'unknown';

export interface KitRepoProfile {
  root: string;
  /** package.json name, or 'unknown' when the root has no readable package.json */
  name: string;
  kind: RepoKind;
  /** root package.json scripts (empty object when unreadable) */
  scripts: Record<string, string>;
  lintTool: LintTool;
  /** package.json packageManager field, or 'unknown' */
  packageManager: string;
}

function gitTopLevel(cwd: string): string | null {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  if (r.status !== 0) return null;
  const out = (r.stdout ?? '').trim();
  return out.length > 0 ? out : null;
}

function gitOriginUrl(cwd: string): string {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd, encoding: 'utf8' });
  return r.status === 0 ? (r.stdout ?? '').trim() : '';
}

function classifyKind(name: string, remoteUrl: string): RepoKind {
  if (name === 'dos-prisma-saas-kit') return 'fork';
  if (name === 'next-prisma-kit') return 'upstream';
  const remote = remoteUrl.toLowerCase();
  if (remote.includes('dos-prisma-saas-kit')) return 'fork';
  if (remote.includes('next-prisma-kit') || remote.includes('makerkit')) return 'upstream';
  return 'unknown';
}

function detectLintTool(pkg: { scripts?: Record<string, string>; devDependencies?: Record<string, string>; dependencies?: Record<string, string> }): LintTool {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const lintScript = pkg.scripts?.lint ?? '';
  if ('oxlint' in deps || lintScript.includes('oxlint')) return 'oxlint';
  if ('eslint' in deps || lintScript.includes('eslint')) return 'eslint';
  return 'unknown';
}

/**
 * Resolve the kit repo root (explicit > $KIT_REPO > git toplevel from cwd) and
 * profile it from the root package.json + origin remote. Throws when no root
 * can be resolved; a resolved root with an unreadable package.json degrades to
 * name/lintTool/packageManager 'unknown' (preflight surfaces the gaps).
 */
export function resolveKitRepo(explicit?: string): KitRepoProfile {
  let root: string | null = null;

  if (explicit) {
    root = resolve(explicit);
  } else if (process.env.KIT_REPO) {
    root = resolve(process.env.KIT_REPO);
    console.error(`KIT_REPO override -> ${root}`);
  } else {
    root = gitTopLevel(process.cwd());
  }

  if (!root || !existsSync(root)) {
    throw new Error(
      'Cannot resolve the target kit repo: pass an explicit path (--kit-repo <path>), ' +
        'set $KIT_REPO, or run from inside a git clone of the kit ' +
        `(cwd ${process.cwd()} is not in a git repo${root ? `; candidate ${root} does not exist` : ''}).`,
    );
  }

  let pkg: {
    name?: string;
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
    dependencies?: Record<string, string>;
    packageManager?: string;
  } = {};
  const pkgPath = join(root, 'package.json');
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    // Missing/unparsable package.json: profile degrades to unknowns.
  }

  return {
    root,
    name: pkg.name ?? 'unknown',
    kind: classifyKind(pkg.name ?? '', gitOriginUrl(root)),
    scripts: pkg.scripts ?? {},
    lintTool: detectLintTool(pkg),
    packageManager: pkg.packageManager ?? 'unknown',
  };
}

if (import.meta.main) {
  try {
    const profile = resolveKitRepo(process.argv[2]);
    console.log(JSON.stringify(profile, null, 2));
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
