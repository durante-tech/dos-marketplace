# Principles — DRY, Orthogonality, Tracer Bullets, Knowledge Portfolio, the 7 Habits

**All verbatim. Source-tagged. The full canonical reference for the future Pragmatic skill.**

Source attribution shorthand:
- *PP1* = *The Pragmatic Programmer*, 1st edition (Addison-Wesley, October 1999) — 70 numbered tips
- *PP2* = *The Pragmatic Programmer: 20th Anniversary Edition* (Addison-Wesley, September 2019) — 100 numbered tips
- *PT&L* = *Pragmatic Thinking and Learning: Refactor Your Wetware* (Andy Hunt, Pragmatic Bookshelf, 2008)

---

## DRY — Don't Repeat Yourself

Coined by Andy Hunt and Dave Thomas in *PP1* (1999). The most-misunderstood principle in the book — Dave says so himself in interviews.

**Verbatim definition:**
> *"Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."*

Source: *PP2* Topic 9 / *PP1* Tip 11 (also: media.pragprog.com/titles/tpp20/dry.pdf — publisher's free DRY excerpt).

**Tip pairing:**
- **Tip 15 (PP2) / Tip 11 (PP1):** *"DRY—Don't Repeat Yourself."*
- **Tip 16 (PP2) / Tip 12 (PP1):** *"Make It Easy to Reuse."*

**Authors' clarification (interview, Artima):**
> *"Don't Repeat Yourself (or DRY) is probably one of the most misunderstood parts of the book."* — Dave Thomas, Artima interview.

**Critical nuance:** DRY is about **knowledge**, not character sequences. Database schema, test plans, build files, and documentation count as knowledge representations. Two functions that happen to share three lines but encode different concepts are NOT a DRY violation. Two functions encoding the same business rule in different shapes ARE.

---

## Orthogonality

Borrowed from geometry. Two lines are orthogonal if they meet at right angles; in vector terms, the two lines are independent.

**Verbatim definition:**
> *"Two or more things are orthogonal if changes in one do not affect any of the others."*

Source: *PP2* Topic 10 / *PP1* §"Orthogonality" Ch. 2.

**Origin (verbatim from same chapter):**
> *"Orthogonality is a term borrowed from geometry. Two lines are orthogonal if they meet at right angles… In vector terms, the two lines are independent."*

**Tip pairing:**
- **Tip 17 (PP2) / Tip 13 (PP1):** *"Eliminate Effects Between Unrelated Things."*

**Authors' interview gloss:**
> *"Things that are not related conceptually should not be related in the system."* — Andy Hunt, Artima interview.
> *"If you have a truly orthogonal system, unrelated elements are expressed independently."* — Dave Thomas, same interview.
> *"We've all worked on systems where you make one small change, and another problem pops out."* — Dave Thomas, same.

---

## Tracer Bullets vs Prototypes

A canonical Pragmatic distinction. Both are early-feedback techniques; they are NOT interchangeable.

### Tracer Bullets

**Verbatim Tip:**
- **Tip 20 (PP2) / Tip 15 (PP1):** *"Use Tracer Bullets to Find the Target."*

**Concept (close paraphrase from Topic 12 framing — verify before live use):**
> Tracer code is not throwaway code: you write it for keeps. It contains all the error checking, structuring, documentation, and self-checking that any piece of production code has.

War-story origin: phosphorus tracer rounds in night-fire combat — fire-and-watch-the-arc, adjust to target. The tracer round becomes part of the combat load; not discarded after.

**The distinction:** Tracer code is **end-to-end production code**, lean but complete, becoming the skeleton of the final system.

### Prototypes

**Verbatim Tip:**
- **Tip 21 (PP2) / Tip 16 (PP1):** *"Prototype to Learn."*

**Concept (verbatim from Topic 13 / §2.6):**
> *"Prototyping generates disposable code."*

**The distinction:** Prototypes are **throwaway**, written to learn one thing fast and then discarded.

**The anti-pattern:** TRACER-1 — Prototype-as-Production (shipping the prototype because "it works") and TRACER-2 — No End-to-End Path (no tracer fired, integration deferred for months).

---

## Broken Windows + Software Entropy

Anchored to Wilson & Kelling's 1982 broken-windows criminology paper and the NYC subway turnaround anecdote.

**Verbatim Tip:**
- **Tip 5 (PP2) / Tip 4 (PP1):** *"Don't Live with Broken Windows."*

**Verbatim chapter wording:**
> *"Don't leave 'broken windows' (bad designs, wrong decisions, or poor code) unrepaired. Fix each one as soon as it is discovered."*

> *"One broken window, left unrepaired for any substantial length of time, instills in the inhabitants of the building a sense of abandonment."*

Source: *PP2* Topic 3 / *PP1* §"Software Entropy" Ch. 1.

**The framing:** the **second** broken window costs nothing because the first one already shifted the team's standard. The signal "we care" is what stops the cascade.

---

## Boiled Frog

> *"If you take a frog and drop it into boiling water, it will jump straight back out again. However, if you place the frog in a pan of cold water, then gradually heat it, the frog won't notice the slow increase in temperature and will stay put until cooked."*

Source: *PP2* Topic 4: "Stone Soup and Boiled Frogs" / *PP1* Ch. 1. (Tag `[paraphrase — close paraphrase, verify exact wording]`.)

**Tip pairing:**
- **Tip 7 (PP2) / Tip 6 (PP1):** *"Remember the Big Picture."*

**The framing:** Daily degradation (build time, test flakes, on-call pages, dependency drift) is invisible at the day-grain. Step out of the pot to look at the water. Track the metric over weeks, not days.

---

## Stone Soup

> Three soldiers returning home from war were hungry. When they saw the village ahead, their spirits lifted… But the villagers were poor and afraid, and hid their food. Undaunted, the soldiers boiled a pot of water and carefully placed three stones into it. The amazed villagers came out to watch.

(Source: *PP2* Topic 4 / *PP1* Ch. 1. Tag `[paraphrase of folk-tale retelling — verify]`.)

**Tip pairing:**
- **Tip 6 (PP2) / Tip 5 (PP1):** *"Be a Catalyst for Change."*

**The lesson (in our voice):** be the soldier — start the pot, and the village contributes the rest. Don't wait for top-down mandate; bring stones, let villagers add carrots.

---

## Rubber Ducking

A debugging technique we wrote down from a real student at a real university who carried a real yellow rubber duck.

**Verbatim concept wording:**
> *"A very simple but particularly useful technique for finding the cause of a problem is simply to explain it to someone else."*

Source: *PP2* Topic 28 / *PP1* Ch. 3 §"Rubber Ducking."

**The mechanism:** by setting the duck on the desk and explaining the code line-by-line, the developer's own articulation surfaces the assumption that's wrong. The duck never solves a problem; the explaining-aloud does.

---

## Programming by Coincidence

The foundational anti-pattern. Code that works for unknown reasons.

**Verbatim Tip:**
- **Tip 62 (PP2) / Tip 44 (PP1):** *"Don't Program by Coincidence."*

**Concept (close paraphrase from Topic 38 framing — verify exact wording):**
> Don't program by coincidence — rely only on reliable things. Beware of accidental complexity, and don't confuse a happy coincidence with a purposeful plan.

**Diagnosis:** code that works "for reasons we don't understand" is a stack of accidents. When it breaks, you can't debug it because you never knew why it ran in the first place.

### The 7 Habits Replacing Programming by Coincidence

From *PP1* Ch. 6 §"How to Program Deliberately":

1. **Always be aware of what you're doing.**
2. **Don't code blindfolded.** Don't build what you don't understand.
3. **Proceed from a plan**, whether that plan is in your head, on a napkin, or on a wall-sized printout.
4. **Rely only on reliable things.** Don't depend on accidents or assumptions.
5. **Document your assumptions.**
6. **Don't just test your code, but test your assumptions as well.** Don't guess; actually try it.
7. **Prioritize your effort.** Spend time on the important. The important is usually the difficult.

(Some printings include an eighth habit: **Don't be a slave to history.** Don't let existing code dictate future code; you're allowed to throw things away.)

Source: *PP1* Ch. 6 §"Programming by Coincidence."

---

## Knowledge Portfolio

**Verbatim Tip:**
- **Tip 9 (PP2) / Tip 8 (PP1):** *"Invest Regularly in Your Knowledge Portfolio."*

**The Five Investment Rules (from Ch. 1 §"Your Knowledge Portfolio"):**

1. **Invest regularly** — even a small amount; the *habit* matters more than the sum.
2. **Diversify** — the more topics you know, the more valuable you are.
3. **Manage risk** — don't put all your skills in one technology basket.
4. **Buy low, sell high** — learning emerging tech before it's hot pays compound returns.
5. **Review and rebalance** — your portfolio of skills, like a financial one, needs periodic re-examination.

**The Concrete Habits (verbatim):**
> *"Learn at least one new language every year."*
> *"Read a technical book each quarter."*
> *"Read nontechnical books, too."*
> *"Take classes."*
> *"Participate in local user groups."*
> *"Experiment with different environments."*
> *"Stay current."*

Source: *PP1* Ch. 1 §"Your Knowledge Portfolio" / *PP2* Topic 6.

---

## Critical Reading

**Verbatim Tip:**
- **Tip 10 (PP2) / Tip 9 (PP1):** *"Critically Analyze What You Read and Hear."*

**Verbatim chapter sentence:**
> *"Don't be swayed by vendors, media hype, or dogma. Analyze information in terms of you and your project."*

Source: *PP2* Topic 7.

---

## Pragmatic Estimation

**Verbatim Tips:**
- **Tip 23 (PP2) / Tip 18 (PP1):** *"Estimate to Avoid Surprises."*
- **Tip 24 (PP2) / Tip 19 (PP1):** *"Iterate the Schedule with the Code."*

**Chapter wording:**
> *"Estimate before you start. You'll spot potential problems up front."*
> *"Use experience you gain as you implement to refine the project time scales."*

Source: *PP1* Ch. 2 §"Estimating."

**The Estimation Reply (paraphrase):** When asked *"How long will it take?"*, the pragmatic answer is *"I'll get back to you."* Slow down. Look at it. Give an order-of-magnitude answer with units chosen to reflect uncertainty (days vs weeks vs months). Iterate as you learn.

---

## Refactor Early, Refactor Often

**Verbatim Tip:**
- **Tip 65 (PP2) / Tip 47 (PP1):** *"Refactor Early, Refactor Often."*

**Verbatim chapter framing:**
> *"Just as you might weed and rearrange a garden, rewrite, rework, and re-architect code when it needs it."*

Source: *PP1* Ch. 6 §"Refactoring."

**Refactor-when-it-hurts test:** refactor on signal, not on schedule. Signals: DRY violations, non-orthogonal design, outdated knowledge, performance problems revealed by profiling.

---

## Pragmatic Testing

A constellation of tips:

- **Tip 70 (PP2) / Tip 49 (PP1):** *"Test Your Software, or Your Users Will."*
- **Tip 91 (PP2) / Tip 63 (PP1):** *"Coding Ain't Done 'Til All the Tests Run."*
- **Tip 90 (PP2) / Tip 62 (PP1):** *"Test Early. Test Often. Test Automatically."* (1st-ed wording)
- **Tip 93 (PP2) / Tip 65 (PP1):** *"Test State Coverage, Not Code Coverage."*
- **Tip 94 (PP2) / Tip 66 (PP1):** *"Find Bugs Once."*
- **Tip 66 (PP2) — new in 2nd ed:** *"Testing Is Not About Finding Bugs."*
- **Tip 67 (PP2) — new in 2nd ed:** *"A Test Is the First User of Your Code."*
- **Tip 71 (PP2) — new in 2nd ed:** *"Use Property-Based Tests to Validate Your Assumptions."*

---

## Requirements

**Verbatim Tips:**
- *PP1* Tip 51: *"Don't Gather Requirements—Dig for Them."*
- *PP1* Tip 52: *"Work with a User to Think Like a User."*
- *PP1* Tip 54: *"Use a Project Glossary."*

**Verbatim chapter sentence:**
> *"Requirements rarely lie on the surface. They're buried deep beneath layers of assumptions, misconceptions, and politics."*

Source: *PP1* Ch. 7 §"The Requirements Pit."

---

## Power Tools

- **Tip 25 (PP2) / Tip 20 (PP1):** *"Keep Knowledge in Plain Text."*
- **Tip 26 (PP2) / Tip 21 (PP1):** *"Use the Power of Command Shells."*
- **Tip 27 (PP2):** *"Achieve Editor Fluency."* (1st-ed: *"Use a Single Editor Well."*)
- **Tip 28 (PP2):** *"Always Use Version Control."* (1st-ed: *"Always Use Source Code Control."*)

**Verbatim 2nd-ed framings:**
> *"An editor is your most important tool. Know how to make it do what you need, quickly and accurately."*
> *"Plain text won't become obsolete. It helps leverage your work and simplifies debugging and testing."*
> *"Version control is a time machine for your work; you can go back."*

Source: *PP2* Topics 17, 18, 19.

---

## Debugging Attitude

- **Tip 29 (PP2) / Tip 24 (PP1):** *"Fix the Problem, Not the Blame."*
- **Tip 30 (PP2):** *"Don't Panic."* (1st-ed: *"Don't Panic When Debugging."*)
- **Tip 31 (PP2):** *"Failing Test Before Fixing Code."* (new in 2nd ed)
- **Tip 32 (PP2):** *"Read the Damn Error Message."* (new in 2nd ed)
- **Tip 33 (PP2) / Tip 26 (PP1):** *"\"select\" Isn't Broken."* (i.e., bugs in the OS / compiler / libraries are vanishingly rare; suspect your own code first)
- **Tip 34 (PP2) / Tip 27 (PP1):** *"Don't Assume It—Prove It."*

**Verbatim 2nd-ed quip on Tip 30:**
> *"This is true for galactic hitchhikers and for developers."*

---

## Pragmatic Paranoia (Contracts + Assertions)

- **Tip 36 (PP2) / Tip 30 (PP1):** *"You Can't Write Perfect Software."*
- **Tip 37 (PP2) / Tip 31 (PP1):** *"Design with Contracts."*
- **Tip 38 (PP2) / Tip 32 (PP1):** *"Crash Early."*
- **Tip 39 (PP2) / Tip 33 (PP1):** *"Use Assertions to Prevent the Impossible."*

---

## Sign Your Work + Care for the Craft

- **Tip 1 (PP1, PP2):** *"Care About Your Craft."*
- **Tip 2 (PP1, PP2):** *"Think! About Your Work."*
- **Tip 97 (PP2) / Tip 70 (PP1):** *"Sign Your Work."*

**Verbatim chapter sentence on Sign Your Work:**
> *"Craftsmen of an earlier age were proud to sign their work. You should be, too."*

Source: *PP1* Ch. 8 §"Sign Your Work."

**2nd-ed additions (ethical caretakership):**
- **Tip 98 (PP2):** *"First, Do No Harm."*
- **Tip 99 (PP2):** *"Don't Enable Scumbags."*
- **Tip 100 (PP2):** *"It's Your Life. Share it. Celebrate it. Build it. AND HAVE FUN!"*

---

## Pragmatic Thinking and Learning — Dreyfus Model (Andy Hunt 2008)

From *PT&L* (Pragmatic Bookshelf, 2008).

**The Five Stages of Skill Acquisition** (from the Dreyfus brothers' framework, applied to programmers):

1. **Novice** — wants recipes; little experience; needs context-free rules.
2. **Advanced Beginner** — starts to break free from rules; recognizes situational features.
3. **Competent** — can solve real problems; develops mental models; struggles with unfamiliar problems.
4. **Proficient** — wants the big picture; will be frustrated by oversimplified information.
5. **Expert** — primary source of knowledge in a field; relies on intuition rather than rules.

**Verbatim from publisher page:**
> *"Software development happens in your head. Not in an editor, IDE, or design tool."*
> *"You'll learn how our brains are wired, and how to take advantage of your brain's architecture."*
> *"You'll learn new tricks and tips to learn more, faster, and retain more of what you learn."*

Source: pragprog.com/titles/ahptl/

**R-mode vs L-mode** (Andy's adaptation of Betty Edwards):
- **L-mode** = Linear-mode — verbal, analytic, sequential; the dominant mode in conventional programming work.
- **R-mode** = Rich-mode — holistic, intuitive, pattern-matching; surfaces during walking, showering, sleeping.

**Implication for programmers:** spend time in BOTH modes. The expert is not someone who has cycled L-mode harder; the expert is someone who has integrated R-mode access.

---

## Manifesto for Agile Software Development (2001)

Both Andy and Dave were among the **17 original signers** at Snowbird, Utah, 11–13 February 2001. We co-signed alongside Beck, Fowler, Cockburn, Martin, Sutherland, Schwaber, Highsmith, and others.

Source: agilemanifesto.org / Wikipedia.

---

## The Bookshelf Mission (Pragmatic Bookshelf, 2003)

> *"to improve the lives of software developers"*

Source: pragprog.com/about/

We pioneered the **beta book** model — readers buy the in-progress book at PDF beta and receive updates as the manuscript is revised — and we've been **DRM-free since day one**:

> *"Our titles do not contain any Digital Restrictions Management, and have always been DRM-free."*

Source: same.
