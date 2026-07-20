# Greg Young — Diagnostic Lookup (anti-pattern catalog)

Letter prefix:
- **CQRS-** CQRS misuse anti-patterns (cargo-culting CQRS, applying without forces present)
- **ES-** Event Sourcing anti-patterns (snapshotting, versioning, projection drift)
- **OK-** "Overkill" warnings (CQRS-without-justification scenarios)
- **EC-** Eventual-Consistency mishandling

Diagnose ONE primary anti-pattern per turn. Cross-reference Principles.md / QuoteBank.md.

---

## CQRS — CQRS misuse anti-patterns

### CQRS-1 Cargo-Cult CQRS (no forces present)
Team applies CQRS because they read about it / saw a conference talk. The system is CRUD. Reads and writes use the same model. No write-write conflicts. No scaling asymmetry. No task-based UI.
**Diagnosis:** *"CQRS is a significant mental leap for all concerned, so shouldn't be tackled unless the benefit is worth the jump."* — Fowler-CQRS [verbatim]. *"CQRS at its core, is probably the dumbest pattern ever imagined."* — CotB-2014 [verbatim]. The pattern is overkill when none of the four forces (collaborative domain, divergent read/write models, scale asymmetry, task-based UI) are present.
**Move:** Walk away from CQRS. Use one model. CRUD is fine. Save the mental leap for a context that earns it.

### CQRS-2 System-Level CQRS (instead of per-context)
Team applies CQRS as a *system architecture* — every service uses CQRS, regardless of context.
**Diagnosis:** CQRS is a **tactical pattern within a Bounded Context**, not a system architecture. Apply where the forces are present in *that* context; don't apply elsewhere.
**Move:** Identify the one or two bounded contexts where the forces actually bite (collaborative domain, divergent r/w, scale asymmetry, task-based UI). Apply CQRS there. Leave the rest as plain services with one model. Map this on the Context Map (Evans territory — route there for the strategic decision).

### CQRS-3 CQRS Conflated with Event Sourcing
Team thinks "CQRS" means "Event Sourced." They build an event store, then complain that CQRS is hard.
**Diagnosis:** *"You can use CQRS without Event Sourcing but with Event Sourcing you must use CQRS."* — CotB-2014 [verbatim]. The two are separate decisions. CQRS is a separation pattern; ES is a persistence strategy.
**Move:** Separate the decisions. Decide CQRS yes/no based on the four forces. Decide ES yes/no based on whether you need an audit log of facts that the current state cannot reconstruct (compliance, financial reconciliation, time-travel queries). Many CQRS systems use boring SQL on both sides.

### CQRS-4 CQRS Without Two-Object Discipline
Team has "CQRS" but the read service and write service share a database, share types, share assumptions. The split is in name only.
**Diagnosis:** *"CQRS is simply the creation of two objects where there was previously only one."* — CQRS-Docs 2010 [verbatim]. Without the two-object discipline at the model level, there's no segregation, just two methods on one model.
**Move:** Make the split *real*. Two model classes. Different shapes. Different persistence (often). The point of CQRS is to free each side to be optimal for its purpose; if they're sharing types, you've kept the constraint.

---

## ES — Event Sourcing anti-patterns

### ES-1 Encoding the Model Into the Event
Events are named after model assumptions: `OrderUpdated`, `UserModified`. Generic verbs erase the domain.
**Diagnosis:** Events are **facts about something that happened in the domain**, named in past tense with **business vocabulary**: `OrderShipped`, `PaymentDeclined`, `InventoryAdjusted`. Generic verbs don't tell you what happened — they tell you what code ran.
**Move:** Rename. Domain expert review. Each event name should answer "what happened in the business?" — not "what method was called?" Past tense, business term, not generic.

### ES-2 Mutating Stored Events
Team needs to "fix" old events. Migration scripts modify event payloads in the store.
**Diagnosis:** *"You can never ever update an event and you can never delete an event."* — CotB-2014 [verbatim]. Events are immutable facts. Mutating them violates the source-of-truth contract.
**Move:** Use one of the four versioning techniques (Principles.md §10): double-write, upcasters, copy-and-replace stream, or versioned event types (`OrderPlacedV2` as new type, leave `OrderPlacedV1` alone). The events stay; the interpretation evolves.

