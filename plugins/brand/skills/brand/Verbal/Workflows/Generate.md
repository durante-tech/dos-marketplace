---
name: Generate
description: 
status: STABLE
---

# Generate -- Full Messaging Pipeline

Complete brand messaging generation from user context through all 4 layers, integrated with DOS Algorithm PRD system.

## DOS Integration

**This workflow produces a DOS-standard PRD.** The 4-layer messaging architecture is domain-specific planning that lives as subsections within the PRD's `## Context` section at `MEMORY/WORK/{slug}/PRD.md`.

**If the Algorithm is already running:** This workflow is invoked during the Algorithm's PLAN/EXECUTE phases. The PRD already exists — edit it to add brand messaging context and generate ISC criteria from deliverables.

**If invoked standalone:** Create a new PRD stub:
1. `mkdir -p MEMORY/WORK/{slug}/` (slug: `YYYYMMDD-HHMMSS_brand-messaging-description`)
2. Write `MEMORY/WORK/{slug}/PRD.md` with frontmatter per `~/.claude/DOS/PRDFORMAT.md`

## When to Use

- User wants a complete messaging system
- User wants multiple artifact types generated at once
- User is starting from scratch (no existing BrandScript or positioning)

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Gather Brand Intelligence (Layer 1)

Collect inputs across all 7 schema groups. Ask conversationally, not as a form. Infer what you can from context (existing project files, prior sessions).

**Group A: Company Identity**
- Company name, URL, founding year, stage, business model
- Industry, geography, team size
- Founder names and story (origin narrative)

**Group B: Product / Offering**
- Product name, category, type, core function
- Key features, advantages, benefits (FAB hierarchy)
- Pricing model, price points, free trial availability
- Unique mechanism (proprietary approach)
- Time to value

**Group C: Target Audience**
- Primary ICP: segment name, job titles, company size, industry
- Psychographics: values, motivations, fears, aspirations, identity drivers
- JTBD: functional job, emotional job, social job
- Pain points: primary pain, secondary pains, intensity, current solution
- Awareness level (Schwartz 5 levels): unaware / problem-aware / solution-aware / product-aware / most-aware

**Group D: Competitive Positioning**
- Primary competitors (name, URL, key difference)
- Secondary alternatives (Excel, hiring internally, etc.)
- Differentiators with proof
- Category name (existing or creating new)
- Contrarian view (what everyone gets wrong)

**Group E: Proof & Credibility**
- Customer count, notable customers
- Testimonials (quote, name, title, company, result)
- Case study results (metric, value, customer)
- Awards, press mentions, certifications
- Founder credentials

**Group F: Brand Voice**
- Personality traits
- Tone spectrum: formality, energy, humor, empathy
- Vocabulary: preferred words, banned words, jargon level
- Brand archetypes
- Writing style: sentence length, POV, CTA style
- Reference brands, anti-examples

**Group G: Goals & Context**
- Primary goal (awareness, leads, signups, sales, retention, fundraising)
- Target channels
- Funnel stage focus

If the user has already provided context (prior sessions, project files), extract what you can and confirm gaps only.

### Step 2: Build Strategic Positioning (Layer 2 -- Brand DNA)

Generate these in order -- each depends on the previous:

1. **Positioning Statement** (Geoffrey Moore formula):
   ```
   For [ICP] who [JTBD], [product] is [category] that [primary benefit].
   Unlike [competitor], we [key differentiator].
   ```

2. **Value Proposition** (customer-facing positioning):
   Intersection of Customer Jobs + Your Solution + Unique Mechanism

3. **Three-Level Problem Definition** (StoryBrand):
   - External: The practical problem
   - Internal: The emotional frustration
   - Philosophical: The moral/cultural wrong
   - Villain: The root cause

4. **Brand Pillars** (3-5 themes with proof per pillar):
   ```
   Pillar: [Theme]
   Support: [Message]
   Proof: [Evidence]
   ```

5. **Brand Voice Profile**:
   Personality traits, tone spectrum, vocabulary rules, archetype, reference brands

6. **Proof Stack** (priority-ranked):
   Top 3 testimonials, top 3 results, top credentials

### Step 3: Generate Core Messaging Assets (Layer 3)

Build these in dependency order -- each draws from Layer 2:

1. **StoryBrand BrandScript** -- Fill out the complete SB7 template:
   - Character (customer + desire)
   - Problem (villain + external + internal + philosophical)
   - Guide (empathy statement + authority proof)
   - Plan (3-step process plan + optional agreement plan)
   - Call to Action (direct CTA + transitional CTA with lead magnet)
   - Failure (cost of inaction)
   - Success (external + internal + philosophical + transformation statement)

