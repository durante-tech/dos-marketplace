# Kent Beck — Letter-Prefix-Tagged Anti-Pattern Lookup

When the user describes a situation, match it to the closest anti-pattern below. Each pattern names the diagnosis in Beck's terms and the smallest experiment to run.

---

## TDD-1..6 — TDD anti-patterns

### TDD-1. Wearing Two Hats (mixing refactoring into making the test pass)
**Diagnosis (Beck, *Canon TDD* 2023):** "Mistake: mixing refactoring into making the test pass. Again with the 'wearing two hats' problem." [verbatim]
**Smallest experiment:** finish green first; only then refactor as a separate, optional step. If you find yourself reaching for a refactoring while the bar is red, stop, comment out the refactor, get to green, then come back.

### TDD-2. Premature Test List Concretization
**Diagnosis (Beck, *Canon TDD* 2023):** "Mistake: convert all the items on the Test List into concrete tests, then make them pass one at a time." [verbatim]
**Smallest experiment:** turn exactly *one* list item into a runnable test. Add new items as you discover them. Cross items off only when green.

### TDD-3. Mixing Implementation Design into the Test List
**Diagnosis (Beck, *Canon TDD* 2023):** "Mistake: mixing in implementation design decisions. Chill. There will be plenty of time to decide how the internals will look later." [verbatim]
**Smallest experiment:** the list is *behavioral variants only*. If "use a hash map" is on the list, delete it. The hash map is an internal — it shows up during green/refactor.

### TDD-4. Steps Too Large
**Diagnosis (Beck, *TDD By Example* 2002, p. 155):** "Be prepared to downshift if your brain starts writing checks your fingers can't cash." [verbatim]
**Smallest experiment:** when uncertain, shrink the step — trade Obvious Implementation for Fake It; trade triangulation for a smaller assertion. Smaller steps until the bar goes red-then-green confidently.

### TDD-5. Skipped Red (the test passed without ever failing)
**Diagnosis:** if a test passes immediately on first run, you didn't have a test — you had a tautology. Implicit in *TDD By Example* Preface rule "Write new code only if an automated test has failed." [verbatim]
**Smallest experiment:** make it fail first. Comment out the production code or invert the assertion temporarily to confirm the test bites. *Then* restore and watch it go green.

### TDD-6. Tests-as-Documentation Without Green Discipline
**Diagnosis:** the tests are present but the bar is rarely all-green; the suite is prose, not pressure. The ratchet has no teeth.
**Smallest experiment:** all-green at every commit for one week. If a test breaks, fix it or delete it within the same commit. If you can't, the test was lying about its scope.

---

## TIDY-1..4 — Tidy First / structural anti-patterns

### TIDY-1. Code Hard to Change Because the Structure Is Wrong
**Diagnosis (Beck, *Tidy First?* 2023):** every behavior change is preceded by a structural change you didn't make; the friction is a signal, not a fact of life.
**Smallest experiment:** make the change easy *first* (one tidying, same session — guard inversion, helper extraction, dead-code deletion). Measure whether the behavior change got easier. Decide whether to keep tidying based on that evidence.

### TIDY-2. Deferred Tidying That Compounds
**Diagnosis (Beck, Substack, "Coupling and Cohesion"):** "Coupling between elements is a conductor of change." [verbatim] Uncorrected coupling raises the marginal cost of every future feature, not just the next one — the discount rate flips negative as the codebase ages.
**Smallest experiment:** one tidying per behavior change, no exceptions, for one week. Track velocity (PR cycle time, time-to-green) before and after. If velocity changes, that's your evidence.

### TIDY-3. Refactoring Treated as Cleanup Duty / Moral Hygiene
**Diagnosis:** the refactor is being justified by virtue ("the code should be clean") rather than by the next feature ("this refactor will pay for the change I'm about to make"). Beck's framing throughout *Tidy First?* is economic, not moral — see Cluster 6 in `QuoteBank.md`.
**Smallest experiment:** name the next behavior change *before* you start the refactor. If you can't, defer. If you can, run the refactor and check whether the behavior change actually got cheaper.

### TIDY-4. Tidying When You Shouldn't (low discount rate, dead code, throwaway)
**Diagnosis (Beck, *Tidy First?* 2023, Pt. III "Theory"):** not every change is worth tidying first. If the code is dead, throwaway, or the next behavior change is unknown or unlikely, the optionality value is too low to justify the cost of tidying now.
**Smallest experiment:** ask the four levers — cost-now, cost-without-tidy, discount-rate, optionality. If three of four point at "don't tidy," don't tidy. Defer or delete.

---

## EXP-1..3 — Experiment-design anti-patterns

### EXP-1. Articulating the Tradeoff Instead of Running the Experiment
**Diagnosis:** Beck's signature distinction from Fowler. When the answer is "it depends," Beck would rather run the smallest possible experiment than catalog the dependency space. Endless tradeoff articulation is a delay, not a decision.
**Smallest experiment:** name the tiniest thing you could try in the next ten minutes that would tell you something true. Run it. Report what happened — including what surprised you.

### EXP-2. Universal Claim Without Local Evidence
**Diagnosis:** asserting "this always works" or "everyone should X" without testing it on *this* code, *this* team, *this* week. Beck's signature hedge is "I find that..." or "in my experience..." — calibrated, not universal.
**Smallest experiment:** apply the claim to one specific situation in your hands today. Predict the outcome before you start. Compare prediction to result. The gap between prediction and result is the evidence.

### EXP-3. Experiment Designed Around What You Want to Happen, Not What You'd Learn
**Diagnosis:** the experiment is a confirmation pageant, not a test. If every possible outcome confirms the hypothesis, you didn't design an experiment, you wrote a press release. Beck's empirical-design frame on Substack: "We decide, empirically, what the design should be to reduce the cost of the behavior change." [verbatim]
**Smallest experiment:** before you start, write the outcome that would make you abandon the hypothesis. If you can't write that outcome, your experiment can't disprove the hypothesis, so it can't *prove* it either.

---

## XP-1..3 — Process / team anti-patterns

### XP-1. Ignoring the Courage Value (Hiding Behind Process)
**Diagnosis:** teams without courage paper over fear with process — sign-offs, reviews, status meetings. None of it tests the code; all of it slows the feedback loop XP depends on.
**Smallest experiment:** shorten one feedback loop (test cycle, integration cycle, release cycle) by half this week. If quality drops, the process was load-bearing — keep it. If it holds, the process was theater — drop it.

### XP-2. Pair Programming as Surveillance Rather than Dialog
**Diagnosis (Beck, *XP Explained* 1st ed. Ch. 14):** "Pair programming is a dialog between two people..." [verbatim] If pairing feels like one person watching another type, the practice has been hollowed out — the dialog is the practice, the typing is incidental.
**Smallest experiment:** swap driver/navigator every 10 minutes for one session. If the conversation shifts from approval to exploration, the practice is alive. If it doesn't, change pair, change problem, or stop pairing.

### XP-3. Big Design Up Front (BDUF)
**Diagnosis:** design done before evidence is speculation; the cost of being wrong compounds. Beck's empirical-design Substack contrasts speculative design ("done so early it inflates the cost of mistakes") with reactive design ("done after the cost of coupling has already been paid"). Either failure mode is design done at the wrong time.
**Smallest experiment:** sketch the simplest design that could possibly work. Build a tracer through it (XP "Simple Design" + "Tracer Bullets" lineage — see `StepAsideTable.md` for Pragmatic on tracers). Let the next behavior change tell you what to redesign.
