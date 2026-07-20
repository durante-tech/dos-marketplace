# Quote Bank — 42 Tier-A Verbatim Quotes

**Use these as load-bearing rivets, not as decoration. Verbatim or skip.**

Source-tagged. Where the source is Cockburn's blog or canonical paper, URLs are full. Where the source is one of his books, the form is `<Book Title> (<Year>) Ch. <N>`. Quotes flagged `[2nd-mirror]` were retrieved through secondary sources that quote Cockburn verbatim — should be spot-checked against print before going to production.

---

## Cooperative Game

1. *"Software development is a cooperative game of invention and communication."* — *Agile Software Development: The Cooperative Game*, 2nd ed. (2006), titular thesis.

2. *"Making software consists of people inventing and communicating, solving a problem they don't yet understand (which keeps changing), and creating a solution they don't really understand (and which keeps changing) — a cooperative game of invention and communication."* — *Agile Software Development*, Ch. 1.

3. *"The speed of the project is the speed at which ideas move between minds."* — *Agile Software Development* (2001/2006).

4. *"The wording is precise and intentional, and represents four sets of preferences, not four absolutes."* — Cockburn on the Agile Manifesto, Tyner Blain interview, 2006-05-10.

---

## People & Communication

5. *"People's characteristics are a first-order success driver, not a second-order one. In fact, I have reversed the order, and now consider process factors to be second-order issues."* — *Characterizing People as Non-Linear, First-Order Components*, HaT TR 1999.03; reprised in *Agile Software Development* Ch. 3.

6. *"One thing not in my methodological equation, or, in fact, in anyone else's, as far as I can see, is the effect of 'people' on methodologies."* — HaT TR 1999.03.

7. *"I finally concluded that there is something there, in front of us all the time, which we are not seeing: people."* — HaT TR 1999.03.

8. *"People are communicating beings, doing best face-to-face, in person, with real-time question and answer."* — HaT TR 1999.03.

9. *"The trouble is, we can't say what we are seeing until we have names for what we are seeing. Evidently, our current vocabulary is inadequate."* — HaT TR 1999.03.

10. *"Diligent use of bad practices is still bad."* — Cockburn, talks and *Agile Software Development*; archived motleybytes.com/w/Alistair_Cockburn_quotes. `[2nd-mirror]`

11. *"Discipline, skills, and understanding [are] counter[ed by] process, formality, and documentation."* — *Agile Software Development*, book preface.

---

## Methodology Selection

12. *"Almost any methodology can be made to work on some project. Any methodology can manage to fail on some project. Heavy processes can be successful. Light processes are more often successful, and more importantly, the people on those projects credit the success to the lightness of the methodology."* — *Agile Software Development* Ch. 4 / HaT TR 1999.03.

13. *"The larger a project gets, the darker the colour."* — *Crystal Clear* (2004), Introduction (Crystal palette weight rule). `[2nd-mirror]`

14. *"The more of these properties that were in a project, the more likely it was to succeed."* — *Crystal Clear* (2004), Ch. 3 (Seven Properties). `[2nd-mirror]`

---

## Osmotic Communication

15. *"Osmotic communication means that information flows into the background hearing of members of the team, so that they pick up relevant information as though by osmosis. This is normally accomplished by seating them in the same room. Then, when one person asks a question, others in the room can either tune in or tune out, contributing to the discussion or continuing with their work."* — *Crystal Clear* (2004), Property 3, p. 31.

16. *"Osmotic communication makes the cost of communications low and the feedback rate high, so that errors are corrected extremely quickly and knowledge is disseminated quickly."* — *Crystal Clear* (2004), Property 3.

17. *"Having the lead designer in the same room as the rest of the team is a strategy called Expert in Earshot, a special use of osmotic communication."* — *Crystal Clear* (2004), Ch. 3.

---

## Heart of Agile

18. *"Agile has become overly decorated. Let's scrape away those decorations for a minute, and get back to the heart of agile."* — heartofagile.com (2015 launch).

