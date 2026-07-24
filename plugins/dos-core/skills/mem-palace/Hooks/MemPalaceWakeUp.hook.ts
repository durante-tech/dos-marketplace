#!/usr/bin/env bun
/**
 * MemPalaceWakeUp.hook.ts - Inject Palace Context at Session Start (SessionStart)
 *
 * PURPOSE:
 * At session start, injects memory context into the session.
 *
 * DAEMON ENSURE-THEN-QUERY (v0.0.20 lifecycle refactor):
 * This hook now performs the MemPalace daemon-ensure step FIRST (via
 * ensureDaemon() from lib/mempalace-daemon-ensure), THEN its live-KG queries.
 * It SUBSUMES the standalone MemPalaceDaemonEnsure.hook.ts at SessionStart:
 * because SessionStart hooks run in PARALLEL, a separate ensure hook could not
 * guarantee it warmed the daemon before this hook's 200ms-budget
 * kg_query_predicate calls raced a cold one (the operator-visible "degraded
 * snapshot / live-KG read timed out" banner). The orchestrator de-registers
 * MemPalaceDaemonEnsure from SessionStart; that file stays on disk + functional
 * standalone. ensureDaemon is bounded (DOS_DAEMON_ENSURE_CAP_MS) + fail-open.
 *
 * PRIORITY ORDER (PRD-H / v0.0.16, Foundation-First per Amendment F):
 * 1. Live KG synthesis — primary path. Parallel kg_query_predicate calls for
 *    `worked_on` / `decided` / `learned` (last 24h, scoped to wing) plus active
 *    PRD scan. Synthesized "Last Session" block is bound to facts actually
 *    written on this machine, independent of WORK/ archival state and
 *    independent of whether the producer hook fired at session boundaries.
 * 2. Cached snapshot — graceful fallback when live KG fails (bridge missing,
 *    timeout, palace unavailable, or zero facts across all three predicates).
 *    Wrapped with a degraded-state prefix so the operator can see the source.
 * 3. ChromaDB L0+L1 wake_up — last-resort fallback (unchanged behavior).
 *
 * RATIONALE (PRD-H, 2026-05-13):
 * SessionContextSnapshot generated stale "Last Session" content during the
 * v0.0.15 closure session because all 5 closure PRDs were archived out of
 * MEMORY/WORK/active/ BEFORE SessionEnd fired. The snapshot's mtime-based
 * freshness check cannot catch content staleness when the producer's read
 * window has been emptied. The class is eliminated at the read site by
 * querying live KG directly. See PRD at
 * MEMORY/WORK/active/20260513-183742_v0016-sessionstart-memory-freshness-fix/.
 *
 * TRIGGER: SessionStart
 *
 * OUTPUT:
 * - stdout: Context text (injected into session by Claude Code)
 * - exit(0): Always
 */

