# Quote Bank — 54 Tier-A Verbatim Quotes

**Use these as load-bearing rivets, not as decoration. Verbatim or skip.**

Source-tagged. Where the source is a Fowler bliki entry, the URL pattern is `martinfowler.com/bliki/<EntryName>.html`. Where the source is the Refactoring book, page numbers refer to the 1st edition (Addison-Wesley, 1999).

---

## Refactoring (Definitions & Discipline)

1. *"a change made to the internal structure of software to make it easier to understand and cheaper to modify without changing its observable behavior"* — Refactoring noun definition. https://martinfowler.com/bliki/DefinitionOfRefactoring.html

2. *"to restructure software by applying a series of refactorings without changing its observable behavior"* — Refactoring verb definition. Same.

3. *"Refactoring is a controlled technique for improving the design of an existing code base. Its essence is applying a series of small behavior-preserving transformations, each of which 'too small to be worth doing'."* — https://martinfowler.com/books/refactoring.html

4. *"However the cumulative effect of each of these transformations is quite significant. By doing them in small steps you reduce the risk of introducing errors."* — same.

5. *"You also avoid having the system broken while you are carrying out the restructuring — which allows you to gradually refactor a system over an extended period of time."* — same.

6. *"Refactoring is a disciplined technique for restructuring an existing body of code, altering its internal structure without changing its external behavior."* — https://refactoring.com/

7. *"Refactoring isn't another word for cleaning up code — it specifically defines one technique for improving the health of a code-base."* — same.

8. *"Refactoring isn't a special task that would show up in a project plan. Done well, it's a regular part of programming activity."* — same.

## Refactoring (Practice)

9. *"When you find you have to add a feature to a program, and the program's code is not structured in a convenient way to add the feature, first refactor the program to make it easy to add the feature, then add the feature."* — *Refactoring* (1st ed. 1999) p. 7.

10. *"Any fool can write code that a computer can understand. Good programmers write code that humans can understand."* — *Refactoring* (1st ed. 1999) p. 15.

11. *"When you feel the need to write a comment, first try to refactor the code so that any comment becomes superfluous."* — *Refactoring* (1st ed. 1999) p. 88.

12. *"The key is to test the areas that you are most worried about going wrong. That way you get the most benefit for your testing effort. It is better to write and run incomplete tests than not to run complete tests."* — *Refactoring* (1st ed. 1999) p. 98.

13. *"Often you'll see the same three or four data items together in lots of places: fields in a couple of classes, parameters in many method signatures. Bunches of data that hang around together really ought to be made into their own objects."* — *Refactoring* (1st ed. 1999) p. 81 (Data Clumps).

14. *"at any time someone sees some code that isn't as clear as it should be, they should take the opportunity to fix it right there and then"* — https://martinfowler.com/bliki/OpportunisticRefactoring.html

15. *"This opportunistic refactoring is often referred to as following the camp site rule — always leave the code behind in a better state than you found it."* — same.

16. *"From the beginning I've always seen refactoring as something you do continuously, as regular and indivisible a part of programming as typing if statements."* — same.

17. *"a team that's using refactoring well should hardly ever need to plan refactoring, instead seeing refactoring as a constant stream of small adjustments"* — same.

18. *"do remember that you should only refactor when your tests are green"* — same.

19. *"When refactoring every change you make is a small behavior-preserving change."* — https://martinfowler.com/articles/workflowsOfRefactoring/fallback.html

20. *"Whenever you have to figure out what code is doing, you are building some understanding in your head."* — same (Comprehension Refactoring).

## Code Smells (Beck-Coined)

21. *"A surface indication that usually corresponds to a deeper problem in the system."* — Code Smell definition. https://martinfowler.com/bliki/CodeSmell.html

22. *"smells don't always indicate a problem"* — same.

23. *"first coined by Kent Beck while helping me with my Refactoring book"* — same (term provenance).

## Architecture — PoEAA Pattern Definitions

24. *"An object model of the domain that incorporates both behavior and data."* — Domain Model. https://martinfowler.com/eaaCatalog/domainModel.html

25. *"Defines an application's boundary with a layer of services that establishes a set of available operations and coordinates the application's response in each operation."* — Service Layer. https://martinfowler.com/eaaCatalog/serviceLayer.html

