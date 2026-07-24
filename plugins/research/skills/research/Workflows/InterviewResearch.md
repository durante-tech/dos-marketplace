---
name: Interview Prep
description: Tyler Cowen-style interview preparation with deep subject research
status: BETA
featured: true
icon: Search
bestPath:
  - title: "Subject Research"
    description: "Deep research on the interviewee's background, work, and public positions."
  - title: "Position Analysis"
    description: "Map subject's key arguments, contradictions, and intellectual evolution."
  - title: "Question Generation"
    description: "Craft Tyler Cowen-style questions that probe depth and reveal insight."
  - title: "Briefing Document"
    description: "Compile interview guide with questions, context notes, and follow-up paths."
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Research InterviewResearch workflow has bespoke Output section with workflow-specific shape"
---

# Perform Interview Research

## When to Use

- User preps a sponsored interview / podcast appearance at a tech or security company
- Tyler Cowen-style surprise-maximizing question sets wanted
- Company research runs through StandardResearch under the hood


You are preparing research for a sponsored interview at an information security or tech startup. Your goal is to generate Tyler Cowen-style questions based on Claude Shannon's concept of surprise - questions and answers should maximize information content and never be boring.

## Research Protocol

Run the research skill's Standard mode (`Workflows/StandardResearch.md` — 4 researcher subagents) to investigate the following about **{company_name}**:

1. **Recent Activity & Announcements** (last 6 months)
   - Product launches and updates
   - Funding rounds or business milestones
   - Press releases and media coverage
   - Conference talks or presentations

2. **Technical Innovation**
   - Core technology and approach
   - Patents or research papers
   - Technical blog posts
   - Open source contributions

3. **Social Media & Thought Leadership**
   - CEO/founder social media activity
   - Company blog posts
   - Podcast appearances
   - Industry commentary and opinions

4. **Competitive Landscape**
   - Direct competitors and alternatives
   - Market positioning
   - Unique differentiators
   - Industry trends they're responding to

5. **Future Direction**
   - Roadmap hints or statements
   - Job postings (what roles they're hiring)
   - Strategic partnerships
   - Market expansion signals

## Output Format

After research, provide:

### COMPANY SUMMARY (2-3 paragraphs)
- What they're building and why it matters
- Recent momentum and achievements
- What they seem most excited about
- Key differentiators from competition

### INTERVIEW QUESTIONS (10 total)

Generate 10 questions that:
- Maximize surprise and information content (Shannon principle)
- Use Tyler Cowen's style: unexpected angles, implicit assumptions challenged, "production function" thinking
- Avoid obvious or boring questions
- Elicit stories, not just facts
- Reveal mental models and decision-making processes

**Required question themes** (reframed in novel ways):
1. Problem definition and origin story
2. Competitive differentiation and strategy
3. Future vision and industry evolution

**Additional themes to explore**:
- Counter-intuitive insights they've discovered
- Failed experiments and pivots
- Hiring philosophy and team building
- Customer surprises or unexpected use cases
- Technical trade-offs and architecture decisions
- Market timing and "why now"
- Contrarian beliefs about their industry

### Question Format:
For each question, provide:
- **Q[number]:** The actual question
- **Why:** Brief explanation of what surprising insight this might reveal
- **Follow-up angle:** One potential follow-up based on likely answers

## Tyler Cowen Question Principles

Apply these techniques:
- **Oblique approach**: Ask about adjacent topics to reveal core insights
- **Production function**: "What inputs create your outputs?"
- **Marginal thinking**: "What's the next bottleneck?"
- **Status quo challenge**: "What does everyone else get wrong?"
- **Personal history**: "What experience shaped this decision?"
- **Taste and aesthetics**: "What do you find beautiful about your solution?"
- **Edge cases**: "When does your approach fail?"
- **Second-order effects**: "What happens when you succeed?"

## Shannon Surprise Principle

Maximize information entropy by:
- Avoiding questions with predictable answers
- Seeking insights that contradict conventional wisdom
- Finding the "least likely but most important" aspects
- Revealing hidden complexity in apparently simple systems
- Exposing assumptions that aren't being questioned

## Example Question Transformations

❌ **Boring**: "What problem are you solving?"
✅ **Interesting**: "What problem did you initially *think* you were solving, and when did you realize you were actually solving something completely different?"

❌ **Boring**: "How are you different from competitors?"
✅ **Interesting**: "If your top competitor called you for advice on what they should build next, what would you tell them - and what would you deliberately leave out?"

❌ **Boring**: "What's your vision for the future?"
✅ **Interesting**: "If you woke up in 2030 and your company had failed, what would be the most likely reason - and what could make that failure look obvious in retrospect?"

## Research Command

## Save Research Report (MANDATORY)

**Persist findings to disk so the research counter tracks it.**

```bash
# Resolve project-level RESEARCH dir (project -> cwd -> global), tested owner:
# Packs/research/src/Tools/ResearchCli.ts resolve-dir (mirrors getMemorySubdir).
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

**Write report to:** `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_interview-{company-slug}.md`

The report skeleton (frontmatter + section headings + empty-state slots) is
rendered by the golden-tested owner — do not hand-type it; fill the bracketed
body slots with the company summary and the 10 questions:

```bash
bun ~/.claude/skills/research/Tools/ResearchRender.ts render-report \
  "$(jq -nc --arg date "$(date +%F)" --arg company "{company_name}" \
     '{mode:"interview",date:$date,company_name:$company}')"
```

This emits, byte-identical:

```markdown
---
mode: interview-research
date: {YYYY-MM-DD}
topic: Interview Research — {company_name}
agents: standard research agents
---

# Interview Research — {company_name}

## Company Summary
[2-3 paragraph summary]

## Interview Questions
[All 10 Tyler Cowen-style questions with Why and Follow-up]

## Key Research Findings
[Notable discoveries about the company]

## Sources
[Verified URLs only]
```

Now execute StandardResearch (`Workflows/StandardResearch.md`) with the query: `{company_name} — focus on: recent announcements, technical innovation, competitive positioning, founder/executive social media, future direction signals, and any contrarian or surprising aspects of their approach`

## Intent-to-Flag Mapping

This workflow shells out to two DOS Research plumbing CLIs, both **deterministic
fixed subcommands with no operator-variable flags** — each invocation is fully
determined by the workflow step, not by user intent:

- `bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir` — resolves the
  project-level RESEARCH directory (project → cwd → global); takes no flags.
- `bun ~/.claude/skills/research/Tools/ResearchRender.ts render-report '<json>'` —
  renders the byte-identical interview report skeleton; its lone JSON argument is
  built mechanically by the step (`{mode:"interview",date,company_name}`), not
  selected from intent.

There is therefore **no intent→flag table** for this file — no flag varies with
operator intent. (Contrast `StandardResearch.md` / `ClaudeResearch.md`, whose
provider CLIs such as `Perplexity.ts` expose `--model`/`--recency`/`--reasoning`,
and `BraveSearch.ts` `--type`/`--freshness`/`--country`, that genuinely map to
intent and so carry a real mapping table.) The subject research itself runs
through the StandardResearch workflow (Task-spawned researcher subagents), not a
flagged CLI shell-out.