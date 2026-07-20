# Lookup — Cockburn-Tagged Anti-Patterns

**The Architect / WriteUseCase / PickMethodology workflows emit findings keyed by these tags.** When a user reads `HEX-3: Port/Tech Conflation`, they look up the pattern here and find the diagnosis + prescription.

Tag namespaces:
- **HEX-N** — Hexagonal Architecture violations (5 patterns)
- **WS-N** — Walking Skeleton violations (2 patterns)
- **M-N** — Methodology weight / fit / characters violations (5 patterns)
- **HoA-N** — Heart of Agile decoration / verb-skipping (3 patterns)
- **UC-N** — Use Case structure / level / actor violations (6 patterns)

Total: 21 patterns.

---

## HEX — Hexagonal Architecture (Architect workflow)

| Tag | Smell | Diagnosis | Prescription |
|---|---|---|---|
| **HEX-1** | Inside/Outside Entanglement | Business logic mixed with interaction code (UI, persistence, framework). Cannot test business rules without booting the GUI or the database. Cockburn: *"the entanglement between the business logic and the interaction with external entities."* | Push interaction concerns out behind a port. The application is a pure inside that talks to the outside only through named ports. |
| **HEX-2** | Layer-Line Leak | Layered diagrams treated as suggestions, not barriers. Domain types import HTTP/ORM/framework types. Cockburn: *"People tend not to take the 'lines' in the layered drawing seriously."* | Replace stacked-layer mental model with the inside/outside hexagon. Install a regression test that fails the moment infrastructure types appear in domain code. |
| **HEX-3** | Port/Tech Conflation | Port treated as a 1:1 wrapper around the technology — `PostgresPort`, `KafkaPort`. Cockburn: *"the main error is usually using only one technology per port, or port per technology, when the whole point of a port is to allow technology substitutions."* | Name ports by the conversation, not the technology — `ForFetchingProducts`, `ForNotifyingCustomers`. Multiple technology-specific adapters MUST be substitutable behind the same port. |
| **HEX-4** | Symmetric-Adapter Fallacy | Trying to use one adapter for both driving and driven sides. Cockburn confessed: *"the driver and the driven adapters couldn't be the same. This ruined my quest for total symmetry."* | Keep the asymmetry. Primary (driving) ports take calls from outside; secondary (driven) ports get called by the inside. Each side has its own port, its own adapter, its own contract. |
| **HEX-5** | Framework-Coupled Domain | Business logic carries framework annotations, lifecycle hooks, container types. The framework has crossed the port. | The framework is a driving adapter, not a host. Domain code must compile and test without it. |

---

## WS — Walking Skeleton (Architect workflow)

| Tag | Smell | Diagnosis | Prescription |
|---|---|---|---|
| **WS-1** | Stilt Walker (Faked Skeleton) | Team claims a Walking Skeleton but stubs the integration points (in-memory queue pretending to be Kafka, fake auth). The skeleton does not actually walk end-to-end through the real architectural components. | Cockburn requires the skeleton to *"link together the main architectural components."* Real connectors, even if trivial requests. If you skipped the integration, you built a prototype, not a skeleton. |
| **WS-2** | Late-Skeleton Anti-Pattern | Architecture and feature work proceed in parallel without a thin end-to-end path; integration deferred until "everything is ready." | *"The architecture and the functionality can then evolve in parallel."* Build the walking skeleton FIRST so each subsequent feature is a fattening of an already-walking system. |

---

## M — Methodology Weight & Fit (PickMethodology workflow)

| Tag | Smell | Diagnosis | Prescription |
|---|---|---|---|
| **M-1** | Heavy Methodology / Small Team | A team that could survive on Crystal Clear is forced into RUP/SAFe ceremony. Communication degrades from osmosis to artifact. Cycle time inflates 5–10×. | Step down to the lightest methodology that fits the (criticality, size) cell on the Crystal grid. *"Light processes are more often successful."* |
| **M-2** | Warm Bodies — Process Pretends People Are Interchangeable | Methodology specified abstractly with named roles. Actual humans on the team have personality profiles, talents, and friction patterns the methodology never accounts for. | Cockburn's "characters not roles" framing — design the methodology for the specific people you have, not for an idealized resource. *"People's characteristics are a first-order success driver."* |
| **M-3** | Methodology Weight Mismatched to Criticality | A C6 "comfort" team adopts the Diamond-weight ceremonies appropriate to L200; or an E40 "essential money" team runs Crystal Clear without independent verification. | Re-locate on the Crystal grid. *More criticality demands more verification, more weight; lower criticality justifies less.* |
| **M-4** | Mandate-Driven Methodology, No Retrospective Fit | Org-wide framework rolled out top-down. No team has done **Reflect → Improve** to localize it. | Heart of Agile: Reflect periodically. Methodology is the team's property, refined locally, not a corporate artifact. |
| **M-5** | Bad Practices Diligently Applied | Team is rigorous about ceremonies whose intent has eroded. Standups are status updates to a manager. Retros produce no Improve actions. | *"Diligent use of bad practices is still bad."* Audit each practice: what's the original intent? Is it still being served? If not, drop or replace. |

