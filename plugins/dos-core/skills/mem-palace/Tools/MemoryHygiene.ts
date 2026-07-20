#!/usr/bin/env bun
/**
 * MemoryHygiene.ts - Weekly Memory Health Analysis
 *
 * PURPOSE:
 * Analyzes memory state across all systems to detect:
 * - Stale KG facts that may no longer be true
 * - Missing context (gaps) from algorithm reflections
 * - Duplicate entries across systems
 * - Rating patterns indicating systematic issues
 * - Orphaned wings or inconsistent naming
 *
 * USAGE:
 *   bun MemoryHygiene.ts                  # Full report
 *   bun MemoryHygiene.ts --json           # JSON output for dashboards
 *   bun MemoryHygiene.ts --reconcile      # fire KG reconcile + persist log
 *   bun MemoryHygiene.ts --repair         # rebuild HNSW vector index (destructive)
 *
 * DESIGNED FOR: Manual invocation or weekly cron schedule
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { execSync } from "child_process";

const DOS_DIR = process.env.DOS_DIR || join(homedir(), ".claude");
const BRIDGE_PATH = join(DOS_DIR, "DOS", "Tools", "mempalace_bridge.py");
const MEMORY_DIR = join(DOS_DIR, "MEMORY");
const REFLECTIONS_FILE = join(
  MEMORY_DIR,
  "LEARNING",
  "REFLECTIONS",
  "algorithm-reflections.jsonl"
);
const RATINGS_FILE = join(MEMORY_DIR, "LEARNING", "SIGNALS", "ratings.jsonl");
const HARVEST_LOG = join(MEMORY_DIR, "STATE", "memory-harvest-last.json");

const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes("--json");
const AUTO_FIX = args.includes("--fix");
const RUN_RECONCILE = args.includes("--reconcile");
const RUN_REPAIR = args.includes("--repair");
const STATE_DIR = join(MEMORY_DIR, "STATE");
const RECONCILE_LOG = join(STATE_DIR, "last-reconcile.json");
const REPAIR_LOG = join(STATE_DIR, "last-repair.json");
const MEMPALACE_ERRORS_FILE = join(STATE_DIR, "mempalace-errors.jsonl");

interface HealthIssue {
  severity: "critical" | "warning" | "info";
  category: "staleness" | "gap" | "duplicate" | "inconsistency" | "health";
  description: string;
  action?: string;
  auto_fixable: boolean;
}

interface HealthReport {
  timestamp: string;
  overall_score: number; // 0-100
  issues: HealthIssue[];
  stats: {
    total_drawers: number;
    total_kg_facts: number;
    total_ratings: number;
    total_reflections: number;
    wings: Record<string, number>;
    last_harvest?: string;
    harvest_extractions?: number;
  };
}

/**
 * Call bridge and parse JSON result.
 */
function bridge(action: string, args: Record<string, unknown> = {}): any {
  try {
    // shell-safe: args single-quote-escaped inline (replace(/'/g, ...))
    const result = execSync(
      `uv run --with 'mempalace>=3.4.1,<4' python "${BRIDGE_PATH}" ${action} '${JSON.stringify(args).replace(/'/g, "'\\''")}'`,
      { encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] }
    );
    return JSON.parse(result);
  } catch {
    return null;
  }
}

/**
 * Check 1: KG Fact Staleness
 * Look for facts that are old and may be outdated.
 */
