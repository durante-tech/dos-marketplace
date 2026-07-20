---
name: ReviewContract
description: Orchestrates 4-agent parallel contract analysis and produces traffic-light redline report
status: STABLE
bestPath:
  - title: "Contract Input"
    description: "Accept the contract text, file, or URL and identify title, parties, and type."
  - title: "Compose + Launch Agents"
    description: "Compose the Risk, Commercial, and Compliance agents and launch them in parallel."
  - title: "Synthesis"
    description: "Merge the three agents' findings into a single traffic-light redline report."
  - title: "Deliver"
    description: "Present the report and log it to artifacts."
---

# ReviewContract Workflow

Analyzes a SaaS/service agreement using 4 specialized agents, then synthesizes into a single redline report.

## When to Use

- User wants a SaaS/service agreement reviewed from the client's (signer's) side before signing
- User wants a traffic-light redline with specific alternative language for risky clauses
- NOT for ongoing compliance/GRC programs, LGPD/SOC 2 gap analysis, or policy generation (use Compliance)

## Step 1: Contract Input

Accept the contract text. The user may:
- Paste the contract text directly
- Provide a file path (PDF or text) -- use Read tool to load it
- Provide a URL to the contract -- use WebFetch to retrieve it

If the contract is not yet provided, ask the user to provide it.

**Pre-processing:** Extract the contract text and identify:
- Contract title / parties
- Total number of sections/clauses
- Contract type (MSA, SaaS subscription, service agreement, NDA, etc.)

## Step 2: Compose the 4 Agents

Run ComposeAgent for each specialist:

```bash
# Risk Analyst
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "security,skeptical,thorough" --output json

# Commercial Reviewer
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "sales,pragmatic,systematic" --output json

# Compliance Checker
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "technical,analytical,investigative" --output json

# Redline Synthesizer
bun run ~/.claude/skills/agents/Tools/ComposeAgent.ts --traits "product,pragmatic,rapid" --output json
```

## Step 3: Launch Analysis Agents in Parallel

Spawn the first 3 agents **simultaneously** using the Agent tool. Each agent receives:
1. The composed agent prompt (from ComposeAgent output)
2. The legal-specific augmentation prompt (below)
3. The full contract text

**CRITICAL: All 3 agents MUST be launched in a single message with 3 parallel Agent tool calls.**

### Agent 1: Risk Analyst Augmentation

Append this to the composed agent prompt:

```
## Your Legal Mission: Risk Analysis

You are reviewing a SaaS/service agreement FROM THE CLIENT'S PERSPECTIVE (the one signing, not the vendor). Your job is to identify clauses that expose the client to financial, operational, or legal risk.

**Analyze EVERY clause in these categories:**

1. **Limitation of Liability** -- Is liability capped? Is it mutual? What's the cap relative to fees?
   - RED FLAG: Uncapped client liability, vendor liability capped below 12 months fees
   - STANDARD: Mutual cap at 12 months fees, carve-outs for IP/confidentiality

2. **Indemnification** -- Who indemnifies whom? Is it mutual?
   - RED FLAG: One-way (client indemnifies vendor only), broad trigger language
   - STANDARD: Mutual indemnification with specific triggers

3. **Termination** -- Who can terminate? Under what conditions? What are the consequences?
   - RED FLAG: Vendor can terminate without cause, client locked in, no refund on termination
   - STANDARD: Mutual termination for cause with 30-60 day cure period, prorated refund

4. **Penalties & Damages** -- Early termination fees? Liquidated damages?
   - RED FLAG: Client pays full remaining term on early termination, no vendor penalties
   - STANDARD: Reasonable early termination with prorated fees

5. **Force Majeure** -- Does it excuse SLA obligations? How broad is the definition?
   - RED FLAG: Broad definition including "internet disruptions", excuses all obligations
   - STANDARD: Narrow definition, SLA credits still apply during extended events

6. **Warranties** -- What does the vendor warrant? What's disclaimed?
   - RED FLAG: Complete "AS IS" disclaimer with no performance warranty
   - STANDARD: Warranty that service meets documented specifications and SLAs

7. **Governing Law & Disputes** -- What jurisdiction? Arbitration or litigation?
   - RED FLAG: Foreign jurisdiction, vendor-chosen arbitrator, class action waiver
   - STANDARD: Client-friendly or neutral jurisdiction

**Output Format (STRICT -- follow exactly):**

For each finding, output a JSON object on its own line:

{"clause_ref": "Section X.Y", "clause_text": "exact quote from contract", "rating": "red|yellow|green", "category": "risk", "subcategory": "liability|indemnification|termination|penalties|force_majeure|warranty|jurisdiction", "explanation": "plain English explanation of the issue", "suggestion": "specific replacement language if red/yellow, or 'Standard — no changes needed' if green"}

Output ALL findings, including green ones. One JSON object per line. No markdown, no commentary, just the JSON lines.
```

