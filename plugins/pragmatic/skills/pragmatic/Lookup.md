# Lookup — Pragmatic-Tagged Anti-Patterns

**The TipLookup / PragmaticDiagnose / KnowledgePortfolio workflows emit findings keyed by these tags.** When a user reads `PBC-1: It Works, Don't Touch It`, they look up the pattern here and find the diagnosis + the named Tip that addresses it.

Tag namespaces:
- **PRAG-N** — Pragmatic Philosophy violations (Ch. 1)
- **DRY-N** — Knowledge duplication
- **ORT-N** — Orthogonality violations
- **TRACER-N** — Tracer/prototype confusion
- **PBC-N** — Programming-by-Coincidence smells
- **PARA-N** — Pragmatic Paranoia (contracts, assertions, crash-early)
- **TEST-N** — Pragmatic testing anti-patterns
- **CAT-N** — The Cat Ate My Source Code (excuse-making)
- **WIZ-N** — Wizard Code You Don't Understand
- **MAN-N** — Manual Procedures
- **EST-N** — Estimating Without Iterating
- **REQ-N** — Gathered (not dug-for) Requirements

Total: **22 anti-patterns**.

---

## PRAG — Pragmatic Philosophy

| Tag | Smell | Diagnosis | Prescription | Closing Tip |
|---|---|---|---|---|
| **PRAG-1** | Broken Window Tolerance | Bad code, dead TODOs, known-wrong configs left in trunk after discovery; the team's "normal" has drifted to include the rot. | Fix it now, or board it up with a visible placeholder + Jira link. The second broken window is psychologically free; the first one is the whole battle. | Tip 5 (PP2) / Tip 4 (PP1) — *"Don't Live with Broken Windows."* |
| **PRAG-2** | Boiled Frog | A small daily degradation (build time, test flakes, on-call pages, dependency drift) that nobody flags because each day's delta is invisible. | Surface the gradient. Track the metric over weeks, not days. Step out of the pot to look at the water. | Tip 7 (PP2) / Tip 6 (PP1) — *"Remember the Big Picture."* |
| **PRAG-3** | Stone-Soup Stall | Team waits for a top-down mandate to start a needed change. | Be the soldier with the pot. Bring the stones; the villagers bring the carrots. | Tip 6 (PP2) / Tip 5 (PP1) — *"Be a Catalyst for Change."* |
| **PRAG-4** | Cat-Ate-My-Source-Code | Lame excuses substituted for options. Blame surfaces; recovery paths don't. | Provide options, not excuses. Before telling anyone bad news, talk to your rubber duck — if the excuse sounds lame to a duck, it'll sound lame to your boss. | Tip 4 (PP2) / Tip 3 (PP1) — *"Provide Options, Don't Make Lame Excuses."* |

---

## DRY — Knowledge Duplication

| Tag | Smell | Diagnosis | Prescription | Closing Tip |
|---|---|---|---|---|
| **DRY-1** | Knowledge Duplication | Same business rule, schema constraint, or constant expressed in two or more representations that must change together. | Promote one representation as authoritative; derive the others (codegen, single source schema, generated docs). | Tip 15 (PP2) / Tip 11 (PP1) — *"DRY—Don't Repeat Yourself."* |
| **DRY-2** | Imposed Duplication | DRY violations forced by tooling (header+body, manual schema-to-DTO copies, OpenAPI spec + handler signatures kept in sync by hand). | Generate, don't copy. Use tools that read the canonical representation. *"Don't use code generators because you fancy doing it. Use them because there's a business benefit."* | DRY chapter, "imposed duplication" subsection. |

---

## ORT — Orthogonality Violations

