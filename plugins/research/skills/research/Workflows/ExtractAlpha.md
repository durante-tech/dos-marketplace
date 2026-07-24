---
name: Extract Alpha
description: Extract 24-30 highest-alpha insights from content via deep-thinking analysis — surprise-prioritized, Paul Graham-style output
status: STABLE
divergence_from_canonical:
  _intent-to-flag-table.md:
    partial_version: 1.0.0
    reason: "Fixed-subcommand / native-tool invocations - no intent-variant flags exist to map; the section deliberately documents the fixed invocation table instead of the canonical Mode Selection shape"
    rationale_link: null
  _workflow-output-shape.md:
    partial_version: 1.0.0
    reason: "Research ExtractAlpha workflow has bespoke Output section with workflow-specific shape"
bestPath:
  - title: "Retrieve Content"
    description: "Pull the source (podcast, article, video transcript) into the work item."
  - title: "Deep-Thinking Analysis"
    description: "Extended analysis across all 10 dimensions, notes in the work directory."
  - title: "Insight Extraction"
    description: "Distill 24-30 low-probability brilliant insights, 8-12 words each."
  - title: "Vault Persistence"
    description: "Save extract_alpha.md + analysis + metadata to MEMORY/RESEARCH."
---

# Extract Alpha

## When to Use

- User says "extract alpha" or wants the highest-signal insights from a long source
- Podcasts, talks, long articles where surprise-density matters more than coverage
- NOT for full summaries (Fabric summarize patterns) or domain briefs (ExtractKnowledge)


Extract the highest-alpha ideas from content using deep deep thinking analysis.

Finds the most surprising, insightful, and novel ideas through systematic deep reasoning.
Focuses on what's genuinely new, counterintuitive, and profound.

USE WHEN analyzing podcasts, videos, articles, essays, or any content where you want to capture
the most important and surprising insights without missing subtle but profound ideas.

# Extract Alpha - Deep Content Analysis

## 🎯 Load Full DOS Context

**Before starting any task with this skill, load complete DOS context:**

`read ~/.claude/DOS/SKILL.md`

## Core Philosophy

Based on Claude Shannon's information theory: **real information is what's different, not what's the same.**

This skill finds:
- Net new ideas and novel presentations
- New frameworks for combining ideas
- Surprising insights that challenge assumptions
- Subtle but profound observations
- Non-obvious connections and implications

**The Problem This Solves:** Standard extraction often misses:
- Subtle philosophical implications
- Non-obvious connections between ideas
- Counterintuitive observations buried in conversation
- Novel frameworks that aren't explicitly stated
- Surprising reframings of common concepts
- Low-probability but brilliant insights

## When to Activate This Skill

- Analyzing YouTube videos, podcasts, interviews
- Processing essays, articles, blog posts
- Deep content analysis where missing insights is unacceptable
- User says "extract the most important ideas"
- Need to find alpha/novelty in dense content
- Standard patterns failed to capture key insights
- User explicitly requests "extract alpha" or "deep analysis"

## The Five-Step Process

### Step 1: Content Extraction

**For YouTube videos:**
```bash
fabric -y "YOUTUBE_URL"
```

**For other content:**
- Paste text directly
- Use WebFetch for articles
- Read from files

### Step 2: Deep deep thinking Analysis

Before extracting anything, engage in extended deep thinking using the deep thinking protocol:

**deep thinking Protocol:**
```
DEEP THINKING DEEP ANALYSIS MODE:

Think deeply and extensively about this content:

1. SURFACE SCAN - What are the obvious main points?
2. DEPTH PROBE - What implications aren't explicitly stated?
3. CONNECTION MAP - What unusual connections exist between ideas?
   - WONDER TRIGGER: What makes you stop and think "wait, how does THAT work?"
   - CROSS-DOMAIN PATTERNS: What seemingly different things (human/AI, biology/ML, physics/economics) share the same underlying principle?
   - PERSONAL RELEVANCE: What applies to YOUR life in a surprising way?
   - AHA MOMENTS: What connections make you see familiar things differently?
4. ASSUMPTION CHALLENGE - What conventional wisdom is being questioned?
5. NOVELTY DETECTION - What's genuinely new or surprising here?
6. FRAMEWORK EXTRACTION - What mental models or frameworks emerge?
7. SUBTLE INSIGHTS - What quiet observations carry profound weight?
8. CONTRARIAN ANGLES - What goes against common thinking?
9. FUTURE IMPLICATIONS - What does this suggest about what's coming?
10. SYNTHESIS - What are the highest-alpha ideas across all dimensions?

Allow thinking to wander and make unexpected connections.
Question every assumption about what's "important."
Look for ideas that make you pause and reconsider.
Prioritize novelty and surprise over comprehensiveness.
```