### Agent 2: Commercial Reviewer Augmentation

Append this to the composed agent prompt:

```
## Your Legal Mission: Commercial Terms Review

You are reviewing a SaaS/service agreement FROM THE CLIENT'S PERSPECTIVE. Your job is to evaluate whether the business terms are fair, transparent, and protect the client's commercial interests.

**Analyze EVERY clause in these categories:**

1. **Pricing & Fees** -- Is pricing transparent? Hidden fees? Overage charges?
   - RED FLAG: Uncapped usage fees, hidden charges, unclear unit pricing
   - STANDARD: Transparent pricing with predictable overages

2. **Payment Terms** -- Net terms? Prepayment? Refund policy?
   - RED FLAG: Net 15, annual prepay with no refund, payment accelerates on dispute
   - STANDARD: Net 30-45, prorated refund for unused portion

3. **Auto-Renewal & Term** -- How does the contract renew? Price increase caps?
   - RED FLAG: Auto-renews for same term, price increases uncapped, short opt-out window
   - STANDARD: Auto-renew with CPI or 3-5% cap, 60+ day opt-out notice

4. **SLA Commitments** -- What uptime is guaranteed? Response times? Resolution targets?
   - RED FLAG: Vague "commercially reasonable efforts", no metrics
   - STANDARD: Specific uptime % (99.9%+), defined response/resolution times

5. **SLA Remedies** -- What happens when SLAs are missed?
   - RED FLAG: No credits, just "best effort to restore"
   - STANDARD: Service credits auto-applied, termination right below threshold

6. **Scope of Work** -- Are deliverables clearly defined? Change process?
   - RED FLAG: Vague scope, "as described on website", unilateral change right
   - STANDARD: Detailed SOW attached, mutual change order process

7. **Support & Maintenance** -- What's included? Response commitments?
   - RED FLAG: Support is "best effort" or costs extra, no response SLA
   - STANDARD: Support included with defined tiers and response times

**Output Format (STRICT -- follow exactly):**

For each finding, output a JSON object on its own line:

{"clause_ref": "Section X.Y", "clause_text": "exact quote from contract", "rating": "red|yellow|green", "category": "commercial", "subcategory": "pricing|payment|renewal|sla_commitment|sla_remedy|scope|support", "explanation": "plain English explanation of the issue", "suggestion": "specific replacement language if red/yellow, or 'Standard — no changes needed' if green"}

Output ALL findings, including green ones. One JSON object per line. No markdown, no commentary, just the JSON lines.
```

### Agent 3: Compliance Checker Augmentation

Append this to the composed agent prompt:

```
## Your Legal Mission: Compliance & IP Review

You are reviewing a SaaS/service agreement FROM THE CLIENT'S PERSPECTIVE. Your job is to identify regulatory exposure, data protection gaps, and IP ownership issues.

**Analyze EVERY clause in these categories:**

1. **Data Protection** -- Is there a DPA? LGPD/GDPR compliance? Data residency?
   - RED FLAG: No DPA, no mention of data protection law, data location unspecified
   - STANDARD: DPA attached, processing roles clear, data residency specified

2. **Data Ownership** -- Who owns client data? What license does vendor get?
   - RED FLAG: Vendor claims ownership or broad license to aggregate/use client data
   - STANDARD: Client retains all ownership, vendor gets limited processing license only

3. **Subprocessors** -- Can vendor use third parties? Notification process?
   - RED FLAG: Vendor can use any subprocessor without notice
   - STANDARD: Approved list, notice + objection right for changes

4. **Audit Rights** -- Can client audit vendor's compliance?
   - RED FLAG: No audit provision at all
   - STANDARD: Annual audit right (SOC 2 report or on-site), reasonable notice

5. **IP Ownership** -- Who owns customizations? Work product?
   - RED FLAG: All customizations owned by vendor, broad IP assignment
   - STANDARD: Client owns custom work, vendor owns platform IP

6. **Confidentiality** -- Mutual? Survival period? Carve-outs?
   - RED FLAG: One-way or short survival (< 1 year), no legal obligation carve-out
   - STANDARD: Mutual, 2-5 year survival, carve-outs for legal obligations

7. **Non-Compete/Exclusivity** -- Any restrictions on using competitors?
   - RED FLAG: Restricts client from using competing services
   - STANDARD: No restrictions, or very narrow and time-limited

8. **Data Portability & Exit** -- Can client get data out? Format? Timeline?
   - RED FLAG: No export provision, data deleted immediately on termination
   - STANDARD: Export in standard format, 30-90 day retrieval window

**Output Format (STRICT -- follow exactly):**

For each finding, output a JSON object on its own line:

{"clause_ref": "Section X.Y", "clause_text": "exact quote from contract", "rating": "red|yellow|green", "category": "compliance", "subcategory": "data_protection|data_ownership|subprocessors|audit|ip_ownership|confidentiality|non_compete|data_portability", "explanation": "plain English explanation of the issue", "suggestion": "specific replacement language if red/yellow, or 'Standard — no changes needed' if green"}

Output ALL findings, including green ones. One JSON object per line. No markdown, no commentary, just the JSON lines.
```

## Step 4: Synthesis

After all 3 agents return, collect their JSON findings and pass them to the Redline Synthesizer agent with this prompt augmentation:

```
## Your Mission: Synthesize & Redline

You received raw findings from 3 specialist agents who analyzed a contract. Your job is to merge them into a single, easy-to-read redline report.

**Input:** JSON findings from Risk Analyst, Commercial Reviewer, and Compliance Checker.

**Rules:**
1. Group findings by contract section (in the order they appear in the contract)
2. When multiple agents flag the same clause, use the WORST rating and merge their explanations
3. De-duplicate overlapping suggestions -- pick the most specific one
4. Write the executive summary AFTER reviewing all findings (top 3 concerns, overall risk level)
5. Keep ALL green findings -- they confirm what's acceptable, which is valuable context
6. Count: total red, total yellow, total green

**Output the final report in this EXACT format:**

# Contract Review: [Contract Title]

**Parties:** [Party A] <-> [Party B]
**Contract Type:** [MSA / SaaS Subscription / Service Agreement / etc.]
**Date Reviewed:** [today's date]

---

## Executive Summary

**Overall Risk Level:** [HIGH / MEDIUM / LOW]

| | Count |
|---|---|
| Red Flags | N |
| Cautions | N |
| Clear | N |

**Top 3 Concerns:**
1. [Most critical issue in plain English -- 1-2 sentences]
2. [Second most critical -- 1-2 sentences]
3. [Third most critical -- 1-2 sentences]

**Recommendation:** [1-2 sentences: sign as-is / negotiate specific items / do not sign without major revisions]

---

## Clause-by-Clause Review

### [Section Number]: [Section Title]

[For each finding in this section, in order of severity (red first, then yellow, then green):]

[RED] **Clause [X.Y]:** "[clause text excerpt]"
- **Risk:** [plain English explanation]
- **Suggested Change:** "[specific replacement language]"

[YELLOW] **Clause [X.Y]:** "[clause text excerpt]"
- **Watch:** [what to be aware of]

[GREEN] **Clause [X.Y]:** "[clause text excerpt]"
- **OK:** [brief confirmation of why this is standard]

[Repeat for all sections...]

---

## Negotiation Checklist

A prioritized list of items to raise with the vendor, from most to least critical:

- [ ] [Item 1 -- specific clause ref + what to ask for]
- [ ] [Item 2]
- [ ] ...
```

## Step 5: Deliver

Present the synthesized redline report to the user. The report IS the deliverable -- no additional commentary needed beyond the report itself.

## Step 6: Artifact Tracking

Log the output to artifacts:

```bash
echo '{"pack":"ContractReview","workflow":"ReviewContract","type":"legal-review","title":"Contract Review: [CONTRACT_NAME]","path":"[output_path_if_saved]","contentPreview":"[first 100 chars of exec summary]","wing":"durante","sessionId":"'$CLAUDE_SESSION_ID'"}' >> MEMORY/ARTIFACTS/artifacts.jsonl
```
