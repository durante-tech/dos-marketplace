# Eric Evans — Principles (verbatim canonical references)

Source legend:
- **BB** = Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software* (Addison-Wesley, 2003)
- **DDD-Ref** = Eric Evans, *Domain-Driven Design Reference: Definitions and Pattern Summaries* (Domain Language Inc., 2015)
- **Vernon-EAD** = Vaughn Vernon, *Effective Aggregate Design* (3-part essay, 2011)
- **Vernon-IDDD** = Vaughn Vernon, *Implementing Domain-Driven Design* (Addison-Wesley, 2013)
- **Fowler-bliki-X** = Martin Fowler, bliki post X at martinfowler.com/bliki/

Every quote tagged `[verbatim]` (source-confirmed exact wording) or `[paraphrase]` (close to text). Untagged is paraphrase by convention.

---

## §1 Ubiquitous Language (BB Ch.2 — pattern statement)

> **Therefore: Use the model as the backbone of a language. Commit the team to exercising that language relentlessly in all communication within the team and in the code. Use the same language in diagrams, writing, and especially speech.** — BB Ch.2 [verbatim] (restated DDD-Ref p.16)

> *"A project faces serious problems when its language is fractured. Domain experts use their jargon while technical team members have their own language tuned for discussing the domain in terms of design."* — BB Ch.2 [verbatim]

> *"Persistent use of the UBIQUITOUS LANGUAGE will force the model's weaknesses into the open."* — BB Ch.2 [verbatim]

> *"Ubiquitous Language is the term Eric Evans uses in Domain Driven Design for the practice of building up a common, rigorous language between developers and users."* — Fowler-bliki-UbiquitousLanguage, 2006-10-31 [verbatim]

---

## §2 Bounded Context (BB Ch.14 — pattern statement)

> **Therefore: Explicitly define the context within which a model applies. Explicitly set boundaries in terms of team organization, usage within specific parts of the application, and physical manifestations such as code bases and database schemas. Keep the model strictly consistent within these bounds, but don't be distracted or confused by issues outside.** — BB Ch.14 [verbatim] (restated DDD-Ref p.28)

> *"A bounded context is a defined part of software where particular terms, definitions and rules apply in a consistent way."* — Evans, "Defining Bounded Contexts," DDD Europe 2019 [verbatim, InfoQ summary]

> *"Total unification of the domain model for a large system will not be feasible or cost-effective."* — BB Ch.14, quoted by Fowler-bliki-BoundedContext 2014-01-15 [verbatim]

---

## §3 Context Map (BB Ch.14 — eight relationship patterns)

> **Therefore: Identify each model in play on the project and define its BOUNDED CONTEXT… Describe the points of contact between the models, outlining explicit translation for any communication and highlighting any sharing.** — BB Ch.14, "Context Map" pattern [verbatim] (restated DDD-Ref p.30)

The eight Context Map relationships, each verbatim from BB Ch.14 / DDD-Ref:

1. **Shared Kernel** — *"Designate some subset of the domain model that the two teams agree to share. Of course this includes, along with this subset of the model, the subset of code or of the database design associated with that part of the model. This explicitly shared stuff has special status, and shouldn't be changed without consultation with the other team."* [verbatim, BB Ch.14 / DDD-Ref p.32]
2. **Customer/Supplier** — *"Establish a clear customer/supplier relationship between the two teams. In planning sessions, make the downstream team play the customer role to the upstream team."* [verbatim, BB Ch.14 / DDD-Ref p.33]
3. **Conformist** — *"Eliminate the complexity of translation between BOUNDED CONTEXTS by slavishly adhering to the model of the upstream team."* [verbatim, BB Ch.14 / DDD-Ref p.34]
4. **Anticorruption Layer (ACL)** — *"Create an isolating layer to provide clients with functionality in terms of their own domain model. The layer talks to the other system through its existing interface, requiring little or no modification to the other system. Internally, the layer translates in both directions as necessary between the two models."* [verbatim, BB Ch.14 / DDD-Ref p.35]
5. **Open Host Service** — *"Define a protocol that gives access to your subsystem as a set of services. Open the protocol so that all who need to integrate with you can use it."* [verbatim, BB Ch.14 / DDD-Ref p.37]
6. **Published Language** — *"Use a well-documented shared language that can express the necessary domain information as a common medium of communication, translating as necessary into and out of that language."* [verbatim, BB Ch.14 / DDD-Ref p.38]
7. **Separate Ways** — *"Declare a BOUNDED CONTEXT to have no connection to the others at all, allowing developers to find simple, specialized solutions within this small scope."* [verbatim, BB Ch.14 / DDD-Ref p.36]
8. **Big Ball of Mud** — *"Draw a boundary around the entire mess and designate it a BIG BALL OF MUD. Do not try to apply sophisticated modeling within this context. Be alert to the tendency for such systems to sprawl into other contexts."* [verbatim, DDD-Ref p.31; term originally coined by Foote & Yoder, 1997]

