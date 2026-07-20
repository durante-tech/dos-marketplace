# Principles — Refactoring + PoEAA + Microservices + Practices + Bliki Canon

**All verbatim. Source-tagged. The full canonical reference for the future Fowler skill.**

---

## Refactoring (Fowler & Beck, 1999, 2nd ed. 2018)

### Refactoring (noun)

> *"a change made to the internal structure of software to make it easier to understand and cheaper to modify without changing its observable behavior"*

Source: Fowler, *Refactoring*, definition reproduced verbatim on https://martinfowler.com/bliki/DefinitionOfRefactoring.html (book p. 33–43, 1st ed. 1999).

### Refactoring (verb)

> *"to restructure software by applying a series of refactorings without changing its observable behavior"*

Source: same.

### The Two Hats (verbatim from *Refactoring* Ch. 1)

> *"When you use refactoring to develop software, you divide your time between two distinct activities: adding function and refactoring. When you add function, you shouldn't be changing existing code; you are just adding new capabilities. You can measure your progress by adding tests and getting the tests to work. When you refactor, you make a point of not adding function; you only restructure the code."*

Source: *Refactoring* (1st ed. 1999) Ch. 1; restated at https://martinfowler.com/articles/workflowsOfRefactoring/fallback.html as *"You can only wear one hat at a time."*

### Refactoring as discipline (verbatim)

> *"Refactoring is a disciplined technique for restructuring an existing body of code, altering its internal structure without changing its external behavior."*
> *"Its heart is a series of small behavior preserving transformations. Each transformation (called a 'refactoring') does little, but a sequence of these transformations can produce a significant restructuring."*
> *"Refactoring isn't a special task that would show up in a project plan. Done well, it's a regular part of programming activity."*

Source: https://refactoring.com/

### Code Smell (definition)

> *"A surface indication that usually corresponds to a deeper problem in the system."*
> *"smells don't always indicate a problem"*
> *"first coined by Kent Beck while helping me with my Refactoring book"*

Source: https://martinfowler.com/bliki/CodeSmell.html

### Opportunistic Refactoring (the "Camp Site" rule)

> *"at any time someone sees some code that isn't as clear as it should be, they should take the opportunity to fix it right there and then"*
> *"This opportunistic refactoring is often referred to as following the camp site rule — always leave the code behind in a better state than you found it."*
> *"From the beginning I've always seen refactoring as something you do continuously, as regular and indivisible a part of programming as typing if statements."*
> *"a team that's using refactoring well should hardly ever need to plan refactoring, instead seeing refactoring as a constant stream of small adjustments"*
> *"do remember that you should only refactor when your tests are green"*

Source: https://martinfowler.com/bliki/OpportunisticRefactoring.html

### Code-as-Documentation (Comprehension)

> *"Whenever you have to figure out what code is doing, you are building some understanding in your head."*

Source: https://martinfowler.com/articles/workflowsOfRefactoring/fallback.html

### When Comments Are a Smell

> *"When you feel the need to write a comment, first try to refactor the code so that any comment becomes superfluous."*

Source: *Refactoring* (1st ed. 1999) p. 88.

### The Audience Principle

> *"Any fool can write code that a computer can understand. Good programmers write code that humans can understand."*

Source: *Refactoring* (1st ed. 1999) p. 15.

### Make It Easy First, Then Make the Change

> *"When you find you have to add a feature to a program, and the program's code is not structured in a convenient way to add the feature, first refactor the program to make it easy to add the feature, then add the feature."*

Source: *Refactoring* (1st ed. 1999) p. 7.

---

## Patterns of Enterprise Application Architecture (PoEAA, 2002) — Verbatim Definitions

### Domain Model

> *"An object model of the domain that incorporates both behavior and data."*

Source: https://martinfowler.com/eaaCatalog/domainModel.html

### Service Layer

> *"Defines an application's boundary with a layer of services that establishes a set of available operations and coordinates the application's response in each operation."*

Source: https://martinfowler.com/eaaCatalog/serviceLayer.html

### Active Record

> *"An object that wraps a row in a database table or view, encapsulates the database access, and adds domain logic on that data."*

Source: https://martinfowler.com/eaaCatalog/activeRecord.html

