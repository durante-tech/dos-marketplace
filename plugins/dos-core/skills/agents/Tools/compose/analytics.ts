import { readFileSync, existsSync, mkdirSync, writeFileSync, appendFileSync, renameSync } from "fs";
import { dirname } from "path";
import type { ComposedAgent } from "./types.ts";
import { ANALYTICS_PATH, ARTIFACTS_PATH } from "./constants.ts";
import { slugify } from "./compose.ts";

export function logComposition(agent: ComposedAgent, councilType?: string): void {
  try {
    mkdirSync(dirname(ANALYTICS_PATH), { recursive: true });
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      traits: agent.traits,
      name: agent.name,
      voice_id: agent.voiceId,
      color: agent.color,
      council_type: councilType || null,
    });
    appendFileSync(ANALYTICS_PATH, entry + "\n", "utf-8");
  } catch {
    // Silent fail — analytics should never break composition
  }
}

export function resolveSessionId(): string {
  return (
    process.env.DOS_SESSION_ID ??
    process.env.CLAUDE_SESSION_ID ??
    `pid-${process.pid}`
  );
}

export function emitArtifactRow(
  agent: ComposedAgent,
  opts: { persisted: boolean; savedPath: string | null; agentCount: number },
): void {
  try {
    mkdirSync(dirname(ARTIFACTS_PATH), { recursive: true });

    const timestamp = new Date().toISOString();
    const slug = slugify(agent.name);
    const path =
      opts.persisted && opts.savedPath
        ? opts.savedPath
        : `ephemeral://compose/${timestamp}-${slug}`;
    const contentPreview = `traits: ${agent.traits.join(",")}`.slice(0, 200);

    const row = JSON.stringify({
      timestamp,
      pack: "Agents",
      workflow: "compose",
      type: "composition",
      title: agent.name,
      path,
      contentPreview,
      wing: "durante",
      sessionId: resolveSessionId(),
      persisted: opts.persisted,
      agentCount: opts.agentCount,
    });

    try {
      const existing = existsSync(ARTIFACTS_PATH)
        ? readFileSync(ARTIFACTS_PATH, "utf-8")
        : "";
      const body = existing + row + "\n";
      const tmp = `${ARTIFACTS_PATH}.tmp-${process.pid}`;
      // writeArtifact:exempt — atomic tmp write (rename follows)
      writeFileSync(tmp, body, "utf-8");
      renameSync(tmp, ARTIFACTS_PATH);
    } catch {
      appendFileSync(ARTIFACTS_PATH, row + "\n", "utf-8");
    }
  } catch {
    // Silent fail — emission must never break composition CLI (RFC-0017 §4.2)
  }
}

export function showAnalytics(): void {
  if (!existsSync(ANALYTICS_PATH)) {
    console.log("No composition data yet. Compose agents to start collecting analytics.");
    return;
  }

  const lines = readFileSync(ANALYTICS_PATH, "utf-8").trim().split("\n").filter(Boolean);
  const entries = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  if (entries.length === 0) {
    console.log("No valid composition entries found.");
    return;
  }

  const comboCounts: Record<string, number> = {};
  const traitCounts: Record<string, number> = {};
  const councilCounts: Record<string, number> = {};

  for (const e of entries) {
    const key = [...e.traits].sort().join(",");
    comboCounts[key] = (comboCounts[key] || 0) + 1;
    for (const t of e.traits) {
      traitCounts[t] = (traitCounts[t] || 0) + 1;
    }
    if (e.council_type) {
      councilCounts[e.council_type] = (councilCounts[e.council_type] || 0) + 1;
    }
  }

  const sortedCombos = Object.entries(comboCounts).sort((a, b) => b[1] - a[1]);
  const sortedTraits = Object.entries(traitCounts).sort((a, b) => b[1] - a[1]);
  const sortedCouncils = Object.entries(councilCounts).sort((a, b) => b[1] - a[1]);

  console.log(`TRAIT COMPOSITION ANALYTICS (${entries.length} total compositions)\n`);

  console.log("TOP TRAIT COMBOS:");
  for (const [combo, count] of sortedCombos.slice(0, 10)) {
    console.log(`  ${count.toString().padStart(3)}x  ${combo}`);
  }

  console.log("\nMOST USED TRAITS:");
  for (const [trait, count] of sortedTraits.slice(0, 15)) {
    console.log(`  ${count.toString().padStart(3)}x  ${trait}`);
  }

  if (sortedCouncils.length > 0) {
    console.log("\nCOUNCIL USAGE:");
    for (const [type, count] of sortedCouncils) {
      console.log(`  ${count.toString().padStart(3)}x  ${type}`);
    }
  }

  const allTraitNames = new Set(Object.keys(traitCounts));
  console.log(`\nUNIQUE TRAITS USED: ${allTraitNames.size}`);
  console.log(`FIRST COMPOSITION: ${entries[0].timestamp}`);
  console.log(`LATEST COMPOSITION: ${entries[entries.length - 1].timestamp}`);
}