function checkStaleness(issues: HealthIssue[]): void {
  const timeline = bridge("kg_timeline", {});
  if (!timeline?.timeline) return;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const fact of timeline.timeline) {
    if (!fact.current) continue;

    // Check facts about versions (these go stale fastest)
    if (
      fact.predicate === "current_version" &&
      fact.valid_from
    ) {
      const factDate = new Date(fact.valid_from);
      if (factDate < thirtyDaysAgo) {
        issues.push({
          severity: "warning",
          category: "staleness",
          description: `KG fact "${fact.subject} → ${fact.predicate} → ${fact.object}" is ${Math.floor((now.getTime() - factDate.getTime()) / 86400000)} days old`,
          action: `Verify: is "${fact.object}" still the current version of ${fact.subject}?`,
          auto_fixable: false,
        });
      }
    }

    // Check facts about goals with deadlines
    if (fact.predicate === "goal" && typeof fact.object === "string" && fact.object.includes("by ")) {
      // Extract date from goal text like "1 reference customer in 3 months (by July 2026)"
      const dateMatch = fact.object.match(
        /by\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i
      );
      if (dateMatch) {
        const months = [
          "january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december",
        ];
        const goalMonth = months.indexOf(dateMatch[1].toLowerCase());
        const goalYear = parseInt(dateMatch[2]);
        const goalDate = new Date(goalYear, goalMonth + 1, 0); // End of month

        if (now > goalDate) {
          issues.push({
            severity: "critical",
            category: "staleness",
            description: `Goal deadline passed: "${fact.subject} → ${fact.object}"`,
            action: `Update goal status — was this achieved? Invalidate or update the fact.`,
            auto_fixable: false,
          });
        } else {
          const daysLeft = Math.floor(
            (goalDate.getTime() - now.getTime()) / 86400000
          );
          if (daysLeft <= 30) {
            issues.push({
              severity: "info",
              category: "health",
              description: `Goal deadline in ${daysLeft} days: "${fact.object}"`,
              auto_fixable: false,
            });
          }
        }
      }
    }
  }
}

/**
 * Check 2: Algorithm Reflections for "should have known" patterns
 */
function checkReflectionGaps(issues: HealthIssue[]): void {
  if (!existsSync(REFLECTIONS_FILE)) return;

  try {
    const content = readFileSync(REFLECTIONS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Look at last 10 reflections
    const recent = lines.slice(-10);
    const gaps: string[] = [];

    for (const line of recent) {
      try {
        const reflection = JSON.parse(line);
        // Q3 is "What capabilities should I have used that I didn't?"
        if (reflection.reflection_q3 && reflection.reflection_q3.length > 20) {
          gaps.push(reflection.reflection_q3);
        }
        // Q1 is "What should I have done differently?"
        if (reflection.reflection_q1 && reflection.reflection_q1.includes("should have")) {
          gaps.push(reflection.reflection_q1);
        }
      } catch {
        // Skip malformed
      }
    }

    if (gaps.length > 0) {
      // Deduplicate similar gaps
      const uniqueGaps = [...new Set(gaps)].slice(0, 5);
      for (const gap of uniqueGaps) {
        issues.push({
          severity: "info",
          category: "gap",
          description: `Reflection gap: "${gap.slice(0, 120)}"`,
          action: "Consider adding this knowledge to MemPalace or auto-memory",
          auto_fixable: false,
        });
      }
    }
  } catch {
    // Non-critical
  }
}

/**
 * Check 3: Rating patterns indicating systematic issues
 */
function checkRatingPatterns(issues: HealthIssue[]): void {
  if (!existsSync(RATINGS_FILE)) return;

  try {
    const content = readFileSync(RATINGS_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    let weekRatings: number[] = [];
    let lowRatingCount = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const ts = new Date(entry.timestamp).getTime();
        if (ts > weekAgo && entry.rating != null) {
          weekRatings.push(entry.rating);
          if (entry.rating <= 4) lowRatingCount++;
        }
      } catch {
        // Skip
      }
    }

    if (weekRatings.length >= 5) {
      const avg =
        weekRatings.reduce((a, b) => a + b, 0) / weekRatings.length;

      if (avg < 5) {
        issues.push({
          severity: "critical",
          category: "health",
          description: `Weekly rating average is ${avg.toFixed(1)}/10 (${weekRatings.length} ratings, ${lowRatingCount} ≤4)`,
          action: "Review low-rated sessions for systematic context gaps",
          auto_fixable: false,
        });
      } else if (avg < 7) {
        issues.push({
          severity: "warning",
          category: "health",
          description: `Weekly rating average is ${avg.toFixed(1)}/10 — room for improvement`,
          auto_fixable: false,
        });
      }

      if (lowRatingCount >= 3) {
        issues.push({
          severity: "warning",
          category: "gap",
          description: `${lowRatingCount} low ratings (≤4) this week — possible systematic context gap`,
          action: "Check LEARNING/FAILURES/ for common patterns across low-rated sessions",
          auto_fixable: false,
        });
      }
    }
  } catch {
    // Non-critical
  }
}

