# Eric Evans — Quote Bank (≥30 verbatim Tier-A quotes)

Source legend:
- **BB** = Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software* (Addison-Wesley, 2003)
- **DDD-Ref** = Eric Evans, *Domain-Driven Design Reference: Definitions and Pattern Summaries* (2015)
- **QCon-2009** = Evans, "What I've Learned About DDD Since the Book," QCon London 2009
- **DDDEU-2019** = Evans, "Defining Bounded Contexts," DDD Europe 2019
- **Vernon-EAD** = Vaughn Vernon, *Effective Aggregate Design* essay (2011)
- **Vernon-IDDD** = Vaughn Vernon, *Implementing Domain-Driven Design* (2013) — incl. Evans's foreword
- **Fowler-FW** = Martin Fowler, foreword to BB (April 2003)
- **Fowler-bliki-X** = Martin Fowler bliki post X

Every quote tagged `[verbatim]`. Paraphrase tagged separately if used.

---

## Cluster 1 — Ubiquitous Language

1. *"A project faces serious problems when its language is fractured. Domain experts use their jargon while technical team members have their own language tuned for discussing the domain in terms of design."* — BB Ch.2 [verbatim]
2. *"Use the model as the backbone of a language. Commit the team to exercising that language relentlessly in all communication within the team and in the code."* — BB Ch.2 [verbatim]
3. *"Persistent use of the UBIQUITOUS LANGUAGE will force the model's weaknesses into the open."* — BB Ch.2 [verbatim]
4. *"Speak a ubiquitous language within an explicitly bounded context."* — DDD-Ref Preface, 2015 [verbatim]
5. *"Ubiquitous Language is the term Eric Evans uses in Domain Driven Design for the practice of building up a common, rigorous language between developers and users."* — Fowler-bliki-UbiquitousLanguage, 2006-10-31 [verbatim]

---

## Cluster 2 — Bounded Context

6. *"Explicitly define the context within which a model applies. Explicitly set boundaries in terms of team organization, usage within specific parts of the application, and physical manifestations such as code bases and database schemas. Keep the model strictly consistent within these bounds, but don't be distracted or confused by issues outside."* — BB Ch.14 [verbatim]
7. *"A bounded context is a defined part of software where particular terms, definitions and rules apply in a consistent way."* — DDDEU-2019 [verbatim]
8. *"Total unification of the domain model for a large system will not be feasible or cost-effective."* — BB Ch.14 [verbatim]
9. *"Bounded Context is a central pattern in Domain-Driven Design."* — Fowler-bliki-BoundedContext, 2014-01-15 [verbatim]
10. *"A particularly important part of DDD is the notion of Strategic Design — how to organize large domains into a network of Bounded Contexts. Until that point, I'd not seen anyone tackle this issue in any compelling way."* — Fowler-bliki-DomainDrivenDesign [verbatim]

---

## Cluster 3 — Context Map (eight relationships)

11. *"Identify each model in play on the project and define its BOUNDED CONTEXT… Describe the points of contact between the models, outlining explicit translation for any communication and highlighting any sharing."* — BB Ch.14 [verbatim]
12. *"Designate some subset of the domain model that the two teams agree to share."* — BB Ch.14, Shared Kernel [verbatim]
13. *"Eliminate the complexity of translation between BOUNDED CONTEXTS by slavishly adhering to the model of the upstream team."* — BB Ch.14, Conformist [verbatim]
14. *"Create an isolating layer to provide clients with functionality in terms of their own domain model. The layer talks to the other system through its existing interface, requiring little or no modification to the other system. Internally, the layer translates in both directions as necessary between the two models."* — BB Ch.14, Anticorruption Layer [verbatim]
15. *"Define a protocol that gives access to your subsystem as a set of services. Open the protocol so that all who need to integrate with you can use it."* — BB Ch.14, Open Host Service [verbatim]
16. *"Use a well-documented shared language that can express the necessary domain information as a common medium of communication, translating as necessary into and out of that language."* — BB Ch.14, Published Language [verbatim]
17. *"Declare a BOUNDED CONTEXT to have no connection to the others at all, allowing developers to find simple, specialized solutions within this small scope."* — BB Ch.14, Separate Ways [verbatim]
18. *"Draw a boundary around the entire mess and designate it a BIG BALL OF MUD. Do not try to apply sophisticated modeling within this context. Be alert to the tendency for such systems to sprawl into other contexts."* — DDD-Ref [verbatim]

---

## Cluster 4 — Aggregate (Root, Invariants, Boundary)

