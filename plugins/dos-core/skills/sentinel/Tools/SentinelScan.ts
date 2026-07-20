#!/usr/bin/env bun
/**
 * SentinelScan — Static analysis engine for codebase discovery
 *
 * Reads filesystem + git metadata to produce a ScanReport JSON.
 * No inference, no external dependencies. Pure static analysis.
 *
 * Usage: bun SentinelScan.ts /path/to/repo
 * Output: JSON to stdout + .sentinel/scan-report.json in repo
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync, statSync } from "fs";
import { basename, join, resolve } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import { Glob } from "bun";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmoduleStack {
  language: string;
  framework: string | null;
  runtime: string;
  packageManager: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface SubmoduleEntry {
  path: string;
  url: string;
  stack?: SubmoduleStack;
}

// Durante-native primitive inventories (Track 1 — PRD 20260530-214700).
// Deterministic file reads only — no inference, no network, fail-open.
interface DuranteWorkflow {
  name: string;
  description: string;
  phases: string[];
  file: string;
  origin: "project" | "global";
}

interface DurantePRD {
  slug: string;
  task: string;
  effort: string;
  phase: string;
  progress: string;
  bucket: "active" | "archived" | "flat";
  file: string;
}

interface DuranteRFC {
  id: string;
  title: string;
  status: string;
  file: string;
}

interface DuranteNative {
  isDuranteProject: boolean;
  signals: string[];
  workflows: DuranteWorkflow[];
  prds: DurantePRD[];
  rfcs: DuranteRFC[];
  roadmaps: string[];
  agentPacks: string[];
  skills: string[];
}

interface ScanReport {
  project: {
    name: string;
    path: string;
    description: string;
    wing: string | null;
    canonical_id: string | null;
  };
  structure: {
    topLevelDirs: string[];
    entryPoints: string[];
    configFiles: string[];
    hasMonorepo: boolean;
    packages: string[];
  };
  stack: {
    language: string;
    framework: string | null;
    runtime: string;
    packageManager: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  git: {
    defaultBranch: string;
    totalCommits: number;
    topContributors: { name: string; commits: number }[];
    recentActivity: string;
    branchCount: number;
  };
  files: {
    totalFiles: number;
    byExtension: Record<string, number>;
    largestFiles: { path: string; lines: number }[];
    testFiles: string[];
  };
  scripts: Record<string, string>;
  existing: {
    hasClaudeMd: boolean;
    hasCursorRules: boolean;
    hasEslint: boolean;
    hasPrettier: boolean;
    hasDocker: boolean;
    hasCi: boolean;
    existingDocs: string[];
  };
  submodules: SubmoduleEntry[];
  durante: DuranteNative;
  isEmptyProject: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sh(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, timeout: 10_000, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

function tryReadJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

async function globPaths(pattern: string, cwd: string, limit = 500): Promise<string[]> {
  const g = new Glob(pattern);
  const results: string[] = [];
  for await (const entry of g.scan({ cwd, absolute: false })) {
    // Skip node_modules, .git, dist, build, .next, .sentinel
    if (
      entry.includes("node_modules/") ||
      entry.includes(".git/") ||
      entry.includes("dist/") ||
      entry.includes("build/") ||
      entry.includes(".next/") ||
      entry.includes(".sentinel/")
    ) continue;
    results.push(entry);
    if (results.length >= limit) break;
  }
  return results;
}

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

// Minimal YAML frontmatter reader (key: value pairs only — no nesting).
// Used for PRD frontmatter; fail-open returns {} on any malformed input.
export function parseFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end === -1) return {};
  const out: Record<string, string> = {};
  for (const line of content.slice(3, end).split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

// Parse a native-workflow `export const meta = {...}` block by string inspection.
// NEVER imports the module (top-level body references workflow globals and would throw).
export function parseWorkflowMeta(content: string): { name: string; description: string; phases: string[] } | null {
  const metaIdx = content.indexOf("export const meta");
  if (metaIdx === -1) return null;
  const region = content.slice(metaIdx, metaIdx + 6000);
  const name = region.match(/name:\s*['"]([^'"]+)['"]/)?.[1] ?? "";
  const description = region.match(/description:\s*['"]([^'"]+)['"]/)?.[1] ?? "";
  const phases: string[] = [];
  const phasesBlock = region.match(/phases:\s*\[([\s\S]*?)\]/)?.[1];
  if (phasesBlock) {
    const re = /title:\s*['"]([^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(phasesBlock)) !== null) phases.push(m[1]);
  }
  return name ? { name, description, phases } : null;
}

// ---------------------------------------------------------------------------
// Scanners
// ---------------------------------------------------------------------------

function expandHome(p: string): string {
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  if (p === "~") return homedir();
  return p;
}

function readDosProjects(root: string): { wing: string | null; id: string | null } {
  const candidates = [
    join(root, "Tools", ".dos-projects.json"),
    join(root, ".dos-projects.json"),
  ];
  type DosProjectsFile = { projects?: Array<{ id?: string; wing?: string | null; root_path?: string | null }> };
  let parsed: DosProjectsFile | null = null;
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      parsed = tryReadJson(candidate) as DosProjectsFile | null;
      if (parsed) break;
    }
  }
  // Fallback: walk up to find a Tools/.dos-projects.json (handles scanning sub-paths like Platform/studio)
  if (!parsed) {
    let dir = resolve(root);
    while (dir !== "/" && dir.length > 1) {
      const upCandidate = join(dir, "Tools", ".dos-projects.json");
      if (existsSync(upCandidate)) {
        parsed = tryReadJson(upCandidate) as DosProjectsFile | null;
        if (parsed) break;
      }
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
  }
  if (!parsed?.projects) return { wing: null, id: null };

  const target = resolve(root);
  let best: { wing: string | null; id: string | null; len: number } | null = null;
  for (const entry of parsed.projects) {
    if (!entry.root_path) continue;
    const resolved = resolve(expandHome(entry.root_path));
    const matches = target === resolved || target.startsWith(resolved + "/");
    if (matches && (!best || resolved.length > best.len)) {
      best = { wing: entry.wing ?? null, id: entry.id ?? null, len: resolved.length };
    }
  }
  return best ? { wing: best.wing, id: best.id } : { wing: null, id: null };
}

async function scanProject(root: string): Promise<ScanReport["project"]> {
  const pkg = tryReadJson(join(root, "package.json")) as Record<string, string> | null;
  let description = "";

  // Try README first line for description
  const readmePath = join(root, "README.md");
  if (existsSync(readmePath)) {
    const lines = readFileSync(readmePath, "utf-8").split("\n");
    const firstContentLine = lines.find(
      (l) => l.trim() && !l.startsWith("#") && !l.startsWith("!")
    );
    if (firstContentLine) description = firstContentLine.trim().slice(0, 200);
  }

  const { wing, id: canonical_id } = readDosProjects(root);

  return {
    name: (pkg?.name as string) || basename(root),
    path: resolve(root),
    description: (pkg?.description as string) || description || "",
    wing,
    canonical_id,
  };
}

async function scanSubmodules(root: string): Promise<SubmoduleEntry[]> {
  const gitmodulesPath = join(root, ".gitmodules");
  if (!existsSync(gitmodulesPath)) return [];
  const text = readFileSync(gitmodulesPath, "utf-8");

  const blocks = text.split(/^\s*\[submodule\s+"[^"]*"\]\s*$/m).slice(1);
  const entries: SubmoduleEntry[] = [];
  for (const block of blocks) {
    const pathMatch = block.match(/^\s*path\s*=\s*(.+)$/m);
    const urlMatch = block.match(/^\s*url\s*=\s*(.+)$/m);
    if (!pathMatch) continue;
    const subPath = pathMatch[1].trim();
    const url = urlMatch ? urlMatch[1].trim() : "";
    const absSub = join(root, subPath);
    const entry: SubmoduleEntry = { path: subPath, url };
    if (existsSync(absSub)) {
      entry.stack = await scanStack(absSub);
    }
    entries.push(entry);
  }
  return entries;
}

async function scanStructure(root: string): Promise<ScanReport["structure"]> {
  // Top-level directories
  const topLevelEntries = sh("ls -d */ 2>/dev/null", root).split("\n").filter(Boolean);
  const topLevelDirs = topLevelEntries.map((d) => d.replace(/\/$/, ""));

  // Entry points
  const entryPatterns = [
    "index.ts", "index.js", "main.ts", "main.js",
    "app.ts", "app.js", "server.ts", "server.js",
    "src/index.ts", "src/main.ts", "src/app.ts",
  ];
  const entryPoints = entryPatterns.filter((p) => existsSync(join(root, p)));

  // Config files
  const configPatterns = [
    "tsconfig.json", "tsconfig*.json", ".eslintrc*", "eslint.config.*",
    ".prettierrc*", "prettier.config.*", "tailwind.config.*",
    "vite.config.*", "next.config.*", "webpack.config.*",
    "jest.config.*", "vitest.config.*", "playwright.config.*",
    "docker-compose.*", "Dockerfile", ".env.example",
    "turbo.json", "lerna.json", "pnpm-workspace.yaml",
    "biome.json", "deno.json",
  ];
  const configFiles: string[] = [];
  for (const pattern of configPatterns) {
    const matches = await globPaths(pattern, root, 5);
    configFiles.push(...matches);
  }

  // Monorepo detection
  const hasMonorepo =
    existsSync(join(root, "turbo.json")) ||
    existsSync(join(root, "lerna.json")) ||
    existsSync(join(root, "pnpm-workspace.yaml")) ||
    existsSync(join(root, "nx.json"));

  // Monorepo packages
  let packages: string[] = [];
  if (hasMonorepo) {
    const pkgJsons = await globPaths("packages/*/package.json", root, 50);
    const appJsons = await globPaths("apps/*/package.json", root, 50);
    packages = [...pkgJsons, ...appJsons].map((p) => {
      const pkg = tryReadJson(join(root, p));
      return (pkg?.name as string) || p.split("/")[1];
    });
  }

  return { topLevelDirs, entryPoints, configFiles: [...new Set(configFiles)], hasMonorepo, packages };
}

