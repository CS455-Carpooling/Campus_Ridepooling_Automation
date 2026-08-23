# Campus Ride-Pooling & Split-Fare Platform

CS455 — Software Engineering Course Project, IIT Kanpur, Fall 2026.

A platform that matches students travelling from campus to shared destinations (Kanpur Central
railway station, CCS Airport Lucknow) within overlapping departure windows, allocates them seats in a
shared vehicle, splits the fare, and coordinates pickup.

## Status

**Deliverable 0 — proposal stage.** The proposal has not yet been submitted or approved, and per the
course handout implementation does not begin until it is. No application code exists yet.

## Repository contents

| Path | What it is |
|---|---|
| `docs/project-management/CS455_Software_Engineering_Project.pdf` | The governing course handout. Authoritative — if anything here conflicts with it, the handout wins |
| `docs/BUILD_CHECKLIST.md` | The handout turned into a tickable checklist: per-deliverable requirements, acceptance criteria, gates, invariants |
| `Phases.md` | Deliverable schedule and sprint plan |
| `Deliverables/` | Submitted deliverables, mirrored here as required (`D0/`–`D3/`) |

## Deliverable schedule

| Deliverable | Due | Marks |
|---|---|---|
| D0 — Project Proposal | 2026-08-29 | gate (approval required before D1) |
| D1 — Requirements, Architecture, Jira setup | 2026-09-26 | 20 |
| D2 — Implementation, Agentic AI, Sprint execution | 2026-10-15 | 25 |
| D3 — Testing, Security, Performance, Deployment | 2026-11-06 | 25 |
| Final scenario-based demo | 2026-11-08 → 11-13 | 10 |
| Individual viva | with demo | 10 |
| Retrospective + final documentation | with D3 | 10 |

## Working agreements

- Every significant change goes on a branch named with its Jira issue ID, merged via a pull request
  with a real description, testing notes, the Jira link, and a review from another team member.
- A feature is done when its acceptance criterion in `docs/BUILD_CHECKLIST.md` has a passing test —
  not when the code runs.
- Requirements, Jira, code, tests, and documentation must stay consistent with each other.
- All team members contribute from their own GitHub and Jira accounts.
