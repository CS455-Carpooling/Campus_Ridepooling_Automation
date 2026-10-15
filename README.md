# Campus Ride-Pooling and Split-Fare System

> A safety-first campus ride-sharing platform for IIT Kanpur students, with
> equal fare splitting, real-time coordination, and human-controlled AI
> assistance.

CS455 Software Engineering course project, IIT Kanpur, Fall 2026.

A web platform for IIT Kanpur students travelling between campus and configured transport hubs.
A ride owner offers a ride and riders request a seat; the owner accepts or rejects each request.
The whole-ride fare is shared equally among applicable occupants and locked for accepted riders
when the ride locks; the group coordinates in a private chat. After the trip, riders can record
external settlement, rate each other and report misconduct. AI assists ride discovery and complaint
review, while ride actions and administrative decisions remain validated and human-controlled.

## Status

| Deliverable | Due | Status |
|---|---|---|
| D0: Project proposal | 2026-08-29 | Submitted |
| D1: Requirements, architecture, Jira setup | 2026-09-26 | Submitted |
| D2: Implementation, agentic AI, sprint execution | 2026-10-15 | Implementation baseline complete; D2 records and source-only traceability are maintained |
| D3: Testing, security, performance, cost, deployment | 2026-11-06 | Planned; see [`Phases.md`](Phases.md) |

## Project overview

The application serves the IIT Kanpur community. A student uses one account both to offer rides
and to request seats on other rides. Ride owners decide join requests; the application coordinates
the ride and calculates each applicable occupant's equal share of the whole-ride fare. It does not
collect or transfer money.

### Implemented capabilities

- **Accounts and profiles:** IITK email registration and verification, sign-in/out, password
  recovery, profile setup, account data export/deletion, and required warning acknowledgement.
- **Ride pooling:** configure an offered ride, search and filter available rides, submit and manage
  durable seat requests, accept or reject requests, and view ride details and request history.
- **Ride lifecycle and safety:** lock rides, coordinate pickup and trip progress, record arrivals
  and no-shows, calculate final shares, raise SOS alerts, and receive live ride/chat updates.
- **Settlements and feedback:** record and confirm or dispute external cash/UPI settlement; rate
  other occupants after a completed ride. Settlement is tracked by the app but payment occurs
  outside it.
- **Notifications and complaints:** receive ride and account notifications, file and track
  complaints, and report inappropriate ride-chat content.
- **Operations administration:** manage hubs, campus pickup points, vehicle types and external
  fare estimates; review complaints and SOS incidents; inspect rider and ride records; issue
  warnings or suspensions; and review AI recommendations and enforcement decisions. Administrative
  changes are access-controlled and audited.
- **AI assistance:** Gemini can rank eligible ride-search results and interpret natural-language
  chatbot requests. The chatbot uses server-side, allow-listed operations; preference changes are
  proposals requiring explicit confirmation. Deterministic handling is used when Gemini is
  unavailable or returns unusable output. Complaint analysis is advisory, and an administrator
  makes enforcement decisions.

### A typical ride journey

1. A student creates an IITK account, completes the profile setup, and chooses a campus pickup
   point.
2. A ride owner publishes a route, departure window, vehicle type, capacity, and expected fare.
3. Other students search eligible rides and submit seat requests; the owner accepts or rejects
   requests before locking the ride.
4. The group coordinates through private ride chat, checks in, records pickup progress, and
   completes the trip.
5. The system stores immutable final fare shares. Riders record external cash or UPI settlement,
   then participants can rate one another and report complaints.
6. Administrators review complaints and SOS incidents, manage configuration, and make any
   enforcement decision. AI suggestions remain advisory and auditable.

### Application routes