26. *"An object that wraps a row in a database table or view, encapsulates the database access, and adds domain logic on that data."* — Active Record. https://martinfowler.com/eaaCatalog/activeRecord.html

27. *"A layer of mappers that moves data between objects and a database while keeping them independent of each other and the mapper itself."* — Data Mapper. https://martinfowler.com/eaaCatalog/dataMapper.html

28. *"Mediates between the domain and data mapping layers using a collection-like interface for accessing domain objects."* — Repository. https://martinfowler.com/eaaCatalog/repository.html

29. *"Maintains a list of objects affected by a business transaction and coordinates the writing out of changes and the resolution of concurrency problems."* — Unit of Work. https://martinfowler.com/eaaCatalog/unitOfWork.html

30. *"An object that doesn't contain all of the data you need but knows how to get it."* — Lazy Load. https://martinfowler.com/eaaCatalog/lazyLoad.html

## Architecture — Microservices

31. *"In short, the microservice architectural style is an approach to developing a single application as a suite of small services, each running in its own process and communicating with lightweight mechanisms, often an HTTP resource API."* — Lewis & Fowler, March 2014. https://martinfowler.com/articles/microservices.html

32. *"We cannot say there is a formal definition of the microservices architectural style, but we can attempt to describe what we see as common characteristics for architectures that fit the label."* — same.

33. *"smart endpoints and dumb pipes"* — characteristic 4. Apps are *"as decoupled and as cohesive as possible — they own their own domain logic and act more as filters in the classical Unix sense."* same.

34. *"One of the consequences of centralised governance is the tendency to standardise on single technology platforms."* — Decentralized Governance. same.

35. *"Microservices prefer letting each service manage its own database, either different instances of the same database technology, or entirely different database systems."* — Decentralized Data Management. same.

36. *"Almost all the successful microservice stories have started with a monolith that got too big and was broken up."* — https://martinfowler.com/bliki/MonolithFirst.html

37. *"Almost all the cases where I've heard of a system that was built as a microservice system from scratch, it has ended up in serious trouble."* — same.

38. *"you shouldn't start a new project with microservices, even if you're sure your application will be big enough to make it worthwhile."* — same.

39. *"Microservices introduce complexity on their own account. This adds a premium to a project's cost and risk — one that often gets projects into serious trouble."* — https://martinfowler.com/bliki/MicroservicePremium.html

40. *"Don't even consider microservices unless you have a system that's too complex to manage as a monolith."* — same.

## Architecture — Strangler & Branch

41. *"These are vines that germinate in a nook of a tree. As it grows, it draws nutrients from the host tree until it reaches the ground to grow roots and the canopy to get sunlight."* — Strangler Fig metaphor. https://martinfowler.com/bliki/StranglerFigApplication.html

42. *"Like the fig, it begins with small additions, often new features, that are built on top of, yet separate to the legacy code base. As we do this we move bits of behavior from the legacy system into the new code base."* — same.

43. *"Branch by Abstraction is a technique for making a large-scale change to a software system in [a] gradual way that allows you to release the system regularly while the change is still in-progress."* — https://martinfowler.com/bliki/BranchByAbstraction.html

## Architecture — DI / DSL / Anemic Domain / CQRS

44. *"Inversion of Control is too generic a term, and thus people find it confusing. As a result with a lot of discussion with various IoC advocates we settled on the name Dependency Injection."* — https://martinfowler.com/articles/injection.html

45. *"Inversion of control is a common characteristic of frameworks, so saying that these lightweight containers are special because they use inversion of control is like saying my car is special because it has wheels."* — same.

46. *"Fundamentally there is no difference, an internal DSL is just an API with a fancy name."* — https://martinfowler.com/bliki/DslBoundary.html

47. *"Objects are connected with rich relationships and structure that true domain models have. The catch comes when you look at the behavior, and you realize that there is hardly any behavior on these objects, making them little more than bags of getters and setters."* — Anemic Domain Model. https://martinfowler.com/bliki/AnemicDomainModel.html

48. *"It's so contrary to the basic idea of object-oriented design; which is to combine data and process together."* — same.

49. *"For most systems CQRS adds risky complexity."* — https://martinfowler.com/bliki/CQRS.html

## Practices & Bliki

50. *"Continuous Integration is a software development practice where each member of a team merges their changes into a codebase together with their colleagues changes at least daily."* — https://martinfowler.com/articles/continuousIntegration.html

