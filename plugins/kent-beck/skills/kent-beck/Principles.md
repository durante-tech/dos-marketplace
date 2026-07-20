# Kent Beck — Principles (Verbatim Canonical References)

Eight canonical references that the `KentBeck` skill draws on. Each section gives the principle in Beck's own wording (verbatim where possible), with source citations and the operative interpretation.

---

## 1. Red-Green-Refactor — The TDD Cycle

**Source:** *Test-Driven Development: By Example* (Addison-Wesley, 2002), Preface, p. x.

**Verbatim form:**

> "Red—write a little test that doesn't work, perhaps doesn't even compile at first. Green—make the test work quickly, committing whatever sins necessary in the process. Refactor—eliminate all the duplication created in just getting the test to work."

**Two operative rules** (Preface p. ix):

1. "Write new code only if an automated test has failed." [verbatim]
2. "Eliminate duplication." [verbatim]

**Order is fixed:** Red → Green → Refactor. The compact 5-step restatement in Ch. 1 reads: "Add a little test / Run all tests and fail / Make a little change / Run the tests and succeed / Refactor to remove duplication."

**Critical attribution:** Beck does NOT use "Three Laws of TDD" terminology. That phrasing is Robert C. Martin's, from *Clean Code* (2008) Ch. 9 and the 2014 blog post "The Three Rules of TDD." When users ask Beck for "the three laws," Beck routes them to UncleBob — see `StepAsideTable.md`.

**The steering metaphor** (the bigger reason the cycle exists): TDD is fear-management, not bureaucracy. The ratchet keeps you from sliding back when you're tired. Step size adapts to confidence — bigger steps when sure, smaller steps when uncertain.

---

## 2. The Test List — Canon TDD

**Source:** *TDD By Example* (2002), Ch. 1 (Multi-Currency Money) + Beck's 2023 restatement *Canon TDD* on the Tidy First Substack.

**The discipline (verbatim from *Canon TDD*, 2023):**

1. "Write a list of the test scenarios you want to cover."
2. "Turn exactly one item on the list into an actual, concrete, runnable test."
3. "Change the code to make the test (& all previous tests) pass (adding items to the list as you discover them)."
4. "Until the list is empty, go back to #2."

**Initial framing** (from same post): "The initial step in TDD, given a system & a desired change in behavior, is to list all the expected variants in the new behavior."

**The list as second brain:** the list is paper-or-text-file thinking. Items get crossed off as they go green. New items get added when discovered mid-implementation. The list is *behavioral variants only* — internals come during the green/refactor phases, not at list-writing time.

**Canonical anti-patterns Beck names** (from *Canon TDD* 2023, verbatim): "Mistake: convert all the items on the Test List into concrete tests, then make them pass one at a time." "Mistake: mixing in implementation design decisions." "Mistake: mixing refactoring into making the test pass. Again with the 'wearing two hats' problem."

Beck's wry self-correction: "I made it as clear as possible in my book. I thought it was clear. Nope. My bad." [verbatim]

---

## 3. Simplest Thing That Could Possibly Work — Cunningham Origin

**Source:** Ward Cunningham, *The Simplest Thing that Could Possibly Work: A Conversation with Ward Cunningham*, Artima, December 2003.

**Verbatim — Cunningham's question:**

> "Kent, what's the simplest thing that could possibly work?"

Cunningham's working pattern with Beck (Smalltalk era, late 1980s / early 1990s, Tektronix and consulting projects): when stuck for more than a minute, stop and ask the question. The original was a **probe**, not a command. Cunningham notes the corruption to imperative form ("Do the simplest thing…") flattens the spirit — there's an implicit "we'll evaluate it as soon as we've done it" feedback step that the imperative form drops.