| Area | Routes |
|---|---|
| Public and account | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy` |
| Student and ride owner | `/dashboard`, `/profile`, `/warnings`, `/rides`, `/rides/new`, `/rides/results`, `/rides/[id]`, `/rides/[id]/review`, `/rides/[id]/complaint`, `/complaints`, `/notifications`, `/chatbot` |
| Operations admin | `/admin`, `/admin/incidents`, `/admin/complaints`, `/admin/ai-decisions`, `/admin/ai-recommendations`, `/admin/riders`, `/admin/rides/[id]`, `/admin/configuration` |
| System | `/api/health` readiness endpoint; authenticated JSON APIs under `/api/` |

`/home` is retained as a legacy redirect to `/dashboard`. The dashboard is role-aware; `/admin`
routes administrators to their dashboard and denies access to students. See the [web app README](apps/web/README.md) for page behavior, API coverage, authorization rules,
implementation conventions, and the interface design system.

## Repository map

| Directory | Purpose |
|---|---|
| [`apps/web/src/app/`](apps/web/src/app/) | Next.js pages, layouts, route handlers, and authenticated workflows |
| [`apps/web/src/components/`](apps/web/src/components/) | Reusable UI, ride, trip, chatbot, notification, and admin components |
| [`apps/web/src/lib/`](apps/web/src/lib/) | Server-side auth, authorization, domain rules, database access, AI, and realtime helpers |
| [`apps/web/db/`](apps/web/db/) | PostgreSQL schema, constraints, indexes, triggers, and seed/configuration data |
| [`apps/web/scripts/`](apps/web/scripts/) | Migration and administrator-role operations |
| [`Deliverables/`](Deliverables/) | D0-D3 submissions, AI log, UI records, and D2 traceability |
| [`.github/workflows/`](.github/workflows/) | Formatting, lint, type-check, test, build, and Docker CI |

## Architecture

This repository is an npm-workspaces monorepo. The running product is a Next.js App Router web
application backed by PostgreSQL; a custom Node server also hosts Socket.IO for real-time ride
chat and notifications.

| Path | Responsibility |
|---|---|
| `apps/web/src/app/` | Public, account, student, admin and API routes |
| `apps/web/src/components/` | Shared interface, ride, trip, chatbot and administration components |
| `apps/web/src/lib/` | Server-side authentication, authorization, domain rules, database access, AI integrations and realtime services |
| `apps/web/db/schema.sql` | Idempotent PostgreSQL schema and constraints |
| `apps/web/scripts/` | Database migration and audited administrator-role management |
| `apps/web/test/` and `*.test.ts(x)` | Automated unit, API, component, design-rule and contrast tests |
| `Deliverables/` | Course deliverables and D2 AI/UI records |
| `docs/` and `Phases.md` | Course handout checklist and deliverable/sprint plan |
| `.github/workflows/` | Pull-request and `master` CI, plus Docker Compose integration checks |

The browser calls Next.js pages and API routes. Server-side modules validate identity, role,
ownership, state transitions and input before reading or changing PostgreSQL. Gemini credentials
remain server-side; model output is validated and cannot directly perform a ride transaction.
Important ride, request, trip, settlement, complaint and administration invariants are enforced in
shared server rules and, where appropriate, database constraints.

## Getting started

Requirements: Node.js 24 (the version in [`.nvmrc`](.nvmrc)), npm and PostgreSQL. Docker Desktop
is the simplest way to run the database and production app together. For a development server,
mail setup, Gemini configuration and account provisioning, follow
[`apps/web/setup.md`](apps/web/setup.md).

### Run the complete application with Docker Compose

Copy the root environment example to `.env`, set a local PostgreSQL password, then start the stack:

```sh
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD to a private local value.
docker compose up -d --build --wait
```

PowerShell users can use `Copy-Item .env.example .env` instead of `cp`. Open
<http://localhost:3000>; the app's readiness endpoint is <http://localhost:3000/api/health>.
Compose starts PostgreSQL on loopback port `5433`, applies the idempotent schema at app startup,
and retains database data in a named volume. `docker compose down` stops the services;
`docker compose down -v` also permanently deletes that local database volume.

The local Compose stack runs the production build. To use Next.js development mode instead, start
PostgreSQL with Compose and configure `apps/web/.env.local` as described in the setup guide before
running `npm run dev`.

### Run the application in development mode

Use this workflow when you want hot reload and local source changes:

```powershell
# From the repository root
Copy-Item .env.example .env
# Edit .env and set POSTGRES_PASSWORD, then start only PostgreSQL.
docker compose up -d db

# Install dependencies and create apps/web/.env.local as described below.
npm ci
# Edit apps/web/.env.local and set DATABASE_URL and APP_URL.
npm run db:migrate --workspace @ridepool/web
npm run dev
```

Open <http://localhost:3000> after the development server starts. If the repository does not
contain an environment example for the web workspace, create `apps/web/.env.local` manually using
the example in [`apps/web/setup.md`](apps/web/setup.md). At minimum, set
`DATABASE_URL=postgres://crp:<your-password>@localhost:5433/crp` and
`APP_URL=http://localhost:3000`. Gemini and email variables are optional for local development;
without them, deterministic/manual fallback behavior is used and verification/reset links are
printed in the development terminal.

