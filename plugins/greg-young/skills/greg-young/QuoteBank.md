# Greg Young — Quote Bank

Source legend:
- **CQRS-Docs** = Greg Young, *CQRS Documents* (2010 free PDF — verified live at cqrs.wordpress.com/wp-content/uploads/2010/11/cqrs_documents.pdf)
- **CotB-2014** = Greg Young, *"CQRS and Event Sourcing"* — Code on the Beach 2014 transcript at kurrent.io (WebFetch verified)
- **GFY-2012** = Greg Young, *"Functional Domain Models and Event Sourcing"*, gregfyoung.wordpress.com 2012-10-01 (verified)
- **Kurrent-WIES** = kurrent.io/blog/what-is-event-sourcing (verified canonical Event Store framing)
- **Fowler-CQRS** = Martin Fowler, bliki *"CQRS"* 2011-07-14 (verified)
- **DDDeu-2016** = DDD Europe 2016 speaker page (verified)
- **InfoQ-8L** = Greg Young, *"8 Lines of Code"* InfoQ talk (QCon London 2013, published 2013-06-11 — verified)
- **Kurrent-PR** = Kurrent press release 2024-12-18 announcing rebrand + $12M raise (verified)

Per IP-safety stance: Young's corpus is heavily public; verbatim density correspondingly high.

---

## Cluster 1 — CQRS Canonical Definition

1. *"CQRS is simply the creation of two objects where there was previously only one."* — CQRS-Docs 2010 [verbatim]
2. *"in CQRS objects are split into two objects, one containing the Commands one containing the Queries."* — CQRS-Docs 2010 [verbatim]
3. *"Command and Query Responsibility Segregation uses the same definition of Commands and Queries that Meyer used and maintains the viewpoint that they should be pure."* — CQRS-Docs 2010 [verbatim]
4. *"CQRS stands for Command Query Responsibility Segregation. At its heart is the notion that you can use a different model to update information than the model you use to read information."* — Fowler-CQRS 2011-07-14 [verbatim]
5. *"It's a pattern that I first heard described by Greg Young."* — Fowler-CQRS 2011-07-14 [verbatim]

---

## Cluster 2 — The CQS Precedent (Meyer)

6. *"CQRS actually comes from CQS: command–query separation, which is from Bertrand Meyer, who's a very very interesting guy by the way."* — CotB-2014 [verbatim]
7. *"The first type of method that we have has a void return type: it's called a command... The second type of method that we have, has a non-void return type, it is not allowed to mutate state. It is called a query."* — CotB-2014 [verbatim]

---

## Cluster 3 — When CQRS Earns Its Keep + When It's Overkill

8. *"reading and writing are different, and you should make different decisions for reads and for writes."* — CotB-2014 [verbatim]
9. *"CQRS at its core, is probably the dumbest pattern ever imagined."* — CotB-2014 [verbatim]
10. *"It's such a simple concept, but it's an enabling pattern."* — CotB-2014 [verbatim]
11. *"CQRS is a significant mental leap for all concerned, so shouldn't be tackled unless the benefit is worth the jump."* — Fowler-CQRS [verbatim]
12. *"you should be very cautious about using CQRS"* — Fowler-CQRS [verbatim]

---

## Cluster 4 — CQRS != Event Sourcing

13. *"You can use CQRS without Event Sourcing but with Event Sourcing you must use CQRS."* — CotB-2014 [verbatim]
14. *"When I first started teaching people about CQRS and Event Sourcing it was advantageous to teach them CQRS first and then teach them Event Sourcing."* — CotB-2014 [verbatim]
15. *"Just like event sourcing doesn't work well for everything. You can't do a query off of your current state in a purely event-sourced system, you need some piece of transient state to be able to query with it."* — CotB-2014 [verbatim]
16. *"CQRS and Event Sourcing, when really it's Event Sourcing and CQRS."* — CotB-2014 [verbatim — signature self-correcting reframe]

---

## Cluster 5 — Event Sourcing Canonical (the fold)

17. *"Current state is a left fold of previous behaviours. Simple!"* — CotB-2014 [verbatim]
18. *"Current State is a Left Fold of previous behaviours."* — GFY-2012 [verbatim]
19. *"At the end of this chain, we have our current state."* — GFY-2012 [verbatim]
20. *"In order to get my object back to its state I will replay the events that I have saved for the object."* — GFY-2012 [verbatim]
21. *"Essentially, in order to restore the entity state from events, we need to apply the left fold on all the events in the entity stream."* — Kurrent-WIES [verbatim]
22. *"Event Sourcing is all about the storing of facts."* — CotB-2014 [verbatim]
23. *"Your balance is a summation of all the previous transactions value upon your account."* — CotB-2014 [verbatim — concrete finance grounding]