### Step 3: Extract Insights

After deep thinking, extract the highest-alpha insights:

**Extraction Protocol:**
```
Generate 24-30 highest-alpha ideas from your deep analysis.

For each insight:
- Write in 8-12 word bullets (allow flexibility for clarity)
- Use approachable Paul Graham style
- Prioritize ideas that are:
  * Make you pause and think "wait, WHAT?"
  * Spark curiosity or wonder
  * Reveal cross-domain patterns (same principle across human/AI, biology/ML, etc.)
  * Expose underlying associations that weren't obvious
  * Feel personally relevant or change how you see yourself
  * Challenge how you understand familiar things
  * Make you want to tell someone else
  * Create "holy shit" or "aha!" moments
  * Include specific details WHEN they enhance the surprise/insight
  * Make you reconsider your assumptions about the world

Focus on low-probability insights that are coherent and valuable.
Avoid obvious takeaways and surface-level observations.
Capture the subtle genius buried in the content.
```

### Step 4: File Organization - Scratch → History Pattern

**CRITICAL:** Follow the proper file organization pattern for all extractalpha work:

#### Working Files (Temporary Analysis)

**Use the current work item directory for all working files during analysis:**

```bash
MEMORY/WORK/{current_work}/
```

**To get the current work directory:**
1. Read `MEMORY/STATE/current-work.json` (falls back to `~/.claude/MEMORY/STATE/current-work.json`)
2. Extract the `work_dir` value
3. Use `MEMORY/WORK/{work_dir}/` for temporary artifacts

**What goes in the work item directory:**
- Raw transcripts from fabric -y
- Intermediate analysis notes
- deep thinking working thoughts
- Draft versions of insights
- Any temporary files during the extraction process

**Why this pattern:**
- Ties iterative work artifacts to the work item for learning
- System can analyze how research progresses over time
- Working artifacts provide context for the final outputs

**Example work item structure:**
```
MEMORY/WORK/20260111-172408_extract-alpha-analysis/
├── raw-transcript.txt
├── deep thinking-notes.md
├── draft-insights.md
└── working-analysis.md
```

#### Save to MEMORY/RESEARCH (MANDATORY — Counter Tracking)

**In addition to History, persist a summary to MEMORY/RESEARCH so the research counter tracks it.**

```bash
# Resolve project-level RESEARCH dir (project -> cwd -> global), tested owner:
# Packs/research/src/Tools/ResearchCli.ts resolve-dir (mirrors getMemorySubdir).
RESEARCH_BASE="$(bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir)"
mkdir -p "$RESEARCH_BASE/$(date +%Y-%m)"
```

**Write summary to:** `$RESEARCH_BASE/{YYYY-MM}/{YYYY-MM-DD}_alpha-{topic-slug}.md`

```markdown
---
mode: extract-alpha
date: {YYYY-MM-DD}
topic: {content_title}
content_type: {YouTube/Article/Podcast/Essay}
insights_count: {N}
---

# Extract Alpha — {Content Title}

## Source
{URL or title}

## Top Insights
[5-8 highest-alpha insights from the full extraction]
```

#### Permanent Output (Final Research)

**Save final outputs to the research vault:**

```bash
MEMORY/RESEARCH/{YYYY-MM}/   # project-first via getMemorySubdir('RESEARCH')
```

**What goes in the vault entry:**
- **extract_alpha.md** - The final 24-30 insights (formatted output)
- **deep thinking-analysis.md** - Full deep thinking deep analysis (all 10 dimensions)
- **README.md** - Documentation of the research session
- Source metadata (URL, title, date analyzed, content type)

**Example vault structure:**
```
MEMORY/RESEARCH/2026-07/podcast-analysis/
├── README.md                  # Research session documentation
├── extract_alpha.md           # Final 24-30 insights
├── deep thinking-analysis.md     # Full deep analysis
└── metadata.json              # Source info, timestamps, etc.
```

