---
name: WriteStory
pack-id: durante-writestory-v1.0.0
version: 1.0.0
author: durante-tech
description: Layered fiction writing system using Will Storr's storytelling science and Mark Forsyth's rhetoric -- seven simultaneous narrative dimensions from meaning to prose
type: skill
purpose-type: [writing, fiction, storytelling, creative, narrative]
platform: claude-code
dependencies: []
keywords: [fiction, novel, short-story, chapter, story-bible, character-arc, creative-writing, worldbuilding, will-storr, mark-forsyth, rhetoric, prose, narrative]
---

# WriteStory

> Layered fiction writing system -- constructs stories across seven simultaneous narrative dimensions using Will Storr's storytelling science and Mark Forsyth's rhetoric.

---

## The Problem

AI-assisted fiction writing typically produces flat, generic prose. The usual approach treats stories as a sequence of events rather than a multi-layered system. Common failures:

- **Single-layer thinking** -- plot events without thematic meaning, character change, or mystery management
- **Generic prose** -- no rhetorical figures, no voice, no style beyond "clear and readable"
- **No story bible** -- each chapter written in isolation without a master plan tracking all narrative threads
- **Cliche-heavy output** -- AI defaults to familiar phrases and predictable arcs without an anti-cliche system
- **No revision methodology** -- first draft treated as final without multi-pass quality checks

The fundamental issue: fiction requires simultaneous management of meaning, character, plot, mystery, world, relationships, and prose -- not sequential event generation.

---

## The Solution

The write-story pack provides a seven-layer story construction system with structured workflows from ideation to polished prose.

**What's included:**

1. **Interview** -- Structured extraction of story ideas mapped across all seven layers
2. **Build Bible** -- Comprehensive story bible with milestones and arcs for every layer
3. **Explore** -- Divergent creative exploration: what-if scenarios, alternative paths, theme variations
4. **Write Chapter** -- Prose generation using story bible milestones and rhetorical figures
5. **Revise** -- Multi-pass revision for consistency, voice, anti-cliche, and polish

---

## Installation

This pack is designed for AI-assisted installation. Give this directory to your AI and ask it to install using `INSTALL.md`.

