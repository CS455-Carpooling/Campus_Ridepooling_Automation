# Architecture Alternatives and Rejected Decisions

**System:** Campus Ridepooling Automation  
**Deliverable:** D1 — Architecture alternatives and rationale  
**Status:** Baseline decision record  
**Date:** 26 September 2026

## 1. Purpose and decision scope

This record explains the architecture choices represented in the six diagrams in
[`../architecture`](../architecture), and why the other patterns considered for
this system were not selected as the primary solution. It covers two related,
but distinct, decisions:

1. the overall web-application architecture; and
2. the AI architecture for rider suggestions/chat and Operations Admin complaint
   analysis.

“Rejected” means *not selected as the governing architecture for the stated
scope*. It does **not** mean a technique can never be introduced later. For
example, event-driven pub/sub is deliberately used for notifications, while a
pipe-and-filter pipeline is rejected as the main way to process transactional
ride changes.

## 2. Evidence and decision drivers

The decisions are derived from the architecture diagrams, the D1 requirements,
and the supplied pattern summary. In particular, the design must preserve these
constraints:

| Driver | Architectural consequence |
|---|---|
| Ride acceptance changes seats, fare shares, request status, and conflicting requests together. | A transactional relational data boundary and explicit concurrency control are needed; eventual, unordered processing is not sufficient for the core write path. |
| Rider suggestions are advisory. The rider alone joins, leaves, pays, rates, complains, or raises SOS. | The rider AI has only read tools plus a proposal-only preference tool; it cannot perform transactional actions. |
| Suggestions must be valid, explainable, privacy-aware, and bounded. | Validate outputs against current system data; omit unconsented/private data; cap requests, tokens, tools, and time; use a deterministic fallback. |
| Complaint recommendations must not impose discipline. | Preserve the original complaint, present analysis to an authorized Admin, require an explicit Admin decision, and audit recommendation versus outcome. |
| AI is an external/free-tier dependency and may fail. | Put AI behind one policy gateway and ensure core workflows continue without it. |
| Riders need timely live updates. | Publish state-change events to the notification pipeline; target live push updates within two seconds. |

The most directly relevant sources are:

- [`architecture/1.puml`](../architecture/1.puml): layered/client–server topology, services, PostgreSQL, and the rule that AI does not write to the database directly.
- [`architecture/2.puml`](../architecture/2.puml): rider AI guardrails, bounded tool loop, validation, fallback, and traceability.
- [`architecture/3.puml`](../architecture/3.puml): complaint analysis, confidence gate, human review, and audit.
- [`architecture/4.puml`](../architecture/4.puml): row locking and atomic ride acceptance.
- [`architecture/5.puml`](../architecture/5.puml): event-driven notification delivery.
- [`architecture/6.puml`](../architecture/6.puml): centralized AI policy gateway and telemetry.
- [`Requirements Engineering/users/rider/04_ai_agent_requirements.md`](../Requirements%20Engineering/users/rider/04_ai_agent_requirements.md): rider AI permissions, safety limits, privacy, evaluation, and fallback requirements.
- [`Requirements Engineering/users/admin/Operations_Admin_Requirements.md`](../Requirements%20Engineering/users/admin/Operations_Admin_Requirements.md): Admin authorization, AI non-autonomy, audit, and manual-review requirements.

## 3. Decision A — Overall web-application architecture

### 3.1 Selected architecture: layered client–server with MVC-oriented services and a shared transactional repository

The selected web architecture is a **centralized cloud, layered client–server
architecture**:

```text
React/Next.js Rider, Ride Owner, and Admin clients
                     │ HTTPS / WebSocket
                     ▼
API gateway and authentication controller
                     ▼
Node.js application layer on GCP Cloud Run
  ├─ Ride and pool service
  ├─ Fare-splitting engine
  ├─ Chat service
  ├─ Disciplinary/account service
  └─ AI gateway (separate governed integration boundary)
                     ▼
PostgreSQL / Cloud SQL platform repository + immutable audit data
```

