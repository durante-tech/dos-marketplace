---
name: WriteStory
description: Layered fiction writing system using Will Storr's storytelling science and Mark Forsyth's rhetorical figures. Constructs stories across seven simultaneous narrative dimensions from meaning to prose. USE WHEN write story, fiction, novel, short story, chapter, story bible, character arc, creative writing, worldbuilding, write chapter, revise chapter, story interview, explore story ideas.
role: generator
accepts:
  - text
icon: BookOpen
colorVar: secondary
colorHex: "#deb7ff"
tier: primary
category: Content
displayLabel: Story Writing
marketingDescription: "Fiction using 7-layer narrative science: meaning, character, plot, mystery, and world."
capabilities:
  - artifact.write
  - customization.cascade
  - four-copy.sync
  - voice.emit
elevator: 7-layer narrative science for fiction writing
highlightWorkflows:
  - name: Write Story
    technicalName: WriteStory
  - name: Story Analysis
    technicalName: StoryAnalysis
roots:
  - PROJECT.WORK
  - PROTECTED_LOCAL
visibility: public
feature_capabilities:
  - 7 simultaneous narrative layers
  - Character arc construction
  - Mark Forsyth's rhetorical figures
  - Will Storr's storytelling science
---
<!-- generated-from: SKILL.partials.md — DO NOT EDIT directly. Run: bun Tools/dos-build.ts skill <path> -->
# WriteStory -- Layered Fiction System

Constructs stories across seven simultaneous narrative dimensions using Will Storr's storytelling science and Mark Forsyth's rhetoric.

## The Seven Story Layers

Every story operates on all seven layers simultaneously. No layer is optional -- a story weak in any dimension feels "off" even if readers can't articulate why.

| # | Layer | What It Controls | Key Question |
|---|-------|-----------------|--------------|
| 1 | **Meaning** | Theme, philosophical argument | What is this story really about? |
| 2 | **Character Change** | Sacred flaw to transformation arc | How does the protagonist's worldview break and reform? |
| 3 | **Plot** | Cause-and-effect chain | What happens, and why does each event cause the next? |
| 4 | **Mystery** | Information management | What does the reader know, not know, and want to know? |
| 5 | **World** | Setting, rules, environment | Where does this happen, and what are the constraints? |
| 6 | **Relationships** | Bond evolution under pressure | How do connections between characters change? |
| 7 | **Prose** | Rhetorical figures, voice, style | How is it written -- what makes sentences memorable? |

### Layer 1: Meaning

The controlling idea -- the philosophical argument the story makes through its events. Not a "moral" stated explicitly, but a truth demonstrated through what happens to the characters.

- **Thesis:** What the protagonist believes at the start
- **Antithesis:** What the world proves through pressure
- **Synthesis:** The new understanding earned through suffering

### Layer 2: Character Change (Will Storr)

Every protagonist has a **sacred flaw** -- a deeply held belief about how the world works that is fundamentally wrong. The story is the process of reality breaking that belief.

- **Sacred flaw:** The protagonist's wrong model of the world
- **Origin:** Where the flaw came from (usually childhood or formative trauma)
- **Trigger:** The inciting event that begins pressuring the flaw
- **Escalation:** Increasing pressure that makes the flaw untenable
- **Crisis:** The moment the protagonist must choose between the flaw and growth
- **Transformation:** The new understanding (or tragic failure to change)

### Layer 3: Plot

Cause-and-effect, not "and then." Every event must cause the next. Plot serves character change -- events are chosen because they pressure the sacred flaw.

### Layer 4: Mystery

What the reader knows and doesn't know at every point. Mystery creates page-turning tension. Manage through:
- **Questions planted** -- what the reader wants answered
- **Reveals timed** -- when answers arrive (too early = boring, too late = frustrating)
- **Misdirection** -- false answers that are satisfying until the real answer arrives

### Layer 5: World

Setting is not backdrop -- it's a pressure system. The world's rules, constraints, and environment should actively pressure the sacred flaw.

### Layer 6: Relationships

