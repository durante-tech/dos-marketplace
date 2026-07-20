/**
 * R62 (RFC-0098 §13.4) — Reflection JSONL entries must carry the canonical
 * 8-field runtime shape: {timestamp, effort, phase, prd_id, implied_sentiment,
 * reflection, session_id, tags}.
 *
 * Background: catalog `molecules/reflection-jsonl-entry.md ## Drift Watch`
 * documents the D5 doctrine ↔ runtime schema drift. Doctrine prescribed 12
 * fields per Algorithm v0.0.8 §6.7; runtime emits 8 fields. R62 chooses runtime
 * as the canonical shape going forward; doctrine update is a v0.0.17 cascade
 * candidate.
 *
 * Pass: last 50 entries in algorithm-reflections.jsonl all carry exactly the 8
 * canonical fields (extra fields permitted but no missing fields).
 * Fail: any entry missing one of the 8 canonical fields.
 * Not_applicable: reflections JSONL missing OR empty OR <1 entry.
 *
 * Tier: warning per RFC-0085 council default.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { CheckContext, CheckResult } from "../types.ts";

const REQUIREMENT =
  "Reflection JSONL entries carry the canonical 8-field runtime shape: timestamp, effort, phase, prd_id, implied_sentiment, reflection, session_id, tags";

const CANONICAL_FIELDS = ["timestamp", "effort", "phase", "prd_id", "implied_sentiment", "reflection", "session_id", "tags"];
const SAMPLE_SIZE = 50;

// R62 ratified 2026-05-14 (RFC-0098 §13.4 D5 schema-drift resolver shipped
// this date). Reflection JSONL entries emitted before this cutoff used the
// older 12-field doctrine shape OR earlier minimal shapes — they could not
// have followed the canonical 8-field runtime contract that did not exist
// yet. Entries whose `timestamp` field predates the cutoff are skipped
// silently; rule intent (catch forward shape drift) is preserved.
const R62_CUTOFF_MS = new Date("2026-05-14T00:00:00Z").getTime();

function resolveReflectionsPath(ctx: CheckContext): string | null {
  const home = homedir();
  const candidates = [
    join(ctx.repoRoot, "MEMORY", "LEARNING", "REFLECTIONS", "algorithm-reflections.jsonl"),
    join(home, ".claude", "MEMORY", "LEARNING", "REFLECTIONS", "algorithm-reflections.jsonl"),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

function tailLines(content: string, n: number): string[] {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  return lines.slice(-n);
}

export async function r62ReflectionJsonlFieldsStable(ctx: CheckContext): Promise<CheckResult> {
  const path = resolveReflectionsPath(ctx);
  if (!path) {
    return {
      rId: "R62",
      requirement: REQUIREMENT,
      status: "not_applicable",
      evidence: ["algorithm-reflections.jsonl not found"],
    };
  }

  let content: string;
  try { content = readFileSync(path, "utf-8"); } catch (e) {
    return { rId: "R62", requirement: REQUIREMENT, status: "not_applicable", evidence: [`could not read reflections JSONL: ${(e as Error).message}`] };
  }
  const lines = tailLines(content, SAMPLE_SIZE);
  if (lines.length === 0) {
    return { rId: "R62", requirement: REQUIREMENT, status: "not_applicable", evidence: ["reflections JSONL has no entries"] };
  }

  const fails: string[] = [];
  let scannedPostCutoff = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let obj: Record<string, unknown>;
    try { obj = JSON.parse(line); } catch {
      fails.push(`line ${i + 1}: invalid JSON`);
      continue;
    }

    // Legacy exemption: entries timestamped before R62 cutoff (2026-05-14)
    // used pre-canonical shapes. Skip silently; rule's intent (forward drift)
    // preserved.
    const ts = (obj.timestamp as string) ?? "";
    const tsMs = ts ? new Date(ts).getTime() : NaN;
    if (!isNaN(tsMs) && tsMs < R62_CUTOFF_MS) continue;
    scannedPostCutoff++;

    const missing = CANONICAL_FIELDS.filter((f) => !(f in obj));
    if (missing.length > 0) {
      fails.push(`${ts || "<no-ts>"}: missing [${missing.join(", ")}]`);
    }
  }

  if (fails.length === 0) {
    if (scannedPostCutoff === 0) {
      return { rId: "R62", requirement: REQUIREMENT, status: "not_applicable", evidence: [`all ${lines.length} sampled entries predate cutoff 2026-05-14 — no post-cutoff entries to verify`] };
    }
    return { rId: "R62", requirement: REQUIREMENT, status: "pass", evidence: [`${scannedPostCutoff} post-cutoff reflection entries all carry 8 canonical fields (${lines.length - scannedPostCutoff} legacy entries skipped)`] };
  }
  return {
    rId: "R62",
    requirement: REQUIREMENT,
    status: "fail",
    evidence: [`${fails.length}/${lines.length} sampled entries malformed:`, ...fails.slice(0, 5)],
  };
}