import { readFileSync, existsSync, statSync, readdirSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { resolveProjectWingFromEnv } from "./lib/project-resolver";
import { isTerminalPhase } from "./lib/tab-constants";
import { BRIDGE_PATH, bridgeSync, bridgeAsync } from "./lib/mempalace";
import { getWorkDir, loadProjectEnv, getMemorySubdir } from "./lib/paths";

loadProjectEnv();
import { startTimer, stopTimer } from './lib/hook-io';
import { filterFactsByRecency } from "./lib/wakeup-recency";
import { ensureDaemon, type EnsureOptions, type EnsureResult } from './lib/mempalace-daemon-ensure';

const DOS_DIR = process.env.DOS_DIR || join(homedir(), ".claude");
const MEMPALACE_DIR = process.env.MEMPALACE_DIR || join(homedir(), ".mempalace");
const SNAPSHOT_FRESH_AGE = 2 * 60 * 60 * 1000;  // 2 hours — inject without warning
const SNAPSHOT_STALE_AGE = 6 * 60 * 60 * 1000;  // 6 hours — inject with staleness warning
// Over 6h → fall back to ChromaDB (unchanged behavior)

function getSnapshotPath(wing: string | null): string {
  const suffix = wing || "global";
  return join(DOS_DIR, "MEMORY", "STATE", `next-session-context-${suffix}.md`);
}

function trySnapshot(wing: string | null): string | null {
  const snapshotPath = getSnapshotPath(wing);
  try {
    if (!existsSync(snapshotPath)) return null;

    const stat = statSync(snapshotPath);
    const age = Date.now() - stat.mtimeMs;

    if (age > SNAPSHOT_STALE_AGE) {
      const ageHours = (age / 3600000).toFixed(1);
      console.error(`[MemPalaceWakeUp] Snapshot too old (${ageHours}h > 6h limit), falling back to ChromaDB`);
      return null;
    }

    let content = readFileSync(snapshotPath, "utf-8").trim();
    if (!content || content.length < 50) return null;

    // Add staleness warning for snapshots between 2-6h old
    if (age > SNAPSHOT_FRESH_AGE) {
      const ageHours = (age / 3600000).toFixed(1);
      content = `> **Note:** This snapshot was generated ${ageHours}h ago and may not reflect recent work.\n\n${content}`;
      console.error(`[MemPalaceWakeUp] Snapshot is stale (${ageHours}h old) — injecting with warning`);
    } else {
      console.error(`[MemPalaceWakeUp] Using fresh snapshot for ${wing || 'global'} (${Math.round(age / 60000)}min old, ${content.length} chars)`);
    }

    // ─── Validate working_on facts against PRD state ────────
    // Cross-check working_on lines against WORK/ PRDs to detect completed tasks.
    // RFC-0027 §5.3: use getWorkDir() (project-aware resolution) instead of a
    // hardcoded DOS_DIR path so cross-project sessions don't leak Durante PRDs.
    try {
      const workDir = getWorkDir();
      if (existsSync(workDir)) {
        const workingOnRegex = /^.*working_on[:\s]+(.+)$/gim;
        let match: RegExpExecArray | null;
        const staleAnnotations: Array<{ original: string; annotated: string }> = [];

        while ((match = workingOnRegex.exec(content)) !== null) {
          const taskName = match[1].trim().replace(/[_\s*()\[\]`]/g, ' ').toLowerCase();
          if (!taskName || taskName.length < 5) continue;

          // Search WORK/ dirs for matching PRD
          try {
            const workDirs = readdirSync(workDir, { withFileTypes: true })
              .filter(d => d.isDirectory())
              .map(d => d.name)
              .sort()
              .reverse()
              .slice(0, 30);

            for (const dirName of workDirs) {
              // Match by slug similarity: dir slug contains key words from task name
              const dirSlug = dirName.replace(/^\d{8}-\d{6}_/, '').replace(/-/g, ' ').toLowerCase();
              const taskWords = taskName.split(/\s+/).filter(w => w.length > 3);
              const matchCount = taskWords.filter(w => dirSlug.includes(w)).length;

              if (matchCount < 2 && taskWords.length >= 2) continue;
              if (matchCount < 1) continue;

              const prdPath = join(workDir, dirName, "PRD.md");
              if (!existsSync(prdPath)) continue;

              // Read only frontmatter (first 400 chars) to check phase.
              // RFC-0027 §5.3: read DOS PRD `phase:` field (canonical per
              // RFC-0005 §13.1 R5). Variable renamed phaseMatch (was
              // statusMatch — misleading; the regex always targeted phase).
              try {
                const prdHead = readFileSync(prdPath, "utf-8").substring(0, 400);
                const phaseMatch = prdHead.match(/^phase:\s*"?(\w+)"?/m);
                if (phaseMatch && isTerminalPhase(phaseMatch[1])) {
                  staleAnnotations.push({
                    original: match[0],
                    annotated: match[0] + " [COMPLETED — this fact is stale]",
                  });
                  break; // Found matching completed PRD, no need to check more dirs
                }
              } catch { /* skip unreadable PRD */ }
            }
          } catch { /* skip WORK/ scan errors */ }
        }

        // Apply stale annotations to content
        for (const { original, annotated } of staleAnnotations) {
          content = content.replace(original, annotated);
        }
        if (staleAnnotations.length > 0) {
          console.error(`[MemPalaceWakeUp] Marked ${staleAnnotations.length} working_on fact(s) as stale (PRD completed)`);
        }
      }
    } catch (err) {
      console.error(`[MemPalaceWakeUp] working_on validation failed (non-fatal): ${err}`);
    }

    return content;
  } catch {
    return null;
  }
}

/**
 * Format a timestamp into a human-readable age string.
 * e.g. "3 days ago", "2 hours ago", "just now"
 */
function formatAge(ts: string): string {
  try {
    const ms = Date.now() - new Date(ts).getTime();
    if (ms < 0) return "just now";
    const minutes = Math.floor(ms / 60000);
    if (minutes < 2) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

/**
 * Query KG for the most recent compacted_with_digest fact for this wing.
 * Runs in parallel with snapshot load. Returns a single display line or null.
 * Falls back silently on any error or missing data (ISC-M3.3).
 */
async function queryLastCompaction(wing: string | null): Promise<string | null> {
  if (!existsSync(BRIDGE_PATH) || !existsSync(join(MEMPALACE_DIR, "palace"))) {
    return null;
  }
  try {
    const args: Record<string, unknown> = { predicate: "compacted_with_digest" };
    if (wing) args.wing = wing;
    const result = await bridgeAsync("kg_query_predicate", args, 3000);
    if (!result.ok) return null;

    type KgFact = { subject?: string; predicate?: string; object?: string; created_at?: string; ts?: string; current?: boolean };
    const facts = ((result.data.facts || []) as KgFact[]).filter(
      (f) => f.current !== false && f.object,
    );
    if (facts.length === 0) return null;

    // Sort descending by timestamp to get most recent first
    facts.sort((a, b) => {
      const ta = a.created_at || a.ts || "";
      const tb = b.created_at || b.ts || "";
      return tb.localeCompare(ta);
    });

    const latest = facts[0];
    if (!latest?.object) return null;

    const age = (latest.created_at || latest.ts) ? formatAge(latest.created_at || latest.ts || "") : "";
    return age
      ? `\u{1F9E0} Last compaction: ${latest.object} (${age})`
      : `\u{1F9E0} Last compaction: ${latest.object}`;
  } catch {
    // Silent fallback per ISC-M3.3
    return null;
  }
}

/**
 * Count PRD files in WORK/ that have not been indexed by mine-historical-prds.
 * Fires a kg_query_predicate for 'mined_from_file' and computes backlog.
 * Returns a notice string when backlog exceeds 50; null otherwise (ISC-M5.1/M5.2).
 * Falls back silently on any failure.
 */
async function checkPRDBacklog(wing: string | null): Promise<string | null> {
  if (!existsSync(BRIDGE_PATH) || !existsSync(join(MEMPALACE_DIR, "palace"))) {
    return null;
  }
  try {
    const workDir = getWorkDir();
    if (!existsSync(workDir)) return null;

    // MP-TS-05: count PRDs across all three depths after the WORK active/archived
    // migration (CLAUDE.md "active/archived structural split"). The old one-level
    // scan missed the hot PRDs in active/ and cold ones in archived/, undercounting
    // totalPRDs so the >50 backlog notice under-fired. Mirrors the candidate-dir
    // scan in MemPalacePreCompact.daemon (MP-015). Flat scan never double-counts
    // the active/archived bucket dirs — they hold slug subdirs, not a direct PRD.md.
    let totalPRDs = 0;
    try {
      const candidateDirs = [workDir];
      for (const bucket of ["active", "archived"]) {
        const bucketDir = join(workDir, bucket);
        try {
          if (statSync(bucketDir).isDirectory()) candidateDirs.push(bucketDir);
        } catch {}
      }
      for (const baseDir of candidateDirs) {
        for (const d of readdirSync(baseDir, { withFileTypes: true })) {
          if (d.isDirectory() && existsSync(join(baseDir, d.name, "PRD.md"))) {
            totalPRDs++;
          }
        }
      }
    } catch { return null; }

    if (totalPRDs === 0) return null;

    // Query KG for mined PRD count in parallel
    const args: Record<string, unknown> = { predicate: "mined_from_file" };
    if (wing) args.wing = wing;
    const result = await bridgeAsync("kg_query_predicate", args, 3000);
    if (!result.ok) return null;

    const minedCount = ((result.data.facts || []) as Array<{ current?: boolean }>)
      .filter((f) => f.current !== false).length;

    const backlog = Math.max(0, totalPRDs - minedCount);
    if (backlog <= 50) return null;

    return (
      `⚠️ PRD backlog: ${backlog} unindexed PRDs (${totalPRDs} total, ${minedCount} mined).\n` +
      `   Drain: bun ~/Durante/Packs/mem-palace/src/Tools/mine-historical-prds.ts --apply --rate 5 --max 100`
    );
  } catch {
    return null;
  }
}

// ── PRD-H / v0.0.16 — Live KG synthesis (primary path) ──────────────────────

interface KgFact {
  subject?: string;
  predicate?: string;
  object?: string;
  created_at?: string;
  ts?: string;
  current?: boolean;
}

interface OpenThread {
  slug: string;
  phase: string;
  task: string;
  updated: string;
}

// Per-section fact cap — shared by the render layer AND the server-side
// `limit` arg (dos#550): the bridge now returns at most this many rows per
// predicate instead of the full fact set.
const FACT_CAP = 10;

/** Why the live-KG path yielded no block (dos#550 banner honesty). */
export type LiveCause = "ok" | "zero-facts" | "error";

/**
 * Pick the snapshot-fallback prefix + degraded flag from the live-KG cause.
 * zero-facts is an HONEST, common state (empty wings) — it gets a mild note,
 * not the scary timeout banner, and does not count as degraded. An undefined
 * cause (older stubs/tests) preserves the pre-change timeout wording.
 */
/**
 * Classify the live-KG outcome (JUDGE F1, Gen 178): bridgeAsync returns
 * {ok:false} on timeout WITHOUT throwing, so an all-timeout stop must not
 * masquerade as an honestly-empty wing. Any failed call forfeits the right
 * to claim "zero facts".
 */
export function liveCauseFrom(allCallsOk: boolean, totalFacts: number): LiveCause {
  if (totalFacts > 0) return "ok";
  return allCallsOk ? "zero-facts" : "error";
}

export function fallbackSnapshotPrefix(cause?: LiveCause): { prefix: string; degraded: boolean } {
  if (cause === "zero-facts") {
    return {
      prefix:
        "> **(cached snapshot — no live-KG facts for this wing in the last 24h; snapshot may be stale)**\n\n",
      degraded: false,
    };
  }
  return {
    prefix:
      "> **(cached snapshot — live-KG read timed out under SessionStart load; content may not reflect this session)**\n\n",
    degraded: true,
  };
}

/**
 * Sub-200ms live-KG query for the three "Last Session" predicates.
 * Returns null when ALL three calls fail or yield zero facts (signals the
 * caller to fall back to the cached snapshot). Returns synthesized markdown
 * block when at least one predicate has facts.
 *
 * Budget discipline (PRD-H Principles): 200ms per call. The three calls run
 * in parallel via Promise.all, so wall-clock is bounded by slowest. The
 * bridge daemon (RFC-0075) is the persistent process — first-call warmup
 * cost is paid by the daemon itself, not per-invocation.
 */
export async function queryLiveSessionContext(wing: string | null): Promise<{
  block: string | null;
  factCount: number;
  ms: number;
  cause?: LiveCause;
}> {
  const startMs = Date.now();
  if (!existsSync(BRIDGE_PATH) || !existsSync(join(MEMPALACE_DIR, "palace"))) {
    return { block: null, factCount: 0, ms: Date.now() - startMs, cause: "error" };
  }

  const buildArgs = (predicate: string): Record<string, unknown> => {
    // hours + limit are honored SERVER-SIDE as of dos#550 (Forge Gen 178) —
    // the bridge returns ≤FACT_CAP newest rows in-window instead of the full
    // fact set (~237KB/call at 54k+ drawers). Client-side recency filter below
    // stays as belt for pre-upgrade daemons.
    const args: Record<string, unknown> = { predicate, hours: 24, limit: FACT_CAP };
    if (wing) args.wing = wing;
    return args;
  };

  try {
    // 200ms per call; Promise.all so wall-clock = max(individual), not sum.
    const [workedOnRes, decidedRes, learnedRes] = await Promise.all([
      bridgeAsync("kg_query_predicate", buildArgs("worked_on"), 200),
      bridgeAsync("kg_query_predicate", buildArgs("decided"), 200),
      bridgeAsync("kg_query_predicate", buildArgs("learned"), 200),
    ]);

    const extract = (r: typeof workedOnRes): KgFact[] => {
      if (!r.ok) return [];
      const valid = ((r.data.facts || []) as KgFact[]).filter(
        (f) => f.current !== false && f.object && f.subject,
      );
      // mempalace-008: enforce the 24h window client-side because the bridge
      // drops the `hours` arg (kg_query_predicate ignores it). Without this the
      // block reports facts of any age and inflates the fallback count.
      const facts = filterFactsByRecency(valid);
      // Sort descending by timestamp; most-recent first.
      facts.sort((a, b) => {
        const ta = a.created_at || a.ts || "";
        const tb = b.created_at || b.ts || "";
        return tb.localeCompare(ta);
      });
      return facts;
    };

    const workedOn = extract(workedOnRes);
    const decided = extract(decidedRes);
    const learned = extract(learnedRes);

    const totalFacts = workedOn.length + decided.length + learned.length;
    // JUDGE F1 (Gen 178): a timed-out call comes back {ok:false} without
    // throwing — collapse of !ok into [] must NOT read as an empty wing.
    const allCallsOk = workedOnRes.ok && decidedRes.ok && learnedRes.ok;
    if (totalFacts === 0) {
      const cause = liveCauseFrom(allCallsOk, 0);
      console.error(
        `[MemPalaceWakeUp] live-KG yielded zero facts for wing=${wing || "global"} (24h window, cause: ${cause}); falling through to snapshot`,
      );
      return { block: null, factCount: 0, ms: Date.now() - startMs, cause };
    }

    const openThreads = collectOpenThreads();
    const block = renderLiveBlock({ wing, workedOn, decided, learned, openThreads });
    return { block, factCount: totalFacts, ms: Date.now() - startMs, cause: "ok" };
  } catch (err) {
    // PRD-H ISC-A4: NEVER swallow live-KG errors silently. Log + return null.
    console.error(`[MemPalaceWakeUp] live-KG synthesis failed (non-fatal): ${err}`);
    return { block: null, factCount: 0, ms: Date.now() - startMs, cause: "error" };
  }
}

/**
 * Scan MEMORY/WORK/active/<slug>/PRD.md frontmatter for unfinished threads.
 * Returns up to 8 entries, newest-first by `updated:` timestamp. Returns
 * empty array on any read error — never throws.
 *
 * Used by queryLiveSessionContext to surface "Open Threads" alongside KG
 * facts in the synthesized block.
 */
function collectOpenThreads(): OpenThread[] {
  try {
    const workDir = getWorkDir();
    const activeDir = join(workDir, "active");
    const scanDir = existsSync(activeDir) ? activeDir : workDir;
    if (!existsSync(scanDir)) return [];

    const dirents = readdirSync(scanDir, { withFileTypes: true });
    const candidates: OpenThread[] = [];

    for (const d of dirents) {
      if (!d.isDirectory()) continue;
      const prdPath = join(scanDir, d.name, "PRD.md");
      if (!existsSync(prdPath)) continue;

      try {
        // Read frontmatter region (first 800 chars covers task + phase + updated)
        const head = readFileSync(prdPath, "utf-8").substring(0, 800);
        const phaseMatch = head.match(/^phase:\s*"?([\w-]+)"?/m);
        if (!phaseMatch) continue;
        const phase = phaseMatch[1].toLowerCase();
        if (isTerminalPhase(phase)) continue;

        const taskMatch = head.match(/^task:\s*(.+)$/m);
        const updatedMatch = head.match(/^updated:\s*"?([\dT:.Z+-]+)"?/m);
        candidates.push({
          slug: d.name,
          phase,
          task: (taskMatch?.[1] || d.name).trim(),
          updated: updatedMatch?.[1] || "",
        });
      } catch {
        /* skip unreadable PRD */
      }
    }

    // Sort by updated desc; cap at 8.
    candidates.sort((a, b) => b.updated.localeCompare(a.updated));
    return candidates.slice(0, 8);
  } catch {
    return [];
  }
}

/**
 * Render synthesized "Last Session" block from live KG facts + open threads.
 * Block layout matches PRD-H Step 1 spec.
 */
function renderLiveBlock(input: {
  wing: string | null;
  workedOn: KgFact[];
  decided: KgFact[];
  learned: KgFact[];
  openThreads: OpenThread[];
}): string {
  const { wing, workedOn, decided, learned, openThreads } = input;
  const ts = new Date().toISOString();
  const wingLabel = wing || "global (no wing)";

  const factLine = (f: KgFact): string => {
    const subj = (f.subject || "").trim() || "?";
    const obj = (f.object || "").trim() || "?";
    const t = f.created_at || f.ts || "";
    const age = t ? `  (${formatAge(t)})` : "";
    return `- ${subj} — ${obj}${age}`;
  };

  // Per-section caps — keep block under ~80 lines worst case (module-level
  // FACT_CAP, shared with the server-side limit arg).
  const workedOnLines = workedOn.slice(0, FACT_CAP).map(factLine).join("\n");
  const decidedLines = decided.slice(0, FACT_CAP).map(factLine).join("\n");
  const learnedLines = learned.slice(0, FACT_CAP).map(factLine).join("\n");

  const threadLines = openThreads.length
    ? openThreads
        .map((t) => `- ${t.slug} [phase: ${t.phase}] — ${t.task}`)
        .join("\n")
    : "- (none — no active PRDs in MEMORY/WORK/active/)";

  return [
    "# Session Context Snapshot",
    `_Generated (live): ${ts} | Project: ${wingLabel}_`,
    "",
    "## Last Session",
    "**Recent `worked_on` facts (last 24h):**",
    workedOnLines || "- (none in last 24h)",
    "",
    "## Recent Decisions",
    decidedLines || "- (none in last 24h)",
    "",
    "## Recent Learnings",
    learnedLines || "- (none in last 24h)",
    "",
    "## Open Threads (active PRDs)",
    threadLines,
  ].join("\n");
}

/**
 * Append one JSONL line to MEMORY/STATE/wakeup-source.jsonl describing the
 * source main() chose. Fail-silent — telemetry MUST NOT throw or delay
 * session start. PRD-H Step 3.
 */
function recordWakeupSource(entry: {
  wing: string | null;
  source: "live-kg" | "snapshot" | "chromadb" | "none";
  kg_ms: number;
  fact_count: number;
  degraded: boolean;
  cause?: LiveCause;
}): void {
  try {
    const stateDir = getMemorySubdir("STATE");
    mkdirSync(stateDir, { recursive: true });
    const path = join(stateDir, "wakeup-source.jsonl");
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      wing: entry.wing || "global",
      source: entry.source,
      kg_ms: entry.kg_ms,
      fact_count: entry.fact_count,
      degraded: entry.degraded,
      cause: entry.cause,
    });
    appendFileSync(path, line + "\n");
  } catch {
    /* fail-silent per PRD-H Step 3 — telemetry never blocks session start */
  }
}

function tryChromaDBWakeUp(): string | null {
  if (!existsSync(BRIDGE_PATH) || !existsSync(join(MEMPALACE_DIR, "palace"))) {
    return null;
  }

  try {
    const { wing: projectWing } = resolveProjectWingFromEnv();
    const args: Record<string, unknown> = projectWing ? { wing: projectWing } : {};
    const result = bridgeSync("wake_up", args, 5000);
    if (!result.ok) return null;

    const payload = result.data;
    const context = typeof payload.context === "string" ? payload.context : "";
    if (payload.status === "ok" && context.trim()) {
      const tokens = typeof payload.token_estimate === "number" ? payload.token_estimate : "?";
      console.error(
        `[MemPalaceWakeUp] ChromaDB fallback: ~${tokens} tokens${projectWing ? ` (wing: ${projectWing})` : ' (global)'}`
      );
      return context;
    }
  } catch (err) {
    console.error("[MemPalaceWakeUp] ChromaDB fallback failed:", err);
  }

  return null;
}

export interface WakeupSequenceDeps {
  ensure?: (opts?: EnsureOptions) => Promise<EnsureResult>;
  query?: (
    wing: string | null,
  ) => Promise<{ block: string | null; factCount: number; ms: number; cause?: LiveCause }>;
  /** Test seam — receives 'ensure' then 'query' in invocation order. */
  onStep?: (step: 'ensure' | 'query') => void;
}

/**
 * Ensure-then-query: warm the MemPalace daemon FIRST (bounded + fail-open),
 * THEN run the live-KG synthesis. Owning the sequence here makes the ordering a
 * program invariant instead of a SessionStart scheduler race (the whole reason
 * this hook subsumes MemPalaceDaemonEnsure).
 *
 * ensureDaemon() is itself bounded (DOS_DAEMON_ENSURE_CAP_MS, default 1500ms)
 * and fail-open; we additionally swallow any throw so wake-up NEVER blocks or
 * bricks on the daemon (campaign LEG-2 / PRD-H fail-open contract). The seams
 * are injectable so the ordering is unit-testable without a live daemon.
 */
export async function ensureThenQueryLiveContext(
  wing: string | null,
  deps: WakeupSequenceDeps = {},
): Promise<{
  ensure: EnsureResult | null;
  live: { block: string | null; factCount: number; ms: number; cause?: LiveCause };
}> {
  const ensureFn = deps.ensure ?? ensureDaemon;
  const queryFn = deps.query ?? queryLiveSessionContext;

  let ensure: EnsureResult | null = null;
  try {
    deps.onStep?.('ensure');
    ensure = await ensureFn({});
  } catch {
    ensure = null; // fail-open — never block wake-up on the daemon
  }

  deps.onStep?.('query');
  const live = await queryFn(wing);
  return { ensure, live };
}

async function main() {
  const { wing: projectWing } = resolveProjectWingFromEnv();

  // Ensure-then-query merge (v0.0.20 lifecycle refactor): warm the MemPalace
  // daemon FIRST, THEN run live-KG synthesis (PRIMARY — PRD-H Step 2). This
  // subsumes the standalone MemPalaceDaemonEnsure SessionStart hook, which — as
  // a PARALLEL SessionStart hook — could not guarantee it warmed the daemon
  // before this hook's 200ms-budget kg_query_predicate calls raced it cold.
  const { live: liveContext } = await ensureThenQueryLiveContext(projectWing);

  // Companion KG signals (last-compaction line + PRD backlog) fire AFTER the
  // ensure step — the daemon is warm now, so these are fast — and in parallel
  // with each other. Awaited further down alongside the chosen context.
  const lastCompactionPromise = queryLastCompaction(projectWing);
  const prdBacklogPromise = checkPRDBacklog(projectWing);

  let context: string | null = null;
  let source: "live-kg" | "snapshot" | "chromadb" | "none" = "none";
  let degraded = false;

  if (liveContext.block) {
    // PRIMARY: live KG synthesis succeeded.
    context = liveContext.block;
    source = "live-kg";
  } else {
    // FALLBACK 1 (graceful — PRD-H Step 2): cached snapshot with a prefix
    // matched to the CAUSE (dos#550): zero-facts is an honest empty-wing
    // state (mild note, not degraded); timeout/error keeps the loud degraded
    // banner. NEVER silently serve a stale snapshot as if it were live
    // (ISC-A4 / ISC-A5).
    const snapshot = trySnapshot(projectWing);
    if (snapshot) {
      const fallback = fallbackSnapshotPrefix(liveContext.cause);
      context = fallback.prefix + snapshot;
      source = "snapshot";
      degraded = fallback.degraded;
      console.error(
        `[MemPalaceWakeUp] live-KG path yielded no block (cause: ${liveContext.cause ?? "unknown"}), served cached snapshot`,
      );
    } else {
      // FALLBACK 2 (last-resort — PRD-H Step 2 / F3): ChromaDB wake_up.
      const chromaCtx = tryChromaDBWakeUp();
      if (chromaCtx) {
        context = chromaCtx;
        source = "chromadb";
        degraded = true;
      }
    }
  }

  // Companion KG signals (last-compaction line + PRD backlog notice) await
  // here so they ride alongside whatever source main() picked.
  const [lastCompaction, prdBacklog] = await Promise.all([
    lastCompactionPromise,
    prdBacklogPromise,
  ]);

  if (context || lastCompaction || prdBacklog) {
    // JUDGE F4 (Gen 178): the header label must agree with the degraded flag —
    // a non-degraded zero-facts snapshot no longer wears the degraded label.
    const label =
      source === "live-kg"
        ? "live-kg"
        : source === "snapshot"
          ? degraded
            ? "snapshot — degraded"
            : "snapshot"
          : source === "chromadb"
            ? "chromadb"
            : source;
    console.log(`\n--- MemPalace Context (${label}) ---`);
    // Prepend last-compaction line when available (ISC-M3.2)
    if (lastCompaction) console.log(lastCompaction);
    if (context) console.log(context);
    // Append PRD backlog notice at end when backlog > 50 (ISC-M5.2)
    if (prdBacklog) console.log(`\n${prdBacklog}`);
    console.log("--- End MemPalace Context ---\n");
  }

  // Telemetry — PRD-H Step 3. Fail-silent.
  recordWakeupSource({
    wing: projectWing,
    source,
    kg_ms: liveContext.ms,
    fact_count: liveContext.factCount,
    degraded,
    cause: liveContext.cause,
  });

  process.exit(0);
}

// Guard auto-execution so the ensure-then-query ordering seam
// (ensureThenQueryLiveContext) can be imported in tests without running main()
// (which calls process.exit). import.meta.main is true only when this file is
// the process entry point — i.e., when Claude Code runs the hook — and false
// when the module is imported.
if (import.meta.main) {
  const _t = startTimer('MemPalaceWakeUp');
  process.on('exit', () => stopTimer(_t, 'SessionStart'));
  main().catch((err) => {
    console.error("[MemPalaceWakeUp] Fatal:", err);
    process.exit(0);
  });
}
