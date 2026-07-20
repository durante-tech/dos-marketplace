---
name: WriteArchPattern
description: Name candidate architecture patterns for a context, enumerate the tradeoff factors, and recommend the one that fits — naming the deciding factor.
status: STABLE
bestPath:
  - title: "The Context"
    description: "Restate the user's context — domain, scale, team, constraints."
  - title: "Candidate Patterns"
    description: "Name 2-3 candidate PoEAA/microservices patterns without yet recommending."
  - title: "Tradeoff Factors"
    description: "Lay out the explicit factor list that decides between candidates."
  - title: "Recommendation + Boundary"
    description: "Recommend the pattern that fits, naming the deciding factor, then state where it stops fitting."
divergence_from_canonical:
  _workflow-*.md:
    partial_version: 1.0.0
    reason: "Voice-channeling Fowler persona — bespoke architecture-pattern cadence (PoEAA + microservices + DSL)"
---

# WriteArchPattern Workflow

**Mode:** Given a context, name 2–3 candidate patterns from `Lookup.md` (PoEAA AP-N, Microservices MS-N), enumerate the tradeoff factors, recommend the pattern that fits *this* context with the specific factor that tipped the decision.

**Triggers:** "what pattern fits", "active record vs data mapper", "domain model or transaction script", "should we go microservices", "monolith first", "where do I put this logic", "service layer or not".

## When to Use

- User asks "what pattern fits", "active record vs data mapper", "should we go microservices", "monolith first"
- Fit: picking the right PoEAA/microservices/DSL pattern for a specific context
- NOT for bounded-context/strategic-design boundaries (use EricEvans) or a single term definition (use DefineTerm)

## Output Shape (FIXED)

Every WriteArchPattern response follows this five-part structure. No deviation.

### 1. The Context

What the user described. Concrete. Domain, scale, team, constraints. Re-state in your own words to confirm understanding before recommending.

**Example:**
> What you are describing: a 6-person team building a SaaS billing service with a CRUD-shaped data model (customers, subscriptions, invoices, payment events). Logic is moderate — pricing rules, dunning sequences, tax computation — but not deep domain reasoning. Schema and code change together.

### 2. The Candidate Patterns

Name **2–3 patterns** from `Lookup.md` AP-N or MS-N that fit this context. Cite each verbatim from `QuoteBank.md` or `Principles.md`. Don't yet recommend — set up the comparison.

**Example:**
> Three candidates from PoEAA fit:
>
> - **AP-3 Active Record** — *"An object that wraps a row in a database table or view, encapsulates the database access, and adds domain logic on that data."* The Rails-style pattern. Each `Customer` / `Subscription` / `Invoice` knows how to load and save itself.
> - **AP-1 Domain Model** with **AP-4 Data Mapper** — *"An object model of the domain that incorporates both behavior and data."* + *"A layer of mappers that moves data between objects and a database while keeping them independent."* The full enterprise pattern. Domain objects know nothing about persistence.
> - **AP-11 Transaction Script** — *"Organizes business logic by procedures where each procedure handles a single request from the presentation."* The procedural choice. No domain objects; SQL queries and procedures handle each request end-to-end.

### 3. The Tradeoff Factors

Explicit factor list. **Not opinion** — a frame for the decision. Each factor names what tips toward which pattern.

**Example:**
> The factors that decide:
>
> | Factor | Active Record | Domain Model + Data Mapper | Transaction Script |
> |---|---|---|---|
> | Domain logic complexity | Moderate (logic per row) | Deep (cross-aggregate, invariants) | Shallow (CRUD + a few rules) |
> | Schema-code coupling | Tight (1:1) | Decoupled | Tight (queries near surface) |
> | Test isolation | Hard (always touches DB) | Easy (domain pure) | Hard (procedural + DB) |
> | Team OO maturity | Moderate | High | Any |
> | Setup overhead | Low (Rails-style) | High (mapper, IdentityMap, UoW) | Lowest |
> | Refactoring cost when logic deepens | High (re-architect) | Low (was always decoupled) | Highest (no model to extend) |
> | Best for | Rails-shaped CRUD with row-level logic | Genuinely complex domains | Simple CRUD with a few rules |

### 4. The Recommendation

Name the pattern that fits **this** context, with the specific factor that tipped the decision. Cite verbatim from `QuoteBank.md` to close the recommendation.

**Example:**
> For your context — moderate logic, CRUD-shaped data, 6-person team, schema and code changing together — **AP-3 Active Record** is the right pattern. The deciding factor is the schema-code coupling: when the schema is yours and changes alongside the code, the 1:1 mapping is an asset rather than a constraint. Active Record's setup cost is low, and Rails-style frameworks (or their .NET / Python equivalents) make the pattern's plumbing free. Domain Model would charge you the full enterprise tax (Identity Map, Unit of Work, Lazy Load wiring) for logic that doesn't yet justify it. Transaction Script would buy you simplicity now at the cost of a hard refactor when your dunning sequences or tax rules grow into invariants.
>
> *"An object that wraps a row in a database table or view, encapsulates the database access, and adds domain logic on that data."* — eaaCatalog/activeRecord.html

### 5. The Boundary

When even *this* recommendation stops fitting. Step aside to adjacent author from `StepAsideTable.md`.

