# Sandi Metz — Diagnostic Lookup (anti-pattern catalog)

Letter prefix:
- **RULE-** Four-Rules anti-patterns
- **ABS-** Wrong-Abstraction anti-patterns
- **WEX-** Worked-Example pedagogy anti-patterns
- **TST-** Test-design anti-patterns (Magic Tricks of Testing)

Diagnose ONE primary anti-pattern per turn. Cross-reference Principles.md / QuoteBank.md.

---

## RULE — Four-Rules anti-patterns

### RULE-1 The 200-Line God Class
Class has 200+ lines. Clearly violates Rule 1 (≤100 LOC).
**Diagnosis:** Rule 1 is being broken without exception protocol.
**Move:** Apply the description test from POODR Ch.2 — try to describe the class in one sentence. Hit "and"? Extract along the seam. Hit "or"? The class has unrelated responsibilities; split aggressively. The 100-line limit isn't aesthetic — it's a forcing function for *more, smaller things*.

### RULE-2 The 30-Line Method
Method exceeds 5 lines, often with nested conditionals or extracted helpers that should be public methods on extracted classes.
**Diagnosis:** Rule 2 is being broken. Most 30-line methods are 6 small methods waiting to come out.
**Move:** Look for the shape changes (Squint Test). Extract Method around each shape transition. Test should stay green between each extraction.

### RULE-3 The Hash-Options Loophole
Method takes a hash of options to evade Rule 3's 4-parameter limit.
**Diagnosis:** *"Hash options parameters count."* — TB-Rules [verbatim]. Metz closed this loophole explicitly.
**Move:** Each option is probably a real concept. Either some belong on a value object ("data clump"), or the method is doing too many things and should split. Don't bury parameters in a hash to satisfy a counter — that's letter-of-rule violation.

### RULE-4 Controller Instantiates Many Objects
Controller action `new`s up 3-5 objects, passes all of them to the view as instance variables.
**Diagnosis:** Rule 4 is broken. Views shouldn't reach into multiple object graphs.
**Move:** Introduce a presenter or facade — one object the controller instantiates, that knows how to present everything the view needs. View talks to one thing. The presenter handles the message-passing internally.

### RULE-5 Solitary Rule-Breaking (No Pair Conversation)
Code breaks the rules without the pairing exception conversation. Often a solo developer or a code review that says "yeah it's long but it's ok."
**Diagnosis:** The rules are deliberately too strict to follow blindly — but the *exception protocol is the actual quality gate*. Breaking a rule unilaterally is collapsing into Pragmatic's tip-listing register, where rules float free of context.
**Move:** Either talk a pair through it (and capture the reasoning in code review / PR description), or refactor to pass. Both are acceptable; silent rule-breaking is not.

---

## ABS — Wrong-Abstraction anti-patterns

### ABS-1 The Conditional Snowball
Abstraction was extracted from 2 callers. New requirement made it not-quite-fit, so a parameter + conditional was added. Now there are 5 parameters and 4 conditional branches; the abstraction does no single thing well.
**Diagnosis:** *"duplication is far cheaper than the wrong abstraction"* — Wrong-Abs [verbatim]. The 8-step decay is in motion: Programmer A extracted, time passed, Programmer B added a parameter and conditional, repeat.
**Move:** Rebound by going back. Re-introduce duplication: inline the abstracted code into every caller. Use parameters/conditionals at the call sites to drive which inlined code runs. Delete the unneeded bits in each caller. **The correct abstraction can only be discovered fresh.**

### ABS-2 Premature DRY
Two pieces of code look identical but represent different concepts. Programmer extracts a shared helper. New requirement reveals they were never *really* the same.
**Diagnosis:** Rule of Three was violated. Two repetitions don't justify abstraction — they justify staying in **Shameless Green**. Wait until the third (or fourth) appearance to see what *actually* varies.
**Move:** If the abstraction is fresh and only 2 callers exist, inline back to duplication and wait. If it's old and entangled (5+ callers), apply the Wrong-Abstraction rebound recipe.

### ABS-3 Abstraction-First Coding
Programmer reads the requirement and immediately starts designing the class hierarchy or extracting common interfaces — before any working code exists.
**Diagnosis:** Skipping Shameless Green. The "right" abstraction emerges from observed duplication, not from up-front design.
**Move:** Write the simplest, ugliest, most duplicative code that passes the tests. Stay there. Run the Squint Test. Name the smells visually. *Then* refactor in small steps, never imposing an abstraction the code didn't reveal.

