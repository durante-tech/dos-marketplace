/**
 * scope-consult.ts — the impure companion to the pure mode-classifier.
 *
 * The classifier (mode-classifier.ts) is pure and bridge-free (clause D); ALL
 * repo knowledge enters through an injected `ScopeConsult` function so the
 * corpus test can run hermetically (clause F). This file provides the REAL,
 * filesystem-backed consult used at hook runtime.
 *
 * "Cheap repo-scope consult" of spec A.4(d)/A.5: synchronous existsSync-based
 * token resolution rooted at CLAUDE_PROJECT_DIR / cwd, plus a STATIC
 * KNOWN_MULTI_SITE table that carries the A.4 demotion data (version-bump
 * names six files per CLAUDE.md; getMemorySubdir fan-out). NO bridge calls
 * (clause D) — the bridge is async and would violate the synchronous contract.
 *
 * Pure module boundary: mode-classifier.ts NEVER imports this file. The hook
 * (IntentRetrieval, in S3) imports both and injects defaultScopeConsult() into
 * classifyPrompt. Tests inject their own fake ScopeConsult.
 */

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { expandPath } from './paths';
import type { RepoScopeFacts, ScopeConsult } from './mode-classifier';

// ─── Known multi-site tokens (A.4 demotion table) ─────────────────────────
//
// In THIS repo these tokens name multi-file, hard-to-undo work, so the
// bump/version/rename archetype is demoted from sufficient NATIVE evidence to
// CANDIDATE evidence (spec A.4(d)). The value is the human-readable site count
// rationale surfaced as `knownMultiSiteToken`.
//
// Source: CLAUDE.md "Version-bump sites (six)" and the getMemorySubdir
// project/global fan-out.
const KNOWN_MULTI_SITE: Array<{ re: RegExp; token: string }> = [
  // Version bump touches SIX fields per CLAUDE.md (version.json ×2, settings.json
  // ×2, npm-package/package.json, DOS-Install/version.json).
  { re: /\b(version[- ]?bump|bump (?:the )?(?:dos )?version|version freeze|freeze)\b/i, token: 'version-bump (6 sites)' },
  // getMemorySubdir resolution fans across project + cwd + global roots.
  { re: /\bgetMemorySubdir\b/i, token: 'getMemorySubdir (project/global fan-out)' },
  // Four-copy rule: skills/hooks exist in up to four locations.
  { re: /\b(four[- ]cop(?:y|ies)|sync-check)\b/i, token: 'four-copy (multi-location)' },
];

// ─── Repo-resolvable token extraction ─────────────────────────────────────
//
// Pull file-path-shaped and module-name-shaped tokens out of the human text,
// then test each against the live tree. A token "resolves" when existsSync
// confirms a matching path under the project root.