**Beck's deployment in TDD By Example** — three named patterns:
- **Fake It (Til You Make It)** — *TDD By Example* p. 13: "Return a constant and gradually replace constants with variables until you have the real code." [verbatim]
- **Obvious Implementation** — same patterns chapter, p. 13: "Type in the real implementation." [verbatim]
- **Triangulate** — p. 153: "Abstract only when you have two or more examples." [verbatim]

**Beck's "shifting gears" metaphor** (p. 155): "You want to maintain that red/green/refactor rhythm. Obvious Implementation is second gear. Be prepared to downshift if your brain starts writing checks your fingers can't cash." [verbatim]

**Critical attribution:** the question is **Cunningham's**, not Beck's. The `KentBeck` skill must cite Cunningham when the phrase is invoked. Beck's role is the practitioner who took the question "to the limit" (Cunningham's own retrospective phrasing).

---

## 4. Make the Change Easy, Then Make the Easy Change

**Sources:** Twitter/X, 25 September 2012, status `250733358307500032` (the tweet); *Refactoring* (Fowler/Beck 1999) p. 7 (the book-length form, predating the tweet by 13 years).

**Verbatim tweet** (lowercase "for", parenthetical mandatory, no terminal period):

> for each desired change, make the change easy (warning: this may be hard), then make the easy change

**Verbatim book form** (*Refactoring*, 1999, p. 7):

> "When you find you have to add a feature to a program, and the program's code is not structured in a convenient way to add the feature, first refactor the program to make it easy to add the feature, then add the feature."

**Common misquotes to avoid:**
- "Make the change easy, *then* make the easy change" — drops the "warning: this may be hard" parenthetical (most common loss). The warning IS the substance.
- Capitalizing "For" / adding a period — neither in the original.
- Substituting "First" for "for each desired change" — the original is universally quantified across changes, not a single-step instruction.

**The principle:** structural change first (preparatory refactoring/tidying), behavioral change second. The structural step is often hard; the behavioral step then becomes trivial. This is the load-bearing thesis of *Tidy First?* (2023) — preparatory work pays back the next feature.

---

## 5. Tidying vs. Refactoring — The Cost/Benefit Frame

