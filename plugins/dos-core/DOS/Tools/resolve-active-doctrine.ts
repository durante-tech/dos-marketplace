#!/usr/bin/env bun

/**
 * resolve-active-doctrine.ts
 *
 * Single source of truth for "what is the currently-active Algorithm doctrine".
 * Reads ~/.claude/DOS/Algorithm/LATEST (a text pointer file containing the version
 * string, e.g. "v0.0.8") and returns:
 *   - version: bare version string ("v0.0.8")
 *   - specPath: absolute path to the doctrine spec markdown
 *   - liteProfilePath: absolute path to the condensed Subagent Algorithm Profile
 *
 * Used by tools and templates that previously hardcoded version numbers
 * (DynamicAgent.hbs, Ensemble/RenderSessionPrompt.ts, etc.) so those references
 * track the active doctrine automatically across version bumps.
 *
 * Usage as library:
 *   import { resolveActiveDoctrine } from '~/Durante/Tools/resolve-active-doctrine.ts';
 *   const { version, specPath, liteProfilePath } = resolveActiveDoctrine();
 *
 * Usage as CLI:
 *   bun resolve-active-doctrine.ts             # human-readable
 *   bun resolve-active-doctrine.ts --json      # machine-readable
 *   bun resolve-active-doctrine.ts --version   # bare version string only
 *   bun resolve-active-doctrine.ts --spec-path # absolute path only
 *
 * Spec lineage: introduced 2026-05-10 to retire hardcoded `v0.0.7.md` references
 * found across DynamicAgent.hbs and RenderSessionPrompt.ts.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME || "";
const CLAUDE_DIR = join(HOME, ".claude");
const ALGORITHM_DIR = join(CLAUDE_DIR, "DOS", "Algorithm");
const LATEST_POINTER = join(ALGORITHM_DIR, "LATEST");
const DEFAULT_LATEST = join(ALGORITHM_DIR, ".default-LATEST");
const LITE_PROFILE = join(CLAUDE_DIR, "DOS", "PARTIALS", "_algorithm-lite.md");

// Fallback resolution order:
//   1. the committed install default (.default-LATEST) — so the fallback can
//      never drift from what ships in the box (the original v0.0.8 drift class)
//   2. a hardcoded last-resort if .default-LATEST is also unreadable
const HARDCODED_FALLBACK = "v0.0.10";

function resolveFallbackVersion(): string {
  try {
    if (existsSync(DEFAULT_LATEST)) {
      const raw = readFileSync(DEFAULT_LATEST, "utf-8").trim();
      if (raw && /^v\d+\.\d+\.\d+(-\w+)?$/.test(raw)) return raw;
    }
  } catch {
  }
  return HARDCODED_FALLBACK;
}

const FALLBACK_VERSION = resolveFallbackVersion();

export interface ResolvedDoctrine {
  version: string;
  specPath: string;
  liteProfilePath: string;
  source: "LATEST" | "fallback";
}

export function resolveActiveDoctrine(): ResolvedDoctrine {
  let version = FALLBACK_VERSION;
  let source: ResolvedDoctrine["source"] = "fallback";

  try {
    if (existsSync(LATEST_POINTER)) {
      const raw = readFileSync(LATEST_POINTER, "utf-8").trim();
      if (raw && /^v\d+\.\d+\.\d+(-\w+)?$/.test(raw)) {
        version = raw;
        source = "LATEST";
      }
    }
  } catch {
  }

  const specPath = join(ALGORITHM_DIR, `${version}.md`);

  if (!existsSync(specPath)) {
    const fallbackPath = join(ALGORITHM_DIR, `${FALLBACK_VERSION}.md`);
    if (existsSync(fallbackPath)) {
      return {
        version: FALLBACK_VERSION,
        specPath: fallbackPath,
        liteProfilePath: LITE_PROFILE,
        source: "fallback",
      };
    }
  }

  return {
    version,
    specPath,
    liteProfilePath: LITE_PROFILE,
    source,
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const resolved = resolveActiveDoctrine();

  if (argv.includes("--json")) {
    console.log(JSON.stringify(resolved, null, 2));
  } else if (argv.includes("--version")) {
    console.log(resolved.version);
  } else if (argv.includes("--spec-path")) {
    console.log(resolved.specPath);
  } else if (argv.includes("--lite-path")) {
    console.log(resolved.liteProfilePath);
  } else {
    console.log(`active doctrine:   ${resolved.version}  (${resolved.source})`);
    console.log(`spec:              ${resolved.specPath}`);
    console.log(`condensed profile: ${resolved.liteProfilePath}`);
  }
}
