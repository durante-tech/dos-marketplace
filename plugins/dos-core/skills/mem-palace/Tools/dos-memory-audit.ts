#!/usr/bin/env bun
/**
 * dos-memory-audit.ts — PalaceAudit v1 (read-only forensic + static gates).
 *
 * Sibling of dos-memory-status.ts. Where the radiator measures SINGLE points and
 * so false-greens on cross-surface disagreements, this tool RECONCILES surfaces
 * and rolls every check into one actionable verdict. v1 is strictly READ-ONLY —
 * zero palace writes. All `--live` drawer probes (write/retry/recall round-trips)
 * are deliberately deferred behind a physical palace-fork harness (RedTeam R2):
 * on an actively-corrupting host, writing into the shared HNSW index makes it worse.
 *
 * Design: MEMORY/WORK/active/20260629-224530_mempalace-deep-investigation-test-agent/
 *         DESIGN-test-agent.md  (§3 gates, §5 schema, §10 RedTeam revisions).
 *
 * Usage:
 *   bun ~/Durante/Packs/mem-palace/src/Tools/dos-memory-audit.ts          # human radiator
 *   bun ~/Durante/Packs/mem-palace/src/Tools/dos-memory-audit.ts --json   # machine-readable
 *   bun ~/Durante/Packs/mem-palace/src/Tools/dos-memory-audit.ts --check  # silent, exit code only
 *
 * Exit codes (verdict rollup):
 *   0 PASS  — clean
 *   1 WARN  — only medium/low findings
 *   2 FAIL  — any critical (or high), incl. host-induced ERROR (RedTeam R7)
 *   3 ERROR — the auditor ITSELF threw before producing a verdict (distinct from memory-bad)
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Database } from "bun:sqlite";

const HOME = homedir();
const SCHEMA = "mempalace-audit/v1";

export type GateStatus = "pass" | "warn" | "fail" | "skip" | "error" | "inconclusive";
export type Severity = "critical" | "high" | "medium" | "low";
export type Coverage = "full" | "partial";

export interface Gate {
  id: string;
  title: string;
  status: GateStatus;
  severity: Severity;
  coverage: Coverage;
  evidence: { observed: Record<string, unknown>; expected?: unknown };
  remedy?: string;
}

type Verdict = "PASS" | "WARN" | "FAIL" | "ERROR";

interface AuditReport {
  schema: typeof SCHEMA;
  ts: string;
  mode: "dry-run";
  verdict: Verdict;
  exit_code: 0 | 1 | 2 | 3;
  gates: Gate[];
  summary: { pass: number; warn: number; fail: number; error: number; critical_fails: string[] };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Shell a command read-only with a HARD timeout; never throws (returns "" on failure/timeout).
 * The read is RACED against the timeout so a surviving grandchild that keeps the stdout pipe
 * open (e.g. `uv`→`python` hanging on a resolve) can never wedge the caller — sh() always
 * settles within timeoutMs. SIGKILL the whole spawn on timeout; clear the timer on the win.
 */
async function sh(cmd: string, timeoutMs = 30_000): Promise<string> {
  try {
    const proc = Bun.spawn(["bash", "-lc", cmd], { stdout: "pipe", stderr: "ignore" });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<string>((resolve) => {
      timer = setTimeout(() => { try { proc.kill(9); } catch {} resolve(""); }, timeoutMs);
    });
    const out = await Promise.race([new Response(proc.stdout).text(), timeout]);
    if (timer) clearTimeout(timer);
    return out;
  } catch {
    return "";
  }
}

/** Resolve the MEMPALACE memory subdir the way getMemorySubdir() does (project → cwd → ~/.claude). */
function statusToolKgPath(): string {
  const candidates = [
    process.env.CLAUDE_PROJECT_DIR && join(process.env.CLAUDE_PROJECT_DIR, "MEMORY/MEMPALACE"),
    join(process.cwd(), "MEMORY/MEMPALACE"),
    join(HOME, ".claude/MEMORY/MEMPALACE"),
  ].filter(Boolean) as string[];
  for (const c of candidates) if (existsSync(c)) return join(c, "knowledge_graph.sqlite3");
  return join(HOME, ".claude/MEMORY/MEMPALACE/knowledge_graph.sqlite3");
}

/** The KG path the BRIDGE actually writes (MEMPALACE_DIR, default ~/.mempalace). */
function bridgeKgPath(): string {
  const dir = process.env.MEMPALACE_DIR || join(HOME, ".mempalace");
  return join(dir, "knowledge_graph.sqlite3");
}