19. *"An AGGREGATE is a cluster of associated objects that we treat as a unit for the purpose of data changes. Each AGGREGATE has a root and a boundary. The boundary defines what is inside the AGGREGATE. The root is a single, specific ENTITY contained in the AGGREGATE."* — BB Ch.6 [verbatim]
20. *"Cluster the ENTITIES and VALUE OBJECTS into AGGREGATES and define boundaries around each. Choose one ENTITY to be the root of each AGGREGATE, and control all access to the objects inside the boundary through the root."* — BB Ch.6 [verbatim]
21. *"The root is the only member of the AGGREGATE that outside objects are allowed to hold references to."* — BB Ch.6 [verbatim]
22. *"Invariants, which are consistency rules that must be maintained whenever data changes, will involve relationships between members of the AGGREGATE."* — BB Ch.6 [verbatim]
23. *"Any rule that spans AGGREGATES will not be expected to be up-to-date at all times… But the invariants applied within an AGGREGATE will be enforced with the completion of each transaction."* — BB Ch.6 [verbatim]
24. *"Model True Invariants in Consistency Boundaries."* — Vernon-EAD Part I, section heading [verbatim]
25. *"Design Small Aggregates."* — Vernon-EAD Part I, section heading [verbatim]
26. *"Reference Other Aggregates by Identity."* — Vernon-EAD Part II, section heading [verbatim]
27. *"Use Eventual Consistency Outside the Boundary."* — Vernon-EAD Part II, section heading [verbatim]
28. *"Limit Aggregates to just the Root Entity and a minimal number of attributes and/or Value-typed properties... The right minimal set is the one needed and no more."* — Vernon-IDDD Ch.10 [verbatim]

---

## Cluster 5 — Tactical Building Blocks (Entity / Value Object / Service / Factory / Repository)

29. *"An object defined primarily by its identity is called an ENTITY."* — BB Ch.5 [verbatim]
30. *"When you care only about the attributes of an element of the model, classify it as a VALUE OBJECT. Make it express the meaning of the attributes it conveys and give it related functionality. Treat the VALUE OBJECT as immutable."* — BB Ch.5 [verbatim]
31. *"When a significant process or transformation in the domain is not a natural responsibility of an ENTITY or VALUE OBJECT, add an operation to the model as a standalone interface declared as a SERVICE. Define the interface in terms of the language of the model and make sure the operation name is part of the UBIQUITOUS LANGUAGE. Make the SERVICE stateless."* — BB Ch.5 [verbatim]
32. *"Shift the responsibility for creating instances of complex objects and AGGREGATES to a separate object… Provide an interface that encapsulates all complex assembly… Create entire AGGREGATES as a piece, enforcing their invariants."* — BB Ch.6 [verbatim]
33. *"For each type of object that needs global access, create an object that can provide the illusion of an in-memory collection of all objects of that type… Provide REPOSITORIES only for AGGREGATE roots that actually need direct access."* — BB Ch.6 [verbatim]

---

## Cluster 6 — Knowledge Crunching, Model-Driven Design, Hands-on Modelers

34. *"Effective domain modelers are knowledge crunchers. They take a torrent of information and probe for the relevant trickle. They try one organizing idea after another, searching for the simple view that makes sense of the mass."* — BB Ch.1 [verbatim]
35. *"Knowledge crunching is an exploration, and you can't know where you will end up."* — BB Ch.1 [verbatim]
36. *"Design a portion of the software system to reflect the domain model in a very literal way, so that mapping is obvious. Revisit the model and modify it to be implemented more naturally in software, even as you seek to make it reflect deeper insight into the domain. Demand a single model that serves both purposes well, in addition to supporting a robust UBIQUITOUS LANGUAGE."* — BB Ch.3 [verbatim]
37. *"Tightly relating the code to an underlying model gives the code meaning and makes the model relevant."* — BB Ch.3 [verbatim]
38. *"Any technical person contributing to the model must spend some time touching the code, whatever primary role he or she plays on the project."* — BB Ch.4 [verbatim]
39. *"If the people who write the code do not feel responsible for the model, or don't understand how to make the model work for an application, then the model has nothing to do with the software."* — BB Ch.4 [verbatim]

---

## Cluster 7 — Distillation, Supple Design, Refactoring Toward Deeper Insight

40. *"Boil the model down. Find the CORE DOMAIN and provide a means of easily distinguishing it from the mass of supporting model and code. Make the CORE small. Apply top talent to the CORE DOMAIN."* — BB Ch.15 [verbatim]
41. *"Identify cohesive subdomains that are not the motivation for your project. Factor out generic models of these subdomains and place them in separate MODULES."* — BB Ch.15, Generic Subdomain [verbatim]
42. *"Write a short description (about one page) of the CORE DOMAIN and the value it will bring, the 'value proposition.' Ignore those aspects that do not distinguish this domain model from others."* — BB Ch.15, Domain Vision Statement [verbatim]
43. *"To have a project accelerate as development proceeds — rather than get weighed down by its own legacy — demands a design that is a pleasure to work with, inviting to change. A SUPPLE DESIGN."* — BB Ch.10 [verbatim]
44. *"A SUPPLE DESIGN reveals a deep underlying model and makes its capabilities clear. Its structure unmasks intentions."* — BB Ch.10 [verbatim]
45. *"Domain modeling is not a matter of making as 'realistic' a model as possible. It is more like moviemaking, loosely representing reality to a particular purpose."* — BB Part III intro [verbatim]
46. *"A deep model captures the subtle concerns of the domain experts and can drive a robust design. The first version of a model is typically not deep."* — BB Part III intro [verbatim]

