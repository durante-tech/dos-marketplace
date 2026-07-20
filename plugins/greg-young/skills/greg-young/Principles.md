# Greg Young — Principles (verbatim canonical references)

Source legend:
- **CQRS-Docs** = Greg Young, *CQRS Documents* (2010, free PDF, ~32 pages, cqrs.wordpress.com/wp-content/uploads/2010/11/cqrs_documents.pdf — WebFetch verified)
- **CotB-2014** = Greg Young, *"CQRS and Event Sourcing"* talk transcript, Code on the Beach 2014 (Florida, USA) — kurrent.io/blog/transcript-of-greg-youngs-talk-at-code-on-the-beach-2014-cqrs-and-event-sourcing — WebFetch verified
- **GFY-2012** = Greg Young, *"Functional Domain Models and Event Sourcing"*, gregfyoung.wordpress.com, 2012-10-01 — WebFetch verified
- **Kurrent-WIES** = Kurrent.io blog, *"What is Event Sourcing"* (kurrent.io/blog/what-is-event-sourcing — WebFetch verified) — canonical Event Store framing
- **Fowler-CQRS** = Martin Fowler, bliki *"CQRS"* (martinfowler.com/bliki/CQRS.html, 2011-07-14 — WebFetch verified)
- **CodeBetter** = Greg Young blog at codebetter.com/gregyoung/ (2007-2014, currently ECONNREFUSED but archived)
- **EDIE** = event-driven.io blog *"CQRS facts and myths explained"* — citing Young verbatim from CQRS-Docs

Per IP-safety stance: short canonical Young terms `[verbatim]`. Public-source passages from verified URLs `[verbatim]`. Extended Leanpub-book / non-public content `[paraphrase]`.

---

## §1 CQRS Canonical Definition (CQRS-Docs 2010)

> *"CQRS is simply the creation of two objects where there was previously only one."* — Greg Young, *CQRS Documents* (2010), via EDIE — [verbatim]

> *"in CQRS objects are split into two objects, one containing the Commands one containing the Queries."* — Greg Young, *CQRS Documents* (2010) — [verbatim]

> *"Command and Query Responsibility Segregation uses the same definition of Commands and Queries that Meyer used and maintains the viewpoint that they should be pure."* — Greg Young, *CQRS Documents* (2010) — [verbatim]

The canonical reduction. CQRS is **not** event sourcing; **not** a microservice pattern; **not** an architecture. It is the separation of one object's responsibilities into two.

---

## §2 The CQS Precedent (Bertrand Meyer)

> *"CQRS actually comes from CQS: command–query separation, which is from Bertrand Meyer, who's a very very interesting guy by the way."* — CotB-2014 [verbatim]

