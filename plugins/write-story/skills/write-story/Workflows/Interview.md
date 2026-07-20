---
name: Interview
description: Runs a structured interview to extract a user's story idea and map it across all seven narrative layers, producing a structured summary for the BuildBible workflow.
status: STABLE
bestPath:
  - title: "Open-Ended Extraction"
    description: "Let the user talk freely about their idea; listen for signals across all seven layers."
  - title: "Layer Mapping"
    description: "Map answers across the seven layers, identifying what exists and what's missing."
  - title: "Sacred Flaw Identification"
    description: "Define the protagonist's wrong belief, its origin, and how the story breaks it."
  - title: "Produce Structured Output"
    description: "Deliver a structured interview summary ready to hand off to BuildBible."
---

# Interview -- Story Idea Extraction

Structured interview to extract story elements and map them across all seven layers.

## When to Use

User has a story idea (character concept, world, premise, theme) and needs it developed into structured input for the story bible.

## Workflow

### Step 1: Open-Ended Extraction

Ask about the story in natural conversation. Let the user talk freely about their idea. Listen for signals across all seven layers:

- What character(s) do you see?
- What world or setting?
- What's the central conflict or tension?
- What themes or ideas are you exploring?
- What tone or feeling should it evoke?
- Any specific scenes or moments you already see clearly?

### Step 2: Layer Mapping

Map the user's answers across the seven layers. For each layer, identify what exists and what's missing:

| Layer | What We Have | What's Missing |
|-------|-------------|---------------|
| Meaning | [theme signals] | [needs sharpening] |
| Character Change | [protagonist + flaw hints] | [sacred flaw needs definition] |
| Plot | [events mentioned] | [cause-and-effect chain] |
| Mystery | [unknowns] | [reveal timing] |
| World | [setting details] | [pressure system] |
| Relationships | [characters mentioned] | [bond evolution plan] |
| Prose | [tone/voice preferences] | [rhetorical strategy] |

### Step 3: Sacred Flaw Identification

The most critical element. Work with the user to define:
- **What does the protagonist believe about the world that is wrong?**
- **Where did this belief come from?**
- **How will the story break this belief?**
- **What will the protagonist understand at the end that they didn't at the start?**

### Step 4: Produce Structured Output

Deliver a structured interview summary ready for BuildBible:

```markdown
# Story Interview Summary

## Premise
[One paragraph]

## Seven-Layer Map
### Meaning: [theme statement]
### Character Change: [sacred flaw] -> [transformation]
### Plot: [key events in cause-and-effect]
### Mystery: [central questions]
### World: [setting + pressure system]
### Relationships: [key bonds]
### Prose: [voice/style direction]

## Open Questions
- [Things still undecided]

## Next Step
Run BuildBible workflow to create the full story plan.
```

## Validation

- [ ] All seven layers addressed (even if some are thin)
- [ ] Sacred flaw clearly defined
- [ ] Structured output ready for BuildBible