### Data Mapper

> *"A layer of mappers that moves data between objects and a database while keeping them independent of each other and the mapper itself."*

Source: https://martinfowler.com/eaaCatalog/dataMapper.html

### Repository

> *"Mediates between the domain and data mapping layers using a collection-like interface for accessing domain objects."*

Source: https://martinfowler.com/eaaCatalog/repository.html

### Unit of Work

> *"Maintains a list of objects affected by a business transaction and coordinates the writing out of changes and the resolution of concurrency problems."*

Source: https://martinfowler.com/eaaCatalog/unitOfWork.html

### Identity Map

> *"Ensures that each object gets loaded only once by keeping every loaded object in a map. Looks up objects using the map when referring to them."*

Source: https://martinfowler.com/eaaCatalog/identityMap.html

### Table Data Gateway

> *"An object that acts as a gateway to a database table. One instance handles all the rows in the table."*

Source: https://martinfowler.com/eaaCatalog/tableDataGateway.html

### Lazy Load

> *"An object that doesn't contain all of the data you need but knows how to get it."*

Source: https://martinfowler.com/eaaCatalog/lazyLoad.html

### Embedded Value

> *"Maps an object into several fields of another object's table."*

Source: https://martinfowler.com/eaaCatalog/embeddedValue.html

### Transaction Script (the foil to Domain Model)

> *"Organizes business logic by procedures where each procedure handles a single request from the presentation."*

Source: https://martinfowler.com/eaaCatalog/transactionScript.html

---

## Microservices (Lewis & Fowler, 25 March 2014) — Verbatim 9 Characteristics

### Opening definition

> *"In short, the microservice architectural style is an approach to developing a single application as a suite of small services, each running in its own process and communicating with lightweight mechanisms, often an HTTP resource API."*

> *"We cannot say there is a formal definition of the microservices architectural style, but we can attempt to describe what we see as common characteristics for architectures that fit the label."*

Source: https://martinfowler.com/articles/microservices.html

### The 9 Characteristics

1. **Componentization via Services** — *"A component is a unit of software that is independently replaceable and upgradeable."* Services are *"out-of-process components who communicate with a mechanism such as a web service request, or remote procedure call."*

2. **Organized around Business Capabilities** — Cross-functional teams include *"the full range of skills required for the development: user-experience, database, and project management."*

3. **Products not Projects** — Teams *"own a product over its full lifetime"* rather than have software *"handed over to a maintenance organization."*

4. **Smart endpoints and dumb pipes** — Applications are *"as decoupled and as cohesive as possible — they own their own domain logic and act more as filters in the classical Unix sense."*

5. **Decentralized Governance** — *"One of the consequences of centralised governance is the tendency to standardise on single technology platforms."*

6. **Decentralized Data Management** — *"Microservices prefer letting each service manage its own database, either different instances of the same database technology, or entirely different database systems."*

7. **Infrastructure Automation** — Extensive use of automated testing and automated deployment pipelines across environments.

8. **Design for failure** — *"Applications need to be designed so that they can tolerate the failure of services"* since *"any service call could fail due to unavailability."*

9. **Evolutionary Design** — Service decomposition is *"a further tool to enable application developers to control changes in their application without slowing down change."*

Source: same — https://martinfowler.com/articles/microservices.html

### Monolith First (2015 reconsideration)

> *"Almost all the successful microservice stories have started with a monolith that got too big and was broken up."*
> *"Almost all the cases where I've heard of a system that was built as a microservice system from scratch, it has ended up in serious trouble."*
> *"you shouldn't start a new project with microservices, even if you're sure your application will be big enough to make it worthwhile."*

Source: https://martinfowler.com/bliki/MonolithFirst.html

### Microservice Premium

> *"Microservices introduce complexity on their own account. This adds a premium to a project's cost and risk — one that often gets projects into serious trouble."*
> *"Don't even consider microservices unless you have a system that's too complex to manage as a monolith."*

Source: https://martinfowler.com/bliki/MicroservicePremium.html

### Microservice Prerequisites

> *"You should be able to fire up a new server in a matter of hours."*

Source: https://martinfowler.com/bliki/MicroservicePrerequisites.html

