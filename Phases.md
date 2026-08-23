# Phases

Driven by the deliverable schedule in `docs/project-management/CS455_Software_Engineering_Project.pdf`.
Those dates are fixed; our internal sequencing works backwards from them.

> **Correction (2026-08-18):** an earlier version of this file framed the project as *"explicitly not
> sprints"*, based on Lecture 1 stating the course would not cover Agile/Scrum. That was wrong for the
> project. The handout **mandates** sprint-based development — sprint goal, estimation, assignment,
> tracking of completed/incomplete/carried-forward work, sprint review, and retrospective (§4). Sprints
> are required and are graded.

## Deliverable schedule

| Deliverable | Due | Marks |
|---|---|---|
| **D0 — Project Proposal** | **2026-08-29** | gate (approval required before D1) |
| **D1 — Requirements, Architecture, Jira setup** | 2026-09-26 | 20 |
| **D2 — Implementation, Agentic AI, Sprint execution** | 2026-10-15 | 25 |
| **D3 — Testing, Security, Performance, Cost, Deployment, Reliability** | 2026-11-06 | 25 |
| Final scenario-based demo | 2026-11-08 → 11-13 | 10 |
| Individual viva | with demo | 10 |
| Retrospective + final documentation | with D3 | 10 |

## Sprint plan

Two-week sprints aligned to deliverable boundaries. Each sprint needs a stated goal, estimated and
assigned backlog items, tracked carry-forward, and a recorded review + retrospective in Jira.

| Sprint | Window | Goal | Feeds |
|---|---|---|---|
| **S0** | Aug 18 – Aug 29 | Proposal approved; Jira project + GitHub integration live; instructor/TAs added | D0 |
| **S1** | Aug 30 – Sep 12 | Requirements elicited and specified (FR/NFR, agent behaviour as requirements); use-case diagram + user stories; Jira backlog populated | D1 |
| **S2** | Sep 13 – Sep 26 | Architecture + design docs; component/sequence diagrams; design-pattern mapping; rejected alternatives; initial traceability matrix; AI Engineering Log | D1 |
| **S3** | Sep 27 – Oct 10 | Foundations + matching engine: auth, roles, request lifecycle, seat allocation with concurrency control, vehicles/partners | D2 |
| **S4** | Oct 11 – Oct 15 | Trip Coordinator Agent with governance + audit trail; real-time layer; payments; core workflow demonstrable end to end | D2 |
| **S5** | Oct 16 – Oct 30 | Test suite to ≥80% coverage; adversarial, concurrency, security, failure testing; defect discovery and regression tests | D3 |
| **S6** | Oct 31 – Nov 6 | Performance experiment + optimization; threat model; GCP deployment; cost + Gantt; final traceability matrix; retrospective | D3 |
| **S7** | Nov 7 – Nov 13 | Demo scenario rehearsal; viva preparation | Demo |

*Buffer is thin between S4 and D2. If slippage occurs, protect the agentic-AI workflow and the
concurrency guarantee — they are the highest-weight mandatory items in D2 and D3 respectively.*

## Course topic → project artifact

The lecture sequence and the deliverables line up closely; this maps them.

| Course topic | Where it lands |
|---|---|
| SDLC & lifecycle models | Process model justification (D1) |
| Software design, UML | Use-case, component, sequence, state diagrams (D1) |
| Software architecture | Architecture doc, rejected alternatives (D1) |
| Design & architectural patterns | Design-pattern mapping with justification (D1) |
| Implementation | D2 |
| Testing, V&V | D3 test reports |
| Static analysis | CI gates (`ruff`, `mypy`, `eslint`, `tsc`) |
| Model checking | *(stretch)* formal check of the group/seat state machine |
| Software metrics | Coverage, complexity, defect metrics (D3) |
| Project management | Jira throughout; estimation, Gantt, cost (D3) |

## Team ownership

Workstream ownership is assigned in Jira and finalised as part of D1 sprint planning. The handout
evaluates **individual** contribution from each person's own Jira and GitHub activity, and each
member faces an individual viva on their own code — so ownership must be real, not nominal.
