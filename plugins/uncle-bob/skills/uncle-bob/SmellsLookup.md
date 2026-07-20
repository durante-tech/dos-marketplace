# Smells Lookup — Clean Code Ch.17

**The Diagnose workflow emits findings keyed by these tags.** When a user reads `G14: Feature Envy`, they go to Clean Code Ch.17 and find the principle.

Numbering follows the 1st-edition Clean Code (2008). The 2nd edition (2024) reorders some entries; principles transfer 1:1.

---

## Comments — C1 to C5

| Tag | Smell | Diagnosis | Prescription |
|---|---|---|---|
| **C1** | Inappropriate Information | Change history, author tags belong in version control, not source | Delete; let `git blame` carry the load |
| **C2** | Obsolete Comment | Comment that has rotted away from the code it describes | Update or delete on sight |
| **C3** | Redundant Comment | Says exactly what the code already says | Delete; rename instead |
| **C4** | Poorly Written Comment | Rambling, obvious, or ungrammatical | Edit ruthlessly or delete |
| **C5** | Commented-Out Code | "An abomination. Don't worry — version control still remembers it." | `git rm`, no exceptions |

## Environment — E1 to E2

| Tag | Smell | Prescription |
|---|---|---|
| **E1** | Build Requires More Than One Step | One command (`bun run build`) |
| **E2** | Tests Require More Than One Step | One command (`bun test`) |

## Functions — F1 to F4

| Tag | Smell | Diagnosis | Prescription |
|---|---|---|---|
| **F1** | Too Many Arguments | "More than three is very questionable" | Parameter object; bind context as fields |
| **F2** | Output Arguments | "Counterintuitive — readers expect arguments to be inputs" | Return value or mutate `this` |
| **F3** | Flag Arguments | "Boolean arguments loudly declare that the function does more than one thing" | Split into two functions |
| **F4** | Dead Function | Never called | Delete |

## General — G1 to G36 (top-impact subset; full 36 in Clean Code Ch.17)

| Tag | Smell | Prescription |
|---|---|---|
| **G1** | Multiple Languages in One Source File | Minimize; isolate templates / SQL / regex |
| **G2** | Obvious Behavior Unimplemented | Implement the obvious; principle of least surprise |
| **G3** | Incorrect Behavior at the Boundaries | Test edges; off-by-ones live there |
| **G4** | Overridden Safeties | Don't disable warnings, tests, or checks "for now" |
| **G5** | Duplication | Extract method, polymorphism, Template Method |
| **G6** | Code at Wrong Level of Abstraction | Stepdown rule — one level per function |
| **G7** | Base Classes Depending on Their Derivatives | Inversion of dependency |
| **G8** | Too Much Information | Hide internals; small public surface |
| **G9** | Dead Code | Delete; version control remembers |
| **G10** | Vertical Separation | Variables and helpers near their use |
| **G11** | Inconsistency | Same idea = same shape across the codebase |
| **G12** | Clutter | Delete unused things; declutter ruthlessly |
| **G13** | Artificial Coupling | Don't force unrelated things to share state |
| **G14** | Feature Envy | Move method to the class whose data it envies |
| **G15** | Selector Arguments | Replace boolean with two methods |
| **G16** | Obscured Intent | Be obvious; don't be clever |
| **G17** | Misplaced Responsibility | Move code to where the reader would expect it |
| **G18** | Inappropriate Static | Make it instance unless it provably belongs to the type |
| **G19** | Use Explanatory Variables | Extract intermediate names |
| **G20** | Function Names Should Say What They Do | If you need a comment, rename |
| **G21** | Understand the Algorithm | Read it; don't pattern-match it |
| **G22** | Make Logical Dependencies Physical | Don't assume; assert |
| **G23** | Prefer Polymorphism to If/Else or Switch/Case | Replace conditional with polymorphism (BUT see SteelMan §performance) |
| **G24** | Follow Standard Conventions | Don't be a snowflake |
| **G25** | Replace Magic Numbers with Named Constants | `const MAX_RETRIES = 3` |
| **G26** | Be Precise | "Approximately" is a smell |
| **G27** | Structure Over Convention | Enforce design via structure (interfaces, types) |
| **G28** | Encapsulate Conditionals | Extract a named boolean function |
| **G29** | Avoid Negative Conditionals | `if (isReady)` not `if (!isNotReady)` |
| **G30** | Functions Should Do One Thing | The function rule, again |
| **G31** | Hidden Temporal Couplings | Force the caller to express the order via signature |
| **G32** | Don't Be Arbitrary | Default to convention; deviate only with reason |
| **G33** | Encapsulate Boundary Conditions | Extract `wasOverflow = nextLevel + 1` |
| **G34** | Functions Should Descend Only One Level of Abstraction | Stepdown rule |
| **G35** | Keep Configurable Data at High Levels | Don't hardcode in deep helpers |
| **G36** | Avoid Transitive Navigation | Law of Demeter — `a.b.c.d` is a smell |

## Java — J1 to J3

| Tag | Smell | Prescription |
|---|---|---|
| **J1** | Avoid Long Import Lists by Using Wildcards | (Modern IDE-managed; less relevant) |
| **J2** | Don't Inherit Constants | Use a static import or a constant class |
| **J3** | Constants vs Enums | Prefer enums for related constants |

## Names — N1 to N7

| Tag | Smell | Prescription |
|---|---|---|
| **N1** | Choose Descriptive Names | If a name needs a comment, rename |
| **N2** | Names at Appropriate Abstraction Level | No `getNumberOfBytesAfterHeader()` in a top-level domain class |
| **N3** | Use Standard Nomenclature | `toString()`, not `convertToString()` |
| **N4** | Unambiguous Names | `add()` vs `append()` — pick the right verb |
| **N5** | Long Scope = Long Name | `i` is fine for a 3-line loop; not for a 300-line method |
| **N6** | Avoid Encodings (Hungarian, prefixes) | `m_` and `IShape` are obsolete |
| **N7** | Names Should Describe Side Effects | `getOrCreateUser()` if it might create |

## Tests — T1 to T9

| Tag | Smell | Prescription |
|---|---|---|
| **T1** | Insufficient Tests | "If you can think of one more case, write it" |
| **T2** | Use a Coverage Tool | Drive coverage up, but coverage isn't the goal |
| **T3** | Don't Skip Trivial Tests | "Easy to write, valuable to read" |
| **T4** | An Ignored Test Is a Question About Ambiguity | Resolve, don't ignore |
| **T5** | Test Boundary Conditions | Edges break first |
| **T6** | Exhaustively Test Near Bugs | Where one bug lives, others hide |
| **T7** | Patterns of Failure Are Revealing | Look for shape, not just instances |
| **T8** | Test Coverage Patterns Are Revealing | What's untested is what's broken |
| **T9** | Tests Should Be Fast | "Slow tests don't get run" |

---

## Diagnostic Priority Order

When code has multiple smells, diagnose in this order (worst-first):

1. **C5** — Commented-out code (delete, no exceptions)
2. **F3** — Flag arguments (split the function)
3. **G23** — Polymorphism over switch (BUT see SteelMan §performance exception)
4. **G36** — Demeter violation (`a.b.c.d`)
5. **G14** — Feature Envy
6. **F1** — Too many arguments (>3 = parameter object)
7. **G5** — Duplication
8. **G6** — Wrong level of abstraction
9. **N-class** — naming smells (rename instead of comment)
10. **C-class** — comment smells (delete or rewrite the code)

**One smell, one refactor, one quote, one moral. Save the rest for follow-up turns.**