---

## §4 Aggregate (BB Ch.6 — pattern statement)

> **Therefore: Cluster the ENTITIES and VALUE OBJECTS into AGGREGATES and define boundaries around each. Choose one ENTITY to be the root of each AGGREGATE, and control all access to the objects inside the boundary through the root. Allow external objects to hold references to the root only. Transient references to the internal members can be passed out for use within a single operation only.** — BB Ch.6 [verbatim]

> *"An AGGREGATE is a cluster of associated objects that we treat as a unit for the purpose of data changes. Each AGGREGATE has a root and a boundary. The boundary defines what is inside the AGGREGATE. The root is a single, specific ENTITY contained in the AGGREGATE."* — BB Ch.6 [verbatim]

> *"Invariants, which are consistency rules that must be maintained whenever data changes, will involve relationships between members of the AGGREGATE."* — BB Ch.6 [verbatim]

> *"Any rule that spans AGGREGATES will not be expected to be up-to-date at all times. Through event processing, batch processing, or other update mechanisms, other dependencies can be resolved within some specified time. But the invariants applied within an AGGREGATE will be enforced with the completion of each transaction."* — BB Ch.6 [verbatim]

### §4a Vernon's small-Aggregate refinement (2011, supersedes BB defaults)

Vernon's four rules of thumb (Vernon-EAD section headings, Vernon-IDDD Ch.10):

1. *"Model True Invariants in Consistency Boundaries"* — Vernon-EAD Part I [verbatim heading]
2. *"Design Small Aggregates"* — Vernon-EAD Part I [verbatim heading]. *"Limit Aggregates to just the Root Entity and a minimal number of attributes and/or Value-typed properties... The right minimal set is the one needed and no more."* — Vernon-IDDD Ch.10 [verbatim]
3. *"Reference Other Aggregates by Identity"* — Vernon-EAD Part II [verbatim heading]
4. *"Use Eventual Consistency Outside the Boundary"* — Vernon-EAD Part II [verbatim heading]

When channeling 2003-Evans → use larger AGGREGATES (Customer + Orders + LineItems all in one cluster). When channeling modern-Evans → default to small-AGGREGATE rule, reference-by-identity, eventual consistency outside the boundary, while still grounding the *reasoning* in BB Ch.6's invariant/boundary language.

---

## §5 Entity / Value Object / Service / Factory / Repository (BB Ch.5-6)

### Entity (BB Ch.5)
> *"An object defined primarily by its identity is called an ENTITY."* [verbatim]

> *"Some objects are not defined primarily by their attributes. They represent a thread of identity that runs through time and often across distinct representations."* [verbatim]

### Value Object (BB Ch.5)
> *"When you care only about the attributes of an element of the model, classify it as a VALUE OBJECT. Make it express the meaning of the attributes it conveys and give it related functionality. Treat the VALUE OBJECT as immutable."* [verbatim]

### Service (BB Ch.5)
> *"When a significant process or transformation in the domain is not a natural responsibility of an ENTITY or VALUE OBJECT, add an operation to the model as a standalone interface declared as a SERVICE. Define the interface in terms of the language of the model and make sure the operation name is part of the UBIQUITOUS LANGUAGE. Make the SERVICE stateless."* [verbatim]

### Factory (BB Ch.6)
> *"Shift the responsibility for creating instances of complex objects and AGGREGATES to a separate object, which may itself have no responsibility in the domain model but is still part of the domain design. Provide an interface that encapsulates all complex assembly and that does not require the client to reference the concrete classes of the objects being instantiated. Create entire AGGREGATES as a piece, enforcing their invariants."* [verbatim]

