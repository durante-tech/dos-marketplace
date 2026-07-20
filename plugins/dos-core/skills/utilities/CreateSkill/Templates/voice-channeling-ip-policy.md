# Voice-Channeling Skill — IP Policy

**Purpose:** codify the verbatim/paraphrase tagging stance for voice-channeling skills that channel **living authors with in-copyright canonical texts**. This is referenced from every research-agent brief in `VoiceChannelingSkill.md`.

**Why this exists:** Run #7 (Feathers) surfaced an agent self-correction mid-task — Agent B refused extended verbatim quotation from copyrighted *Working Effectively with Legacy Code* and reframed to paraphrase-tagged synthesis with short canonical terms preserved. The reframe was right but came as a discovery, not as policy. This document makes it default.

---

## The Stance

For any voice-channeling skill that channels an author whose canonical text is **in copyright** (which is most living authors' books and many post-1990 essays):

### What MAY be tagged `[verbatim]`

1. **Short canonical terms coined by the author** — single words, hyphenated phrases, named patterns. These are *fair-use terminology*, not protected expression. Examples:
   - Feathers: "Edit-and-Pray", "Cover-and-Modify", "characterization test", "seam", "object seam", "link seam", "preprocessing seam", "enabling point", "sensing variable", "effect sketch", "scratch refactoring", "lean on the compiler", "Sprout Method", "Wrap Method", "Extract Interface", etc.
   - Evans: "Bounded Context", "Ubiquitous Language", "Aggregate", "Anticorruption Layer", "Open Host Service", etc.
   - Beck: "Red-Green-Refactor", "Test List", "Fake It Til You Make It", "Triangulate", "Tidy First", etc.

2. **Short Tier-A passages from clearly-public sources**, where the source is a discourse-grade artifact rather than a copyrighted-book chapter:
   - Author's foreword to their OWN book (preface paragraphs) — typically reproduced widely, fair-use safe at quote-length.
   - Other authors' forewords *to* the channeled author's book (e.g., Bob Martin's foreword to WELC) — same.
   - Public blog posts on the author's own site (e.g., Feathers's "Carrying-Cost of Code" on silvrback).
   - Conference talk transcripts indexed by InfoQ / GOTO / public conference video.
   - Bliki posts (Fowler's bliki is the canonical example — entire bliki is structured for citation).
   - Pattern-statement headlines from named patterns (e.g., the "Therefore:" sentence in Evans's pattern entries — these get widely reproduced).

3. **The author's own published one-line aphorisms / slogans** — short, memorable, designed-to-be-quoted lines. Examples: *"Code without tests is bad code"* (Feathers), *"Make the change easy, then make the easy change"* (Beck tweet 2012), *"DRY"* (Pragmatic Tip).

### What MUST be tagged `[paraphrase]`

1. **Extended body prose from a copyrighted book** (paragraph-length narrative, multi-sentence walkthroughs, code-listing commentary). Even if recalled accurately from training corpus, reproducing extended in-copyright prose at scale in a public skill is an IP overreach.

2. **Talk-transcript material recovered from training corpus without an accessible verification URL.** If the agent can't WebFetch the source to confirm exact wording, tag `[paraphrase]` and capture the *substance* faithfully.

3. **Any "reconstructed from memory" quote** — even if confident — when the agent has no live source to verify.

4. **Mechanics steps from the dependency-breaking catalog (or any analog)** — these are *procedural*. Capture the sequence faithfully as paraphrase, preserve the canonical step names as terms (`[verbatim]` for "Sprout Method" the name; `[paraphrase]` for the 6-step procedure).

### What MUST NOT be presented as verbatim

- Paraphrased prose with quote marks around it.
- Reconstructions presented as direct citations.
- Unverified URL paths cited as if WebFetch-confirmed.

The skill's voice authority comes from **accurate use of canonical terms in their proper context**, not from extended copyrighted prose.

---

## How to Apply (research-agent brief boilerplate)

Every research agent brief for a copyrighted-author run MUST include this paragraph:

> **IP-safety stance:** Tag short canonical terms (single words / named patterns / aphorisms) as `[verbatim]`. Tag extended body prose from copyrighted books as `[paraphrase]` with faithful substance. Use `[verbatim]` for foreword/preface short passages and for public blog/talk content with verifiable URLs. NEVER reconstruct extended in-copyright prose and tag it `[verbatim]` — that's IP overreach. The skill's voice authority comes from canonical-term accuracy, not from extended copyrighted prose.

Drop this verbatim into briefs alongside the existing "Pre-Delegation Contract" rules.

---

## Empirical Track Record (7 runs)

| Run | Author | Verbatim emphasis | Notes |
|---|---|---|---|
| 1 | uncle-bob | Bob's body of work spans many sources; mix of book + bliki + talks | clean — Bob is heavily quoted in public discourse |
| 2 | cockburn | *Writing Effective Use Cases* canonical template field names | "Guarantees" canonical; allowlist-add (verbatim source) |
| 3 | fowler | Bliki + *Refactoring* + PoEAA | bliki content is fully public; rephrase used for own-prose "multiplies" |
| 4 | pragmatic | Numbered Tips (verbatim wording) + book preface | "leverage" canonical Tip 18; allowlist-add (verbatim source) |
| 5 | kent-beck | Tweets + *Tidy First?* + *TDD By Example* preface + Substack | Twitter + Substack content public; book content paraphrased at length |
| 6 | eric-evans | Blue Book + DDD-Ref 2015 (free PDF) + DDD Europe talks | DDD-Ref is freely distributed; many pattern statements widely reproduced |
| 7 | **Feathers** | **WELC + Carrying-Cost essay + Bob foreword + canonical terms** | **Agent B self-correction prompted this policy doc** |

**Pattern:** roughly half of voice-channeling runs have content that's *fully* public (bliki posts, blog essays, Substack, free PDFs, tweets). The other half lean on copyrighted books and need short-term/paraphrase-body tagging discipline.

---

## Pre-flight grep recipe (own-prose own-foot guard)

Before invoking the brand-voice validator, grep your own draft against the FORBIDDEN list to catch own-prose violations early:

```bash
rg -n -i "guarantee|leverage|seamless|empower|production-grade|production-ready|revolutioniz|game-changing|synergy|supercharg|first platform|the only|verified delivery" \
  Packs/{NewPack}/src/ MEMORY/RESEARCH/{date}_{author-slug}/
```

Hits in your own prose → rephrase before pre-flight (Fowler precedent: "multiplies" → "compounds"; Feathers precedent: "safety guarantee" → "safety net" / "safety stories"). Hits inside `[verbatim]` quoted source material → consider allowlist-add (Cockburn precedent: "Guarantees"; Pragmatic precedent: "leverage").

This catches own-prose violations *before* the validator does, so the pre-flight pass is genuinely first-time-clean rather than first-time-after-rephrase.
