---
name: Update
description: Surgically update specific tokens or component rules in an existing DESIGN.md file based on user requests.
status: STABLE
bestPath:
  - title: "Read Existing File"
    description: "Load the project's current DESIGN.md, redirecting to Init if none exists."
  - title: "Identify Changes"
    description: "Determine which tokens or component rules the user wants modified."
  - title: "Apply Edits"
    description: "Make precise token, structural, or additive edits while preserving the DESIGN.md schema."
  - title: "Verify & Report"
    description: "Confirm structural and token consistency, then report changes and any downstream effects."
---

# Update Workflow

Surgically update specific tokens or component rules in an existing DESIGN.md file based on user requests.

## When to Use

- User wants to change a color, font, spacing value, or component rule
- User says "change the primary color to red", "update the heading font", etc.
- DESIGN.md already exists in the project

## Steps

### Step 0: Load SoT

See `~/.claude/DOS/PARTIALS/LoadSoT.md`.

### Step 1: Read Existing File

Load the project's current DESIGN.md. If it does not exist, redirect to the Init workflow.

### Step 2: Identify Changes

Determine which tokens or rules need modification based on the user's request. Examples:
- "Change the primary color to red" -- update `brand-primary` value
- "Use Poppins for headings" -- update font-family-heading
- "Make the spacing tighter" -- adjust spacing scale values
- "Add a badge component" -- add new component blueprint

### Step 3: Apply Edits

Use the Edit tool to make precise replacements:
- For single token changes: replace the specific value (e.g., change a hex code or font name)
- For structural changes: rewrite the specific section while preserving the overall DESIGN.md structure
- For additions: append new tokens or component blueprints in the appropriate section

### Step 4: Verify Consistency

After editing, verify:
- Markdown structure remains intact and compliant with the schema
- Usage rules are updated if the change affects them (e.g., changing a color may affect contrast ratios)
- Related tokens are still consistent (e.g., if primary color changes, check if any component tokens reference it)
- All color values remain in OKLCH format

### Step 5: Report Changes

Tell the user:
- What was changed (specific tokens and old/new values)
- Any downstream effects (e.g., "This changes the hero accent, primary buttons, and CTA gradient")
- Whether any existing code may need regeneration (recommend running the Audit workflow)

## Validation

- [ ] DESIGN.md still parses correctly after edits
- [ ] Changed tokens have valid values
- [ ] Usage rules updated if affected by the change
- [ ] No orphaned references (tokens that reference removed values)
- [ ] Color values in OKLCH format