2. **One-Liner** -- Using StoryBrand formula:
   ```
   [CUSTOMER TYPE] struggle with [PROBLEM].
   We [SOLUTION]. So they can [RESULT].
   ```

3. **Tagline** -- 3-7 words, compressed transformation

4. **Elevator Pitch** -- 30-second spoken version

5. **Value Statement** -- 2-3 sentences, written

6. **Mission Statement** -- 1-2 sentences, present-focused

7. **Vision Statement** -- 1-2 sentences, aspirational future

8. **Brand Story / Origin Narrative** -- 200-400 words

### Step 4: Ask What Artifacts to Generate (Layer 4)

Present the artifact menu organized by tier:

```
TIER 1 - Brand Foundation: [already generated in Step 3]
TIER 2 - Website: Homepage hero, full homepage, about page, product pages, landing pages, pricing, FAQ
TIER 3 - Verbal: Elevator pitch, sales script, demo script, cold outreach
TIER 4 - Email: Welcome sequence, nurture sequence, sales sequence, onboarding
TIER 5 - Social: LinkedIn bio, Twitter bio, Instagram bio, post templates
TIER 6 - Ads: Google, Facebook/Instagram, LinkedIn, retargeting
TIER 7 - Sales Enablement: Pitch deck narrative, one-pager, case study template, press release
```

Let the user select which tiers/artifacts to generate. Default: Tiers 2-4 (website + verbal + email) if they say "all" or "everything."

### Step 5: Generate Selected Artifacts

For each selected artifact, apply the correct framework per the routing matrix:

| Artifact | Framework | Approach |
|----------|-----------|----------|
| Homepage | StoryBrand SB7 | Full section-by-section wireframe with copy |
| Landing page | PAS | Problem-Agitate-Solve with single CTA |
| About page | StoryBrand guide arc | Empathy + authority + origin |
| Product page | FAB | Features => Advantages => Benefits |
| Email sequences | PASTOR | Problem => Amplify => Story => Testimony => Offer => Response |
| Sales emails | PAS | Pain-first, clear offer |
| Ad copy | AIDA/PAS | Attention hook, compressed format |
| Sales script | StoryBrand | 4-phase discovery call framework |
| Case study | BAB | Before => After => Bridge |
| Social bios | Positioning | Compressed identity + CTA |

For large artifact sets (5+), use the Agent tool to parallelize generation:

```
Use the Agent tool to generate each artifact category in parallel.
Pass the full BrandScript and Brand DNA as context to each agent.
Each agent applies the correct framework for its artifact type.
```

### Step 6: Compile and Deliver

Save all artifacts to the DOS PRD work directory:

```
MEMORY/WORK/{slug}/
  PRD.md                # DOS PRD with brand messaging context + ISC criteria
  brand-dna.md          # Layer 2: Positioning, value prop, pillars, voice
  brandscript.md        # Layer 3: Complete SB7 BrandScript
  core-assets.md        # Layer 3: One-liner, tagline, pitch, mission, vision, story
  website/
    homepage.md
    about.md
    landing-page.md
    product-page.md
  email/
    welcome-sequence.md
    nurture-sequence.md
    sales-sequence.md
  sales/
    sales-script.md
    elevator-pitch.md
    pitch-deck-narrative.md
    one-pager.md
  social/
    bios.md
    post-templates.md
  ads/
    google-ads.md
    facebook-ads.md
    linkedin-ads.md
```

**Never write to `{project}/Docs/brand-messaging/` directly.** The DOS PRD work directory is the single source of truth. If the user needs artifacts copied to a project directory, do so as a final step after PRD verification.

Also update the PRD:
- Check off completed ISC criteria as artifacts are generated
- Update frontmatter `progress: M/N` after each artifact
- Update `updated:` timestamp

### Step 7: Summary

Report what was generated:
```
Brand Messaging System -- [COMPANY NAME]

  Brand DNA:     Positioning, Value Prop, 3-Level Problem, Pillars, Voice
  BrandScript:   Complete SB7 (Character => Problem => Guide => Plan => CTA => Failure => Success)
  Core Assets:   One-Liner, Tagline, Elevator Pitch, Mission, Vision, Brand Story
  Artifacts:     [N] artifacts across [M] tiers

  PRD:           MEMORY/WORK/{slug}/PRD.md
  
  Framework Usage:
    StoryBrand SB7 -- Website, sales scripts, brand story
    PAS -- Landing pages, cold outreach, ad copy
    PASTOR -- Email sequences
    FAB -- Product pages
    Geoffrey Moore -- Positioning statement
    Cialdini -- CRO elements, pricing page
    JTBD -- Value proposition, audience targeting
```

## Output

A complete brand messaging system with all selected artifacts, organized by channel, all derived from a single Brand DNA source of truth. All output tracked in the DOS PRD system.