async function scanStack(root: string): Promise<ScanReport["stack"]> {
  const pkg = tryReadJson(join(root, "package.json")) as Record<string, unknown> | null;
  const deps = (pkg?.dependencies || {}) as Record<string, string>;
  const devDeps = (pkg?.devDependencies || {}) as Record<string, string>;
  const allDeps = { ...deps, ...devDeps };

  // Language detection
  const tsFiles = await globPaths("**/*.ts", root, 5);
  const pyFiles = await globPaths("**/*.py", root, 5);
  const goFiles = await globPaths("**/*.go", root, 5);
  const rsFiles = await globPaths("**/*.rs", root, 5);

  let language = "JavaScript";
  if (tsFiles.length > 0 || existsSync(join(root, "tsconfig.json"))) language = "TypeScript";
  else if (pyFiles.length > 0) language = "Python";
  else if (goFiles.length > 0) language = "Go";
  else if (rsFiles.length > 0) language = "Rust";

  // Framework detection — check root deps first, then sub-packages for monorepos
  let framework: string | null = null;
  const detectFramework = (d: Record<string, string>): string | null => {
    const ver = (v: string) => v.replace(/[\^~]/g, "").replace("catalog:", "latest");
    if (d["next"]) return `Next.js ${ver(d["next"])}`;
    if (d["nuxt"]) return `Nuxt ${ver(d["nuxt"])}`;
    if (d["@angular/core"]) return "Angular";
    if (d["svelte"] || d["@sveltejs/kit"]) return "SvelteKit";
    if (d["express"]) return "Express";
    if (d["fastify"]) return "Fastify";
    if (d["hono"]) return "Hono";
    if (d["react"] && !d["next"]) return "React (Vite)";
    return null;
  };

  framework = detectFramework(allDeps);

  // For monorepos, check sub-package deps if root didn't match
  if (!framework) {
    const subPkgs = await globPaths("{apps,packages}/*/package.json", root, 20);
    for (const subPkgPath of subPkgs) {
      const subPkg = tryReadJson(join(root, subPkgPath)) as Record<string, unknown> | null;
      if (subPkg) {
        const subDeps = { ...(subPkg.dependencies || {}), ...(subPkg.devDependencies || {}) } as Record<string, string>;
        framework = detectFramework(subDeps);
        if (framework) break;
      }
    }
  }

  // Runtime detection
  let runtime = "Node";
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bunfig.toml"))) runtime = "Bun";
  else if (existsSync(join(root, "deno.json")) || existsSync(join(root, "deno.lock"))) runtime = "Deno";

  // Package manager detection
  let packageManager = "npm";
  if (existsSync(join(root, "pnpm-lock.yaml"))) packageManager = "pnpm";
  else if (existsSync(join(root, "yarn.lock"))) packageManager = "yarn";
  else if (existsSync(join(root, "bun.lockb"))) packageManager = "bun";

  // Top 30 deps
  const topDeps: Record<string, string> = {};
  const depEntries = Object.entries(deps).slice(0, 30);
  for (const [k, v] of depEntries) topDeps[k] = v;

  const topDevDeps: Record<string, string> = {};
  const devDepEntries = Object.entries(devDeps).slice(0, 30);
  for (const [k, v] of devDepEntries) topDevDeps[k] = v;

  return { language, framework, runtime, packageManager, dependencies: topDeps, devDependencies: topDevDeps };
}

function scanGit(root: string): ScanReport["git"] {
  const defaultBranch = sh("git rev-parse --abbrev-ref HEAD", root) || "main";
  const totalCommitsStr = sh("git rev-list --count HEAD 2>/dev/null", root);
  const totalCommits = parseInt(totalCommitsStr) || 0;

  // Top contributors
  const contributorRaw = sh(
    "git shortlog -sn --no-merges HEAD 2>/dev/null | head -10",
    root
  );
  const topContributors = contributorRaw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      return match ? { name: match[2], commits: parseInt(match[1]) } : null;
    })
    .filter(Boolean) as { name: string; commits: number }[];

  // Recent activity
  const recentCount = sh(
    'git rev-list --count --since="30 days ago" HEAD 2>/dev/null',
    root
  );
  const recentActivity = `${recentCount || "0"} commits in last 30 days`;

  // Branch count — exclude symref lines (`origin/HEAD -> origin/main`), which
  // are not branches. `grep -vc ' -> '` counts non-symref lines directly.
  const branchRaw = sh("git branch -r 2>/dev/null | grep -vc ' -> '", root);
  const branchCount = parseInt(branchRaw.trim()) || 0;

  return { defaultBranch, totalCommits, topContributors, recentActivity, branchCount };
}