#### README.md Template

Create a README.md in the history directory documenting the research:

```markdown
# Extract Alpha - [Content Title]

## Source Information
- **URL/Title:** [Source URL or title]
- **Content Type:** [YouTube video / Article / Podcast / Essay]
- **Date Analyzed:** YYYY-MM-DD
- **Analysis Duration:** [Time spent]

## Analysis Method
- deep thinking Deep Analysis (10-dimension framework)
- Focus on low-probability but brilliant insights

## Key Findings Summary
[2-3 sentence summary of the most important insights discovered]

## Output Files
- `extract_alpha.md` - Final 24-30 highest-alpha insights
- `deep thinking-analysis.md` - Complete deep thinking analysis
- `metadata.json` - Structured source and analysis metadata

## Notes
[Any important observations about the analysis process or content]
```

#### Verification Step (MANDATORY)

**ALWAYS verify output is properly captured:**

1. **Check the vault:**
   ```bash
   # Most recent vault entries (project-side)
   ls -lt MEMORY/RESEARCH/$(date +%Y-%m)/ | head -5
   ```

2. **If the files are not there, save them manually:**
   ```bash
   mkdir -p MEMORY/RESEARCH/$(date +%Y-%m)/[description]/

   # Save extract_alpha.md (final insights)
   # Save deep thinking-analysis.md (full analysis)
   # Create README.md (documentation)
   # Add metadata.json (source info)
   ```

3. **Confirm all files saved:**
   ```bash
   ls -lah MEMORY/RESEARCH/$(date +%Y-%m)/[description]/
   # Should show: README.md, extract_alpha.md, deep thinking-analysis.md, metadata.json
   ```

#### Complete Workflow Example

```bash
# 1. Get current work directory
WORK_DIR=$(jq -r '.work_dir' MEMORY/STATE/current-work.json 2>/dev/null || jq -r '.work_dir' ~/.claude/MEMORY/STATE/current-work.json)

# 2. Work in current work item directory
cd MEMORY/WORK/${WORK_DIR}/

# 3. Extract content to work item directory
fabric -y "YOUTUBE_URL" > raw-transcript.txt

# 4. Perform deep thinking analysis (working notes in work item directory)
# [Deep thinking happens here, notes saved to work item directory]

# 5. Extract insights
# [Extract 24-30 insights from deep thinking analysis, draft in work item directory]

# 6. Create the research-vault directory
mkdir -p MEMORY/RESEARCH/$(date +%Y-%m)/podcast-analysis/

# 7. Save final outputs to the vault
# - extract_alpha.md (final insights)
# - deep thinking-analysis.md (full deep thinking)
# - README.md (documentation)
# - metadata.json (source info)

# 8. Verify the vault entry
ls -lah MEMORY/RESEARCH/$(date +%Y-%m)/podcast-analysis/

# 9. Note: working artifacts remain tied to work item for learning
# (Don't delete working files - they provide context for the work item)
```

#### Why This Pattern Matters

1. **Work item integration:** Working artifacts are tied to the work item for learning
2. **System intelligence:** DOS can analyze how research progresses over time
3. **Context preservation:** Working files provide context for final outputs
4. **Proper documentation:** README ensures context is preserved in history
5. **Hook verification:** Ensures nothing is lost if hooks fail
6. **deep thinking preservation:** Full deep analysis is saved, not just final insights
7. **Research continuity:** Can revisit analysis methodology later

## Output Format

Simple markdown list with blank lines between items for readability:

```markdown
# EXTRACT ALPHA

- First high-alpha insight in approachable style

- Second surprising idea that challenges assumptions

- Novel framework or mental model discovered

- Non-obvious connection between concepts

- Counterintuitive observation with implications

- Subtle but profound philosophical point

[... continue for 24-30 items total ...]
```

**Quality over quantity:** If content only has 15 truly novel insights, extract 15. Don't pad with obvious ideas.

## What to Look For

### HIGH-ALPHA SIGNALS:
- Makes you stop and reconsider something you thought you knew
- Connects ideas from different domains unexpectedly
- Challenges industry consensus or common wisdom
- Reframes a familiar concept in a surprising way
- Has second-order implications not explicitly stated
- Feels counterintuitive but makes sense upon reflection
- Represents a novel mental model or framework
- Captures a subtle observation with profound weight