/**
 * Check 4: Wing consistency and naming
 */
function checkWingConsistency(issues: HealthIssue[]): void {
  const status = bridge("status");
  if (!status?.wings) return;

  const wings = Object.keys(status.wings);

  // Check for wing_ prefix inconsistency
  const prefixed = wings.filter((w) => w.startsWith("wing_"));
  if (prefixed.length > 0) {
    for (const w of prefixed) {
      const canonical = w.replace("wing_", "");
      issues.push({
        severity: "warning",
        category: "inconsistency",
        description: `Wing "${w}" uses deprecated wing_ prefix${wings.includes(canonical) ? ` (canonical "${canonical}" also exists — MERGE NEEDED)` : ""}`,
        action: `Run: python3 migrate-wings.py --confirm`,
        auto_fixable: true,
      });
    }
  }

  // Check for very small wings (may be accidental)
  for (const [wing, count] of Object.entries(status.wings)) {
    if (typeof count === "number" && count <= 1 && !["user", "ratings"].includes(wing)) {
      issues.push({
        severity: "info",
        category: "inconsistency",
        description: `Wing "${wing}" has only ${count} drawer(s) — may be accidental`,
        auto_fixable: false,
      });
    }
  }
}

/**
 * Check 5: Harvest pipeline health
 */
function checkHarvestHealth(issues: HealthIssue[]): void {
  if (!existsSync(HARVEST_LOG)) {
    issues.push({
      severity: "info",
      category: "health",
      description: "MemoryHarvest has never run — hook may not be registered",
      action: "Check settings.json for MemoryHarvest.hook.ts in SessionEnd hooks",
      auto_fixable: false,
    });
    return;
  }

  try {
    const lastHarvest = JSON.parse(readFileSync(HARVEST_LOG, "utf-8"));
    const harvestAge =
      Date.now() - new Date(lastHarvest.timestamp).getTime();
    const harvestDays = Math.floor(harvestAge / 86400000);

    if (harvestDays > 7) {
      issues.push({
        severity: "warning",
        category: "health",
        description: `Last MemoryHarvest was ${harvestDays} days ago`,
        action: "Ensure MemoryHarvest.hook.ts is registered at SessionEnd",
        auto_fixable: false,
      });
    }
  } catch {
    // Non-critical
  }
}

/**
 * Check 6.5: Reconcile freshness
 *
 * Bridge action `reconcile` walks the KG to detect duplicate near-equivalent
 * entities and stale facts. The post-tragedy audit (2026-05-04) found
 * production was running ZERO reconciliations — drift accumulates monotonically.
 * This check surfaces age of last reconciliation; with --reconcile it fires
 * the action eagerly and persists the result to MEMORY/STATE/last-reconcile.json.
 */
