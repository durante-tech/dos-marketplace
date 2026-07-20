# Lookup — Fowler-Tagged Catalog

**The Refactor / DefineTerm / WriteArchPattern workflows emit findings keyed by these tags.** When a user reads `CS-7: Data Clumps`, they look up the smell here and find the diagnosis + the catalog refactoring (R-N) that fixes it.

Tag namespaces:
- **CS-N** — Code smells from *Refactoring* Ch. 3 (Beck/Fowler co-authored)
- **R-N** — Refactoring catalog (named transformations, R refers to refactoring.com/catalog/)
- **AP-N** — Architecture patterns (PoEAA + later)
- **MS-N** — Microservices characteristics (Lewis & Fowler 2014)
- **ADM / MS-FAIL / CQRS-OVERREACH** — anti-patterns

---

## CS — Code Smells (Refactoring Ch. 3, with Beck)

| Tag | Smell | Diagnosis | Catalog Fix(es) |
|---|---|---|---|
| **CS-1** | Long Function (formerly Long Method) | A function so long readers can't hold it in their head; the rule of thumb begins at ten lines. | **R-1** Extract Function, R-Replace-Temp-with-Query, **R-16** Introduce Parameter Object, R-Preserve-Whole-Object, **R-9** Decompose Conditional |
| **CS-2** | Large Class | A class trying to do too much, with too many fields and/or methods. | Extract Class, Extract Superclass, **R-6** Replace Type Code with Subclasses |
| **CS-3** | Long Parameter List | Long parameter lists are hard to understand and tend to be inconsistent. | Replace Parameter with Query, Preserve Whole Object, **R-16** Introduce Parameter Object, Remove Flag Argument, **R-8** Combine Functions into Class |
| **CS-4** | Divergent Change | One class changed in many different ways for different reasons; one class, many axes of change. | Split Phase, **R-4** Move Function, **R-1** Extract Function, Extract Class |
| **CS-5** | Shotgun Surgery | Inverse of Divergent Change: every kind of change forces small edits to many classes. | **R-4** Move Function, Move Field, **R-8** Combine Functions into Class, Combine Functions into Transform, **R-2** Inline Function, Inline Class |
| **CS-6** | Feature Envy | *"A method accesses the data of another object more than its own data."* | **R-4** Move Function, **R-1** Extract Function (then Move) |
| **CS-7** | Data Clumps | *"Often you'll see the same three or four data items together in lots of places."* — bunches of data that travel together should be their own object. | Extract Class, **R-16** Introduce Parameter Object, Preserve Whole Object |
| **CS-8** | Primitive Obsession | Using primitive types (int, string) where a small domain object (Money, Range, PhoneNumber) would carry intent. | Replace Primitive with Object, **R-6** Replace Type Code with Subclasses, **R-5** Replace Conditional with Polymorphism, Extract Class, **R-16** Introduce Parameter Object |
| **CS-9** | Switch Statements | Repeated switch/case logic, especially when switching on type code. | **R-5** Replace Conditional with Polymorphism, **R-6** Replace Type Code with Subclasses, **R-15** Replace Nested Conditional with Guard Clauses |
| **CS-10** | Lazy Class | A class that no longer earns its keep. | Inline Class, Collapse Hierarchy |
| **CS-11** | Speculative Generality | Hooks, hierarchies, parameters introduced "in case we need it someday." | Collapse Hierarchy, **R-2** Inline Function, Inline Class, Change Function Declaration, Remove Dead Code |
| **CS-12** | Temporary Field | A field that's only set under particular circumstances and otherwise empty. | Extract Class, Introduce Special Case (Null Object) |
| **CS-13** | Message Chains | `a.getB().getC().getD()` train wrecks coupling client to navigation structure. | Hide Delegate, **R-1** Extract Function + **R-4** Move Function |
| **CS-14** | Middle Man | A class delegating so much that it adds no value. | Remove Middle Man, **R-2** Inline Function, **R-17** Replace Subclass with Delegate, Replace Superclass with Delegate |
| **CS-15** | Insider Trading (formerly Inappropriate Intimacy, 2nd ed.) | Modules whispering to each other through private back-channels. | **R-4** Move Function, Move Field, Hide Delegate, **R-17** Replace Subclass with Delegate |
| **CS-16** | Refused Bequest | A subclass that doesn't want most of what the superclass offers. | Push Down Method, Push Down Field, **R-17** Replace Subclass with Delegate, Replace Superclass with Delegate |
| **CS-17** | Comments | Comments used as deodorant for bad code. *"When you feel the need to write a comment, first try to refactor the code so that any comment becomes superfluous."* | **R-1** Extract Function, Change Function Declaration, Introduce Assertion |

Source: *Refactoring* (1st ed. 1999, 2nd ed. 2018) Ch. 3, "Bad Smells in Code," co-authored with Kent Beck.

---

## R — Refactoring Catalog (named transformations)

Source: https://refactoring.com/catalog/ (companion to *Refactoring* 2nd ed. 2018; 1st-edition aliases shown via "—").