### ABS-4 The Eight-Step Decay (You Inherit This Code)
You're staring at a 200-line method with 8 boolean parameters and an if-tree. Every flag was added by someone who needed *almost* the same behavior.
**Diagnosis:** Step 8 of the decay narrative — *"You inherit this code."* — Wrong-Abs [verbatim].
**Move:** Apply the rebound recipe. Inline back to duplication. The code will get bigger before it gets smaller — and that's correct. *"the fastest way forward is back."* — Wrong-Abs [verbatim]

---

## WEX — Worked-Example pedagogy anti-patterns

### WEX-1 Aphorism Without Context
Programmer quotes "duplication is cheaper than the wrong abstraction" or "make smaller things" without grounding in the specific code at hand.
**Diagnosis:** Aphorism free-floating. Metz's lines live *inside* a worked example — bicycle, 99 Bottles, Gilded Rose. Ungrounded aphorism is collapsing into Pragmatic's tip-listing register.
**Move:** Drop the conversation back into the *specific code* — what method, what duplication, what proposed extraction. The principle only applies when the example is in front of you.

### WEX-2 Skipping Shameless Green
Programmer wants to learn 99 Bottles by reading the final refactored solution, then applying the patterns to their code.
**Diagnosis:** Shortcut past the worked example. *The teaching is in the sequence*: tests → green → squint → name → small steps. Reading the destination doesn't teach the path.
**Move:** Run the kata yourself. Write the song-output tests. Get to Shameless Green. Squint. Name. Step. Run the tests after each step. The pedagogy IS the technique.

### WEX-3 Big-Bang Refactor
Programmer sees the wrong abstraction and proposes a 500-line PR to fix it in one shot.
**Diagnosis:** Violates the small-steps rule. *"Take the smallest possible refactoring step. Tests green between each. Never make a leap."* — 99B [paraphrase faithful].
**Move:** Stop. Identify ONE seam. Apply ONE Fowler-named refactoring (Extract Method, Move Method, Rename, Replace Conditional with Polymorphism). Run tests green. Commit. Repeat. The PR shrinks dramatically — and reviewers can actually follow what changed.

### WEX-4 Imposed Abstraction (Design From Altitude)
Programmer imposes an abstraction based on principle ("we should use the strategy pattern here") rather than letting it emerge from observed code shape.
**Diagnosis:** Abstraction-first. Metz's pedagogy is the inverse: code first, observe shape, *then* name the pattern that emerged.
**Move:** Show me the duplication that justifies this. If you can't point to 3+ identical-shaped pieces of code, you don't have an abstraction yet — you have a guess. Stay shamelessly green.

---

## TST — Test-design anti-patterns (Magic Tricks of Testing)

### TST-1 Testing Outgoing Queries
Test asserts what a collaborator's query method returned to the system under test.
**Diagnosis:** *"If a message has no visible side effects, it is invisible to rest of your app, so the sender should not test it."* — Magic [verbatim]. The collaborator's incoming-query test covers it.
**Move:** Delete this assertion. The behavior is tested at the collaborator's incoming side.

### TST-2 Testing Sent-to-Self / Private Methods
Test reaches into a private method and asserts on it directly.
**Diagnosis:** *"If the test for gear inches is correct, this test will be redundant."* — Magic [verbatim]. Private methods are covered by the public-interface tests that exercise them.
**Move:** Delete the private-method test. If you can't reach the private behavior through public interface, the design is wrong (extract the private method to its own class with its own public interface).

### TST-3 Mocking Incoming Messages
Test mocks the system under test's own methods rather than asserting on real return values.
**Diagnosis:** Backwards. Mocks are for *outgoing commands* to collaborators, not for the SUT itself.
**Move:** Test the real return value. Use mocks only at the outgoing-command boundary.

### TST-4 Painful Tests Treated as Testing Problem
Tests are hard to write, so the developer adds testing helpers, mocks more, fights the test framework.
**Diagnosis:** *"Listen to your tests."* — POODR Ch.9 [verbatim term]. Painful tests are a *design* signal. The SUT has too many dependencies, knows too much about collaborators, or has tangled responsibility.
**Move:** Don't fix the test — fix the design. Extract a collaborator. Inject a dependency. Listen to what the test pain is telling you about the object's shape.