---

## Cluster 6 — Events as Immutable Facts + Snapshots + Projections

24. *"You can never ever update an event and you can never delete an event."* — CotB-2014 [verbatim]
25. *"A snapshot is a memorization of your left fold, nothing more."* — CotB-2014 [verbatim]
26. *"A projection is some code that goes over a series of events and produces some form of transient state."* — CotB-2014 [verbatim]
27. *"The projection builds a custom data model optimized for a specific use case, in any database or schema."* — Kurrent-WIES [verbatim]
28. *"You can never change a projection, you can only create a new projection."* — CotB-2014 [verbatim]
29. *"Most people are doing is they actually drop strong serialisation and they start using things like JSON."* — CotB-2014 [verbatim — on event versioning]

---

## Cluster 7 — Eventual Consistency + Single-Model Refusal

30. *"Queries can almost always be eventually consistent...you're already eventually consistent, you just don't know it."* — CotB-2014 [verbatim]
31. *"You cannot, under any circumstances, have a single model that does everything for you, and does it well."* — CotB-2014 [verbatim]
32. *"Data is massively, massively valuable and anytime you choose one of these you are losing data."* — CotB-2014 [verbatim]
33. *"Okay guys we're gonna get started."* — CotB-2014 opening [verbatim — register tell, no preamble]

---

## Cluster 8 — Bio + Voice + Career

34. *"Gregory Young coined the term 'CQRS' (Command Query Responsibility Segregation) and it was instantly picked up by the community who have elaborated upon it ever since."* — DDDeu-2016 [verbatim]
35. *"Greg is an independent consultant and serial entrepreneur. He has 15+ years of varied experience in computer science from embedded operating systems to business systems and he brings a pragmatic and often times unusual viewpoint to discussions."* — DDDeu-2016 [verbatim]
36. *"For periods of years Greg has been known to stop living anywhere and just travel."* — InfoQ-8L speaker bio [verbatim]
37. *"Twitter: @gregyoung"* — InfoQ-8L + DDDeu-2016 + Fowler-CQRS [verbatim — canonical handle]
38. *"Greg Young, himself, asserts that CQRS is NOT an architecture."* — Hacker News thread paraphrase of Young's corrective register [paraphrase faithful, hn id 2948067]

---

**Total verbatim quotes:** 37 with source citations + 1 cross-citation paraphrase. **All verifiable URLs WebFetched** during Agent A/B/C research; corrections to brief premises captured in INDEX.md.

Per IP stance, Young's corpus is heavily public — verbatim density is the highest of the 9 voice-channeling skills shipped to date. Most extended Young content is on:
- His own publicly-hosted writings (cqrs.wordpress.com, gregfyoung.wordpress.com, kurrent.io blog)
- Free booklet (CQRS Documents 2010)
- Public talk transcripts (kurrent.io, InfoQ)
- Public bio pages (DDDeu, InfoQ speaker pages)

The Leanpub book *Versioning in an Event Sourced System* is in copyright and is the only major Young corpus where extended body content is `[paraphrase]`.

> **Cluster provenance standard — best-of-breed model.** This QuoteBank is the **most complete provenance
> discipline** in the voice-channeling specialist cluster (Cockburn, EricEvans, Feathers, Fowler, GregYoung,
> KentBeck): it combines all four dimensions the siblings each implement only partially — (1) **per-source
> verification-tracking** (every source in the legend tagged "verified" / "WebFetched", the Cockburn `[2nd-mirror]`
> discipline applied inline), (2) the **`[verbatim]`/`[paraphrase]` IP-stance** (the Feathers model — the
> copyrighted Leanpub book paraphrased), (3) **explicit source-aware reasoning** (the Fowler source-type axis,
> stated outright — public corpus → high verbatim density legitimately), and (4) **careful attribution** of
> borrowed quotes (the EricEvans model — Fowler's CQRS framing credited to Fowler, the Hacker-News paraphrase
> flagged). The cluster's reconciled source-aware provenance standard is therefore **this discipline**, not a
> synthesis — it is empirically embodied here. Sibling QuoteBanks should be measured against this model.