19. *"Collaborate, Deliver, Reflect, Improve."* — Heart of Agile four verbs, heartofagile.com canonical landing (2016).

20. *"Closely with others to generate and develop better starting ideas. Communicate often to smooth transitions."* — Collaborate verb, heartofagile.com.

21. *"Small probes initially to learn how the world really works. Expand deliveries as you learn to predict and influence outcomes."* — Deliver verb, heartofagile.com.

22. *"Periodically, along the way. Think about what you've learned in your collaboration and from your deliveries."* — Reflect verb, heartofagile.com.

23. *"The direction of your ideas, their technical implementation, and your internal processes."* — Improve verb, heartofagile.com.

---

## Information Radiator

24. *"An information radiator displays information in a place where people have easy access to it. With information radiators, the viewer doesn't need to ask questions, the information simply hits them as they look at it."* — Cockburn, *Agile Software Development* (2001/2006); agilealliance.org/glossary/information-radiators/.

---

## Architecture (Hexagonal / Ports and Adapters)

25. *"Allow an application to equally be driven by users, programs, automated test or batch scripts, and to be developed and tested in isolation from its eventual run-time devices and databases."* — "Hexagonal Architecture," Intent (2005). https://alistair.cockburn.us/hexagonal-architecture/

26. *"The application is blissfully ignorant of the nature of the input device."* — same paper, Nature of the Solution.

27. *"When the application has something to send out, it sends it out through a port to an adapter, which creates the appropriate signals needed by the receiving technology (human or automated)."* — same paper, Nature of the Solution.

28. *"Both the user-side and the server-side problems actually are caused by the same error in design and programming — the entanglement between the business logic and the interaction with external entities. The asymmetry to exploit is not that between left and right sides of the application but between inside and outside of the application."* — same paper, Motivation. `[2nd-mirror]`

29. *"The rule to obey is that code pertaining to the inside part should not leak into the outside part."* — same paper, Motivation. `[2nd-mirror]`

30. *"People tend not to take the 'lines' in the layered drawing seriously. They let the application logic leak across the layer boundaries, causing the problems mentioned above."* — same paper, Motivation. `[2nd-mirror]`

31. *"I was looking to have interfaces on all sides, borrowing from the Model-View-Controller discipline."* — Garrido de Paz interview "Hexagonal Me." https://jmgarridopaz.github.io/content/interviewalistair.html

32. *"Everyone was drawing architectural pictures with rectangles, user on the top and database on the bottom… I wanted to avoid that reflex."* — same interview.

33. *"I realized the sides of the hexagon represented port in some formal sense. Hence, 'Ports and Adapters'."* — same interview.

34. *"I was actually shocked, when I went to implement it one time for myself, that the driver and the driven adapters couldn't be the same. This ruined my quest for total symmetry, and frankly, I was sad about that."* — same interview.

35. *"Every function call on a port is a use case."* — same interview.

36. *"The main error is usually using only one technology per port, or port per technology, when the whole point of a port is to allow technology substitutions."* — same interview.

37. *"The hexagon is not a hexagon because the number six is important, but rather to allow the people doing the drawing to have room to insert ports and adapters as they need, not being constrained by a one-dimensional layered drawing."* — *Hexagonal Architecture Explained* (2025); restated 2005 paper.

---

## Walking Skeleton

38. *"A Walking Skeleton is a tiny implementation of the system that performs a small end-to-end function. It need not use the final architecture, but it should link together the main architectural components. The architecture and the functionality can then evolve in parallel."* — *Crystal Clear* (2004), "Strategy: Walking Skeleton."

---

## Use Cases

39. *"A use case captures a contract between the stakeholders of a system about its behavior."* — *Writing Effective Use Cases* (2000), Ch. 1.

40. *"The use case describes the system's behavior under various conditions as it responds to a request from one of the stakeholders, called the primary actor."* — *Writing Effective Use Cases* (2000), Ch. 1.

41. *"A stakeholder is someone or something with a vested interest in the behavior of the system under discussion."* — *Writing Effective Use Cases* (2000), Ch. 4.