function checkReconcile(issues: HealthIssue[]): void {
  let lastTs: number | null = null;
  if (existsSync(RECONCILE_LOG)) {
    try {
      const log = JSON.parse(readFileSync(RECONCILE_LOG, "utf-8"));
      lastTs = new Date(log.timestamp).getTime();
    } catch {
      // ignore parse error — treat as never run
    }
  }

  if (RUN_RECONCILE) {
    const result = bridge("reconcile", {});
    const ts = new Date().toISOString();
    const summary = {
      timestamp: ts,
      ok: !!result,
      result: result ?? { error: "bridge call returned null" },
    };
    try {
      const fs = require("fs") as any;
      if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
      // writeArtifact:exempt — reconcile log under MEMORY/STATE (path via const)
      fs.writeFileSync(RECONCILE_LOG, JSON.stringify(summary, null, 2));
    } catch {
      // log-write failures are advisory; don't break the run
    }
    if (!result) {
      issues.push({
        severity: "warning",
        category: "health",
        description: "Reconcile bridge call returned null — KG may be unreachable",
        action: "Check bridge with: uv run --with 'mempalace>=3.4.1,<4' python ~/.claude/DOS/Tools/mempalace_bridge.py status",
        auto_fixable: false,
      });
    }
    return;
  }

  if (lastTs === null) {
    issues.push({
      severity: "warning",
      category: "health",
      description: "Reconcile has never run on this install — KG drift accumulates monotonically",
      action: "Run: bun MemoryHygiene.ts --reconcile",
      auto_fixable: true,
    });
    return;
  }

  const ageDays = Math.floor((Date.now() - lastTs) / 86_400_000);
  if (ageDays >= 14) {
    issues.push({
      severity: "warning",
      category: "health",
      description: `Last reconcile was ${ageDays} days ago — recommend weekly cadence`,
      action: "Run: bun MemoryHygiene.ts --reconcile",
      auto_fixable: true,
    });
  } else if (ageDays >= 7) {
    issues.push({
      severity: "info",
      category: "health",
      description: `Last reconcile was ${ageDays} days ago`,
      auto_fixable: false,
    });
  }
}

/**
 * Check 6.6: Bridge health — scan mempalace-errors.jsonl for SIGSEGV / HNSW
 * corruption signals over the last 24h. Upstream mempalace 3.3.4+ proactively
 * quarantines stale HNSW state in `_client()` (PR #1322), but this check
 * catches OTHER corruption modes and is the surface for `--repair`.
 *
 * With `--repair`: invokes `mempalace repair` directly (creates a backup at
 * <palace>.backup before rebuilding the vector index from stored data).
 * MUTUALLY EXCLUSIVE with active mining — do not run while mine_convos /
 * mine_file is in flight.
 */