---

## HoA — Heart of Agile (PickMethodology workflow)

| Tag | Smell | Diagnosis | Prescription |
|---|---|---|---|
| **HoA-1** | Decorating Agile | Adding ceremonies, certifications, frameworks-of-frameworks to dress up agile until the four verbs are buried under apparatus. | *"Scrape away those decorations."* Return to Collaborate, Deliver, Reflect, Improve. |
| **HoA-2** | Skipping Reflect or Improve | Teams collaborate and deliver but never look back. No learning loop; same defects ship every sprint. | A two-cycle Heart of Agile rule: Reflect must produce a named Improve action before next cycle starts. |
| **HoA-3** | Single-Verb Agile | One verb performed (often Collaborate as ritual standup), other three absent. | Agile is the conjunction of all four verbs — none is sufficient alone. |

---

## UC — Use Cases (WriteUseCase workflow)

| Tag | Smell | Diagnosis | Prescription |
|---|---|---|---|
| **UC-1** | Wrong Goal Level | Author drifts up to summary or down to subfunction without intent. The case isn't at the level it claims. | Apply the sea-level test: *"Can the primary actor go away happy after having done this?"* Re-tag Cloud/Kite/Sea/Fish/Clam; promote or demote to the level whose icon fits. |
| **UC-2** | Implementation Creep into Essentials | UI mechanics (clicks, fields, screens) appearing in a use case meant to capture business intent. The case names a button or a screen widget. | Rewrite at "user intention / system responsibility" — Constantine's essential-use-case pattern, which Cockburn recommends in *Writing Effective Use Cases* Ch. 10. |
| **UC-3** | Sub-Flow Explosion | Dozens of branches and sub-flows. The Extensions section dwarfs the Main Success Scenario. | Split into separate use cases at sea level. Only sea-level cases earn Fully Dressed treatment. |
| **UC-4** | Missing Stakeholder / Unprotected Interest | A real interest (audit, regulator, off-stage actor) is silently violated by the success scenario. | Run the Stakeholders and Interests brainstorm. Any interest unsatisfied by main scenario or extensions is a hole. Extend until the combination of happy path and extensions satisfies nearly all stakeholder interests. |
| **UC-5** | Use Cases Counted as Project Plan | Burn-down by use-case count. Use cases used as scheduling units. | Use cases describe behavior under contract; user stories and slices drive scheduling. (See Cockburn, *Use Cases are Essential*, ACM Queue, 2023.) |
| **UC-6** | No Actor / No Goal | A case that describes a process with no triggering primary actor. | Re-cast as `<Actor> <verbs the goal>` or demote to a subfunction of a real sea-level case. The title must be a verb-phrase a person or system would name as a goal. |

---

## Diagnostic Priority Order

When code/document has multiple smells, diagnose in this order (worst-first):

1. **HEX-1** — Inside/Outside Entanglement (the foundational architectural error)
2. **HEX-2** — Layer-Line Leak (the runner-up — observed wherever HEX-1 isn't yet visible)
3. **HEX-5** — Framework-Coupled Domain (a special case of HEX-2 that's worth its own tag)
4. **HEX-3** — Port/Tech Conflation
5. **HEX-4** — Symmetric-Adapter Fallacy
6. **WS-1 / WS-2** — Walking Skeleton violations (project-level smells, not file-level)
7. **UC-2** — Implementation Creep into Essentials (use case version of HEX-1)
8. **UC-1** — Wrong Goal Level (the most common use case smell)
9. **UC-4** — Missing Stakeholder
10. **M-3** — Methodology Weight Mismatch (largest project-level cost)
11. **M-1** — Heavy Methodology / Small Team
12. **HoA-1** — Decorating Agile
13. **M-2** — Warm Bodies (people-blindness)
14. (remaining tags as situational)

**One smell, one named fix, one verbatim quote, one observation. Save the rest for follow-up turns.**

---

## Quote-Pairing Index (which `QuoteBank.md` quote closes each tag)

| Tag | Closing quote ID(s) |
|---|---|
| HEX-1 | 28 (asymmetry inside/outside) |
| HEX-2 | 30 (lines not taken seriously) |
| HEX-3 | 36 (one-tech-per-port error) |
| HEX-4 | 34 (driver/driven asymmetry) |
| HEX-5 | 26 (blissfully ignorant) |
| WS-1 / WS-2 | 38 (walking skeleton verbatim) |
| M-1 / M-3 | 12 (light vs heavy processes) |
| M-2 | 5 (people first-order) |
| M-5 | 10 (diligent bad practices) |
| HoA-1 | 18 (scrape away decorations) |
| HoA-2 / HoA-3 | 19 (four verbs verbatim) |
| UC-1 | 42 (sea-level test) |
| UC-2 | 39 (use case as contract) |
| UC-4 | 41 (stakeholder definition) |
| UC-5 | 40 (use case describes behavior) |
| UC-6 | 40 (primary actor centrality) |
