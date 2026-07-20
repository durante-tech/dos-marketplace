#!/usr/bin/env bun
/**
 * EmitProgram.ts — deterministically scaffold the `docs/growth/` program skeleton
 * from a GrowthProgram preset + a campaign subject.
 *
 * Why a tool: the section templates + stable-ID scaffolding live HERE, out of the
 * model's context (the carta-investors renderer pattern). The GrowthProgram
 * workflows then FILL the skeleton. The tool NEVER invents data — it emits
 * placeholders, TODO markers, and the preset's channel/cadence/GEO pre-fill only.
 *
 * Usage:
 *   bun EmitProgram.ts --subject "be the default booking tool for salons" \
 *       --preset local-smb-french [--out docs/growth] [--force]
 *
 * Exit: 0 ok · 2 bad args / unknown preset.
 */
import { mkdirSync, writeFileSync, appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const arg = (flag: string, def = ""): string => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : def;
};
const subject = arg("--subject");
const presetName = arg("--preset");
const out = arg("--out", "docs/growth");
const force = argv.includes("--force");

if (!subject) {
  console.error("error: --subject is required");
  process.exit(2);
}

// Resolve the Presets/ dir relative to this script (Tools/ -> ../Presets).
// fileURLToPath (not .pathname) so the Windows `/C:/...` form resolves correctly.
const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const presetsDir = join(scriptDir, "..", "Presets");

let presetRaw = "";
if (presetName) {
  // --preset is a bare preset name, never a path — reject traversal out of Presets/.
  if (/[\\/]/.test(presetName) || presetName.includes("..")) {
    console.error(`error: --preset must be a bare preset name, not a path: '${presetName}'`);
    process.exit(2);
  }
  const file = join(presetsDir, presetName.endsWith(".yaml") ? presetName : `${presetName}.yaml`);
  if (!existsSync(file)) {
    const avail = readdirSync(presetsDir)
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.replace(".yaml", ""))
      .join(", ");
    console.error(`error: preset '${presetName}' not found. available: ${avail}`);
    process.exit(2);
  }
  presetRaw = readFileSync(file, "utf8");
}
// Minimal field reads (presets are simple, flat-ish YAML).
const field = (k: string): string =>
  (presetRaw.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1] ?? "").trim();
const locale = field("locale") || "TBD";
const market = field("market") || "TBD";
// Q1 is the first locale-specific query (GeoPillar seeds 15 locale / 15 EN). Seed it
// with the preset's primary locale when known, so the row matches the file header
// ("EN + <locale>") instead of always claiming `en` (issue #70).
const q1Locale = field("locale") || "en";
// Preset GEO engines live as a nested array (`  engines: [a, b, c]`) that the
// flat field() reader can't see; parse it directly. Falls back to a default set.
const presetEngines = (presetRaw.match(/^\s*engines:\s*\[([^\]]*)\]/m)?.[1] ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean).join(", ");
const presetBlock = presetRaw
  ? "```yaml\n" + presetRaw.trim() + "\n```"
  : "_No preset selected — derive channels/cadence/GEO from project knowledge._";

// Artifact tracking (DOS convention). Off unless --artifacts-log <path> is given — in a DOS install the
// ArtifactAutoLogger hook captures writes automatically; this flag is the portable explicit alternative
// for non-DOS installs. Appends one MEMORY/ARTIFACTS/artifacts.jsonl-shaped entry per file written.
const artifactsLog = arg("--artifacts-log");
const sessionId = process.env.CLAUDE_SESSION_ID || process.env.CC_SESSION_ID || "";
const logArtifact = (rel: string, body: string): void => {
  if (!artifactsLog) return;
  mkdirSync(dirname(artifactsLog), { recursive: true });
  appendFileSync(
    artifactsLog,
    JSON.stringify({
      ts: new Date().toISOString(),
      pack: "GrowthProgram",
      workflow: "EmitProgram",
      type: "growth-program-skeleton",
      title: rel,
      path: join(out, rel),
      contentPreview: body.slice(0, 200).replace(/\s+/g, " ").trim(),
      sessionId,
    }) + "\n",
  );
};

let wrote = 0;
let skipped = 0;
const emit = (rel: string, body: string): void => {
  const path = join(out, rel);
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path) && !force && readFileSync(path, "utf8").trim()) {
    console.log(`  skip (exists) ${rel}`);
    skipped++;
    return;
  }
  // writeArtifact:exempt — portable scaffolder; logged via logArtifact() (--artifacts-log) + ArtifactAutoLogger hook
  writeFileSync(path, body);
  logArtifact(rel, body);
  console.log(`  wrote ${rel}`);
  wrote++;
};

const H = `<!-- GrowthProgram skeleton — subject: ${subject} | preset: ${presetName || "(none)"} | locale: ${locale}\n     Fill via the matching GrowthProgram workflow. Stable IDs (disjoint social vs GEO namespaces; never reuse a number across them): C* campaigns · M* milestones (social/program) · GC* GEO campaigns · GM* GEO milestones · P*/PH* GEO phases · Q* SoAV. -->`;
const TODO = "> TODO (workflow fills this) —";

emit("strategy.md", `${H}\n# Strategy — ${subject}\n\n_Market: ${market} · Locale: ${locale}. Filled by **BrandChannelStrategy**._\n\n## Brand voice (5 traits, each do/don't)\n${TODO} 5 traits + 3 banned moves + reading grade.\n\n## Visual tokens\n${TODO} primary/secondary/accent · type pairing · logo path.\n\n## ICP framework (segments × JTBD × where-they-are)\n| ICP | Persona | Job-to-be-done | Where they are (source) |\n|---|---|---|---|\n| ICP1 |  |  |  |\n\n## Channel-selection matrix (SELECT / HOLD / CUT)\n| Channel | ICP-fit | Format-fit | Market/locale-fit | Effort/ROI | Verdict |\n|---|---|---|---|---|---|\n\n## Wedge / positioning axis\n| Axis | ${subject} | Incumbent A | Incumbent B |\n|---|---|---|---|\n\n## Preset baseline\n${presetBlock}\n`);

