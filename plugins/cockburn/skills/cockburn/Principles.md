# Principles — Hexagonal + Use Cases + Crystal + Heart of Agile + Cooperative Game

**All verbatim. Source-tagged. The full canonical reference for the future Cockburn skill.**

---

## Hexagonal Architecture (Ports and Adapters)

**Origin:** Cockburn first published this on his blog in 2005, after circulating the pattern (originally without a name, then briefly as "Hexagonal") for roughly a decade. The 2005 paper renamed it "Ports and Adapters" because *"the hexagon is not a hexagon because the number six is important, but rather to allow the people doing the drawing to have room to insert ports and adapters as they need."* Updated 1st edition published as *Hexagonal Architecture Explained* (with Juan Manuel Garrido Paz, 2025).

### Intent (canonical 2005 statement)

> *"Allow an application to equally be driven by users, programs, automated test or batch scripts, and to be developed and tested in isolation from its eventual run-time devices and databases."*

Source: Cockburn, "Hexagonal Architecture" (2005, revised through 2022). https://alistair.cockburn.us/hexagonal-architecture/ — opening "Intent" section.

### Operational definition (Ports and Adapters)

> *"As events arrive from the outside world at a port, a technology-specific adapter converts it into a usable procedure call or message and passes it to the application. The application is blissfully ignorant of the nature of the input device. When the application has something to send out, it sends it out through a port to an adapter, which creates the appropriate signals needed by the receiving technology (human or automated)."*

Source: Cockburn, same paper, "Nature of the Solution" section.

### Motivation (the asymmetry to exploit)

> *"Both the user-side and the server-side problems actually are caused by the same error in design and programming — the entanglement between the business logic and the interaction with external entities. The asymmetry to exploit is not that between left and right sides of the application but between inside and outside of the application."*

> *"The rule to obey is that code pertaining to the inside part should not leak into the outside part."*

> *"People tend not to take the 'lines' in the layered drawing seriously. They let the application logic leak across the layer boundaries, causing the problems mentioned above."*

Source: same paper, "Motivation" section.

### Cockburn's retrospective (2024 interview with Garrido de Paz)

> *"I was looking to have interfaces on all sides, borrowing from the Model-View-Controller discipline."*

> *"Everyone was drawing architectural pictures with rectangles, user on the top and database on the bottom… I wanted to avoid that reflex."*

> *"I realized the sides of the hexagon represented port in some formal sense. Hence, 'Ports and Adapters'."*

> *"I was actually shocked, when I went to implement it one time for myself, that the driver and the driven adapters couldn't be the same. This ruined my quest for total symmetry, and frankly, I was sad about that."*

> *"Every function call on a port is a use case."*

> *"The main error is usually using only one technology per port, or port per technology, when the whole point of a port is to allow technology substitutions."*

Source: Juan Manuel Garrido de Paz, "Interview with Alistair Cockburn — Hexagonal Architecture." https://jmgarridopaz.github.io/content/interviewalistair.html

### The hexagon as drawing affordance (2005/2025)

> *"The hexagon is not a hexagon because the number six is important, but rather to allow the people doing the drawing to have room to insert ports and adapters as they need, not being constrained by a one-dimensional layered drawing."*

Source: Cockburn, "Hexagonal Architecture" (2005, restated in *Hexagonal Architecture Explained* 2025).

---

## Walking Skeleton

**Canonical definition:**

> *"A Walking Skeleton is a tiny implementation of the system that performs a small end-to-end function. It need not use the final architecture, but it should link together the main architectural components. The architecture and the functionality can then evolve in parallel."*

Source: Cockburn, *Crystal Clear: A Human-Powered Methodology for Small Teams* (Addison-Wesley, 2004), "Strategy: Walking Skeleton."

**Coaching rule:** Build the walking skeleton FIRST. Each subsequent feature is a fattening of an already-walking system, not an integration risk deferred to a later sprint. Operational TDD-from-scratch ritual: Steve Freeman & Nat Pryce, *Growing Object-Oriented Software, Guided by Tests* (2009).

---

## Software Development as a Cooperative Game

> *"Software development is a cooperative game of invention and communication."*

> *"Making software consists of people inventing and communicating, solving a problem they don't yet understand (which keeps changing), and creating a solution they don't really understand (and which keeps changing) — a cooperative game of invention and communication."*

Source: Cockburn, *Agile Software Development: The Cooperative Game*, 2nd ed. (Addison-Wesley, 2006), Ch. 1 — the framing the book's subtitle names. 1st ed. 2001.

**Cooperative game in the technical sense** (Bernard Suits, Wittgenstein): bounded, rule-governed, played for stakes. Cockburn distinguishes finite-game (this release) from infinite-game (the long career).

---

## Crystal Family — Selection Grid

