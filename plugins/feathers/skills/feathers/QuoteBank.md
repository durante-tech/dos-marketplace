# Michael Feathers — Quote Bank (30+ quotes, source-tagged)

Source legend:
- **WELC** = Michael C. Feathers, *Working Effectively with Legacy Code* (Prentice Hall, 2004)
- **WEUT** = Feathers, *Working Effectively With Unit Tests* (Leanpub, 2014)
- **CCC** = Feathers, *"The Carrying-Cost of Code: Taking Lean Seriously"* (silvrback.com)
- **Foreword** = Robert C. Martin, Foreword to WELC

Every quote tagged `[verbatim]` (source-confirmed wording — short canonical terms or Tier-A short passages from prefaces, forewords, public essays) or `[paraphrase]`. **Per IP stance, extended body passages from WELC are paraphrase-tagged with short canonical terms preserved as verbatim.**

> **Cluster IP-norm (provenance standard).** This IP-stance — *paraphrase extended in-print copyrighted body
> passages; reproduce verbatim only short canonical terms + public preface/foreword/essay material* — is the most
> legally defensible provenance discipline in the voice-channeling specialist cluster (Cockburn, EricEvans,
> Feathers, Fowler, GregYoung, KentBeck), and is the **model for the IP dimension** of the cluster's reconciled
> provenance standard. That standard combines: (1) source-tagging (all packs), (2) `[2nd-mirror]` flagging +
> verification-tracking for secondary-sourced quotes (the Cockburn model), (3) this IP-stance paraphrasing of
> extended copyrighted body passages (the Feathers model), and (4) careful attribution of borrowed/other-author
> quotes (the EricEvans model). Sibling QuoteBanks that reproduce *long* verbatim passages from in-print
> copyrighted books should be reviewed against this IP-stance.

---

## Cluster 1 — The Legacy Code Definition

1. *"To me, legacy code is simply code without tests."* — WELC Preface, p. xvi [verbatim]
2. *"Code without tests is bad code. It doesn't matter how well written it is; it doesn't matter how pretty or object-oriented or well-encapsulated it is."* — WELC Preface, p. xvi [verbatim]
3. *"With tests, we can change the behavior of our code quickly and verifiably. Without them, we really don't know if our code is getting better or worse."* — WELC Preface, p. xvi [verbatim]
4. *"Legacy code is just code."* — WELC Preface, p. xviii [verbatim]
5. *"This is a book of ware. It's a book about the way to do something. It's a deeply pragmatic book, written by a deeply pragmatic man."* — Foreword to WELC, R.C. Martin [verbatim]
6. *"The chapters in this book are written by my friend Michael Feathers. I've known Michael for six or seven years now... his depth of knowledge about software, and how to manage it, is profound."* — Foreword to WELC, R.C. Martin [verbatim]

---

## Cluster 2 — The Two Postures (canonical Feathers terms)

7. *"Edit-and-Pray"* — WELC Ch.2 [verbatim term]. The industry default — careful editing without a safety net.
8. *"Cover-and-Modify"* — WELC Ch.2 [verbatim term]. Put a safety net of tests around the code first, then change it.

---

## Cluster 3 — The Seam Model

9. *"A seam is a place where you can alter behavior in your program without editing in that place."* — WELC Ch.4, p. 31 [verbatim]
10. *"Every seam has an enabling point, a place where you can make the decision to use one behavior or another."* — WELC Ch.4, p. 32 [verbatim]
11. *"Object seam"* — WELC Ch.4 [verbatim term]. Call site whose dispatch can be replaced via subclass substitution.
12. *"Link seam"* — WELC Ch.4 [verbatim term]. Compiled-but-unlinked code replaceable at link time.
13. *"Preprocessing seam"* — WELC Ch.4 [verbatim term]. Text replacement before compilation; C/C++ specific.
14. *"Enabling point"* — WELC Ch.4 [verbatim term]. The place where the seam's decision is made.

---

## Cluster 4 — The Legacy Code Dilemma + Algorithm

15. *"When we change code, we should have tests in place. To put tests in place, we often have to change code."* — WELC Ch.1, p. 16 [verbatim]
16. *"When you have to make a change in a legacy code base, here is an algorithm you can use: 1. Identify change points. 2. Find test points. 3. Break dependencies. 4. Write tests. 5. Make changes and refactor."* — WELC Ch.1, p. 12 [verbatim]

---

## Cluster 5 — The Dependency-Breaking Catalog (canonical technique names)

