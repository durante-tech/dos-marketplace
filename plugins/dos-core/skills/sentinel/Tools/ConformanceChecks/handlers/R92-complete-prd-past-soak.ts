/**
 * R92 (Wave D ISC-15) — presence.complete-prd-past-soak.
 *
 * A phase:complete PRD updated more than SOAK_DAYS ago should have been promoted
 * out of MEMORY/WORK into MEMORY/ARCHIVE by ArchivePromote.hook.ts (SessionEnd).
 * One still sitting under WORK past the soak means promotion never ran — or the
 * PRD was authored into WORK/active/{slug} under the RFC-0037 §4.1 split before
 * the readers were made active/-aware (the path trap ISC-13 fixed) — i.e. a
 * "lost" completed PRD silently polluting the active set. This rule surfaces
 * them so they get promoted, not accumulated.
 *
 * Scope: flat WORK/{slug} + WORK/active/{slug}. NOT WORK/archived/{slug} — the
 * cold holding bucket ArchivePromote intentionally leaves in place, so a
 * complete PRD parked there is operator-intended, not a leak.
 *
 * Advisory (work-corpus): scans the gitignored MEMORY/WORK tree, so it snapshots
 * to baseline-corpus.json and never gates (structural/committed split).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "phase:complete PRDs older than the soak window must not linger under MEMORY/WORK (promote to MEMORY/ARCHIVE)";
const SOAK_DAYS = 7; // mirrors ArchivePromote.hook.ts SOAK_DAYS

interface Frontmatter {
  phase?: string;
  slug?: string;
  updated?: string;
}

function parseFrontmatter(content: string): Frontmatter | null {
  // Split on \r?\n (mirrors ArchivePromote.hook.ts): a CRLF-authored PRD must
  // parse identically to the mover, else R92 goes blind to the exact leak class
  // it exists to catch (the mover promotes CRLF PRDs; R92 must audit them).
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;
  const endIdx = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (endIdx === -1) return null;
  const fm: Frontmatter = {};
  for (let i = 1; i < endIdx; i++) {
    const m = lines[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    if (k === "phase" || k === "slug" || k === "updated") {
      fm[k as keyof Frontmatter] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return fm;
}

// Collect PRD dirs from flat WORK/{slug} + WORK/active/{slug} (RFC-0037 §4.1).
// NOT archived/ — that cold bucket is intentionally parked (mirrors the MOVER,
// ArchivePromote, which also descends active/ only).
function collectPrdDirs(workRoot: string): Array<{ dirName: string; prdPath: string }> {
  const out: Array<{ dirName: string; prdPath: string }> = [];
  const scan = (base: string, isRoot: boolean): void => {
    if (!existsSync(base)) return;
    let entries: string[];
    try {
      entries = readdirSync(base);
    } catch {
      return;
    }
    for (const name of entries) {
      if (isRoot && (name === "active" || name === "archived")) continue; // buckets handled below
      const dir = join(base, name);
      try {
        if (!statSync(dir).isDirectory()) continue;
      } catch {
        continue;
      }
      const prdPath = join(dir, "PRD.md");
      if (existsSync(prdPath)) out.push({ dirName: name, prdPath });
    }
  };
  scan(workRoot, true);
  scan(join(workRoot, "active"), false);
  return out;
}

export async function r92CompletePrdPastSoak(ctx: CheckContext): Promise<CheckResult> {
  const workRoot = join(ctx.repoRoot, "MEMORY", "WORK");
  if (!existsSync(workRoot)) {
    return {
      rId: "R92",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: [`${workRoot} not found — no PRD corpus to audit`],
    };
  }

  const nowMs = ctx.nowMs ?? Date.now();
  const cutoffMs = nowMs - SOAK_DAYS * 24 * 60 * 60 * 1000;

  const stale: string[] = [];
  for (const { dirName, prdPath } of collectPrdDirs(workRoot)) {
    let content: string;
    try {
      content = readFileSync(prdPath, "utf-8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    if (!fm || fm.phase !== "complete") continue;
    const updatedMs = Date.parse(fm.updated ?? "");
    if (Number.isNaN(updatedMs) || updatedMs >= cutoffMs) continue;

    // Mirror ArchivePromote's one-way collision guard (ISC-A4.4): the mover
    // derives ARCHIVE/{YYYY-MM}/{dirName} from the updated month and SKIPS
    // promotion when that target already exists (a re-opened slug whose archive
    // was already written). Such a PRD is operator-intended to stay in WORK, not
    // a leak — so R92 must not flag it, or it emits a standing unfixable fail.
    const month = new Date(updatedMs).toISOString().slice(0, 7); // YYYY-MM
    const archiveTarget = join(workRoot, "..", "ARCHIVE", month, dirName);
    if (existsSync(archiveTarget)) continue;

    stale.push(fm.slug ?? dirName);
  }

  if (stale.length === 0) {
    return {
      rId: "R92",
      requirement: REQUIREMENT,
      status: "pass",
      evidence: [`no phase:complete PRDs older than ${SOAK_DAYS}d remain under MEMORY/WORK`],
    };
  }

  return {
    rId: "R92",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [
      `${stale.length} phase:complete PRD(s) past the ${SOAK_DAYS}d soak still under MEMORY/WORK (should be in MEMORY/ARCHIVE):`,
      ...stale.slice(0, 10).map((s) => `  ${s}`),
      ...(stale.length > 10 ? [`  (+${stale.length - 10} more)`] : []),
      `Fix: ArchivePromote.hook.ts promotes these at SessionEnd; if it did not fire, move each to MEMORY/ARCHIVE/{YYYY-MM}/{slug}/.`,
    ],
  };
}