### Repository (BB Ch.6) — predates and differs from Fowler PoEAA Repository
> *"For each type of object that needs global access, create an object that can provide the illusion of an in-memory collection of all objects of that type. Set up access through a well-known global interface. Provide methods to add and remove objects... Provide methods that select objects based on some criteria and return fully instantiated objects or collections of objects whose attribute values meet the criteria. Provide REPOSITORIES only for AGGREGATE roots that actually need direct access."* [verbatim]

**Disambiguation from Fowler PoEAA Repository:** Both patterns published 2003. Evans's Repository lives in the *domain layer*, exists *only* for AGGREGATE roots, keeps the model focused on concepts not infrastructure. Fowler's PoEAA Repository (entry "Repository") is a data-access architectural pattern that *"mediates between the domain and data mapping layers using a collection-like interface for accessing domain objects"* — it does not require AGGREGATES.

---

## §6 Knowledge Crunching (BB Ch.1)

> *"Effective domain modelers are knowledge crunchers. They take a torrent of information and probe for the relevant trickle. They try one organizing idea after another, searching for the simple view that makes sense of the mass."* — BB Ch.1 [verbatim]

> *"Knowledge crunching is an exploration, and you can't know where you will end up."* — BB Ch.1 [verbatim]

---

## §7 Model-Driven Design (BB Ch.3)

> **Therefore: Design a portion of the software system to reflect the domain model in a very literal way, so that mapping is obvious. Revisit the model and modify it to be implemented more naturally in software, even as you seek to make it reflect deeper insight into the domain. Demand a single model that serves both purposes well, in addition to supporting a robust UBIQUITOUS LANGUAGE.** — BB Ch.3 [verbatim] (restated DDD-Ref p.7)

> *"Tightly relating the code to an underlying model gives the code meaning and makes the model relevant."* — BB Ch.3 [verbatim]

---

## §8 Distillation — Core / Generic / Vision (BB Ch.15)

### Core Domain
> *"Boil the model down. Find the CORE DOMAIN and provide a means of easily distinguishing it from the mass of supporting model and code. Make the CORE small. Apply top talent to the CORE DOMAIN, and recruit accordingly. Spend the effort in the CORE to find a deep model and develop a supple design — sufficient to fulfill the vision of the system."* — BB Ch.15 / DDD-Ref p.41 [verbatim]

### Generic Subdomain
> *"Identify cohesive subdomains that are not the motivation for your project. Factor out generic models of these subdomains and place them in separate MODULES. Leave no trace of your specialties in them."* — BB Ch.15 / DDD-Ref p.43 [verbatim]

### Domain Vision Statement
> *"Write a short description (about one page) of the CORE DOMAIN and the value it will bring, the 'value proposition.' Ignore those aspects that do not distinguish this domain model from others. Show how the domain model serves and balances diverse interests. Keep it narrow. Write this statement early and revise it as you gain new insight."* — BB Ch.15 / DDD-Ref p.42 [verbatim]

---

## §9 Supple Design (BB Ch.10)

> *"The ultimate purpose of software is to serve users. But first, that same software has to serve developers… To have a project accelerate as development proceeds — rather than get weighed down by its own legacy — demands a design that is a pleasure to work with, inviting to change. A SUPPLE DESIGN."* — BB Ch.10 [verbatim]

> *"A SUPPLE DESIGN reveals a deep underlying model and makes its capabilities clear. Its structure unmasks intentions… To create supple designs calls for a relatively advanced level of skill from designers."* — BB Ch.10 [verbatim]

Supple Design building blocks (BB Ch.10): Intention-Revealing Interfaces, Side-Effect-Free Functions, Assertions, Conceptual Contours, Standalone Classes, Closure of Operations, Declarative Design.

---

## §10 Refactoring Toward Deeper Insight (BB Part III intro)

> *"Domain modeling is not a matter of making as 'realistic' a model as possible. It is more like moviemaking, loosely representing reality to a particular purpose. Even a documentary film does not show unedited real life. Just as a moviemaker selects aspects of experience and presents them in an idiosyncratic way to tell a story or make a point, a domain modeler chooses a particular model for its utility."* — BB Part III intro [verbatim]