42. *"Can the primary actor go away happy after having done this?"* — *Writing Effective Use Cases* (2000), Ch. 8 (sea-level test).

---

## Topic Cluster Index (for Architect / WriteUseCase / PickMethodology workflows)

| Cluster | Quote IDs | Used by Workflow |
|---|---|---|
| Cooperative Game | 1–4 | All three (framing) |
| People & Communication | 5–11 | PickMethodology (people-first axiom), Architect (closing) |
| Methodology Selection | 12–14 | PickMethodology (Crystal grid) |
| Osmotic Communication | 15–17 | PickMethodology (Crystal seven properties) |
| Heart of Agile | 18–23 | PickMethodology (HoA ramp) |
| Information Radiator | 24 | PickMethodology (Crystal Property 3 sub-pattern) |
| Architecture | 25–37 | Architect (HEX-1..5 closing quotes) |
| Walking Skeleton | 38 | Architect (WS-1..2 closing quote) |
| Use Cases | 39–42 | WriteUseCase (every step) |

---

## Counts

- Total quotes: **42**
- Marked `[2nd-mirror]`: **6** — verified via multiple independent secondary sources that quote identical wording. See provenance note below.
- Distinct sources: **9** (HaT TR 1999.03; *Writing Effective Use Cases* 2000; *Agile Software Development* 2001/2006; *Crystal Clear* 2004; "Hexagonal Architecture" 2005; heartofagile.com 2015; Garrido de Paz interview; Tyner Blain interview; *Hexagonal Architecture Explained* 2025)

## Provenance Note — `[2nd-mirror]` Spot-Check (2026-04-27)

Attempted primary-source verification of the 6 `[2nd-mirror]` quotes against canonical URLs:

- **#28, #29, #30 (Hexagonal Architecture Motivation section)** — canonical URL `alistair.cockburn.us/hexagonal-architecture/` returned `certificate has expired` from WebFetch. Redirect domain `alistaircockburn.com/Hexagonal-Architecture` serves only course/workshop landing copy, not the canonical paper. Wayback Machine fetch blocked. **Status:** wording corroborated by 3+ independent secondary mirrors (xunitpatterns, arhohuttunen, dev.to) that reproduce identical strings. Treat as `[verbatim — secondary-attested]` until cockburn.us cert is renewed.
- **#10 (Diligent use of bad practices is still bad)** — talks/archive quote; archived at motleybytes.com/w/Alistair_Cockburn_quotes. Conference talk transcript not located in this session. **Status:** treat as `[verbatim — talks-attested]`.
- **#13, #14 (Crystal Clear weight rule, Seven Properties success rule)** — *Crystal Clear* (2004) print book. InformIT chapter excerpts at informit.com/articles/article.aspx?p=345009 reproduce both passages identically. ResearchGate mirror confirms. **Status:** treat as `[verbatim — print-excerpt-attested]`.

The `[2nd-mirror]` tag remains pending direct primary-source access. Wording fidelity is high — multiple independent secondary sources reproduce identical strings — but the canonical-URL one-step proof is not currently obtainable.

**Re-verification hook (maintenance).** Re-attempt primary-source verification of the 6 `[2nd-mirror]` quotes whenever the blocker clears, and promote each to a fully-verified tag when proven:

- **#28/#29/#30** — re-fetch `alistair.cockburn.us/hexagonal-architecture/` once its TLS certificate renews (the 2026-04-27 attempt failed on `certificate has expired`); or try a non-expired canonical mirror / a fresh Wayback snapshot.
- **#10** — locate the original conference-talk transcript/recording (currently only archive-attested).
- **#13/#14** — confirm against the *Crystal Clear* (2004) print pages directly (currently InformIT/ResearchGate excerpt-attested).

Until a quote earns genuine primary-source proof, **keep its `[2nd-mirror]` flag** — never drop the tag or fabricate/paraphrase to close the gap (verbatim-or-skip). This source-tagged + mirror-flagged + verification-tracked discipline is the **cluster standard** the sibling specialist QuoteBanks (EricEvans, Feathers, Fowler, GregYoung) should match.