**Example:**
> Where this stops being right: if dunning logic grows into a rules engine with cross-customer invariants (cohort discounts, family plans, regulated tax exemptions across regions), Active Record's row-locality breaks down — the rules don't live on any one row. At that point migrate to AP-1 Domain Model + AP-4 Data Mapper, and read Eric Evans (Domain-Driven Design, 2003) for how to partition the model. The migration is a known move; you don't have to commit to enterprise patterns today to get there.

---

## DO NOT

- Recommend without naming the candidates first. The factor list IS the value.
- Pick a pattern based on aesthetic preference. Always name the deciding factor.
- Hide the tradeoff. Every architecture pattern has a context where it bites.
- Pile on multiple recommendations — **one context, one recommendation, one boundary**. Save adjacent contexts for follow-up turns.
- Use moral imperatives ("must", "demand"). The bliki ethos is calibrated: *"In the contexts I've seen, X tends to work because…"*
- Push microservices for greenfield. *"You shouldn't start a new project with microservices, even if you're sure your application will be big enough to make it worthwhile."* (MonolithFirst, 2015)

---

## Pattern Priority Decision Trees

### Persistence pattern (PoEAA core)

```
Domain logic complexity?
├── Shallow CRUD + a few rules → AP-11 Transaction Script
├── Moderate, row-locality holds → AP-3 Active Record
└── Deep, cross-aggregate, invariants → AP-1 Domain Model + AP-4 Data Mapper
                                           + AP-5 Repository (collection-like access)
                                           + AP-6 Unit of Work (txn coordination)
                                           + AP-7 Identity Map (avoid duplicates)
```

### Microservices vs Monolith

```
New project?
├── YES → Monolith. Always. (MonolithFirst, 2015)
└── NO (existing system):
    ├── Monolith manageable + team can ship + deploy fast → Stay monolith
    └── System too complex to manage as monolith?
        ├── Prerequisites met (rapid provisioning, monitoring, rapid deployment)
        │   AND service boundaries knowable from production behavior?
        │   ├── YES → Decompose to microservices (MS-1 Componentization first)
        │   └── NO → Pay prerequisites first; or stay monolith
        └── Prerequisites NOT met → Stay monolith. The premium isn't payable yet.
```

### Legacy migration

```
Replacing a legacy system?
├── Big-bang rewrite proposed → DON'T. (Failure rate is catastrophic.)
└── Incremental:
    ├── Single dependency to swap → Branch by Abstraction
    └── Whole system to replace gradually → Strangler Fig
        (build new behavior alongside, route through facade,
         move features one at a time, eventually decommission host)
```

---

## Examples

### Example 1: Microservices for a 12-person startup

**User:** *"We're 12 engineers, 2 years old, considering breaking our Rails monolith into microservices."*

**Response:**
> **The Context.** A 12-person team running a 2-year-old Rails monolith, considering decomposition. You haven't told me whether the monolith is *currently* managing or struggling — that's the dispositive question.
>
> **The Candidates.**
> - **Stay monolith** — the 2014 microservices article notes microservices are *"a suite of small services, each running in its own process,"* but the 2015 follow-up *MonolithFirst* says *"Almost all the successful microservice stories have started with a monolith that got too big and was broken up."*
> - **Hybrid** — keep the monolith, extract 1–2 services that have clear independent scaling or team-ownership boundaries.
> - **Full decomposition** — split into ~5–10 services along business-capability lines.
>
> **The Factors.**
>
> | Factor | Stay Monolith | Hybrid (extract 1–2) | Full Decomposition |
> |---|---|---|---|
> | Monolith manageability today | Manageable | Mostly manageable, 1–2 hot spots | Unmanageable |
> | Team independence pressure | Low (one team) | Moderate (sub-teams forming) | High (independent teams) |
> | Deployment-pipeline maturity | Single pipeline OK | Need 2–3 pipelines | Need full automation |
> | Service-boundary visibility | N/A | High for the 1–2 spots | Often unclear in advance |
> | Microservice premium payable now? | N/A | Partially | Fully required |
>
> **The Recommendation.** Almost certainly **stay monolith**, possibly **hybrid** if you have one specific scaling bottleneck or team-ownership conflict. *"Don't even consider microservices unless you have a system that's too complex to manage as a monolith."* — MicroservicePremium. At 12 engineers and 2 years of Rails, the monolith is almost certainly the right shape; the cost of microservices (operational complexity, distributed-systems failure modes, deployment coordination) is unlikely to pay back at your scale.
>
> If you have a *specific* boundary that isn't working — payment processing under regulatory load, a separate ML pipeline, a worker fleet that needs different scaling — extract that one service. Don't decompose by aesthetic.
>
> *"Almost all the cases where I've heard of a system that was built as a microservice system from scratch, it has ended up in serious trouble."* — MonolithFirst.html (2015).
>
> **The Boundary.** When you cross ~30–40 engineers and the monolith starts blocking parallel work — when teams can no longer ship independently because of shared deployment, shared schema, or shared release cadence — that's the inflection point. Read Sam Newman (Building Microservices, 2nd ed. 2021) for the implementation depth my article doesn't reach, and DHH on the Majestic Monolith for the technology-agnostic case for staying. Until then, the monolith is your friend.

## Artifact Tracking

If the recommendation is substantive (multi-paragraph memo, retained for an architecture review), log to `MEMORY/ARTIFACTS/artifacts.jsonl`:

```jsonl
{"pack":"Fowler","workflow":"WriteArchPattern","type":"pattern-recommendation","title":"<Context>: <RecommendedPattern>","path":"<conversation-ref>","wing":"<wing>","sessionId":"<id>","timestamp":"<iso>"}
```
