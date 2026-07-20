---
name: StartupInvestorDocs
description: Generate, scan, and enhance investor documentation for startups at any funding stage. Produces pitch deck outlines, executive summaries, financial projections, market analysis, competitive landscape, and team narratives with stage-specific requirements for pre-seed through Series B+. USE WHEN investor docs, pitch deck, funding documentation, startup business plan, investor ready, pre-seed docs, seed docs, investor materials, funding readiness, raise funding, fundraise, investor deck, series A docs, pitch materials, due diligence docs, cap table, financial model, market sizing for investors.
role: generator
accepts:
  - text
icon: FileText
colorVar: secondary
colorHex: "#deb7ff"
tier: secondary
category: Sales
displayLabel: Investor Docs
marketingDescription: Pitch decks, financial models, cap tables for all stages
elevator: Investor docs for any funding stage
highlightWorkflows:
  - name: Pitch Deck
    technicalName: PitchDeck
  - name: Financial Model
    technicalName: FinancialModel
  - name: Cap Table
    technicalName: CapTable
roots:
  - PROJECT.WORK
sot_domains:
  - messaging
derivative_workflows:
  - Workflows/SingleDoc
  - Workflows/Generate
  - Workflows/Enhance
visibility: public
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# StartupInvestorDocs

Complete investor documentation suite for startups at any funding stage. Every recommendation is calibrated to what investors actually evaluate -- not generic business writing templates.

## Document Types

| Document | Purpose | Stage |
|----------|---------|-------|
| Pitch Deck | 10-15 slide presentation | All stages |
| Executive Summary | 1-2 page overview | All stages |
| Business Plan | Comprehensive plan | Pre-seed/Seed |
| Financial Model | Revenue/cost projections | Seed+ |
| Market Analysis | TAM/SAM/SOM analysis | All stages |
| Competitive Analysis | Landscape and positioning | All stages |
| Team Overview | Founders and key hires | All stages |
| Cap Table | Ownership structure | Seed+ |

## Investor Expectations by Stage

What VCs actually look for changes dramatically by stage:

| Stage | Primary Bet | What They Scrutinize | Common Pass Reasons |
|-------|------------|---------------------|-------------------|
| **Pre-seed** | Team + vision | Founder-market fit, clarity of insight, ambition of opportunity | Unclear problem, weak founding team, no unique insight |
| **Seed** | Product + early signal | Working product, first metrics, market sizing credibility | No traction, unrealistic TAM, feature-list pitch |
| **Series A** | Repeatability | Unit economics, growth trends, go-to-market engine | Metrics don't support valuation, no path to scale |
| **Series B+** | Scaling machine | Revenue growth efficiency, market expansion, team depth | Burn rate concerns, market ceiling, competitive threats |

## Pitch Deck Structure -- The 12-Slide Standard

The sequence matters. Each slide must answer one question and set up the next:

| # | Slide | Must Answer | Fatal Mistake |
|---|-------|------------|---------------|
| 1 | Cover | Who are you? | Cluttered with text |
| 2 | Problem | Why does this matter? | Abstract pain, no specifics |
| 3 | Solution | What do you do about it? | Feature dump, no user story |
| 4 | Product | How does it work? | No screenshots or demo |
| 5 | Market | How big is this? | Unsourced TAM, no SAM/SOM |
| 6 | Traction | Is this working? | Vanity metrics, no trends |
| 7 | Business Model | How do you make money? | No unit economics |
| 8 | Competition | Why will you win? | Ignoring competitors or using magic quadrant |
| 9 | Team | Why this team? | Irrelevant backgrounds, missing key roles |
| 10 | Financials | What are the projections? | Hockey stick with no assumptions |
| 11 | Ask | What do you need? | Vague use of funds |
| 12 | Vision | Where does this go? | Too incremental or too unrealistic |

## Common Investor Objections

Documents should preemptively address these top concerns:

| Objection | What Investors Think | How Docs Should Address It |
|-----------|---------------------|---------------------------|
| "Market is too small" | TAM is overstated or undifferentiated | Bottom-up TAM calculation with clear methodology |
| "No moat" | Competitors can copy easily | Structural advantage (network effects, data, switching costs) |
| "Team gaps" | Missing key role (CTO, sales lead) | Hiring plan with timeline and advisor coverage |
| "Unit economics don't work" | CAC > LTV or no path to profitability | Cohort data, improving trends, clear path to margin |
| "Timing is wrong" | Why now? | Market catalyst (regulation, tech shift, behavior change) |

## Key Metrics by Stage

Investors benchmark against these ranges:

| Metric | Pre-seed | Seed | Series A | Series B+ |
|--------|----------|------|----------|-----------|
| ARR | $0-$50K | $50K-$1M | $1M-$5M | $5M-$25M+ |
| MoM Growth | N/A | 15-30% | 10-20% | 8-15% |
| Burn Rate | < $30K/mo | < $100K/mo | < $500K/mo | Varies |
| Runway | 12-18 mo | 12-18 mo | 18-24 mo | 18-24 mo |
| Team Size | 1-3 | 3-10 | 10-30 | 30-100+ |
| Gross Margin | N/A | > 50% | > 60% | > 65% |

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/StartupInvestorDocs/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| Generate | "create investor docs", "full documentation suite" | `Workflows/Generate.md` |
| Scan | "assess investor readiness", "scan my docs" | `Workflows/Scan.md` |
| GapAnalysis | "what am I missing for investors", "gap analysis" | `Workflows/GapAnalysis.md` |
| research | "research for pitch deck", "market sizing" | `Workflows/Research.md` |
| Enhance | "improve my pitch deck", "strengthen my docs" | `Workflows/Enhance.md` |
| SingleDoc | "create just the exec summary", "single document" | `Workflows/SingleDoc.md` |
| Full pipeline (recommended) | End-to-end | Scan -> GapAnalysis -> Research -> Generate -> Enhance |

## Examples

**Example 1: Full investor doc suite for a seed-stage SaaS**
```
User: "Create investor docs for my seed-stage SaaS company"
→ Invokes Generate workflow, calibrated for Seed stage
→ Produces pitch deck, executive summary, market analysis, competitive landscape, financial model
→ Returns a folder of stage-appropriate documents under MEMORY/WORK
```

**Example 2: Readiness scan against Series A benchmarks**
```
User: "Are my pitch materials ready for Series A?"
→ Invokes Scan workflow, scored against Series A investor expectations
→ Evaluates traction, unit economics, GTM engine clarity, team depth
→ Returns a readiness score with stage-specific gaps highlighted
```

**Example 3: Gap analysis with prioritized fix list**
```
User: "What's missing from my investor package?"
→ Invokes GapAnalysis workflow
→ Diffs current docs against the 8-document standard suite + stage-specific requirements
→ Returns a prioritized fix list with the highest-impact missing pieces first
```

## Integration

| Skill | When to Use Together |
|-------|---------------------|
| research | For deeper market/competitive analysis |
| brand | For visual identity aligned with investor materials |
| sales | For go-to-market strategy referenced in pitch deck |

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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"StartupInvestorDocs","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/startup-investor-docs/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/startup-investor-docs/` — active release submodule (versioned)
3. `Packs/*/src/StartupInvestorDocs/` — pack source (distributable)
4. `Packs/agents/StartupInvestorDocs/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