**Axes:**
- Vertical: **Criticality** — letters **C** (Comfort), **D** (Discretionary money), **E** (Essential money), **L** (Life).
- Horizontal: **Team size** — bands 1–6, 6–20, 20–40, 40–80, 80–200.

**Naming convention:** A project is named by the (criticality, size) pair. *"A two-person life-critical project is L6"*; *"a 50-person project that could jeopardize organizational profits but not existence is D100."*

**Color-weight progression:**
- *Crystal Clear* — ≤6 people
- *Crystal Yellow* — ≤20 people
- *Crystal Orange* — ≤40 people
- *Crystal Red* — ≤80 people
- *Crystal Maroon* — ≤200 people
- *Crystal Diamond* and *Crystal Sapphire* — large projects with potential risk to human life

> *"The larger a project gets, the darker the colour."*

Source: Cockburn, *Crystal Clear* (2004), Introduction; also *Agile Software Development* 2nd ed. Ch. 4.

---

## Crystal Clear — The Seven Properties

1. Frequent Delivery
2. Reflective Improvement
3. Osmotic Communication (close communication)
4. Personal Safety
5. Focus
6. Easy Access to Expert Users
7. Technical Environment with Automated Tests, Configuration Management, and Frequent Integration

> *"The more of these properties that were in a project, the more likely it was to succeed."*

Source: Cockburn, *Crystal Clear* (2004), Chapters 2–3. Chapter excerpt at informit.com/articles/article.aspx?p=345009.

---

## Osmotic Communication

> *"Osmotic communication means that information flows into the background hearing of members of the team, so that they pick up relevant information as though by osmosis. This is normally accomplished by seating them in the same room. Then, when one person asks a question, others in the room can either tune in or tune out, contributing to the discussion or continuing with their work."*

> *"Osmotic communication makes the cost of communications low and the feedback rate high, so that errors are corrected extremely quickly and knowledge is disseminated quickly."*

Source: *Crystal Clear* (2004), Property 3, p. 31. informit.com/articles/article.aspx?p=345009&seqNum=3.

### Expert in Earshot (sub-pattern)

> *"Having the lead designer in the same room as the rest of the team is a strategy called Expert in Earshot, a special use of osmotic communication."*

Source: *Crystal Clear* (2004), Ch. 3.

---

## Heart of Agile — Four Verbs

Launched 2015 (formally published in *CrossTalk* Nov/Dec 2016 as "Beyond the Agile Manifesto"). Verbatim from heartofagile.com canonical landing:

- **Collaborate** — *"Closely with others to generate and develop better starting ideas. Communicate often to smooth transitions."*
- **Deliver** — *"Small probes initially to learn how the world really works. Expand deliveries as you learn to predict and influence outcomes."*
- **Reflect** — *"Periodically, along the way. Think about what you've learned in your collaboration and from your deliveries."*
- **Improve** — *"The direction of your ideas, their technical implementation, and your internal processes."*

**Cockburn's framing:**

> *"Agile has become overly decorated. Let's scrape away those decorations for a minute, and get back to the heart of agile."*

Source: heartofagile.com (canonical landing + /lets-begin/), 2015 launch / 2016 *CrossTalk* publication.

---

## Information Radiator

> *"An information radiator displays information in a place where people have easy access to it. With information radiators, the viewer doesn't need to ask questions, the information simply hits them as they look at it."*

Source: Cockburn, *Agile Software Development* (2001/2006). Glossary entry at agilealliance.org/glossary/information-radiators/.

**Origin:** Term coined by Cockburn in 2001 as part of an extended metaphor equating the dispersion of information with the dispersion of heat and gas. Kent Beck's parallel coinage *"Big Visible Chart"* (in *Extreme Programming Explained*, attributed to Martin Fowler) is commonly cross-referenced.

---

## Shu-Ha-Ri (applied to software learning)

Cockburn imported the Aikido-derived three-stage model into software methodology learning.

- **Shu** — *"Students follow the teachings of one master precisely. They concentrate on how to do the task, without worrying too much about the underlying theory. If there are multiple variations on how to do the task, they concentrate on just the one way their master teaches them."*
- **Ha** — *"Students begin to branch out. They start to learn the underlying principles and theory behind the technique. They also start learning from other masters and integrate that learning into their practice."*
- **Ri** — *"The student isn't learning from other people, but from his own practice. He creates his own approaches and adapts what he's learned to his own particular circumstances."*

Source: Cockburn, *Agile Software Development* (2001/2006), Ch. 8 "What Should I Do Tomorrow?"; image asset at heartofagile.com/wp-content/uploads/2019/08/Shu-Ha-Ri.pdf. Cross-referenced at martinfowler.com/bliki/ShuHaRi.html.

---

## People as First-Order, Process as Second-Order

