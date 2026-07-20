# Michael Feathers — Principles (verbatim canonical references)

Source legend:
- **WELC** = Michael C. Feathers, *Working Effectively with Legacy Code* (Prentice Hall, 2004), ISBN 0-13-117705-2
- **WEUT** = Michael C. Feathers, *Working Effectively With Unit Tests* (Leanpub, 2014, self-published)
- **CCC** = Michael Feathers, *"The Carrying-Cost of Code: Taking Lean Seriously"* (michaelfeathers.silvrback.com)
- **TPER** = Michael Feathers, *"10 Papers Every Programmer Should Read (At Least Twice)"* (blog post)
- **GOOS** = Steve Freeman + Nat Pryce, *Growing Object-Oriented Software, Guided by Tests* (Addison-Wesley, 2009) — adjacent corpus
- **MRNO** = Freeman, Mackinnon, Pryce, Walkingshaw, *"Mock Roles, Not Objects"* (OOPSLA 2004) — adjacent corpus

Every quote tagged `[verbatim]` (source-confirmed exact wording — short terms or short Tier-A passages from publicly-quoted prefaces / forewords / essays) or `[paraphrase]` (close to text). Untagged is paraphrase by convention. **Per IP-safety stance, extended WELC body passages are paraphrase-tagged with short canonical terms preserved as verbatim.**

---

## §1 The Legacy Code Definition (WELC Preface)

> *"To me, legacy code is simply code without tests. I've gotten some grief for this definition. What do tests have to do with whether code is bad? To me, the answer is straightforward, and it is a point that I elaborate throughout the book: Code without tests is bad code. It doesn't matter how well written it is; it doesn't matter how pretty or object-oriented or well-encapsulated it is. With tests, we can change the behavior of our code quickly and verifiably. Without them, we really don't know if our code is getting better or worse."* — WELC Preface, p. xvi [verbatim]

> *"Legacy code is just code."* — WELC Preface, p. xviii [verbatim]

The reframe: *legacy* is a **technical condition**, not a pejorative. The previous authors aren't blamed; the absence of tests is the diagnosis.

---

## §2 The Two Postures — Edit-and-Pray vs Cover-and-Modify (WELC Ch.2)

Two canonical Feathers terms, deliberately set up as rhyming opposites [both verbatim terms, WELC Ch.2 "Working with Feedback"]:

- **Edit-and-Pray** — the industry default. Study the code, make the change, run the system, click through manually, *hope nothing broke elsewhere*. Dressed up as "professionalism," but careful is not the same as **safe**. [paraphrase, Ch.2]
- **Cover-and-Modify** — put a **safety net** of tests around the code first, *then* change it, with the net catching regressions. The recurring metaphor: software changes are like working with hazardous materials; you wear the suit first. [paraphrase, Ch.2]

The whole book is built on this dichotomy. Every Part II chapter ("I need to make a change…") presupposes you're trying to migrate from Edit-and-Pray to Cover-and-Modify on code that wasn't written test-first.

---

## §3 The Seam Model (WELC Ch.4)

> *"A seam is a place where you can alter behavior in your program without editing in that place."* — WELC Ch.4, p. 31 [verbatim]

> *"Every seam has an enabling point, a place where you can make the decision to use one behavior or another."* — WELC Ch.4, p. 32 [verbatim]

### §3a Object Seam (Ch.4)

A call site whose dispatch can be replaced via subclass substitution. The enabling point is where you decide which object will be used — typically the parameter, factory, or constructor that supplies the dependency. [paraphrase, Ch.4]

### §3b Link Seam (Ch.4)

A site where compiled-but-unlinked code can be replaced at link time. The enabling point is **outside the code itself** — in the build system, makefile, classpath, or linker configuration. [paraphrase, Ch.4]

### §3c Preprocessing Seam (Ch.4)

A site where text is replaced before compilation. C/C++ specific. The enabling point is a `#define` or `#include` directive. [paraphrase, Ch.4]

---

## §4 The Legacy Code Dilemma + Change Algorithm (WELC Ch.1)

> *"When we change code, we should have tests in place. To put tests in place, we often have to change code."* — WELC Ch.1, p. 16 [verbatim]

This is **the legacy code dilemma**: tests require seams; seams require refactoring; refactoring without tests is unsafe. Feathers's resolution: use minimally invasive dependency-breaking techniques that are safe enough to do without tests, get the code under test, then refactor freely.

> *"When you have to make a change in a legacy code base, here is an algorithm you can use:*
> *1. Identify change points.*
> *2. Find test points.*
> *3. Break dependencies.*
> *4. Write tests.*
> *5. Make changes and refactor."* — WELC Ch.1, p. 12 [verbatim]

The five-step algorithm is the spine of every Part II chapter.

---

## §5 The Dependency-Breaking Catalog (WELC Part II)

Each catalog entry follows the **"I need to make a change"** template: *Situation → Reasoning → Mechanics (numbered) → Example → Summary/cautions*. Mechanics steps are imperative, second-person, language-agnostic where possible.

### §5a Sprout Method (WELC catalog, p. 59-62)