/** Path-shaped or dotted-module tokens (e.g. `foo/bar.ts`, `lib/paths`, `Tools/x.ts`). */
const PATH_TOKEN_RE = /(?:^|\s|@|`|\(|\[)([A-Za-z0-9_./@()[\]-]*\/[A-Za-z0-9_./@()[\]-]+|[A-Za-z0-9_-]+\.(?:ts|tsx|js|jsx|json|md|mdoc|prisma|py|sh|yaml|yml))/g;

function projectRoot(): string {
  const envDir = process.env.CLAUDE_PROJECT_DIR;
  if (envDir) {
    const expanded = expandPath(envDir);
    if (existsSync(expanded)) return expanded;
  }
  try {
    return process.cwd();
  } catch {
    return '/';
  }
}

// The hooks tree lives under DOS_DIR (~/.claude), which in a Durante session is
// NOT under CLAUDE_PROJECT_DIR (~/Durante) — probing only <projectRoot>/hooks
// misses every hook identifier ('fix the rating-capture misparse' would fall to
// class-7 silence instead of finding RatingCapture.hook.ts). Probe both roots.
function dosRoot(): string {
  return process.env.DOS_DIR || join(homedir(), '.claude');
}

// Hyphenated / PascalCase identifier tokens (e.g. `rating-capture`,
// `RatingCapture`, `mode-header`). Resolved by mapping to a candidate
// hook/lib filename and probing the hooks tree. This is what lets
// 'fix the rating-capture misparse' (live misroute b) find scope evidence
// (rating-capture → hooks/RatingCapture.hook.ts) per spec A.5.
const IDENT_TOKEN_RE = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)+|[A-Z][a-zA-Z0-9]+)\b/g;

/** kebab-case → PascalCase ('rating-capture' → 'RatingCapture'). */
function kebabToPascal(s: string): string {
  return s
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/**
 * Count distinct repo-resolvable component tokens in the human text. A token
 * counts when its path exists under the project root. Bare module names without
 * an extension are probed against common source roots; identifier-shaped tokens
 * are probed against the hooks/lib tree (hook + lib filename shapes).
 */
function resolveTokens(humanText: string, roots: string[]): number {
  const resolved = new Set<string>();

  // 1. Path-shaped tokens (direct existence under any root).
  let m: RegExpExecArray | null;
  PATH_TOKEN_RE.lastIndex = 0;
  while ((m = PATH_TOKEN_RE.exec(humanText)) !== null) {
    const raw = (m[1] || '').replace(/[`()[\]]/g, '').replace(/^@/, '');
    if (!raw || raw.length < 3) continue;
    outer1: for (const root of roots) {
      const candidates = [join(root, raw), join(root, `${raw}.ts`), join(root, `${raw}.tsx`)];
      for (const c of candidates) {
        try {
          if (existsSync(c)) {
            resolved.add(resolve(c));
            break outer1;
          }
        } catch {
          /* unreadable path — skip */
        }
      }
    }
  }

  // 2. Identifier-shaped tokens → hook/lib filename probes under each root's
  // hooks tree (projectRoot/hooks for in-repo hooks, dosRoot/hooks for the
  // live DOS install).
  IDENT_TOKEN_RE.lastIndex = 0;
  while ((m = IDENT_TOKEN_RE.exec(humanText)) !== null) {
    const raw = m[1] || '';
    if (raw.length < 4) continue;
    const pascal = raw.includes('-') ? kebabToPascal(raw) : raw;
    outer2: for (const root of roots) {
      const hooksDir = join(root, 'hooks');
      const libDir = join(hooksDir, 'lib');
      const candidates = [
        join(hooksDir, `${pascal}.hook.ts`),
        join(libDir, `${raw}.ts`),
        join(libDir, `${raw.toLowerCase()}.ts`),
      ];
      for (const c of candidates) {
        try {
          if (existsSync(c)) {
            resolved.add(resolve(c));
            break outer2;
          }
        } catch {
          /* unreadable path — skip */
        }
      }
    }
  }

  return resolved.size;
}

/**
 * Build the real, filesystem-backed ScopeConsult. Returns a synchronous
 * closure (clause D). Resolution degrades gracefully when launched outside a
 * repo: resolvedTargets falls to 0 and class 4(d) cannot pass — lawful under
 * A.6's honest-residual clause (silence, never false assertion).
 */
export function defaultScopeConsult(): ScopeConsult {
  const proj = projectRoot();
  const dos = dosRoot();
  const roots = resolve(proj) === resolve(dos) ? [proj] : [proj, dos];
  return (humanText: string): RepoScopeFacts => {
    const resolvedTargets = resolveTokens(humanText, roots);

    let knownMultiSiteToken: string | null = null;
    for (const k of KNOWN_MULTI_SITE) {
      if (k.re.test(humanText)) {
        knownMultiSiteToken = k.token;
        break;
      }
    }

    // multiComponent: the prompt names >=2 resolvable components OR a
    // known multi-site token (version-bump etc.).
    const multiComponent = resolvedTargets >= 2 || knownMultiSiteToken !== null;
    // singleFileTarget: exactly one resolvable target AND no multi-site signal.
    const singleFileTarget = resolvedTargets === 1 && knownMultiSiteToken === null;

    return { resolvedTargets, multiComponent, singleFileTarget, knownMultiSiteToken };
  };
}
