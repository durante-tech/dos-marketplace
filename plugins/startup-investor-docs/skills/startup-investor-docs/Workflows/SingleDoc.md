---
name: Single Doc
description: Generate one specific investor document (pitch deck outline, exec summary, financial model, etc.) rather than the full suite.
status: STABLE
bestPath:
  - title: "Document Type Identification"
    description: "Match the request to one of the seven supported document types."
  - title: "Context Gathering"
    description: "Confirm company details, funding stage, and any specific VC requirements."
  - title: "Document Generation"
    description: "Generate the document via a specialized subagent calibrated to the funding stage."
  - title: "Write & Consistency Check"
    description: "Write the document to docs/investor/ and cross-check against other existing materials."
---

# Single Document Generation

Create one specific investor document rather than the full suite.

## When to Use

User says: "write an executive summary", "create pitch deck outline", "build financial projections", "write team bios for investors".

## Workflow

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Identify Document Type

| Document | Focus |
|----------|-------|
| Pitch deck outline | Structure, slide flow, key messages per slide |
| Executive summary | Narrative, market framing, investor-grade prose |
| Market analysis | TAM/SAM/SOM, industry trends, credible sourcing |
| Team overview | Bios, narrative, culture, hiring plan |
| Financial projections | Model structure, assumptions, unit economics |
| Competitive analysis | Landscape mapping, moat argument, positioning |
| Cap table | Ownership structure, option pool, funding history |

### Step 2: Gather Context

For the specific document type, confirm:
- **Company details:** Product, stage, key metrics
- **Funding stage:** Determines depth and format requirements
- **Specific requirements:** Any VC requests or preferences

### Step 3: Generate Document

Use a Claude Code subagent (Task tool) with the appropriate specialization:
- Instruct the agent with company context, stage, and document-specific requirements
- Ensure investor-grade quality, data-backed claims, and professional formatting
- Calibrate depth to the funding stage (see Generate workflow stage table)

### Step 4: Write and Review

Write the generated document to `docs/investor/[document-name].md`.

Cross-check for consistency with any other existing investor materials.

## Validation

- [ ] Document type matches request
- [ ] Investor-grade quality
- [ ] Consistent with other investor materials
- [ ] Calibrated to funding stage