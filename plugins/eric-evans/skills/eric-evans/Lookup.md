# Eric Evans — Diagnostic Lookup (anti-pattern catalog)

Letter prefix:
- **BC-** Bounded Context anti-patterns
- **UL-** Ubiquitous Language anti-patterns
- **AG-** Aggregate anti-patterns
- **CM-** Context Map anti-patterns
- **ADM-** Anemic Domain Model anti-patterns

Use Lookup.md to diagnose ONE primary anti-pattern per turn. Cross-reference Principles.md / QuoteBank.md for the canonical source.

---

## BC — Bounded Context anti-patterns

### BC-1 The Unbounded Model
The team treats "the model" as a single global object graph that must be unified across the entire enterprise. **Tell:** every team meeting argues over what `Customer` means; ER diagrams aspire to consistency across all systems; integration is via shared database.
**Diagnosis:** *"Total unification of the domain model for a large system will not be feasible or cost-effective."* — BB Ch.14 [verbatim]
**Move:** Map the contexts that already exist de facto (per team, per subsystem, per code base). Stop trying to unify; start translating.

### BC-2 Context Drift Inside One Codebase
A single codebase silently hosts two contexts whose model the same word means different things. **Tell:** `Order` in module A has 3 fields; `Order` in module B has 11 fields and a different lifecycle. Neither team knows the other exists.
**Diagnosis:** Bounded Context boundary is implicit and undefended. Refactor splits or rifts in the language flag this.
**Move:** Make the boundary explicit — separate package, separate database schema, separate team if possible. Document the boundary and the translation.

### BC-3 Bounded Contexts on the Org Chart, Not the Code
Architecture diagrams show clean bounded contexts; the code base is a Big Ball of Mud where every module imports every other. **Tell:** the boundaries are PowerPoint, not enforceable.
**Diagnosis:** Bounded Context requires *physical manifestations* — code bases, database schemas, team organization — not just diagrams.
**Move:** Pick one boundary and enforce it physically (separate repo, separate schema). The rest will follow.

### BC-4 Premature Bounded Context
The team draws BC boundaries before the domain is understood — usually copying boundaries from a reference architecture or from the org chart. **Tell:** the boundaries don't follow language fractures; they follow Conway's-law residue.
**Diagnosis:** BC follows from Knowledge Crunching and Ubiquitous Language drift, not from up-front partitioning.
**Move:** Work in one context until the language fractures naturally; *then* draw the boundary.

---

## UL — Ubiquitous Language anti-patterns

### UL-1 Translation Tax
Domain experts speak in business terms; developers speak in code terms; product managers translate between them. **Tell:** every meeting wastes 15 minutes on "what we mean by X is what you call Y."
**Diagnosis:** *"A project faces serious problems when its language is fractured."* — BB Ch.2 [verbatim]
**Move:** Run a knowledge-crunching session — pick one bounded context, one core concept, and refactor BOTH the domain expert's vocabulary and the code until they match.

### UL-2 Glossary Without Code
The team has a wiki glossary; the code uses different names. **Tell:** glossary says `Loan Origination`; code says `app_create_v2`.
**Diagnosis:** Ubiquitous Language must live in code, diagrams, AND speech. A glossary that the code ignores is dead documentation.
**Move:** Rename the code to match the glossary — and rename the glossary if the code revealed a better term. The language is the model.

### UL-3 Same Word, Different Contexts (No Boundary)
"Customer" means one thing in Sales, another in Support, another in Billing — but no one has named the contexts. **Tell:** developers fight over which fields `Customer` should have.
**Diagnosis:** The fight is signal — the language is fractured along a bounded context the team hasn't named yet. Cf. BC-2.
**Move:** Acknowledge the contexts; let `Customer` mean different things inside each; define translation at the boundary.

### UL-4 Sloganized Language
The team has a vocabulary list but uses it as marketing — "we have a Ubiquitous Language" — without actually using it in code reviews, planning, or speech. **Tell:** vocabulary list hasn't changed in six months; nobody has crossed words off or argued over a term.
**Diagnosis:** *"Persistent use of the UBIQUITOUS LANGUAGE will force the model's weaknesses into the open."* — BB Ch.2 [verbatim]. If no weaknesses are surfacing, the language isn't being used.
**Move:** Hold a vocabulary review at the next iteration — "what term confused us this sprint? what concept have we been talking around?"

---

## AG — Aggregate anti-patterns

### AG-1 The God Aggregate
A single AGGREGATE pulls in dozens of entities — Customer + Orders + LineItems + Shipments + Invoices + Payments — under one root. **Tell:** loading one Customer pulls 1MB; concurrent edits collide constantly.
**Diagnosis:** *"Design Small Aggregates."* — Vernon-EAD Part I [verbatim]. The 2003 Blue Book examples sometimes suggest larger boundaries; Vernon's 2011 refinement supersedes them.
**Move:** Identify the *true invariants* (rules that must hold at every transaction commit). Anything outside that goes to a separate AGGREGATE referenced by identity, with eventual consistency.