/** Triple count via bun:sqlite (read-only) — no shell/Python interpolation (no injection), and a
 *  table-existence check so an older/foreign schema returns null instead of a spurious failure. */
function sqliteTripleCount(dbPath: string): number | null {
  if (!existsSync(dbPath)) return null;
  let db: Database | undefined;
  try {
    db = new Database(dbPath, { readonly: true });
    const hasTable = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='triples'").get();
    if (!hasTable) return null;
    const row = db.query("SELECT count(*) AS n FROM triples").get() as { n: number } | null;
    return row?.n ?? null;
  } catch {
    return null;
  } finally {
    try { db?.close(); } catch {}
  }
}

// ── gates (each returns a Gate; a thrown gate is caught by runGate → status:error) ──

/** G0a — recovery/partial/truncated palace dirs are the loudest corruption signal (RedTeam R1). */
async function gateRecoveryDirs(): Promise<Gate> {
  // Include the configured MEMPALACE_DIR (the bridge honors it) + the symlink-mode ~/.claude root, not
  // just the two default locations — else the critical gate false-passes when the palace lives elsewhere.
  const roots = [
    ...new Set([
      join(HOME, ".mempalace"),
      dirname(bridgeKgPath()),
      join(HOME, "Durante/MEMORY/MEMPALACE"),
      join(HOME, ".claude/MEMORY/MEMPALACE"),
    ]),
  ];
  const found: string[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if (/^palace\..*(recover|rebuild|truncat|interrupt|bak)/i.test(name)) found.push(join(root, name));
    }
  }
  return {
    id: "G0a-recovery-dirs",
    title: "No interrupted-rebuild / recovery palace dirs present",
    status: found.length ? "fail" : "pass",
    severity: "critical",
    // partial: we scan the known roots but cannot enumerate every operator-configured palace location.
    coverage: "partial",
    evidence: { observed: { count: found.length, dirs: found }, expected: 0 },
    remedy: found.length
      ? "Heal the divergence then reclaim: see FIX-corruption-stop.md Layer 3; rm the verified-stale palace.* dirs"
      : undefined,
  };
}

/** G0b — 24h native-crash / readonly-DB / HNSW-divergence count from the bridge invocation log. */
async function gateCrashCount(): Promise<Gate> {
  const ev = join(HOME, ".claude/MEMORY/STATE/memory-events.jsonl");
  let segv = 0, readonly = 0, diverge = 0;
  if (existsSync(ev)) {
    const cutoff = Date.now() - 24 * 3600_000;
    for (const line of readFileSync(ev, "utf8").split("\n")) {
      if (!line.trim()) continue;
      let d: any;
      try { d = JSON.parse(line); } catch { continue; }
      // Skip anything we can't confirm is within the 24h window (unparseable/missing ts → exclude,
      // never count-as-fresh). A parseable older event is skipped too.
      const t = Date.parse(d.ts || d.timestamp || d.time || "");
      if (!Number.isFinite(t) || t < cutoff) continue;
      // Only ERROR-status events count, matched against the bridge's own result text — NOT args_summary
      // (which carries call content: an add_kg_fact whose payload says "readonly"/"divergence" is ok, not
      // a crash). Verified against the live schema {ts, status, op_kind, result_summary, ...}.
      if (d.status !== "error" && d.exit_code !== 139) continue;
      const rs = String(d.result_summary ?? d.error ?? d.message ?? "").toLowerCase();
      if (d.exit_code === 139 || rs.includes("sigsegv") || rs.includes("segmentation") || rs.includes("signal 11")) segv++;
      else if (rs.includes("readonly")) readonly++;
      else if (rs.includes("divergence") || rs.includes("hnsw")) diverge++;
    }
  }
  const total = segv + readonly + diverge;
  return {
    id: "G0b-crash-count",
    title: "No native crashes / readonly-DB / HNSW-divergence in last 24h",
    status: segv > 0 || readonly > 0 ? "fail" : diverge > 0 ? "warn" : "pass",
    severity: "high",
    // partial: a process-death SIGSEGV can die before it logs an event — G0a (recovery dirs) + G0c
    // (cardinality) are the authoritative corruption signals; this is a supplementary read.
    coverage: "partial",
    evidence: { observed: { segv, readonly, divergence: diverge }, expected: 0 },
    remedy: total ? "Active corruption — stop concurrent writers (FIX-corruption-stop.md Layer 1-2)" : undefined,
  };
}

