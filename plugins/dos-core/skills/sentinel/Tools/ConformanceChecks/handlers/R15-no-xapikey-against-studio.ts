/**
 * R15 — DOS-to-Studio header scheme: Bearer-only (no X-API-Key drift).
 *
 * Studio's gateway auth (`apps/web/lib/gateway/auth-bearer.ts`) accepts ONLY
 * `Authorization: Bearer <token>`. Any DOS caller that uses `X-API-Key`
 * against a Studio URL silently 401s — the bug pattern the operator's
 * `Tools/intel-context.ts:403` shipped on 2026-05-03 (Bearer fix landed
 * same day under this audit's PRD).
 *
 * The rule fires only on REGRESSION — it is NOT a Strangler-Fig migration
 * gate (the 22 raw-fetch sites that already use Bearer correctly stay
 * out of scope until the wrapper is promoted to a project-root location
 * reachable by all four sectors). It catches the specific class of bug
 * that the X-API-Key 401 represented, before that bug ships again.
 *
 * Failure mode: a `fetch(...)` call where (a) the file contains
 * `X-API-Key` or `X-Api-Key` literal AND (b) the file references a
 * Studio URL token — one of `STUDIO_API_URL`, `DOS_STUDIO_ENDPOINT`,
 * `duranteos.com`, OR the heuristic pairing `/api/v1/` together with
 * `localhost:3000` (the Studio dev server). A bare `/api/v1/` path
 * alone does NOT trip the rule: it is too common across third-party
 * REST APIs to disambiguate from Studio without a host token, and the
 * rule is regression-scoped (false positives would block unrelated
 * callers). Third-party APIs that correctly use X-API-Key
 * (`api.remove.bg`, `api.cleanvoice.ai`) are exempt because their files
 * don't reference any Studio URL token.
 *
 * Scopes scanned (existsSync-gated — missing directories silently skip):
 *   - <repoRoot>/Tools/
 *   - <repoRoot>/Packs/
 *   - <repoRoot>/Releases/v*\/.claude/hooks/        (every frozen + active release)
 *   - <repoRoot>/Releases/v*\/.claude/DOS/Tools/    (every frozen + active release)
 *   - <repoRoot>/npm-package/
 *
 * Releases scopes are discovered at runtime (readdirSync on Releases/) so the
 * scan auto-tracks the active submodule across freezes — no per-version edit
 * needed. CLAUDE.md L62 path-literal coupling note is satisfied here.
 *
 * File extensions: .ts, .js (Bun + Node tools).
 * Skip patterns: node_modules, dist, .bak files, test fixtures.
 *
 * Evidence on PASS: the bearer-site count is included (informational —
 * lights up the Strangler Fig backlog without breaking builds today).
 *
 * Why not C-class (workflow-regex.*): R-class is RFC requirement, C-class
 * is convention. Bearer-only is a server-imposed contract, not a stylistic
 * convention. R15 fits the requirement bucket.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const STUDIO_URL_TOKENS = [
  "STUDIO_API_URL",
  "DOS_STUDIO_ENDPOINT",
  "duranteos.com",
] as const;

const XAPIKEY_PATTERN = /["']X-Api-Key["']/i;

const BEARER_AGAINST_STUDIO_PATTERN = /Authorization\s*:\s*[`'"]Bearer\s/;

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".next",
  "__tests__",
  "__fixtures__",  // R-fixtures intentionally contain the literals the rule detects
]);

const SKIP_FILE_SUFFIXES = [".bak", ".test.ts", ".test.js", ".spec.ts", ".spec.js"];

interface ScanScope {
  label: string;
  absPath: string;
}

interface FileFinding {
  file: string;
  line: number;
  match: string;
}

function discoverReleaseScopes(repoRoot: string): ScanScope[] {
  const releasesDir = join(repoRoot, "Releases");
  if (!existsSync(releasesDir)) return [];
  let entries: string[];
  try {
    entries = readdirSync(releasesDir);
  } catch {
    return [];
  }
  const scopes: ScanScope[] = [];
  for (const entry of entries) {
    if (!entry.startsWith("v")) continue;
    const claudeDir = join(releasesDir, entry, ".claude");
    if (!existsSync(claudeDir)) continue;
    scopes.push({
      label: `Releases/${entry}/.claude/hooks/`,
      absPath: join(claudeDir, "hooks"),
    });
    scopes.push({
      label: `Releases/${entry}/.claude/DOS/Tools/`,
      absPath: join(claudeDir, "DOS", "Tools"),
    });
  }
  return scopes;
}

function collectFiles(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;

  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = join(dir, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }

      if (st.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry) || entry.startsWith(".")) continue;
        stack.push(full);
      } else if (st.isFile()) {
        if (!entry.endsWith(".ts") && !entry.endsWith(".js")) continue;
        if (SKIP_FILE_SUFFIXES.some((suffix) => entry.endsWith(suffix))) continue;
        out.push(full);
      }
    }
  }
  return out;
}

function fileReferencesStudio(content: string): boolean {
  if (STUDIO_URL_TOKENS.some((token) => content.includes(token))) return true;
  // Heuristic: hardcoded /api/v1/ path WITH localhost:3000 (Studio dev server)
  if (content.includes("/api/v1/") && content.includes("localhost:3000")) return true;
  return false;
}

function findXApiKeyLines(content: string): FileFinding[] {
  const findings: FileFinding[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (XAPIKEY_PATTERN.test(line)) {
      findings.push({
        file: "",
        line: i + 1,
        match: line.trim().slice(0, 120),
      });
    }
  }
  return findings;
}

function countBearerSites(content: string): number {
  let count = 0;
  for (const line of content.split("\n")) {
    if (BEARER_AGAINST_STUDIO_PATTERN.test(line)) count++;
  }
  return count;
}

export async function r15NoXApiKeyAgainstStudio(ctx: CheckContext): Promise<CheckResult> {
  const requirement =
    "DOS callers must use `Authorization: Bearer <token>` against Studio's /api/v1/* surface; X-API-Key is silently 401'd by gateway auth";

  const repoRoot = ctx.repoRoot;
  if (!repoRoot) {
    return {
      rId: "R15",
      requirement,
      status: "not_applicable",
      evidence: ["repoRoot not set on CheckContext — cannot scope scan"],
    };
  }

  const scopes: ScanScope[] = [
    { label: "Tools/", absPath: join(repoRoot, "Tools") },
    { label: "Packs/", absPath: join(repoRoot, "Packs") },
    ...discoverReleaseScopes(repoRoot),
    { label: "npm-package/", absPath: join(repoRoot, "npm-package") },
  ];

  const livingScopes = scopes.filter((scope) => existsSync(scope.absPath));
  if (livingScopes.length === 0) {
    return {
      rId: "R15",
      requirement,
      status: "not_applicable",
      evidence: ["none of the expected DOS source directories present at repoRoot"],
    };
  }

  const violations: FileFinding[] = [];
  let bearerSiteCount = 0;
  let filesScanned = 0;

  for (const scope of livingScopes) {
    const files = collectFiles(scope.absPath);
    filesScanned += files.length;
    for (const file of files) {
      let content: string;
      try {
        content = readFileSync(file, "utf-8");
      } catch {
        continue;
      }

      bearerSiteCount += countBearerSites(content);

      if (!fileReferencesStudio(content)) continue;

      const xApiKeyLines = findXApiKeyLines(content);
      for (const finding of xApiKeyLines) {
        violations.push({
          file: relative(repoRoot, file),
          line: finding.line,
          match: finding.match,
        });
      }
    }
  }

  if (violations.length === 0) {
    return {
      rId: "R15",
      requirement,
      status: "pass",
      evidence: [
        `scanned ${filesScanned} files across ${livingScopes.length} scopes — no X-API-Key against Studio URL`,
        `Bearer sites against Studio: ${bearerSiteCount} (informational — Strangler Fig backlog if/when wrapper is promoted to project-root location)`,
      ],
    };
  }

  return {
    rId: "R15",
    requirement,
    status: "fail",
    evidence: violations.map((v) => `${v.file}:${v.line} — ${v.match}`),
  };
}
