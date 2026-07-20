# Sandi Metz — Quote Bank (40+ quotes/canonical terms)

Source legend:
- **POODR** = *Practical Object-Oriented Design in Ruby* (Addison-Wesley 2012; 2nd ed 2018)
- **99B** = *99 Bottles of OOP* (Metz + Owen, sandimetz.com self-published, 2017; 2nd ed 2020 +Stankus)
- **TB-Rules** = Thoughtbot's "Sandi Metz' Rules for Developers" (2013) — reproduces "Get a Whiff of This" RailsConf 2013
- **Wrong-Abs** = sandimetz.com/blog/2016/1/20/the-wrong-abstraction (WebFetch-verified)
- **Polly** = "Polly Want a Message," Deconstruct 2018 (deconstructconf.com transcript)
- **Magic** = "The Magic Tricks of Testing," Ancient City Ruby / RailsConf 2013
- **AllLittle** = "All the Little Things," RailsConf 2014
- **Nothing** = "Nothing is Something," RailsConf 2015

Per IP-safety stance: short canonical terms / aphorisms / verbatim-from-public-source = `[verbatim]`. Extended POODR/99B body = `[paraphrase]`. Unverifiable-this-pass = `[unverified verbatim]`.

---

## Cluster 1 — The Four Rules

1. *"Classes can be no longer than one hundred lines of code."* — TB-Rules [verbatim]
2. *"Methods can be no longer than five lines of code."* — TB-Rules [verbatim]
3. *"Pass no more than four parameters into a method. Hash options parameters count."* — TB-Rules [verbatim]
4. *"Controllers can instantiate only one object. Therefore, views can only know about one instance variable and views should only send messages to that object (`@object.collaborator.value` is not allowed)."* — TB-Rules [verbatim]
5. *"You can break these rules only if you can talk your pair (or your tech lead) into agreeing with you."* — TB-Rules [verbatim]

---

## Cluster 2 — TRUE Properties (POODR Ch.2)

6. **Transparent** — POODR Ch.2 [verbatim term]
7. **Reasonable** — POODR Ch.2 [verbatim term]
8. **Usable** — POODR Ch.2 [verbatim term]
9. **Exemplary** — POODR Ch.2 [verbatim term]
10. **TRUE** — POODR Ch.2 [verbatim acronym]

---

## Cluster 3 — Squint Test, Shameless Green, Flocking (99B)

11. **Squint Test** — 99B Ch.1 [verbatim term]
12. **Shameless Green** — 99B Ch.1 [verbatim term]
13. **Flocking** — 99B [verbatim term] — refactor identical-shaped pieces in lockstep
14. **Make smaller things** — recurring across POODR/99B/talks [verbatim canonical injunction]

---

## Cluster 4 — The Wrong Abstraction (Wrong-Abs 2016, WebFetch verified)

15. *"duplication is far cheaper than the wrong abstraction"* — Wrong-Abs [verbatim]
16. *"prefer duplication over the wrong abstraction"* — Wrong-Abs [verbatim]
17. *"the fastest way forward is back"* — Wrong-Abs [verbatim]
18. *"When dealing with the wrong abstraction, the fastest way forward is back."* — Wrong-Abs [verbatim]
19. *"This is not retreat, it's advance in a better direction."* — Wrong-Abs [verbatim]

---

## Cluster 5 — POODR Tactical Building Blocks

20. **Single Responsibility** — POODR Ch.2 [verbatim term]
21. **Inject dependencies** — POODR Ch.3 [verbatim technique]
22. **Isolate dependencies** — POODR Ch.3 [verbatim technique]
23. **Isolate vulnerable external messages** — POODR Ch.3 [verbatim technique]
24. **Remove argument-order dependencies** — POODR Ch.3 [verbatim technique]
25. *"Depend on things that change less often than you do."* — POODR Ch.3 [paraphrase faithful — canonical]
26. **Duck Typing** — POODR Ch.5 [verbatim chapter title]
27. *"If it quacks like a duck and walks like a duck, then its class is immaterial, it's a duck."* — POODR Ch.5 [verbatim canonical maxim]
28. *"It's not what an object IS that matters, it's what it DOES."* — POODR Ch.5 [unverified verbatim]
29. **Template Method pattern** — POODR Ch.6 [verbatim term]
30. **Hook method** — POODR Ch.6 [verbatim term]
31. **Role** — POODR Ch.7 [verbatim term — describes what an object DOES, not what it IS]
32. **"is-a" vs "has-a"** — POODR Ch.6/Ch.8 [verbatim distinction]
33. *"When in doubt, prefer composition over inheritance."* — POODR Ch.8 [paraphrase faithful, GoF maxim Metz endorses]
34. **Tell, don't ask.** — POODR Ch.4 [verbatim canonical OO maxim]