| Tag | Refactoring | What It Does | When to Use |
|---|---|---|---|
| **R-1** | Extract Function (formerly Extract Method) | Pull a fragment of code into its own function named after its intent. | Code fragment needs a comment to explain it, or you need to clarify what it does. |
| **R-2** | Inline Function (formerly Inline Method) | Replace a function call with the body of the function. | Body is just as clear as the name, or refactoring has rendered the indirection useless. |
| **R-3** | Extract Variable (formerly Introduce Explaining Variable) | Name a sub-expression to communicate intent. | An expression is hard to follow, especially inside long boolean or arithmetic chains. |
| **R-4** | Move Function (formerly Move Method) | Relocate a function to a context where it has stronger affinity (data it uses, callers it serves). | A function references another module's data more than its own (Feature Envy). |
| **R-5** | Replace Conditional with Polymorphism | Replace conditional logic that switches on type with a polymorphic dispatch. | A switch/if-else ladder distinguishes by type code or kind. |
| **R-6** | Replace Type Code with Subclasses | Replace a type-discriminating field with a subclass per type. | Behavior varies by type code and Replace Conditional with Polymorphism is the goal. |
| **R-7** | Encapsulate Variable (formerly Encapsulate Field / Self-Encapsulate Field) | Wrap data access in get/set functions to control or evolve it. | A piece of data is widely used and you need to monitor or modify access. |
| **R-8** | Combine Functions into Class | Bundle a set of functions that operate on the same data into a class. | A clump of functions share parameters and feel like they belong together. |
| **R-9** | Decompose Conditional | Extract the condition, then-clause, and else-clause each into intention-revealing functions. | A complex conditional obscures the decision being made. |
| **R-10** | Replace Loop with Pipeline | Replace an imperative loop with a chain of pipeline operations (filter, map, reduce). | A loop is doing collection-style work that would read more clearly as a pipeline. |
| **R-11** | Slide Statements | Move related statements adjacent to each other so subsequent extraction is clean. | Code that belongs together is interleaved with unrelated logic. |
| **R-12** | Split Loop | Break one loop doing two things into two loops each doing one thing. | A single loop has dual responsibilities, blocking extraction. |
| **R-13** | Replace Magic Literal (formerly Replace Magic Number with Symbolic Constant) | Replace a bare literal with a named constant. | A literal carries meaning that the name would explain. |
| **R-14** | Encapsulate Collection | Hide a collection field behind methods that mediate add/remove access. | Callers mutate a collection through its accessor, breaking ownership. |
| **R-15** | Replace Nested Conditional with Guard Clauses | Convert deeply nested conditionals into early-exit guard clauses. | The "happy path" is buried in nesting. |
| **R-16** | Introduce Parameter Object | Replace a recurring group of parameters with a single object. | The same parameter clump appears in multiple signatures (Data Clumps). |
| **R-17** | Replace Subclass with Delegate | Swap inheritance for delegation when the subclass relationship is causing pain. | Behavior reuse via inheritance is fragile or single-axis. |
| **R-18** | Substitute Algorithm | Replace one algorithm with a clearer one. | You've found a more straightforward way to do the same thing. |

---

## AP — Architecture Patterns (PoEAA, 2002)

| Tag | Pattern | Verbatim Definition | When to Use |
|---|---|---|---|
| **AP-1** | Domain Model | *"An object model of the domain that incorporates both behavior and data."* | Business logic is genuinely complex; team has OO maturity. |
| **AP-2** | Service Layer | *"Defines an application's boundary with a layer of services that establishes a set of available operations."* | Multiple kinds of clients (UI, batch, API) need consistent transactional boundaries. |
| **AP-3** | Active Record | *"An object that wraps a row in a database table or view, encapsulates the database access, and adds domain logic on that data."* | Domain logic is simple and follows database structure (Rails-style). |
| **AP-4** | Data Mapper | *"A layer of mappers that moves data between objects and a database while keeping them independent of each other."* | Domain model and schema diverge; want testable domain free of persistence concerns. |
| **AP-5** | Repository | *"Mediates between the domain and data mapping layers using a collection-like interface for accessing domain objects."* | Domain code wants to think in collections, not queries. |
| **AP-6** | Unit of Work | *"Maintains a list of objects affected by a business transaction and coordinates the writing out of changes."* | Need transactional consistency across many domain objects. |
| **AP-7** | Identity Map | *"Ensures that each object gets loaded only once by keeping every loaded object in a map."* | Want to avoid duplicate in-memory representations of the same row. |
| **AP-8** | Table Data Gateway | *"An object that acts as a gateway to a database table. One instance handles all the rows in the table."* | Lighter alternative to Data Mapper when you want SQL near the surface. |
| **AP-9** | Lazy Load | *"An object that doesn't contain all of the data you need but knows how to get it."* | Object graph is large and not all branches are accessed each request. |
| **AP-10** | Embedded Value | *"Maps an object into several fields of another object's table."* | Value objects (Money, DateRange) live as columns rather than separate rows. |
| **AP-11** | Transaction Script | *"Organizes business logic by procedures where each procedure handles a single request from the presentation."* | Simple CRUD-shaped logic; Domain Model is overkill. |

