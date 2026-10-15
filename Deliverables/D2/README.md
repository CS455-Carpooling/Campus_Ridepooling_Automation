# Deliverable 2 — Implementation, Agentic AI, and Sprint Execution

CS455 Software Engineering course project, IIT Kanpur, Fall 2026.

This is the consolidated D2 README formed from:

- the repository [README](../../README.md);
- the web application [README](../../apps/web/README.md); and
- the deliverables [README](../README.md).

It is intentionally limited to the content of those three README files. Other
D2 documents are linked for navigation but are not merged into this README.

## D2 status

| Deliverable | Due | Status |
|---|---|---|
| D0: Project proposal | 2026-08-29 | Submitted |
| D1: Requirements, architecture, Jira setup | 2026-09-26 | Submitted |
| D2: Implementation, agentic AI, sprint execution | 2026-10-15 | Implementation baseline complete; records and source-only traceability are maintained |
| D3: Testing, security, performance, cost, deployment | 2026-11-06 | Planned |

## Project overview

Campus Ride-Pooling is a safety-first ride-sharing platform for IIT Kanpur
students. A student can use one account both to offer rides and to request
seats. A ride owner reviews join requests and accepts or rejects each request.
The whole-ride fare is shared equally among applicable occupants and locked for
accepted riders when the ride locks.

The group coordinates through private ride chat. After the trip, riders can
record external cash or UPI settlement, rate each other, and report misconduct.
The application records settlement status but does not collect or transfer
money. AI assists ride discovery and complaint review, while ride actions and
administrative decisions remain validated and human-controlled.

## Implemented capabilities

- **Accounts and profiles:** IITK email registration and verification,
  sign-in/out, password recovery, profile setup, account data export/deletion,
  and required warning acknowledgement.
- **Ride pooling:** configure an offered ride, search and filter available
  rides, submit and manage durable seat requests, accept or reject requests,
  and view ride details and request history.
- **Ride lifecycle and safety:** lock rides, coordinate pickup and trip
  progress, record arrivals and no-shows, calculate final shares, raise SOS
  alerts, and receive live ride/chat updates.
- **Settlements and feedback:** record and confirm or dispute external cash/UPI
  settlement and rate other occupants after a completed ride.
- **Notifications and complaints:** receive ride and account notifications,
  file and track complaints, and report inappropriate ride-chat content.
- **Operations administration:** manage hubs, campus pickup points, vehicle
  types, and external fare estimates; review complaints and SOS incidents;
  inspect rider and ride records; issue warnings or suspensions; and review AI
  recommendations and enforcement decisions. Administrative changes are
  access-controlled and audited.
- **AI assistance:** Gemini can rank eligible ride-search results and interpret
  natural-language chatbot requests. The chatbot uses server-side allow-listed
  operations; preference changes are proposals requiring explicit confirmation.
  Deterministic handling is used when Gemini is unavailable or returns unusable
  output. Complaint analysis is advisory, and an administrator makes
  enforcement decisions.

## Typical ride journey

1. A student creates an IITK account, completes profile setup, and chooses a
   campus pickup point.
2. A ride owner publishes a route, departure window, vehicle type, capacity,
   and expected fare.
3. Other students search eligible rides and submit seat requests. The owner
   accepts or rejects requests before locking the ride.
4. The group coordinates through private ride chat, checks in, records pickup
   progress, and completes the trip.
5. The system stores final fare shares. Riders record external cash or UPI
   settlement, then participants can rate one another and report complaints.
6. Administrators review complaints and SOS incidents, manage configuration,
   and make enforcement decisions. AI suggestions remain advisory and
   auditable.

## Application routes

### Public and account

`/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/terms`,
and `/privacy`.

### Student and ride owner

`/dashboard`, `/profile`, `/warnings`, `/rides`, `/rides/new`,
`/rides/results`, `/rides/[id]`, `/rides/[id]/review`,
`/rides/[id]/complaint`, `/complaints`, `/notifications`, and `/chatbot`.

### Operations admin

`/admin`, `/admin/incidents`, `/admin/complaints`, `/admin/ai-decisions`,
`/admin/ai-recommendations`, `/admin/riders`, `/admin/rides/[id]`, and
`/admin/configuration`.

### System

`/api/health` is the readiness endpoint. Authenticated JSON APIs are under
`/api/`.

`/home` is retained as a legacy redirect to `/dashboard`. The dashboard is
role-aware; `/admin` routes administrators to their dashboard and denies access
to students.

## Repository and application architecture

This repository is an npm-workspaces monorepo. The running product is a
Next.js App Router web application backed by PostgreSQL. A custom Node server
also hosts Socket.IO for real-time ride chat and notifications.

| Path | Responsibility |
|---|---|
| [`apps/web/src/app/`](../../apps/web/src/app/) | Public, account, student, admin, and API routes |
| [`apps/web/src/components/`](../../apps/web/src/components/) | Shared interface, ride, trip, chatbot, and administration components |
| [`apps/web/src/lib/`](../../apps/web/src/lib/) | Server-side authentication, authorization, domain rules, database access, AI integrations, and realtime services |
| [`apps/web/db/schema.sql`](../../apps/web/db/schema.sql) | Idempotent PostgreSQL schema and constraints |
| [`apps/web/scripts/`](../../apps/web/scripts/) | Database migration and audited administrator-role management |
| [`apps/web/server.mjs`](../../apps/web/server.mjs) | Next.js and Socket.IO server |
| [`apps/web/test/`](../../apps/web/test/) and `*.test.ts(x)` | Automated unit, API, component, design-rule, and contrast tests |
| [`Deliverables/`](../) | Course deliverables and D2 records |
| [`docs/`](../../docs/) and [`Phases.md`](../../Phases.md) | Course checklist and deliverable/sprint plan |
| [`.github/workflows/`](../../.github/workflows/) | Pull-request, `master`, and Docker CI |