### ES-3 Snapshotting Prematurely
Team adds snapshotting before measuring fold performance. Premature optimization — snapshots add complexity.
**Diagnosis:** *"A snapshot is a memorization of your left fold, nothing more."* — CotB-2014 [verbatim]. Snapshotting is a **performance** concern, not a correctness concern.
**Move:** Don't snapshot until you measure that the fold is too slow. Most aggregates have fewer than ~100 events; the fold is microseconds. When snapshotting, version the schema, snapshot per-aggregate, treat snapshots as disposable.

### ES-4 Projection-as-Source-of-Truth
Team queries projections and treats the projection database as authoritative. Lost a projection? Lost data.
**Diagnosis:** Projections are **derived**, **disposable**, **rebuildable**. *"You can never change a projection, you can only create a new projection."* — CotB-2014 [verbatim]. The event stream is the source of truth; projections are caches in different shapes.
**Move:** Treat projections as derivable. Tear-down-and-rebuild from the stream is the recovery move. If you can't rebuild a projection from your events, your events are missing information — fix that, not the projection.

### ES-5 No Past-Tense Discipline
Event names mix past tense and imperative: `OrderPlaced` and `PlaceOrder` both used as events.
**Diagnosis:** Past tense signals **fact** (something happened); imperative signals **command** (something requested). Confusing the two corrupts the model. Commands can be rejected; events cannot be un-happened.
**Move:** Rename ruthlessly. Events end with `-ed` / `-en` / past-tense verb forms: `OrderPlaced`, `PaymentReceived`, `InventoryReserved`. Commands are imperative: `PlaceOrder`, `ReceivePayment`, `ReserveInventory`. The vocabulary discipline is the model discipline.

---

## OK — "Overkill" warnings

### OK-1 CQRS for a CRUD App
The system is a forms-over-data CRUD app. Users edit records, look at records. No collaborative editing, no scaling asymmetry, no audit/compliance need.
**Diagnosis:** *"For most systems, CQRS is overkill"* (Young recurring talk-Q&A line). The four forces are absent.
**Move:** Walk away. ActiveRecord / one model / Rails-style CRUD is the right answer. Save CQRS for a context that earns it.

### OK-2 Event Sourcing for an MVP
Startup at 50 daily-active-users adopts Event Sourcing because "we'll need it later for analytics." Shipping is delayed by 6 months.
**Diagnosis:** Event Sourcing earns its keep when (a) the audit log is regulatorily required (banking, healthcare), (b) time-travel queries are a product feature (versioning, undo, replay), or (c) you genuinely cannot reconstruct critical state from current data. None of those apply at 50 DAU.
**Move:** Ship the MVP with boring SQL. Migrate to ES later *if* the forces appear. The migration is hard but possible; the over-engineering at 50 DAU kills the company.

### OK-3 Microservices-Because-CQRS
Team splits a monolith into microservices because "CQRS requires it." The split is on the wrong axes (data shape, not bounded context). Distributed-monolith failure mode.
**Diagnosis:** Young's *"The Long Sad History of MicroServices (TM)"* talk — *"1st law of distributed computing: don't distribute unless you really need to."* CQRS is service-design-style-agnostic; you can do CQRS in a monolith.
**Move:** If the bounded contexts are clear and the forces require service splits, do it. If you're splitting because of CQRS, you're confusing patterns. CQRS in a monolith is fine.

---

## EC — Eventual Consistency mishandling

### EC-1 Pretending Distributed Systems Are Strongly Consistent
Team builds a distributed CQRS+ES system and expects synchronous, strongly consistent reads after writes.
**Diagnosis:** *"Queries can almost always be eventually consistent...you're already eventually consistent, you just don't know it."* — CotB-2014 [verbatim]. Distributed ES is eventually consistent.
**Move:** Design for eventual consistency explicitly. Show "pending" / "in flight" states in UI. Use read-your-writes patterns at the boundary (return the just-written event with a correlation ID; client polls/subscribes for downstream projection updates). Design the UX for the latency that physically exists.

### EC-2 Synchronizing Across Aggregates Transactionally
Team enforces an invariant across two aggregates inside one transaction. Deadlocks under load.
**Diagnosis:** Cross-aggregate invariants want **eventual consistency** (Domain Events flowing between aggregates). Same point Vernon makes in *Effective Aggregate Design* 2011, which Evans endorsed via the IDDD foreword.
**Move:** Either the invariant is true (move both into one aggregate) or eventual (publish a Domain Event from one aggregate; react in the other; design for the latency window). Don't enforce cross-aggregate transactions.
