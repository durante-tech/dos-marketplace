---
name: Create Agent Pack
description: Scaffold a new executable agent pack from the shared agent runtime pattern.
status: STABLE
---

# Create Agent Pack Workflow

Scaffold a new autonomous DOS agent pack using the shared runtime.

## Step 1: Read the Reference Implementation

**REQUIRED FIRST:** Read the DailyBrief agent to understand the pattern:

1. `Packs/agents/DailyBrief/src/config/sources.ts` — how data sources are registered
2. `Packs/agents/DailyBrief/src/config/prompts.ts` — how system prompts are structured
3. `Packs/agents/DailyBrief/src/index.ts` — how the CLI entry point works
4. `Packs/agents/_runtime/agent-pipeline.ts` — the shared pipeline (DON'T duplicate this)

## Step 2: Interview — Understand the Agent Domain

Ask the user these questions (batch them, don't ask one at a time):

### Domain Questions
1. **What does this agent monitor/analyze?** (e.g., "customer health in Donne CRM", "content pipeline from research vaults", "convention drift across repos")
2. **What Studio API endpoints should it read?** List the relevant endpoints from the available set:

   | Available Endpoints | What They Contain |
   |---|---|
   | `/api/v1/sessions` | Session activity, projects, durations |
   | `/api/v1/commitments` | Open commitments, deadlines, assignees |
   | `/api/v1/work` | Active PRDs, stalled items |
   | `/api/v1/failures` | Failure patterns by project |
   | `/api/v1/corrections` | Behavioral corrections |
   | `/api/v1/signals` | Rating trajectory |
   | `/api/v1/memory/health` | Per-wing drawer counts, staleness |
   | `/api/v1/hooks/health` | Hook execution health |
   | `/api/v1/kg/entities` | Knowledge graph stats |
   | `/api/v1/plans` | Pending plans/specs |
   | `/api/v1/artifacts` | Recent skill outputs |
   | `/api/v1/reconciliation/full` | Sync drift detection |

   The user may also need **project-specific endpoints** (e.g., Donne CRM data). These may require new Studio API routes — flag this as a prerequisite.

3. **What output sections should the brief contain?** (e.g., "Pipeline Health", "Deal Risk", "Stale Leads")
4. **What cadence?** (daily, weekly, on-demand)
5. **What should the analysis tone be?** (opinionated/analytical/neutral)
6. **What wing does this belong to?** (durante, altyaa, donne, etc.)

## Step 3: Determine Names

| Component | Convention | Example |
|-----------|-----------|---------|
| Pack directory | TitleCase | `CustomerPulse`, `WeeklyDigest`, `ConventionDrift` |
| Agent name (display) | Human-readable | "Customer Pulse Brief", "Weekly Digest" |
| CLI slug | kebab-case | `customer-pulse`, `weekly-digest` |

## Step 4: Create the Pack Directory

```bash
mkdir -p Packs/agents/{PackName}/src/config
```

Only create `src/config/` — the runtime is shared from `_runtime/`. Do NOT create `lib/` or `runtime/` directories.

## Step 5: Generate `config/sources.ts`

Create the data source registry. Import the `DataSource` type from the shared runtime.

**Template:**

```typescript
/**
 * Data source registry for {AgentName}.
 */

import type { DataSource } from "../../_runtime/data-collector";

export const DATA_SOURCES: DataSource[] = [
  {
    id: "{source_id}",
    label: "{Human Label}",
    path: "/api/v1/{endpoint}",
    params: { limit: "20" },  // optional
    briefSection: "{Section Name}",
  },
  // ... one entry per data source
];
```

Map the user's domain requirements to Studio API endpoints. Include only the endpoints relevant to this agent — don't blindly copy all 12 from DailyBrief.

## Step 6: Agent Identity via Trait Composition (Optional)

If the agent pack benefits from a composed personality (specific expertise + personality + approach style), use the agents skill trait system to generate the system prompt foundation:

```bash
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "<expertise>,<personality>,<approach>" --output json
```

The returned `prompt` field provides a rich personality template. Merge it with the domain-specific analysis rules in `config/prompts.ts` below. The `voice_id` and `voice_settings` can be used if the agent sends voice notifications.

**Example:** A customer health agent might compose with `sales,analytical,investigative` to get a naturally sales-oriented, data-driven, investigate-first personality.

This is optional — many agent packs (like DailyBrief) work fine with hand-crafted system prompts. Use trait composition when you want consistency with the broader Agents trait library.

See `~/.claude/skills/agents/Partials/TraitComposition.md` for the full pattern.

## Step 7: Generate `config/prompts.ts` (or enhance with traits from Step 6)

Create the system prompt and user message builder. The system prompt is the agent's personality — it determines the quality of the output.

**Template:**

```typescript
/**
 * Inference prompts for {AgentName}.
 */

export const SYSTEM_PROMPT = `You are the {Role Description} for DuranteOS (DOS). You produce {output_description}.

Rules:
- {Domain-specific analysis rules}
- {What to surface/flag/recommend}
- Skip sections with no actionable data.
- Use exact numbers. Never round or approximate.
- Keep it under {word_limit} words total.
- Sections marked [unavailable] had data source failures — acknowledge but don't speculate.
- Format as clean Markdown with the section structure provided.`;

export function buildUserMessage(collectedData: Record<string, unknown>): string {
  const sections = Object.entries(collectedData)
    .map(([sourceId, data]) => {
      if (data === null) return \`### \${sourceId}\\n[unavailable]\`;
      return \`### \${sourceId}\\n\\\`\\\`\\\`json\\n\${JSON.stringify(data)}\\n\\\`\\\`\\\`\`;
    })
    .join("\\n\\n");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  return \`Generate the {AgentName} for \${today}.

Here is the raw data from {N} Studio API endpoints. Synthesize into these sections:

{numbered section list}

DATA:

\${sections}\`;
}
```

**Critical:** The system prompt must instruct **opinionated analysis**, not data dumping. Include domain-specific rules about what patterns to surface, what risks to flag, and what actions to recommend.

## Step 7.5: Generate `agent.yaml` (M2 — portable agent manifest)

Write a YAML manifest alongside the pack that captures the agent's identity (name, model, system prompt, tools) in Anthropic's canonical `ant beta:agents create` format. This ships DOS agents as forward-compatible with the Managed Agents API (M1 activation is `ant beta:agents create < agent.yaml`).

**Skip this step for non-LLM packs.** If the agent does NOT call `GatewayClient.infer()` and has no `SYSTEM_PROMPT` constant (e.g., `PalaceMaintenance` which only runs MemPalace reconciliation), the manifest has no meaningful content. Add a one-line note to the pack's `README.md` or `./src/index.ts` header: `// No LLM inference — no agent.yaml per Plans/Specs/RFC-0022-agent-manifest.md skip rule`.

**File path:** `Packs/agents/{PackName}/agent.yaml` (copy-4 only; no submodule mirror).

**Template:**

```yaml
name: {Human-Readable Name}
description: {One-line summary, up to 2048 chars}
model: claude-sonnet-4-6
system: |
  {VERBATIM copy of the SYSTEM_PROMPT constant from src/config/prompts.ts.
   Use YAML | literal block for multiline. Match the TS source at scaffold
   time — drift is allowed afterward.}
tools: []
metadata:
  wing: {durante|altyaa|donne|...}
  cadence: {daily|weekly|reactive|on-demand}
  owner: lucas
  runtime: bun
  pack_dir: Packs/agents/{PackName}
  ts_source_prompt: src/config/prompts.ts
```

**Rules:**
- `model` mirrors the runtime default (today: `claude-sonnet-4-6` for scheduled briefs, same for reactive executors; advisor tier happens per-call via H6, not in the manifest).
- `tools: []` — DOS agents use `GatewayClient` via Studio, not the Managed Agents `agent_toolset_20260401`. Flip to `[{type: agent_toolset_20260401}]` only at M1 activation.
- `system` must be VERBATIM from TS at scaffold time. Pastes cleanly with YAML `|` literal block syntax.
- `metadata` keys ≤64 chars, values ≤512 chars. Use the listed keys as a baseline; add agent-specific keys as needed (e.g. `advisor_policy` for reactive agents).

**Verify the file parses:**

```bash
bun ~/.claude/skills/utilities/SchemaCheck/Tools/ValidateYamlKeys.ts Packs/agents/{PackName}/agent.yaml --json
```

**Why this step exists:** Plans/Specs/RFC-0022-agent-manifest.md has the full rationale — the short version is M2 decouples "capture agent identity" from "migrate to managed-agents (M1)". Every LLM pack ships with the YAML from day one so M1 is flip-switch, not redesign.

## Step 8: Generate `index.ts`

Create the CLI entry point that imports the shared pipeline.

**Template:**

```typescript
#!/usr/bin/env bun
/**
 * {AgentName} — CLI entry point.
 *
 * Usage:
 *   bun Packs/agents/{PackName}/src/index.ts
 *   bun Packs/agents/{PackName}/src/index.ts --dry-run
 *   bun Packs/agents/{PackName}/src/index.ts --provider google --model gemini-2.5-flash
 *
 * Environment:
 *   STUDIO_URL     — Studio base URL (default: http://localhost:3000)
 *   STUDIO_API_KEY — Gateway Bearer token (required)
 *   NOTIFY_URL     — ntfy/Discord webhook URL (optional)
 */

import { parseArgs } from "util";
import { runAgentPipeline } from "../../_runtime/agent-pipeline";
import { DATA_SOURCES } from "./config/sources";
import { SYSTEM_PROMPT, buildUserMessage } from "./config/prompts";
import type { GatewayProvider } from "../../_runtime/gateway-client";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "dry-run": { type: "boolean", default: false },
    provider: { type: "string" },
    model: { type: "string" },
    output: { type: "string" },
    "max-tokens": { type: "string" },
    help: { type: "boolean", default: false },
  },
  strict: true,
});

if (values.help) {
  console.log(\`
DOS {AgentName}

Usage: bun index.ts [options]

Options:
  --dry-run       Collect data but skip inference
  --provider <p>  Override provider (anthropic|google|xai|perplexity)
  --model <id>    Override model (default: claude-sonnet-4-6)
  --output <path> Override output file path
  --max-tokens <n> Max output tokens (default: 2048)
  --help          Show this message

Environment:
  STUDIO_URL      Studio base URL (default: http://localhost:3000)
  STUDIO_API_KEY  Gateway Bearer token (required)
  NOTIFY_URL      ntfy/Discord webhook URL (optional)
\`);
  process.exit(0);
}

const studioUrl = process.env.STUDIO_URL ?? "http://localhost:3000";
const apiKey = process.env.STUDIO_API_KEY;

if (!apiKey) {
  console.error("Error: STUDIO_API_KEY environment variable is required");
  process.exit(1);
}

console.log("=== DOS {AgentName} ===");
console.log(\`Studio: \${studioUrl}\`);
console.log(\`Provider: \${values.provider ?? "anthropic"}\`);
console.log(\`Model: \${values.model ?? "claude-sonnet-4-6"}\`);
console.log(\`Mode: \${values["dry-run"] ? "DRY RUN" : "LIVE"}\`);
console.log("");

const result = await runAgentPipeline({
  studioUrl,
  apiKey,
  provider: (values.provider as GatewayProvider) ?? undefined,
  model: values.model,
  maxTokens: values["max-tokens"] ? parseInt(values["max-tokens"], 10) : undefined,
  agentName: "{AgentName}",
  packName: "{PackName}",
  sources: DATA_SOURCES,
  systemPrompt: SYSTEM_PROMPT,
  buildUserMessage,
  dryRun: values["dry-run"],
  outputPath: values.output,
  notifyUrl: process.env.NOTIFY_URL,
  wing: "{wing}",
});

console.log("");
console.log(\`=== Complete (\${result.durationMs}ms) ===\`);
console.log(\`Sources: \${result.collection.successCount} OK, \${result.collection.failureCount} failed\`);
if (result.inference?.ok) {
  console.log(\`Credits: \${result.inference.chargedCredits}\`);
  console.log(\`Tokens: \${result.inference.usage.inputTokens} in / \${result.inference.usage.outputTokens} out\`);
}
if (result.outputPath) {
  console.log(\`Output: \${result.outputPath}\`);
}
```

## Step 9: Test the Agent

```bash
source ~/.claude/.env
STUDIO_URL=$STUDIO_API_URL STUDIO_API_KEY=$STUDIO_API_KEY bun Packs/agents/{PackName}/src/index.ts --dry-run
```

**Verify:**
- All configured endpoints return data
- Dry run report shows byte counts per source
- Output file is written to MEMORY/WORK/
- Artifact logged to artifacts.jsonl

## Step 10: Wire to Cron (Optional)

If the agent should run on a schedule, use Claude Code's `/schedule` to create a RemoteTrigger:

```
/schedule create --name "{agent-name}" --cron "0 10 * * 1-5" --prompt "Run the {AgentName}: source ~/.claude/.env && STUDIO_URL=$STUDIO_API_URL STUDIO_API_KEY=$STUDIO_API_KEY bun Packs/agents/{PackName}/src/index.ts"
```

## Step 11: Ecosystem Integration

1. **MemPalace** — Register the agent in KG (`has_agent` predicate)
2. **Artifact Tracking** — Already handled by the shared pipeline
3. **Four-Copy Rule** — Agent packs are Copy 4 (`Packs/agents/`). The CreateAgentPack skill itself follows Copies 1-3 as a prompt skill. See CLAUDE.md "The Four Copies" for the full matrix.

## Checklist

Before declaring done:

- [ ] `config/sources.ts` has only the endpoints this agent needs
- [ ] `config/prompts.ts` system prompt is opinionated, not generic
- [ ] `index.ts` imports from `../../_runtime/` (not local copies)
- [ ] `--dry-run` succeeds with all endpoints returning data
- [ ] No files duplicated from `_runtime/` into the pack
- [ ] Agent name and pack name follow TitleCase convention
- [ ] Artifact tracking works (check artifacts.jsonl after run)

## Available Extension Agents (from spec)

These are the next agents to build with this workflow:

| Agent | Purpose | Key Data Sources |
|-------|---------|-----------------|
| WeeklyDigest | Deeper weekly analysis with trends | sessions, signals, failures, work |
| CommitmentWatchdog | Alert when deadlines approach | commitments |
| ConventionDrift | Re-run Sentinel on unhealthy projects | memory/health, reconciliation |
| ContentPipeline | Auto-generate newsletter drafts | artifacts, research vaults |
| CustomerPulse | CRM pipeline health (Donne) | Donne-specific endpoints |