The browser calls Next.js pages and API routes. Server-side modules validate
identity, role, ownership, state transitions, and input before reading or
changing PostgreSQL. Gemini credentials remain server-side; model output is
validated and cannot directly perform a ride transaction. Important ride,
request, trip, settlement, complaint, and administration invariants are
enforced in shared server rules and, where appropriate, database constraints.

## Web application stack

- Next.js 16 App Router.
- React 19.
- TypeScript in strict mode.
- Tailwind CSS 4.
- PostgreSQL.
- Socket.IO.
- Gemini REST integration.
- Vitest with React Testing Library.

## Web application layout

```text
apps/web/
├── src/
│   ├── app/                  routes
│   ├── app/(app)/            signed-in pages
│   ├── components/ui/        shared UI building blocks
│   ├── components/shell/     header, navigation, footer, product mark
│   ├── components/home/      student and admin home screens
│   ├── components/admin/     admin shell and administration components
│   ├── components/landing/   landing-page fare components
│   ├── components/rides/     ride, trip, fare, chat, and request components
│   └── lib/                  sessions, roles, routes, fares, page data, and helpers
├── db/schema.sql             PostgreSQL tables and constraints
├── scripts/                  migration and admin-role tools
├── server.mjs                Next.js and Socket.IO HTTP server
└── test/                     test setup and design/contrast checks
```

## Running the application

### Requirements

- Node.js 24, matching [`.nvmrc`](../../.nvmrc).
- npm.
- PostgreSQL, or Docker Desktop for the recommended local setup.

For development-server, mail, Gemini, and account-provisioning details, see
[`apps/web/setup.md`](../../apps/web/setup.md).

### Full application with Docker Compose

From the repository root:

```sh
cp .env.example .env
# Edit .env and set POSTGRES_PASSWORD to a private local value.
docker compose up -d --build --wait
```

PowerShell:

```powershell
Copy-Item .env.example .env
# Edit .env and set POSTGRES_PASSWORD.
docker compose up -d --build --wait
```

Open <http://localhost:3000>. The readiness endpoint is
<http://localhost:3000/api/health>. Compose starts PostgreSQL on loopback
port `5433`, applies the idempotent schema at app startup, and retains data in
a named volume.

Stop the services:

```sh
docker compose down
```

Use `docker compose down -v` only when the local database volume should also be
deleted.

### Development mode with hot reload

Start PostgreSQL through Compose:

```powershell
Copy-Item .env.example .env
# Edit .env and set POSTGRES_PASSWORD.
docker compose up -d db
npm ci
```

Create `apps/web/.env.local` as described in
[`apps/web/setup.md`](../../apps/web/setup.md), then set at least:

```env
DATABASE_URL=postgres://crp:<your-password>@localhost:5433/crp
APP_URL=http://localhost:3000
```

Migrate and run:

```sh
npm run db:migrate --workspace @ridepool/web
npm run dev
```

Open <http://localhost:3000>. Use `localhost`, not `127.0.0.1`, because the
CSRF check compares the browser's Origin with the Host.

Email and Gemini variables are optional for local development. Without mail
variables, verification and reset links are printed in the `npm run dev`
terminal.

### Validation commands

From the repository root:

```sh
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
```

`npm run test` runs the web app's Vitest suite, including design-rule and
contrast checks, and enforces at least 80% line, statement, function, and
branch coverage. `npm run format` applies Prettier formatting.

Workspace-specific commands:

```sh
npm run test:watch --workspace @ridepool/web
npm run db:migrate --workspace @ridepool/web
npm run admin:grant --workspace @ridepool/web -- <email>
npm run admin:revoke --workspace @ridepool/web -- <email>
```

## Development rules and design conventions

- Server Components are the default; add `'use client'` only for interaction
  or browser APIs.
- Use `next/link` for internal links and the `@/` alias for imports from
  `src/`.
- Each page has exactly one `<main id="main">`, targeted by the skip link.
- Data-loading routes use `loading.tsx` with skeleton blocks shaped like the
  final content.
- Shared domain rules should be reused by forms and server routes where
  appropriate.
- Tests sit next to the code they test.

The design direction uses a forest-green palette with one coral accent, large
tightly set headings, and real product components such as the live fare
calculator. Colors are tokens in `src/app/globals.css`, applied inside the
`DesignSystem` wrapper. Dark-mode values apply through the `.dark` class on
`<html>`.

## D2 files and navigation

The following files belong to D2 but are not merged into this consolidated
README:

- [API documentation](./API_DOCUMENTATION.md)
- [Core workflow demonstration](./CORE_WORKFLOW_DEMONSTRATION.md)
- [Requirements traceability](./REQUIREMENTS_TRACEABILITY.md)
- [AI log](./AI_LOG.md)
- [UI evidence](./UI/README.md)

The source README files used to form this document are:

- [Repository README](../../README.md)
- [Web application README](../../apps/web/README.md)
- [Deliverables README](../README.md)