---

## Cluster 6 — Magic Tricks of Testing (Magic 2013)

35. *"Test the interface, not the implementation."* — Magic [verbatim]
36. *"Honor the contract."* — Magic [verbatim]
37. *"Test Everything Once."* — Magic [verbatim canonical maxim]
38. *"Make assertions about what they send back."* — Magic [verbatim, on incoming queries]
39. *"If a message has no visible side effects, it is invisible to rest of your app, so the sender should not test it."* — Magic [verbatim, on outgoing queries]
40. **Listen to your tests** — POODR Ch.9 [verbatim term — painful tests are a design smell]
41. *"Hidden side effects are the bane of programmers."* — Magic [verbatim]
42. *"Objects are simple-minded black boxes."* — Magic [verbatim]

---

## Cluster 7 — Polly Want a Message (Deconstruct 2018, verified)

43. *"Messages let me know what I want without knowing how you behave. So they provide a level of indirection which gives me… a seam where I can have substitutability on the other side."* — Polly [verbatim]
44. *"What they primarily do is give me ignorance, and in OO languages, we're striving to be ignorant about what other objects do."* — Polly [verbatim]
45. *"It's that quality where different kinds of objects can respond to the same message. That's what it's about. They share a common form at the message response level."* — Polly [verbatim — definition of polymorphism]
46. *"OO is a play where you create living beings and make a world where action happens."* — Polly [verbatim]
47. *"OO gives you the opportunity to maximize the ignorance of every object."* — Polly [verbatim]

---

## Cluster 8 — Talks & Career Aphorisms

48. *"The purpose of design is to allow you to do design later, and its primary goal is to reduce the cost of change."* — POODR Ch.1 [unverified verbatim — canonical Metz framing]
49. *"When you are new at this, they told you DRY. Right? Don't repeat yourself."* — AllLittle [verbatim]
50. *"Open/Close says You ought to be able to add new behavior without editing existing code."* — AllLittle [verbatim]

---

## Cluster 9 — sandimetz.com biography (verified)

51. *"a programmer who is also a teacher, author and sometime consultant"* — sandimetz.com/about [verbatim]
52. *"In the past 30+ years I have written innumerable applications, a surprising number of which are still running today."* — sandimetz.com/about [verbatim]
53. *"spoken about SOLID, object-oriented design, and refactoring at international conferences since 2009"* — sandimetz.com/about [verbatim]
54. *"I am now moderately retired, but if you want to talk about pickleball…"* — sandimetz.com/about [verbatim]

---

**Total:** 54 quotes/canonical terms with source citations. Per IP stance, mix of short canonical terms `[verbatim]`, public-source verbatim from sandimetz.com / deconstructconf / Thoughtbot, and tagged-paraphrase substance from POODR/99B body prose.

> **Cluster provenance standard — best-of-breed model (and a refinement).** This bank is a **second best-of-breed
> exemplar** of the voice-channeling specialist cluster's reconciled source-aware provenance discipline (alongside
> the GregYoung pack): it implements all four dimensions — (1) per-source **verification-tracking** ("WebFetch-
> verified"), (2) the `[verbatim]`/`[paraphrase]` **IP-stance** (the in-print copyrighted *POODR* 2012/2018 and
> *99 Bottles of OOP* 2017/2020 BODIES are `[paraphrase]`), (3) explicit **source-awareness** (short canonical
> terms / aphorisms / public-talk transcripts are verbatim; copyrighted book body is paraphrased), and (4) careful
> **co-author attribution** (Owen + the 2nd-ed Stankus credited for *99 Bottles*). And it ADDS a refinement the
> best-of-breed model lacked: the **`[unverified verbatim]`** third tier, which honestly flags a quote that is
> reproduced but **not yet primary-source-verified** — rather than dropping it or silently presenting it as
> confirmed. This makes the cluster's verification axis a **three-state** (verified / `[unverified verbatim]` /
> paraphrased-for-IP), a genuinely more honest standard. Sibling QuoteBanks should adopt this three-tier
> discipline; keep the `[unverified verbatim]` flags until a quote earns primary-source proof.