### AG-2 Direct Reference Across Aggregates
One AGGREGATE holds a direct object pointer to another AGGREGATE's internal entity. **Tell:** code like `order.customer.address.update(...)` reaches across boundaries.
**Diagnosis:** *"Reference Other Aggregates by Identity."* — Vernon-EAD Part II [verbatim]. *"Allow external objects to hold references to the root only."* — BB Ch.6 [verbatim]
**Move:** Replace direct references with identifier references; load the other AGGREGATE via its Repository when needed.

### AG-3 Cross-Aggregate Transaction
The team enforces an invariant *across* two AGGREGATES inside a single transaction. **Tell:** large multi-table updates locked together; deadlocks under load.
**Diagnosis:** *"Use Eventual Consistency Outside the Boundary."* — Vernon-EAD Part II [verbatim]. *"Any rule that spans AGGREGATES will not be expected to be up-to-date at all times."* — BB Ch.6 [verbatim]
**Move:** Either the rule is a true invariant (then move both into one AGGREGATE), or it's eventual (then publish a Domain Event from one and react in the other).

### AG-4 Repository for Non-Roots
The team has a Repository for every entity, including those inside an AGGREGATE. **Tell:** `LineItemRepository.findById(...)` exists alongside `OrderRepository.findById(...)`.
**Diagnosis:** *"Provide REPOSITORIES only for AGGREGATE roots that actually need direct access."* — BB Ch.6 [verbatim]
**Move:** Delete the non-root Repository. Internal entities are reached only through the root.

---

## CM — Context Map anti-patterns

### CM-1 No Context Map
Multiple bounded contexts exist, but no one has drawn the relationships between them. **Tell:** integration breaks every release; nobody can predict what changes one team makes will break another.
**Diagnosis:** *"Identify each model in play on the project and define its BOUNDED CONTEXT… Describe the points of contact."* — BB Ch.14 [verbatim]
**Move:** Draw the map. One sheet of paper. List the contexts; for each pair that touches, name the relationship (Shared Kernel, Customer/Supplier, Conformist, ACL, Open Host, Published Language, Separate Ways, Big Ball of Mud).

### CM-2 Conformist Where ACL is Needed
The team adopts the upstream system's model wholesale (legacy ERP, third-party API) and lets that model leak into their core domain. **Tell:** core domain types named after vendor concepts; refactoring is impossible because everything depends on the upstream's vocabulary.
**Diagnosis:** Conformist is acceptable when the upstream model is benign and the cost of translation exceeds the benefit. When the upstream is a *Big Ball of Mud* or actively hostile to the core domain's clarity, an Anticorruption Layer is the right move.
**Move:** Insert an ACL at the boundary; translate upstream concepts into the core domain's language at every entry point.

### CM-3 Shared Kernel Without Coordination
Two teams share a code module without explicit agreement on change protocol. **Tell:** Team A refactors the kernel; Team B's build breaks; a flame war ensues.
**Diagnosis:** *"This explicitly shared stuff has special status, and shouldn't be changed without consultation with the other team."* — BB Ch.14 [verbatim]
**Move:** Either formalize the shared kernel (joint ownership, change-review protocol, joint tests) or split it — let each team have its own copy with translation between.

---

## ADM — Anemic Domain Model anti-patterns

### ADM-1 Pure Data Bags + Service Layer
Entities are getter/setter shells; all business logic lives in `OrderService`, `CustomerService`, `BillingService`. **Tell:** the domain model has zero behavior; "service" classes are 1000 lines each.
**Diagnosis:** *"The fundamental horror of this anti-pattern is that it's so contrary to the basic idea of object-oriented design, which is to combine data and process together."* — Fowler-bliki-AnemicDomainModel [verbatim]
**Move:** Walk through the next change: ask "is this a *significant process* or *transformation*?" If yes — does it have a natural responsibility on an existing ENTITY or VALUE OBJECT? Pull the behavior onto the model object first; SERVICE is the exception, not the rule.

### ADM-2 Fields Public, No Invariants Enforced
Entity fields are `public` (or have public setters); state can be set inconsistently from outside. **Tell:** invariants documented in comments; nothing enforces them at runtime.
**Diagnosis:** Aggregates exist to enforce invariants. *"Create entire AGGREGATES as a piece, enforcing their invariants."* — BB Ch.6 [verbatim]
**Move:** Make state changes go through methods that enforce invariants. Validate at construction (Factory). Make Value Objects immutable.

### ADM-3 Procedural Drift in a Domain-Modeled Codebase
A codebase that started with rich domain objects has slowly added "service" classes for new behavior. **Tell:** old logic is on the model; new logic is in services; nobody can articulate the rule.
**Diagnosis:** *"The more common mistake is to give up too easily on fitting the behavior into an appropriate object, gradually slipping toward procedural programming."* — BB Ch.4 [verbatim]
**Move:** For each new behavior added to a service, ask: which model object would naturally own this? Refactor it onto the model. The service should remain only when the behavior genuinely doesn't belong on any single model object.