> *"People's characteristics are a first-order success driver, not a second-order one. In fact, I have reversed the order, and now consider process factors to be second-order issues."*

> *"One thing not in my methodological equation, or, in fact, in anyone else's, as far as I can see, is the effect of 'people' on methodologies."*

> *"I finally concluded that there is something there, in front of us all the time, which we are not seeing: people."*

> *"People are communicating beings, doing best face-to-face, in person, with real-time question and answer."*

Source: Cockburn, *Characterizing People as Non-Linear, First-Order Components in Software Development*, Humans and Technology Technical Report TR 99.05 (1999); reprised in *Agile Software Development* Ch. 3.

---

## Methodology Weight & Fit

> *"Almost any methodology can be made to work on some project. Any methodology can manage to fail on some project. Heavy processes can be successful. Light processes are more often successful, and more importantly, the people on those projects credit the success to the lightness of the methodology."*

> *"Diligent use of bad practices is still bad."*

> *"The trouble is, we can't say what we are seeing until we have names for what we are seeing. Evidently, our current vocabulary is inadequate."*

Source: Cockburn, *Agile Software Development* Ch. 4 (methodology size & weight); HaT TR 1999.03.

---

## Use Cases (Writing Effective Use Cases, 2000)

### Use case as contract between stakeholders

> *"A use case captures a contract between the stakeholders of a system about its behavior. The use case describes the system's behavior under various conditions as it responds to a request from one of the stakeholders, called the primary actor."*

Source: *Writing Effective Use Cases* (Cockburn, Addison-Wesley, 2000), Ch. 1.

### Stakeholder

> *"A stakeholder is someone or something with a vested interest in the behavior of the system under discussion (SuD)."*

Source: same book, Ch. 3 / Ch. 4.

### Primary actor

> *"The primary actor of a use case is the stakeholder that calls on the system to deliver one of its services. It has a goal with respect to the system — one that can be satisfied by its operation."*

Source: same book, Ch. 4.

### Supporting (secondary) actor

> *"A supporting actor in a use case is an external actor that provides a service to the system under design… We used to call this a secondary actor, but people found the term confusing."*

Source: same book, Ch. 4; reprised in *Use-Case Foundation* (Jacobson & Cockburn, 2003).

### Goal Levels — Cloud / Kite / Sea / Fish / Clam

The five icons from the sea-level metaphor (*Writing Effective Use Cases*, 2000, Ch. 8 "Goal Levels"):

| Icon | Level | Meaning | Test |
|---|---|---|---|
| ☁️ **Cloud** | Very High Summary | "Way up in the sky"; multi-system or multi-year strategic context. | Strategic alignment. |
| 🪁 **Kite** | Summary | Overview of several user-goal cases as a single life-cycle thread. | Useful as a roadmap. |
| 🌊 **Sea** | User-Goal | "The most important" level. | *"Can the primary actor go away happy after having done this?"* |
| 🐟 **Fish (indigo)** | Subfunction | "Just below the surface"; required by user-goal cases but not a complete goal. | Reused by ≥2 sea-level cases. |
| 🦪 **Clam (black)** | Too Low | "Right at the bottom of the sea where little light reaches." | *"There will often be value in writing use cases at the indigo level, but almost never at the black level."* |

Source: *Writing Effective Use Cases* (2000), Ch. 8.

### Templates: Brief / Casual / Fully Dressed

- **Brief** — a few sentences summarizing the use case, often the main success scenario as a paragraph.
- **Casual** — *"a paragraph or two of text, informally describing what happens"*; fields limited to title (goal), primary actor, scope/level.
- **Fully Dressed** — adds: Title, Primary Actor, Goal in Context, Scope, Level, Stakeholders and Interests, Precondition, Minimal Guarantees, Success Guarantees, Trigger, Main Success Scenario, Extensions, Technology & Data Variations.

Source: *Writing Effective Use Cases* (2000), Ch. 6 / Ch. 7.

---

## The Manifesto for Agile Software Development (2001)

Co-signed at Snowbird, Utah, February 2001 by Cockburn and sixteen others. Cockburn on the wording:

> *"The wording is precise and intentional, and represents four sets of preferences, not four absolutes."*

Source: Tyner Blain interview with Cockburn, 2006-05-10. tynerblain.com/blog/2006/05/10/agile-values-alistair-cockburn-on-the-agile-manifesto/

---

## The Speed Axiom

> *"The speed of the project is the speed at which ideas move between minds."*

Source: Cockburn, *Agile Software Development* (2001/2006), repeated in Crystal materials and Heart of Agile talks.

---

## Discipline / Process Trade

> *"Discipline, skills, and understanding [are] counter[ed by] process, formality, and documentation."*

Source: Cockburn, *Agile Software Development*, book preface — the trade space the book argues across.