**What is DOS?** See the [DOS Project Overview](https://github.com/durante-tech/dos#what-is-dos).

---

## What's Included

| Component | Path | Purpose |
|-----------|------|---------|
| Skill Definition | `src/SKILL.md` | Seven layers, routing, methodology |
| Interview | `src/Workflows/Interview.md` | Story idea extraction |
| Build Bible | `src/Workflows/BuildBible.md` | Master story plan |
| Explore | `src/Workflows/Explore.md` | Creative brainstorming |
| Write Chapter | `src/Workflows/WriteChapter.md` | Prose generation |
| Revise | `src/Workflows/Revise.md` | Multi-pass revision |

**Summary:**
- **Directories:** 2 (src, Workflows)
- **Files:** 6
- **Hooks registered:** 0
- **Dependencies:** None

---

## What Makes This Different

This is not "write me a story" prompt engineering. The seven-layer system ensures that every chapter simultaneously advances meaning (theme), character change (sacred flaw to transformation), plot (cause-and-effect), mystery (information management), world (setting and rules), relationships (bond evolution), and prose (rhetorical figures and voice). The story bible tracks all layers from beginning to end, and the revision workflow applies an anti-cliche system based on Will Storr's storytelling science and Mark Forsyth's rhetoric.

---

## Invocation Scenarios

| Trigger | What Happens |
|---------|--------------|
| "write a story" / "start a story" | Routes to Interview to extract ideas across all seven layers |
| "build a story bible" / "create a bible" | Routes to BuildBible to produce a master story plan with milestones |
| "explore ideas" / "what if" | Routes to Explore for divergent brainstorming and alternative paths |
| "write chapter" / "write the next chapter" | Routes to WriteChapter using story bible milestones and rhetorical figures |
| "revise" / "polish the chapter" | Routes to Revise for multi-pass quality checks and anti-cliche sweeps |

---

## Example Usage

### Start a New Story

```
User: "I want to write a short story about a surgeon who can't forgive herself"

AI:
1. Routes to Interview workflow
2. Extracts ideas across all seven layers: meaning (forgiveness vs. perfectionism),
   character (sacred flaw: inability to accept imperfection), plot, mystery, world,
   relationships, prose voice
3. Produces a structured interview document mapping the concept to each layer
4. "Interview complete. Your story has strong thematic tension between perfectionism
   and self-forgiveness. Ready to build the bible?"
```

### Build the Story Bible

```
User: "build the bible for this story"

AI:
1. Routes to BuildBible workflow
2. Creates milestones for each of the seven layers across the story arc
3. Tracks character transformation, mystery reveals, relationship shifts per chapter
4. "Story bible ready: 5 chapters, 7 layers tracked. Each chapter has specific
   milestones for meaning, character, plot, mystery, world, relationships, and prose."
```

### Revise a Chapter

```
User: "revise chapter 2 -- it feels flat"

AI:
1. Routes to Revise workflow
2. Pass 1: Consistency check against story bible milestones
3. Pass 2: Voice and rhetoric audit (Mark Forsyth figures)
4. Pass 3: Anti-cliche sweep (Will Storr methodology)
5. "Revised chapter 2: replaced 4 cliches, added anadiplosis in the climax paragraph,
   tightened the mystery reveal timing."
```

---

## Configuration

This pack requires no external configuration. All story state is managed through the story bible produced by the BuildBible workflow.

| Setting | Default | Notes |
|---------|---------|-------|
| Story bible location | Project root | BuildBible creates the bible file in your working directory |
| Chapter output | Project root | WriteChapter outputs prose files alongside the bible |
| Seven layers | All active | All layers are tracked by default; none can be disabled |

---

## Customization

### Recommended Customization

- Adjust the Interview workflow prompts to focus on genres you write most (literary fiction, thriller, fantasy, etc.)
- Customize the rhetorical figures checklist in the Revise workflow to match your prose style preferences

### Optional Customization

| Area | What to Change | Effect |
|------|---------------|--------|
| Layer weights | Emphasize specific layers (e.g., mystery-heavy for thriller) | Interview and BuildBible focus on your priority layers |
| Rhetoric set | Add or remove Mark Forsyth figures from the revision checklist | Revise workflow checks for your preferred figures |
| Anti-cliche rules | Extend the cliche detection list | Revise catches domain-specific cliches (e.g., fantasy tropes) |
| Chapter length | Adjust target word count in WriteChapter | Prose generation targets your preferred chapter size |

---

## Credits

- **Will Storr** -- *The Science of Storytelling* (character change, sacred flaw, storytelling methodology)
- **Mark Forsyth** -- *The Elements of Eloquence* (rhetorical figures for prose)
- **Story system design:** Lucas Gertel / DuranteOS

---

## Related Work

- [Sudowrite](https://www.sudowrite.com/) -- AI writing assistant focused on fiction (commercial SaaS)
- [NovelAI](https://novelai.net/) -- AI storytelling with fine-tuned models (commercial SaaS)
- [Dramatica](https://dramatica.com/) -- Story theory engine with structural analysis (desktop software)

---

## Works Well With

- **Thinking Pack** -- Use first-principles or creative brainstorming modes to develop story concepts before entering the Interview workflow
- **Agents Pack** -- Compose specialized reader/editor agents for targeted feedback on specific chapters
- **ContentAnalysis Pack** -- Analyze published fiction to extract storytelling patterns before writing

---

## Changelog

### 1.0.0 - 2026-04-09
- Initial release
- 5 workflows: Interview, BuildBible, Explore, WriteChapter, Revise
- Seven-layer story construction system
- Will Storr + Mark Forsyth methodology
