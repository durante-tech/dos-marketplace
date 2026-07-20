# Principles — SOLID + Components + Three Laws + Programmer's Oath

**All verbatim. Source-tagged. The full canonical reference.**

---

## The Three Laws of TDD

**Canonical (butunclebob.com / Clean Coders Episode 6 / Clean Code book):**

1. You are not allowed to write any production code unless it is to make a failing unit test pass.
2. You are not allowed to write any more of a unit test than is sufficient to fail; and compilation failures are failures.
3. You are not allowed to write any more production code than is sufficient to pass the one failing unit test.

**Alternate (The Cycles of TDD, blog 2014-12-17):**

1. You must write a failing test before you write any production code.
2. You must not write more of a test than is sufficient to fail, or fail to compile.
3. You must not write more production code than is sufficient to make the currently failing test pass.

### Cycle Lengths (from The Cycles of TDD)

| Cycle | Period | Governs | Purpose |
|---|---|---|---|
| Nano-cycle | Seconds | The Three Laws | Line-by-line discipline. ~12 iterations per unit test. |
| Micro-cycle | ~1 minute | Red-Green-Refactor | Separate "make it work" from "make it right". |
| Milli-cycle | ~10 minutes | Specific/Generic | "As the tests get more specific, the code gets more generic." |
| Primary cycle | ~1 hour | Boundaries | Architectural / Clean Architecture boundaries audit. |

**Coaching trigger:** if a user iterates fewer than ~12× per unit test, they are violating Law 2 or Law 3.

---

## The Programmer's Oath (verbatim, 9 promises)

Source: `blog.cleancoder.com/uncle-bob/2015/11/18/TheProgrammersOath.html`

In order to defend and preserve the honor of the profession of computer programmers,

1. **I will not produce harmful code.**
2. The code that I produce will always be my best work. I will not knowingly allow code that is defective either in behavior or structure to accumulate.
3. I will produce, with each release, a quick, sure, and repeatable proof that every element of the code works as it should.
4. I will make frequent, small, releases so that I do not impede the progress of others.
5. I will fearlessly and relentlessly improve my creations at every opportunity. I will never degrade them.
6. I will do all that I can to keep the productivity of myself, and others, as high as possible. I will do nothing that decreases that productivity.
7. I will continuously ensure that others can cover for me, and that I can cover for them.
8. I will produce estimates that are honest both in magnitude and precision. I will not make promises without certainty.
9. I will never stop learning and improving my craft.

---

## SOLID — Verbatim

The SOLID acronym was arranged by Michael Feathers in the early 2000s from the five principles I published in *C++ Report* between 1995 and 1996.

### S — Single Responsibility Principle (SRP)

**Original (1996 / PPP 2002):** *"A class should have one, and only one, reason to change."*

**2014 reframing:** *"Gather together the things that change for the same reasons. Separate things that change for different reasons."*

**Clean Architecture 2017:** *"A module should be responsible to one, and only one, actor."*

**Smell:** Divergent Change. **Fix:** Extract responsibility per actor; compose via Facade.

### O — Open–Closed Principle (OCP)

**Verbatim:** *"Software entities (classes, modules, functions, etc.) should be open for extension, but closed for modification."*

**Origin:** Bertrand Meyer 1988; reformulated by me in *C++ Report* 1996, shifting from inheritance to polymorphism / abstract-interface.

**Smell:** Shotgun Surgery — every new requirement triggers a switch on type tag.
**Fix:** Plugin via abstract interface; Strategy / Template Method / Visitor.

### L — Liskov Substitution Principle (LSP)

**My reformulation:** *"Subtypes must be substitutable for their base types."*

**Liskov's original 1994:** "If for each object o₁ of type S there is an object o₂ of type T such that for all programs P defined in terms of T, the behavior of P is unchanged when o₁ is substituted for o₂, then S is a subtype of T."

**Smell:** Refused Bequest — subclass throws `UnsupportedOperationException`.
**Fix:** Design by Contract — preconditions weaken in subtypes; postconditions strengthen; invariants preserve. Composition over inheritance when you can't.

### I — Interface Segregation Principle (ISP)

**Verbatim:** *"Clients should not be forced to depend on methods they do not use."*

Equivalently: *"Make fine-grained interfaces that are client specific."*

**Origin:** Xerox printer-driver `Job` class with dozens of methods used by disjoint client groups.

**Smell:** Fat interfaces; clients recompile when others' methods change.
**Fix:** Split into role interfaces.

### D — Dependency Inversion Principle (DIP)

**Verbatim (two-part):**
1. *"High-level modules should not depend on low-level modules. Both should depend on abstractions."*
2. *"Abstractions should not depend on details. Details should depend on abstractions."*

**Smell:** High-level policy directly imports concrete `KeyboardReader`, `PrinterWriter`.
**Fix:** Define abstract interface owned by high-level module; inject concrete at composition time.

DIP is the engine of Clean Architecture. The inward-pointing arrow of the Dependency Rule is DIP applied at the component layer.

---

## Component Cohesion (REP / CCP / CRP)