**Source:** *Tidy First? A Personal Exercise in Empirical Software Design* (O'Reilly, 2023). Three parts: I. Tidyings, II. Managing, III. Theory.

**Definition (verbatim):**

> "A tidying is a teensy weensy cute fuzzy little refactoring that nobody could possibly hate on."

The diminutives are deliberate — Beck is de-escalating so practitioners don't argue about whether a one-line cleanup needs a ticket. Tidyings are: guard-clause inversion, dead-code deletion, helper extraction, symmetric naming, reading-order reorganization. The size delta is the point. Refactorings need coordination weight; tidyings slip into the same PR (or land standalone in seconds).

**The four levers of the tidying decision** (Pt. III: Theory):

1. **Cost of tidying now** — the work today.
2. **Cost of the behavior change without tidying** — the friction the messy structure imposes.
3. **Discount rate** — does this code survive long enough to recoup the tidy?
4. **Optionality** — value of being able to make many future behavior changes cheaply, not just this one.

**Economic claim (verbatim):** "We make money by changing software." Structure that resists change is a tax on every future feature.

**Decision tree:**
- **Tidy first**, same PR — if tidying makes the behavior change obviously easier.
- **Tidy after**, separate PR — if the behavior change reveals the right shape only in hindsight.
- **Tidy later**, separate session — if the next behavior change is unknown or unlikely.
- **Don't tidy** — dead code, throwaway, high discount rate.

**Coordination frame (verbatim):** "Software design is an exercise in human relationships." The tidy/refactor decision is a coordination decision before it's a code decision. Tidyings are unilateral; refactorings need a team conversation.

---

## 6. Coupling and Cohesion — Empirical Software Design

**Source:** *Software Design: Tidy First?* Substack — "Coupling and Cohesion", "Why 'Empirical'?", and the related tl;dr posts.

**Working definitions (verbatim):**

> "Two elements are coupled to the degree that changes to one tend to require changes in another."

> "An element is cohesive to the degree that the entire element changes when the system needs to change."

> "Coupling between elements is a conductor of change."

The controlling metaphor is **conductor of change** — coupling is not a property of the static code, it's a property of *how change propagates*. You measure coupling by changing things and watching what else has to change.

**Economic frame (verbatim):**

> "Coupling, cohesion, & the behavior changes we want to make drive what the design should be."

> "We look at the behavior change we want to make. We look at the design as it is. We decide, empirically, what the design should be to reduce the cost of the behavior change."

**What "empirical" means** (Beck's contrast in "Why 'Empirical'?"): empirical design is opposed to two failure modes:
- **Speculative** — design done so early it inflates the cost of being wrong.
- **Reactive** — design done so late the coupling cost has already been paid, repeatedly.

Empirical design observes the actual change in front of you and decides timing from evidence, not from doctrine.

---

## 7. XP Values and Practices

**Source:** *Extreme Programming Explained: Embrace Change* — 1st edition (Addison-Wesley, 1999) and 2nd edition (with Cynthia Andres, 2004).

**Values — 1st ed. (1999): four**
1. Communication
2. Simplicity
3. Feedback
4. Courage

**Values — 2nd ed. (2004): five** (Respect added). Beck's framing: respect is the foundation that allows the other four to function — without mutual respect, feedback cannot be heard, courage becomes recklessness, simplicity becomes laziness.

**12 core practices, 1st ed. (1999):**
The Planning Game · Small Releases · Metaphor · Simple Design · Testing · Refactoring · Pair Programming · Collective Ownership · Continuous Integration · 40-Hour Week (Sustainable Pace) · On-Site Customer · Coding Standards.

**2nd ed. (2004) reorganization** — Primary practices (13): Sit Together · Whole Team · Informative Workspace · Energized Work · Pair Programming · Stories · Weekly Cycle · Quarterly Cycle · Slack · Ten-Minute Build · Continuous Integration · Test-First Programming · Incremental Design. Plus Corollary practices (11): Real Customer Involvement · Incremental Deployment · Team Continuity · Shrinking Teams · Root-Cause Analysis · Shared Code · Code and Tests · Single Code Base · Daily Deployment · Negotiated Scope Contract · Pay-Per-Use.

**Notable shifts 1st → 2nd:** "Metaphor" dropped from primary; "40-Hour Week" → "Energized Work"; "On-Site Customer" → "Real Customer Involvement" (corollary); "Refactoring" subsumed under "Incremental Design"; "Testing" promoted to "Test-First Programming."

**Pair programming definition (verbatim, 1st ed. Ch. 14):**

> "Pair programming is a dialog between two people trying to simultaneously program (and analyze and design and test) and understand together how to program better. It is a conversation at many levels, assisted by and focused on a computer."

The dialog is the practice; the typing is incidental.

---

## 8. Implementation Patterns — Code for People

**Source:** *Implementation Patterns* (Addison-Wesley Signature Series, 2007). 77 patterns for everyday code-level decisions.

**Thesis** (paraphrased Beck framing across the book): patterns are about programming for an audience. The first audience is the computer; the second, far more critical audience is other programmers. Code is read more than it is written. The book is a vocabulary for naming the small choices — when to use a `for` loop vs. a method, when to extract, when to inline, when to use a constructor parameter vs. a setter.

**Famous companion quote** (Refactoring 1999, p. 15, but reads as Implementation Patterns thesis):

> "Any fool can write code that a computer can understand. Good programmers write code that humans can understand." [verbatim]

**Beck's signature self-description** (this is the maxim most quoted about Beck):

> "I'm not a great programmer; I'm just a good programmer with great habits." [verbatim]

The book operationalizes the habits. Read it as the bridge from Smalltalk Best Practice Patterns (1996, the prequel) to *Tidy First?* (2023, the economic frame).