---

## Strangler Fig Application (2004)

> *"These are vines that germinate in a nook of a tree. As it grows, it draws nutrients from the host tree until it reaches the ground to grow roots and the canopy to get sunlight."*

> *"This gradual process of replacing the host tree struck me as a striking analogy to the way I saw colleagues doing modernization of legacy software systems."*

> *"Like the fig, it begins with small additions, often new features, that are built on top of, yet separate to the legacy code base. As we do this we move bits of behavior from the legacy system into the new code base."*

Source: https://martinfowler.com/bliki/StranglerFigApplication.html

---

## Branch by Abstraction

> *"Branch by Abstraction is a technique for making a large-scale change to a software system in [a] gradual way that allows you to release the system regularly while the change is still in-progress."*

Use when *"various parts of the software system are dependent on a module, library, or framework that we wish to replace."* The technique ensures *"the system builds and runs correctly at all times, so you can continue to use Continuous Delivery while you are doing the replacement."*

Source: https://martinfowler.com/bliki/BranchByAbstraction.html

---

## Inversion of Control vs Dependency Injection (January 2004 — DI Coinage)

> *"Inversion of control is a common characteristic of frameworks, so saying that these lightweight containers are special because they use inversion of control is like saying my car is special because it has wheels."*

> *"Inversion of Control is too generic a term, and thus people find it confusing. As a result with a lot of discussion with various IoC advocates we settled on the name Dependency Injection."*

Distinction from Service Locator: *"the service appears in the application class — hence the inversion of control,"* whereas with Service Locator *"the application class asks for it explicitly by a message to the locator."*

Source: https://martinfowler.com/articles/injection.html

---

## Internal vs External DSLs (DSL book, 2010)

**Internal DSL:**
> *"Fundamentally there is no difference, an internal DSL is just an API with a fancy name."*

**External DSL** — clear sign of one:
> *"Often a clear sign is when the DSL isn't Turing complete or lacks abstraction facilities."*
> SQL is *"a complex and capable language, yet lacks both Turing completeness and the ability to build new abstractions."*

Source: https://martinfowler.com/bliki/DslBoundary.html — companion to *Domain-Specific Languages* (Fowler with Rebecca Parsons, Addison-Wesley, 2010).

---

## NoSQL — Aggregate-Oriented Databases (Sadalage & Fowler, 2012)

> *"Most sources I've looked at mention at least four groups of data model: key-value, document, column-family, and graph. Looking at this list, there's a big similarity between the first three — all have a fundamental unit of storage which is a rich structure of closely related data: for key-value stores it's the value, for document stores it's the document, and for column-family stores it's the column family."*
> *"In DDD terms, this group of data is an Aggregate."*

Source: https://martinfowler.com/bliki/AggregateOrientedDatabase.html — companion to Sadalage & Fowler, *NoSQL Distilled* (Addison-Wesley, 2012).

### Polyglot Persistence (term credited to Scott Leberknight)

> *"Any decent sized enterprise will have a variety of different data storage technologies for different kinds of data."*

Source: https://martinfowler.com/bliki/PolyglotPersistence.html

---

## Anemic Domain Model (anti-pattern)

> *"Objects are connected with rich relationships and structure that true domain models have. The catch comes when you look at the behavior, and you realize that there is hardly any behavior on these objects, making them little more than bags of getters and setters."*

> *"It's so contrary to the basic idea of object-oriented design; which is to combine data and process together."*

> *"They incur all of the costs of a domain model, without yielding any of the benefits."*

Source: https://martinfowler.com/bliki/AnemicDomainModel.html

---

## CQRS (Command Query Responsibility Segregation, attributed to Greg Young)

> *"CQRS stands for Command Query Responsibility Segregation. It's a pattern that I first heard described by Greg Young. At its heart is the notion that you can use a different model to update information than the model you use to read information."*

> *"For most systems CQRS adds risky complexity."*

Source: https://martinfowler.com/bliki/CQRS.html

---

## Continuous Integration (2006 article, revised 2023–2024)

### Opening definition (verbatim)

> *"Continuous Integration is a software development practice where each member of a team merges their changes into a codebase together with their colleagues changes at least daily."*