| Tag | Smell | Diagnosis | Prescription | Closing Tip |
|---|---|---|---|---|
| **ORT-1** | Cross-Cutting Coupling | Changing X requires touching Y/Z because their internal representations leaked into each other. | Eliminate effects between unrelated things. Hide implementation behind narrow interfaces. | Tip 17 (PP2) / Tip 13 (PP1) — *"Eliminate Effects Between Unrelated Things."* |
| **ORT-2** | Framework-Bound Domain | Business logic married to a framework's lifecycle so the domain can't be tested without it. (Echoes Cockburn's HEX-5; Andy & Dave got there first via orthogonality.) | Push framework concerns to the edge. Test domain logic without the container. | *PP2* Topic 10. |

---

## TRACER — Tracer / Prototype Confusion

| Tag | Smell | Diagnosis | Prescription | Closing Tip |
|---|---|---|---|---|
| **TRACER-1** | Prototype-as-Production | Throwaway code shipped because "it works." Missing error handling, tests, docs. | A prototype is for learning. If you keep it, it's no longer a prototype — rewrite as tracer code with full production discipline. | Tip 21 (PP2) / Tip 16 (PP1) — *"Prototype to Learn."* |
| **TRACER-2** | No End-to-End Path | Months of layered work before any request reaches production. Integration deferred. (Pairs with Cockburn's WS-2.) | Fire a tracer first: thinnest possible end-to-end slice through every architectural layer. | Tip 20 (PP2) / Tip 15 (PP1) — *"Use Tracer Bullets to Find the Target."* |

---

## PBC — Programming by Coincidence

The foundational anti-pattern. Most other tags nest inside PBC-1.

| Tag | Smell | Diagnosis | Prescription | Closing Tip |
|---|---|---|---|---|
| **PBC-1** | It Works, Don't Touch It | Code that works for unknown reasons. Team afraid to refactor because failure modes are unmodeled. Edits-until-tests-pass instead of programming deliberately. | Replace luck with the 7 habits (always be aware, don't code blindfolded, proceed from a plan, rely only on reliable things, document assumptions, test assumptions, prioritize effort). | Tip 62 (PP2) / Tip 44 (PP1) — *"Don't Program by Coincidence."* |
| **PBC-2** | Wizard-Code Worship | Generated/scaffolded code shipped without comprehension; behavior is whatever the wizard produced. | Don't use wizard code you don't understand. Read every line; own it or replace it. | Tip 50 (PP1) — *"Don't Use Wizard Code You Don't Understand."* |
| **PBC-3** | Implicit-Dependency Quicksand | Code relies on undocumented coincidences (call order, default ports, locale, ambient state). | Explicit contracts (assertions, types, tests-as-documentation). | *PP2* Topic 38. |

---

## PARA — Pragmatic Paranoia

| Tag | Smell | Diagnosis | Prescription | Closing Tip |
|---|---|---|---|---|
| **PARA-1** | Late Crash | Bad input drifts deep into the system before failing, corrupting state along the way. | Crash early — fail at the boundary. | Tip 38 (PP2) / Tip 32 (PP1) — *"Crash Early."* |
| **PARA-2** | Defensive Asserts Disabled in Prod | Assertions used as comments, then turned off in production. | Use assertions to prevent the impossible — and leave them on. | Tip 39 (PP2) / Tip 33 (PP1) — *"Use Assertions to Prevent the Impossible."* |

---

## TEST — Pragmatic Testing

| Tag | Smell | Diagnosis | Prescription | Closing Tip |
|---|---|---|---|---|
| **TEST-1** | Coverage Theater | Code coverage maximized; state coverage absent. Tests run all branches without checking their meaning. | Test state coverage, not code coverage. Focus tests on the cases that matter for behavior. | Tip 93 (PP2) / Tip 65 (PP1) — *"Test State Coverage, Not Code Coverage."* |
| **TEST-2** | Manual-Procedure Drift | Releases done by hand; "it worked when I did it on Tuesday." | Don't use manual procedures. Version-controlled scripts run by CI are the only durable build. | Tip 95 (PP2) / Tip 61 (PP1) — *"Don't Use Manual Procedures."* |
| **TEST-3** | Find-Bug-Twice | Same defect re-discovered after a partial fix. | Find bugs once. Add the regression test before the patch. | Tip 94 (PP2) / Tip 66 (PP1) — *"Find Bugs Once."* |

---

## CAT, SFM, PO, WIZ, MAN, EST, REQ — Single Anti-Patterns

| Tag | Smell | Diagnosis | Prescription | Closing Tip |
|---|---|---|---|---|
| **CAT-1** | Cat Ate My Source Code | Engineer offers explanations for failure that are not also options for recovery. | Provide options, not excuses. (See PRAG-4.) | Tip 4 (PP2) / Tip 3 (PP1). |
| **SFM-1** | Slave to Formal Methods | Methodology becomes the deliverable. Diagrams, ceremonies, sign-offs proliferate; working software recedes. | Treat formal methods as one tool among many. Use what helps; drop what doesn't. | Tip 58 (PP1) — *"Don't Be a Slave to Formal Methods."* (Spirit lives on in PP2 Tip 83 — *"Agile Is Not a Noun; Agile Is How You Do Things."*) |
| **PO-1** | Premature Optimization | Engineers optimize loops, swap data structures, hand-tune SQL — before measuring. | Estimate the order of your algorithms first; then measure; then optimize the hotspot the profiler points at. | Tip 63 (PP2) / Tip 45 (PP1) — *"Estimate the Order of Your Algorithms."* + Tip 64/46 — *"Test Your Estimates."* |
| **WIZ-1** | Wizard Code You Don't Understand | (See PBC-2.) Scaffolder drops 800 lines into your tree; you ship without reading. | If you accept what the wizard wrote, you own it. Read every line. If you can't explain it, don't ship it. | Tip 50 (PP1). |
| **MAN-1** | Manual Procedures | (See TEST-2.) Done by hand, by tribal knowledge. Each repetition is a fresh chance for human error. | If you've done it twice, script it. | Tip 95 (PP2) / Tip 61 (PP1). |
| **EST-1** | Estimating Without Iterating | Estimate given on day 1; never revisited; treated as commitment; team death-marches to hit it. | Treat estimates as living artifacts. Iterate the schedule with the code as you learn. | Tips 23/18 + 24/19. |
| **REQ-1** | Gathered (not dug-for) Requirements | Team transcribes user wishes verbatim into a doc, builds to spec, ships, users say "that's not what I wanted". | Dig. Work alongside users. Ask "why" three times. Build a glossary so you mean the same thing by the same word. | Tip 51 (PP1) — *"Don't Gather Requirements—Dig for Them."* + Tip 52 — *"Work with a User to Think Like a User."* + Tip 54 — *"Use a Project Glossary."* |

---

## Diagnostic Priority Order (PragmaticDiagnose workflow)

When code/team has multiple smells, diagnose in this order (worst-first):

1. **PBC-1** — It Works, Don't Touch It (foundational; nests inside almost every other tag)
2. **PRAG-1** — Broken Window Tolerance (signal cascade; team-level entropy)
3. **PRAG-2** — Boiled Frog (slow degradation invisible at day-grain)
4. **DRY-1** — Knowledge Duplication
5. **ORT-1** — Cross-Cutting Coupling
6. **TRACER-2** — No End-to-End Path (project-level integration risk)
7. **PARA-1** — Late Crash
8. **TEST-2** — Manual-Procedure Drift
9. **EST-1** — Estimating Without Iterating
10. **REQ-1** — Gathered (not dug-for) Requirements
11. (remaining tags as situational)

**One Tip, one story, one habit. Save the rest for follow-up turns.**

---

## Quote-Pairing Index (which `QuoteBank.md` quote closes each tag)

| Tag | Closing quote ID(s) |
|---|---|
| PRAG-1 | 5, 11 (Broken Windows + Bronx framing) |
| PRAG-2 | 7 (Remember the Big Picture) |
| PRAG-3 | 6 (Be a Catalyst for Change) |
| PRAG-4 / CAT-1 | 4 (Provide Options) |
| DRY-1 / DRY-2 | 13, 14 (DRY tip + verbatim definition) |
| ORT-1 / ORT-2 | 15, 16 (Eliminate Effects + Orthogonality definition) |
| TRACER-1 / TRACER-2 | 18, 19, 20 (Tracer Bullets + Prototype to Learn + disposable) |
| PBC-1 | 46, 75 (Don't Program by Coincidence + DRY interview restatement) |
| PBC-2 / WIZ-1 | 45 (Don't Use Wizard Code) |
| PARA-1 | 38 (Crash Early) |
| PARA-2 | 39 (Use Assertions) |
| TEST-1 | 53 (Test Your Software) |
| TEST-2 / MAN-1 | 60 (Don't Use Manual Procedures) |
| TEST-3 | 53 (Test Your Software) |
| SFM-1 | 57 (Agile Is Not a Noun) |
| PO-1 | 47, 48 (Order of Algorithms + Test Estimates) |
| EST-1 | 22, 23 (Estimate to Avoid Surprises + Iterate the Schedule) |
| REQ-1 | (See Principles.md §Requirements — Tip 51 verbatim with chapter sentence) |
