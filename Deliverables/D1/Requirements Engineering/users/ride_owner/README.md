# Ride Owner — Requirements

**Status:** draft complete, under team review · **Updated:** 2026-09-25

The Ride Owner is a verified IIT Kanpur user who creates a shared ride and manages its pool from creation through settlement. They arrange the vehicle and collect fare payments outside the application; the platform records pool, trip, and settlement information.

**Key differences from Rider:**
- The Ride Owner creates the ride with a destination, departure time, fixed vehicle capacity, and expected total fare.
- Riders submit join requests; the Ride Owner reviews each request and explicitly accepts or rejects it.
- The Ride Owner can view capacity and fare shares, then lock the confirmed pool before pickup.
- The Ride Owner tracks arrivals, can mark no-shows after the grace period, and the app recalculates fare shares for the active pool.
- The Ride Owner records externally collected fare payments as settled after the trip.
- The Ride Owner does not currently have AI agent features.
- The Ride Owner coordinates with the driver entirely outside of the application.

## Contents

| File | Contents | Status |
|---|---|---|
| `01_requirements_specification.md` | Role scope, assumptions, parameters, 14 user requirements, and glossary | Draft complete |
| `02_functional_requirements.md` | Functional system requirements for ride, request, pool, trip, settlement, and safety management | Draft complete |
| `03_non_functional_requirements.md` | Measurable performance, reliability, privacy, security, usability, and accessibility constraints | Draft complete |
| `04_ai_agent_requirements.md` | AI requirements: not applicable; Ride Owners retain manual join-request decisions | Draft complete |
| `05_use_cases.md` | Nine Ride Owner use-case descriptions from ride creation through reporting/SOS | Draft complete |
| `06_user_stories.md` | Fifteen Ride Owner user stories with acceptance criteria | Draft complete |
| `07_traceability_matrix.md` | UR → FR → use case → user story → Jira → verification, plus NFR coverage | Draft complete |

Conventions (IDs, priorities, statement style): see `../../README.md`.