Source: https://martinfowler.com/articles/continuousIntegration.html

### Practices (current 2023–2024 revision section headings, verbatim)

1. Put everything in a version controlled mainline
2. Automate the Build
3. Make the Build Self-Testing
4. Everyone Pushes Commits To the Mainline Every Day
5. Every Push to Mainline Should Trigger a Build
6. Fix Broken Builds Immediately
7. Keep the Build Fast
8. Hide Work-in-Progress
9. Test in a Clone of the Production Environment
10. Everyone can see what's happening
11. Automate Deployment

**2006 update wording (legacy)** — for cross-reference: *Maintain a Single Source Repository / Automate the Build / Make Your Build Self-Testing / Everyone Commits To the Mainline Every Day / Every Commit Should Build the Mainline on an Integration Machine / Fix Broken Builds Immediately / Keep the Build Fast / Test in a Clone of the Production Environment / Make it Easy for Anyone to Get the Latest Executable / Everyone can see what's happening / Automate Deployment.* Both lists carry Fowler's name; the 2023–24 wording is current canonical.

---

## Feature Toggles (Fowler & Pete Hodgson, 2017) — Taxonomy

### Opening definition

> *"Feature Toggles (often also refered to as Feature Flags) are a powerful technique, allowing teams to modify system behavior without changing code."*

### The four categories (all verbatim)

- **Release Toggles** — *"Release Toggles allow incomplete and un-tested codepaths to be shipped to production as latent code which may never be turned on."*
- **Experiment Toggles** — *"Experiment Toggles are used to perform multivariate or A/B testing. Each user of the system is placed into a cohort and at runtime the Toggle Router will consistently send a given user down one codepath or the other, based upon which cohort they are in."*
- **Ops Toggles** — *"These flags are used to control operational aspects of our system's behavior. We might introduce an Ops Toggle when rolling out a new feature which has unclear performance implications so that system operators can disable or degrade that feature quickly in production if needed."*
- **Permissioning Toggles** — *"These flags are used to change the features or product experience that certain users receive. For example we may have a set of 'premium' features which we only toggle on for our paying customers."*

Source: https://martinfowler.com/articles/feature-toggles.html

---

## Test Pyramid (popularizing Mike Cohn)

> *"The test pyramid is a way of thinking about how different kinds of automated tests should be used to create a balanced portfolio. Its essential point is that you should have many more low-level UnitTests than high level BroadStackTests running through a GUI."*

Source: https://martinfowler.com/bliki/TestPyramid.html — popularizing Mike Cohn's term from *Succeeding with Agile* (2009).

---

## Conway's Law (Fowler's Articulation)

> *"Pretty much all the practitioners I favor in Software Architecture are deeply suspicious of any kind of general law in the field. Good software architecture is very context-specific, analyzing trade-offs that resolve differently across a wide range of environments. But if there is one thing they all agree on, it's the importance and power of Conway's Law."*

Conway, quoted by Fowler verbatim: *"Any organization that designs a system (defined broadly) will produce a design whose structure is a copy of the organization's communication structure."*

Source: https://martinfowler.com/bliki/ConwaysLaw.html

---

## Two Hard Things (attributed to Phil Karlton)

> *"There are only two hard things in Computer Science: cache invalidation and naming things. — Phil Karlton"*

Source: https://martinfowler.com/bliki/TwoHardThings.html

---

## YAGNI ("You Aren't Gonna Need It")

> *"Yagni originally is an acronym that stands for 'You Aren't Gonna Need It'. It is a mantra from ExtremeProgramming that's often used generally in agile software teams."*

Source: https://martinfowler.com/bliki/Yagni.html

---

## Tradable Quality Hypothesis

> *"quality is tradable, by enforcing less quality we gain in the other dimensions of cost, scope, or speed."*

(Fowler states the hypothesis to refute it — separating external from internal quality, and offering the Design Stamina Hypothesis as the counter.)

Source: https://martinfowler.com/bliki/TradableQualityHypothesis.html

---

## What Is a Bliki?

> *"something that was a cross between a wiki and a blog"*

Source: https://martinfowler.com/bliki/WhatIsaBliki.html
