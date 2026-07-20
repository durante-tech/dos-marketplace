import { existsSync, readFileSync } from "fs";
import { createHash } from "crypto";
import { ARTIFACTS_PATH } from "./constants.ts";
import type { ArtifactRow } from "./types.ts";

/**
 * Canonical composition identity — sha256(title + "|" + sorted(traits).join(",")).
 * Input MUST match what `emitArtifactRow()` writes (title = agent.name, traits = agent.traits)
 * so gate-side identity lookup matches emission-side identity exactly (§3, §8.1).
 */
export function computeCompositionIdentity(title: string, traits: string[]): string {
  const sortedTraits = [...traits].sort().join(",");
  return createHash("sha256").update(`${title}|${sortedTraits}`).digest("hex");
}

/**
 * Extract trait list from a row's contentPreview field.
 * emitArtifactRow writes `traits: a,b,c`; we parse that back.
 */
export function traitsFromContentPreview(preview: string): string[] {
  const m = preview.match(/^traits:\s*(.+)$/);
  if (!m) return [];
  return m[1].split(",").map((t) => t.trim()).filter(Boolean);
}

/**
 * Read artifacts.jsonl and return parsed rows. Malformed lines are silently
 * skipped (non-blocking §4.2) but logged to stderr for observability.
 */
export function parseArtifactsJsonl(): ArtifactRow[] {
  if (!existsSync(ARTIFACTS_PATH)) return [];
  const raw = readFileSync(ARTIFACTS_PATH, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const rows: ArtifactRow[] = [];
  let malformed = 0;
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row && typeof row === "object") rows.push(row as ArtifactRow);
    } catch {
      malformed++;
    }
  }
  if (malformed > 0) {
    console.error(`[ComposeAgent] Note: skipped ${malformed} malformed artifacts.jsonl lines during gate computation.`);
  }
  return rows;
}