### LOW-ALPHA SIGNALS (avoid):
- Restates common knowledge
- Obvious implications or direct quotes of main points
- Generic advice that could apply to anything
- Surface-level observations without depth
- Ideas you've heard many times before
- Purely factual information without insight

## Comparison to Standard Patterns

**extract_wisdom:**
- Comprehensive: IDEAS, INSIGHTS, QUOTES, HABITS, FACTS, REFERENCES
- Structured 16-word bullets
- Captures breadth
- Can miss subtle depth

**extract_alpha (original):**
- 24 items, 8-word bullets
- Focuses on novelty
- Paul Graham style
- Can miss ideas due to mode collapse

**extractalpha (this skill):**
- 24-30 items, 8-12 word bullets (flexible)
- Deep deep thinking analysis first
- Focuses on low-probability but brilliant insights
- Specifically designed to NOT miss subtle profound ideas
- Prioritizes surprise and novelty over comprehensiveness

## Usage Examples

### Example 1: YouTube Video Analysis

```bash
# Step 1: Extract transcript
fabric -y "https://youtu.be/VIDEO_ID"

# Step 2 & 3: Apply this skill (DOS does this automatically)
# - Deep deep thinking analysis
# - Extract insights
# - Output 24-30 highest-alpha insights
```

### Example 2: Article Analysis

```typescript
// User provides article URL or text
// DOS:
// 1. Fetches content (WebFetch or direct paste)
// 2. Applies deep thinking protocol
// 3. Extracts insights
// 4. Returns high-alpha list
```

## Integration with DOS

When this skill activates, DOS should:

1. **Load content** via appropriate method (fabric -y, WebFetch, Read, or paste)
2. **Get current work directory** - Read `MEMORY/STATE/current-work.json` for `work_dir`
3. **Use work item directory** - Work in `MEMORY/WORK/{work_dir}/`
4. **Engage deep thinking mode** - Deep extended thinking through all 10 dimensions
5. **Extract insights** - Extract 24-30 highest-alpha ideas focusing on low-probability brilliant insights
6. **Save to the vault** - Final outputs to `MEMORY/RESEARCH/{YYYY-MM}/[description]/`
7. **Verify capture** - Ensure hooks captured or manually save all files
8. **Output simple list** - Unformatted markdown, Paul Graham style, 8-12 words each
9. **Prioritize surprise** - Novel ideas over obvious takeaways

### Internal Prompt Pattern

```
<instructions>
STEP 1 - DEEP THINKING DEEP ANALYSIS:
Think deeply and extensively about this content:
- What makes you stop and think "wait, WHAT?"
- What feels personally relevant in a surprising way?
- What changes how you see familiar things?
- What sparks genuine curiosity or wonder?
- What would make you want to tell someone about it?
- What creates "holy shit" or "aha!" moments?
- What cross-domain patterns exist (same principle across human/AI, biology/ML, physics/economics)?
- What underlying associations connect seemingly unrelated things?
- What implications aren't explicitly stated?
- What unusual connections exist between ideas?
- What conventional wisdom is being questioned?
- What's genuinely new or surprising?
- What mental models or frameworks emerge?
- What quiet observations carry profound weight?
- What goes against common thinking?
- What does this suggest about the future?

Explore the full conceptual space. Make unexpected connections.
Question assumptions about what's "important."
Prioritize insights that create WONDER, CURIOSITY, PERSONAL RELEVANCE, and CROSS-DOMAIN PATTERNS.
Focus on what's INTERESTING/SURPRISING/INSIGHTFUL, not just technical or comprehensive.

STEP 2 - EXTRACT INSIGHTS:
Generate 24-30 highest-alpha insights from your deep analysis.

Focus on:
- Low-probability but brilliant insights
- Ideas that make you pause and think "whoa"
- Cross-domain patterns that reveal same principles across fields
- Underlying associations between seemingly unrelated things
- Connections that feel personally relevant
- Observations that spark wonder or curiosity
- Ideas that make you see familiar things differently
- Insights you'd want to share with someone
- Counterintuitive ideas that challenge assumptions
- Subtle observations with profound emotional weight

For each insight:
- Write in approachable 8-12 word bullets (Paul Graham style)
- Avoid surface-level observations
- Capture what's INTERESTING, SURPRISING, and INSIGHTFUL
- Reveal cross-domain patterns and underlying associations
- Include specific details WHEN they enhance the wonder/surprise
- Focus on emotional impact and personal relevance
- Include ideas standard patterns would miss

Output Format:
# EXTRACT ALPHA

- [Insight 1]

- [Insight 2]

[... 24-30 total items with blank lines between each ...]
</instructions>

[CONTENT TO ANALYZE]
```