/** G0c — drawer sqlite vs HNSW cardinality (the census), via read-only `mempalace repair-status`. */
async function gateCardinality(): Promise<Gate> {
  const out = await sh("mempalace repair-status 2>&1", 30_000);
  const block = out.match(/\[drawers\]([\s\S]*?)(\n\s*\[|$)/i)?.[1] ?? "";
  const sqlite = parseInt(block.match(/sqlite count:\s*([\d,]+)/i)?.[1]?.replace(/,/g, "") ?? "", 10);
  const hnsw = parseInt(block.match(/hnsw count:\s*([\d,]+)/i)?.[1]?.replace(/,/g, "") ?? "", 10);
  const statusWord = (block.match(/status:\s*(\w+)/i)?.[1] ?? "").toUpperCase();
  const vectorDisabled = /vector reads are disabled/i.test(out);
  const haveCounts = Number.isFinite(sqlite) && Number.isFinite(hnsw);
  // Respect repair-status's own verdict: it applies a flush-lag tolerance (sqlite a few rows ahead of HNSW
  // mid-flush is benign and reported "OK"). A raw sqlite!==hnsw under an OK verdict is flush-lag, NOT
  // corruption — only a real DIVERGED verdict (or vector reads disabled) fails this gate. Stops a transient
  // mid-write flush-lag from false-failing a critical gate. [G0c flush-lag fix 2026-06-30]
  const diverged = statusWord === "DIVERGED" || (haveCounts && sqlite !== hnsw && statusWord !== "OK");
  return {
    id: "G0c-cardinality",
    title: "Drawer sqlite count == HNSW index count (vector reads enabled)",
    status: !out ? "inconclusive" : diverged || vectorDisabled ? "fail" : haveCounts ? "pass" : "inconclusive",
    severity: "critical",
    coverage: "full",
    evidence: { observed: { sqlite, hnsw, divergence: haveCounts ? sqlite - hnsw : null, status: statusWord, vector_reads_disabled: vectorDisabled } },
    remedy: diverged || vectorDisabled ? "mempalace repair --mode from-sqlite --archive-existing (see FIX-corruption-stop.md Layer 3)" : undefined,
  };
}

/** G1 — version parity across install surfaces. coverage:partial (daemon in-process not socket-queryable here). */
async function gateVersionParity(): Promise<Gate> {
  const verRe = /(\d+(?:\.\d+){2,})/; // 3+ dotted components — don't truncate a 4-part version to its prefix
  // Two PATH-robust surfaces (bare python3/pip3 are not mise-resolved under a non-interactive shell):
  //   installed = `mempalace --version` (the binary the MCP server + status tool + bridge re-exec all load)
  //   uv        = `uv run --with <MEMPALACE_PKG_SPEC>` — probe EXACTLY the cold-spawn command the hooks run.
  //               A BARE `--with mempalace` (no floor) resolves a stale cached 3.3.4 that NO hook loads →
  //               false-positive skew. The hooks pin `mempalace>=3.4.1,<4` (hooks/lib/mempalace.ts:36-37 = SoT);
  //               mirror that fallback verbatim and honor the MEMPALACE_PKG_SPEC env override so this gate
  //               tracks operator overrides instead of drifting. Single-quote the spec: `>=` / `,<` are shell
  //               metacharacters under sh()'s `bash -lc`.
  const pkgSpec = process.env.MEMPALACE_PKG_SPEC ?? "mempalace>=3.4.1,<4";
  const [installedRaw, uvRaw] = await Promise.all([
    sh(`mempalace --version 2>/dev/null`),
    sh(`uv run --with '${pkgSpec}' python -c "import mempalace;print(mempalace.__version__)" 2>/dev/null`),
  ]);
  const observed = {
    installed: installedRaw.match(verRe)?.[1] ?? null,
    uv: uvRaw.match(verRe)?.[1] ?? null,
    uv_spec: pkgSpec,
  };
  // Compare ONLY the two version fields — uv_spec is documentation, not a version to equate.
  const vals = [observed.installed, observed.uv].filter(Boolean);
  const agree = vals.length >= 2 && vals.every((v) => v === vals[0]);
  return {
    id: "G1-version-parity",
    title: "Installed (CLI/daemon/bridge) and uv-resolved-via-PKG_SPEC (hooks) mempalace versions match",
    status: vals.length < 2 ? "inconclusive" : agree ? "pass" : "fail",
    severity: "critical",
    coverage: "partial", // daemon in-process version requires a live socket; not read here
    evidence: { observed, expected: "installed == uv-resolved via the hook spec (a bare --with mempalace is NOT what production runs; bridge re-execs into the installed runtime before its parity guard)" },
    remedy: agree ? undefined : "Pin one version (match pip to uv constraint) + set MEMPALACE_EXPECTED_VERSION + restart daemon",
  };
}

/** G3 — KG path-identity: the path the status tool reads vs the path the bridge writes, + count reconcile. */
async function gateKgPathIdentity(): Promise<Gate> {
  const statusPath = statusToolKgPath();
  const bridgePath = bridgeKgPath();
  const statusN = sqliteTripleCount(statusPath);
  const bridgeN = sqliteTripleCount(bridgePath);
  const sameFile = statusPath === bridgePath;
  const statusMissing = !existsSync(statusPath);
  const countsAgree = statusN !== null && bridgeN !== null && statusN === bridgeN;
  const ok = sameFile || countsAgree;
  return {
    id: "G3-kg-path-identity",
    title: "Status tool and bridge read the SAME knowledge-graph database",
    status: ok ? "pass" : statusMissing ? "fail" : countsAgree ? "pass" : "fail",
    severity: "critical",
    coverage: "full",
    evidence: {
      observed: { status_tool_path: statusPath, status_tool_exists: !existsSync(statusPath) ? false : true, status_tool_triples: statusN, bridge_path: bridgePath, bridge_triples: bridgeN, same_file: sameFile },
      expected: "same physical DB (or reconciled counts)",
    },
    remedy: ok ? undefined : "Converge KG path: MEMPALACE_DIR vs getMemorySubdir('MEMPALACE') (RFC-0100); the status tool reads a missing/empty DB",
  };
}

/** G8 — DLQ drain-lock staleness (read-only): a held .drain.lock from a crashed drainer wedges sync. */
async function gateDlqLock(): Promise<Gate> {
  const lock = join(HOME, ".claude/MEMORY/STATE/.drain.lock");
  if (!existsSync(lock)) {
    return { id: "G8-dlq-drain-lock", title: "No stale DLQ drain-lock", status: "pass", severity: "high", coverage: "partial", evidence: { observed: { present: false } } };
  }
  const ageMs = Date.now() - statSync(lock).mtimeMs;
  const stale = ageMs > 5 * 60_000; // a drain lock older than 5min with no active drain is suspicious
  const body = (() => { try { return readFileSync(lock, "utf8").trim().slice(0, 200); } catch { return ""; } })();
  return {
    id: "G8-dlq-drain-lock",
    title: "No stale DLQ drain-lock (same-boot wedge — RedTeam R3/C1)",
    status: stale ? "warn" : "pass",
    severity: "high",
    coverage: "partial",
    evidence: { observed: { present: true, age_minutes: Math.round(ageMs / 60_000), body } },
    remedy: stale ? "Verify no live drainer (PID), then clear ~/.claude/MEMORY/STATE/.drain.lock (Docs/Playbook/dlq-recovery.md)" : undefined,
  };
}

/** Compose dos-memory-status.ts --json: fold its non-ok sections in as gates (don't reinvent them). */
async function gatesFromRadiator(): Promise<Gate[]> {
  const out = await sh("bun ~/Durante/Packs/mem-palace/src/Tools/dos-memory-status.ts --json 2>/dev/null", 60_000);
  let report: any;
  try { report = JSON.parse(out); } catch { return [{ id: "compose-radiator", title: "dos-memory-status composed", status: "inconclusive", severity: "medium", coverage: "partial", evidence: { observed: { reason: "radiator --json unparseable or timed out" } } }]; }
  const sevMap: Record<string, Severity> = { "bridge-write-success": "high", kg: "high", chromadb: "high", "bridge-served-by": "medium" };
  return (report.sections ?? [])
    .filter((s: any) => s.status && s.status !== "ok" && s.status !== "na")
    .map((s: any): Gate => ({
      id: `radiator:${s.key}`,
      title: `radiator section '${s.key}' = ${s.status}`,
      status: s.status === "warn" ? "warn" : s.status === "stale" ? "warn" : "fail",
      severity: sevMap[s.key] ?? "medium",
      coverage: "partial", // single-surface read — RedTeam R3: never assert full coverage from one source
      evidence: { observed: { display: String(s.display ?? "").slice(0, 200), raw_status: s.status } },
    }));
}

// ── rollup ───────────────────────────────────────────────────────────────────

async function runGate(fn: () => Promise<Gate>): Promise<Gate> {
  try { return await fn(); }
  catch (e) {
    // A gate that throws on this host is itself a signal (RedTeam R7) — surface, don't dismiss.
    return { id: fn.name || "gate", title: `gate threw: ${fn.name}`, status: "error", severity: "high", coverage: "partial", evidence: { observed: { error: String(e).slice(0, 200) } } };
  }
}

export function rollup(gates: Gate[]): { verdict: Verdict; exit: 0 | 1 | 2 | 3; summary: AuditReport["summary"] } {
  const failed = gates.filter((g) => g.status === "fail" || g.status === "error");
  const criticalFails = failed.filter((g) => g.severity === "critical" || g.status === "error");
  const warns = gates.filter((g) => g.status === "warn");
  // A critical/high gate that could not run (inconclusive) must NOT permit a clean PASS — the whole
  // point of this tool is the reconciliation gates; if they didn't verify, we cannot certify green.
  const unverified = gates.filter((g) => (g.severity === "critical" || g.severity === "high") && g.status === "inconclusive");
  const summary = {
    pass: gates.filter((g) => g.status === "pass").length,
    warn: warns.length,
    fail: gates.filter((g) => g.status === "fail").length,
    error: gates.filter((g) => g.status === "error").length,
    critical_fails: criticalFails.map((g) => g.id),
  };
  // host-induced gate error is reclassified critical (RedTeam R7): exit 2, not 3.
  if (criticalFails.length || failed.some((g) => g.severity === "high")) return { verdict: "FAIL", exit: 2, summary };
  // any remaining fail (medium/low), any warn, OR an unverified critical/high gate → WARN —
  // never let a fail or an un-run critical check fall through to a green PASS.
  if (failed.length || warns.length || unverified.length) return { verdict: "WARN", exit: 1, summary };
  return { verdict: "PASS", exit: 0, summary };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = new Set(process.argv.slice(2));
  const gates = await Promise.all([
    runGate(gateRecoveryDirs),
    runGate(gateCrashCount),
    runGate(gateCardinality),
    runGate(gateVersionParity),
    runGate(gateKgPathIdentity),
    runGate(gateDlqLock),
  ]);
  gates.push(...(await gatesFromRadiator().catch(() => [])));

  const { verdict, exit, summary } = rollup(gates);
  const report: AuditReport = { schema: SCHEMA, ts: new Date().toISOString(), mode: "dry-run", verdict, exit_code: exit, gates, summary };

  // Build the full output as one string and flush it before exit — process.exit() right after a
  // console.log can truncate a piped consumer (e.g. `--json | jq`) before the pipe drains.
  async function emit(s: string) {
    // writeArtifact:exempt — stdout stream, not a file write
    await Bun.write(Bun.stdout, s.endsWith("\n") ? s : s + "\n");
    process.exit(exit);
  }

  if (args.has("--json")) return emit(JSON.stringify(report, null, 2));
  if (args.has("--check")) process.exit(exit);

  // human radiator — verdict first, only fail/warn/error rows expanded, severity-grouped
  const icon = verdict === "PASS" ? "🟢" : verdict === "WARN" ? "🟡" : "🔴";
  const lines: string[] = [
    `\n${icon} VERDICT: ${verdict}  (exit ${exit})  —  MemPalace audit ${SCHEMA}`,
    `   ${summary.pass} pass · ${summary.warn} warn · ${summary.fail} fail · ${summary.error} error`,
  ];
  if (summary.critical_fails.length) lines.push(`   critical: ${summary.critical_fails.join(", ")}`);
  const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const shown = gates.filter((g) => g.status !== "pass" && g.status !== "skip").sort((a, b) => order[a.severity] - order[b.severity]);
  for (const g of shown) {
    const gi = g.status === "fail" || g.status === "error" ? "🔴" : g.status === "warn" ? "🟡" : "⚪";
    lines.push(`\n  ${gi} [${g.severity}] ${g.id} — ${g.status}${g.coverage === "partial" ? " (partial)" : ""}`);
    lines.push(`     ${g.title}`);
    lines.push(`     observed: ${JSON.stringify(g.evidence.observed)}`);
    if (g.remedy) lines.push(`     remedy: ${g.remedy}`);
  }
  lines.push("");
  return emit(lines.join("\n"));
}

if (import.meta.main) {
  main().catch((e) => {
    // The auditor ITSELF threw before a verdict — exit 3, distinct from memory-bad (exit 2).
    console.error(`[dos-memory-audit] FATAL (auditor error, not a memory verdict): ${e}`);
    process.exit(3);
  });
}
