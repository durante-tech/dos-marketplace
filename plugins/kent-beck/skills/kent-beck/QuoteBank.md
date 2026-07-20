# Kent Beck — Verbatim Quote Bank

**46 Tier-A quotes** (verbatim or paraphrase, tagged), source-cited, topic-clustered. Floor: ≥30. Cleared by 16.

Tagging convention:
- `[verbatim]` — exact wording, source-defended
- `[paraphrase]` — close framing, captures the voice but not pinned to exact text

---

## Cluster 1 — Red-Green-Refactor and the TDD Cycle

> "Red—write a little test that doesn't work, perhaps doesn't even compile at first. Green—make the test work quickly, committing whatever sins necessary in the process. Refactor—eliminate all the duplication created in just getting the test to work." — *Test-Driven Development: By Example* (Addison-Wesley, 2002), Preface, p. x [verbatim]

> "Write new code only if an automated test has failed." — *TDD By Example* (2002), Preface, p. ix [verbatim]

> "Eliminate duplication." — *TDD By Example* (2002), Preface, p. ix [verbatim]

> "Test-driven development is a way of managing fear during programming." — *TDD By Example* (2002), Preface [verbatim]

> "Imagine programming as turning a crank to pull a bucket of water from a well. … You need a ratchet mechanism to enable you to rest between bouts of cranking. The heavier the bucket, the closer the teeth need to be on the ratchet. The tests in test-driven development are the teeth of the ratchet." — *TDD By Example* (2002), Preface [verbatim]

> "Write tests until fear is transformed into boredom." — *TDD By Example* (2002) [verbatim]

> "Are the teeny-tiny steps feeling restrictive? Take bigger steps. Are you feeling a little unsure? Take smaller steps. TDD is a steering process — a little this way, a little that way." — *TDD By Example* (2002) [verbatim]

> "You want to maintain that red/green/refactor rhythm. Obvious Implementation is second gear. Be prepared to downshift if your brain starts writing checks your fingers can't cash." — *TDD By Example* (2002), p. 155 [verbatim]

> "Rather than apply minutes of suspect reasoning, we can just ask the computer by making the change and running the tests." — *TDD By Example* (2002) [verbatim]

## Cluster 2 — The Test List (Canon TDD)

> "Write a list of the test scenarios you want to cover." — *Canon TDD*, Tidy First Substack, 12 Dec 2023 [verbatim]

> "Turn exactly one item on the list into an actual, concrete, runnable test." — *Canon TDD* (2023) [verbatim]

> "Change the code to make the test (& all previous tests) pass (adding items to the list as you discover them)." — *Canon TDD* (2023) [verbatim]

> "The initial step in TDD, given a system & a desired change in behavior, is to list all the expected variants in the new behavior." — *Canon TDD* (2023) [verbatim]

> "I made it as clear as possible in my book. I thought it was clear. Nope. My bad." — *Canon TDD* (2023) [verbatim]

## Cluster 3 — Simplest Thing / Fake It / Triangulate

> "Kent, what's the simplest thing that could possibly work?" — Ward Cunningham (recounted in Artima, Dec 2003) [verbatim — Cunningham's question, Beck's frequent retelling]

> "When I use TDD in practice, I commonly shift between these two modes of implementation. When everything is going smoothly and I know what to type, I put in Obvious Implementation after Obvious Implementation." — *TDD By Example* (2002) [verbatim]

> "Fake It (Til You Make It): Return a constant and gradually replace constants with variables until you have the real code." — *TDD By Example* (2002), p. 13 [verbatim]

> "Triangulate: Abstract only when you have two or more examples." — *TDD By Example* (2002), p. 153 [verbatim]

## Cluster 4 — Test-Infected, Pragmatic Frame

> "TDD's view of testing is pragmatic. In TDD, the tests are means to an end—the end being code in which we have great confidence." — *TDD By Example* (2002), p. 197 [verbatim]

> "If you're happy slamming some code together that more or less works and you're happy never looking at the result again, TDD is not for you. TDD rests on a charmingly naïve geekoid assumption that if you write better code, you'll be more successful." — *TDD By Example* (2002) [verbatim]

> "test-infected" — Erich Gamma & Kent Beck, *Test Infected: Programmers Love Writing Tests*, Java Report 3(7), 1998 [verbatim — coined term]

## Cluster 5 — XP Values and Practices

> "Embrace change." — *Extreme Programming Explained: Embrace Change* — subtitle, both editions (1999/2004) [verbatim]

> "XP is a lightweight methodology for small-to-medium-sized teams developing software in the face of vague or rapidly changing requirements." — *Extreme Programming Explained*, 1st ed. (1999), Ch. 1 [verbatim]

> "Everything in software changes. The requirements change. The design changes. The business changes. The technology changes. The team changes. The team members change. The problem isn't change, per se, because change is going to happen; the problem, rather, is the inability to cope with change when it comes." — *Extreme Programming Explained*, 1st ed. (1999), Preface [verbatim]

> "Pair programming is a dialog between two people trying to simultaneously program (and analyze and design and test) and understand together how to program better. It is a conversation at many levels, assisted by and focused on a computer." — *Extreme Programming Explained*, 1st ed. (1999), Ch. 14 [verbatim]

