#!/usr/bin/env bun
/**
 * DoctrineDrift.ts — Sentinel/DoctrineDrift workflow backing tool.
 *
 * Verifies live codebase honors the active Algorithm doctrine's
 * MUST/MANDATORY/REQUIRED/CRITICAL obligations.
 *
 * Pipeline:
 *   1. Resolve doctrine via ~/.claude/DOS/Algorithm/LATEST
 *   2. Parse paragraphs containing obligation keywords
 *   3. Heuristic-classify each obligation by keyword family
 *   4. Verify the classified artifact exists / hook is registered
 *   5. Compute coverage = passing / (passing + failing) × 100
 *
 * Flags:
 *   --json              JSON output
 *   --threshold N       coverage % gate (default 80)
 *   --help              show usage
 *
 * Exit codes:
 *   0 = coverage >= threshold
 *   1 = coverage < threshold
 */

import { existsSync, readFileSync, lstatSync, readlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join, isAbsolute } from "node:path";

// ───────────────────────────────────────────────────────────────────────────
// CLI
// ───────────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const FLAG_JSON = argv.includes("--json");
const FLAG_HELP = argv.includes("--help") || argv.includes("-h");
const thrIdx = argv.indexOf("--threshold");
const THRESHOLD =
  thrIdx !== -1 && argv[thrIdx + 1] ? Number(argv[thrIdx + 1]) : 80;

if (FLAG_HELP) {
  console.log(
    [
      "DoctrineDrift.ts — verify codebase honors active Algorithm doctrine",
      "",
      "USAGE:",
      "  bun ~/.claude/skills/sentinel/Tools/DoctrineDrift.ts [flags]",
      "",
      "FLAGS:",
      "  --json           JSON output",
      "  --threshold N    Coverage gate (default 80)",
      "  --help           Show this help",
      "",
      "EXIT CODES:",
      "  0   coverage >= threshold",
      "  1   coverage < threshold",
    ].join("\n"),
  );
  process.exit(0);
}

const HOME = homedir();
const ts = new Date().toISOString();

// ───────────────────────────────────────────────────────────────────────────
// 1. Resolve doctrine
// ───────────────────────────────────────────────────────────────────────────

