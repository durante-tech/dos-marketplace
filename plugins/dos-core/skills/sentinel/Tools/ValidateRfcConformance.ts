#!/usr/bin/env bun
/**
 * ValidateRfcConformance — Sentinel CLI for running RFC §13 profile checks.
 *
 * Loads the machine-readable conformance manifest from the RFC markdown
 * (default: Plans/Specs/RFC-0005-memory-graph-protocol.md), resolves each
 * requirement's `check` identifier to a handler in registry.ts, and emits
 * a pass/fail matrix.
 *
 * Usage:
 *   bun ValidateRfcConformance.ts [options]
 *
 * Options:
 *   --rfc <path>          RFC markdown file (default: Plans/Specs/RFC-0005-memory-graph-protocol.md)
 *   --profile <name>      v1-wired | v1-observable | v2-forward | all (default: all)
 *   --check <rId>         Run a single R-point (e.g. R2). Overrides --profile scope.
 *   --repo-root <dir>     Target repo root (default: inferred from cwd via git)
 *   --hooks-root <dir>    Hook directory override (default: ~/.claude/hooks)
 *   --bridge <path>       Bridge file path (default: ~/.claude/DOS/Tools/mempalace_bridge.py)
 *   --json                Machine-readable output
 *
 * Exit codes:
 *   0 — all executed checks pass (or are not_applicable)
 *   1 — at least one check failed
 *   2 — argument / parse / manifest error
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import { HANDLERS, hasHandler } from "./ConformanceChecks/registry.ts";
import {
  loadManifest,
  profileByName,
  ManifestParseError,
} from "./ConformanceChecks/profile-loader.ts";
import { loadCatalogRegistryIds } from "./ConformanceChecks/lib/capability-registry-ids.ts";
import type {
  CheckContext,
  CheckResult,
  ConformanceManifest,
  Profile,
} from "./ConformanceChecks/types.ts";

interface Args {
  rfc: string;
  profile: string;
  check: string | null;
  repoRoot: string;
  hooksRoot: string;
  bridgePath: string;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const cwd = process.cwd();
  let repoRoot = cwd;
  try {
    repoRoot = execSync("git rev-parse --show-toplevel", { cwd, encoding: "utf-8" }).trim();
  } catch {
    // not a git repo — keep cwd
  }
  const args: Args = {
    rfc: join(repoRoot, "Plans/Specs/RFC-0005-memory-graph-protocol.md"),
    profile: "all",
    check: null,
    repoRoot,
    hooksRoot: join(homedir(), ".claude", "hooks"),
    bridgePath: join(homedir(), ".claude", "DOS", "Tools", "mempalace_bridge.py"),
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--json") args.json = true;
    else if (a === "--rfc" && next) { args.rfc = resolve(next); i++; }
    else if (a === "--profile" && next) { args.profile = next; i++; }
    else if (a === "--check" && next) { args.check = next; i++; }
    else if (a === "--repo-root" && next) { args.repoRoot = resolve(next); i++; }
    else if (a === "--hooks-root" && next) { args.hooksRoot = resolve(next); i++; }
    else if (a === "--bridge" && next) { args.bridgePath = resolve(next); i++; }
    else if (a === "--help" || a === "-h") { printHelp(); process.exit(0); }
  }
  return args;
}

function printHelp(): void {
  console.log(`ValidateRfcConformance — Run RFC §13 profile checks

USAGE
  bun ValidateRfcConformance.ts [options]

OPTIONS
  --rfc <path>         RFC markdown (default: Plans/Specs/RFC-0005-memory-graph-protocol.md)
  --profile <name>     v1-wired | v1-observable | v2-forward | all (default: all)
  --check <rId>        Single R-point (e.g. R2); overrides profile scope
  --repo-root <dir>    Repo root (default: git rev-parse --show-toplevel)
  --hooks-root <dir>   Hooks directory (default: ~/.claude/hooks)
  --bridge <path>      Bridge file (default: ~/.claude/DOS/Tools/mempalace_bridge.py)
  --json               Emit machine-readable JSON

EXIT
  0  all executed checks pass or not_applicable
  1  at least one check failed
  2  argument / parse / manifest error`);
}

function profilesToRun(manifest: ConformanceManifest, args: Args): Profile[] {
  if (args.profile === "all") {
    return Object.keys(manifest.profiles).map(n => profileByName(manifest, n));
  }
  return [profileByName(manifest, args.profile)];
}

function filterByCheck(profile: Profile, rId: string | null): Profile {
  if (!rId) return profile;
  return {
    ...profile,
    requirements: profile.requirements.filter(r => r.id === rId),
  };
}

async function runProfile(profile: Profile, ctx: CheckContext): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const req of profile.requirements) {
    if (!hasHandler(req.check)) {
      results.push({
        rId: req.id,
        requirement: req.text,
        status: "not_applicable",
        evidence: [`no handler registered for check '${req.check}' (deferred to future PR)`],
      });
      continue;
    }
    const handler = HANDLERS[req.check]!;
    try {
      results.push(await handler(ctx));
    } catch (err) {
      results.push({
        rId: req.id,
        requirement: req.text,
        status: "fail",
        evidence: [`handler threw: ${err instanceof Error ? err.message : String(err)}`],
      });
    }
  }
  return results;
}

function renderHuman(
  manifest: ConformanceManifest,
  profile: Profile,
  results: CheckResult[],
): string {
  const lines = [
    `${profile.name} (§${profile.section}) — ${manifest.rfc}`,
  ];
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : r.status === "fail" ? "✘" : "○";
    lines.push(`  ${mark} ${r.rId}: ${r.requirement}  [${r.status}]`);
    if (r.status !== "pass") {
      for (const ev of r.evidence) lines.push(`      ${ev}`);
    }
  }
  return lines.join("\n");
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.rfc)) {
    console.error(`RFC not found: ${args.rfc}`);
    return 2;
  }

  let manifest: ConformanceManifest;
  try {
    manifest = loadManifest(args.rfc);
  } catch (err) {
    if (err instanceof ManifestParseError) {
      console.error(`manifest error: ${err.message}`);
      return 2;
    }
    throw err;
  }

  const ctx: CheckContext = {
    repoRoot: args.repoRoot,
    hooksRoot: args.hooksRoot,
    ...(args.bridgePath ? { bridgePath: args.bridgePath } : {}),
    // SENT-08: populate the live RFC-0026 registry id set so R82's §10.6
    // unknown-capability-id check runs (fail-open: empty when the registry is
    // unavailable, which degrades §10.6 to a no-op rather than false-failing).
    catalogRegistryIds: await loadCatalogRegistryIds(),
  };

  const profiles = profilesToRun(manifest, args).map(p => filterByCheck(p, args.check));
  const report: { profile: string; section: string; results: CheckResult[] }[] = [];
  let anyFailed = false;

  for (const profile of profiles) {
    if (profile.requirements.length === 0) continue;
    const results = await runProfile(profile, ctx);
    if (results.some(r => r.status === "fail")) anyFailed = true;
    report.push({ profile: profile.name, section: profile.section, results });
    if (!args.json) console.log(renderHuman(manifest, profile, results));
  }

  if (args.json) {
    console.log(JSON.stringify({
      rfc: manifest.rfc,
      rfc_title: manifest.rfc_title,
      schema_version: manifest.schema_version,
      profiles: report,
      ok: !anyFailed,
    }, null, 2));
  }

  return anyFailed ? 1 : 0;
}

main().then(code => process.exit(code)).catch(err => {
  console.error("ValidateRfcConformance failed:", err instanceof Error ? err.stack : err);
  process.exit(2);
});