The application layer uses **MVC responsibilities**: controllers expose
role-authorized endpoints, services implement domain rules, and persistence is
kept behind the data layer. The diagrams call the domain components “core
micro-services”; for this deliverable this means clearly bounded application
services behind one API gateway, **not** a requirement to deploy every domain
service as an independently owned, independently stored distributed system.

Two supporting patterns are deliberately part of this decision:

- **Repository / relational transaction boundary:** PostgreSQL is the source of
  truth for rides, join requests, fare calculations, accounts, and audit data.
  `SELECT FOR UPDATE`, validation, related updates, and commit/rollback protect
  the seat-allocation path.
- **Event-driven pub/sub for notifications only:** services publish ride, join,
  and chat state changes to an event bus; push and email consumers distribute
  them. This decouples notification delivery from the completed transaction
  without moving ownership of the transaction itself into the event stream.

### 3.2 Why this is the best fit

It keeps the boundary between browser, application, and data concerns easy to
understand and test for a semester project while satisfying the hard parts of
the domain: role authorization, ACID updates, row-level contention, audit
records, and real-time client notification. A central API gateway also provides
one place to enforce authentication and route both ordinary API calls and AI
requests to their appropriate policy boundaries.

The architecture is intentionally central rather than device-distributed. The
workload is modest (the requirements describe at least 100 daily active users
and 250 core transactions per day), but correctness when a seat is accepted is
non-negotiable. A shared relational store and a single transactional service
boundary make that correctness much more direct to implement and verify.

### 3.3 Alternatives considered and rejected

| Alternative pattern | Why it was considered | Why it was rejected for the primary web architecture |
|---|---|---|
| **Single-tier client application / direct client-to-database access** | It can be quick to prototype. | It cannot safely centralize server-side RBAC, audit creation, AI policy enforcement, or transactional validation. Client code must not be trusted to protect seat counts, discipline records, private data, or permitted AI tools. |
| **Traditional monolith without layers** | One deployable can reduce operational overhead. | A monolithic deployment is not itself ruled out, but an *unlayered* monolith would entangle UI/API handling, fare rules, persistence, chat, and AI controls. That makes access control, test isolation, and later extraction of volatile functions harder. The selected architecture retains simple deployment while enforcing layers and domain boundaries. |
| **Fully independent microservices with a database per service** | Separate deployment and scaling can be attractive for chat, notifications, or AI. | The core flows need atomic coordination of seats, join requests, fare recalculation, and conflicting-request withdrawal. Splitting these across independently owned databases would introduce distributed transactions, sagas, retries, and reconciliation that are disproportionate to the stated workload and team scope. The selected bounded services share a transactional repository for the core domain. |
| **Peer-to-peer / decentralized topology** | It may reduce reliance on a central server. | The system needs authoritative availability, authenticated role checks, audit retention, consistent fare calculations, and administrative review. Peers cannot be trusted as an authoritative source for these records, and offline peers would make conflict resolution a primary system problem. |
| **Federated / edge-cloud AI and processing** | It can keep some computation close to a device and support local model training. | The proposal and diagrams choose centralized GCP deployment and an external/free-tier LLM. There is no requirement for on-device training or cross-device model aggregation. It would add model-version drift, device-resource variability, aggregation privacy/security work, and an additional evaluation surface without solving a stated problem. |
| **Pipe-and-filter as the main application architecture** | Pipelines work well for sequential transformation of independent data. | Ride acceptance is a stateful concurrent transaction, not a sequence of stateless transformations. A pipeline could expose intermediate states or make rollback across seat, request, and fare updates difficult. It is suitable for bounded subflows such as input scrubbing or telemetry processing, but not for the authoritative transactional path. |
| **Event sourcing / event-first core state** | It offers a strong history of changes and naturally supports subscribers. | Auditability is needed, but the requirements also need straightforward current-state validation and atomic writes. Implementing event replay, projections, idempotency, ordering, and compensation would add substantial complexity. The chosen design stores authoritative relational state and immutable audit records, then emits events after state changes for notification. |
| **Database-trigger-driven integration** | Triggers can react automatically when rows change. | Business workflows would become implicit in database code and difficult to observe, authorize, test, and version. Direct service calls through the API/application boundary make domain decisions explicit; the notification bus is invoked from services after a successful state transition. |

