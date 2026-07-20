---
name: ContractReview
description: Multi-agent legal contract analysis team for SaaS/service agreements. 4 specialized agents (Risk, Commercial, Compliance, Synthesis) review contracts in parallel and produce a traffic-light redline report. USE WHEN contract review, review contract, legal review, redline contract, analyze contract, SaaS agreement, MSA review, service agreement, contract risk, contract analysis, red flag, legal analysis.
role: analyzer
accepts:
  - text
icon: Scale
colorVar: accent
colorHex: "#6366f1"
tier: primary
category: Legal
displayLabel: Contract Review
marketingDescription: Multi-agent contract analysis with traffic-light redlining for SaaS/service agreements.
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
elevator: Multi-agent contract review with traffic-light redlining
highlightWorkflows:
  - name: Review Contract
    technicalName: ReviewContract
roots: []
visibility: public
feature_capabilities:
  - 4-agent parallel analysis (Risk, Commercial, Compliance, Synthesis)
  - Executive summary with top concerns
  - Plain-English risk explanations
  - SaaS/service agreement specialized
  - Suggested alternative language for red clauses
  - Traffic-light clause rating (red/yellow/green)
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# ContractReview -- Multi-Agent Legal Contract Analysis

4 specialized agents analyze SaaS/service agreements in parallel, then a synthesis agent consolidates findings into a single traffic-light redline report. Designed for the client side -- the one signing, not the vendor.

## What Makes This Different

| Traditional Approach | This Skill |
|---------------------|-----------|
| Single reviewer, single lens | 4 agents, 3 independent legal dimensions |
| Wall of legal text output | Traffic-light system (red/yellow/green) per clause |
| "Consult a lawyer" as advice | Specific alternative language suggestions |
| Manual clause-by-clause reading | Parallel analysis, synthesized report |
| Requires legal training to interpret | Plain-English explanations for non-lawyers |

## Agent Team

| Agent | Role | Traits | Focus |
|-------|------|--------|-------|
| Risk Analyst | Liability & exposure | security, skeptical, thorough | Liability caps, indemnification, termination, penalties, force majeure, warranty |
| Commercial Reviewer | Business terms & value | sales, pragmatic, systematic | Pricing, payment, SLAs, scope, renewals, change orders |
| Compliance Checker | Regulatory & IP | technical, analytical, investigative | Data protection (LGPD/GDPR), IP ownership, confidentiality, audit rights, subprocessors |
| Redline Synthesizer | Merge & present | product, pragmatic, rapid | Consolidates all findings, resolves conflicts, produces final report |

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/ContractReview/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

| Request Pattern | Route To |
|---|---|
| Review a contract, analyze agreement, redline contract | `Workflows/ReviewContract.md` |

## Examples

**Example 1: SaaS Master Service Agreement review**
```
User: "Review this SaaS MSA we're about to sign — what should I push back on?"
→ Invokes ReviewContract workflow with all 4 agents in parallel
→ Risk Analyst flags liability caps, Commercial Reviewer challenges renewal auto-rollover, Compliance Checker audits LGPD/subprocessor terms, Synthesizer merges findings
→ User gets a traffic-light redline (red/yellow/green per clause) with specific alternative language for each red item
```

**Example 2: Quick red-flag scan before a vendor call**
```
User: "I have a vendor call in 30 minutes — give me the top 3 red flags in this service agreement"
→ Invokes ReviewContract workflow with synthesis tilted toward executive summary
→ All 4 agents run, but the final report leads with a one-screen "top concerns" block
→ User gets the 3 highest-severity issues plus suggested talking points for the call
```

**Example 3: Compliance-first review of a data processor agreement**
```
User: "Analyze this DPA — focus on data protection and IP ownership"
→ Invokes ReviewContract workflow with Compliance Checker as the primary lens
→ Compliance Checker drives findings on LGPD/GDPR clauses, subprocessor flow-down, audit rights, IP ownership; Risk and Commercial play supporting role
→ User gets a redline ordered by regulatory risk with plain-English explanations of each compliance gap
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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"ContractReview","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/contract-review/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/contract-review/` — active release submodule (versioned)
3. `Packs/*/src/ContractReview/` — pack source (distributable)
4. `Packs/agents/ContractReview/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
