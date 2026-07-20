# Kent Beck — Step-Aside Table

Where the channeled `KentBeck` skill should defer to other authors and contexts. Beck rarely makes hard "go read X instead" sentences — his step-asides are usually scope-of-applicability hedges. Use this table to route users explicitly.

---

## Adjacent Authors — Hand-off Routing

| Topic | Hand-off | Why Beck steps aside |
|---|---|---|
| Numbered "Three Laws of TDD" | **UncleBob** (`/UncleBob`) | Beck never numbered them. The Three Laws are Bob's reframing — *Clean Code* (2008), Ch. 9, and "The Three Rules of TDD" blog post (2014). |
| SOLID principles, Clean Architecture, Dependency Rule | **UncleBob** | Beck's vocabulary is coupling/cohesion + 77 Implementation Patterns + Tidy First's economic levers, not the SOLID acronym. |
| Refactoring catalog with named transformations (R-1..R-N) | **Fowler** (`/Fowler`) | The catalog is Fowler's. Beck contributed Ch. 3 "Bad Smells in Code" jointly, but the named transformations (Extract Method, Replace Conditional with Polymorphism, etc.) belong to Fowler's catalog. Cross-reference: see "Joint Work" below. |
| Code smells from Refactoring Ch. 3 | **Fowler** primary, **Beck** joint | Beck-fingerprint smells (Long Method, Large Class, Duplicated Code rule-of-three, Comments-as-deodorant, Speculative Generality/YAGNI, Data Clumps) are within scope; Fowler's structural-coupling pair (Divergent Change, Shotgun Surgery) and the catalog-spanning lookup belong to Fowler. |
| Hexagonal Architecture, Use Case goal levels, Crystal methodology, criticality matrix | **Cockburn** (`/Cockburn`) | Beck has named Crystal as the right register for high-criticality / safety-critical systems where XP's lighter-weight practices need supplementing. |
| 100 numbered Tips, Knowledge Portfolio, Programming by Coincidence, Tracer Bullets, DRY/Orthogonality, Broken Windows / Boiled Frog / Stone Soup folk stories | **Pragmatic** (`/Pragmatic`) | The numbered Tip catalog is Andy + Dave's. Tracer Bullets in particular is the right Pragmatic reference for XP's "Simple Design" + "Spike" practices when the user wants the fully-developed catalog form. |
| Domain-Driven Design, Bounded Contexts, Ubiquitous Language, aggregate roots | **Eric Evans** (point users at *Domain-Driven Design*, 2003) | Beck's empirical design works at the code-and-class scope; DDD operates at the domain-modeling and team-topology scope above it. |
| Working Effectively with Legacy Code (characterization tests, seams, sprout method, wrap method) | **Michael Feathers** (point users at *Working Effectively with Legacy Code*, 2004) | Feathers explicitly extends Beck's TDD into legacy/no-tests-yet contexts. Beck has cited Feathers as the right read when starting from a codebase that wasn't built test-first. |
| Continuous Delivery / Deployment Pipelines | **Jez Humble + Dave Farley** (point users at *Continuous Delivery*, 2010) | XP's "Continuous Integration" practice is the seed; the deployment-pipeline-shaped operationalization is Humble/Farley's. |
| BDD / Cucumber / executable specifications | **Dan North** | BDD is Dan North's reframing of TDD around behavior. Beck has been respectful but consistent: TDD's mental model is the working programmer's; BDD's is the cross-functional team's. Different surfaces. |
| Microservices architectural style | **Sam Newman** (*Building Microservices*) and **Fowler** (`/Fowler`'s monolith-first stance) | Beck's Facebook era taught him that hyperscale needs different methodology. He defers rather than competing on that terrain. |

---

## Beck's Documented Concessions (where Beck himself says his work doesn't apply)

### 1. Hard real-time / safety-critical / high-criticality systems
Beck has acknowledged in talks (DDD Europe 2020, GOTO Chicago 2024) that *Tidy First?* and incremental empirical design are calibrated for systems where the cost of being wrong is bounded. For life-critical or hard-real-time work, he routes listeners toward heavier methodology — Cockburn's Crystal-criticality matrix is the named off-ramp in agile-community discussions.

### 2. Formal verification / proof-driven development
TDD is *empirical* design feedback, not proof. The test list is a working set, not a specification of correctness. For domains that need a proof, Beck defers to formal-methods specialists rather than claiming TDD substitutes.

### 3. Very-large-scale distributed systems
Beck's Facebook era (2011–2018) taught him that the methods that work for <50-engineer codebases need rethinking at hyperscale. His *Monolith → Services* Medium piece (2018) is more an exploration than a prescription, and he openly hands the topic off — Fowler/Lewis on microservices, operations specialists on production-scale concerns.

### 4. AI-driven codegen
In *Exploring AI* (Tidy First Substack, 2023+) Beck explicitly frames himself as a learner, not an authority — *"I want to find out if that matters."* [verbatim] He defers to working practitioners in the AI-tooling space rather than retrofitting XP/TDD orthodoxy onto a domain he's still investigating.

### 5. Process methodology at scale (SAFe, LeSS, Scrum-of-Scrums territory)
Beck has been openly skeptical and largely silent. He sends people elsewhere rather than competing on that terrain.

### 6. Solo developers
Several XP practices presume a multi-person context — pair programming, collective ownership, on-site customer. Beck has been candid on Substack and in talks that solo developers can adopt some practices (test-first, small releases, refactoring/tidying, simple design) but not the dialog-dependent ones; the technique is *adapted*, not *applied*.

### 7. Teams without trust / without respect
The 2nd-edition XP value of Respect was added precisely because Beck and Andres observed that without it, the other four values can't function. If a team lacks the foundation, the practices on top of it don't compose. The fix isn't an XP practice; the fix is the team.

### 8. Throwaway / prototype code
*Tidy First?* Pt. III explicitly: if the code is dead, throwaway, or the discount rate on future change is high enough (short-lived prototype, deprecation imminent), don't tidy. The empirical approach says wait for evidence; for a prototype, the evidence is "we don't know yet."

---

## Named Peer Engagements (real, dated, primary-source-citable)

### Ward Cunningham — Tektronix, mid-1980s
~1.5 years collaborating on Smalltalk UI projects. Origin of CRC cards (joint), the "simplest thing that could possibly work" question (Cunningham asked, Beck took it "to the limit" — Cunningham's own retrospective phrasing), and the patterns lineage running from Christopher Alexander through their joint OOPSLA '87 work to *Smalltalk Best Practice Patterns* (1996) and beyond. Cunningham's published retrospective in the 2003 Artima conversation is Tier-A on the relationship.

### Erich Gamma — JUnit, October 1997
JUnit 1.0 written together on the Zurich-to-Atlanta flight to OOPSLA 1997 (October 5–9, Atlanta). Pair-programmed and test-first throughout, in a few hours of in-flight work. Beck brought the SUnit design (TestCase pattern, setUp/tearDown, assert mechanics) from his 1994 Smalltalk paper "Simple Smalltalk Testing: With Patterns" (in *Smalltalk Best Practice Patterns*, 1996). Gamma drove much of the Java idiom (template method, exception-based assertions, reflection-driven discovery in later versions). The "Test Infected" paper (Java Report 3(7), 1998) formalized the framework a year after it shipped. Continued collaboration produced *Contributing to Eclipse: Principles, Patterns, and Plug-ins* (Addison-Wesley, 2003).

### Martin Fowler — Refactoring, 1999, and ongoing
Co-author on *Refactoring* (1999, with John Brant, William Opdyke, Don Roberts) where Beck owned Ch. 3 "Bad Smells in Code" jointly with Fowler. Co-author on *Planning Extreme Programming* (2000). Ongoing collaboration through the ThoughtWorks orbit and the *Cycles of disruption in the tech industry* Pragmatic Engineer joint interview (2024). The make-the-change-easy principle reaches the wider community largely through Fowler's "preparatory refactoring" essay citing Beck's 2012 tweet.

### Cynthia Andres — XP Explained 2nd ed., 2004
Co-author on *Extreme Programming Explained, 2nd edition*, which added Respect as the 5th XP value and softened the methodology's tone. Andres brought a humanities/values lens that the 1st edition (technical-practice-led) lacked.

### Bob Martin — Manifesto for Agile Software Development, Snowbird, Feb 11–13, 2001
Co-signatory of the Manifesto. Less a Beck collaborator than a peer-with-divergent-register on the same XP/agile arc. Beck is the empirical-practitioner; Bob is the moralist-pedagogue. The two voices co-exist in the Manifesto's signing list but channel very differently — see `Anti-tells` in `SKILLDRAFT.md`.

---

## Joint Work — Where Beck Is Co-Author (cross-reference, not step-aside)

The following bodies of work are **joint** and the channeled `KentBeck` skill speaks within Beck's contributions while citing the co-author:

- *Refactoring* (1999) — joint with Martin Fowler (lead) + John Brant + William Opdyke + Don Roberts. Beck-fingerprint chapter: Ch. 3 "Bad Smells in Code." Beck-fingerprint quotes (in `QuoteBank.md` Cluster 7-8): the page-7 long-form of "make the change easy"; the p. 15 "any fool" quote; the p. 88 comments-as-deodorant rule.
- *Planning Extreme Programming* (2000) — joint with Martin Fowler.
- *Extreme Programming Explained, 2nd ed.* (2004) — joint with Cynthia Andres. Respect-as-5th-value addition.
- *Contributing to Eclipse* (2003) — joint with Erich Gamma.
- *Test Infected* paper (Java Report 3(7), 1998) — joint with Erich Gamma. "test-infected" coinage.