emit("campaigns.md", `${H}\n# Campaigns — ${subject}\n\n_Filled by **CampaignCalendar**._\n\n## Overview\n| ID | Campaign | Pillar(s) | Channels | Success signal | Owner |\n|---|---|---|---|---|---|\n| C1 |  |  |  |  |  |\n\n## Briefs\n### C1 — <name>\n- **Hypothesis:** ${TODO}\n- **Channels / Offer / Success signal / Owner:** ${TODO}\n`);

emit("content-calendar.md", `${H}\n# Content Calendar — ${subject}\n\n_Dated, per-channel. Filled by **CampaignCalendar**. Content-pillar mix: educate / inspire / convert._\n\n| Date | Channel | Campaign | Format | Hook | Status |\n|---|---|---|---|---|---|\n|  |  | C1 |  |  | draft |\n`);

emit("materials/README.md", `${H}\n# Materials — ${subject}\n\n_Produced + the repeatable production spec. Filled by **MaterialsEngine** (media pack)._\n\n## Production spec (brand-locked templates)\n${TODO} per-format specs (reel/carousel/static), naming, asset IDs, QA checklist.\n`);

emit("social-media-plan.md", `${H}\n# Social Presence Ops — ${subject}\n\n_The publish → engage → insights loop. Filled by **PresenceOps**. NEVER auto-publish — approval gate required._\n\n## Per-channel playbook\n${TODO} posting best-practice, optimal times, reply windows, UGC/community.\n\n## Ops loop + approval gate\n${TODO}\n`);

emit("geo/recommendation-roadmap.md", `${H}\n# GEO/AEO Recommendation Roadmap — ${subject}\n\n_The "be the default AI recommendation" spine. Filled by **GeoPillar**._\n\n## Verified baseline ("you are here") — a SOURCE per row\n| Dimension | Current state | Source / verification |\n|---|---|---|\n\n## Corpus supply-chain (per engine)\n| Engine | Citation diet | Implication |\n|---|---|---|\n\n## The 6 pillars\n${TODO} P1 Entity · P2 On-Site Answer Surface · P3 Third-Party Corpus · P4 Review Density (gated on paying customers) · P5 Topical Authority · P6 Measurement.\n\n## Gating-first sequencing (Tracks A/B/C → PH*)\n${TODO}\n`);

emit("geo/architecture.md", `${H}\n# GEO Architecture ADR — ${subject}\n\n_In-repo answer surface. Filled by **GeoPillar** (Sentinel scan). Skip if no repo._\n\n## Decisions\n${TODO} JSON-LD (Org/Product/FAQ/Article) · llms.txt + llms-full.txt · programmatic /compare /vs /for · hreflang + metadataBase.\n\n## Component / file map\n| Path | Status (verified) | Purpose |\n|---|---|---|\n`);

emit("geo/query-basket.md", `${H}\n# Share-of-AI-Voice Query Basket — ${subject}\n\n_Filled by **GeoPillar** / run by **Measurement**. EN + ${locale}._\n\n<!-- Canonical columns: ID | Query | Lang | Intent | Category. The trailing Engines column is OPTIONAL (per-query engine override); leave it blank to run across the default set / --engines. SoAVRun parses by header name, not position. -->\n\n| ID | Query | Lang | Intent | Category | Engines |\n|---|---|---|---|---|---|\n| Q1 |  | ${q1Locale} | category-best | reputation | ${presetEngines || "chatgpt, perplexity, gemini, claude"} |\n`);

emit("measurement.md", `${H}\n# Measurement — ${subject}\n\n_Both lenses. Filled by **Measurement**._\n\n## Lens A — social insights\n| Channel | KPI | Baseline (T0) | Latest | Δ | Target | Serves |\n|---|---|---|---|---|---|---|\n\n## Lens B — Share-of-AI-Voice (per Q*, per engine, with snippet)\n| Q* | Engine | Presence | Rank | Sentiment | Citation (src) |\n|---|---|---|---|---|---|\n\n## GA4 AI-referral capture\n${TODO} custom channel group "AI Assistants" + source match list.\n`);

emit("coordination.md", `${H}\n# Coordination Hub — ${subject}\n\n_Filled by **Coordination**. No artifact ships until the integrity sign-off passes._\n\n## Roles & Owners\n| Owner | Kind (Human/Agent) | Owns (IDs) |\n|---|---|---|\n\n## RACI (campaigns C* × roles)\n| Campaign | Role A | Role B |\n|---|---|---|\n\n## Milestones (M*) + Gantt\n| ID | Milestone | Advances | W1 | W2 | W3 |\n|---|---|---|---|---|---|\n\n## Integrity sign-off (Skeptic)\n- [ ] Every load-bearing stat sourced or quarantined (DO NOT CITE)\n- [ ] No fake/incentivized reviews · no AggregateRating without verified data\n- [ ] Brand voice + platform ToS respected · reviews pillar gated on paying-customer base\n`);

emit("README.md", `${H}\n# ${subject} — Growth Program\n\nScaffolded by \`GrowthProgram/Tools/EmitProgram.ts\` from preset \`${presetName || "(none)"}\`. Each file is filled by its phase workflow. Stable IDs: C* campaigns · M* milestones · P*/PH* GEO · Q* SoAV.\n`);

console.log(`\nEmitProgram: ${wrote} written, ${skipped} skipped → ${out}/`);