### 3.4 Consequences and boundaries

The key positive consequence is a dependable synchronous write path: authorization
and domain checks occur in application services, then state and audit changes
commit transactionally. The corresponding trade-off is that the shared data
layer must be carefully schema-managed and can be a scaling boundary. At this
scope, that is acceptable and safer than premature distributed consistency.

The notification event bus must be treated as an asynchronous consumer of
committed changes. It must not decide whether a join succeeds. Likewise, the AI
components return recommendations to application services; they never directly
write platform state.

## 4. Decision B — AI architecture for rider suggestions and Admin complaint analysis

### 4.1 Selected architecture: centralized policy-governed AI with two isolated workflows

The system selects one centralized **AI policy gateway and observability
boundary** in front of an external LLM. Behind that shared boundary are two
separate contexts with deliberately different authority:

| AI context | Selected pattern | Authority and outcome |
|---|---|---|
| **Rider recommendation and chatbot** | **Tool-using agent / bounded ReAct loop**, context assembly, output validation, deterministic graceful degradation | The agent invokes only allowlisted read tools (and may propose, but not apply, a preference change). It ranks/explains rides and interprets natural language. The system validates every displayed identifier and fact. The rider, not the agent, takes any consequential action. |
| **Operations Admin complaint analysis** | **Complaint analysis/classification with retrieval of relevant complaint/account context, confidence gate, and human-in-the-loop decision** | The AI summarizes, tags, estimates severity, and recommends. The original complaint remains available. An authorized Admin approves, rejects, or overrides; only the disciplinary service executes the final human decision and records the comparison in the audit trail. |

Both flows pass through the gateway for authentication, rate limiting, token
budgets, model routing, input/context safeguards, timeout measurement, and
90-day pseudonymous trace retention. They are separated because the two jobs
have fundamentally different risks: rider AI is recommendation-oriented and
must be privacy-minimizing, while Admin AI handles sensitive complaints but may
only advise a human decision-maker.

For the rider flow, the concrete safety envelope is: at most five tool calls,
8,000 tokens, eight seconds per request, 20 requests per rider per hour, a
server-side tool allowlist, data-delimited input, consent filtering, schema and
fact validation, and fallback ranking/manual search. For the Admin flow, the
concrete safety envelope is: no warning or suspension without an explicit
authorized Admin action, manual review on failure/timeout/invalid/low-confidence
output, preserved original complaint, and an auditable final decision.

### 4.2 Why this is the best fit

This design uses LLM strengths—natural-language interpretation, explanation,
summarization, and classification—without granting it authority over facts or
state. It is particularly important that the rider agent does not receive
private contact/location/chat/complaint data and has no action tool. For both
workflows, deterministic systems remain the source of truth for availability,
fare, authorization, and disciplinary state.

Centralizing controls makes the free-tier LLM dependency replaceable and makes
abuse/cost controls consistent. Separating the rider and Admin contexts prevents
the sensitive complaint-enforcement workflow from leaking into a general rider
assistant, while avoiding the orchestration burden of a multi-agent system.

### 4.3 Alternatives considered and rejected

