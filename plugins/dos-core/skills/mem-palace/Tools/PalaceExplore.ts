#!/usr/bin/env bun
/**
 * PalaceExplore — Gap-aware project scanner for MemPalace
 *
 * Snapshots current MemPalace state + project file structure,
 * computes coverage gaps, and outputs a structured mining plan.
 *
 * Usage:
 *   bun PalaceExplore.ts [project-path]        # full explore (default: cwd)
 *   bun PalaceExplore.ts --dry [project-path]   # gap report only, no mining plan
 *   bun PalaceExplore.ts --help
 *
 * Output: JSON to stdout + .mempalace/explore-report.json in project
 *
 * @version 1.0.0
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync, statSync } from "fs";
import { basename, join, resolve, relative } from "path";
import { execSync, execFileSync } from "child_process";
import { Glob } from "bun";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GapEntry {
  type: "missing_room" | "thin_room" | "stale_drawer" | "missing_entity" | "missing_relationship" | "orphan_room";
  priority: "P0" | "P1" | "P2";
  room: string;
  detail: string;
  has?: number;
  expected?: number;
  artifacts?: string[];
}

interface MiningAction {
  action: "mine_file" | "mine_dir" | "add_drawer" | "add_kg_entity" | "add_kg_triple";
  file?: string;
  wing: string;
  room: string;
  reason: string;
}

export interface ExploreReport {
  generated: string;
  project: { name: string; path: string; wing: string };
  palace_state: {
    total_drawers: number;
    rooms: Record<string, number>;
    kg_entities: number;
    kg_triples: number;
    entity_types: Record<string, number>;
  };
  project_state: {
    total_files: number;
    key_artifacts: Record<string, string[]>;
    last_commit: string;
    changed_since_last_explore: string[];
  };
  coverage: {
    rooms_found: number;
    rooms_expected: number;
    pct: number;
    drawer_density: string;
  };
  gaps: GapEntry[];
  mining_plan: MiningAction[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sh(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, timeout: 15_000, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function bridge(action: string, args: Record<string, unknown> = {}): Record<string, unknown> {
  const HOME = process.env.HOME || "~";
  const bridgePath = `${HOME}/.claude/DOS/Tools/mempalace_bridge.py`;
  // Fallback to pack source
  const bridgeActual = existsSync(bridgePath)
    ? bridgePath
    : join(__dirname, "bridge.py");

  try {
    // shell-safe: args single-quote-escaped inline (replace(/'/g, ...))
    const raw = execSync(
      `uv run --with 'mempalace>=3.4.1,<4' python3 "${bridgeActual}" ${action} '${JSON.stringify(args).replace(/'/g, "'\\''")}'`,
      { timeout: 30_000, encoding: "utf-8" }
    ).trim();
    return JSON.parse(raw);
  } catch (e) {
    return { status: "error", error: String(e) };
  }
}

async function globPaths(pattern: string, cwd: string, limit = 500): Promise<string[]> {
  const g = new Glob(pattern);
  const results: string[] = [];
  for await (const entry of g.scan({ cwd, absolute: false })) {
    if (
      entry.includes("node_modules/") ||
      entry.includes(".git/") ||
      entry.includes("dist/") ||
      entry.includes("build/") ||
      entry.includes(".next/") ||
      entry.includes(".sentinel/") ||
      entry.includes(".mempalace/")
    ) continue;
    results.push(entry);
    if (results.length >= limit) break;
  }
  return results;
}

function resolveWing(projectPath: string): { wing: string; name: string } | null {
  const HOME = process.env.HOME || "~";
  const projectsPath = join(HOME, ".claude/DOS/USER/PROJECTS/PROJECTS.md");
  if (!existsSync(projectsPath)) return null;

  const content = readFileSync(projectsPath, "utf-8");
  const resolved = resolve(projectPath);

  // Sort by path length descending so longest (most specific) match wins
  const entries: { name: string; path: string; wing: string }[] = [];
  for (const line of content.split("\n")) {
    if (!line.startsWith("|") || line.includes("---") || line.includes("Path")) continue;
    const cells = line.split("|").map(c => c.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    const rawPath = cells[1];
    if (!rawPath || rawPath === "-") continue;
    const expandedPath = rawPath.replace(/^~/, HOME);
    const wing = cells[2].replace(/`/g, "").trim();
    entries.push({ name: cells[0], path: resolve(expandedPath), wing });
  }

  // Longest path match first
  entries.sort((a, b) => b.path.length - a.path.length);
  for (const entry of entries) {
    if (resolved === entry.path || resolved.startsWith(entry.path + "/")) {
      return { wing: entry.wing, name: entry.name };
    }
  }

  // Fallback: directory name
  return { wing: basename(resolved).toLowerCase(), name: basename(resolved) };
}

function getLastExploreDate(projectPath: string): string | null {
  const statePath = join(projectPath, ".mempalace", "last-explore.json");
  if (!existsSync(statePath)) return null;
  try {
    const data = JSON.parse(readFileSync(statePath, "utf-8"));
    return data.date || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Room mapping — what file patterns map to which rooms
// ---------------------------------------------------------------------------

interface RoomMapping {
  room: string;
  patterns: string[];
  description: string;
  priority: "P0" | "P1" | "P2";
}

// MP-041: compile a shell-style glob ('**' = any path span incl. separators,
// '*' = any run within a segment) into an anchored-by-substring regex tested
// against the UNMANGLED file path. Replaces the lossy dot/slash-stripping needle
// that made stale_drawer gap detection a dead branch.
function globToRegex(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; }
      else re += "[^/]*";
    } else if (".+?^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  // Unanchored: a changed path like 'app/api/users/route.ts' should match the
  // pattern '**/api/**/*.ts' wherever it occurs in the path.
  return new RegExp(re);
}