function checkBridgeHealth(issues: HealthIssue[]): void {
  if (RUN_REPAIR) {
    const t0 = Date.now();
    try {
      const out = execSync(
        `uv run --with 'mempalace>=3.4.1,<4' mempalace repair`,
        { encoding: "utf-8", timeout: 600_000, stdio: ["pipe", "pipe", "pipe"] },
      );
      const summary = {
        timestamp: new Date().toISOString(),
        ok: true,
        durationMs: Date.now() - t0,
        output: out.trim().slice(0, 2000),
      };
      try {
        const fs = require("fs") as any;
        if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
        // writeArtifact:exempt — repair log under MEMORY/STATE (path via const)
        fs.writeFileSync(REPAIR_LOG, JSON.stringify(summary, null, 2));
      } catch { /* log-write failures are advisory */ }
      issues.push({
        severity: "info",
        category: "health",
        description: `mempalace repair completed in ${Math.round((Date.now() - t0) / 1000)}s`,
        auto_fixable: false,
      });
    } catch (err: any) {
      const stderr = err?.stderr?.toString?.() || "";
      const stdout = err?.stdout?.toString?.() || "";
      issues.push({
        severity: "critical",
        category: "health",
        description: `mempalace repair FAILED: ${(stderr || stdout || String(err)).slice(0, 200)}`,
        action: `Inspect ${MEMPALACE_ERRORS_FILE} and try manual: uv run --with 'mempalace>=3.4.1,<4' mempalace repair`,
        auto_fixable: false,
      });
    }
    return;
  }

  if (!existsSync(MEMPALACE_ERRORS_FILE)) return;

  let lines: string[];
  try {
    lines = readFileSync(MEMPALACE_ERRORS_FILE, "utf-8").trim().split("\n").filter(Boolean);
  } catch { return; }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent: Record<string, unknown>[] = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      const tsStr = (e as any).timestamp || (e as any).ts || (e as any).time;
      const ts = tsStr ? new Date(tsStr).getTime() : 0;
      if (ts >= cutoff) recent.push(e);
    } catch { /* skip malformed line */ }
  }

  const corruptionRe = /sigsegv|segfault|segmentation fault|hnsw|index.*corrupt|stale.*index/i;
  const corrupted = recent.filter(e => corruptionRe.test(JSON.stringify(e)));

  if (corrupted.length > 0) {
    issues.push({
      severity: "critical",
      category: "health",
      description: `${corrupted.length} HNSW/segfault signal(s) in mempalace-errors.jsonl over last 24h — vector index may be corrupt`,
      action: "Run: bun MemoryHygiene.ts --repair (auto-backs up palace at <palace>.backup before rebuild)",
      auto_fixable: AUTO_FIX,
    });
    if (AUTO_FIX) {
      // AUTO_FIX semantics: surface the issue, don't silently invoke repair.
      // Repair is destructive enough (locks chromadb, rebuilds index) that
      // it deserves an explicit --repair flag rather than --fix piggyback.
      issues.push({
        severity: "info",
        category: "health",
        description: "--fix detected but repair is gated behind --repair (destructive op). Run --repair explicitly.",
        auto_fixable: false,
      });
    }
  } else if (recent.length > 50) {
    issues.push({
      severity: "warning",
      category: "health",
      description: `${recent.length} bridge errors logged in last 24h (no segfaults detected)`,
      action: `Inspect ${MEMPALACE_ERRORS_FILE} for patterns`,
      auto_fixable: false,
    });
  }
}

/**
 * Check 7: Duplicate KG entities
 */
