---
name: Utilities
description: DOS developer-utility umbrella across five clusters (the future pack boundaries) — SkillFactory (author/validate/scaffold skills, agent-packs, CLIs), DOSEvolution (DOS upgrades, evals, ensembles, RFC-to-loop, track-bootstrap, dep-watch), Content (parse URLs/transcripts/entities; author & convert PDF/DOCX/XLSX/PPTX), SchemaCheck (i18n/mdoc/table/YAML pre-flight validators), and shared utilities (Fabric patterns, meta-prompting templates, audio cleanup, aphorisms). USE WHEN create skill, validate skill, scaffold skill, create CLI, create agent pack, DOS upgrade, run eval, ensemble, rfc to loop, track bootstrap, dep watch, parse content, extract transcript, process document, convert format, schema pre-flight, fabric pattern, render template, clean audio, aphorism. NOT for cloudflare/wrangler deploys (use the cloudflare plugin), browser automation/screenshots (use claude-in-chrome/playwright), or generic prompt-engineering (use the prompt packs).
role: extractor
accepts:
  - text
icon: Wrench
colorVar: primary
colorHex: "#00e1ab"
tier: secondary
category: Engineering
displayLabel: Utilities
marketingDescription: CLI gen, skill scaffolding, Fabric patterns, browser automation
elevator: Developer utilities, CLI gen, Fabric patterns
highlightWorkflows:
  - name: Generate CLI
    technicalName: CreateCli
  - name: Scaffold Skill
    technicalName: CreateSkill
  - name: Execute Pattern
    technicalName: ExecutePattern
roots: []
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
composes: [claude-in-chrome, playwright]
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/Utilities/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

# Utilities

Unified skill for developer utility and tooling workflows.

**Status:** v0.1.0 — Phase-0 hardening floor (lean router, ValidateSkill R1-R15, stale-path parameterization, hygiene, CHANGELOG anchor)

## Clusters

Utilities routes through **five clusters — each names a future pack boundary**
(decomposition is a rename, not a rewrite). Pick the cluster, then the workflow:

1. **SkillFactory** — author, validate, and scaffold skills, agent-packs, and CLIs. Includes ChannelScaffold (voice-pack scaffolding via dos-build + lint-skills).
2. **DOSEvolution** — upgrade DOS, run evals/ensembles, RFC-to-loop, track-bootstrap, dep-watch. Includes CrunchScaffold (surface-crunch research runs).
3. **Content** — parse URLs/transcripts/entities; author and convert OOXML documents.
4. **SchemaCheck** — schema pre-flight validators (i18n, mdoc, table-consumers, YAML keys).
5. **Shared utilities** — Fabric patterns, meta-prompting templates, audio cleanup, aphorisms; plus the curated pointers Cloudflare, Delegation, and Browser (defer-out guidance, no build machinery). *(Full 21-component cluster assignment ratified by operator 2026-07-09 — every sub-component now has a stated home for the v0.0.23 pack split.)*

## Defer To

These triggers look adjacent but belong to other packs — Utilities forwards, never owns:

| If you actually want… | Use | Not |
|---|---|---|
| Cloudflare/wrangler deploy, DNS/KV/R2/D1/Vectorize | the **cloudflare** plugin / `wrangler` | Utilities/Cloudflare keeps only the DOS deploy-auth gotcha |
| Headed browser, screenshots, UI debugging | **claude-in-chrome** / **playwright** / BrowserAgent | Utilities/Browser keeps only CLI-first story tiering |
| URL → markdown scrape | **firecrawl-parse** | Utilities/Documents owns local OOXML authoring only |
| Intelligent Fabric pattern *selection* | the **Research** pack's Fabric-selection workflow | Utilities/Fabric owns the synced pattern corpus (`Patterns/`) + the sync workflow; Research selects over it |
| Generic prompt-engineering | the prompt packs | Utilities/Prompting scopes to programmatic template render/validate |

## Workflow Routing

