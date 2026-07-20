# Michael Feathers — Diagnostic Lookup (anti-pattern catalog)

Letter prefix:
- **LC-** Legacy-code situational anti-patterns
- **SEAM-** Seam-finding anti-patterns
- **CHAR-** Characterization-test anti-patterns
- **CAT-** Dependency-breaking-catalog selection anti-patterns

Diagnose ONE primary anti-pattern per turn. Cross-reference Principles.md / QuoteBank.md for the canonical source.

---

## LC — Legacy-code situational anti-patterns

### LC-1 The Edit-and-Pray Reflex
The user is about to change a method in a class with no tests, planning to "just be careful" and rely on manual click-through afterward. **Tell:** the change request comes paired with phrases like "I'll be careful," "I'll review the diff thoroughly," "the QA team will catch it."
**Diagnosis:** Edit-and-Pray. Careful is not the same as **safe**. The reframe is Cover-and-Modify: install a safety net first, then change.
**Move:** Identify ONE seam near the change point. Install it (Sprout Method or Wrap Method are the safest catalog entries). Write a characterization test against the seam. *Then* make the change.

### LC-2 Spec-Style Tests on Untested Code
The user is "adding tests" to legacy code and writing them against what the code *should* do per the spec or the ticket. **Tell:** new tests are failing on first run — but the user thinks the *code* is wrong, not the tests.
**Diagnosis:** Tests don't characterize current behavior. If production depends on the existing behavior (likely), a passing fix breaks downstream silently.
**Move:** Rewrite the tests as **characterization tests** — pin what the code *currently does* (Cluster 6 quotes). Tag any divergence from the spec as a separate, deliberate change with its own future test.

### LC-3 Refactor First, Test Later
The user is refactoring a tangled class to "make it testable" and *then* will write tests. **Tell:** the diff is large, no tests exist yet, the user is several commits deep without a single test passing.
**Diagnosis:** Violates the Legacy Code Change Algorithm step ordering (break dependencies → write tests → THEN refactor). Without tests, the refactor is itself unsafe.
**Move:** Stop. Pick the *minimally invasive* dependency-breaking technique from the catalog (Sprout / Wrap / Extract Interface) — the ones safe enough to do without tests. Get one characterization test green. Then refactor under that net.

### LC-4 Blame-the-Past Framing
The user opens with *"the previous developers were sloppy / lazy / didn't understand"* and is morally outraged about the code state. **Tell:** the conversation is about people, not code.
**Diagnosis:** Counter-productive. The code we have is the code we have. Moralism doesn't make the change safer.
**Move:** Reframe technically: the code lacks tests. Tests are a technical condition, addressable by the catalog. The previous authors did the best they could with what they had; the question is what to do *now*.

---

## SEAM — Seam-finding anti-patterns

### SEAM-1 Wrong Seam Type
The user picks a Link Seam (build-system swap) when an Object Seam (subclass override at the call site) would do. **Tell:** the proposed change involves modifying the build/Makefile/classpath when the call site itself is overridable.
**Diagnosis:** Link Seams have enabling points **outside the code**. They're appropriate when you can't change source (vendored library, fixed binary). When you can change source and the call dispatches polymorphically, an Object Seam is closer to the change point and easier to install.
**Move:** Walk the seam-type decision: can I modify the source? Is the call dispatched through a subclassable type? If yes-yes → Object Seam (Subclass and Override Method, Extract Interface). Reserve Link Seam for genuine third-party / build-time-only constraints.

### SEAM-2 Missing Enabling Point
The user has identified a "seam" but cannot say where the decision to swap behavior is made. **Tell:** the seam description names a class but not a specific decision site.
**Diagnosis:** *"Every seam has an enabling point, a place where you can make the decision to use one behavior or another."* — WELC Ch.4, p. 32 [verbatim]. A seam without an enabling point is not yet a seam.
**Move:** Trace the construction or dispatch path. Find the place where the production code *commits* to the production behavior (a `new` call, a configuration line, a singleton lookup). That's the enabling point. If there isn't one, install one — that *is* the dependency-breaking work.

### SEAM-3 Too Many Seams
The user has identified five seams to install before making the actual change. **Tell:** dependency-breaking diff is sprawling; the actual feature change hasn't started.
**Diagnosis:** Over-investment in scaffolding. Feathers's catalog is meant to be **minimally invasive** — just enough seam to get the change point under test, not to clean up the whole class.
**Move:** Identify the *one* change point. Identify the *one* seam closest to it. Defer the others. *"First pin what is, then decide what should be"* — and "what should be" is a separate task, not part of this change.

