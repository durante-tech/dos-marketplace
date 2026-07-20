/**
 * ConformanceChecks — canonical types shared across handlers, loader, CLI.
 *
 * See RFC-0005 §13.0 for the authoring contract (machine-readable YAML
 * manifest embedded in the RFC markdown). `schema_version` in the manifest
 * MUST match SUPPORTED_SCHEMA_VERSION here; parser fails closed on mismatch.
 */

export const SUPPORTED_SCHEMA_VERSION = 1 as const;

export type Status = "pass" | "fail" | "not_applicable";

export interface CheckContext {
  repoRoot: string;
  hooksRoot: string;
  bridgePath?: string;
  packRoot?: string;
  ringBufferPath?: string;
  pkgSpecPath?: string;
  /** R10 override: path to SessionCleanup.hook.ts. Defaults to <hooksRoot>/SessionCleanup.hook.ts. */
  sessionCleanupPath?: string;
  /** R9 override: path to settings.json. Defaults to <hooksRoot>/../settings.json. */
  settingsPath?: string;
  /** R7 override: path to lib/mempalace.ts. Defaults to <hooksRoot>/lib/mempalace.ts. */
  mempalaceLibPath?: string;
  /** R17 override: path to .sentinel/conventions.json. Defaults to <repoRoot>/.sentinel/conventions.json. */
  conventionsPath?: string;
  /** R18 override: root of backup directories. Defaults to ~/Library/Application Support/DOS/backups. */
  backupRootPath?: string;
  /** R18 test seam: override Date.now() for backup age calculation. Defaults to Date.now(). */
  nowMs?: number;
  /** R19 override: path to .gitmodules. Defaults to <repoRoot>/.gitmodules. */
  gitmodulesPath?: string;
  /** R19 test seam: custom drift-check function. Returns list of drifted file paths for a frozen
   *  release (empty array = no drift). When omitted, production uses `git diff HEAD --name-only`. */
  checkReleaseDriftFn?: (releasePath: string, versionName: string) => Promise<string[]>;
  /** R26 test seam: override the hooks/lib directory. Defaults to ~/.claude/hooks/lib.
   *  Added 2026-05-25 (v0.0.18 close-out flaky-test audit, PRD 20260525-185211_v0019-housekeeping-stubs)
   *  to make R26 fixturable without requiring HOME-relative fixtures. Mirrors the
   *  conventionsPath / gitmodulesPath / mempalaceLibPath seam pattern. */
  hooksLibPath?: string;
  /** R28 override: path to sync-check.ts. Defaults to ~/Durante/Tools/sync-check.ts then <repoRoot>/Tools/sync-check.ts. */
  syncCheckPath?: string;
  /** R34 override: path to working-tree-clean-gate.ts. Defaults to ~/Durante/Tools/working-tree-clean-gate.ts then <repoRoot>/Tools/working-tree-clean-gate.ts. */
  gatePath?: string;
  /** R28/R34 test seam: injectable command runner replacing spawnSync. Lets tests
   *  pin pass/fail/not_applicable deterministically without depending on the host
   *  shell or bun:test child-process behavior (spawnSync returns status 2 / empty
   *  output under the bun test runner). Defaults to spawnSync. See sentinel-engine-014. */
  exec?: (cmd: string, args: string[]) => { status: number | null; stdout: string; stderr: string };
  /** R82 override: dir of capability-select surfaced sidecars. Defaults to
   *  <repoRoot>/MEMORY/STATE/capability-surfaced (RFC-0134 §10.1). */
  catalogSurfacedDir?: string;
  /** R82 seam: live RFC-0026 registry capability ids, for the §10.6 unknown-id check.
   *  When omitted/empty the unknown-id check degrades (skips) rather than false-failing. */
  catalogRegistryIds?: ReadonlySet<string>;
  /** R85 override: path to the conformance registry source. Defaults to
   *  <repoRoot>/Packs/sentinel/src/Tools/ConformanceChecks/registry.ts. */
  catalogRegistryPath?: string;
  /** R85 override: path to the workflow doc carrying the generated R-rule catalog.
   *  Defaults to <repoRoot>/Packs/sentinel/src/Workflows/Conformance.md. */
  catalogDocPath?: string;
}

export interface CheckResult {
  rId: string;
  requirement: string;
  status: Status;
  evidence: string[];
  loc?: string;
}

export type CheckHandler = (ctx: CheckContext) => Promise<CheckResult>;

export interface Requirement {
  id: string;
  text: string;
  check: string;
}

export interface Profile {
  name: string;
  section: string;
  requirements: Requirement[];
}

export interface Convention {
  id: string;
  text: string;
  source_section: string;
  check: string;
}

export interface ConformanceManifest {
  schema_version: number;
  rfc: string;
  rfc_title: string;
  profiles: Record<string, Profile>;
  conventions?: Record<string, Convention>;
}