| Alternative pattern | Why it was considered | Why it was rejected for this AI scope |
|---|---|---|
| **Unconstrained LLM/chatbot with direct API or database access** | It is the simplest apparent integration. | It violates the stated requirement that enforcement not rely on prompts: the model could hallucinate, expose private context, exceed cost limits, or mutate state. The chosen system has no prohibited tools, validates outputs, and keeps database writes in ordinary application services. |
| **Autonomous action-taking agent** | Agents can execute workflows end-to-end. | Joining rides, payments, complaints, SOS, and disciplinary actions carry safety, fairness, or accountability consequences. Rider actions must remain rider-confirmed, and disciplinary actions require an authorized Admin. The design deliberately uses recommendations/proposals, not autonomous execution. |
| **Single general-purpose agent for riders and Admins** | One model/prompt and one tool set could appear cheaper to build. | It mixes incompatible privilege and data contexts. A compromised or confused shared context could expose complaint data or allow a rider-facing flow to reach Admin functions. Separate workflows permit least privilege, different validation rules, and different human approval points. |
| **Multi-agent architecture** | Specialized planner, retrieval, validator, and executor agents can improve broad autonomous workflows. | The project has only two isolated AI contexts with narrow tools and a central policy boundary. Multi-agent hand-offs would increase prompt/trace complexity, latency, cost, and failure modes, while making accountability for a recommendation harder. Explicit deterministic guards and one bounded agent per context are more verifiable. |
| **Pure retrieval-augmented generation (RAG) for every AI feature** | Retrieval is useful for grounding an answer in stored information. | Admin complaint analysis can retrieve relevant records, but rider ride suggestions require live tool queries and deterministic fare/seat validation because availability changes concurrently. RAG alone can return stale passages and cannot safely produce current availability or calculated values. Retrieval is a supporting grounding technique, not the decision-making authority. |
| **Pure deterministic search/ranking, with no LLM** | It would be predictable and cheaper. | It would satisfy fallback behavior but not the requested natural-language assistant, pros/cons explanations, query-to-filter conversion, or complaint summary/classification assistance. Deterministic ranking remains the fallback and factual validator, not a replacement for the requested assistance. |
| **Pipe-and-filter AI pipeline** | Guard, enrich, invoke, validate, and log stages resemble a pipeline. | The pre/post-processing stages are used as controls, but a rigid pipeline is not sufficient to model the rider’s bounded tool loop or the Admin’s human decision gate. The selected architecture combines staged guards with an explicit agent loop and explicit human-review branch. |
| **Federated / edge AI** | Local inference/training may be attractive for privacy or offline use. | No offline AI, device training, or personalized local-model requirement exists. The selected centralized gateway can enforce consent, redact context, audit requests, and route to the defined external LLM consistently; edge deployment would fragment those controls. |
| **Model-per-user or locally trained personalization** | It could tailor rankings. | It creates data governance, evaluation, drift, and fairness burdens and conflicts with the requirement to use only permitted preference/tag data and not sensitive attributes. The selected agent works from consented, bounded preferences and explainable factors. |
| **AI as the authoritative discipline engine** | Automation could reduce Admin effort. | It conflicts directly with the requirement that AI cannot create, modify, or remove a warning/suspension without explicit Admin action. Errors in complaint interpretation have material consequences, so the selected human-in-the-loop pattern keeps AI advisory and requires a reasoned, auditable human decision. |

### 4.4 Consequences and verification

The principal trade-off is that recommendations may be unavailable or reduced to
deterministic ranking during an LLM outage, and every AI response requires
validation and trace recording. This is intentional: core ride search, joining,
chat, and SOS must remain usable when the AI provider fails.

The architecture is verifiable through failure injection and negative tests:

- feed a nonexistent/full ride or incorrect fare in a model response and verify
  it is not displayed as valid;
- request a prohibited rider action or private datum and verify no matching tool
  or context exists;
- force a timeout, malformed output, or low-confidence complaint result and
  verify deterministic/manual fallback while retaining the original input;
- attempt discipline from the AI path and verify that no account state changes
  until an authorized Admin makes the explicit decision;
- inspect the trace/audit records for model/prompt version, tool calls,
  validation result, latency, token use, recommendation, human decision, and
  final action as appropriate.

## 5. Summary of final decisions

| Area | Decision |
|---|---|
| Web application | Centralized GCP layered client–server application with MVC-oriented domain services, API gateway, PostgreSQL transactional repository, row-level concurrency control, and pub/sub only for asynchronous notifications. |
| Rider AI | Centralized gateway; a least-privilege, bounded tool-using recommendation/chat agent; consent-aware context; deterministic output validation and fallback; no transactional action authority. |
| Admin AI | Separate complaint-analysis workflow with contextual retrieval/classification, confidence/failure gate, human approval/rejection/override, application-service execution, and auditable comparison of AI recommendation to final decision. |

These choices intentionally favor correctness, privacy, auditability, and
verifiability over architectural novelty. They leave clear extension points—such
as independently deployable services, richer retrieval, or alternate models—if
future scale or requirements justify their additional complexity.