## Example Output Quality

**What standard extract_alpha might miss:**
- "We're not building animals, we're building ghosts" (profound reframing)
- "Pre-training is like crappy evolution" (novel framework)
- "Context window is working memory, weights are hazy recollection" (powerful analogy)
- "In-context learning might implement gradient descent internally" (deep technical insight)
- "Agents are trying to get the full thing too early" (historical pattern observation)

**What extractalpha (this skill) captures:**
ALL of the above plus more subtle implications and connections.

## Key Principles

1. **Think first, extract second** - deep thinking before output
2. **Focus on low-probability insights** - Don't just grab obvious ideas
3. **Prioritize surprise** - Novel > comprehensive
4. **Capture subtlety** - Profound quiet observations matter
5. **Challenge assumptions** - What's the conventional wisdom being questioned?
6. **Find connections** - Non-obvious links between ideas
7. **Flexible length** - 8-12 words, whatever achieves clarity
8. **Quality threshold** - Better 15 brilliant insights than 30 padded ones
9. **Cross-domain patterns** - Same principles across different fields
10. **Personal relevance** - What changes how you see things?

## Common Failure Modes to Avoid

1. **Mode collapse** - Only extracting high-probability obvious ideas
2. **Surface skimming** - Missing depth for breadth
3. **Quote collection** - Restating without extracting insight
4. **Comprehensiveness trap** - Trying to capture everything instead of highest alpha
5. **Rigid formatting** - Forcing 8 words when 10 would be clearer
6. **Obvious takeaways** - Extracting main points instead of surprising implications

## Success Criteria

You've succeeded with this skill when:
- User says "YES! That's exactly the insight I was thinking about!"
- Extracted ideas include subtle observations you almost missed
- Low-probability but profound insights are captured
- Novel frameworks and mental models are identified
- Reading the extraction makes you reconsider your understanding
- No important surprising ideas are missing from the output

## Quick Reference

**Four-step process:**
1. Extract content (fabric -y, WebFetch, Read, paste)
2. Deep deep thinking (10-dimension analysis) - work in work item directory
3. Extract insights (24-30 highest-alpha ideas, 8-12 words)
4. Save to history (verify hooks captured output) - working artifacts stay with work item

**Output format:**
- Simple markdown list with blank lines between items
- Paul Graham approachable style
- 8-12 word bullets (flexible)
- Prioritize novelty and surprise

**Remember:**
- Real information is what's different
- Think deeply before extracting
- Focus on low-probability but brilliant insights
- Capture subtle profound observations
- Novel frameworks over obvious takeaways
- Quality over quantity

## Intent-to-Flag Mapping

This workflow exposes no operator-variable, intent-mapped flags, so there is no intent->flag table — the flag set is fully determined by each step, not by user phrasing.

The only R14-tracked CLI it shells is the deterministic Research plumbing helper:

CLI: `bun ~/.claude/skills/research/Tools/ResearchCli.ts resolve-dir`

`resolve-dir` is a fixed subcommand that takes no flags (only an optional positional `[subdir]`, defaulted here to `RESEARCH`). It mirrors `getMemorySubdir('RESEARCH')` (project -> cwd -> global) to locate the RESEARCH vault directory; nothing about the invocation varies with user intent. (Content extraction uses `fabric -y "<url>"`, which is not an R14-tracked `bun/.ts` or `python3/.py` CLI and likewise carries no intent-selected flags — `-y` is fixed to YouTube-transcript mode.)

Contrast the provider-backed workflows (StandardResearch / ClaudeResearch), whose CLIs — `Perplexity.ts` (`--model` / `--recency` / `--reasoning` / `--search-mode`), `BraveSearch.ts` (`--type` / `--freshness` / `--count`) — DO map operator phrasing to flag selection and therefore carry real tables. This deep-thinking extraction workflow has no such surface.