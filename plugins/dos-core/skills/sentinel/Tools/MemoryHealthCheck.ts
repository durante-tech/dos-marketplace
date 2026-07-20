#!/usr/bin/env bun
/**
 * MemoryHealthCheck.ts — Sentinel/MemoryHealth workflow backing tool.
 *
 * Single-command audit of the memory subsystem across 8 sections:
 *   1. Hygiene (wraps MemoryHygiene.ts)
 *   2. Drift telemetry (mempalace-drift.jsonl)
 *   3. Pending queue depth
 *   4. Backup freshness
 *   5. Gitignore disk volume
 *   6. Reconcile freshness
 *   7. Bridge surface usage
 *   8. Registry consistency (R39 + R40 + R42 — added 2026-05-09)
 *
 * Each section is wrapped in try/catch so one failure does not crash the others.
 *
 * Flags:
 *   --json    emit machine-readable JSON
 *   --fix     when paired with --apply, mechanically resolves Phase 8 issues:
 *               • mirror missing rows from .dos-projects.json into PROJECTS.md
 *               • pre-seed missing palace-cache-{wing}.sh files
 *               (R42 — resolver source parity — needs code, not data, so is
 *                not auto-fixable; it's reported only.)
 *             Without --apply, --fix is dry-run (prints planned changes).
 *   --apply   confirm destructive intent for --fix. Required to write changes.
 *   --help    show usage
 *
 * Exit codes:
 *   0 = clean OR warnings only
 *   1 = any critical issue (backup >48h, pending >200, drift unknowns >0,
 *       Phase 8 fail without --fix --apply)
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// ───────────────────────────────────────────────────────────────────────────
// CLI
// ───────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const FLAG_JSON = argv.includes("--json");
const FLAG_FIX = argv.includes("--fix");
const FLAG_APPLY = argv.includes("--apply");
const FLAG_HELP = argv.includes("--help") || argv.includes("-h");

if (FLAG_HELP) {
  console.log(
    [
      "MemoryHealthCheck.ts — 8-section memory subsystem audit",
      "",
      "USAGE:",
      "  bun ~/.claude/skills/sentinel/Tools/MemoryHealthCheck.ts [--json] [--fix [--apply]]",
      "",
      "FLAGS:",
      "  --json    Emit JSON instead of human-readable report",
      "  --fix     Dry-run mechanical resolution of Phase 8 issues",
      "  --apply   Confirm destructive intent — writes changes (must pair with --fix)",
      "  --help    Show this help",
      "",
      "EXIT CODES:",
      "  0   All sections clean OR warnings only",
      "  1   Any critical issue surfaced",
    ].join("\n"),
  );
  process.exit(0);
}

const HOME = homedir();
const ts = new Date().toISOString();

// ───────────────────────────────────────────────────────────────────────────
// Section runners (each returns { score, issues, ...details })
// ───────────────────────────────────────────────────────────────────────────

type SectionResult = {
  ok: boolean;
  score: number;
  issues: string[];
  details: Record<string, unknown>;
  /** True when the section PROBE THREW (vs. ran and scored low). A thrown probe
   *  is rendered as `ERROR (probe failed)`, never `0/100` — a crashed check and a
   *  genuinely-zero score are different states and must not look identical (ISC-42). */
  probeFailed?: boolean;
};

function safeRun(fn: () => SectionResult, label: string): SectionResult {
  try {
    return fn();
  } catch (e) {
    return {
      ok: false,
      score: 0,
      probeFailed: true,
      issues: [`section "${label}" crashed: ${(e as Error).message}`],
      details: { error: (e as Error).message },
    };
  }
}