function checkDuplicateEntities(issues: HealthIssue[]): void {
  const stats = bridge("kg_timeline");
  if (!stats?.timeline) return;

  // Group by normalized subject
  const entityMap: Record<string, string[]> = {};
  for (const fact of stats.timeline) {
    if (typeof fact.subject !== "string") continue;
    const normalized = fact.subject.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!entityMap[normalized]) entityMap[normalized] = [];
    if (!entityMap[normalized].includes(fact.subject)) {
      entityMap[normalized].push(fact.subject);
    }
  }

  for (const [, variants] of Object.entries(entityMap)) {
    if (variants.length > 1) {
      issues.push({
        severity: "warning",
        category: "duplicate",
        description: `Possible duplicate KG entities: ${variants.map((v) => `"${v}"`).join(", ")}`,
        action: `Merge into a single canonical entity name`,
        auto_fixable: false,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────

async function main() {
  const issues: HealthIssue[] = [];

  if (!existsSync(BRIDGE_PATH)) {
    console.error("MemPalace bridge not found at", BRIDGE_PATH);
    process.exit(1);
  }

  // Get baseline stats
  const status = bridge("status");
  const kgStats = bridge("kg_timeline");

  // MP-026/MP-029: bridge() returns null on timeout/error/parse-failure. When the
  // baseline status probe is null the palace is unreachable/degraded — every
  // dependent check early-returns without pushing an issue, so a fully-down
  // palace would otherwise score ~100 '✅ healthy'. Surface it as critical and
  // floor the score so absence of data is never reported as health.
  const bridgeUnreachable = status === null;
  if (bridgeUnreachable) {
    issues.push({
      severity: "critical",
      category: "health",
      description: "MemPalace bridge unreachable — health unknown (status() returned null)",
      action: "Check bridge with: uv run --with 'mempalace>=3.4.1,<4' python ~/.claude/DOS/Tools/mempalace_bridge.py status",
      auto_fixable: false,
    });
  }

  const stats = {
    total_drawers: status?.total_drawers || 0,
    total_kg_facts: kgStats?.count || 0,
    total_ratings: 0,
    total_reflections: 0,
    wings: {} as Record<string, number>,
    last_harvest: undefined as string | undefined,
    harvest_extractions: undefined as number | undefined,
  };

  if (status?.wings) {
    for (const [wing, val] of Object.entries(status.wings)) {
      stats.wings[wing] = typeof val === "number" ? val : (val as any)?.total || 0;
    }
  }

  if (existsSync(RATINGS_FILE)) {
    stats.total_ratings = readFileSync(RATINGS_FILE, "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean).length;
  }

  if (existsSync(REFLECTIONS_FILE)) {
    stats.total_reflections = readFileSync(REFLECTIONS_FILE, "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean).length;
  }

  if (existsSync(HARVEST_LOG)) {
    try {
      const h = JSON.parse(readFileSync(HARVEST_LOG, "utf-8"));
      stats.last_harvest = h.timestamp;
      stats.harvest_extractions = h.extractions_filed;
    } catch {}
  }

  // Run all checks
  console.error("Running memory hygiene checks...\n");
  checkStaleness(issues);
  checkReflectionGaps(issues);
  checkRatingPatterns(issues);
  checkWingConsistency(issues);
  checkHarvestHealth(issues);
  checkReconcile(issues);
  checkBridgeHealth(issues);
  checkDuplicateEntities(issues);

  // Calculate health score
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "critical") score -= 15;
    else if (issue.severity === "warning") score -= 5;
    else score -= 1;
  }
  // MP-026/MP-029: when the bridge is unreachable, no per-issue decrement can
  // express 'health unknown' — floor the score to 0 so a green dashboard can
  // never be shown during a total outage.
  if (bridgeUnreachable) score = 0;
  score = Math.max(0, score);

  const report: HealthReport = {
    timestamp: new Date().toISOString(),
    overall_score: score,
    issues,
    stats,
  };

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    // Human-readable output
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║     MEMORY HYGIENE REPORT                ║`);
    console.log(`╠══════════════════════════════════════════╣`);
    console.log(`║  Health Score: ${score}/100 ${score >= 80 ? "✅" : score >= 60 ? "⚠️" : "❌"}                    ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);

    console.log(`📊 Stats:`);
    console.log(`   Palace: ${stats.total_drawers} drawers across ${Object.keys(stats.wings).length} wings`);
    console.log(`   KG: ${stats.total_kg_facts} facts`);
    console.log(`   Ratings: ${stats.total_ratings} total`);
    console.log(`   Reflections: ${stats.total_reflections} total`);
    if (stats.last_harvest) {
      console.log(`   Last harvest: ${stats.last_harvest} (${stats.harvest_extractions} extractions)`);
    }
    console.log();

    if (issues.length === 0) {
      console.log("✅ No issues found — memory is healthy!\n");
    } else {
      const critical = issues.filter((i) => i.severity === "critical");
      const warnings = issues.filter((i) => i.severity === "warning");
      const infos = issues.filter((i) => i.severity === "info");

      if (critical.length > 0) {
        console.log(`❌ CRITICAL (${critical.length}):`);
        for (const i of critical) {
          console.log(`   • ${i.description}`);
          if (i.action) console.log(`     → ${i.action}`);
        }
        console.log();
      }

      if (warnings.length > 0) {
        console.log(`⚠️  WARNINGS (${warnings.length}):`);
        for (const i of warnings) {
          console.log(`   • ${i.description}`);
          if (i.action) console.log(`     → ${i.action}`);
        }
        console.log();
      }

      if (infos.length > 0) {
        console.log(`ℹ️  INFO (${infos.length}):`);
        for (const i of infos) {
          console.log(`   • ${i.description}`);
          if (i.action) console.log(`     → ${i.action}`);
        }
        console.log();
      }
    }
  }
}

main().catch((err) => {
  console.error("MemoryHygiene fatal:", err);
  process.exit(1);
});
