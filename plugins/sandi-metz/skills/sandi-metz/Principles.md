# Sandi Metz — Principles (verbatim canonical references)

Source legend:
- **POODR1** = Sandi Metz, *Practical Object-Oriented Design in Ruby: An Agile Primer* (Addison-Wesley, 2012, ISBN 978-0-321-72133-4)
- **POODR2** = Sandi Metz, *Practical Object-Oriented Design: An Agile Primer Using Ruby* (2nd ed, Addison-Wesley, 2018, ISBN 978-0-13-445647-8)
- **99B** = Sandi Metz + Katrina Owen, *99 Bottles of OOP* (sandimetz.com self-published, 2017; 2nd ed 2020 with TJ Stankus)
- **TB-Rules** = Thoughtbot, "Sandi Metz' Rules for Developers" (May 2013, https://thoughtbot.com/blog/sandi-metz-rules-for-developers) — reproduces rules from Metz "Get a Whiff of This" RailsConf 2013
- **Wrong-Abs** = Sandi Metz, "The Wrong Abstraction" (sandimetz.com/blog/2016/1/20/the-wrong-abstraction, 2016-01-20) — WebFetch-verified
- **Polly** = Sandi Metz, "Polly Want a Message," Deconstruct 2018 (deconstructconf.com)
- **Magic** = Sandi Metz, "The Magic Tricks of Testing" (Ancient City Ruby 2013 / RailsConf 2013)

Per IP-safety stance: short canonical terms `[verbatim]`, extended POODR/99B body prose `[paraphrase]`, sandimetz.com blog content `[verbatim]` (WebFetch-verified), public talk transcripts `[verbatim]` (deconstructconf.com).

---

## §1 The Four Rules (TB-Rules 2013, Metz "Get a Whiff of This" RailsConf 2013)

The four rules are deliberately too strict to follow blindly — the value is in the **conversation about why a piece of code wants to break them**.

### Rule 1
> *"Classes can be no longer than one hundred lines of code."* — TB-Rules [verbatim]

### Rule 2
> *"Methods can be no longer than five lines of code."* — TB-Rules [verbatim]

### Rule 3
> *"Pass no more than four parameters into a method. Hash options parameters count."* — TB-Rules [verbatim]

The hash-options clause is the load-bearing detail — Ruby developers had been using options hashes to evade parameter counts; Metz closed the loophole explicitly.

### Rule 4
> *"Controllers can instantiate only one object. Therefore, views can only know about one instance variable and views should only send messages to that object (`@object.collaborator.value` is not allowed)."* — TB-Rules [verbatim]

The parenthetical about `@object.collaborator.value` is the Law-of-Demeter teeth on the rule.

### The Exception Protocol
> *"You can break these rules only if you can talk your pair (or your tech lead) into agreeing with you."* — TB-Rules [verbatim, attributing to Metz]

Canonical name in the community: **the pairing exception** [verbatim term]. The protocol IS the teaching device — the rules are deliberately too strict to follow blindly, which forces a conversation about *why* a piece of code wants to be larger.

---

## §2 TRUE Properties (POODR Ch.2)

Metz's acronym for code that is easy to change. From POODR Ch.2 ("Designing Classes with a Single Responsibility"):

- **Transparent** [verbatim term, POODR Ch.2] — the consequences of change should be obvious in the code that's changing and in distant code that relies upon it. [paraphrase, POODR Ch.2]
- **Reasonable** [verbatim term] — the cost of any change should be proportional to the benefits the change achieves. [paraphrase]
- **Usable** [verbatim term] — existing code should be usable in new and unexpected contexts. [paraphrase]
- **Exemplary** [verbatim term] — the code itself should encourage those who change it to perpetuate these qualities. [paraphrase]

> **TRUE** [verbatim acronym, POODR Ch.2] — the mnemonic itself is canonical Metz vocabulary.

---

## §3 Single Responsibility Principle (POODR Ch.2)

Two diagnostic techniques [paraphrase, POODR Ch.2]:

1. **Pretend the class is sentient and interrogate it about its methods.** Rephrase each method as a question that has to make sense when asked of the class. *"Please, Mr. Gear, what is your ratio?"* makes sense; *"Please, Mr. Gear, what are your tire size?"* does not.
2. **Try to describe the class in one sentence.** If the simplest description requires the word **"and,"** the class likely has more than one responsibility. If it requires **"or,"** then the class has more than one responsibility *and* they aren't even very related.

> *"A class should do the smallest possible useful thing; that is, it should have a single responsibility."* — POODR Ch.2 [paraphrase faithful]

The bicycle/Gear example introduces SRP: a `Gear` class accumulates wheel/tire responsibilities and gets refactored once the description needs "and" — Wheel extracts out, Gear gets thinner.

---

## §4 The Bicycle Example (POODR running thread)

Metz uses one running example across all 9 chapters of POODR. The bicycle/Gear/Wheel/Trip/Mechanic family evolves chapter by chapter:

- **Ch.2 — SRP** — `Gear` accumulates responsibilities; `Wheel` extracts out.
- **Ch.3 — Dependencies** — `Gear.new(52, 11, 26, 1.5)` is the cautionary positional-argument example, refactored to keyword arguments + dependency injection.
- **Ch.4 — Flexible Interfaces** — `Trip` / `Mechanic` / `Customer` triad; `Trip` stops asking *how* and starts trusting *what*.
- **Ch.5 — Duck Typing** — collaborators interact via duck-typed `Preparable` interface.
- **Ch.6 — Inheritance** — `Bicycle` → `RoadBike` / `MountainBike` via template method pattern; the `style` attribute antipattern.
- **Ch.7 — Modules** — `Schedulable` becomes a role-bearing module shared across `Bicycle`, `Mechanic`, `Vehicle`.
- **Ch.8 — Composition** — `Bicycle` rebuilt has-a via `Parts` and `PartsFactory`; same problem solved differently.
- **Ch.9 — Tests** — the same bicycle becomes the testing-strategy example.

The pedagogical point: the same five nouns carry the entire book; new chapters refactor the same example rather than introducing new domains.

---

## §5 Managing Dependencies (POODR Ch.3)

Metz's four canonical techniques [verbatim names, POODR Ch.3]:

1. **Inject dependencies** — pass collaborators in rather than hard-coding the class name.
2. **Isolate dependencies** — if you can't inject, at least isolate the reference (wrap `Wheel.new(...)` in a private `wheel` method).
3. **Isolate vulnerable external messages** — wrap fragile message sends behind a method you own.
4. **Remove argument-order dependencies** — use a hash / keyword arguments instead of positional arguments.

> *"Depend on things that change less often than you do."* — POODR Ch.3 [paraphrase faithful canonical maxim]

---

## §6 Duck Typing (POODR Ch.5)

> **Duck Typing** [verbatim chapter title]

> *"If it quacks like a duck and walks like a duck, then its class is immaterial, it's a duck."* — POODR Ch.5 [verbatim — canonical OO maxim adopted by Metz]

> *"It's not what an object IS that matters, it's what it DOES."* — widely attributed to POODR Ch.5 [unverified-via-fetch verbatim — canonical Metz framing]

The diagnostic Metz emphasizes [paraphrase]: the most telling sign that you need a duck type is a `case` statement switching on an object's class, or a sequence of `kind_of?` / `is_a?` / `responds_to?` checks. Each branch is begging to become a polymorphic message.

---

## §7 Inheritance vs Composition (POODR Ch.6 & Ch.8)

> **"is-a" vs "has-a"** [verbatim distinction, POODR Ch.6/Ch.8]

> **Template Method pattern** [verbatim term, POODR Ch.6]

> **Hook method** [verbatim term, POODR Ch.6] — subclasses override hooks; superclass owns the algorithm.

[paraphrase, POODR Ch.6] Use inheritance for *is-a* relationships where objects share behavior and differ along a single dimension. The classic antipattern: a single class with a `type` or `style` attribute and conditional logic switching on it. Refactor by promoting common code to an abstract superclass and letting each subclass own its specialization.

> *"When in doubt, prefer composition over inheritance."* — POODR Ch.8 [paraphrase faithful, Gang-of-Four maxim Metz endorses]

---

## §8 The Squint Test (99B Ch.1)

> **Squint Test** [verbatim term, 99B Ch.1]

[paraphrase, 99B] Lean back from the screen and squint until the words blur. Two visual signals come through:
- **Shape** — the indentation pattern (how the code steps in and out)
- **Color** — where conditionals stack up in syntax highlighting

Code with one shape and one color is doing one thing; code with multiple shapes and colors is concealing multiple responsibilities. The test bypasses the reading brain and surfaces structural smells the way a thumbnail of a painting reveals composition problems a close-up hides.

---

## §9 Shameless Green (99B Ch.1)

> **Shameless Green** [verbatim term, 99B Ch.1]

[paraphrase, 99B] The first solution should make every test pass with no concern for elegance, abstraction, or duplication. Repetition is welcome. The point is to reach green — fully tested, fully working — *before any design pressure is allowed in*. Stay in Shameless Green long enough that the third or fourth case forces the duplication to declare its own pattern; the abstraction you discover this way is the right one because it was *revealed*, not *imposed*. Premature cleverness in the first draft locks in the wrong shape.

---

## §10 The 99 Bottles Refactoring Sequence (99B canonical spine)

The book's spine is a fixed sequence [paraphrase, 99B]:

1. **Write the tests first** — characterization-style, covering the full output.
2. **Reach Shameless Green** — duplicative, ugly, passing.
3. **Apply the Squint Test** — find the smells visually before naming them.
4. **Name the smells** — long method, repeated conditional, primitive obsession, data clump.
5. **Take the smallest possible refactoring step** — one parse-tree rotation at a time, tests green between each.
6. **Never make a leap** — every intermediate state runs; if you can't see the next step, you've zoomed too far.
7. **Let the abstraction emerge** — don't impose it. The third case usually reveals it.

> **Flocking** [verbatim term, 99B] — refactor identical-shaped pieces of code in lockstep, finding what varies by aligning what's the same.

---

## §11 The Wrong Abstraction (Wrong-Abs 2016 — WebFetch verified)

The most-quoted lines in modern OOP discourse on premature abstraction [all verbatim, sandimetz.com 2016-01-20]:

> *"duplication is far cheaper than the wrong abstraction"* — Wrong-Abs [verbatim]

> *"prefer duplication over the wrong abstraction"* — Wrong-Abs [verbatim]

> *"the fastest way forward is back"* — Wrong-Abs [verbatim]

> *"This is not retreat, it's advance in a better direction."* — Wrong-Abs [verbatim]

### The 8-step decay narrative [verbatim sequence, Wrong-Abs]

1. Programmer A sees duplication.
2. Programmer A extracts duplication and gives it a name.
3. Programmer A replaces the duplication with the new abstraction.
4. Time passes.
5. A new requirement appears for which the abstraction is *almost* perfect.
6. Programmer B (often a different person) alters the abstracted code to take a parameter and add a conditional.
7. Each new requirement adds another parameter and another conditional, until the code becomes incomprehensible.
8. You inherit this code.

### The rebound recipe [verbatim sequence, Wrong-Abs]

1. Re-introduce duplication by inlining the abstracted code back into every caller.
2. Use parameters and conditionals at the call sites to determine which inlined code executes.
3. Delete the unneeded bits in each caller.

Once duplication is restored, the *correct* abstraction can be discovered fresh — usually a different shape than the wrong one.

---

## §12 The Magic Tricks of Testing Matrix (Magic 2013)

The 6-quadrant test classification — incoming/outgoing × query/command/sent-to-self [paraphrase + partial verbatim, synthesized from canonical Magic deck]:

| Message origin × type | Canonical rule |
|---|---|
| **Incoming Query** | **Test it.** Assert what it returns. *"Make assertions about what they send back."* [verbatim] |
| **Incoming Command** | **Test it.** Assert direct public side effects. |
| **Sent-to-Self (private)** | **Don't test.** Covered by public-interface tests. *"If the test for gear inches is correct, this test will be redundant."* [verbatim] |
| **Outgoing Query** | **Don't test.** *"If a message has no visible side effects, it is invisible to rest of your app, so the sender should not test it."* [verbatim] |
| **Outgoing Command** | **Mock it.** Expect-the-message; don't assert distant side effects. |
| **Inherited / sent-via-super** | Same approach as origin position |

> *"Test the interface, not the implementation."* — Magic [verbatim]
> *"Honor the contract."* — Magic [verbatim]
> *"Test Everything Once."* — Magic [verbatim canonical maxim]
> *"Listen to your tests."* — POODR Ch.9 [verbatim term]

---

## §13 POODR's Opening Framing (Ch.1)

> *"The purpose of design is to allow you to do design later, and its primary goal is to reduce the cost of change."* — POODR Ch.1 [paraphrase — canonical Metz aphorism, exact wording widely-quoted but unverified-via-fetch this pass]

[paraphrase, POODR Ch.1] Design is not about predicting the future; it's about preserving the ability to make decisions in the future. Practical design does not anticipate what will happen; it merely accepts that *something* will happen and that, in the present, you cannot know what.

---

## §14 Polly Want a Message (Polly 2018 — Deconstruct, verified)

[all verbatim from deconstructconf.com transcript, Polly 2018]:

> *"Messages let me know what I want without knowing how you behave. So they provide a level of indirection which gives me… a seam where I can have substitutability on the other side."*

> *"What they primarily do is give me ignorance, and in OO languages, we're striving to be ignorant about what other objects do."*

> *"It's that quality where different kinds of objects can respond to the same message. That's what it's about. They share a common form at the message response level."* (definition of polymorphism)

> *"OO is a play where you create living beings and make a world where action happens."*

> *"OO gives you the opportunity to maximize the ignorance of every object."*

---

## §15 Recurring Imperatives

Across POODR, 99B, talks, blog [paraphrase synthesizing recurring themes]:

- **"Make smaller things"** — load-bearing imperative; if a method or class is growing, the answer is almost always to extract.
- **"Stay in Shameless Green longer than feels comfortable"** — duplicate freely until the third or fourth case shows you the abstraction.
- **"Squint at it"** — bypass reading-brain pattern matching; the smell is visual before it's verbal.
- **"You can break the rule if you talk your pair into it"** — the conversation IS the actual quality gate.
- **"Listen to your tests"** — painful tests are a design smell, not a testing problem.