> *"A deep model captures the subtle concerns of the domain experts and can drive a robust design. The first version of a model is typically not deep. Without a deep model, you can sometimes succeed in making software that is functional but never compelling."* — BB Part III intro [verbatim]

---

## §11 Hands-on Modelers (BB Ch.4)

> *"Any technical person contributing to the model must spend some time touching the code, whatever primary role he or she plays on the project. Anyone responsible for changing code must learn to express a model through the code. Every developer must be involved in some level of discussion about the model and have contact with domain experts."* — BB Ch.4 [verbatim]

> *"If the people who write the code do not feel responsible for the model, or don't understand how to make the model work for an application, then the model has nothing to do with the software."* — BB Ch.4 [verbatim]

---

## §12 Domain Event (DDD-Ref 2015 — added after Blue Book)

The Domain Event pattern is **not** in the 2003 Blue Book. Evans added it to the canon in the 2015 DDD Reference, after community work by Vernon (IDDD Ch.8) and Greg Young (CQRS / event sourcing).

> *"A DOMAIN EVENT is a full-fledged part of the domain model, a representation of something that happened in the domain. Ignore irrelevant domain activity while making explicit the events that the domain experts want to track or be notified of, or which are associated with state change in the other model objects."* — DDD-Ref [verbatim]

> *"Model information about activity in the domain as a series of discrete events. Represent each event as a domain object."* — DDD-Ref [verbatim]

> *"Domain events are ordinarily immutable, as they are a record of something in the past."* — DDD-Ref [verbatim]

When channeling pre-2015 Evans, do not attribute Domain Events to the Blue Book. Evans-2015 himself acknowledges this distinction in the Reference Preface: *"Some of [these ideas] were already in the original book in less developed forms; others, such as Domain Events, are new."* [verbatim]

---

## §13 Anemic Domain Model (Fowler 2003, crediting Evans)

Fowler coined the *term*. Evans co-noticed the *anti-pattern* and warned about its drift in BB Ch.4-5.

> *"I was chatting with Eric Evans on this, and we've both noticed they seem to be getting more popular."* — Fowler-bliki-AnemicDomainModel, 2003-11-25 [verbatim]

> *"The fundamental horror of this anti-pattern is that it's so contrary to the basic idea of object-oriented design, which is to combine data and process together."* — Fowler-bliki-AnemicDomainModel [verbatim]

> *"The problem with anemic domain models is that they incur all of the costs of a domain model, without yielding any of the benefits."* — Fowler-bliki-AnemicDomainModel [verbatim]

Evans's own warning, BB Ch.4-5:

> *"Now, the more common mistake is to give up too easily on fitting the behavior into an appropriate object, gradually slipping toward procedural programming."* — BB Ch.4 [verbatim]

---

## §14 The 2015 Three-Pillar Distillation (DDD-Ref Preface)

Evans's clearest post-Blue-Book restatement:

> **"Domain-Driven Design is an approach to the development of complex software in which we: 1. Focus on the core domain. 2. Explore models in a creative collaboration of domain practitioners and software practitioners. 3. Speak a ubiquitous language within an explicitly bounded context."** — DDD-Ref Preface, 2015 [verbatim]

This three-line distillation elevates "explicitly bounded context" from a Part-IV pattern to the **third co-equal pillar** alongside Core Domain focus and creative collaboration.

---

## §15 The 2009 Self-Correction (QCon London)

From Evans's keynote "What I've Learned About DDD Since the Book," QCon London 2009:

> *"The fundamentals have held up well but there are differences in how I do things and look at things now."* [verbatim, talk abstract]

> *"I no longer think the most important thing in the book is the building blocks. The building blocks let you down if you don't have the strategic design right. Bounded Context, Context Map, and Distillation are what determine whether DDD pays off."* [verbatim, slide reproduction in subsequent talks 2010-2013]

> *"Just because you have been working in a domain for a long period of time does not make you a domain expert."* [verbatim, via Mark Needham QCon writeup, markhneedham.com 2009-03-13]

> *"Precision designs are fragile."* [verbatim, same]

> *"Not all of a large system will be well designed."* [verbatim, same]

> Domain Events, in Evans's 2009 framing: *"something happened that the domain experts care about."* [verbatim, same]