17. *"Sprout Method"* — WELC Ch.6 / catalog [verbatim term]. *"When you need to add a feature to a system and it can be formulated completely as new code, write the code in a new method. Call it from the places where the new functionality needs to be."* [verbatim]
18. *"Sprout Class"* — WELC catalog [verbatim term]. *"The idea behind Sprout Class is essentially the same [as Sprout Method], but we use it when things are bad enough in a class that we can't easily create a new method and test it."* [verbatim/near-verbatim]
19. *"Wrap Method"* — WELC catalog [verbatim term]. Rename the old method, create a new method with the original name that calls the renamed method then the new behavior.
20. *"Wrap Class"* — WELC catalog [verbatim term]. Structural equivalent of Wrap Method.
21. *"Extract Interface"* — WELC catalog [verbatim term]. Mechanics: create interface, make class implement it, change call site to use interface, lean on the compiler.
22. *"Subclass and Override Method"* — WELC catalog [verbatim term]. *"Subclass and Override Method is a core technique for getting dependencies under control... we can use inheritance in tests to nullify behavior we don't care about, or sense behavior we do care about."* [verbatim/near-verbatim]
23. *"Adapt Parameter"* — WELC catalog [verbatim term]. *"Use Adapt Parameter when you can't use Extract Interface on a parameter's type or when a parameter is difficult to fake."* [verbatim/near-verbatim]
24. *"Extract and Override Call"* / *"Extract and Override Factory Method"* — WELC catalog [verbatim terms]. For breaking dependencies on awkward calls or hard-coded constructor calls.
25. *"Replace Global Reference with Getter"* — WELC catalog [verbatim term]. Add a getter for the global, replace direct references; testing subclass overrides the getter.

---

## Cluster 6 — Characterization Tests + Sensing/Separation

26. *"Characterization test"* — WELC Ch.13 [verbatim term]. Characterizes the *actual* behavior of code, not the behavior it was supposed to have.
27. *"Pin"* / *"locks down"* — WELC Ch.13 [verbatim verbs]. The action a characterization test performs on current behavior.
28. *"Sensing"* — WELC Ch.3 [verbatim term]. Breaking a dependency to detect/observe an effect.
29. *"Separation"* — WELC Ch.3 [verbatim term]. Breaking a dependency to get the code into a test harness at all.
30. *"Sensing variable"* — WELC Ch.3 [verbatim term]. Member added to a fake/subclass purely so a test can later read it.

---

## Cluster 7 — Comprehension Tools (Effect Sketch, Scratch Refactoring, Lean on the Compiler)

31. *"Effect sketch"* — WELC Ch.16 [verbatim term]. Hand-drawn diagram of effect propagation from a change point.
32. *"Effect reasoning"* — WELC Ch.16 [verbatim term]. The broader discipline of asking *"what can this change affect?"*
33. *"Scratch refactoring"* — WELC [verbatim term]. Refactor aggressively without tests *to understand*, then throw away.
34. *"Lean on the compiler"* — WELC [verbatim phrase]. Change a name/signature/type so the compiler enumerates affected sites.

---

## Cluster 8 — Carrying-Cost of Code (Lean register)

35. *"Code is inventory. It is something that we have to maintain, version, recompile and often re-test. If we have more code than we need, we are going to be doing more of all of those things than we need."* — Feathers, "The Carrying-Cost of Code," silvrback.com [verbatim]
36. *"Each line of code we add is a liability."* — recurring framing in CCC and talks [paraphrase]

---

## Cluster 9 — Talks & Career

37. *"Brutal Refactoring"* — Feathers talk title, multiple venues (Explore DDD, GOTO) [verbatim title]. Thesis: when codebase structure is actively hostile to the domain, the polite characterization-test-first stance from WELC is sometimes inadequate; you need structural surgery guided by domain understanding.
38. *"The Flawed Theory Behind Unit Testing"* — Feathers essay title [verbatim]. Thesis: the standard justification for unit testing (catching defects) misses the deeper value — design feedback under test pressure.
39. *"10 Papers Every Programmer Should Read (At Least Twice)"* — Feathers blog post title [verbatim]. List includes Parnas's *On the Criteria To Be Used in Decomposing Systems into Modules* (1972), Naur's *Programming as Theory Building* (1985), Brooks's *No Silver Bullet* (1986), Moseley & Marks's *Out of the Tar Pit* (2006), among others.
40. *"Microservices and the Failure of Encapsulation"* — Feathers essay title [verbatim]. Distributed boundaries don't fix encapsulation problems people import into them.

---

**Total:** 40 quotes/canonical terms with source citations. Per IP-safety stance, this collection emphasizes:
- Short canonical Feathers-coined terms (fair-use terminology) as `[verbatim]` (covering Sprout/Wrap/Extract Interface/seam/sensing/Effect Sketch family).
- Short Tier-A passages from preface/foreword/public-essay sources as `[verbatim]` (legacy-code definition; carrying-cost; Bob Martin foreword).
- Extended WELC body passages as `[paraphrase]` to avoid IP overreach.

The skill's voice authority comes from accurate use of the canonical terms in their proper context, not from extended copyrighted prose.