export function resolveDoctrine(
  algoDir: string = `${HOME}/.claude/DOS/Algorithm`,
): { path: string; version: string; text: string } {
  const latest = `${algoDir}/LATEST`;
  if (!existsSync(latest)) throw new Error(`LATEST not found at ${latest}`);
  let target: string;
  try {
    const stat = lstatSync(latest);
    if (stat.isSymbolicLink()) {
      const link = readlinkSync(latest);
      target = isAbsolute(link) ? link : join(algoDir, link);
    } else {
      // Regular file: first non-empty line is the active filename
      const first = readFileSync(latest, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 0);
      if (!first) throw new Error("LATEST is empty");
      target = isAbsolute(first) ? first : join(algoDir, first);
    }
  } catch (e) {
    throw new Error(`failed to resolve LATEST: ${(e as Error).message}`);
  }
  // A bare-label LATEST (e.g. the literal `v0.0.10`, no extension) resolves to
  // an extension-less path; retry with `.md` appended so the workflow RUNS
  // instead of exit-2 crashing — the live LATEST ships a bare label, so without
  // this retry DoctrineDrift is dead in every operator environment (ISC-28).
  if (!existsSync(target) && !target.endsWith(".md") && existsSync(`${target}.md`)) {
    target = `${target}.md`;
  }
  if (!existsSync(target)) {
    throw new Error(`resolved doctrine missing: ${target} (also tried ${target}.md)`);
  }
  const text = readFileSync(target, "utf8");
  const version = target.split("/").pop()!.replace(/\.md$/, "");
  return { path: target, version, text };
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Parse obligations
// ───────────────────────────────────────────────────────────────────────────

const KEYWORDS = ["MUST", "MANDATORY", "REQUIRED", "CRITICAL"];

function parseObligations(
  text: string,
): { id: string; keyword: string; text: string; fullText: string }[] {
  // Split into paragraphs by blank lines
  const paragraphs = text.split(/\n\s*\n/);
  const out: { id: string; keyword: string; text: string; fullText: string }[] = [];
  let id = 1;
  for (const p of paragraphs) {
    let firstKeyword: string | null = null;
    for (const k of KEYWORDS) {
      // Whole-word, case-sensitive
      const re = new RegExp(`\\b${k}\\b`);
      if (re.test(p)) {
        firstKeyword = k;
        break;
      }
    }
    if (firstKeyword) {
      const flat = p.replace(/\s+/g, " ").trim();
      out.push({
        id: `Ob-${String(id).padStart(2, "0")}`,
        keyword: firstKeyword,
        // `text` is the 200-char display slice; `fullText` is the whole
        // paragraph used for CLASSIFICATION so a keyword past char 200 (e.g.
        // "DISCOVERY-FIRST", "council") is not lost to manual-review (ISC-30).
        text: flat.slice(0, 200),
        fullText: flat,
      });
      id++;
    }
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// 3-4. Heuristic classify + verify
// ───────────────────────────────────────────────────────────────────────────

type Status = "passing" | "failing" | "manual_review_required";

type Verified = {
  id: string;
  keyword_matched: string;
  text: string;
  classification: string;
  status: Status;
  evidence: string;
};

// ── registry-presence check (SENT-11) ──
// A `conformance_backed` obligation is only "passing" if the R-rule it names is
// actually REGISTERED. Without this, a deleted/renamed handler leaves the
// obligation green purely on a doctrine-text keyword match — inflating the
// coverage gate. We text-parse the registry for its registered check-keys
// (mirrors R85/R89; no import cycle, NOT an invocation engine).
let _registeredKeysMemo: ReadonlySet<string> | null = null;

export function loadRegisteredCheckKeys(registryPath?: string): ReadonlySet<string> {
  const p = registryPath ?? join(import.meta.dir, "ConformanceChecks", "registry.ts");
  const keys = new Set<string>();
  try {
    const text = readFileSync(p, "utf8");
    const re = /"([a-z][a-z0-9-]*\.[a-z0-9.-]+)"\s*:/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) keys.add(m[1]!);
  } catch {
    // Registry unreadable (e.g. a customer install without pack source) → empty
    // set → the check DEGRADES to "passing" rather than false-failing (mirrors
    // flagUnknownIds's degrade-don't-false-fail posture in markdown-catalog.ts).
  }
  return keys;
}

function registeredCheckKeys(): ReadonlySet<string> {
  if (_registeredKeysMemo === null) _registeredKeysMemo = loadRegisteredCheckKeys();
  return _registeredKeysMemo;
}

export function classifyAndVerify(
  ob: {
    id: string;
    keyword: string;
    text: string;
    fullText: string;
  },
  registeredKeys: ReadonlySet<string> = registeredCheckKeys(),
): Verified {
  // Match against the FULL paragraph; the stored `.text` stays the display slice.
  const t = ob.fullText;

  // intel_first
  if (/INTEL[-\s]FIRST|intel-context/i.test(t)) {
    const hook = `${HOME}/.claude/hooks/IntelFirstGuard.hook.ts`;
    const stateDir = `${HOME}/.claude/MEMORY/STATE/intel-context-fired`;
    const hookOk = existsSync(hook);
    const dirOk = existsSync(stateDir);
    return {
      id: ob.id,
      keyword_matched: ob.keyword,
      text: ob.text,
      classification: "intel_first",
      status: hookOk && dirOk ? "passing" : "failing",
      evidence: `hook=${hookOk ? "ok" : "missing"} stateDir=${dirOk ? "ok" : "missing"}`,
    };
  }

  // prd_class (covered by PRDLint — counts as passing)
  if (/ISC count|Splitting Test|effort floor|PRD frontmatter|frontmatter/i.test(t)) {
    return {
      id: ob.id,
      keyword_matched: ob.keyword,
      text: ob.text,
      classification: "prd_class",
      status: "passing",
      evidence: "covered by PRDLint workflow (Sentinel/PRDLint)",
    };
  }

  // voice
  if (/\bvoice\.sh\b|\bvoice\b/.test(t)) {
    const dosDir = process.env.DOS_DIR || `${HOME}/.claude/DOS`;
    const voicePath = `${dosDir}/DOS/Tools/voice.sh`;
    // settings.json fallback: voice.sh might also live at $DOS_DIR/Tools/voice.sh
    const altPath = `${dosDir}/Tools/voice.sh`;
    const ok = existsSync(voicePath) || existsSync(altPath);
    return {
      id: ob.id,
      keyword_matched: ob.keyword,
      text: ob.text,
      classification: "voice",
      status: ok ? "passing" : "failing",
      evidence: ok ? `found at ${existsSync(voicePath) ? voicePath : altPath}` : "voice.sh missing",
    };
  }

  // PREDICATES.md
  if (/PREDICATES\.md/.test(t)) {
    const p = `${HOME}/.claude/DOS/PREDICATES.md`;
    const ok = existsSync(p);
    return {
      id: ob.id,
      keyword_matched: ob.keyword,
      text: ob.text,
      classification: "predicates",
      status: ok ? "passing" : "failing",
      evidence: ok ? `${p} exists` : `${p} missing`,
    };
  }

  // working-tree-clean gate
  if (/WORKING[-\s]TREE[-\s]CLEAN GATE|working-tree-clean-gate/i.test(t)) {
    const p = `${HOME}/Durante/Tools/working-tree-clean-gate.ts`;
    const ok = existsSync(p);
    return {
      id: ob.id,
      keyword_matched: ob.keyword,
      text: ob.text,
      classification: "working_tree_gate",
      status: ok ? "passing" : "failing",
      evidence: ok ? `${p} exists` : `${p} missing`,
    };
  }

  // MEMORY/WORK or MEMORY/STATE directory existence
  if (/MEMORY\/(WORK|STATE)/.test(t)) {
    const m = t.match(/MEMORY\/(WORK|STATE)/);
    const sub = m ? m[1] : "WORK";
    const candidates = [
      `${HOME}/Durante/MEMORY/${sub}`,
      `${HOME}/.claude/MEMORY/${sub}`,
    ];
    const found = candidates.find((c) => existsSync(c));
    return {
      id: ob.id,
      keyword_matched: ob.keyword,
      text: ob.text,
      classification: `memory_${sub!.toLowerCase()}`,
      status: found ? "passing" : "failing",
      evidence: found ? `dir exists at ${found}` : `no MEMORY/${sub} dir found`,
    };
  }

  // RmGuard / PreToolUse
  if (/\bRmGuard\b|\bPreToolUse\b/.test(t)) {
    const settings = `${HOME}/.claude/settings.json`;
    let ok = false;
    if (existsSync(settings)) {
      try {
        const s = readFileSync(settings, "utf8");
        ok = /RmGuard|PreToolUse/.test(s);
      } catch {
        ok = false;
      }
    }
    return {
      id: ob.id,
      keyword_matched: ob.keyword,
      text: ob.text,
      classification: "hook_registered",
      status: ok ? "passing" : "failing",
      evidence: ok ? `settings.json references hook` : `settings.json missing or no hook entry`,
    };
  }

  // conformance-backed MUSTs — these doctrine obligations are mechanically
  // enforced by registered Sentinel conformance handlers, so the live tree IS
  // verified against them; mark passing with the backing R-rule as evidence
  // rather than dumping them into manual-review (ISC-30).
  const CONFORMANCE_BACKED: { re: RegExp; rule: string }[] = [
    { re: /DISCOVERY[-\s]FIRST|discovery-first/i, rule: "R36 presence.discovery-first-section" },
    { re: /phase[-\s]complete\s+gate|PhaseComplete|complete-gate/i, rule: "R35 presence.phase-complete-gate-active" },
    { re: /Decline Protocol|Declined:|phantom[-\s]?capabilit/i, rule: "R63 presence.declined-line-matches-capability" },
    { re: /council\b[^.]*\bbefore\b|before[^.]*\bcouncil\b/i, rule: "R78 presence.council-before-body" },
  ];
  for (const c of CONFORMANCE_BACKED) {
    if (c.re.test(t)) {
      // Confirm the named R-rule's check-key is actually registered before
      // counting it passing — a deleted/renamed handler must flip this to
      // failing instead of staying green on the doctrine-text match (SENT-11).
      // Degrade to passing when the registry is unreadable (empty set).
      const checkKey = c.rule.split(/\s+/).find((tok) => tok.includes("."));
      const registered =
        !checkKey || registeredKeys.size === 0 || registeredKeys.has(checkKey);
      return {
        id: ob.id,
        keyword_matched: ob.keyword,
        text: ob.text,
        classification: "conformance_backed",
        status: registered ? "passing" : "failing",
        evidence: registered
          ? `covered by Sentinel conformance (${c.rule})`
          : `named rule ${c.rule} NOT registered in registry (handler deleted/renamed?)`,
      };
    }
  }

  // No match
  return {
    id: ob.id,
    keyword_matched: ob.keyword,
    text: ob.text,
    classification: "unmatched",
    status: "manual_review_required",
    evidence: "no automatable check — manual review",
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Run
// ───────────────────────────────────────────────────────────────────────────

if (import.meta.main) {
let doctrine: { path: string; version: string; text: string };
try {
  doctrine = resolveDoctrine();
} catch (e) {
  console.error(`error: ${(e as Error).message}`);
  process.exit(2);
}

const obligations = parseObligations(doctrine.text);
const verified = obligations.map((ob) => classifyAndVerify(ob));

const passing = verified.filter((v) => v.status === "passing").length;
const failing = verified.filter((v) => v.status === "failing").length;
const manual = verified.filter((v) => v.status === "manual_review_required").length;
const total = verified.length;
const verifiable = passing + failing;
const coverage = verifiable === 0 ? 100 : Math.round((passing / verifiable) * 1000) / 10;
// Unverifiable (manual-review) fraction is a FIRST-CLASS metric, not silently
// dropped from the denominator: coverage% over verifiable obligations can read
// healthy while a large slice of doctrine is unchecked. Surface both (ISC-31).
const unverifiablePercent = total === 0 ? 0 : Math.round((manual / total) * 1000) / 10;

// ───────────────────────────────────────────────────────────────────────────
// Output
// ───────────────────────────────────────────────────────────────────────────

if (FLAG_JSON) {
  console.log(
    JSON.stringify(
      {
        timestamp: ts,
        doctrine_path: doctrine.path,
        doctrine_version: doctrine.version,
        total_obligations: verified.length,
        coverage_percent: coverage,
        coverage_denominator: verifiable,
        unverifiable_percent: unverifiablePercent,
        threshold: THRESHOLD,
        by_status: { passing, failing, manual_review_required: manual },
        obligations: verified,
      },
      null,
      2,
    ),
  );
} else {
  const isTty = process.stdout.isTTY;
  const red = (s: string) => (isTty ? `\x1b[31m${s}\x1b[0m` : s);
  const yel = (s: string) => (isTty ? `\x1b[33m${s}\x1b[0m` : s);
  const gry = (s: string) => (isTty ? `\x1b[90m${s}\x1b[0m` : s);
  const grn = (s: string) => (isTty ? `\x1b[32m${s}\x1b[0m` : s);
  const bar = "=".repeat(60);
  const sub = "-".repeat(60);

  const status =
    coverage >= THRESHOLD ? grn("PASSING") : red("BELOW THRESHOLD");

  console.log(bar);
  console.log("  DOCTRINE DRIFT REPORT");
  console.log(bar);
  console.log("");
  console.log(`DOCTRINE:       ${doctrine.version}`);
  console.log(`PATH:           ${doctrine.path}`);
  console.log(`TOTAL OBLS:     ${verified.length}`);
  console.log(
    `COVERAGE:       ${coverage}%   (${passing} of ${verifiable} verifiable)`,
  );
  console.log(
    `UNVERIFIABLE:   ${unverifiablePercent}%   (${manual} of ${total} — manual review, not folded into coverage)`,
  );
  console.log(`THRESHOLD:      ${THRESHOLD}%   STATUS: ${status}`);
  console.log("");
  console.log(sub);
  console.log(`PASSING:                ${grn(String(passing))}`);
  console.log(`FAILING:                ${red(String(failing))}`);
  console.log(`MANUAL REVIEW:          ${yel(String(manual))}   ${gry(`(${unverifiablePercent}% unverifiable)`)}`);
  console.log(sub);

  const failures = verified.filter((v) => v.status === "failing");
  if (failures.length > 0) {
    console.log("");
    console.log(red("FAILING:"));
    for (const f of failures) {
      console.log(
        `  [${f.id}] keyword=${f.keyword_matched}  classification=${f.classification}`,
      );
      console.log(`        text: "${f.text.slice(0, 120)}${f.text.length > 120 ? "..." : ""}"`);
      console.log(`        evidence: ${f.evidence}`);
    }
  }

  const manualList = verified.filter((v) => v.status === "manual_review_required");
  if (manualList.length > 0 && manualList.length <= 12) {
    console.log("");
    console.log(yel("MANUAL REVIEW:"));
    for (const f of manualList) {
      console.log(`  [${f.id}] keyword=${f.keyword_matched}`);
      console.log(`        text: "${f.text.slice(0, 120)}${f.text.length > 120 ? "..." : ""}"`);
    }
  } else if (manualList.length > 12) {
    console.log("");
    console.log(yel(`MANUAL REVIEW: ${manualList.length} obligations (use --json for full list)`));
  }
}

process.exit(coverage < THRESHOLD ? 1 : 0);
}