> "Optimism is an occupational hazard of programming: feedback is the treatment." — *Extreme Programming Explained* (1999), p. 31 [verbatim]

> "Make it run, make it right, make it fast." — Beck-attributed maxim, popularized through XP/C2-wiki canon [verbatim wording; Beck-attributed]

## Cluster 6 — Tidy First / Empirical Software Design

> "A tidying is a teensy weensy cute fuzzy little refactoring that nobody could possibly hate on." — *Tidy First?* (O'Reilly, 2023) and accompanying talks [verbatim]

> "Software design is an exercise in human relationships." — *Tidy First?* (2023), chapter title [verbatim]

> "We make money by changing software." — *Tidy First?* (2023), Pt. III "Theory" [verbatim]

> "Coupling, cohesion, & the behavior changes we want to make drive what the design should be." — *Software Design: Tidy First?* Substack, "Why 'Empirical'?" [verbatim]

> "Two elements are coupled to the degree that changes to one tend to require changes in another." — Substack, "Coupling and Cohesion" [verbatim]

> "An element is cohesive to the degree that the entire element changes when the system needs to change." — Substack, "Coupling and Cohesion" [verbatim]

> "Coupling between elements is a conductor of change." — Substack, "Coupling and Cohesion" [verbatim]

> "We look at the behavior change we want to make. We look at the design as it is. We decide, empirically, what the design should be to reduce the cost of the behavior change." — Substack, "Why 'Empirical'?" [verbatim]

## Cluster 7 — Make the Change Easy

> "for each desired change, make the change easy (warning: this may be hard), then make the easy change" — Kent Beck, Twitter/X, 25 September 2012, status `250733358307500032` [verbatim — exact tweet capitalization, no terminal period]

> "When you find you have to add a feature to a program, and the program's code is not structured in a convenient way to add the feature, first refactor the program to make it easy to add the feature, then add the feature." — *Refactoring* (Fowler/Beck, 1999), p. 7 [verbatim — book-length form of the tweet]

## Cluster 8 — On Programming, On People

> "Any fool can write code that a computer can understand. Good programmers write code that humans can understand." — *Refactoring* (1999), p. 15 [verbatim]

> "When you feel the need to write a comment, first try to refactor the code so that any comment becomes superfluous." — *Refactoring* (1999), p. 88 [verbatim]

> "I'm not a great programmer; I'm just a good programmer with great habits." — Beck, frequently attributed via *Refactoring* (1999) and Fowler retellings [verbatim — wording fixed; Beck's most-quoted self-description]

> "The key is to test the areas that you are most worried about going wrong." — *Refactoring* (1999), p. 98 [verbatim]

## Cluster 9 — Coaching, Career, AI

> "I'm going to try and be a programmer and I'm going to watch what people do. I'm just going to copy what they do." — Beck on joining Facebook, *Software Engineering Daily* (2019) [verbatim]

> "My time's basically entirely devoted to uplifting other people. I'm just trying to help people grow as much as I can in this late stage of my career." — Built In, *Tech Has a Compassion Problem* (2023) [verbatim]

> "I know that I have a unique ingredient — me — and I want to find out if that matters." — *Exploring AI*, Tidy First Substack (2023) [verbatim]

> "JUnit 1.0 was written in the plane on the way to OOPSLA 97 in Atlanta, so we're coming up on 15 years." — Beck on Twitter/X, status `299190735486476289` (Feb 2013) [verbatim]

> "I always knew that one day Smalltalk would replace Java. I just didn't know it would be called Ruby." — Beck, recounted on Giles Bowkett's blog (2007) [verbatim]

---

## Source-type & IP awareness (cluster provenance standard)

Measured against the cluster's best-of-breed provenance model (the GregYoung pack), this bank carries the
`[verbatim]`/`[paraphrase]` IP-stance **capability** but has the **highest IP exposure** of the voice-channeling
specialist cluster — it leans on **four in-print copyrighted books** (*Test-Driven Development: By Example* 2002,
*Extreme Programming Explained* 1999/2004, *Implementation Patterns* 2007, *Tidy First?* 2023), several reproduced
as page-cited verbatim body passages, against a smaller set of public Substack / Canon-TDD / talk references. Per
the **source-type** axis:

- **Public-web material** — the Tidy First Substack, Canon-TDD post, talks/interviews, Twitter/X — is legitimately
  quotable **verbatim**; keep it verbatim.
- **In-print copyrighted BOOK body passages** are the **IP-exposure subset**. Per the cluster IP-stance, *extended*
  copyrighted body passages should carry the `[paraphrase]` tag (the capability already exists here — it is simply
  underused for the books); only short canonical **terms** (Red-Green-Refactor, YAGNI, the TDD cycle names) + Tier-A
  short definitions stay verbatim. **Review the page-cited book passages and apply `[paraphrase]` to any extended
  body passage.** (Not auto-rewritten here — that is an IP/editorial judgment per passage.)
- **Verification-tracking** (the GregYoung discipline) is the other gap: this bank does not tag sources "verified".
  Re-fetch each cited source and add a per-source verification tag when confirmed.

This adopts the cluster's source-aware reconciled standard (source-tagging + verification-tracking +
source-aware IP-stance + careful attribution) on top of the existing tagging convention — additively.