> *"When you need to add a feature to a system and it can be formulated completely as new code, write the code in a new method. Call it from the places where the new functionality needs to be."* — WELC catalog "Sprout Method" [verbatim]

Mechanics [paraphrase, WELC pp. 60-62]:
1. Identify where you need to make your change.
2. If the change can be formulated as a single sequence of statements in one place, write down a call for a new method that will do the work, and comment it out.
3. Determine what local variables you need from the source method; make them arguments to the call.
4. Determine whether the sprouted method needs to return values; if so, capture into a variable.
5. Develop the sprouted method using **test-driven development**.
6. Remove the comment to enable the call.

### §5b Sprout Class (WELC catalog, p. 63)

> *"The idea behind Sprout Class is essentially the same [as Sprout Method], but we use it when things are bad enough in a class that we can't easily create a new method and test it."* — WELC catalog [paraphrase faithful]

Use when the host class is so dependency-laden you can't instantiate it in a test harness.

### §5c Wrap Method (WELC catalog, pp. 71-74)

Add new behavior to a system without intermingling it with existing behavior: rename the old method, then create a new method with the original name that calls the renamed method and then calls the new behavior. [paraphrase, WELC]

### §5d Wrap Class (WELC catalog, pp. 75-80)

Structural equivalent of Wrap Method. Create a new class that wraps the old one and adds new behavior; the wrapper holds a reference to the wrapped object, delegates original calls, adds new ones. [paraphrase, WELC]

### §5e Extract Interface (WELC catalog, pp. 362-366)

Mechanics [paraphrase, WELC]:
1. Create a new interface with the name you want. Don't add methods to it yet.
2. Make the existing class implement the interface.
3. Change the place where you want to use the new object so it uses the interface, not the original class.
4. Compile to find which methods need to be on the interface.
5. Add those methods to the interface.
6. Repeat until the system compiles.

### §5f Subclass and Override Method (WELC catalog, pp. 401-403)

A core technique. Use inheritance in tests to nullify behavior we don't care about, or sense behavior we do care about. [paraphrase, WELC]

### §5g Adapt Parameter (WELC catalog, pp. 326-330)

Use when you can't apply Extract Interface on a parameter's type, or when the parameter is difficult to fake. Wrap it in a new interface that's easier to fake. [paraphrase, WELC]

### §5h Other catalog entries (WELC Part II, paraphrased)

- **Break Out Method Object** — extract a long method into its own class so locals become fields you can sense.
- **Definition Completion** — C/C++; declare a class in a header but provide an alternate definition for tests.
- **Encapsulate Global References** — bundle related globals into a class so they can be replaced wholesale.
- **Expose Static Method** — make a private static method public so it can be tested directly.
- **Extract and Override Call** — extract an awkward call into a new method, override in a testing subclass.
- **Extract and Override Factory Method** — for hard-coded constructor calls in constructors.
- **Extract and Override Getter** — lazy-init via a getter, override in subclass.
- **Extract Implementer** — when adding an interface is awkward, rename the class to `XImpl` and create `X` interface above it.
- **Introduce Instance Delegator** — for hard-to-test static methods.
- **Introduce Static Setter** — for singletons; let tests inject a replacement instance.
- **Link Substitution** — swap libraries at link time.
- **Parameterize Constructor / Method** — promote internally-constructed collaborators to parameters.
- **Primitivize Parameter** — last-resort beachhead; move logic to a free function operating on primitives.
- **Pull Up Feature** — push methods up into a base class so a testing subclass can be created beneath.
- **Push Down Dependency** — push problematic dependencies down into a production subclass.
- **Replace Function with Function Pointer** — C technique.
- **Replace Global Reference with Getter** — add a getter, override in subclass.
- **Supersede Instance Variable** — add a setter to overwrite a hard-to-construct instance variable post-construction.
- **Template Redefinition** — C++ technique using template parameters as a seam.
- **Text Redefinition** — Ruby/dynamic-language technique; redefine the method in test code.

---

## §6 Characterization Tests (WELC Ch.13)

A **characterization test** [verbatim term, WELC Ch.13] characterizes the **actual** behavior of a piece of code, not the behavior it was supposed to have or the behavior we wish it had. [paraphrase, Ch.13]

The reframe: a characterization test isn't a *correctness* test, it's a **behavior-pinning** test. If the code currently returns 7 when you expect 8, the characterization test asserts 7 — because 7 is what production depends on, and changing it without knowing is the actual risk. [paraphrase, Ch.13]

### §6a The Characterization Test Algorithm (4 steps, paraphrased from Ch.13)

1. Use a piece of code in a test harness — write a test that calls the target method/function with some input.
2. Write an assertion you know will fail (assert against a deliberately wrong sentinel value).
3. Let the failure tell you the actual behavior — the runner prints the real return value.
4. Change the assertion so the test passes against that captured actual value. Run again to confirm green.

The verbs Feathers uses for what you've produced: the test **"locks down"** or **"pins"** current behavior. [verbatim verbs, Ch.13]

### §6b The Anti-Pattern (Ch.13)