### SEAM-4 Sensing-vs-Separation Conflation
The user is breaking a dependency but can't articulate whether the goal is to **observe an effect** (sensing) or to **make construction possible** (separation). **Tell:** the proposed seam is more invasive than needed for the actual problem.
**Diagnosis:** The same techniques (Extract Interface, Subclass and Override) serve both, but the *minimal* form depends on which problem you have. Conflating them produces over-engineered seams.
**Move:** Ask explicitly: "Can I get this class into a test harness?" If no → Separation; pick the smallest separation technique. If yes but I can't see the effect → Sensing; add a sensing variable. The minimum change is different in each case.

---

## CHAR — Characterization-test anti-patterns

### CHAR-1 Asserting What It Should Do
The user writes a test asserting `result == 8` because the spec says 8 — but the code returns 7. **Tell:** the test fails immediately; the user is about to "fix" the code.
**Diagnosis:** *Not a characterization test.* A characterization test pins what the code **currently does**. If production callers depend on `7`, fixing it to `8` may break them.
**Move:** Change the assertion to `result == 7`. Make the test green. **Now** decide separately: do we need to change the behavior to 8? If yes, write a NEW failing test for the new behavior, deliberate the change, ship it as a separate commit with the characterization test as the safety net.

### CHAR-2 Skipping the Failing Step
The user writes the assertion correctly the first time and the test passes immediately. **Tell:** the user reports "the test passed on first run."
**Diagnosis:** The Characterization Test Algorithm requires a deliberately-wrong assertion FIRST so the runner *prints the actual value*. If the test passed first time, the user *guessed* the actual behavior — but they didn't *verify* it. The assertion may be coincidentally right, or the test may not actually exercise the path.
**Move:** Rewrite the assertion as something obviously wrong (a sentinel like `-99999`). Run. Capture what the runner prints. Use *that* value as the assertion. Run again. Now the test pins what the code actually does.

### CHAR-3 No Effect Sketch Before Pinning
The user is writing characterization tests for a method but hasn't traced what the method *affects* — return value, fields, observable side effects, downstream callers. **Tell:** tests pin the return value but the method also mutates a field that other code reads.
**Diagnosis:** Without an effect sketch, the characterization is partial. The change you make later may break the un-pinned effect.
**Move:** Pause. Draw the effect sketch (informally — pencil, scrap paper). Identify every observable effect: returns, mutations, called collaborators, thrown exceptions. Pin each one with a separate characterization assertion. *Then* make the change.

### CHAR-4 Pinning Too Much
The user writes 50 characterization tests for a class with 30 methods because "we should have full coverage." **Tell:** the dependency-breaking work is sprawling, the actual change is one method.
**Diagnosis:** Characterization is a budget, not an aspiration. *"You don't get to test everything. You scope to the change point and its effects."* — WELC Ch.6 / 23 [paraphrase].
**Move:** Identify the change point. Use the effect sketch to bound *what could break*. Pin only those surfaces. The rest of the class stays in the dark — and that's fine for now.

---

## CAT — Dependency-breaking-catalog selection anti-patterns

### CAT-1 Heavy Technique When a Light One Suffices
The user is reaching for Extract Interface (multi-step refactor across multiple files) when a Sprout Method (write new behavior in a new method, leave the old class alone) would solve the change. **Tell:** the proposed diff modifies 5+ files for a 1-class change.
**Diagnosis:** Sprout Method is the safest entry in the catalog because it leaves the host class **untouched**. Use it when the change can be formulated as new code; reach for heavier techniques only when behavior must be modified inside the existing class.
**Move:** Walk the catalog from light to heavy: Sprout Method → Sprout Class → Wrap Method → Wrap Class → Subclass and Override → Extract Interface → … . Pick the lightest technique that solves *this* change.

### CAT-2 Catalog Confusion with Fowler's Refactoring
The user invokes "Extract Method" or "Extract Class" from Fowler's *Refactoring* on untested code. **Tell:** the user is mid-refactor citing Fowler chapter numbers; no tests exist.
**Diagnosis:** Fowler's catalog assumes you can already test. Feathers's catalog is for code you *can't yet* test. The names overlap (both have an "Extract Interface") but the safety stories are different.
**Move:** Route Fowler-catalog questions to the **Fowler** sibling skill *after* the code is under test. For *now*, pick the Feathers-catalog technique that gets ONE test green. Fowler's refactorings come later, under that test net.

### CAT-3 Pre-emptive Catalog Naming
The user picks "Extract Interface" before locating the change point. **Tell:** the conversation opens with "I want to apply Extract Interface to this class" rather than "I need to change method X and method X calls collaborator Y which I can't fake."
**Diagnosis:** Catalog techniques are answers to *specific* dependency-breaking questions. Picking the technique before the question produces over-engineered seams.
**Move:** Reset to the Legacy Code Change Algorithm: (1) identify change points, (2) find test points, (3) THEN break dependencies. The technique falls out of (3) once (1) and (2) are concrete.