async function scanFiles(root: string): Promise<ScanReport["files"]> {
  const codeExts = ["ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "rb", "vue", "svelte", "css", "scss", "html", "md", "json", "yaml", "yml"];
  const byExtension: Record<string, number> = {};
  let totalFiles = 0;

  for (const ext of codeExts) {
    const files = await globPaths(`**/*.${ext}`, root, 5000);
    if (files.length > 0) {
      byExtension[`.${ext}`] = files.length;
      totalFiles += files.length;
    }
  }

  // Largest files (by line count, sample first 20 .ts/.tsx)
  const sampleFiles = await globPaths("**/*.{ts,tsx,js,jsx,py}", root, 100);
  const withLines = sampleFiles
    .map((f) => ({ path: f, lines: countLines(join(root, f)) }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, 10);

  // Test files
  const testPatterns = [
    "**/*.test.ts", "**/*.test.tsx", "**/*.test.js",
    "**/*.spec.ts", "**/*.spec.tsx", "**/*.spec.js",
    "**/__tests__/**/*.ts", "**/__tests__/**/*.tsx",
  ];
  const testFiles: string[] = [];
  for (const pattern of testPatterns) {
    const matches = await globPaths(pattern, root, 50);
    testFiles.push(...matches);
  }

  return { totalFiles, byExtension, largestFiles: withLines, testFiles: [...new Set(testFiles)] };
}

function scanScripts(root: string): Record<string, string> {
  const pkg = tryReadJson(join(root, "package.json")) as Record<string, unknown> | null;
  return (pkg?.scripts || {}) as Record<string, string>;
}

async function scanExisting(root: string): Promise<ScanReport["existing"]> {
  const docPatterns = ["README.md", "CONTRIBUTING.md", "CHANGELOG.md", "ARCHITECTURE.md", "AGENTS.md", "CLAUDE.md"];
  const existingDocs = docPatterns.filter((d) => existsSync(join(root, d)));

  const eslintFiles = await globPaths(".eslintrc*", root, 3);
  const eslintConfig = await globPaths("eslint.config.*", root, 3);

  return {
    hasClaudeMd: existsSync(join(root, "CLAUDE.md")),
    hasCursorRules: existsSync(join(root, ".cursorrules")),
    hasEslint: eslintFiles.length > 0 || eslintConfig.length > 0,
    hasPrettier:
      existsSync(join(root, ".prettierrc")) ||
      existsSync(join(root, ".prettierrc.json")) ||
      existsSync(join(root, "prettier.config.js")) ||
      existsSync(join(root, "prettier.config.mjs")),
    hasDocker:
      existsSync(join(root, "Dockerfile")) ||
      existsSync(join(root, "docker-compose.yml")) ||
      existsSync(join(root, "docker-compose.yaml")),
    hasCi:
      existsSync(join(root, ".github/workflows")) ||
      existsSync(join(root, ".gitlab-ci.yml")) ||
      existsSync(join(root, ".circleci")),
    existingDocs,
  };
}

// ---------------------------------------------------------------------------
// Durante-native inventory (Track 1) — deterministic, fail-open, no inference
// ---------------------------------------------------------------------------

export function detectDurante(root: string, canonicalId: string | null): { isDuranteProject: boolean; signals: string[] } {
  const signals: string[] = [];
  if (existsSync(join(root, "MEMORY", "WORK"))) signals.push("MEMORY/WORK");
  if (existsSync(join(root, "Plans", "Specs"))) signals.push("Plans/Specs");
  if (existsSync(join(root, ".claude", "workflows"))) signals.push(".claude/workflows");
  if (canonicalId) signals.push(`.dos-projects.json:${canonicalId}`);
  if (existsSync(join(root, "Releases"))) {
    const hasReleaseClaude = sh("ls -d Releases/v*/.claude 2>/dev/null | head -1", root);
    if (hasReleaseClaude) signals.push("Releases/v*/.claude");
  }
  return { isDuranteProject: signals.length > 0, signals };
}

export async function inventoryWorkflows(root: string): Promise<DuranteWorkflow[]> {
  // Native workflows install IMMUTABLY to ~/.claude/workflows/ (global); a repo may
  // shadow with project-local .claude/workflows/ (DOS §2.7). Project shadows global
  // by name. Both are "what this project can invoke", so inventory both with origin.
  // readdirSync on the explicit dir — Bun's Glob does NOT descend the .claude
  // dot-directory, so a `.claude/workflows/*.js` glob silently misses project-local
  // workflows. Read the known dir directly instead.
  const out: DuranteWorkflow[] = [];
  const seen = new Set<string>();
  const sources: Array<{ dir: string; origin: "project" | "global" }> = [
    { dir: join(root, ".claude", "workflows"), origin: "project" },
    { dir: join(homedir(), ".claude", "workflows"), origin: "global" },
  ];
  for (const { dir, origin } of sources) {
    if (!existsSync(dir)) continue;
    let names: string[] = [];
    try { names = readdirSync(dir).filter((n) => n.endsWith(".js")); } catch { /* fail-open */ }
    for (const name of names) {
      try {
        const meta = parseWorkflowMeta(readFileSync(join(dir, name), "utf-8"));
        if (meta && !seen.has(meta.name)) {
          seen.add(meta.name);
          out.push({ ...meta, file: join(origin === "global" ? "~/.claude/workflows" : ".claude/workflows", name), origin });
        }
      } catch { /* fail-open */ }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function inventoryPRDs(root: string): Promise<DurantePRD[]> {
  const out: DurantePRD[] = [];
  const files = await globPaths("MEMORY/WORK/**/PRD.md", root, 400);
  for (const rel of files) {
    try {
      const fm = parseFrontmatter(readFileSync(join(root, rel), "utf-8"));
      const bucket = rel.includes("/active/") ? "active" : rel.includes("/archived/") ? "archived" : "flat";
      out.push({
        slug: fm.slug || rel.split("/").slice(-2)[0] || "",
        task: fm.task || "",
        effort: fm.effort || "",
        phase: fm.phase || "",
        progress: fm.progress || "",
        bucket,
        file: rel,
      });
    } catch { /* fail-open */ }
  }
  return out;
}

export async function inventoryRFCs(root: string): Promise<DuranteRFC[]> {
  const out: DuranteRFC[] = [];
  const files = await globPaths("Plans/Specs/**/RFC-*.md", root, 400);
  for (const rel of files) {
    try {
      const content = readFileSync(join(root, rel), "utf-8").slice(0, 3000);
      const fm = parseFrontmatter(content);
      const id = basename(rel).match(/^(RFC-\d+)/)?.[1] ?? basename(rel).replace(/\.md$/, "");
      const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
      const status =
        fm.status ||
        content.match(/\*\*Status:\*\*\s*([A-Za-z-]+)/)?.[1] ||
        title.match(/\((DRAFT|ACCEPTED|PROPOSED|SUPERSEDED|REJECTED|WITHDRAWN)\)/i)?.[1]?.toUpperCase() ||
        "unknown";
      out.push({ id, title, status, file: rel });
    } catch { /* fail-open */ }
  }
  // Dedup by id — the live top-level Plans/Specs/RFC-N.md wins over Archive/ copies
  // (fewest path segments = canonical). Keeps one row per RFC number.
  const byId = new Map<string, DuranteRFC>();
  for (const rfc of out) {
    const prev = byId.get(rfc.id);
    if (!prev || rfc.file.split("/").length < prev.file.split("/").length) byId.set(rfc.id, rfc);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function inventoryRoadmaps(root: string): Promise<string[]> {
  const md = await globPaths("Plans/Roadmaps/*.md", root, 100);
  const dag = await globPaths("Plans/Roadmaps/*.json", root, 100);
  return [...md, ...dag].sort();
}

async function inventoryAgentPacks(root: string): Promise<string[]> {
  const entries = sh("ls -d Packs/agents/*/ 2>/dev/null", root).split("\n").filter(Boolean);
  // _runtime = shared runtime; src = shared agent source — neither is a pack.
  const INFRA = new Set(["_runtime", "src"]);
  return entries
    .map((d) => d.replace(/\/$/, "").split("/").pop() || "")
    .filter((n) => n && !INFRA.has(n))
    .sort();
}

async function inventorySkills(root: string): Promise<string[]> {
  // Prefer the live skill dir (customer install shape); fall back to pack sources.
  let names = sh("ls -d .claude/skills/*/ 2>/dev/null", root).split("\n").filter(Boolean)
    .map((d) => d.replace(/\/$/, "").split("/").pop() || "");
  if (names.length === 0) {
    const skillMds = await globPaths("Packs/*/src/SKILL.md", root, 200);
    names = skillMds.map((p) => p.split("/")[1]).filter(Boolean);
  }
  return [...new Set(names)].filter(Boolean).sort();
}

export async function scanDuranteNative(root: string): Promise<DuranteNative> {
  const { id: canonicalId } = readDosProjects(root);
  const { isDuranteProject, signals } = detectDurante(root, canonicalId);
  if (!isDuranteProject) {
    return { isDuranteProject: false, signals: [], workflows: [], prds: [], rfcs: [], roadmaps: [], agentPacks: [], skills: [] };
  }
  const [workflows, prds, rfcs, roadmaps, agentPacks, skills] = await Promise.all([
    inventoryWorkflows(root),
    inventoryPRDs(root),
    inventoryRFCs(root),
    inventoryRoadmaps(root),
    inventoryAgentPacks(root),
    inventorySkills(root),
  ]);
  return { isDuranteProject, signals, workflows, prds, rfcs, roadmaps, agentPacks, skills };
}

// ---------------------------------------------------------------------------
// Durante-native DETERMINISTIC TRANSFORMS (pure — moved out of Scan.md prose so
// they are unit-testable: render the artifact + build the KG ops. The IO shell
// lives in sentinel-durante-artifact.ts; these stay pure and take `date` as an arg.)
// ---------------------------------------------------------------------------

// Wing + DOCS_DIR derivation were ALSO deterministic logic living in Scan.md prose
// (Step 3a "lowercase, kebab-case"; Phase 2b-iii DOCS_DIR resolution) — drifting from the
// tool's implementation. Extracted here so both halves share ONE tested source of truth
// (pre-VERIFY review majors, PRD 20260530-234500).
export function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function deriveWing(registryWing: string | null | undefined, root: string): string {
  return registryWing || kebab(basename(root));
}

export function resolveDocsDir(root: string): string {
  return existsSync(join(root, "Docs")) ? join(root, "Docs", "Sentinel") : join(root, ".sentinel", "docs");
}

// Tech Debt / Health Score (Phase 2b-iv) — extracted from Scan.md prose so the
// ratio is computed once, deterministically, and unit-tested. Returns the HEALTHY
// percentage (the score persisted to .sentinel/health.json), i.e. the share of
// conventions NOT showing drift. `violations` = drifting count, `total` = tracked
// conventions. Guards total<=0 (empty-corpus → 100% vacuously healthy) and clamps
// violations to [0,total] so the score never escapes [0,100]. Rounded to integer
// to match the historical health.json `score` field (e.g. 13 healthy / 15 → 87).
export function calculateHealthScore(violations: number, total: number): number {
  if (!Number.isFinite(violations) || !Number.isFinite(total) || total <= 0) return 100;
  const drift = Math.min(Math.max(violations, 0), total);
  return Math.round(((total - drift) / total) * 100);
}

// ---------------------------------------------------------------------------
// Live conformance sweep (Phase 2b-iv) — the health score's `violations` input.
//
// The pre-2026-07-07 pipeline counted git-mined tech_debt_indicators as
// violations, so every debt-PAYING commit read as debt OWED (studio scored 65%
// while live drift was 87%). The measured derivation: violations = count of
// tracked conventions with ≥1 CURRENT hit in the live tree (per-convention
// binary — one broken rule is one broken rule; hit volume belongs in
// TECH-DEBT.md, not the ratio).
//
// Semantics mirror the Guard hook (SentinelGuard.hook.ts): only negative_regex
// is violation-detecting. A positive `regex` describes what conformity looks
// like — its absence in one file is NOT a violation — so positive-only and
// regex-less rules are reported `unsweepable` and MUST be checked by the
// agent's judgment sweep (rg/fd per convention, Scan.md Step 2b-iv). The
// coverage line exists so a low-coverage mechanical sweep is never mistaken
// for a full measurement (green-while-blind guard).
// ---------------------------------------------------------------------------

export interface SweepRule {
  id: string;
  category: string;
  pattern: string;
  regex?: string;
  negative_regex?: string;
  applies_to?: string[];
}

export interface SweepRuleResult {
  id: string;
  category: string;
  pattern: string;
  violated: boolean;
  /** Full match count (§N.5 — never truncated). */
  hit_count: number;
  /** Sample of hit paths, capped at 20 for report size; hit_count is authoritative. */
  hits: string[];
  files_checked: number;
}

export interface SweepResult {
  /** Conventions with ≥1 live hit — the calculateHealthScore `violations` input. */
  violations: number;
  mechanical: number;
  total_rules: number;
  /** e.g. "3/17 rules mechanically sweepable — agent-sweep the rest" */
  coverage: string;
  results: SweepRuleResult[];
  /** `reason` differentiates the agent's judgment-half work: a positive-only rule
   *  ships its regex as a ready-made probe (`rg --files-without-match <regex>`);
   *  a prose-only rule needs the agent to derive a probe from the pattern text. */
  unsweepable: Array<{ id: string; category: string; pattern: string; reason: "positive-only" | "prose-only" | "invalid-regex"; regex?: string }>;
}

const SWEEP_HITS_SAMPLE_CAP = 20;

function sweepApplies(patterns: string[] | undefined, path: string): boolean {
  const pats = patterns && patterns.length ? patterns : ["*.ts", "*.tsx"];
  const name = basename(path);
  return pats.some((p) => (p.startsWith("*") ? name.endsWith(p.slice(1)) : name === p));
}

export function sweepConventions(
  rules: SweepRule[],
  files: Array<{ path: string; content: string }>,
): SweepResult {
  const results: SweepRuleResult[] = [];
  const unsweepable: SweepResult["unsweepable"] = [];
  for (const r of rules) {
    let rx: RegExp | null = null;
    let invalidRx = false;
    if (r.negative_regex) {
      try { rx = new RegExp(r.negative_regex, "m"); } catch { invalidRx = true; }
    }
    if (!rx) {
      const reason = invalidRx ? "invalid-regex" as const : r.regex ? "positive-only" as const : "prose-only" as const;
      unsweepable.push({ id: r.id, category: r.category, pattern: r.pattern, reason, ...(r.regex ? { regex: r.regex } : {}) });
      continue;
    }
    const hits: string[] = [];
    let hitCount = 0;
    let checked = 0;
    for (const f of files) {
      if (!sweepApplies(r.applies_to, f.path)) continue;
      checked++;
      if (rx.test(f.content)) {
        hitCount++;
        if (hits.length < SWEEP_HITS_SAMPLE_CAP) hits.push(f.path);
      }
    }
    results.push({
      id: r.id, category: r.category, pattern: r.pattern,
      violated: hitCount > 0, hit_count: hitCount, hits, files_checked: checked,
    });
  }
  const violations = results.filter((x) => x.violated).length;
  return {
    violations,
    mechanical: results.length,
    total_rules: rules.length,
    coverage: `${results.length}/${rules.length} rules mechanically sweepable — agent-sweep the rest`,
    results,
    unsweepable,
  };
}

// Walker for the sweep CLI. Skips dependency/build output, dot-directories
// (.git/.next/.turbo/.claude/.sentinel/…), memory corpora + frozen release
// snapshots (immutable trees would become permanent "violations"), and any
// nested git root (submodules / vendored repos are their own scan targets).
// NOTE: this is a SECOND ignore vocabulary beside globPaths() (Phase-1 static
// enumeration) — the nested-git pruning cannot be expressed as a glob
// post-filter, so the sets are separate by necessity. When extending either
// ignore list, check whether the other needs the same entry, or Phase-1
// discovery and the 2b-iv sweep will disagree on what the repo is.
// Follow-up (named, not shipped): a config-driven ignore (.sentinel key or
// `git ls-files`) would also remove the DOS-specific names below on customer repos.
const SWEEP_IGNORE_DIRS = new Set([
  "node_modules", "dist", "build", "out", "coverage", "vendor", "tmp",
  "MEMORY", "Releases",
]);
// Dot-dirs are skipped wholesale EXCEPT these: rules legitimately target their
// contents (e.g. "railway not vercel" applies to *.yml — CI workflows live in
// .github/), and the Guard hook has no dot-dir exclusion, so the sweep's visible
// universe must not silently disagree with edit-time enforcement there.
const SWEEP_DOTDIR_ALLOW = new Set([".github"]);
const SWEEP_MAX_FILES = 20000;
const SWEEP_MAX_FILE_BYTES = 1_000_000;
const SWEEP_MAX_TOTAL_BYTES = 256_000_000; // corpus cap — the sweep must never OOM the scan
const SWEEP_TEXT_EXTS = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|yml|yaml|css|scss|html|sh|py|sql|prisma|toml|env|txt)$/;

// Per-repo ignore extension: `.sentinel/sweep-ignore.json` = JSON array of extra
// directory names (e.g. ["Overlays", "generated"]). Merged with the defaults —
// repos whose legitimate source collides with a default name (a real Releases/
// source dir) currently cannot un-ignore; that inversion stays a named follow-up.
export function readSweepIgnoreConfig(root: string): string[] {
  const p = join(root, ".sentinel", "sweep-ignore.json");
  if (!existsSync(p)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(p, "utf-8"));
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

export function collectSweepFiles(root: string, extraIgnore: string[] = []): { files: Array<{ path: string; content: string }>; truncated: boolean } {
  const ignore = extraIgnore.length ? new Set([...SWEEP_IGNORE_DIRS, ...extraIgnore]) : SWEEP_IGNORE_DIRS;
  const files: Array<{ path: string; content: string }> = [];
  let totalBytes = 0;
  // Truncation is NEVER silent: a capped walk sets `truncated` so the CLI can
  // refuse to let a partial corpus masquerade as a full measurement (the same
  // green-while-blind guard the rule-coverage line provides).
  let truncated = false;
  const capped = () => {
    if (files.length >= SWEEP_MAX_FILES || totalBytes >= SWEEP_MAX_TOTAL_BYTES) {
      truncated = true;
      return true;
    }
    return false;
  };
  const walk = (dir: string, isRoot: boolean): void => {
    if (capped()) return;
    let entries: import("fs").Dirent[];
    try { entries = readdirSync(dir, { withFileTypes: true }) as unknown as import("fs").Dirent[]; } catch { return; }
    // Nested git root = a different project (submodule / vendored checkout) — skip.
    if (!isRoot && entries.some((e) => e.name === ".git")) return;
    for (const e of entries) {
      if (capped()) return;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if ((e.name.startsWith(".") && !SWEEP_DOTDIR_ALLOW.has(e.name)) || ignore.has(e.name)) continue;
        walk(full, false);
      } else if (e.isFile() && SWEEP_TEXT_EXTS.test(e.name)) {
        try {
          // statSync, not Bun.file — the pack's contract is "Bun (Node fallback)";
          // a Bun-only call inside this swallow-all catch would silently skip
          // EVERY file under Node and report a 100%-healthy empty sweep.
          if (statSync(full).size > SWEEP_MAX_FILE_BYTES) continue;
          const content = readFileSync(full, "utf-8");
          totalBytes += content.length;
          files.push({ path: full.slice(root.length + 1), content });
        } catch { /* unreadable — skip */ }
      }
    }
  };
  walk(root, true);
  return { files, truncated };
}

// CLAUDE.md "## Sentinel Conventions" block surgical replace (Scan.md Phase 4b +
// Evolve.md Step 4) — extracted so the find-and-replace of a named convention
// section is ONE tested transform instead of hand-applied Edit prose duplicated
// across two workflows. Pure string->string: locates the markdown section whose
// heading text equals `sectionHeading` (default "## Sentinel Conventions"), and
// replaces its body (the lines from the heading up to but NOT including the next
// same-or-higher-level heading, or EOF) with `newSection`. `newSection` MUST
// include its own heading line. If the section is absent, appends it (with a
// blank-line separator) so callers get create-or-replace semantics. Content
// outside the target section is preserved byte-for-byte.
export function updateClaudeMdSection(
  content: string,
  newSection: string,
  sectionHeading = "## Sentinel Conventions",
): string {
  const lines = content.split("\n");
  // Heading level = count of leading '#'.
  const level = (sectionHeading.match(/^#+/)?.[0].length) ?? 2;
  const headingText = sectionHeading.replace(/^#+\s*/, "").trim();
  const isHeading = (l: string) => /^#+\s/.test(l);
  const headingLevel = (l: string) => (l.match(/^#+/)?.[0].length) ?? 0;
  const headingTextOf = (l: string) => l.replace(/^#+\s*/, "").trim();

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isHeading(lines[i]) && headingLevel(lines[i]) === level && headingTextOf(lines[i]) === headingText) {
      start = i;
      break;
    }
  }

  const replacement = newSection.replace(/\n+$/, "");

  if (start === -1) {
    // Section absent — append create-or-replace style.
    const base = content.replace(/\n+$/, "");
    return `${base}\n\n${replacement}\n`;
  }

  // Find the end: next heading of same-or-higher level (fewer or equal '#'), else EOF.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (isHeading(lines[i]) && headingLevel(lines[i]) <= level) {
      end = i;
      break;
    }
  }

  const before = lines.slice(0, start);
  const after = lines.slice(end);
  const rebuilt = [...before, ...replacement.split("\n"), ...after];
  return rebuilt.join("\n");
}

// Active-first, then by-slug — shared by the artifact render AND the KG-op cap so
// the capped 40 intends_status facts are the active/recent ones the reconciler
// depends on (ratified 2026-07-07, PREDICATES.md v3.5).
function sortPrdsActiveFirst(prds: DurantePRD[]): DurantePRD[] {
  return [...prds].sort((a, b) => (a.bucket === "active" ? 0 : 1) - (b.bucket === "active" ? 0 : 1) || a.slug.localeCompare(b.slug));
}

export function renderDuranteNative(d: DuranteNative, date: string): string {
  const none = "_(none)_";
  const wf = d.workflows.map((w) => `- **${w.name}** _(${w.origin})_ — ${w.description}  ·  phases: ${w.phases.join(" → ")}`).join("\n") || none;
  const buckets = { active: 0, archived: 0, flat: 0 };
  for (const p of d.prds) buckets[p.bucket]++;
  const prdSorted = sortPrdsActiveFirst(d.prds);
  const prd = prdSorted.map((p) => `- \`${p.slug}\` — ${p.task} _(effort ${p.effort}, phase ${p.phase}, ${p.progress})_`).join("\n") || none;
  const rfc = d.rfcs.map((r) => `- **${r.id}** — ${r.title} _[${r.status}]_`).join("\n") || none;
  const rm = d.roadmaps.map((p) => `- \`${p}\``).join("\n") || none;
  return `# Durante-Native Inventory
<!-- Auto-generated by sentinel-durante-artifact.ts on ${date}. Source: .sentinel/scan-report.json \`durante\`. Deterministic transform — do not hand-edit. -->

Detection signals: ${d.signals.join(", ")}

## Native Workflows (${d.workflows.length})
${wf}

## PRD Corpus (${d.prds.length} — ${buckets.active} active / ${buckets.archived} archived / ${buckets.flat} flat)
${prd}

## RFC Corpus (${d.rfcs.length})
${rfc}

## Roadmaps & DAG (${d.roadmaps.length})
${rm}

## Agent Packs (${d.agentPacks.length})
${d.agentPacks.join(", ") || none}

## Skills (${d.skills.length})
${d.skills.join(", ") || none}
`;
}

// Canonical KG predicates this tool may emit. Parity-tested against the
// PREDICATES.md registry (RFC-0073) so the emission set cannot silently drift
// from the ratified vocabulary — the 2026-07-07 studio scan lost 48 tool ops
// (40 prd_intent + 8 has_workflow) to the predicate gate because the tool's
// vocabulary predated ratification. intends_status (successor to prd_intent)
// and governed_by_rfc (successor to bare rfc) were operator-ratified
// 2026-07-07 (PREDICATES.md v3.5).
export const CANONICAL_SCAN_PREDICATES = ["has_component", "intends_status", "governed_by_rfc"] as const;

export function buildDuranteKgOps(
  d: DuranteNative,
  wing: string,
  renderedBody: string,
  date: string,
  caps: { prds?: number; rfcs?: number } = {},
): Array<Record<string, unknown>> {
  const maxPrds = caps.prds ?? 40;
  const maxRfcs = caps.rfcs ?? 60;
  const subject = `project:${wing}`;
  const fact = (predicate: string, object: string) => ({ action: "add_kg_fact", args: { subject, predicate, object, valid_from: date } });
  const ops: Array<Record<string, unknown>> = [];
  // Containment semantics → has_component (the has_pack/has_agent alias family
  // already collapses here; `composes` is spawn-composition, NOT containment).
  // The "workflow: "/"agent-pack: " object prefixes are the typed-subset key for
  // breakdown queries — ratified with the v3.5 registry entry.
  for (const w of d.workflows) ops.push(fact("has_component", `workflow: ${w.name}`));
  for (const a of d.agentPacks) ops.push(fact("has_component", `agent-pack: ${a}`));
  // intends_status: the version-council-review reconciler's intended-status left
  // half. Active-first BEFORE the cap, so the queryable facts are the ones the
  // reconciler needs (not raw glob order).
  for (const p of sortPrdsActiveFirst(d.prds).slice(0, maxPrds)) ops.push(fact("intends_status", `${p.slug}@${p.phase} (${p.progress})`));
  for (const r of d.rfcs.slice(0, maxRfcs)) ops.push(fact("governed_by_rfc", `${r.id}: ${r.title} [${r.status}]`));
  // Full inventory as a drawer (caps above bound the queryable FACTS only; the
  // drawer + DURANTE-NATIVE.md carry the complete record, so the caps are not
  // silent truncation). source_file matches the sibling artifact drawers (Step 3b/3d).
  ops.push({ action: "add_drawer", args: { wing, room: "durante-native", content: renderedBody, source_file: "sentinel-scan-artifacts", added_by: "sentinel" } });
  return ops;
}

// ---------------------------------------------------------------------------
// B5-B8 deterministic transforms (RFC-0126 §9) — moved OUT of Scan.md prose so
// the gates / cohort-filters / parse-blocks are tested code, not hand-applied per
// run. All pure (string/array in, value out); the IO shells live in the CLI
// subcommands below. Behavior-preserving with the prose they replace.
// ---------------------------------------------------------------------------

// Phase 1b scaffold (B6). The project-level memory + plans directories Sentinel
// creates so hooks resolve project-first (paths.ts). Single tested source of the
// list so the prose mkdir set cannot drift from what the tool creates. STATE/,
// VOICE/, RELATIONSHIP/ are deliberately ABSENT (global-only — see Phase 1b note).
export function projectScaffoldDirs(): string[] {
  return [
    "MEMORY/WORK",
    "MEMORY/LEARNING",
    "MEMORY/RESEARCH",
    "MEMORY/ARTIFACTS",
    "MEMORY/SECURITY",
    "Plans/Specs",
  ];
}

// Creates the Phase 1b scaffold dirs under `root`, returning which were newly made
// vs already present (so the prose can report "{N} created"). Idempotent.
export function scaffoldProjectDirs(root: string): { created: string[]; existing: string[] } {
  const created: string[] = [];
  const existing: string[] = [];
  for (const rel of projectScaffoldDirs()) {
    const abs = join(root, rel);
    if (existsSync(abs)) {
      existing.push(rel);
    } else {
      mkdirSync(abs, { recursive: true });
      created.push(rel);
    }
  }
  return { created, existing };
}

// Phase 2 Step 2a (B7) — the deterministic half of representative-file selection:
// the N most-changed files by git churn. The git command was hand-typed in prose
// (`git log --pretty=format: --name-only -100 | sort | uniq -c | sort -rn`), so a
// transcription slip silently changed the inputs the inference call sees. Pure over
// a `log()` callback for testability; the CLI subcommand wires it to git. Files are
// returned most-changed-first; ties broken by path for determinism.
export function mostChangedFiles(
  logRunner: () => string,
  limit = 3,
): string[] {
  const raw = logRunner();
  const counts = new Map<string, number>();
  for (const line of raw.split("\n")) {
    const f = line.trim();
    if (!f) continue;
    counts.set(f, (counts.get(f) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, limit))
    .map(([f]) => f);
}

// Phase 2d Step 2d-i (B7) — converge local conventions against the upstream-canonical
// baseline. The classification rule (match by category + normalized substring) was
// applied by hand per run in prose; here it is one deterministic transform. A local
// convention `matches` when some upstream rule shares its normalized token overlap;
// otherwise `local-only`. Upstream rules unmatched by any local convention are
// `upstream-gap`. (`diverges` requires a same-category contradiction signal the inference
// supplies; callers tag it explicitly — this function does the structural set math.)
interface LocalConvention { category: string; pattern: string }
interface UpstreamConvention { rule: string; citation?: string; category?: string }
export interface ConventionClassification {
  matches: Array<{ local: string; upstream: string }>;
  localOnly: string[];
  /** `probe` carries the gap's verification provenance (2026-07-07, Fowler+RedTeam):
   *  "unverified" (default — set-math only, NOBODY looked at the repo yet; tiers
   *  HIGH annotated until probed), "confirmed" (repo probe confirmed the gap),
   *  "refuted" (repo probe showed the practice IS followed — collapse to matches).
   *  The field exists so the tier table keys on verification state mechanically —
   *  a bare gap entry could be read as a compliance verdict when it is only a
   *  set-membership fact (4 of 5 studio gaps were false). */
  upstreamGap: Array<{ rule: string; citation?: string; probe: "unverified" | "confirmed" | "refuted" }>;
}

function normalizeForMatch(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4),
  );
}

function sharedTokenCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

function normalizeCategory(s: string | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function classifyConventions(
  local: LocalConvention[],
  upstream: UpstreamConvention[],
): ConventionClassification {
  const upstreamTokens = upstream.map((u) => ({
    u,
    tokens: normalizeForMatch(u.rule),
    category: normalizeCategory(u.category),
  }));
  const matchedUpstream = new Set<number>();
  const matches: Array<{ local: string; upstream: string }> = [];
  const localOnly: string[] = [];

  for (const l of local) {
    const lt = normalizeForMatch(`${l.pattern}`);
    const lcat = normalizeCategory(l.category);
    // Match rule (tightened 2026-07-07, Fowler seat): ≥2 shared tokens, OR
    // 1 shared token promoted by category agreement. Bare single-token overlap
    // over-matched ("test" glued unrelated rules) while still missing lexical
    // variants — category agreement is the cheap semantic tie-break; a domain
    // synonym map was explicitly declined (drifting duplicated knowledge).
    // Among qualifying rows pick the STRONGEST overlap (ties prefer a not-yet-
    // matched row) — greedy first-qualifying let a weak early hit claim a local
    // whose true counterpart then surfaced as a false gap.
    let matchedIdx = -1;
    let bestShared = 0;
    for (let i = 0; i < upstreamTokens.length; i++) {
      const shared = sharedTokenCount(lt, upstreamTokens[i].tokens);
      const sameCategory = lcat !== "" && lcat === upstreamTokens[i].category;
      if (!(shared >= 2 || (shared >= 1 && sameCategory))) continue;
      const beats = shared > bestShared ||
        (shared === bestShared && matchedIdx >= 0 && matchedUpstream.has(matchedIdx) && !matchedUpstream.has(i));
      if (matchedIdx === -1 || beats) {
        matchedIdx = i;
        bestShared = shared;
      }
    }
    if (matchedIdx >= 0) {
      matchedUpstream.add(matchedIdx);
      matches.push({ local: l.pattern, upstream: upstreamTokens[matchedIdx].u.rule });
    } else {
      localOnly.push(l.pattern);
    }
  }

  // A gap is a set-membership FACT ("no local row matched"), not a compliance
  // verdict — it ships probe:"unverified" until the Scan.md 2d-i repo probe
  // upgrades it. Unverified gaps stay visible (tier HIGH, annotated).
  const upstreamGap = upstreamTokens
    .map((entry, i) => ({ entry, i }))
    .filter(({ i }) => !matchedUpstream.has(i))
    .map(({ entry }) => ({ rule: entry.u.rule, citation: entry.u.citation, probe: "unverified" as const }));

  return { matches, localOnly, upstreamGap };
}

// ---------------------------------------------------------------------------
// Phase 2d Step 2d-i gap probes (2026-07-07 follow-up) — mechanizes the
// probe:"unverified" → "confirmed"|"refuted" upgrade that previously lived only
// in workflow prose. The agent authors ONE read-only repo probe per gap (rg /
// fd / test -e — a query whose MATCH means "the repo follows this practice");
// this runs them and emits receipts, so a skipped probe is visible as a
// still-unverified entry rather than an invisible prose omission.
// ---------------------------------------------------------------------------

export interface GapProbe {
  rule: string;
  citation?: string;
  /** Read-only repo query whose MATCH (exit 0 + NON-EMPTY stdout) means "the
   *  practice is followed". Use output-producing probes (rg -l, fd, ls, grep -c);
   *  `test -e` is NOT valid — it exits 0 with empty stdout and can never refute. */
  probe_cmd: string;
}

export interface GapProbeReceipt {
  rule: string;
  probe_cmd: string;
  matched: boolean;
  /** First 200 chars of probe stdout — the receipt's evidence sample. */
  output_sample: string;
  /** refuted = probe matched (repo follows the practice); confirmed = probe ran
   *  cleanly and found nothing (repo really doesn't follow it); unverified = the
   *  probe was BROKEN (spawn error, timeout/signal, exit ≥ 2, malformed entry) —
   *  no repo evidence was gathered, so no verdict may be asserted. */
  probe: "confirmed" | "refuted" | "unverified";
}

/** `broken: true` = infrastructure failure (timeout, signal, exit ≥ 2, missing
 *  binary) — distinct from a clean no-match (grep-family exit 1, empty stdout). */
export type ProbeRunner = (cmd: string) => { ok: boolean; output: string; broken?: boolean };

export function probeGaps(gaps: GapProbe[], run: ProbeRunner): GapProbeReceipt[] {
  return gaps.map((g) => {
    if (typeof g.probe_cmd !== "string" || g.probe_cmd.trim() === "") {
      return { rule: g.rule ?? "(unnamed)", probe_cmd: String(g.probe_cmd), matched: false, output_sample: "malformed entry: probe_cmd missing/empty", probe: "unverified" as const };
    }
    let matched = false;
    let broken = false;
    let output = "";
    try {
      const r = run(g.probe_cmd);
      matched = !r.broken && r.ok && r.output.trim().length > 0;
      broken = r.broken === true;
      output = r.output;
    } catch (e) {
      broken = true;
      output = `probe error: ${(e as Error).message}`;
    }
    return {
      rule: g.rule,
      probe_cmd: g.probe_cmd,
      matched,
      output_sample: output.slice(0, 200),
      // Taxonomy (Scan.md 2d-i): match → refuted; clean no-match → confirmed;
      // broken probe → unverified (stays visible in the ⏳ count — a broken probe
      // asserting "confirmed" would fabricate repo evidence never gathered).
      probe: matched ? "refuted" : broken ? "unverified" : "confirmed",
    };
  });
}

// Phase 2d Step 2d-iv (B7) — delta vs the prior scan. The New/Drifted/Resolved diff
// was hand-applied in prose ("match conventions across scans by category + substring").
// Pure set/diff over two convention lists keyed by category. `new` = present now, absent
// prior; `resolved` = present prior, absent now; `drifted` = same category present in both
// but the pattern text differs non-trivially (normalized token sets diverge).
export interface ScanDelta {
  added: Array<{ category: string; pattern: string }>;
  drifted: Array<{ category: string; from: string; to: string }>;
  resolved: Array<{ category: string; pattern: string }>;
}

export function compareScans(
  current: LocalConvention[],
  prior: LocalConvention[],
): ScanDelta {
  const key = (c: LocalConvention) => `${c.category} ${c.pattern}`;
  const curKeys = new Set(current.map(key));
  const priorKeys = new Set(prior.map(key));

  const added = current.filter((c) => !curKeysInPrior(c, priorKeys, key));
  const resolved = prior.filter((c) => !priorKeysInCur(c, curKeys, key));

  // Drift: same category in both, pattern text differs (exact-key miss but token-set differs).
  const priorByCat = new Map<string, LocalConvention[]>();
  for (const c of prior) {
    const arr = priorByCat.get(c.category) ?? [];
    arr.push(c);
    priorByCat.set(c.category, arr);
  }
  const drifted: Array<{ category: string; from: string; to: string }> = [];
  const driftedFrom = new Set<string>();
  for (const c of current) {
    if (priorKeys.has(key(c))) continue; // unchanged exact match — not drift
    const samecat = priorByCat.get(c.category) ?? [];
    for (const p of samecat) {
      if (curKeys.has(key(p))) continue; // p still present verbatim — not the drift source
      const a = normalizeForMatch(c.pattern);
      const b = normalizeForMatch(p.pattern);
      if (sharedTokenCount(a, b) >= 1 && key(c) !== key(p)) {
        drifted.push({ category: c.category, from: p.pattern, to: c.pattern });
        driftedFrom.add(key(p));
        break;
      }
    }
  }

  return {
    added: added.filter((c) => !drifted.some((d) => d.category === c.category && d.to === c.pattern)),
    drifted,
    resolved: resolved.filter((c) => !driftedFrom.has(key(c))),
  };
}

function curKeysInPrior(c: LocalConvention, priorKeys: Set<string>, key: (c: LocalConvention) => string): boolean {
  return priorKeys.has(key(c));
}
function priorKeysInCur(c: LocalConvention, curKeys: Set<string>, key: (c: LocalConvention) => string): boolean {
  return curKeys.has(key(c));
}

// Phase 3 Step 3 (B8) — parse + validate the MemPalace `batch` response. The bridge
// ALWAYS exits 0 (errors come back as status='error' in the JSON body), so a `tail -1`
// check is structurally wrong (success and error both end in `}`). This was a python3 -c
// heredoc in prose; here it is one tested parser returning a typed verdict. `ok` is the
// count of per-op results with status 'ok'; `failed` is the rest. Throws on non-JSON so
// the caller surfaces a real error rather than silently claiming success.
export interface BatchVerdict {
  status: string;
  ok: number;
  total: number;
  errors: number;
  allOk: boolean;
}

export function parseBatchResponse(responseJson: string): BatchVerdict {
  const r = JSON.parse(responseJson) as {
    status?: string;
    results?: Array<{ status?: string }>;
    errors?: number;
    count?: number;
  };
  const results = Array.isArray(r.results) ? r.results : [];
  const ok = results.filter((x) => x.status === "ok").length;
  const total = typeof r.count === "number" ? r.count : results.length;
  const errors = typeof r.errors === "number" ? r.errors : Math.max(0, total - ok);
  const status = r.status ?? "unknown";
  return { status, ok, total, errors, allOk: status === "ok" && errors === 0 };
}

// Phase 5b (B7) — idempotent project-registry upsert. The jq one-liner
// (`.projects |= (if any(.[]; .id==$id) then . else . + [{...}])`) was hand-typed in
// prose; this is the same dedup-by-id append as a pure transform over the parsed file.
// NEVER overwrites an existing entry (its root_path edits go through manual review), so
// re-running the scan is a no-op when the id is present. Returns the new projects object
// + whether it changed (so the caller can skip the write on a no-op).
export interface ProjectEntry {
  id: string;
  name: string;
  wing: string;
  root_path: string;
  description?: string;
}
export interface ProjectsRegistry { projects?: ProjectEntry[]; [k: string]: unknown }

export function upsertProjectEntry(
  registry: ProjectsRegistry,
  entry: ProjectEntry,
): { registry: ProjectsRegistry; changed: boolean } {
  const projects = Array.isArray(registry.projects) ? registry.projects : [];
  if (projects.some((p) => p.id === entry.id)) {
    return { registry: { ...registry, projects }, changed: false };
  }
  return { registry: { ...registry, projects: [...projects, entry] }, changed: true };
}

// Phase 6c (B7) — render the statusline palace-cache file body from the bridge `status`
// JSON. The jq extraction (`.wings[$w].total`, `.total_drawers`) + shell heredoc was in
// prose; this is the pure transform (status JSON + wing in, cache file body out). Degrades
// gracefully: missing/unparseable status yields 0/0 so the statusline renders `Drwr:0`
// (a real cache) rather than a missing cache (`Drwr:—`). The bridge query stays I/O in the
// CLI subcommand; this function is the deterministic core.
export function renderPalaceCache(wing: string, statusJson: string): string {
  let wingDrawers = 0;
  let totalDrawers = 0;
  try {
    const s = JSON.parse(statusJson) as {
      total_drawers?: number;
      wings?: Record<string, { total?: number }>;
    };
    totalDrawers = typeof s.total_drawers === "number" ? s.total_drawers : 0;
    const w = s.wings?.[wing];
    wingDrawers = w && typeof w.total === "number" ? w.total : 0;
  } catch {
    // fail-open → 0/0
  }
  return `palace_wing_drawers=${wingDrawers}\npalace_total_drawers=${totalDrawers}\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`SentinelScan — Static analysis engine for codebase discovery

USAGE
  bun SentinelScan.ts [options] [/path/to/repo]
  bun SentinelScan.ts resolve <docs-dir|wing> [/path/to/repo]
  bun SentinelScan.ts health-score <violations> <total>
  bun SentinelScan.ts update-claude-md <file> <newSection>
  bun SentinelScan.ts scaffold-dirs [/path/to/repo]
  bun SentinelScan.ts most-changed [N] [/path/to/repo]
  bun SentinelScan.ts parse-batch '<batch-response-json>'
  bun SentinelScan.ts register-project <projects.json> <id> <name> <wing> <root_path> [description]
  bun SentinelScan.ts palace-cache <wing> '<bridge-status-json>'
  bun SentinelScan.ts classify-conventions <local.json> <upstream.json>
  bun SentinelScan.ts compare-scans <current.json> <prior.json>

ARGUMENTS
  /path/to/repo    Directory to scan (default: current directory)

SUBCOMMANDS
  resolve docs-dir [path]   Print resolveDocsDir(path): Docs/Sentinel when Docs/
                            exists, else .sentinel/docs (single source of truth
                            for the Scan/Status output directory).
  resolve wing [path]       Print deriveWing(null, path): the registry wing if the
                            project is registered, else kebab(basename(path)).
  health-score <v> <t>      Print calculateHealthScore(violations, total): the
                            integer healthy percentage round((t-v)/t*100).
  update-claude-md <f> <s>  Create-or-replace the named section in CLAUDE.md file
                            <f> with text <s> (updateClaudeMdSection); writes back.
  scaffold-dirs [path]      Create the Phase-1b project memory/plans dirs
                            (scaffoldProjectDirs); prints "created N, existing M".
  most-changed [N] [path]   Print the N most-changed files by git churn
                            (mostChangedFiles) — the deterministic Step-2a inputs.
  parse-batch <json>        Parse the MemPalace batch response (parseBatchResponse);
                            prints "status=.. ok=N/T errors=E" and exits 1 unless all-ok.
  register-project ...      Idempotent .dos-projects.json upsert (upsertProjectEntry);
                            never overwrites an existing id. Prints "upserted|exists".
  palace-cache <wing> <json> Render the statusline palace-cache body (renderPalaceCache)
                            from the bridge status JSON; prints the cache file body.
  classify-conventions <l> <u>  Run classifyConventions() over two JSON arrays
                            (local conventions, upstream canon); prints the
                            {matches, localOnly, upstreamGap} classification.
  compare-scans <c> <p>     Run compareScans() over two convention JSON arrays
                            (current, prior); prints the {added, drifted,
                            resolved} delta — the deterministic Step 2d-iv diff.

OPTIONS
  --help           Show this help message

OUTPUT
  JSON to stdout + .sentinel/scan-report.json in target repo
  Scans: project metadata, directory structure, tech stack,
         git metadata, file statistics, existing tooling`);
  process.exit(0);
}

// `resolve` subcommand — prints a single deterministic value so workflow prose
// can call the tested helper instead of re-deriving the rule in shell (closes the
// Scan.md/Bootstrap.md drift on DOCS_DIR + wing). Prints to stdout, no newline noise.
function runResolve(args: string[]): void {
  const what = args[0];
  const root = resolve(args[1] || ".");
  if (what === "docs-dir") {
    console.log(resolveDocsDir(root));
    process.exit(0);
  }
  if (what === "wing") {
    const { wing } = readDosProjects(root);
    console.log(deriveWing(wing, root));
    process.exit(0);
  }
  console.error(`Error: unknown resolve target '${what ?? ""}'. Expected: docs-dir | wing`);
  process.exit(1);
}

// `health-score <violations> <total>` subcommand — prints the integer health score
// so Phase 2b-iv prose calls calculateHealthScore() instead of hand-evaluating the
// ratio. Non-numeric input errors rather than silently producing NaN.
function runHealthScore(args: string[]): void {
  const violations = Number(args[0]);
  const total = Number(args[1]);
  if (!Number.isFinite(violations) || !Number.isFinite(total)) {
    console.error("Error: health-score requires numeric <violations> <total> arguments");
    process.exit(1);
  }
  console.log(calculateHealthScore(violations, total));
  process.exit(0);
}

// `update-claude-md <file> <newSection>` subcommand — reads the file (create-or-replace
// if absent), applies the tested section-replace helper, and writes it back. Replaces the
// prior `bun -e` inline import that hardcoded an absolute home path (non-portable).
function runUpdateClaudeMd(args: string[]): void {
  const file = args[0];
  const newSection = args[1];
  if (!file || newSection === undefined) {
    console.error("Error: update-claude-md requires <file> <newSection> arguments");
    process.exit(1);
  }
  const base = existsSync(file) ? readFileSync(file, "utf-8") : "";
  // writeArtifact:exempt — in-place repo CLAUDE.md section update, not a produced artifact
  writeFileSync(file, updateClaudeMdSection(base, newSection));
  process.exit(0);
}

// `scaffold-dirs [path]` — create the Phase-1b project dirs (B6) so the prose calls the
// tested scaffold list instead of hand-typed mkdir lines.
function runScaffoldDirs(args: string[]): void {
  const root = resolve(args[0] || ".");
  const { created, existing } = scaffoldProjectDirs(root);
  console.log(`scaffold-dirs: created ${created.length}, existing ${existing.length}`);
  process.exit(0);
}

// `most-changed [N] [path]` — print the N most-changed files by git churn (B7). The git
// command runs here so the prose never re-types it.
function runMostChanged(args: string[]): void {
  // Args may be [N, path], [path], or []. Treat a numeric first arg as N.
  let limit = 3;
  let root = ".";
  if (args.length === 1) {
    if (/^\d+$/.test(args[0])) limit = Number(args[0]);
    else root = args[0];
  } else if (args.length >= 2) {
    limit = /^\d+$/.test(args[0]) ? Number(args[0]) : 3;
    root = args[1];
  }
  const absRoot = resolve(root);
  const files = mostChangedFiles(
    () => sh("git log --pretty=format: --name-only -100", absRoot),
    limit,
  );
  for (const f of files) console.log(f);
  process.exit(0);
}

// `parse-batch <json>` — parse the MemPalace batch response (B8); exits 1 unless all-ok so
// the prose pipeline aborts on a partial write instead of claiming success.
function runParseBatch(args: string[]): void {
  const json = args[0];
  if (!json) {
    console.error("Error: parse-batch requires a <batch-response-json> argument");
    process.exit(1);
  }
  let v;
  try {
    v = parseBatchResponse(json);
  } catch (e) {
    console.error(`parse-batch: response is not valid JSON: ${(e as Error).message}`);
    process.exit(1);
  }
  console.log(`batch: status=${v.status} ok=${v.ok}/${v.total} errors=${v.errors}`);
  process.exit(v.allOk ? 0 : 1);
}

// `register-project <projects.json> <id> <name> <wing> <root_path> [description]` — idempotent
// upsert into .dos-projects.json (B7). Reads, applies upsertProjectEntry, writes back only on
// change. Prints "upserted" or "exists (no-op)".
function runRegisterProject(args: string[]): void {
  const [file, id, name, wing, rootPath, description] = args;
  if (!file || !id || !name || !wing || !rootPath) {
    console.error("Error: register-project requires <projects.json> <id> <name> <wing> <root_path> [description]");
    process.exit(1);
  }
  let registry: ProjectsRegistry = { projects: [] };
  if (existsSync(file)) {
    const parsed = tryReadJson(file);
    if (parsed) registry = parsed as ProjectsRegistry;
  }
  const { registry: next, changed } = upsertProjectEntry(registry, {
    id, name, wing, root_path: rootPath, description: description ?? "",
  });
  if (changed) {
    const tmp = `${file}.tmp`;
    // writeArtifact:exempt — atomic tmp write of sentinel state (rename follows)
    writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n");
    renameSync(tmp, file);
    console.log(`register-project: upserted '${id}'`);
  } else {
    console.log(`register-project: '${id}' exists (no-op)`);
  }
  process.exit(0);
}

// `palace-cache <wing> <status-json>` — render the statusline cache body (B7) from the bridge
// status JSON. Pure render; the caller pipes the bridge `status` output in.
function runPalaceCache(args: string[]): void {
  const wing = args[0];
  const statusJson = args[1];
  if (!wing || statusJson === undefined) {
    console.error("Error: palace-cache requires <wing> <status-json> arguments");
    process.exit(1);
  }
  process.stdout.write(renderPalaceCache(wing, statusJson));
  process.exit(0);
}

// `classify-conventions <local.json> <upstream.json>` — run the tested
// classifyConventions() set-math over two JSON arrays and print the
// {matches, localOnly, upstreamGap} classification. Scan.md Step 2d-i calls
// this so the prose never hand-applies the token-overlap rule (sentinel-rest-001).
function runClassifyConventions(args: string[]): void {
  const [localFile, upstreamFile] = args;
  if (!localFile || !upstreamFile) {
    console.error("Error: classify-conventions requires <local.json> <upstream.json> arguments");
    process.exit(1);
  }
  const local = tryReadJson(localFile) as unknown as LocalConvention[] | null;
  const upstream = tryReadJson(upstreamFile) as unknown as UpstreamConvention[] | null;
  if (!Array.isArray(local) || !Array.isArray(upstream)) {
    console.error("Error: classify-conventions inputs must each be a JSON array");
    process.exit(1);
  }
  console.log(JSON.stringify(classifyConventions(local, upstream), null, 2));
  process.exit(0);
}

// `sweep-conventions [path]` — the Phase 2b-iv live conformance sweep. Reads
// .sentinel/conventions.json, walks the live tree (ignore-set + nested-git
// boundaries in collectSweepFiles), and prints the SweepResult JSON. The
// `violations` field is the calculateHealthScore input for the MECHANICAL
// subset only — the `unsweepable` list MUST still be agent-checked (rg/fd per
// convention) before the final score is derived; the coverage line makes the
// mechanical share explicit so partial coverage is never silently totalized.
function runSweepConventions(args: string[]): void {
  const root = resolve(args[0] || ".");
  const cachePath = join(root, ".sentinel", "conventions.json");
  if (!existsSync(cachePath)) {
    console.error("Error: .sentinel/conventions.json not found — run ConventionCache.ts first");
    process.exit(1);
  }
  const cache = tryReadJson(cachePath) as { conventions?: SweepRule[] } | null;
  const rules = cache?.conventions;
  if (!Array.isArray(rules)) {
    console.error("Error: conventions.json has no conventions array");
    process.exit(1);
  }
  const extraIgnore = readSweepIgnoreConfig(root);
  const { files, truncated } = collectSweepFiles(root, extraIgnore);
  const result = sweepConventions(rules, files);
  if (truncated) console.error("WARNING: sweep corpus TRUNCATED (file/byte cap hit) — verdicts cover a partial tree; do NOT write a method:\"live-sweep\" score from this run alone");
  console.log(JSON.stringify({ ...result, files_scanned: files.length, truncated }, null, 2));
  process.exit(0);
}

// `probe-gaps <gaps.json> [root]` — run each gap's recorded repo probe (rg -l /
// fd / ls — output-producing, read-only by convention; commands are agent-authored
// and run with the agent's own permissions, same trust level as the agent's Bash)
// and print the receipts. match → "refuted"; clean no-match (grep-family exit 1) →
// "confirmed"; timeout/signal/exit≥2/malformed → "unverified" (never a fabricated
// verdict). Exit 0 always — verdicts are data, not a gate.
function runProbeGaps(args: string[]): void {
  const [gapsFile, rootArg] = args;
  if (!gapsFile) {
    console.error("Error: probe-gaps requires a <gaps.json> argument ([{rule, probe_cmd}])");
    process.exit(1);
  }
  const gaps = tryReadJson(gapsFile) as unknown as GapProbe[] | null;
  if (!Array.isArray(gaps)) {
    console.error("Error: gaps.json must be a JSON array of {rule, probe_cmd}");
    process.exit(1);
  }
  const root = resolve(rootArg || ".");
  const receipts = probeGaps(gaps, (cmd) => {
    try {
      const output = execSync(cmd, { cwd: root, timeout: 10_000, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
      return { ok: true, output };
    } catch (e) {
      const err = e as { stdout?: string; status?: number | null; signal?: string | null; killed?: boolean };
      // grep-family exit 1 = clean no-match. Anything else (signal/timeout kill,
      // exit ≥ 2, no status at all) is a BROKEN probe — partial stdout from a
      // killed streaming rg must not read as either match or clean miss.
      const cleanNoMatch = err.status === 1 && !err.signal && !err.killed;
      return { ok: false, output: err.stdout ?? "", broken: !cleanNoMatch };
    }
  });
  const tally = (v: string) => receipts.filter((r) => r.probe === v).length;
  console.log(JSON.stringify({ probed: receipts.length, refuted: tally("refuted"), confirmed: tally("confirmed"), unverified: tally("unverified"), receipts }, null, 2));
  process.exit(0);
}

// `compare-scans <current.json> <prior.json>` — run the tested compareScans()
// diff over two convention arrays and print the {added, drifted, resolved}
// delta. Scan.md Step 2d-iv calls this so the prose never hand-applies the
// category + normalized-substring match rule (sentinel-rest-001).
function runCompareScans(args: string[]): void {
  const [currentFile, priorFile] = args;
  if (!currentFile || !priorFile) {
    console.error("Error: compare-scans requires <current.json> <prior.json> arguments");
    process.exit(1);
  }
  const current = tryReadJson(currentFile) as unknown as LocalConvention[] | null;
  const prior = tryReadJson(priorFile) as unknown as LocalConvention[] | null;
  if (!Array.isArray(current) || !Array.isArray(prior)) {
    console.error("Error: compare-scans inputs must each be a JSON array");
    process.exit(1);
  }
  console.log(JSON.stringify(compareScans(current, prior), null, 2));
  process.exit(0);
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
  }

  if (process.argv[2] === "resolve") {
    runResolve(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "health-score") {
    runHealthScore(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "update-claude-md") {
    runUpdateClaudeMd(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "scaffold-dirs") {
    runScaffoldDirs(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "most-changed") {
    runMostChanged(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "parse-batch") {
    runParseBatch(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "register-project") {
    runRegisterProject(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "palace-cache") {
    runPalaceCache(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "classify-conventions") {
    runClassifyConventions(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "compare-scans") {
    runCompareScans(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "sweep-conventions") {
    runSweepConventions(process.argv.slice(3));
    return;
  }

  if (process.argv[2] === "probe-gaps") {
    runProbeGaps(process.argv.slice(3));
    return;
  }

  const root = resolve(process.argv[2] || ".");

  if (!existsSync(root)) {
    console.error(`Error: Directory not found: ${root}`);
    process.exit(1);
  }

  const [project, structure, stack, git, files, scripts, existing, submodules, durante] = await Promise.all([
    scanProject(root),
    scanStructure(root),
    scanStack(root),
    Promise.resolve(scanGit(root)),
    scanFiles(root),
    Promise.resolve(scanScripts(root)),
    scanExisting(root),
    scanSubmodules(root),
    scanDuranteNative(root),
  ]);

  if (submodules.length > 0) structure.hasMonorepo = true;

  const isEmptyProject =
    files.totalFiles < 3 &&
    !existing.hasClaudeMd &&
    Object.keys(stack.dependencies).length === 0 &&
    Object.keys(stack.devDependencies).length === 0;

  const report: ScanReport = { project, structure, stack, git, files, scripts, existing, submodules, durante, isEmptyProject };

  // Write to .sentinel/scan-report.json
  const sentinelDir = join(root, ".sentinel");
  if (!existsSync(sentinelDir)) mkdirSync(sentinelDir, { recursive: true });
  // writeArtifact:exempt — .sentinel/scan-report.json (path via var)
  writeFileSync(join(sentinelDir, "scan-report.json"), JSON.stringify(report, null, 2));

  // Output to stdout
  console.log(JSON.stringify(report, null, 2));
}

// Guard: run the CLI only when invoked directly, so test imports don't trigger a scan.
if (import.meta.main) {
  main().catch((err) => {
    console.error("SentinelScan failed:", err.message);
    process.exit(1);
  });
}