Source: https://martinfowler.com/eaaCatalog/ — Patterns of Enterprise Application Architecture (Fowler, Addison-Wesley, 2002).

---

## MS — Microservices Characteristics (Lewis & Fowler, 2014)

Source: https://martinfowler.com/articles/microservices.html

| Tag | Characteristic | Core idea |
|---|---|---|
| **MS-1** | Componentization via Services | Out-of-process components, independently replaceable and upgradeable. |
| **MS-2** | Organized around Business Capabilities | Cross-functional teams own product slices end-to-end. |
| **MS-3** | Products not Projects | Teams own products over their full lifetime. |
| **MS-4** | Smart endpoints and dumb pipes | Services own domain logic; transport stays simple (HTTP, message bus). |
| **MS-5** | Decentralized Governance | No single corporate-mandated technology platform. |
| **MS-6** | Decentralized Data Management | Each service owns its database. |
| **MS-7** | Infrastructure Automation | Automated test + deploy pipelines across all environments. |
| **MS-8** | Design for failure | Services tolerate failure of dependencies. |
| **MS-9** | Evolutionary Design | Service decomposition tracks how the application's behavior changes. |

---

## Anti-Patterns

| Tag | Name | Diagnosis | Prescription |
|---|---|---|---|
| **ADM-1** | Anemic Domain Model | Domain objects reduced to "bags of getters and setters" with all behavior in Service Layer. *"Incurs all of the costs of a domain model, without yielding any of the benefits."* | Move behavior back onto domain objects. If logic genuinely lives outside the domain, drop the domain model and use Transaction Script (AP-11) honestly. |
| **MS-FAIL-1** | Microservices-First (greenfield) | Building a new system as microservices from scratch. *"Almost all the cases […] ended up in serious trouble."* | Start with a monolith. Decompose only when service boundaries become knowable from production behavior (MonolithFirst, 2015). |
| **MS-FAIL-2** | Microservices Without Prerequisites | Adopting microservices without rapid provisioning, basic monitoring, rapid deployment. | *"You should be able to fire up a new server in a matter of hours."* Pay the prerequisites first or skip the style entirely. |
| **TS-DM-FB** | Transaction-Script-vs-Domain-Model False Binary | Treating the choice as ideological, not complexity-driven. | PoEAA Ch. 2 frames it as a complexity ramp: Transaction Script wins on simple CRUD; Domain Model earns its keep only when business logic is genuinely complex. |
| **UI-SL-LEAK** | UI Concerns Leaking into Service Layer | Presentation formatting, page state, view-model coupling bleeding through Service Layer operations. | Service Layer is the application's boundary; UI translation belongs in a UI-layer adapter. |
| **CQRS-OVERREACH** | Indiscriminate CQRS | Applying CQRS system-wide. | *"For most systems CQRS adds risky complexity."* Apply only to specific portions where read and write models genuinely diverge. |
| **DM-LIGHT** | Domain Model for Trivial Logic | Paying Domain Model overhead (Identity Map, Unit of Work, Lazy Load) for logic a Transaction Script handles in 20 lines. | Match pattern weight to logic weight. |

---

## Diagnostic Priority Order (Refactor workflow)

When code has multiple smells, diagnose in this order (worst-first):

1. **CS-1** — Long Function (the foundational smell — most other smells nest inside long functions)
2. **CS-6** — Feature Envy (move it where its data lives)
3. **CS-9** — Switch Statements (polymorphism beats type tags, with the FP/perf caveat in StepAsideTable)
4. **CS-3** — Long Parameter List (>3 params = parameter object)
5. **CS-7** — Data Clumps (recurring data sets earn an object)
6. **CS-13** — Message Chains (Demeter, train wrecks)
7. **CS-2** — Large Class
8. **CS-8** — Primitive Obsession
9. **CS-17** — Comments-as-deodorant
10. (remaining tags as situational)

**One smell, one named refactoring, one verbatim quote, one tradeoff. Save the rest for follow-up turns.**

---

## Quote-Pairing Index (which `QuoteBank.md` quote closes each tag)

| Tag | Closing quote ID(s) |
|---|---|
| CS-1 / CS-2 | 4 (cumulative effect of small transformations) |
| CS-6 | 13 (Data Clumps verbatim — adjacent reasoning) |
| CS-7 | 13 (Data Clumps verbatim) |
| CS-9 | 21 (smell as surface indication) |
| CS-13 | 14 (opportunistic refactoring) |
| CS-17 | 11 (when you need a comment, refactor) |
| R-1..R-18 (catalog use) | 3 (small behavior-preserving transformations) |
| AP-1..11 | 24–30 (PoEAA pattern definitions) |
| MS-1..9 | 31, 32 (microservices opening + characteristics framing) |
| ADM-1 | 47, 48 (Anemic Domain Model verbatim) |
| MS-FAIL-1 | 36, 37, 38 (MonolithFirst verbatim) |
| MS-FAIL-2 | 39, 40 (MicroservicePremium verbatim) |
| CQRS-OVERREACH | 49 (CQRS adds risky complexity) |