**Sub-component routing:** references to `<Sub>/SKILL.md` in this skill are FILE PATHS relative to this skill's directory — load them with the Read tool and follow their instructions. Sub-components (its 21 sub-directories: CreateSkill/, DOSUpgrade/, Evals/, Parser/, SchemaCheck/, …) are NOT separately registered skills: never invoke `Skill("utilities:<Component>")` — it fails with "Unknown skill".

| Request Pattern | Route To |
|---|---|
| Create CLI, build CLI, command-line tool, wrap API, TypeScript CLI, add command, upgrade tier | `CreateCLI/SKILL.md` |
| Create skill, new skill, scaffold skill, skill template, canonicalize, validate skill, update skill, fix skill structure | `CreateSkill/SKILL.md` |
| Create agent pack, new agent, scaffold agent, autonomous agent, build agent | `CreateAgentPack/SKILL.md` |
| Parallel execution, agent teams, delegate, 3+ workstreams, agent specialization, swarm | `Delegation/SKILL.md` |
| Upgrade, improve system, check Anthropic, system upgrade, analyze for improvements, new Claude features, algorithm upgrade, mine reflections, find sources, research upgrade, DOS upgrade | `DOSUpgrade/SKILL.md` |
| Eval, evaluate, test agent, benchmark, verify behavior, regression test, capability test, run eval, compare models, compare prompts, create judge, view results | `Evals/SKILL.md` |
| Document, process file, create document, convert format, extract text, PDF, DOCX, XLSX, PPTX, Word, Excel, spreadsheet, PowerPoint, slides, consulting report, large PDF, merge PDF, fill form, tracked changes, redlining | `Documents/SKILL.md` |
| Parse, extract, URL, transcript, entities, JSON, batch, YouTube, PDF content, article, newsletter, Twitter, browser extension, collision detection, detect content type, extract article, extract YouTube, parse content | `Parser/SKILL.md` |
| Clean audio, edit audio, remove filler words, clean podcast, remove ums, cut dead air, polish audio, transcribe, analyze audio, audio pipeline | `AudioEditor/SKILL.md` |
| Fabric, fabric pattern, run fabric, update patterns, sync fabric, summarize, threat model pattern | `Fabric/SKILL.md` |
| Cloudflare, worker, deploy, Pages, MCP server, wrangler, DNS, KV, R2, D1, Vectorize | `Cloudflare/SKILL.md` |
| Browser, screenshot, debug web, verify UI, troubleshoot frontend, automate browser, browse website, review stories, run stories, web automation | `Browser/SKILL.md` |
| Meta-prompting, template generation, prompt optimization, programmatic prompt composition, render template, validate template, prompt engineering | `Prompting/SKILL.md` |
| Aphorism, quote, saying, find quote, research thinker, newsletter quotes, add aphorism, search aphorisms | `Aphorisms/SKILL.md` |
| Release, freeze version, ship it, cut release, open next version, version freeze, prepare release | `Release/Workflows/Release.md` (pack-source only — not deployed to live; run from `~/Durante/Packs/utilities/src/`) |
| RFC to loop, rfc-to-loop, generate loop prompt, rfc delivery prompt, rfc slice, next rfc slice, pack rfc for delivery, rfc loop block, ship rfc slice | `RfcToLoop/SKILL.md` |
| Ensemble, artifact to team, delivery team, team from spec, team from rfc, conductor, ensemble plan, ensemble emit, orchestrate team, multi-teammate delivery, plan ensemble, emit ensemble, spec to team, brief to team | `Ensemble/SKILL.md` |
| Track-bootstrap, bootstrap track, onboard integration, new provider, research package, scaffold track, integration provider, API package bootstrap, multi-PRD provider, provider bootstrap, deliver track, run track, ship track, walk track, deliver all sub-tracks, execute track DAG, process full set of PRDs | `TrackBootstrap/SKILL.md` |
| Surface Crunch, surface crunch skill, scaffold a surface crunch skill, crunch scaffold, build a DOSUpgrade-shaped skill, meta-pattern skill, generate a crunch skill, crunch catalog, surface crunch family | `CrunchScaffold/SKILL.md` |
| Channel Voice, channel voice skill, channel scaffold, scaffold a channel voice skill, mint a voice skill, build a Fowler-shaped skill, channel an author skill, channel voice family, channel voice catalog | `ChannelScaffold/SKILL.md` |
| Dependency check, dep watch, CVE scan, security advisories for dependencies, breaking changes in dependencies, outdated packages, dependency health, supply chain check | `DepWatch/SKILL.md` |
| Schema check, schema pre-flight, schema preflight, validate yaml, yaml duplicate keys, i18n coverage, validate i18n, mdoc frontmatter, validate mdoc, table consumers, validate consumers, prisma migration safety, schema audit | `SchemaCheck/SKILL.md` |