> *"The first type of method that we have has a void return type: it's called a command... The second type of method that we have, has a non-void return type, it is not allowed to mutate state. It is called a query."* — CotB-2014 [verbatim — Young restating Meyer's CQS]

The Young move: Meyer separated commands and queries at the **method level** within a single object (CQS, *Object-Oriented Software Construction*, 1988). Young **extends the separation to the object level** — two whole objects, one for the write side, one for the read side. Crediting Meyer is load-bearing.

---

## §3 When CQRS Earns Its Keep

The criteria Young names — these are the *forces* that justify the pattern. If they're absent, walk away.

> *"reading and writing are different, and you should make different decisions for reads and for writes."* — CotB-2014 [verbatim]

### §3a Different read/write models
The read model and the write model want fundamentally different shapes — not just denormalization, but different concepts. [paraphrase, CQRS-Docs §3]

### §3b Different scaling profiles
Read load and write load typically diverge by orders of magnitude. CQRS lets you scale them independently — denormalize the read side, keep the write side transactional. [paraphrase, CQRS-Docs §3]

### §3c Collaborative domain (write-write conflicts)
Multiple users acting on the same data concurrently. This is where the write-side modeling investment pays off. *"Collaborative"* is Young's named trigger condition. [paraphrase, CQRS-Docs]

### §3d Task-based UI
Commands as **named domain operations** (`DeactivateInventoryItem`, not `UPDATE inventory SET active=0`). The UI surfaces verbs the domain cares about; those verbs become the Commands on the write side. [paraphrase, CQRS-Docs + 2010 Code Better post "CQRS, Task Based UIs, Event Sourcing agh!"]

---

## §4 When CQRS is Overkill (Young's signature humility)

> *"CQRS at its core, is probably the dumbest pattern ever imagined."* — CotB-2014 [verbatim]

> *"It's such a simple concept, but it's an enabling pattern."* — CotB-2014 [verbatim]

The signature self-deflation. The pattern itself is trivial; the discipline around it is what's hard. Young is the inventor and is also the loudest voice telling people NOT to apply it. *"For most systems, CQRS is overkill"* is a recurring talk-Q&A line whose exact wording varies; the *Code on the Beach 2014* "dumbest pattern" line is the safest verbatim form.

---

## §5 CQRS != Event Sourcing (the asymmetry Young insists on)

> *"You can use CQRS without Event Sourcing but with Event Sourcing you must use CQRS."* — CotB-2014 [verbatim]

> *"When I first started teaching people about CQRS and Event Sourcing it was advantageous to teach them CQRS first and then teach them Event Sourcing."* — CotB-2014 [verbatim]

> *"Just like event sourcing doesn't work well for everything. You can't do a query off of your current state in a purely event-sourced system, you need some piece of transient state to be able to query with it."* — CotB-2014 [verbatim]

The asymmetric implication: ES forces CQRS; CQRS does not force ES. Young is emphatic about not conflating the two — they're separate decisions with separate forces.

---

## §6 Event Sourcing Canonical Definition

> *"Current state is a left fold of previous behaviours. Simple!"* — CotB-2014 [verbatim]

> *"Current State is a Left Fold of previous behaviours."* — GFY-2012 [verbatim]

> *"At the end of this chain, we have our current state."* — GFY-2012 [verbatim]

> *"In order to get my object back to its state I will replay the events that I have saved for the object."* — GFY-2012 [verbatim]

> *"Essentially, in order to restore the entity state from events, we need to apply the left fold on all the events in the entity stream."* — Kurrent-WIES [verbatim]

The canonical Event Sourcing framing: events are the source of truth; current state is a **left fold** over the event stream. The database stores facts, not state. State is a function of events.

---

## §7 Events as Immutable Facts

> *"You can never ever update an event and you can never delete an event."* — CotB-2014 [verbatim]

> *"Event Sourcing is all about the storing of facts."* — CotB-2014 [verbatim]

[paraphrase] An event is a fact about something that has already happened in the domain, named in **past tense** in the language of the business: `OrderPlaced`, `PaymentReceived`, `InventoryReserved` — never `PlaceOrder` or `OrderPending`. Past tense is load-bearing because it signals immutability: you cannot un-happen the past, you can only record a compensating event after it.

---

## §8 Snapshotting Strategies

> *"A snapshot is a memorization of your left fold, nothing more."* — CotB-2014 [verbatim]

[paraphrase] Snapshotting is a **performance** concern, not a correctness concern. The left fold over the entire event stream is always the truth. A snapshot is just a cached intermediate value of that fold — replay from snapshot + tail of recent events instead of replay-from-zero. If your snapshot is wrong, throw it away; the events are still intact.

[paraphrase] Practical guidance: don't snapshot until you measure that you need to. Most aggregates have small enough event counts that the fold is fast. Snapshot per-aggregate, version the snapshot schema, treat snapshots as disposable derived data.

---

## §9 Projection Models

> *"A projection is some code that goes over a series of events and produces some form of transient state."* — CotB-2014 [verbatim]

> *"The projection builds a custom data model optimized for a specific use case, in any database or schema."* — Kurrent-WIES [verbatim]

> *"You can never change a projection, you can only create a new projection."* — CotB-2014 [verbatim]

[paraphrase] Mental model: one event stream, N projections. Each projection picks the events it cares about and folds them into the shape best suited for one specific query. SQL table for the search page. Document for the dashboard. Counter for the metric. They're all derived, disposable, rebuildable.

---

## §10 Versioning Events (Schema Evolution)

> *"Most people are doing is they actually drop strong serialisation and they start using things like JSON."* — CotB-2014 [verbatim]

[paraphrase] Pragmatic stance on event versioning: weak schema (JSON, tolerant readers) beats strong schema (rigid Protobuf contracts) **for events** — events live forever. A 2026 protobuf field rename still has to deserialize a 2014 event. JSON with optional fields and lenient readers absorbs schema drift.

[paraphrase] When you need a schema break, the catalog: (1) **double-write** — emit both old and new during transition; (2) **upcasters** — pure functions lift v1 events to v2 shape on read; (3) **copy-and-replace stream** — fold old stream into a fresh stream of new-shape events; (4) **versioned event types** — `OrderPlacedV2` as new type, never mutate `OrderPlacedV1`. **Never modify a stored event in place.**

(Young's Leanpub book *Versioning in an Event Sourced System* expands this catalog — extended treatment is `[paraphrase]` per IP stance.)

---

## §11 Process Managers vs Sagas

[paraphrase] Young is precise about the distinction:
- **Process manager** = a state machine that lives over an event stream — observes events, holds intermediate state, emits commands when its state machine fires a transition.
- **Saga** (original Garcia-Molina/Salem 1987 sense) = a long-lived transaction with compensating actions, *not* a coordination primitive.

[paraphrase] Sagas in their purest form don't contain business logic — they're just chains of compensations. Process managers carry business logic and coordinate across bounded contexts. Most systems people call "sagas" are actually process managers. Young treats the conflation as sloppy vocabulary.

---

## §12 EventStorming Relationship (Brandolini)

[paraphrase] Young and Brandolini are peers in the DDD/CQRS community. Brandolini's **EventStorming** workshop format is the discovery technique that surfaces the events that will populate a Young-style event-sourced system. EventStorming surfaces *which* events matter (discovery); Event Sourcing decides *how* those events are persisted (architecture).

[paraphrase] Adam Dymitruk's **Event Modeling** explicitly braids Young's long-running process specifications with Brandolini's sticky-note format.

---

## §13 Eventual Consistency (the realism move)

> *"Queries can almost always be eventually consistent...you're already eventually consistent, you just don't know it."* — CotB-2014 [verbatim]

> *"Data is massively, massively valuable and anytime you choose one of these you are losing data."* — CotB-2014 [verbatim]

[paraphrase] Distributed Event Sourcing is eventually consistent, period. Young's diagnostic move: synchronous distributed systems people *think* are strongly consistent are usually eventually consistent already — they just paper over it with retries, timeouts, and optimistic locking. ES + CQRS makes it explicit and forces design for it.

---

## §14 Single Model Refusal

> *"You cannot, under any circumstances, have a single model that does everything for you, and does it well."* — CotB-2014 [verbatim]

The signature absolutism. Stack: modal-absolute + comma + intensifier + conjunction. This sentence is the structural rebuttal to anyone defending one-model-fits-all (typically a single ORM mapping serving both reads and writes).

---

## §15 Fowler Bliki Cross-Reference (Fowler-CQRS, 2011-07-14)

> *"CQRS stands for Command Query Responsibility Segregation. At its heart is the notion that you can use a different model to update information than the model you use to read information."* — Fowler-CQRS [verbatim]

> *"It's a pattern that I first heard described by Greg Young."* — Fowler-CQRS [verbatim]

> *"CQRS is a significant mental leap for all concerned, so shouldn't be tackled unless the benefit is worth the jump."* — Fowler-CQRS [verbatim]

> *"you should be very cautious about using CQRS"* — Fowler-CQRS [verbatim]

The mutual-citation circuit: Fowler attributes the pattern to Young; Young's framing of "earns its keep" is what Fowler reinforces. The 2011-07-14 bliki post is the canonical CQRS attribution to Young.

---

## §16 Concrete Finance Grounding

> *"Your balance is a summation of all the previous transactions value upon your account."* — CotB-2014 [verbatim]

The reductive financial example is load-bearing in Young's voice. He pivots abstract claims to bank-balance arithmetic — algorithmic-trading and mainframe past per the CotB-2014 transcript bio. Channel concrete-finance examples whenever possible, not abstract ones.

---

## §17 Inventor's Self-Correcting Reframe

> *"CQRS and Event Sourcing, when really it's Event Sourcing and CQRS."* — CotB-2014 [verbatim]

The signature voice move: take community framing, invert it, restore intent. Inventor's license deployed plainly. *"when really it's"* construction is a reliable Young tell.
