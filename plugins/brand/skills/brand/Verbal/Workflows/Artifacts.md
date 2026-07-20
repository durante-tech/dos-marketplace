---
name: Artifacts
description: 
status: STABLE
---

# Artifacts -- Channel-Specific Communication Generation

Generate specific communication artifacts from existing brand context. Each artifact is routed to the optimal framework based on its type.

## When to Use

- User already has a BrandScript or brand positioning defined
- User requests a specific artifact: "write my homepage copy", "create email sequence", "sales script"
- User wants to expand their existing messaging to new channels

## Prerequisites

1. Use the Read tool to check for existing brand context:
   - `{project}/Docs/brand-messaging/brandscript.md`
   - `{project}/Docs/brand-messaging/brand-dna.md`

2. If no existing BrandScript, suggest running the BrandScript workflow first. The BrandScript is the source document -- artifacts without it will be generic.

## Framework Routing Matrix

Apply the correct framework based on artifact type:

| Artifact | Primary Framework | Key Approach |
|----------|------------------|-------------|
| **Homepage full copy** | StoryBrand SB7 | Section-by-section website wireframe |
| **Homepage hero** | AIDA | Attention + Interest above fold |
| **About page** | StoryBrand (guide arc) | Empathy + authority + origin |
| **Product/service page** | FAB | Features => Advantages => Benefits |
| **Landing page** | PAS | Problem => Agitate => Solve, single CTA |
| **Pricing page** | FAB + BAB | Feature comparison + transformation |
| **FAQ** | Objection handling | Common objections as Q&A |
| **Welcome email sequence** | AIDA | Warm intro, value delivery |
| **Nurture email sequence** | PASTOR | Problem => Amplify => Story => Testimony => Offer => Response |
| **Sales email sequence** | PAS | 6-email StoryBrand sequence |
| **Cold outreach** | PAS | Ultra-compressed, pain-first |
| **Google search ads** | PAS | Pain headline, solution description (30+90 char limits) |
| **Facebook/Instagram ads** | AIDA | Emotional hook (125+40 char limits) |
| **LinkedIn ads** | PAS + FAB | Problem + ROI framing (150+70 char limits) |
| **Sales script** | StoryBrand | 4-phase discovery call (Hero => Problem => Guide => Plan+CTA) |
| **Elevator pitch** | StoryBrand | 10/30/60-second formats |
| **Pitch deck narrative** | StoryBrand + Problem-Solution-Traction | Slide-by-slide story arc |
| **Case study** | BAB (Before-After-Bridge) | Client as hero, brand as guide |
| **Testimonial framework** | BAB | Questions to elicit transformation stories |
| **One-pager / sell sheet** | FAB + StoryBrand | Compressed brand story + features |
| **Press release** | Inverted pyramid + AIDA | Lede = attention + summary |
| **LinkedIn bio** | Positioning + AIDA | Compressed identity + CTA |
| **Twitter/X bio** | Positioning | Ultra-compressed (160 chars) |
| **Social post templates** | PAS / AIDA | Hook + body + CTA by content type |
| **Keynote / talk** | StoryBrand | Hook => Amplify => Guide => Plan => Success => CTA => Hope |
| **Sales page (long-form)** | PASTOR | Full persuasion sequence |
| **Product descriptions** | FAB + JTBD | Features + benefits + jobs served |
| **Proposal template** | StoryBrand | Situation => approach => investment => next steps |

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Identify Requested Artifacts

Parse the user's request to determine which artifacts to generate. Map to the routing matrix above.

If the user says something general like "website copy," expand to: homepage hero, homepage full, about page. Ask if they want more (product pages, landing pages, pricing).

### Step 2: Verify Brand Context Exists

Use the Read tool to check for existing brand materials:
- BrandScript (required for most artifacts)
- Brand DNA / positioning statement
- One-liner, tagline, mission/vision

If missing, ask: "I need your BrandScript to generate [artifact]. Want me to create one first?" Then route to the BrandScript workflow.

### Step 3: Generate Artifacts

For each artifact, follow this process:

1. **Select framework** from routing matrix
2. **Extract relevant BrandScript elements** for this artifact type
3. **Apply framework template**
4. **Apply channel constraints** (character limits, format requirements)
5. **Weave in proof elements** (testimonials, stats) where appropriate
6. **Match brand voice** (tone, vocabulary, formality level)

**For single artifacts:** Generate directly.

**For multiple artifacts (3+):** Use the Agent tool to parallelize:

```
Invoke the Agent tool for each artifact category in parallel.
Pass the full BrandScript and Brand DNA as context.
Each agent applies the correct framework per the routing matrix.
```

### Step 4: Apply Channel Constraints

Enforce hard limits per channel:

| Channel | Constraint |
|---------|-----------|
| Google Search Ads | Headlines: 30 chars x3, Descriptions: 90 chars x2 |
| Facebook/IG Ads | Primary text: 125 chars, Headline: 40 chars |
| LinkedIn Ads | Intro text: 150 chars, Headline: 70 chars |
| Twitter/X Bio | 160 characters |
| LinkedIn Bio | 220 characters (summary intro) |
| Email Subject Lines | 50 characters ideal, 70 max |
| Meta descriptions | 155 characters |

### Step 5: Consistency Check

Before delivering, verify cross-artifact consistency:
- Does the homepage headline echo the one-liner?
- Do email subject lines reference the same problem/transformation?
- Is brand voice consistent across all artifacts?
- Are proof elements (testimonials, stats) used where strongest?

### Step 6: Write and Deliver

Use the Write tool to save each artifact to the appropriate path:

```
{project}/Docs/brand-messaging/
  website/
    homepage.md
    about.md
    landing-page.md
    product-page.md
    pricing.md
  email/
    welcome-sequence.md
    nurture-sequence.md
    sales-sequence.md
    cold-outreach.md
  sales/
    sales-script.md
    elevator-pitch.md
    pitch-deck-narrative.md
    one-pager.md
    proposal-template.md
  social/
    bios.md
    post-templates.md
  ads/
    google-ads.md
    facebook-ads.md
    linkedin-ads.md
  press/
    press-release-template.md
  case-studies/
    case-study-template.md
    testimonial-framework.md
```

Report:
```
Generated [N] artifacts for [COMPANY]:
  [List each artifact with framework used]
  
Output: {project}/Docs/brand-messaging/[category]/
```

## Awareness Level Calibration

If the user specifies (or you can infer) the target audience's awareness level, calibrate the framework application:

| Awareness Level | Copy Strategy | Framework Emphasis |
|----------------|---------------|-------------------|
| Unaware | Lead with story/curiosity, never mention product | Hero's Journey, content marketing |
| Problem Aware | Agitate the pain, introduce solution category | PAS heavy, emotional hooks |
| Solution Aware | Compare approaches, differentiate | Positioning, FAB, Challenger |
| Product Aware | Proof, testimonials, overcome objections | Cialdini, BAB, social proof |
| Most Aware | Direct offer, pricing, urgency | Direct CTA, scarcity, deals |

## Output

Channel-specific communication artifacts, each generated using the optimal framework, all derived from the same brand positioning source of truth.