Every significant relationship should evolve under pressure. Relationships are the primary vehicle for externalizing internal character change.

### Layer 7: Prose (Mark Forsyth)

Rhetorical figures make prose memorable. Deploy consciously:
- **Alliteration** -- repeated initial sounds for emphasis
- **Tricolon** -- groups of three for rhythm and completeness
- **Anadiplosis** -- ending one clause and beginning the next with the same word
- **Epistrophe** -- repeated endings for emotional weight
- **Chiasmus** -- reversed structure (ask not what X can do for Y, but what Y can do for X)
- **Hyperbaton** -- unusual word order for emphasis

**Anti-cliche system:** Flag and replace any phrase that "sounds like writing." If a description could appear in any novel, it's not specific enough.

## Customization

**Before executing, check for user customizations at:**
`~/.claude/DOS/USER/SKILLCUSTOMIZATIONS/WriteStory/`

If this directory exists, load and apply any PREFERENCES.md, configurations, or resources found there. These override default behavior. If the directory does not exist, proceed with skill defaults.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| Interview | "I have a story idea", "help me develop a story" | `Workflows/Interview.md` |
| BuildBible | "create story bible", "plan the full story" | `Workflows/BuildBible.md` |
| Explore | "what if", "brainstorm", "explore alternatives" | `Workflows/Explore.md` |
| WriteChapter | "write chapter [N]", "write the next chapter" | `Workflows/WriteChapter.md` |
| Revise | "revise", "polish", "edit chapter" | `Workflows/Revise.md` |
| Full pipeline (recommended) | End-to-end | Interview -> BuildBible -> WriteChapter -> Revise |

## Examples

**Example 1: Develop a story idea from a single seed sentence**
```
User: "I want to write a story about a surgeon who can't forgive herself"
→ Invokes Interview workflow to extract the seven narrative layers
→ Probes for sacred flaw, controlling idea, world rules, key relationships, prose voice; then hands off to BuildBible
→ User gets a story bible with all 7 layers populated and a chapter-level outline ready for WriteChapter
```

**Example 2: Write the next chapter using an existing story bible**
```
User: "Write chapter 3 of my novel"
→ Invokes WriteChapter workflow keyed to the chapter milestone in the story bible
→ Pressures the sacred flaw at the chapter's pre-defined intensity, deploys conscious rhetorical figures, runs anti-cliche flagging
→ User gets a chapter draft plus a layer-by-layer scorecard noting which dimensions still need work
```

**Example 3: Revise a flat chapter with multi-pass quality checks**
```
User: "This chapter feels flat — help me fix it"
→ Invokes Revise workflow with multi-pass review across all 7 layers
→ Identifies which layer is under-pressured (e.g., relationships not evolving, prose drifting toward cliche), proposes targeted edits
→ User gets a redlined draft with rationale per edit grounded in the specific layer that was weak
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

echo '{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","pack":"WriteStory","workflow":"WORKFLOW_NAME","type":"ARTIFACT_TYPE","title":"TITLE","path":"ABSOLUTE_PATH","contentPreview":"FIRST_500_CHARS_ESCAPED","wing":"WING_OR_GENERAL","sessionId":"'$CLAUDE_SESSION_ID'"}' >> "$ARTIFACTS_DIR/artifacts.jsonl"
```

If this skill is read-only (no Write tool usage), this section is informational only.

## Four-Copy Compliance

This skill exists in up to four locations per the DOS Four-Copy Rule (`Durante/CLAUDE.md`):

1. `~/.claude/skills/write-story/` — live install (what Claude Code runs)
2. `Releases/<active-version>/.claude/skills/write-story/` — active release submodule (versioned)
3. `Packs/*/src/WriteStory/` — pack source (distributable)
4. `Packs/agents/WriteStory/` — agent runtime (only if applicable)

After editing any file in this skill, verify all copies via `bun ~/Durante/Tools/sync-check.ts`. Exit code 0 = clean. Exit code 1 = drift; resolve with `--fix` before commit.