const ROOM_MAPPINGS: RoomMapping[] = [
  // Core identity
  { room: "architecture", patterns: ["CLAUDE.md", "README.md", "ARCHITECTURE.md", "Docs/Sentinel/**/*.md"], description: "Project architecture and identity", priority: "P0" },
  { room: "stack", patterns: ["package.json", "tsconfig.json", "Cargo.toml", "pyproject.toml", "go.mod", "bun.lockb", "pnpm-lock.yaml"], description: "Tech stack and dependencies", priority: "P0" },

  // Database / schema
  { room: "database-schema", patterns: ["**/schema.prisma", "**/migrations/**/*.sql", "**/supabase/**/*.sql"], description: "Database schema and migrations", priority: "P0" },

  // API surface
  { room: "api-routes", patterns: ["**/api/**/*.ts", "**/api/**/*.js", "**/routes/**/*.ts", "**/routes/**/*.js"], description: "API endpoints and route handlers", priority: "P0" },

  // App routes / pages
  { room: "routes", patterns: ["**/app/**/page.tsx", "**/app/**/page.ts", "**/pages/**/*.tsx", "**/app/**/layout.tsx"], description: "Application pages and layouts", priority: "P1" },

  // Services / business logic
  { room: "services", patterns: ["**/services/**/*.ts", "**/lib/**/*.ts", "**/utils/**/*.ts", "**/helpers/**/*.ts"], description: "Business logic and utilities", priority: "P1" },

  // Config
  { room: "configuration", patterns: [".env.example", "**/config/**/*", "**/*.config.*"], description: "Configuration files", priority: "P1" },

  // Infrastructure
  { room: "infrastructure", patterns: ["Dockerfile", "docker-compose.*", ".github/workflows/**/*", "railway.json", "vercel.json", "fly.toml"], description: "Deployment and CI/CD", priority: "P1" },

  // External integrations
  { room: "external-integrations", patterns: ["**/integrations/**/*", "**/providers/**/*", "**/workers/**/*"], description: "Third-party integrations", priority: "P2" },

  // Security
  { room: "security-patterns", patterns: ["**/auth/**/*", "**/middleware/**/*", "**/security/**/*"], description: "Auth and security patterns", priority: "P1" },

  // Tests
  { room: "testing", patterns: ["**/*.test.ts", "**/*.spec.ts", "**/*.test.tsx", "**/tests/**/*", "vitest.config.*", "playwright.config.*"], description: "Test infrastructure", priority: "P2" },

  // DOS-specific rooms
  { room: "skills", patterns: ["**/skills/*/SKILL.md", "**/skills/**/Workflows/*.md"], description: "DOS skill definitions and workflows", priority: "P0" },
  { room: "hooks", patterns: ["**/hooks/*.hook.ts", "**/hooks/lib/*.ts"], description: "DOS lifecycle hooks", priority: "P0" },
  { room: "agents", patterns: ["**/agents/**/*Context.md", "**/Agents/*/src/**/*.ts"], description: "Agent contexts and autonomous packs", priority: "P0" },
  { room: "packs", patterns: ["**/Packs/*/README.md", "**/Packs/*/INSTALL.md", "**/Packs/*/src/SKILL.md"], description: "Distributable capability packs", priority: "P0" },
  { room: "memory-system", patterns: ["**/MemPalace/**/*.py", "**/MemPalace/**/*.ts", "**/MemPalace/**/SKILL.md"], description: "Memory system internals", priority: "P1" },
  { room: "studio-sync", patterns: ["**/hooks/StudioSync*", "**/Save*ToStudio.ts"], description: "Studio sync tools", priority: "P1" },
];