## Examples

**Example 1: Generate a TypeScript CLI that wraps an external API**
```
User: "Build a CLI that wraps the Linear API — list issues, create issues, update status"
→ Routes to CreateCLI/SKILL.md
→ Scaffolds a Bun-runnable TypeScript CLI with subcommands, flag parsing, error handling, and tests
→ User gets a working CLI binary plus README and a test suite, ready to drop into Tools/
```

**Example 2: Scaffold a new DOS skill from scratch**
```
User: "Create a new skill called InvoiceProcessor for parsing and routing PDF invoices"
→ Routes to CreateSkill/SKILL.md
→ Generates the pack scaffold (SKILL.partials.md, Workflows/, frontmatter, voice notification, lint conformance) and registers it in .gitignore via scaffold-internal-pack
→ User gets a lint-clean pack ready for first workflow author plus the four-copy sync verified
```

**Example 3: Delegate parallel workstreams to an agent team**
```
User: "Run 4 workstreams in parallel: lint pass, type-check pass, test pass, doc pass — across the whole repo"
→ Routes to Delegation/SKILL.md
→ Spins up specialized sub-agents with isolated contexts, dispatches each workstream, collects results
→ User gets a consolidated report with per-workstream findings and any cross-workstream conflicts surfaced
```

**Example 4: Scaffold a new Surface Crunch skill**
```
User: "Scaffold a surface crunch skill for competitor moves — bifocal, 4 tiers"
→ Routes to CrunchScaffold/SKILL.md
→ Collects the parameterized domain brief, stamps the surface-crunch-skill bundle into a draft skill plus a decisions-checklist, hands the draft to CreateSkill
→ User gets a draft Surface Crunch skill plus an itemised checklist of the domain work left to fill
```

**Example 5: Crunch a repo's dependencies for risk**
```
User: "Run a dependency check on the dos-prisma-saas-kit repo"
→ Routes to DepWatch/SKILL.md (a Surface Crunch instance)
→ Enumerates the installed dependency set, fans out extraction Threads across advisories / releases / changelogs
→ User gets a 4-tier ranked report — CVEs, breaking changes, and deprecations new since the last run
```

**Example 6: Scaffold a new Channel Voice skill**
```
User: "Channel-scaffold a Brooks skill — corpus: Mythical Man-Month and No Silver Bullet. Lookup: Brooks's Laws. Code prefix: BROOKS."
→ Routes to ChannelScaffold/SKILL.md
→ Validates the 6-field author brief, runs discovery-first probe, stamps the channel-voice-skill bundle into a draft pack
→ User gets a draft Channel Voice skill plus a decisions-checklist enumerating the verbatim-quote curation work (the irreducible 4-8h that cannot be fabricated)
```

## Artifact Tracking

**MANDATORY for any workflow in this skill that writes output files via the Write tool.**

After writing any output file, resolve the ARTIFACTS path and append a JSONL log entry:

```bash
# Resolve ARTIFACTS dir (project-level first)
if [ -d "${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="${CLAUDE_PROJECT_DIR}/MEMORY/ARTIFACTS"
elif [ -d "$(pwd)/MEMORY/ARTIFACTS" ]; then
  ARTIFACTS_DIR="$(pwd)/MEMORY/ARTIFACTS"
else
  ARTIFACTS_DIR="$HOME/.claude/MEMORY/ARTIFACTS"
fi
mkdir -p "$ARTIFACTS_DIR"

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"Utilities","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/utilities/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/utilities/` — active release submodule (versioned)
3. `Packs/*/src/Utilities/` — pack source (distributable)
4. `Packs/agents/Utilities/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