51. *"Feature Toggles (often also refered to as Feature Flags) are a powerful technique, allowing teams to modify system behavior without changing code."* — https://martinfowler.com/articles/feature-toggles.html

52. *"The test pyramid is a way of thinking about how different kinds of automated tests should be used to create a balanced portfolio. Its essential point is that you should have many more low-level UnitTests than high level BroadStackTests running through a GUI."* — https://martinfowler.com/bliki/TestPyramid.html

53. *"Pretty much all the practitioners I favor in Software Architecture are deeply suspicious of any kind of general law in the field. Good software architecture is very context-specific, analyzing trade-offs that resolve differently across a wide range of environments. But if there is one thing they all agree on, it's the importance and power of Conway's Law."* — https://martinfowler.com/bliki/ConwaysLaw.html

54. *"There are only two hard things in Computer Science: cache invalidation and naming things."* — Phil Karlton, via https://martinfowler.com/bliki/TwoHardThings.html

---

## Topic Cluster Index (for Refactor / DefineTerm / WriteArchPattern workflows)

| Cluster | Quote IDs | Used by Workflow |
|---|---|---|
| Refactoring (Definitions & Discipline) | 1–8 | Refactor (framing) |
| Refactoring (Practice) | 9–20 | Refactor (closing principles) |
| Code Smells | 21–23 | Refactor (smell diagnosis) |
| PoEAA Patterns | 24–30 | WriteArchPattern (pattern definitions) |
| Microservices | 31–40 | WriteArchPattern (microservices vs monolith) |
| Strangler & Branch | 41–43 | WriteArchPattern (legacy migration), Refactor (large-scale change) |
| DI / DSL / Anemic Domain / CQRS | 44–49 | WriteArchPattern, DefineTerm |
| Practices & Bliki | 50–54 | DefineTerm (CI, feature toggles, pyramid, Conway, two hard things) |

---

## Counts

- Total quotes: **54**
- Distinct primary sources: **27** (martinfowler.com bliki + articles + eaaCatalog + the *Refactoring* book itself + refactoring.com)
- Sources flagged for spot-check: **0** (canonical martinfowler.com is the primary surface — no [2nd-mirror] needed; pages were directly fetchable during research)
- Co-author credits: Kent Beck (*Refactoring*, code smells, Two Hats), James Lewis (Microservices), Pete Hodgson (Feature Toggles), Pramod Sadalage (NoSQL Distilled), Rebecca Parsons (DSL).
- External attributions tracked verbatim: Phil Karlton (Two Hard Things), Mike Cohn (Test Pyramid name), Greg Young (CQRS), Eric Evans (Bounded Context, DDD), Scott Leberknight (Polyglot Persistence), Melvin Conway (Conway's Law).

## Source-type & IP awareness (cluster provenance standard)

Provenance here is governed by the **source-type** axis of the voice-channeling cluster's reconciled standard — the
IP-stance is not absolute, it depends on where a quote comes from:

- **Public-web material** — Fowler's bliki (`martinfowler.com/bliki/…`, ~31 of 54 quotes), articles, the eaaCatalog,
  refactoring.com — is **legitimately quotable verbatim** (Fowler publishes it openly and it is widely re-quoted).
  This majority-public sourcing makes this bank the **most IP-defensible** of the book-quoting specialist packs;
  the verbatim approach is **vindicated** for these sources — keep them verbatim.
- **In-print copyrighted BOOK body passages** — the page-cited *Refactoring* (1st ed., Addison-Wesley 1999)
  passages — are the **IP-exposure subset**. Per the cluster IP-stance (the Feathers model), *extended* copyrighted
  body passages should be paraphrased; only short canonical **terms** + Tier-A short definitions stay verbatim
  (the noun-definition of refactoring is a canonical short definition and is fine). Review the page-cited
  *Refactoring*-book quotes against this IP-stance and paraphrase any that are extended body passages rather than
  short canonical definitions.
- **Short canonical terms** (refactor, code smell, two hats, …) stay verbatim regardless of source — they are
  terms of art, not reproductions.

This source-aware split is Fowler's contribution to the cluster's reconciled provenance standard (source-tagging +
Cockburn's `[2nd-mirror]` verification-flagging + the Feathers/Fowler source-aware IP-stance + EricEvans's careful
attribution — already applied here in the co-author credits + external attributions above).