// ---------------------------------------------------------------------------
// Scanners
// ---------------------------------------------------------------------------

async function scanProjectArtifacts(root: string): Promise<Record<string, string[]>> {
  const artifacts: Record<string, string[]> = {};

  for (const mapping of ROOM_MAPPINGS) {
    const files: string[] = [];
    for (const pattern of mapping.patterns) {
      const matches = await globPaths(pattern, root, 100);
      files.push(...matches);
    }
    if (files.length > 0) {
      artifacts[mapping.room] = [...new Set(files)].sort();
    }
  }

  return artifacts;
}

function scanRegistry(root: string, skillCount: number): { registryPath: string | null; registryPacks: number; gap: number } {
  // Check for dos-registry.json (Studio marketing data source)
  const candidates = [
    join(root, "apps/web/public/data/dos-registry.json"),
    join(root, "public/data/dos-registry.json"),
    join(root, "dos-registry.json"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const data = JSON.parse(readFileSync(candidate, "utf-8"));
        const registryPacks = data.totalPacks || Object.keys(data.packs || {}).length || 0;
        return { registryPath: candidate, registryPacks, gap: skillCount - registryPacks };
      } catch {
        return { registryPath: candidate, registryPacks: 0, gap: skillCount };
      }
    }
  }
  return { registryPath: null, registryPacks: 0, gap: 0 };
}