Stop the development database with:

```powershell
docker compose down
```

Use `docker compose down -v` only when you also want to delete the local PostgreSQL data volume.
For the complete environment setup, email configuration, admin provisioning, troubleshooting, and
manual verification steps, follow [`apps/web/setup.md`](apps/web/setup.md).

### Install, validate and build

From the repository root:

```sh
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
```

`npm run test` runs the web app's Vitest suite, including design-rule and contrast checks, and
enforces at least 80% line, statement, function and branch coverage. `npm run format` applies
Prettier formatting; `npm run format:check` checks without changing files. Workspace-specific
commands, database scripts, and watch mode are documented in [`apps/web/README.md`](apps/web/README.md)
and [`apps/web/setup.md`](apps/web/setup.md).

## Hosting locally with Docker

The root [`.env.example`](.env.example) documents Compose settings. Email delivery is optional:
without `MAIL_SCRIPT_URL` and `MAIL_SCRIPT_SECRET`, email messages and verification/reset links are
written to the application log for local testing. Configure the mail relay using
[`apps/web/setup.md`](apps/web/setup.md) before using email flows beyond local development.

Do not expose the local HTTP stack to other devices for real sign-in: production cookies require
HTTPS on non-local hosts. For a deployed instance, use HTTPS and configure `APP_URL` to its public
origin. Configure secrets in the deployment's secret manager; never commit `.env` files, database
passwords, mail secrets, or Gemini API keys.

The Docker workflow builds and starts the Compose stack in CI when relevant infrastructure files
change. The main CI workflow runs formatting, lint, type-check, tests and a production build on
pull requests and pushes to `master`.

## Project documents

| Document | Contents |
|---|---|
| [`apps/web/README.md`](apps/web/README.md) | Web app route and feature details, security/authorization rules and UI design constraints |
| [`apps/web/setup.md`](apps/web/setup.md) | Local PostgreSQL, environment, email, admin account and deployment setup |
| [`Deliverables/README.md`](Deliverables/README.md) | Deliverable folders and submission checklist |
| [`Deliverables/D2/AI_LOG.md`](Deliverables/D2/AI_LOG.md) | AI usage and development-session record |
| [`Deliverables/D2/UI/README.md`](Deliverables/D2/UI/README.md) | Captured UI screenshots and their routes |
| [`Deliverables/D2/API_DOCUMENTATION.md`](Deliverables/D2/API_DOCUMENTATION.md) | Implemented HTTP API reference |
| [`Deliverables/D2/CORE_WORKFLOW_DEMONSTRATION.md`](Deliverables/D2/CORE_WORKFLOW_DEMONSTRATION.md) | Reproducible ride-to-settlement workflow demonstration |
| [`docs/BUILD_CHECKLIST.md`](docs/BUILD_CHECKLIST.md) | Course handout requirements by deliverable |
| [`Phases.md`](Phases.md) | Delivery dates, sprint plan and project workstreams |
| [`docs/project-management/CS455_Software_Engineering_Project.pdf`](docs/project-management/CS455_Software_Engineering_Project.pdf) | Governing course project handout; it takes precedence if project notes conflict |

## Marks

| Deliverable | Due | Marks |
|---|---|---|
| D0: Project proposal | 2026-08-29 | Gate (approval required before D1) |
| D1: Requirements, architecture | 2026-09-26 | 20 |
| D2: Implementation | 2026-10-15 | 25 |
| D3: Testing and deployment | 2026-11-06 | 25 |
| Final scenario-based demo | 2026-11-08 to 11-13 | 10 |
| Individual viva | With the demo | 10 |
| Retrospective and final documentation | With D3 | 10 |

## Working agreements

- Every change starts from a Jira issue (project key `CS455`) and goes on a branch named
  `CS455-<n>-short-description`, with commit messages that start with the key.
- Changes reach `master` through a pull request with the Jira link, the requirement IDs and testing
  notes, reviewed and approved by another team member, with CI passing.
- A feature is done when the acceptance criteria of its user story (the `US-...-ACk` items in the
  D1 requirements) have passing automated tests.
- Requirements, Jira, code, tests and documentation must stay consistent with each other.
- Every member works from their own GitHub and Jira accounts.