From *C++ Report* 1996 → PPP 2002 Chapters 28–29 → Clean Architecture 2017 Chapters 13–14.

### REP — Reuse / Release Equivalence Principle
*"The granule of reuse is the granule of release."*

A component cannot be reused unless it is also released, with a version number.

### CCP — Common Closure Principle
*"The classes in a component should be closed together against the same kinds of changes. A change that affects a component affects all the classes in that component and no other components."*

SRP for components.

### CRP — Common Reuse Principle
*"The classes in a component are reused together. If you reuse one of the classes in a component, you reuse them all."*

Counter-positive form: *"Don't force users of a component to depend on things they don't need."* — ISP for components.

### Tradeoff Triangle
REP and CCP are **inclusive** (push components larger). CRP is **exclusive** (push components smaller). New projects live near CCP–REP edge; mature projects migrate toward CRP.

---

## Component Coupling (ADP / SDP / SAP)

### ADP — Acyclic Dependencies Principle
*"Allow no cycles in the component dependency graph."*

**Smell:** "The morning-after syndrome" — yesterday everything worked, today nothing builds.
**Fix:** Apply DIP to invert one of the arrows in the cycle, or extract the shared interface to a new component both depend on.

### SDP — Stable Dependencies Principle
*"Depend in the direction of stability."*

Volatile components depend on stable ones, never the reverse.

### SAP — Stable Abstractions Principle
*"A component should be as abstract as it is stable."*

Stable components must be abstract; concrete components must be unstable.

**Metric:**
- I (instability) = Ce / (Ca + Ce), where Ca = afferent couplings (incoming), Ce = efferent couplings (outgoing)
- A (abstractness) = Na / Nc, where Na = abstract classes, Nc = total classes
- D (distance from main sequence) = | A + I − 1 |

Components on the Main Sequence (D ≈ 0) are well-balanced. Components in the Zone of Pain (A=0, I=0 — concrete and stable) are inflexible and rigid. Components in the Zone of Uselessness (A=1, I=1 — abstract and unstable) are pure abstraction nobody depends on.

---

## The Dependency Rule (Clean Architecture)

> *"Source code dependencies must point only inward, toward higher-level policies."*

The four concentric circles, outer to inner:
1. **Frameworks & Drivers** — Web, DB, UI, devices
2. **Interface Adapters** — Controllers, Presenters, Gateways
3. **Use Cases** — Application-specific business rules
4. **Entities** — Enterprise-wide business rules

Crossing boundaries inward: direct call. Crossing boundaries outward: DIP — the inner layer defines an abstract interface, the outer layer implements it.

> *"All architectures are plugin architectures."* — Clean Architecture

---

## The Software Craftsmanship Manifesto (2008)

I co-authored and signed this at the Libertyville meeting, December 2008.

> As aspiring Software Craftsmen we are raising the bar of professional software development by practicing it and helping others learn the craft. Through this work we have come to value:
>
> Not only **working software**, but also **well-crafted software**
> Not only **responding to change**, but also **steadily adding value**
> Not only **individuals and interactions**, but also **a community of professionals**
> Not only **customer collaboration**, but also **productive partnerships**
>
> That is, in pursuit of the items on the left we have found the items on the right to be indispensable.

Source: `manifesto.softwarecraftsmanship.org`

---

## FIRST — Properties of Good Unit Tests

From Clean Code Ch.9.

- **F**ast — tests must run in seconds; slow tests don't get run.
- **I**ndependent — tests must not depend on each other; any order, any subset.
- **R**epeatable — same result in any environment; no flaky time/network/state.
- **S**elf-validating — boolean output (pass/fail); no manual interpretation.
- **T**imely — written **just before** the production code that makes them pass.

---

## The Doubles Taxonomy (The Little Mocker, 2014-05-14)

In order:
1. **Dummy** — passed but never used.
2. **Stub** — returns canned data.
3. **Spy** — Stub + records calls.
4. **Mock** — Spy + has expectations (verifies behavior).
5. **Fake** — has working implementation but unsuitable for production (in-memory DB).

Fakes are *outside* the chain — they're a different category. Mocks/stubs/spies are the formal lineage.

---

## Transformation Priority Premise (TPP)

A lesser-known TDD principle. As tests get more specific, code transformations should follow this priority order (high to low):

1. `({}) → (constant)`
2. `(constant) → (constant+)`
3. `(constant) → (scalar)` — variable
4. `(statement) → (statements)` — composition
5. `(unconditional) → (if)` — selection
6. `(scalar) → (array)`
7. `(array) → (container)`
8. `(statement) → (recursion)`
9. `(if) → (while)` — iteration
10. `(expression) → (function)` — extraction
11. `(variable) → (assignment)` — replacement
12. `(case) → (case+)`

When stuck in TDD, the next refactor should be the **highest-priority transformation that makes the test pass**. Skipping levels causes the "TDD getting stuck" anti-pattern.

Source: `blog.cleancoder.com/uncle-bob/2013/05/27/TheTransformationPriorityPremise.html`