function scanChangedFiles(root: string, since: string | null): string[] {
  if (!since) return []; // First explore — everything is new
  let raw: string;
  try {
    raw = execFileSync("git", ["log", "--pretty=format:", "--name-only", `--since=${since}`, "HEAD"], {
      cwd: root, timeout: 15_000, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    raw = "";
  }
  return [...new Set(raw.split("\n").filter(Boolean))];
}

function queryKgEntities(entityName: string): { entities: Record<string, string[]>; triples: number } {
  const result = bridge("kg_query", { entity: entityName, direction: "outgoing" });
  if (result.status === "error") return { entities: {}, triples: 0 };

  // Bridge returns "facts" not "triples"
  const facts = (result as any).facts || (result as any).triples || [];
  const count = (result as any).count || facts.length;
  const entityTypes: Record<string, string[]> = {};

  for (const t of facts) {
    const pred = t.predicate || "unknown";
    if (!entityTypes[pred]) entityTypes[pred] = [];
    entityTypes[pred].push(t.object);
  }

  return { entities: entityTypes, triples: count };
}

// ---------------------------------------------------------------------------
// Gap Analysis
// ---------------------------------------------------------------------------

function analyzeGaps(
  palaceRooms: Record<string, number>,
  projectArtifacts: Record<string, string[]>,
  kgData: { entities: Record<string, string[]>; triples: number },
  changedFiles: string[]
): { gaps: GapEntry[]; plan: MiningAction[]; wing: string } {
  const gaps: GapEntry[] = [];
  const plan: MiningAction[] = [];
  const wing = ""; // Will be set by caller

  for (const mapping of ROOM_MAPPINGS) {
    const artifactCount = projectArtifacts[mapping.room]?.length || 0;
    if (artifactCount === 0) continue; // Room not applicable to this project

    const drawerCount = palaceRooms[mapping.room] || 0;

    if (drawerCount === 0) {
      // Missing room — artifacts exist but no drawers
      gaps.push({
        type: "missing_room",
        priority: mapping.priority,
        room: mapping.room,
        detail: `${artifactCount} ${mapping.description} artifacts found, 0 drawers in MemPalace`,
        has: 0,
        expected: artifactCount,
        artifacts: projectArtifacts[mapping.room]?.slice(0, 10),
      });

      // Add mining actions for the top files
      for (const file of (projectArtifacts[mapping.room] || []).slice(0, 20)) {
        plan.push({
          action: "mine_file",
          file,
          wing: "",
          room: mapping.room,
          reason: `Room "${mapping.room}" has 0 drawers — first-time mining`,
        });
      }
    } else if (drawerCount < Math.ceil(artifactCount * 0.3)) {
      // Thin room — drawers exist but coverage is low
      const coveragePct = Math.round((drawerCount / artifactCount) * 100);
      gaps.push({
        type: "thin_room",
        priority: mapping.priority === "P2" ? "P2" : "P1",
        room: mapping.room,
        detail: `${drawerCount} drawers for ${artifactCount} artifacts (${coveragePct}% coverage)`,
        has: drawerCount,
        expected: artifactCount,
        artifacts: projectArtifacts[mapping.room]?.slice(0, 10),
      });

      // Mine the gap — but skip files that might already be covered
      for (const file of (projectArtifacts[mapping.room] || []).slice(drawerCount, drawerCount + 15)) {
        plan.push({
          action: "mine_file",
          file,
          wing: "",
          room: mapping.room,
          reason: `Room "${mapping.room}" is thin (${coveragePct}% coverage)`,
        });
      }
    }
  }

  // Check for stale content — files changed since last explore that have existing drawers
  if (changedFiles.length > 0) {
    const roomsWithChanges = new Set<string>();
    for (const file of changedFiles) {
      for (const mapping of ROOM_MAPPINGS) {
        for (const pattern of mapping.patterns) {
          // MP-041: the old lossy strip (removing '/' and '.' from the needle while
          // leaving them in the haystack) made 'package.json'->'packagejson' and
          // '**/api/**/*.ts'->'apits', which match almost no real path. Compile the
          // glob to a real regex against the UNMANGLED file path instead.
          if (globToRegex(pattern).test(file)) {
            roomsWithChanges.add(mapping.room);
          }
        }
      }
    }

    for (const room of roomsWithChanges) {
      if (palaceRooms[room] && palaceRooms[room] > 0) {
        gaps.push({
          type: "stale_drawer",
          priority: "P2",
          room,
          detail: `Files changed since last explore — existing drawers may be stale`,
          has: palaceRooms[room],
        });
      }
    }
  }

  // Check for missing KG entity types
  const expectedEntityTypes = ["has_skill", "has_hook", "has_pack", "has_agent", "has_feature"];
  for (const predicate of expectedEntityTypes) {
    if (!kgData.entities[predicate] || kgData.entities[predicate].length === 0) {
      // Check if the project has artifacts that would produce these entities
      const relevantRoom =
        predicate === "has_skill" ? "skills" :
        predicate === "has_hook" ? "hooks" :
        predicate === "has_pack" ? "packs" :
        predicate === "has_agent" ? "agents" :
        "routes";

      if (projectArtifacts[relevantRoom] && projectArtifacts[relevantRoom].length > 0) {
        gaps.push({
          type: "missing_entity",
          priority: "P1",
          room: relevantRoom,
          detail: `No "${predicate}" KG triples but ${projectArtifacts[relevantRoom].length} artifacts found`,
          expected: projectArtifacts[relevantRoom].length,
        });

        // Add KG triple creation actions
        plan.push({
          action: "add_kg_triple",
          wing: "",
          room: relevantRoom,
          reason: `Create "${predicate}" triples for ${projectArtifacts[relevantRoom].length} artifacts`,
        });
      }
    }
  }

  // Sort gaps: P0 first, then P1, then P2
  const priorityOrder = { P0: 0, P1: 1, P2: 2 };
  gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  plan.sort((a, b) => {
    const aGap = gaps.find(g => g.room === a.room);
    const bGap = gaps.find(g => g.room === b.room);
    return (priorityOrder[aGap?.priority || "P2"]) - (priorityOrder[bGap?.priority || "P2"]);
  });

  return { gaps, plan, wing };
}

// ---------------------------------------------------------------------------
// Render helpers (RFC-0126 §9 B2 relocation)
//
// These reproduce, byte-for-byte, the markdown skeletons that DeepExplore.md
// Step 2 ("Present Gap Report") and Step 7 ("Verify and Report") previously
// carried inline as prose templates. The skeletons are a deterministic
// transform of the structured ExploreReport JSON the scanner already emits, so
// the agent no longer hand-interpolates them. Golden-tested in
// PalaceExplore.test.ts — the output FAILS if these bytes drift.
// ---------------------------------------------------------------------------

/**
 * The action tallies the agent records while mining (Steps 3-6). These are NOT
 * derivable from either ExploreReport snapshot — they count what the mining run
 * actually did — so the agent supplies them; the render stays deterministic
 * given the inputs.
 */
export interface MiningActionTally {
  drawers_filed: number;
  triples_created: number;
  drawers_updated: number;
  artifacts_skipped: number;
  remaining_gaps: number;
}

/**
 * Render the Step 2 gap report from a PalaceExplore ExploreReport.
 *
 * Behaviour-preserving relocation of DeepExplore.md Step 2. The three priority
 * sections (P0/P1/P2) are always shown; each gap renders as one
 * `    {room}: {detail}` line in the matching bucket. Empty buckets show only
 * the heading, matching the original skeleton which always lists all three.
 */
export function renderGapReport(report: ExploreReport): string {
  const { project, palace_state, coverage, gaps } = report;
  const roomCount = Object.keys(palace_state.rooms).length;
  const p0 = gaps.filter((g) => g.priority === "P0");
  const p1 = gaps.filter((g) => g.priority === "P1");
  const p2 = gaps.filter((g) => g.priority === "P2");

  const lines: string[] = [];
  lines.push(`Palace Explore: ${project.name} (wing: ${project.wing})`);
  lines.push("");
  lines.push(`  Coverage: ${coverage.pct}% (${coverage.rooms_found}/${coverage.rooms_expected} rooms)`);
  lines.push(`  Drawers: ${palace_state.total_drawers} across ${roomCount} rooms`);
  lines.push(`  KG: ${palace_state.kg_triples} triples for this entity`);
  lines.push("");
  lines.push(`  Gaps Found: ${gaps.length} (${p0.length} P0, ${p1.length} P1, ${p2.length} P2)`);
  lines.push("");
  lines.push("  P0 — Critical Gaps:");
  for (const g of p0) lines.push(`    ${g.room}: ${g.detail}`);
  lines.push("");
  lines.push("  P1 — Important Gaps:");
  for (const g of p1) lines.push(`    ${g.room}: ${g.detail}`);
  lines.push("");
  lines.push("  P2 — Nice to Have:");
  for (const g of p2) lines.push(`    ${g.room}: ${g.detail}`);
  lines.push("");
  lines.push(`  Mining Plan: ${report.mining_plan.length} actions`);

  return lines.join("\n");
}

/**
 * Render the Step 7 before/after comparison.
 *
 * Behaviour-preserving relocation of DeepExplore.md Step 7. Deltas are computed
 * from the two ExploreReport snapshots; the "Actions taken" tallies come from
 * the agent's MiningActionTally (the mining run is not visible in either
 * snapshot). Delta formatting matches the prose: `(+N)`.
 */
export function renderExploreComparison(
  before: ExploreReport,
  after: ExploreReport,
  tally: MiningActionTally
): string {
  const deltaDrawers = after.palace_state.total_drawers - before.palace_state.total_drawers;
  const deltaTriples = after.palace_state.kg_triples - before.palace_state.kg_triples;

  const lines: string[] = [];
  lines.push(`Deep Explore Complete: ${after.project.name}`);
  lines.push("");
  lines.push("  Before:");
  lines.push(`    Coverage: ${before.coverage.pct}% (${before.coverage.rooms_found}/${before.coverage.rooms_expected} rooms)`);
  lines.push(`    Drawers: ${before.palace_state.total_drawers}`);
  lines.push(`    KG triples: ${before.palace_state.kg_triples}`);
  lines.push("");
  lines.push("  After:");
  lines.push(`    Coverage: ${after.coverage.pct}% (${after.coverage.rooms_found}/${after.coverage.rooms_expected} rooms)`);
  lines.push(`    Drawers: ${after.palace_state.total_drawers} (+${deltaDrawers})`);
  lines.push(`    KG triples: ${after.palace_state.kg_triples} (+${deltaTriples})`);
  lines.push("");
  lines.push("  Actions taken:");
  lines.push(`    - Filed ${tally.drawers_filed} new drawers`);
  lines.push(`    - Created ${tally.triples_created} KG triples`);
  lines.push(`    - Updated ${tally.drawers_updated} stale drawers`);
  lines.push(`    - Skipped ${tally.artifacts_skipped} already-covered artifacts`);
  lines.push("");
  lines.push(`  Remaining gaps: ${tally.remaining_gaps} (run again to address P2 gaps)`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// writeExploreCheckpoint (RFC-0126 §9 B6 relocation)
//
// Behaviour-preserving relocation of DeepExplore.md Step 6 ("Update Explore
// Timestamp"). The prose previously hand-typed:
//
//   mkdir -p .mempalace
//   echo '{"date": "DATE_ISO", "gaps_found": N, "actions_taken": M,
//          "wing": "WING"}' > .mempalace/last-explore.json
//
// which is a deterministic scaffold (mkdir + a fixed-shape JSON write) that the
// agent should not interpolate per run. The serialized object is the exact
// {date, gaps_found, actions_taken, wing} shape getLastExploreDate() reads back
// (it consumes the `date` field), so the round-trip stays effect-identical.
// Field order is fixed (date, gaps_found, actions_taken, wing) to match the
// prose and keep the golden test stable.
// ---------------------------------------------------------------------------

export interface ExploreCheckpoint {
  date: string;
  gaps_found: number;
  actions_taken: number;
  wing: string;
}

/**
 * Serialize the explore checkpoint to the exact JSON the prose echoed.
 * Single-line (no pretty-print), key order date → gaps_found → actions_taken →
 * wing — byte-identical to the `echo '{...}'` skeleton. Golden-tested.
 */
export function serializeExploreCheckpoint(checkpoint: ExploreCheckpoint): string {
  // Build the object literal explicitly so key order is guaranteed regardless
  // of how the caller constructed `checkpoint`.
  return JSON.stringify({
    date: checkpoint.date,
    gaps_found: checkpoint.gaps_found,
    actions_taken: checkpoint.actions_taken,
    wing: checkpoint.wing,
  });
}

/**
 * Write the explore checkpoint to `<projectPath>/.mempalace/last-explore.json`,
 * creating the `.mempalace` directory if needed. Replaces the Step 6 bash
 * `mkdir -p .mempalace && echo '{...}' > .mempalace/last-explore.json`.
 *
 * @returns the absolute path written, so callers can echo it for confirmation.
 */
export function writeExploreCheckpoint(projectPath: string, checkpoint: ExploreCheckpoint): string {
  const outputDir = join(projectPath, ".mempalace");
  mkdirSync(outputDir, { recursive: true });
  const outPath = join(outputDir, "last-explore.json");
  // writeArtifact:exempt — project-local scan-state checkpoint (read back by
  // getLastExploreDate for delta-only re-explore), not a tracked artifact.
  // writeArtifact:exempt — explore checkpoint — session-internal resume state
  writeFileSync(outPath, serializeExploreCheckpoint(checkpoint));
  return outPath;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`PalaceExplore — Gap-aware project scanner for MemPalace

Usage:
  bun PalaceExplore.ts [project-path]        Full explore with mining plan
  bun PalaceExplore.ts --dry [project-path]   Gap report only, no mining plan
  bun PalaceExplore.ts checkpoint <project-path> <gaps_found> <actions_taken> <wing> [date]
                                              Write .mempalace/last-explore.json (Step 6)

Output:
  JSON to stdout + .mempalace/explore-report.json in project directory`);
    process.exit(0);
  }

  // Step 6 checkpoint subcommand — replaces the hand-typed
  // `mkdir -p .mempalace && echo '{...}' > .mempalace/last-explore.json`.
  if (args[0] === "checkpoint") {
    const [, rawPath, gapsRaw, actionsRaw, wing, dateArg] = args;
    if (!rawPath || gapsRaw === undefined || actionsRaw === undefined || !wing) {
      console.error("usage: checkpoint <project-path> <gaps_found> <actions_taken> <wing> [date]");
      process.exit(2);
    }
    const checkpointPath = writeExploreCheckpoint(resolve(rawPath), {
      date: dateArg || new Date().toISOString(),
      gaps_found: Number(gapsRaw),
      actions_taken: Number(actionsRaw),
      wing,
    });
    console.log(checkpointPath);
    process.exit(0);
  }

  const dryRun = args.includes("--dry");
  const projectPath = resolve(args.find(a => !a.startsWith("--")) || process.cwd());

  if (!existsSync(projectPath)) {
    console.error(JSON.stringify({ status: "error", error: `Path does not exist: ${projectPath}` }));
    process.exit(1);
  }

  // Step 1: Resolve wing
  const projectInfo = resolveWing(projectPath);
  if (!projectInfo) {
    console.error(JSON.stringify({ status: "error", error: "Could not resolve project wing. Add project to ~/.claude/DOS/USER/PROJECTS/PROJECTS.md" }));
    process.exit(1);
  }

  const { wing, name } = projectInfo;

  // Step 2: Snapshot MemPalace state
  const palaceStatus = bridge("status", {}) as any;
  const allWings = palaceStatus.wings || {};
  const wingData = allWings[wing] || {};
  // Bridge returns { rooms: { roomName: count }, total: N } per wing
  const wingRooms: Record<string, number> = wingData.rooms || wingData || {};
  const totalDrawers = wingData.total || Object.values(wingRooms).reduce((sum: number, n) => sum + (n as number), 0);

  // KG state for this project — try multiple entity name patterns
  const kgCandidates = [wing, `project:${wing}`, name.toLowerCase(), name];
  let kgData = { entities: {} as Record<string, string[]>, triples: 0 };
  for (const candidate of kgCandidates) {
    const result = queryKgEntities(candidate);
    if (result.triples > kgData.triples) {
      kgData = result;
    }
  }

  // Step 3: Snapshot project state
  const projectArtifacts = await scanProjectArtifacts(projectPath);
  const totalProjectFiles = Object.values(projectArtifacts).reduce((sum, files) => sum + files.length, 0);

  // Changed files since last explore
  const lastExplore = getLastExploreDate(projectPath);
  const changedFiles = scanChangedFiles(projectPath, lastExplore);

  const lastCommit = sh("git log -1 --format='%H %s' 2>/dev/null", projectPath);

  // Step 4: Gap analysis
  const { gaps, plan } = analyzeGaps(wingRooms, projectArtifacts, kgData, changedFiles);

  // Set wing on all plan actions
  for (const action of plan) {
    action.wing = wing;
  }

  // Step 4b: Registry awareness (Studio marketing data)
  const skillArtifactCount = projectArtifacts["skills"]?.length || 0;
  const registry = scanRegistry(projectPath, skillArtifactCount);
  if (registry.registryPath && registry.gap > 0) {
    gaps.push({
      type: "missing_room" as const,
      priority: "P1" as const,
      room: "registry",
      detail: `dos-registry.json has ${registry.registryPacks} packs but ${skillArtifactCount} skills exist (${registry.gap} missing from registry)`,
      has: registry.registryPacks,
      expected: skillArtifactCount,
    });
    plan.push({
      action: "add_drawer" as const,
      wing: "",
      room: "registry",
      reason: `Registry out of sync — ${registry.gap} packs missing from marketing pages`,
    });
  }

  // Step 5: Compute coverage
  const roomsWithArtifacts = Object.keys(projectArtifacts).length;
  const roomsInPalace = Object.keys(wingRooms).filter(r => projectArtifacts[r]).length;
  const coveragePct = roomsWithArtifacts > 0 ? Math.round((roomsInPalace / roomsWithArtifacts) * 100) : 0;

  // Entity type distribution from KG
  const entityTypes: Record<string, number> = {};
  for (const [pred, objs] of Object.entries(kgData.entities)) {
    entityTypes[pred] = objs.length;
  }

  // Step 6: Build report
  const p0Count = gaps.filter(g => g.priority === "P0").length;
  const p1Count = gaps.filter(g => g.priority === "P1").length;
  const p2Count = gaps.filter(g => g.priority === "P2").length;

  const report: ExploreReport = {
    generated: new Date().toISOString(),
    project: { name, path: projectPath, wing },
    palace_state: {
      total_drawers: totalDrawers,
      rooms: wingRooms,
      // MP-083/MP-085: kg_entities was a verbatim copy of the triple count.
      // Derive a real entity measure: distinct objects across all predicate
      // buckets (kgData.entities is a predicate -> objects map).
      kg_entities: new Set(Object.values(kgData.entities).flat()).size,
      kg_triples: kgData.triples,
      entity_types: entityTypes,
    },
    project_state: {
      total_files: totalProjectFiles,
      key_artifacts: projectArtifacts,
      last_commit: lastCommit,
      changed_since_last_explore: changedFiles.slice(0, 50),
    },
    coverage: {
      rooms_found: roomsInPalace,
      rooms_expected: roomsWithArtifacts,
      pct: coveragePct,
      drawer_density: `${totalDrawers} drawers across ${Object.keys(wingRooms).length} rooms`,
    },
    gaps,
    mining_plan: dryRun ? [] : plan,
    summary: `${name} (wing: ${wing}) — ${coveragePct}% room coverage (${roomsInPalace}/${roomsWithArtifacts}). ${gaps.length} gaps found: ${p0Count} P0, ${p1Count} P1, ${p2Count} P2. Mining plan: ${plan.length} actions.`,
  };

  // Write report to project
  const outputDir = join(projectPath, ".mempalace");
  mkdirSync(outputDir, { recursive: true });
  // writeArtifact:exempt — coverage report into the project .mempalace/ state dir
  writeFileSync(
    join(outputDir, "explore-report.json"),
    JSON.stringify(report, null, 2)
  );

  // Output to stdout
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(JSON.stringify({ status: "error", error: String(err) }));
    process.exit(1);
  });
}