Writing spec-style tests in legacy code is dangerous: you don't know whether the code matches the spec; if it doesn't, your "passing" test is actually a failing characterization that you've mislabeled. Other code may depend on the bug — fixing it silently breaks downstream callers.

The discipline: **first pin what is, then decide what should be**. Treat the gap as a separate, deliberate change with its own tests. [paraphrase, Ch.13]

---

## §7 Sensing and Separation (WELC Ch.3)

Two reasons you break dependencies in legacy code. Conflating them produces bad refactorings.

### §7a Sensing

**Sensing** [verbatim term, Ch.3] — break a dependency because you can't currently **detect** the effect your code has. The collaborator (database, logger, hardware, static singleton) makes it impossible for a test to **observe** what happened. So you break the dependency to interpose something the test can read.

### §7b Separation

**Separation** [verbatim term, Ch.3] — break a dependency because you can't get the code **into a test harness at all**. The class won't instantiate, the constructor reaches out to a network, the static initializer touches the filesystem. So you separate to make construction possible.

The same techniques (Extract Interface, Subclass and Override) get used for both purposes — but knowing **which problem you have** changes which seam you pick and how minimal you can be.

### §7c Sensing Variable

A **sensing variable** [verbatim term, Ch.3] is a member added to a class — usually in a test subclass or fake — purely so a test can later read it and confirm something happened. Classic case: override a void method, set `wasCalled = true` inside the override, assert on `wasCalled` in the test.

---

## §8 Effect Sketch / Effect Reasoning (WELC Ch.16)

**Effect sketch** [verbatim term, Ch.16] — a small, hand-drawn diagram. Pick a variable, parameter, or return value you're about to change, draw arrows to every other variable, return, or output it influences. Quick pencil sketches, not formal UML.

**Effect reasoning** [verbatim term, Ch.16] — the broader practice of asking, before any change: *what can this change affect?* The sketch is the artifact; the reasoning is the discipline.

Connect to test-writing: write characterization tests for the **effects** on the sketch, not for the whole class.

These sketches are **disposable thinking aids**, not deliverables. Draw, reason, change, throw away.

---

## §9 Scratch Refactoring (WELC Ch.16+)

**Scratch refactoring** [verbatim term, WELC] — a *learning* technique, not a delivery technique. Check out the code, refactor aggressively without tests, *purely to understand it*, then **throw the refactoring away** (`git reset --hard` or equivalent) and go back to the original to do the real (tested) refactoring. [paraphrase, WELC]

The danger Feathers names: being seduced into keeping the scratch refactoring because it looks clean.

---

## §10 Lean on the Compiler (WELC, recurring)

**Lean on the compiler** [verbatim term, WELC] — change a name, signature, or type so everything depending on it produces a compile error. The compiler has just generated, for free, an exhaustive list of every place affected. [paraphrase]

Limit Feathers names: works in Java/C++/C#; in dynamic languages (Ruby, Python, JavaScript) you don't get this affordance — fall back to grep + tests + runtime exercise.

---

## §11 The Carrying-Cost of Code (CCC essay)

> *"Code is inventory. It is something that we have to maintain, version, recompile and often re-test. If we have more code than we need, we are going to be doing more of all of those things than we need."* — Feathers, "The Carrying-Cost of Code," michaelfeathers.silvrback.com [verbatim]

Lean framing: code is inventory; every line is a recurring cost (comprehension, maintenance, security surface, build time). Lean's discipline of minimizing inventory should apply to source. The goal isn't to write more code well, it's to keep less code working.

---

## §12 Bob Martin's Foreword (WELC, R.C. Martin Series)

> *"The chapters in this book are written by my friend Michael Feathers. I've known Michael for six or seven years now... his depth of knowledge about software, and how to manage it, is profound."* — Bob Martin, Foreword to WELC [verbatim]

> *"This is a book of *ware*. It's a book about the way to do something. It's a deeply pragmatic book, written by a deeply pragmatic man."* — Bob Martin, Foreword to WELC [verbatim]

Foreword positions WELC in the **R.C. Martin Series** at Prentice Hall — the same series that hosted Bob's *Agile Software Development* and *Clean Code*. Feathers's Object Mentor years (early-to-mid 2000s) are the production context.

---

## §13 The "I Need to Make a Change" Template (voice cadence)

Every Part II chapter follows the same five-beat structure. This is the load-bearing voice signature.

1. **Situation** — short, conversational, second-person opening. *"You're looking at a class…"* / *"Suppose you have to add a new feature to…"*
2. **Reasoning** — why the obvious move is dangerous, what effects propagate, what dependencies block testing. Effect sketches and seam-finding live here.
3. **Mechanics** — a numbered procedure. Terse, imperative, language-agnostic. Steps small and verifiable.
4. **Example** — a code listing in Java or C++ (occasionally C), walked line by line.
5. **Summary / cautions** — one-paragraph recap. Sometimes a "this technique has the following downside" note. **No triumphalism.**

The cadence is **patient, second-person, mechanic-not-architect**. Feathers writes like a senior engineer pair-programming with you, not like a lecturer.