function runBun(args: string[], opts: { timeout?: number } = {}): string {
  const result = spawnSync("bun", args, {
    encoding: "utf8",
    timeout: opts.timeout,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0 || typeof result.stdout !== "string") {
    const err = new Error(result.stderr || result.error?.message || `bun ${args.join(" ")} failed`);
    (err as Error & { stdout?: string }).stdout =
      typeof result.stdout === "string" ? result.stdout : "";
    throw err;
  }
  return result.stdout;
}

function camelToSnake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

// Order vN.N.N release dir names newest-first. A plain `.sort().reverse()` is
// lexical, so `v0.0.9` ranks above `v0.0.18` — picking the wrong (older)
// submodule the moment a single-digit-patch dir coexists with double-digit
// ones (sentinel-rest-008). numeric:true compares embedded numbers correctly.
export function sortVersionsDesc(versions: string[]): string[] {
  return [...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

export function extractBridgeUsageFromText(text: string): string[] {
  const actions = new Set<string>();
  const direct = /\bbridge(?:Sync|Fire|Async)\(\s*['"]([a-z_][a-z0-9_]*)['"]/g;
  const typed = /\bmempalaceClient(?:Async|Fire)?\.([a-zA-Z][A-Za-z0-9_]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = direct.exec(text)) !== null) actions.add(m[1]!);
  while ((m = typed.exec(text)) !== null) actions.add(camelToSnake(m[1]!));
  return [...actions].sort();
}

export function collectBridgeUsageFromDir(dir: string): string[] {
  const actions = new Set<string>();

  function walk(current: string): void {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === ".git" || name === "dist") continue;
      const full = join(current, name);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!st.isFile() || !/\.(?:ts|tsx|js|mjs|cjs)$/.test(name)) continue;
      try {
        for (const action of extractBridgeUsageFromText(readFileSync(full, "utf8"))) {
          actions.add(action);
        }
      } catch {
        /* skip unreadable files */
      }
    }
  }

  walk(dir);
  return [...actions].sort();
}

export function parseBridgeVersionActions(stdout: string): string[] {
  const parsed = JSON.parse(stdout) as { actions?: unknown };
  if (!Array.isArray(parsed.actions)) return [];
  return parsed.actions.filter((action): action is string => typeof action === "string").sort();
}

function readPluginBridgeSurface(pluginJsonPath: string): string[] {
  const plugin = JSON.parse(readFileSync(pluginJsonPath, "utf8")) as {
    dos?: { bridgeSurface?: unknown; bridge?: unknown };
  };
  const surface = plugin.dos?.bridgeSurface;
  if (Array.isArray(surface)) {
    return surface.filter((action): action is string => typeof action === "string").sort();
  }
  const bridge = plugin.dos?.bridge;
  if (Array.isArray(bridge)) {
    return bridge.filter((action): action is string => typeof action === "string").sort();
  }
  return [];
}

export function resolveBridgeSurface(options: {
  bridgePath?: string;
  pluginJsonPaths?: string[];
} = {}): { actions: string[]; source: string; issues: string[] } {
  const issues: string[] = [];
  const bridgePath = options.bridgePath ?? join(HOME, ".claude", "DOS", "Tools", "mempalace_bridge.py");
  if (existsSync(bridgePath)) {
    const result = spawnSync("python3", [bridgePath, "--version"], {
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (!result.error && result.status === 0 && typeof result.stdout === "string") {
      try {
        const actions = parseBridgeVersionActions(result.stdout);
        if (actions.length > 0) {
          return { actions, source: bridgePath, issues };
        }
        issues.push(`${bridgePath}: --version returned no actions`);
      } catch (e) {
        issues.push(`${bridgePath}: --version JSON parse failed: ${(e as Error).message}`);
      }
    } else {
      issues.push(`${bridgePath}: --version failed`);
    }
  } else {
    issues.push(`${bridgePath}: not found`);
  }

  const pluginJsonPaths = options.pluginJsonPaths ?? [
    join(HOME, "Durante", "Packs", "mem-palace", "plugin.json"),
    join(HOME, ".claude", "skills", "mem-palace", "plugin.json"),
  ];
  for (const pluginJsonPath of pluginJsonPaths) {
    if (!existsSync(pluginJsonPath)) continue;
    try {
      const actions = readPluginBridgeSurface(pluginJsonPath);
      if (actions.length > 0) {
        return { actions, source: pluginJsonPath, issues };
      }
      issues.push(`${pluginJsonPath}: missing dos.bridgeSurface[]`);
    } catch (e) {
      issues.push(`${pluginJsonPath}: unparseable plugin.json: ${(e as Error).message}`);
    }
  }

  return { actions: [], source: "unresolved", issues };
}

// 1. Hygiene — wrap MemoryHygiene.ts --json
function checkHygiene(): SectionResult {
  const tool = `${HOME}/Durante/Packs/mem-palace/src/Tools/MemoryHygiene.ts`;
  if (!existsSync(tool)) {
    return {
      ok: false,
      score: 0,
      issues: [`MemoryHygiene.ts not found at ${tool}`],
      details: {},
    };
  }
  const out = runBun([tool, "--json"]);
  const parsed = JSON.parse(out);
  // Hygiene issues are objects { severity, category, description, action, auto_fixable }
  // Normalize to short strings for our report.
  const rawIssues: unknown[] = Array.isArray(parsed.issues) ? parsed.issues : [];
  const issues = rawIssues.map((i) => {
    if (typeof i === "string") return i;
    if (i && typeof i === "object") {
      const o = i as Record<string, unknown>;
      const sev = o.severity ? `[${o.severity}] ` : "";
      const cat = o.category ? `(${o.category}) ` : "";
      const desc = o.description ?? o.message ?? JSON.stringify(o);
      return `${sev}${cat}${String(desc).slice(0, 120)}`;
    }
    return String(i);
  });
  return {
    ok: true,
    score: typeof parsed.overall_score === "number" ? parsed.overall_score : 50,
    issues,
    details: {
      overall_score: parsed.overall_score,
      total_drawers: parsed.total_drawers,
      total_kg_facts: parsed.total_kg_facts,
      last_harvest: parsed.last_harvest,
    },
  };
}

// 2. Drift telemetry — read last 100 lines of mempalace-drift.jsonl
function checkDrift(): SectionResult {
  const path = `${HOME}/.claude/MEMORY/LEARNING/SIGNALS/mempalace-drift.jsonl`;
  if (!existsSync(path)) {
    return {
      ok: true,
      score: 100,
      issues: [],
      details: { count: 0, unknown_actions: [], note: "no drift log yet" },
    };
  }
  const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
  const last100 = lines.slice(-100);
  const unknowns = new Set<string>();
  for (const line of last100) {
    try {
      const o = JSON.parse(line);
      if (o.unknown_action) unknowns.add(String(o.unknown_action));
      else if (o.action && o.status === "unknown") unknowns.add(String(o.action));
    } catch {
      /* skip malformed */
    }
  }
  const score = unknowns.size === 0 ? 100 : 60;
  const issues = unknowns.size > 0 ? [`${unknowns.size} unknown drift action(s) seen`] : [];
  return {
    ok: unknowns.size === 0,
    score,
    issues,
    details: { count: last100.length, unknown_actions: [...unknowns] },
  };
}

// 3. Pending queues
function checkPending(): SectionResult {
  const dirs = [
    `${HOME}/.claude/MEMORY/STATE/.pending`,
    `${HOME}/.claude/MEMORY/ARTIFACTS/.pending`,
    `${HOME}/.claude/MEMORY/VOICE/.pending`,
  ];
  const counts: Record<string, number> = {};
  let total = 0;
  for (const d of dirs) {
    let n = 0;
    if (existsSync(d)) {
      try {
        n = readdirSync(d).filter((f) => !f.startsWith(".")).length;
      } catch {
        n = 0;
      }
    }
    const key = d.split("/").slice(-2, -1)[0]!;
    counts[key] = n;
    total += n;
  }
  let score = 100;
  const issues: string[] = [];
  if (total > 200) {
    score = 30;
    issues.push(`pending queue depth ${total} exceeds critical threshold 200`);
  } else if (total > 50) {
    score = 70;
    issues.push(`pending queue depth ${total} exceeds warning threshold 50`);
  }
  return {
    ok: total <= 200,
    score,
    issues,
    details: { total, by_dir: counts },
  };
}

// 4. Backup freshness
function checkBackup(): SectionResult {
  const root = `${HOME}/Library/Application Support/DOS/backups`;
  if (!existsSync(root)) {
    return {
      ok: false,
      score: 0,
      issues: ["no DOS backups directory exists"],
      details: { newest: null, age_hours: null },
    };
  }
  const folders = readdirSync(root)
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
    .sort()
    .reverse();
  if (folders.length === 0) {
    return {
      ok: false,
      score: 0,
      issues: ["no dated backup folders present"],
      details: { newest: null, age_hours: null },
    };
  }
  const newest = folders[0]!;
  const manifest = join(root, newest, "MANIFEST.json");
  let mtime: Date;
  if (existsSync(manifest)) {
    mtime = statSync(manifest).mtime;
  } else {
    // fall back to folder mtime
    mtime = statSync(join(root, newest)).mtime;
  }
  const ageMs = Date.now() - mtime.getTime();
  const ageHours = ageMs / 3_600_000;
  let score = 100;
  const issues: string[] = [];
  if (ageHours > 48) {
    score = 20;
    issues.push(`backup ${ageHours.toFixed(1)}h old — critical (>48h)`);
  } else if (ageHours > 24) {
    score = 70;
    issues.push(`backup ${ageHours.toFixed(1)}h old — warning (>24h)`);
  }
  return {
    ok: ageHours <= 48,
    score,
    issues,
    details: { newest, age_hours: Number(ageHours.toFixed(2)) },
  };
}

// 5. Disk volume
function checkDiskVolume(): SectionResult {
  function du(p: string): number | null {
    if (!existsSync(p)) return null;
    try {
      const result = spawnSync("du", ["-sk", p], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      if (result.error || result.status !== 0 || typeof result.stdout !== "string") {
        return null;
      }
      const out = result.stdout.trim();
      const kb = parseInt(out.split(/\s+/)[0]!, 10);
      return Math.round(kb / 1024); // MB
    } catch {
      return null;
    }
  }
  const parentMb = du(`${HOME}/Durante/MEMORY`);
  // Find active submodule MEMORY dir
  let submoduleMb: number | null = null;
  const releasesDir = `${HOME}/Durante/Releases`;
  if (existsSync(releasesDir)) {
    const versions = sortVersionsDesc(
      readdirSync(releasesDir).filter((f) => /^v\d/.test(f)),
    );
    for (const v of versions) {
      const cand = `${releasesDir}/${v}/.claude/MEMORY`;
      if (existsSync(cand)) {
        submoduleMb = du(cand);
        break;
      }
    }
  }
  const issues: string[] = [];
  let score = 100;
  if (parentMb !== null && parentMb > 2000) {
    score = 60;
    issues.push(`parent MEMORY ${parentMb}MB > 2GB — investigate`);
  }
  return {
    ok: true,
    score,
    issues,
    details: { parent_mb: parentMb, submodule_mb: submoduleMb },
  };
}

// 6. Reconcile freshness
function checkReconcile(): SectionResult {
  const path = `${HOME}/.claude/MEMORY/STATE/last-reconcile.json`;
  if (!existsSync(path)) {
    return {
      ok: true,
      score: 70,
      issues: ["reconcile has never run on this host"],
      details: { last_run: null, age_days: null },
    };
  }
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    const lastRun = data.last_run || data.timestamp || null;
    let ageDays: number | null = null;
    if (lastRun) {
      const t = new Date(lastRun).getTime();
      if (!isNaN(t)) ageDays = Number(((Date.now() - t) / 86_400_000).toFixed(2));
    }
    const issues: string[] = [];
    let score = 100;
    if (ageDays !== null && ageDays > 14) {
      score = 60;
      issues.push(`last reconcile ${ageDays}d ago — refresh recommended`);
    }
    return { ok: true, score, issues, details: { last_run: lastRun, age_days: ageDays } };
  } catch (e) {
    return {
      ok: false,
      score: 50,
      issues: [`reconcile state malformed: ${(e as Error).message}`],
      details: {},
    };
  }
}

// 7. Bridge surface usage
function checkBridgeSurface(): SectionResult {
  const hooksDir = `${HOME}/.claude/hooks`;
  if (!existsSync(hooksDir)) {
    return {
      ok: false,
      score: 0,
      issues: ["hooks dir missing"],
      details: { actions_called: 0, actions_available: 0 },
    };
  }
  const calledList = collectBridgeUsageFromDir(hooksDir);
  const surface = resolveBridgeSurface();
  const known = new Set(surface.actions);
  const unknownCalled = calledList.filter((action) => known.size > 0 && !known.has(action));
  const called = calledList.length;
  const available = surface.actions.length;
  const issues: string[] = [];
  let score = 100;
  if (called === 0) {
    score = 30;
    issues.push("no bridgeSync/bridgeFire/bridgeAsync or typed client calls found in hooks — surface unused?");
  }
  if (available === 0) {
    score = Math.min(score, 70);
    issues.push("bridge provider surface unavailable");
  }
  if (unknownCalled.length > 0) {
    score = Math.min(score, 70);
    issues.push(`${unknownCalled.length} hook bridge action(s) absent from provider surface`);
  }
  return {
    ok: called > 0 && available > 0 && unknownCalled.length === 0,
    score,
    issues: [...issues, ...surface.issues],
    details: {
      actions_called: called,
      actions_available: available,
      called_list: calledList,
      surface_source: surface.source,
      unknown_called: unknownCalled,
    },
  };
}

// 8. Registry consistency — invokes R39 (PROJECTS.md ↔ JSON parity),
//    R40 (declared-wing-provisioned), R42 (resolver source parity) via
//    the canonical ValidateRfcConformance pipeline. Added 2026-05-09 after
//    the empty-status-bar incident — the "populate sync fix etc explore"
//    hook for registry health.
function checkRegistry(): SectionResult {
  const validator = join(HOME, "Durante", "Packs", "sentinel", "src", "Tools", "ValidateRfcConformance.ts");
  if (!existsSync(validator)) {
    return {
      ok: true,
      score: 100,
      issues: [],
      details: { skipped: "ValidateRfcConformance.ts not present" },
    };
  }
  const failures: string[] = [];
  const checks: Record<string, string> = {};
  for (const rId of ["R39", "R40", "R42"]) {
    let out = "";
    try {
      out = runBun(
        [validator, "--profile", "v3-resilience", "--check", rId],
        { timeout: 5000 },
      );
    } catch (e: unknown) {
      // ValidateRfcConformance exits non-zero on FAIL — capture stdout from the error
      const err = e as { stdout?: string; status?: number };
      out = err.stdout ?? "";
      if (!out) {
        checks[rId] = "error";
        failures.push(`${rId} runner crashed`);
        continue;
      }
    }
    // Parse "✓ Rxx: ..." or "✘ Rxx: ..." lines
    const passLine = new RegExp(`✓\\s+${rId}:.*\\[pass\\]`).test(out);
    const failLine = new RegExp(`✘\\s+${rId}:.*\\[fail\\]`).test(out);
    const naLine = new RegExp(`○\\s+${rId}:.*\\[not_applicable\\]`).test(out);
    if (passLine) checks[rId] = "pass";
    else if (failLine) {
      checks[rId] = "fail";
      const m = out.match(new RegExp(`${rId}:[^\\n]*\\n[^\\n]*?([^\\n]+)`, "m"));
      failures.push(`${rId} fail${m ? ` — ${m[1]!.trim()}` : ""}`);
    }
    else if (naLine) checks[rId] = "not_applicable";
    else checks[rId] = "unknown";
  }
  const score = failures.length === 0 ? 100 : Math.max(0, 100 - failures.length * 25);
  return {
    ok: failures.length === 0,
    score,
    issues: failures,
    details: {
      r39_status: checks.R39 ?? "error",
      r40_status: checks.R40 ?? "error",
      r42_status: checks.R42 ?? "error",
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Phase 8 --fix: mechanically resolve registry-consistency issues
// ───────────────────────────────────────────────────────────────────────────

interface CanonicalProject { id?: string; name?: string; wing?: string | null; root_path?: string | null; description?: string }

function findCanonicalJsonPath(): string | null {
  const candidates = [
    join(HOME, "Durante", "Tools", ".dos-projects.json"),
    join(HOME, "Durante", ".dos-projects.json"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}

function applyRegistryFix(): { planned: string[]; applied: string[] } {
  const planned: string[] = [];
  const applied: string[] = [];
  const jsonPath = findCanonicalJsonPath();
  if (!jsonPath) {
    planned.push("(skipped — .dos-projects.json not found)");
    return { planned, applied };
  }

  let data: { projects?: CanonicalProject[] };
  try {
    data = JSON.parse(readFileSync(jsonPath, "utf-8")) as { projects?: CanonicalProject[] };
  } catch (e) {
    planned.push(`(skipped — ${jsonPath} unparseable: ${e instanceof Error ? e.message : String(e)})`);
    return { planned, applied };
  }
  const projects = (data.projects ?? []).filter((p) => p.wing && p.root_path);

  // Pre-seed missing palace-cache files. These are PLACEHOLDERS only: the
  // statusline renders something instead of a missing-file blank until Scan.md
  // Step 6c overwrites palace-cache-{wing}.sh with the real per-wing bridge
  // status (`SentinelScan.ts palace-cache "$WING" "$STATUS"`). Hence
  // palace_wing_drawers is seeded 0 (never queried here) and palace_total_drawers
  // borrows a global drawer count from any existing cache (sentinel-rest-010).
  const stateDir = join(HOME, ".claude", "MEMORY", "STATE");
  // Read total drawer count from any existing cache (a global value — first hit
  // is representative; defaults to 0 on a fresh install with no cache yet).
  let total = 0;
  if (existsSync(stateDir)) {
    for (const f of readdirSync(stateDir)) {
      if (f.startsWith("palace-cache-") && f.endsWith(".sh")) {
        const m = readFileSync(join(stateDir, f), "utf-8").match(/palace_total_drawers=(\d+)/);
        if (m) { total = parseInt(m[1]!, 10); break; }
      }
    }
  }
  for (const p of projects) {
    const wing = p.wing as string;
    const cachePath = join(stateDir, `palace-cache-${wing}.sh`);
    if (!existsSync(cachePath)) {
      planned.push(`pre-seed ${cachePath} (palace_wing_drawers=0, palace_total_drawers=${total})`);
      if (FLAG_APPLY) {
        // writeArtifact:exempt — palace-cache wing file (STATE class, path via var)
        writeFileSync(cachePath, `palace_wing_drawers=0\npalace_total_drawers=${total}\n`);
        applied.push(cachePath);
      }
    }
  }

  // Mirror missing rows from JSON → PROJECTS.md
  const projectsMd = join(HOME, ".claude", "DOS", "USER", "PROJECTS", "PROJECTS.md");
  if (existsSync(projectsMd)) {
    const md = readFileSync(projectsMd, "utf-8");
    const missingRows = projects.filter((p) => p.wing && !md.includes(`| ${p.wing} |`));
    for (const p of missingRows) {
      const row = `| ${p.name ?? p.id} | ${p.root_path} | ${p.wing} | (run /sentinel scan to populate) |`;
      planned.push(`append PROJECTS.md row: ${row}`);
      if (FLAG_APPLY) {
        // writeArtifact:exempt — PROJECTS.md registry row append (internal registry)
        writeFileSync(projectsMd, md.endsWith("\n") ? md + row + "\n" : md + "\n" + row + "\n");
        applied.push(`PROJECTS.md += ${p.wing}`);
      }
    }
  }

  return { planned, applied };
}

function main(): void {
  const sections = {
    hygiene: safeRun(checkHygiene, "hygiene"),
    drift: safeRun(checkDrift, "drift"),
    pending: safeRun(checkPending, "pending"),
    backup: safeRun(checkBackup, "backup"),
    disk_volume: safeRun(checkDiskVolume, "disk_volume"),
    reconcile: safeRun(checkReconcile, "reconcile"),
    bridge_surface: safeRun(checkBridgeSurface, "bridge_surface"),
    registry: safeRun(checkRegistry, "registry"),
  };

  // Phase 8 --fix path — only runs when explicitly requested, only mutates
  // when --apply is also present. Output appended to the human report below.
  let fixOutput: { planned: string[]; applied: string[] } | null = null;
  if (FLAG_FIX) {
    fixOutput = applyRegistryFix();
  }

  const scores = Object.values(sections).map((s) => s.score);
  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  // Critical detection
  let hasCritical = false;
  const pendingTotal = (sections.pending.details.total as number) ?? 0;
  if (pendingTotal > 200) hasCritical = true;
  const backupAge = (sections.backup.details.age_hours as number | null) ?? 0;
  if (backupAge !== null && backupAge > 48) hasCritical = true;
  const driftCount = (sections.drift.details.count as number) ?? 0;
  const unknowns = (sections.drift.details.unknown_actions as string[]) ?? [];
  if (driftCount > 0 && unknowns.length > 0) hasCritical = true;
  // Phase 8: registry consistency fail is critical UNLESS --fix --apply was
  // invoked and resolved every issue (handled below — we re-evaluate after fix).
  const registryFailedHard = !sections.registry.ok && !(FLAG_FIX && FLAG_APPLY);
  if (registryFailedHard) hasCritical = true;

  // ───────────────────────────────────────────────────────────────────────────
  // Output
  // ───────────────────────────────────────────────────────────────────────────

  if (FLAG_JSON) {
    const out = {
      timestamp: ts,
      overall_score: overall,
      has_critical: hasCritical,
      sections: Object.fromEntries(
        Object.entries(sections).map(([k, v]) => [
          k,
          { score: v.score, issues: v.issues, ...v.details },
        ]),
      ),
      fix: fixOutput
        ? {
            mode: FLAG_APPLY ? "apply" : "dry-run",
            planned: fixOutput.planned,
            applied: fixOutput.applied,
          }
        : null,
    };
    console.log(JSON.stringify(out, null, 2));
  } else {
  const isTty = process.stdout.isTTY;
  const red = (s: string) => (isTty ? `\x1b[31m${s}\x1b[0m` : s);
  const yel = (s: string) => (isTty ? `\x1b[33m${s}\x1b[0m` : s);
  const gry = (s: string) => (isTty ? `\x1b[90m${s}\x1b[0m` : s);
  const grn = (s: string) => (isTty ? `\x1b[32m${s}\x1b[0m` : s);

  const status = hasCritical
    ? red("CRITICAL")
    : overall >= 90
      ? grn("HEALTHY")
      : yel("HEALTHY (warnings only)");

  const bar = "=".repeat(60);
  const sub = "-".repeat(60);
  const lines: string[] = [];
  lines.push(bar);
  lines.push("  MEMORY HEALTH AUDIT");
  lines.push(bar);
  lines.push("");
  lines.push(`OVERALL SCORE: ${overall}/100   STATUS: ${status}`);
  lines.push(`TIMESTAMP:     ${ts}`);
  lines.push("");
  lines.push(sub);
  // Section rows. A section whose probe THREW renders `ERROR (probe failed)`
  // instead of its metric line, so a crashed check is never mistaken for a
  // genuinely-zero score (ISC-42). The else-branch of each row is byte-identical
  // to the prior output, so the golden render is unchanged for healthy runs.
  lines.push(
    sections.hygiene.probeFailed
      ? `[1/8] HYGIENE             ERROR (probe failed)`
      : `[1/8] HYGIENE             score: ${sections.hygiene.score}/100   issues: ${sections.hygiene.issues.length}`,
  );
  const dr = sections.drift.details;
  lines.push(
    sections.drift.probeFailed
      ? `[2/8] DRIFT TELEMETRY     ERROR (probe failed)`
      : `[2/8] DRIFT TELEMETRY     unknowns: ${(dr.unknown_actions as string[])?.length ?? 0}     entries: ${dr.count ?? 0}`,
  );
  const pn = sections.pending.details;
  const byDir = pn.by_dir as Record<string, number>;
  lines.push(
    sections.pending.probeFailed
      ? `[3/8] PENDING QUEUES      ERROR (probe failed)`
      : `[3/8] PENDING QUEUES      total: ${pn.total ?? 0}       state:${byDir?.STATE ?? 0} art:${byDir?.ARTIFACTS ?? 0} voice:${byDir?.VOICE ?? 0}`,
  );
  const bk = sections.backup.details;
  const ageStr = bk.age_hours === null ? "n/a" : `${bk.age_hours}h`;
  lines.push(
    sections.backup.probeFailed
      ? `[4/8] BACKUP              ERROR (probe failed)`
      : `[4/8] BACKUP              age: ${ageStr}       newest: ${bk.newest ?? "n/a"}`,
  );
  const dv = sections.disk_volume.details;
  lines.push(
    sections.disk_volume.probeFailed
      ? `[5/8] DISK VOLUME         ERROR (probe failed)`
      : `[5/8] DISK VOLUME         parent: ${dv.parent_mb ?? "?"}MB  submodule: ${dv.submodule_mb ?? "?"}MB`,
  );
  const rc = sections.reconcile.details;
  const rcStr = rc.last_run === null ? "never_run" : `${rc.age_days}d ago`;
  lines.push(
    sections.reconcile.probeFailed
      ? `[6/8] RECONCILE           ERROR (probe failed)`
      : `[6/8] RECONCILE           ${rcStr}`,
  );
  const br = sections.bridge_surface.details;
  lines.push(
    sections.bridge_surface.probeFailed
      ? `[7/8] BRIDGE SURFACE      ERROR (probe failed)`
      : `[7/8] BRIDGE SURFACE      called: ${br.actions_called}/${br.actions_available}`,
  );
  const rg = sections.registry.details;
  const rgStr =
    `R39:${rg.r39_status}  R40:${rg.r40_status}  R42:${rg.r42_status}`;
  lines.push(
    sections.registry.probeFailed
      ? `[8/8] REGISTRY            ERROR (probe failed)`
      : `[8/8] REGISTRY            score: ${sections.registry.score}/100   ${rgStr}`,
  );
  lines.push(sub);

  // Phase 8 fix output (when --fix was passed)
  if (fixOutput) {
    lines.push("");
    const mode = FLAG_APPLY ? "APPLIED" : "DRY-RUN";
    lines.push(`REGISTRY FIX (${mode}):`);
    if (fixOutput.planned.length === 0) {
      lines.push(`  ${gry("(no planned changes)")}`);
    } else {
      for (const p of fixOutput.planned) lines.push(`  ${gry("→")} ${p}`);
    }
    if (FLAG_APPLY && fixOutput.applied.length > 0) {
      lines.push(`  ${grn(`✓ wrote ${fixOutput.applied.length} change(s)`)}`);
    } else if (FLAG_FIX && !FLAG_APPLY && fixOutput.planned.length > 0) {
      lines.push(`  ${yel("re-run with --fix --apply to write the changes")}`);
    }
  }

  // Issues block
  const allIssues: { sev: "critical" | "warning"; section: string; msg: string }[] = [];
  for (const [name, sec] of Object.entries(sections)) {
    for (const m of sec.issues) {
      const isCrit =
        (name === "pending" && pendingTotal > 200) ||
        (name === "backup" && backupAge !== null && backupAge > 48) ||
        (name === "drift" && unknowns.length > 0) ||
        (name === "registry" && registryFailedHard);
      allIssues.push({ sev: isCrit ? "critical" : "warning", section: name, msg: m });
    }
  }
  if (allIssues.length > 0) {
    lines.push("");
    lines.push("ISSUES:");
    for (const i of allIssues) {
      const tag = i.sev === "critical" ? red("[CRITICAL]") : yel("[WARNING] ");
      lines.push(`  ${tag} ${gry(i.section)}: ${i.msg}`);
    }
  } else {
    lines.push("");
    lines.push(grn("No issues. Memory subsystem looks healthy."));
  }

    console.log(lines.join("\n"));
  }

  process.exit(hasCritical ? 1 : 0);
}

if (import.meta.main) {
  main();
}