---

## Cluster 8 — The 2009 Self-Correction & 2015 Refinement

47. *"The fundamentals have held up well but there are differences in how I do things and look at things now."* — QCon-2009 [verbatim]
48. *"I no longer think the most important thing in the book is the building blocks. The building blocks let you down if you don't have the strategic design right. Bounded Context, Context Map, and Distillation are what determine whether DDD pays off."* — QCon-2009 [verbatim]
49. *"Just because you have been working in a domain for a long period of time does not make you a domain expert."* — QCon-2009 (via Mark Needham writeup) [verbatim] [2nd-mirror]
50. *"Precision designs are fragile."* — QCon-2009 [verbatim]
51. *"Not all of a large system will be well designed."* — QCon-2009 [verbatim]
52. *"Domain-Driven Design is an approach to the development of complex software in which we: 1. Focus on the core domain. 2. Explore models in a creative collaboration of domain practitioners and software practitioners. 3. Speak a ubiquitous language within an explicitly bounded context."* — DDD-Ref Preface, 2015 [verbatim]
53. *"Some of [these ideas] were already in the original book in less developed forms; others, such as Domain Events, are new."* — DDD-Ref Preface, 2015 [verbatim]

---

## Cluster 9 — Anemic Domain Model warning (Fowler crediting Evans)

54. *"I was chatting with Eric Evans on this, and we've both noticed they seem to be getting more popular."* — Fowler-bliki-AnemicDomainModel, 2003-11-25 [verbatim]
55. *"The fundamental horror of this anti-pattern is that it's so contrary to the basic idea of object-oriented design, which is to combine data and process together."* — Fowler-bliki-AnemicDomainModel [verbatim]
56. *"The problem with anemic domain models is that they incur all of the costs of a domain model, without yielding any of the benefits."* — Fowler-bliki-AnemicDomainModel [verbatim]
57. *"Now, the more common mistake is to give up too easily on fitting the behavior into an appropriate object, gradually slipping toward procedural programming."* — BB Ch.4 (Evans, quoted by Fowler) [verbatim] [2nd-mirror]

---

## Cluster 10 — Forewords (Fowler→Evans 2003, Evans→Vernon 2013)

58. *"Eric Evans is one of those few who can create domain models well. I discovered this by working with him—one of those wonderful times when you find a client who's more skilled than you are."* — Fowler-FW [verbatim]
59. *"The really powerful domain models evolve over time, and even the most experienced modelers find that they gain their best ideas after the initial releases of a system."* — Fowler-FW [verbatim]
60. *"Eric is a strong proponent of Extreme Programming and sees Domain-Driven Design as a natural component of an extreme programming approach."* — Fowler-bliki-DomainDrivenDesign [verbatim]
61. *"Nine years after my book, Domain-Driven Design: Tackling Complexity in the Heart of Software, was published, there's actually a lot to say about DDD that is new."* — Evans foreword to Vernon-IDDD, 2013 [verbatim]
62. *"Vaughn's book is the most complete explanation yet of those new insights into practicing DDD."* — Evans foreword to Vernon-IDDD, 2013 [verbatim]

---

**Total verbatim Tier-A quotes:** 62 (well above the 30-quote floor).

## Provenance Note — `[2nd-mirror]` flagging

This bank adopts the cluster-standard provenance discipline (the Cockburn pack is the model): every quote is
`[verbatim]` + source-tagged, and quotes retrieved through a **secondary source** (a writeup, a transcript, or
another author quoting Evans) carry a `[2nd-mirror]` flag so a reader can tell primary-verified from
secondary-attested.

- **#49** — *"Just because you have been working in a domain…"* — Evans at **QCon 2009**, retrieved via Mark
  Needham's writeup (not the primary talk recording/transcript). `[2nd-mirror]` — re-verify against the original
  QCon-2009 session recording/transcript if it becomes accessible.
- **#57** — *"Now, the more common mistake is to give up too easily…"* — from Evans's **Blue Book Ch.4**, but
  retrieved as quoted by Fowler. `[2nd-mirror]` — confirm against the Blue Book Ch.4 print page directly.

The quotes sourced to `Fowler-bliki-*` / `Fowler-FW` (#5, #9, #10, #54–56, #59, #60) are **Fowler's own words about
Evans/DDD**, correctly credited to Fowler — they are NOT Evans quotes and need no `[2nd-mirror]` flag (the careful
attribution discipline is preserved). Keep the `[2nd-mirror]` flags until genuine primary-source proof; never drop
a flag or paraphrase to close a gap (verbatim-or-skip). This source-tag + `[2nd-mirror]`-flag + Provenance-Note
pattern is the **cluster standard** the six voice-channeling specialist QuoteBanks (Cockburn, EricEvans, Feathers,
Fowler, GregYoung, KentBeck) should all carry — a divergence in one is a cluster defect.
