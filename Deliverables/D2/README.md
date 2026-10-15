# D2 Master Combined README

This master README contains the complete contents of the repository README, the web application README, and the Deliverables README. The three source sections below are preserved in full; no source README section is summarized or omitted.

---

## Source 1 — Repository README (`README.md`)
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
| [`Deliverables/D2/README.md`](Deliverables/D2/README.md) | Consolidated D2 implementation, AI, setup, workflow, and evidence guide |
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

---

## Source 2 — Web application README (`apps/web/README.md`)
# Web app (`@ridepool/web`)

The web application for the Campus Ride-Pooling and Split-Fare System: one Next.js app with
student-facing and operations-admin areas. A student account can both find rides and offer rides;
operations-admin accounts have separately authorized pages and APIs. The app uses PostgreSQL and
Socket.IO for real-time updates. Every check that protects data is also made on the server.

The implementation is intentionally transaction-oriented: shared domain rules validate inputs and
state transitions before database writes, PostgreSQL constraints protect durable invariants, and
AI output is treated as untrusted advisory data. The application never collects or transfers ride
payments; it records settlement status for external cash or UPI payments.

Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, PostgreSQL,
Socket.IO, Gemini REST integration, and Vitest with React Testing Library.

## Commands

Run these from the repository root (they cover every workspace) or from `apps/web`:

| Command             | What it does                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `npm run dev`       | Development server at http://localhost:3000                          |
| `npm run lint`      | ESLint                                                               |
| `npm run typecheck` | Generates the route types, then runs `tsc --noEmit`                  |
| `npm run test`      | Unit, design-rule and contrast tests with coverage; fails below 80 % |
| `npm run build`     | Production build                                                     |

Inside `apps/web`, `npm run test:watch` reruns the tests on every change. Formatting is run from
the root: `npm run format`.

## Layout

```
src/
  app/               routes; the root layout only loads the site styles (src/index.css)
  app/(app)/         signed-in pages (each one checks the session itself)
  components/ui/     shared building blocks: Button, ButtonLink, Field, Skeleton, LoadingRegion
  components/shell/  header, navigation, footer and the product mark
  components/home/   the student and admin home screens
  components/admin/  the admin page shell, outcome labels, the not-allowed page, the chat report queue
  components/landing/ the landing page's fare card and live fare calculator
  components/rides/  create-ride inputs (route, vehicle, departure window, fare) and the ride details
  lib/               session, roles, route map, fares, formatting, page data and small helpers
test/                test setup, the design-rule checker and the contrast test
```

## Routes

Every route the app links to is defined in `src/lib/routes.ts`. `/home` is a legacy alias that
redirects to the role-aware `/dashboard`; the table below lists the other user-facing routes.

| Route                                                                                | Page                                                                                                                                                                       | Status                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `/`                                                                                  | Landing page (public); signed-in users get a link to their rides                                                                                                           | Built                    |
| `/dashboard`                                                                         | Role-aware home screen for students and operations admins                                                                                                                  | Built (CS455-15)         |
| `/home`                                                                              | Legacy redirect to `/dashboard`                                                                                                                                           | Built                    |
| `/login`                                                                             | Sign in with an iitk.ac.in email and password                                                                                                                              | Built (CS455-19)         |
| `/register`                                                                          | Registration with email verification, iitk.ac.in addresses only                                                                                                            | Built (CS455-19)         |
| `/forgot-password`, `/reset-password`                                                | Password reset by email                                                                                                                                                    | Built (CS455-19)         |
| `/terms`                                                                             | Terms of service (community guidelines)                                                                                                                                    | Built                    |
| `/privacy`                                                                           | Privacy policy                                                                                                                                                             | Built                    |
| `/profile`                                                                           | Rider profile, preferences and account settings                                                                                                                             | Built                    |
| `/warnings`                                                                          | Review and acknowledge rider warnings                                                                                                                                     | Built                    |
| `/rides/new`                                                                         | Offer a ride: route, vehicle, departure window, fare                                                                                                                       | Built (CS455-22 to 25)   |
| `/rides/[id]`                                                                        | Ride details, join requests and history, owner decisions, fare shares, ride edit/cancel/lock; from the lock, the trip: pickup order, arrivals, no-shows, SOS, live updates | Built (CS455-28, 29, 63) |
| `/rides/[id]/review`                                                                 | Rate the people on a completed ride, for 72 hours after it is completed                                                                                                    | Built (CS455-40 to 43)   |
| `/rides`, `/rides/results`                                                           | Find a ride: search and results, with AI recommendations                                                                                                                   | Built                    |
| `/chatbot`                                                                           | Gemini-first natural-language ride assistant with validated tools and confirmed preference proposals                                                                       | Built (FR-RD-05)         |
| `/notifications`                                                                     | Ride and account notifications                                                                                                                                             | Built                    |
| `/complaints`, `/rides/[id]/complaint`                                                | Review personal complaints and file a complaint about a ride participant                                                                                                  | Built (CS455-53)         |
| `/admin`                                                                             | Routes an admin to `/dashboard`; tells a student the admin pages are not for them                                                                                           | Built (CS455-49)         |
| `/admin/complaints`                                                                  | One complaint queue, from the form and from chat reports, Safety first                                                                                                     | Built (CS455-45, 53)     |
| `/admin/ai-recommendations`                                                          | Recommendation request audit trail and rider reports; pseudonymous rider IDs only                                                                                        | Built (AI-RD-12, 15)     |
| `/admin/ai-decisions`                                                                | AI enforcement decision history for complaints                                                                                                                             | Built                    |
| `/admin/complaints/[id]`, `/admin/riders`, `/admin/riders/[id]`, `/admin/rides/[id]` | Complaint detail, rider search and record, a read-only ride                                                                                                                | Built (CS455-53)         |
| `/admin/configuration/...`                                                           | Vehicle types, hubs and pickup points, fares                                                                                                                               | Built (CS455-51)         |
| `/admin/incidents`, `/admin/incidents/[id]`                                          | SOS alerts, open first; one alert with the trip as it was, the mobile number and location, Acknowledge and Close                                                           | Built (CS455-65)         |

`GET /api/health` is an uncached readiness probe: it returns `200` only when PostgreSQL answers
and `503` otherwise, without exposing connection details. Configure the selected hosting platform
to use this endpoint for its health check.

## Signed-in pages and roles

- **Roles** (`src/lib/roles.ts`): `student` finds rides and offers rides with the same account, as in
  the D0 proposal; `admin` is for operations admins, whose accounts are given the role rather than
  registered.
- **Access:** every signed-in page checks the sign-in itself and redirects to `/login` when nobody
  is signed in. `getCurrentUser()` in `src/lib/auth.ts` reads the session cookie that `/login`
  sets; sessions are rejected after seven days without activity. `getSession()` and
  `verifySession()` in `src/lib/session.ts` build on it for pages that need a role, such as `/home`.
  The root layout does not protect pages, because layouts are not re-rendered on navigation.
- **First sign-in profile setup** (`src/lib/session.ts`, FR-RD-02.1): before opening signed-in
  rider pages or APIs, a student must choose a display name and an active campus pickup point and
  decide whether interest tags may inform AI suggestions. `getCurrentUser()` denies incomplete
  accounts by default; only profile and account-maintenance flows may opt out. Operations admins
  and development-only test sessions are not redirected.
- **Warning acknowledgement** (`src/lib/warnings.ts`, FR-RD-01.6): riders with unacknowledged
 warnings are routed to `/warnings` at sign-in and blocked from authenticated APIs until they
 acknowledge each warning. The page shows only the reason category, not the admin's private
 explanation. Acknowledgements are recorded with the warning and retained in the database.
- **Sign-in:** `getSession()` returns the account signed in through `/login`, with its role from
  the database. Every account is a student until an operator makes it an admin (see Admin
  accounts below); the role is read on every request, so a revoked admin loses access at once.
  Under `npm run dev` only, when nobody is signed in, `DEV_SESSION_ROLE` (`student` or `admin`) in
  `apps/web/.env.local` still gives a test user, and the optional `DEV_SESSION_EMAIL` sets its
  address. The test admin can look at the admin pages but not change anything, because every
  admin change is audited against a real account. Production builds and tests ignore both. Keep
  passwords and personal addresses out of the repository.
- **Ride rules** (`src/lib/ride-rules.ts`) hold the create-ride validation shared by the form and
  `POST /api/rides`; `src/lib/ride-options.ts` loads active places and vehicle types from PostgreSQL.
- **Who may see a ride** (`canViewRide` in `src/lib/ride-status.ts`, NFR-RD-09): its owner and
  riders always; any other signed-in student only while it is scheduled and before its lock time,
  an hour before departure. `getRideView()` in `src/lib/ride-view.ts` applies it on the server and
  answers "Ride not found" for every other case, so a link never reveals whether a ride exists.
- **Completing and rating a ride** (`src/lib/rating-rules.ts`, CS455-39): only the owner marks a
  ride completed, once its trip has started (Pickup in Progress or In Transit, CS455-62), never a
  cancelled ride; asking twice changes nothing.
  Everyone with a seat on a completed ride may then rate each other person on it from 1 to 5, once,
  with an optional comment of up to 500 characters, for 72 hours (P-16). The `ride_ratings` table
  enforces in PostgreSQL that both people had a seat on that ride, that nobody rates themselves and
  that each person rates each other person once. A rating counts only after its ride's 72 hours are
  over; others see an average only from 3 ratings up, comments go only to the person rated, and
  nobody is ever shown who gave a rating (P-24).
  `POST /api/rides/[id]/complete` marks a ride completed and stores the final shares; it is the
  same step as `POST /api/rides/[id]/trip` with `to: 'completed'`.
- **Post-ride settlement** (`src/lib/payment-settlement.ts`): the app never collects or transfers
  money. After completion each non-owner payable share is Due. That rider records an external UPI
  or cash payment (optional reference, at most 50 characters); the owner confirms receipt or
  disputes it. A dispute opens a Payment complaint for the admin queue. No-show seats have no
  payable share. Payment details are returned only to that rider and the owner. Riders receive
  one-time reminders at 24 and 72 hours while a share remains Due; a Due share older than seven
  days blocks new join requests.
  Configure a long random `PAYMENT_REMINDER_CRON_SECRET` in the deployment secret manager, then
  schedule `POST /api/cron/payment-reminders` at least hourly (every 15 minutes is recommended)
  with `Authorization: Bearer <secret>`. The endpoint returns 503 when unconfigured and 401 for
  a missing or incorrect secret. Scheduler calls are safe to retry; only still-Due shares receive
  each reminder. Do not expose the secret to browsers or commit it.
- **Join requests** (`src/lib/join-requests.ts`, FR-RD-06/07 and FR-RO-05/06) are a separate,
  durable state machine from confirmed `riders` seats. A rider can submit an idempotent request,
  withdraw it, review its history, and reconfirm materially changed terms. Owners can accept or
  reject waiting requests; acceptance is serialized with seat-capacity and rider-conflict checks.
  Requests expire when the ride locks, and accepted riders can leave with locked-share liability
  retained for an ordinary post-lock departure. Owner edits require confirmation when confirmed
  riders are affected; cancellations release fare liability and notify riders. The ride page shows
  rider and owner controls, and `/home` lists sent and received waiting requests.
- **In-trip outcomes** (arrivals, no-shows, completion) are the trip APIs below (CS455-60). They
  build on the join requests: starting pickup applies the lock if it has not been applied yet, a
  no-show moves the rider's request to No-show, and completing moves accepted requests to
  Completed.
- **Page data** comes from server-only modules in `src/lib`. `ride-view.ts` reads rides from
  PostgreSQL for the ride page and for the Upcoming list on `/home` (rides you offered or joined,
  through `home-data.ts`). The request transition history is stored in
  `ride_join_request_events`; request and share updates are stored in `notifications`.
- **Ratings API** (`src/lib/ride-ratings.ts`, CS455-42): `POST /api/rides/[id]/ratings` takes
  `{ ratings: [{ occupantId, score, comment? }] }`, where `occupantId` is a seat on the ride
  (`riders.id`), so no user ID reaches the browser. It stores all of the ratings or none of them
  and answers only how many it stored; refusals come as `{ error, code }`.
- **Showing ratings** (`src/lib/rating-summary.ts`, CS455-44): a rating counts only once its ride's
  72 hours of rating are over, so all of a ride's ratings appear together. From 3 such ratings, the
  ride page's people list shows a person's average and count, and their profile shows them their
  average and the comments left about them, without names, scores or dates. Dashboard history
  shows "Ratings given" on completed rides, with a link to rate while rating is open.
- **Operations admin data** (`db/schema.sql`, CS455-46 and CS455-47): `users.role` (`student` or
  `admin`), the append-only `admin_audit_log`, versioned vehicle types and places,
  any legacy `campus_fares` table from an older schema (not read or written by the app),
  `external_fare_ranges`, `complaints` (with `complaint_chat_messages`),
  `rider_warnings`, `rider_suspensions` (and the `active_rider_suspensions` view),
  `complaint_ai_analyses` and `ai_enforcement_decisions`. The database itself refuses what must
  never happen: changing or deleting audit rows, editing an original complaint, a warning,
  suspension or AI decision by anyone but an admin, a suspension both timed and indefinite (or
  neither), a complaint about yourself or about someone not on the ride, and a rejected AI
  recommendation that still acts. Chat reports are complaints too: existing reports were copied
  over, and a trigger copies new ones until the chat report flow writes complaints itself.
  The shared rules are `src/lib/complaint-rules.ts` and `src/lib/admin-config-rules.ts`; the
  shapes the admin pages and APIs exchange are in `src/lib/admin-types.ts`, and
  `getActiveSuspension()` in `src/lib/suspensions.ts` tells whether a rider is suspended.
- **Admin accounts** are existing, verified iitk.ac.in accounts promoted by whoever runs the
  database, with `npm run admin:grant -- name@iitk.ac.in` (and `admin:revoke`); see setup.md.
  Nothing in the app can change a role, and each change is written to the audit log.
- **Admin access** (`src/lib/admin-auth.ts`, CS455-48): every admin page calls
  `requireAdminPage()` itself and shows `<AdminNotAllowed />` to a student, so no admin data
  reaches them; every admin API calls `requireAdminApi()`, which answers 401 or 403 as
  `{ error, code }`, and passes `{ write: true }` for a change to add the origin check and rate
  limit.
- **Rider recommendation oversight** (`src/lib/ai/recommendations.ts`, AI-RD-12 and AI-RD-15):
  each completed request records its ID, a domain-separated SHA-256 rider pseudonym (not a user
  ID), request time, configured model and prompt versions, validation outcome, fallback status,
  latency, available token counts and an explicit empty tool-call list (the ranking model has no
  tools). Audit rows, helpful/not-helpful feedback and attached wrong/inappropriate reports use
  pseudonymous rider IDs and are retained for 90 days. Riders can report a specific recommendation;
  the request ID and ride are checked against that rider's pseudonym before saving via
  `POST /api/rides/recommendations/report` (`reason: wrong | inappropriate`). Existing Helpful /
  Not helpful feedback remains separate at `POST /api/rides/recommendations/feedback`. The admin-only
  `/admin/ai-recommendations` page displays the request audit and its reports without loading or
  displaying rider contact/profile fields.
  Schema changes in `db/schema.sql` backfill and remove the legacy user IDs on existing installations.
- **Admin changes** go through `withAdminAction()` (`src/lib/admin-actions.ts`): one transaction
  that checks the role again, does the work and writes the audit row, and answers only after the
  commit. A refused or failed attempt keeps nothing and is audited as `refused` or `failed`;
  errors are logged, never shown. Each action uses a code from `src/lib/admin-activity.ts`, which
  also holds how the pages name it.
- **Admin pages** sit in `AdminPageShell` (CS455-49): the admin navigation (Home, SOS incidents,
  Complaints, AI decisions, AI recommendations, Riders, Configuration, Profile) with the current page marked and a way to log out, then the
  page's title with an optional back link, eyebrow, description and actions. The admin home
  (`/dashboard` for an admin) counts open complaints (chat reports included, safety ones called
  out), AI recommendations awaiting a decision and riders suspended now, and lists the last 10
  audit entries, each marked Done, Refused or Failed.
- **Admin APIs** (CS455-50, 52): each checks `requireAdminApi({ write: true })`, makes its change
  in `withAdminAction()` and answers `{ error, code, fields?, current? }`.
  - Configuration: `POST /api/admin/vehicle-types` and `PATCH .../[id]`, `POST /api/admin/locations`
    and `PATCH .../[id]`, `PUT /api/admin/external-fares`
    (`src/lib/admin-config.ts`). Every edit sends the `version` it loaded, and a stale one gets 409
    `version_conflict` with the item as it is now. Nothing is deleted: a vehicle type or place is
    deactivated, leaves the forms and stays on the rides that use it.
  - Complaints (`src/lib/complaints.ts`): `POST /api/rides/[id]/complaints` for someone on the
    ride, until 7 days after it is completed, or about a reported chat message at any time; one per
    person, ride and accused, at most 5 in 24 hours. `PATCH /api/admin/complaints/[id]` moves one to
    Under review or Resolved (saying whether action was taken), tells the person who complained, and
    closes the chat reports it came from.
  - Riders (`src/lib/enforcement.ts`): `POST /api/admin/riders/[id]/warnings`, `.../suspensions`
    (a number of days, or indefinite) and `.../reactivation`, each with a required reason. Lifting
    a suspension keeps its history. The rider is notified, without the admin's own words.
- **Configuration pages** (`/admin/configuration`, CS455-51) read everything with
  `getConfiguration()` (`src/lib/admin-config-queries.ts`) and edit it through the configuration
  APIs. `ConfigListEditor` (vehicle types, hubs, campus places) checks each form with the rules of
  `admin-config-rules.ts` before sending, asks before deactivating, and on a 409 keeps the admin's
  input and shows the other admin's version. Offer a ride shows the hub's typical fare range under
  the fare as an estimate (SYS-FR-12).
- **Complaint pages** (CS455-53): `/rides/[id]/complaint` is linked from the ride page for 7 days
  after completion and from a low score on the review page; it names people by their seat, shows
  the emergency numbers for Safety (`src/lib/emergency.ts`: the IIT Kanpur security number is still
  to be filled in), and gives the reference. `/complaints` lists the rider's own, with status and
  whether action was taken. Admins get one queue, the complaint with its original words and the
  accused's other complaints, rider search and records, and a read-only ride
  (`admin-complaint-queries.ts`, `admin-rider-queries.ts`). Avoid `<blockquote>` in our pages:
  `src/index.css` styles it as a large landing-page quote.
- **Suspended riders** cannot offer a ride or rate others: those APIs answer 403 `suspended` with
  the end time and reason category. They can still file complaints (FR-RD-01.5).
- **Trips under way and SOS** (CS455-60). The data is in `db/schema.sql`:
  - each step of the trip keeps its time on `rides`;
  - each seat on `riders` records checked in, arrived and no-show;
  - `ride_final_shares` stores what each person owed when the ride was completed, and never
    changes;
  - `sos_incidents` holds the SOS alerts, which only admins see.

  The database refuses:
  - a trip state without its time;
  - a seat both arrived and a no-show;
  - a change to final shares;
  - a change to what an SOS recorded;
  - a second active SOS by the same person on the same ride;
  - deleting an incident.

  The shared rules are:
  - `src/lib/trip-rules.ts`: the steps, which go Scheduled, then Pickup in Progress once locked,
    then optionally In Transit, then Completed, by the owner only. It also holds what the owner
    may mark about each seat, the 5-minute no-show grace period (P-19), checking in, and
    `canLeave()`, which is false once pickup starts;
  - `src/lib/sos-rules.ts`: who may raise an SOS, and how an incident moves for admins;
  - `src/lib/trip-itinerary.ts`: the stop order and estimated times, from the campus travel
    estimates in `src/lib/ai/campus-travel-times.ts`.

  A no-show leaves the pool: the fare is split between the seats that neither left nor were
  no-shows (FR-RO-10.2).

- **Trip APIs** (`src/lib/trip.ts`, CS455-62): each change runs in one transaction with the ride
  locked, through `runTripChange()` in `src/lib/trip-api.ts`, and refusals come as
  `{ error, code }`. The APIs are:
  - `POST /api/rides/[id]/trip` with `{ to }`: the owner starts pickup (once locked), starts the
    trip or completes the ride. Leaving pickup marks riders not yet marked as on board, and
    completing writes `ride_final_shares`. Riders are notified (`trip_update`).
  - `POST /api/rides/[id]/arrivals` with `{ occupantId, status }`: during pickup the owner marks a
    seat `arrived`, `not_arrived` or `no_show`. A no-show is allowed from 5 minutes after the
    rider's estimated pickup time; before then the answer is 409 `grace_period` with
    `availableAt`. The rider is notified (`no_show_recorded`), may report it for 7 days, and is
    left out of the fare split and ratings.
  - `POST /api/rides/[id]/check-in`: a rider says they are at their pickup point, from the lock
    until the trip starts.
  - `GET /api/rides/[id]/trip`: `{ state, stamp }` for people on the ride, so the page can refresh
    when anything on the trip changes.
- **The trip on the ride page** (CS455-63) appears from the lock.
  - **The owner** gets `TripPanel`: Start pickup, the pickup order with Arrived, Undo and No-show
    for each rider (No-show shows when it becomes possible), then Start the trip and Complete the
    ride. Each step asks first, in place (`TripActionButton`), and shows its result only after the
    server confirms.
  - **Riders** get `TripStatus`: where the trip is, their own stop and estimated time, "I am at
    the pickup point", and a notice with a link to report it if they were marked a no-show.
  - **Live updates:** `useTripRefresh` (`components/rides/trip-hooks.ts`) asks for the trip's
    stamp every 2 seconds while the tab is visible, and reads the page again only when it changes
    (P-13).
  - **Admin ride view:** `/admin/rides/[id]` adds the trip's times, each person's pickup status
    and the final shares.
- **SOS** (`src/lib/sos.ts`, CS455-64).
  - **Who:** anyone with a seat, rider or owner, while the trip is under way, suspended or not.
  - **On the ride page,** `SosPanel` asks once, then sends the alert straight away
    (`POST /api/rides/[id]/sos`). Only after that does it ask for the location and add it
    (`PATCH /api/sos/[id]`), so a slow or refused location never delays the alert.
  - **The SOS screen** shows the emergency numbers and the no-dispatch note from the question on,
    and the reference once sent. The person who raised it can mark it a false alarm.
  - **What is stored:** a snapshot of the trip and the raiser's mobile number. One active alert
    per person per ride, so pressing SOS again returns it.
  - **Privacy:** nothing about it reaches the rest of the pool: no notification, and the ride
    view reads only the viewer's own alert.
  - **Location:** `next.config.ts` allows it for our own pages only (`geolocation=(self)`).
  - **Complaint form:** a Safety complaint during a trip points to SOS on the ride page.
- **SOS for admins** (CS455-65).
  - **Pages:** `/admin/incidents` lists every alert, open first
    (`admin-incident-queries.ts`). `/admin/incidents/[id]` shows the trip as it was, who was on
    it, the mobile number and the location (with a map link), and Acknowledge, then Close with a
    note.
  - **API:** `PATCH /api/admin/incidents/[id]` goes through `withAdminAction()` and is audited as
    `incident.acknowledge` or `incident.close`.
  - **Alert bar:** every admin page shows it (`IncidentAlert` in `AdminPageShell`). It asks
    `GET /api/admin/incidents/open` every 3 seconds, so a new alert shows within 5 (P-22), and
    stays until someone acknowledges it.
  - **Elsewhere:** the admin home counts alerts not closed, and the admin ride view lists a
    ride's alerts.

## Conventions

- Server Components by default; add `'use client'` only for interaction or browser APIs.
- Tests sit next to the code they test, for example `Button.test.tsx` beside `Button.tsx`.
- A route that loads data has a `loading.tsx` made of `Skeleton` blocks in the shape of the final
  content, wrapped in a `LoadingRegion`.
- Use `next/link` for links inside the app and the `@/` alias for imports from `src/`.
- Every page gets exactly one `<main id="main">`, which the skip link targets, from the root layout.
  Pages render only their content and never add another `<main>`.

## Design rules

The site must look designed by people for IIT Kanpur students, not generated. The direction is a
forest-green palette with one coral accent, large tightly set headings, and real product components
(such as the live fare calculator on the landing page) in place of mock-ups.

### Tokens

Every colour is a token in `src/app/globals.css`. The tokens are defined on the `.ds` class, so they
work only inside `<DesignSystem>` (`src/components/ui/DesignSystem.tsx`), which also loads the two
fonts: wrap the outermost element of a page in it. Pages outside it keep the site styles of
`src/index.css`. The dark values apply when the theme toggle switches the site to dark (the `.dark`
class on `<html>`), and `<DesignSystem>` applies the saved choice on pages without a toggle;
components need no `dark:` classes.

| Token            | Light     | Dark      | Use                                               |
| ---------------- | --------- | --------- | ------------------------------------------------- |
| `paper`          | `#F4F5EF` | `#0E1714` | Page background (never pure white)                |
| `surface`        | `#FAFBF7` | `#14201C` | Inputs, cards inside brand panels                 |
| `panel`          | `#E8EBE2` | `#1B2A25` | Filled areas, hovered secondary buttons           |
| `ink`            | `#14231F` | `#E7EDE4` | Text                                              |
| `ink-muted`      | `#4E5B55` | `#A2B0A9` | Secondary text                                    |
| `line`           | `#D3D8CD` | `#2A3A34` | Dividers and skeleton blocks, never text          |
| `line-strong`    | `#78837C` | `#6C7D75` | Borders of inputs and buttons                     |
| `brand`          | `#143029` | `#1E463B` | Forest panels (fare card, closing call to action) |
| `on-brand`       | `#EDF1E8` | `#EDF1E8` | Text on brand panels                              |
| `on-brand-muted` | `#A7B8AF` | `#A9BBB1` | Secondary text on brand panels                    |
| `primary`        | `#143029` | `#E7EDE4` | Primary buttons                                   |
| `primary-strong` | `#0B1F1A` | `#F4F7F1` | Hovered primary buttons                           |
| `on-primary`     | `#F4F5EF` | `#0E1714` | Text on primary buttons                           |
| `accent`         | `#EE7A50` | `#EE7A50` | Coral fills and markers; large text on brand      |
| `accent-strong`  | `#F39270` | `#F39270` | Hovered accent buttons                            |
| `on-accent`      | `#14231F` | `#14231F` | Text on the accent colour                         |
| `accent-text`    | `#B8431F` | `#EF7A52` | Coral text on the page                            |
| `danger`         | `#B3261E` | `#F28B78` | Errors and destructive actions                    |
| `warning`        | `#7A5200` | `#E0B04A` | Warnings                                          |

Coral is the only accent. Type is Manrope (headings `font-extrabold tracking-tight`), with IBM Plex
Mono for times, fares and codes (`font-mono tabular-nums`); both include the rupee sign. Corners come
in two sizes: `rounded-control` (8px) for buttons, inputs and anything inside a panel, and
`rounded-panel` (16px) for panels. Depth comes from forest panels and 1px borders, never shadows.
Brand panels carry `data-surface="brand"` so that focus rings inside them switch to a light colour.

### Enforced by code

Inside `<DesignSystem>`, use only the tokens above: no Tailwind default colours, shadows, blur, stock
radii or stock animations (they still exist for the pages styled by `src/index.css`).
`test/design-rules.ts` fails the test run if `src/` contains:

- an em dash or an emoji;
- a checkmark or sparkle character;
- the "It's not X, it's Y" phrasing;
- an import of an icon kit (Lucide, react-icons, Heroicons) or an animation library (Framer Motion);
- a gradient, including radial orbs and dot grids written as CSS gradients;
- an arbitrary colour such as `text-[#ff00ff]`, so only the tokens above can be used;
- a shadow, blur or glass effect;
- a corner radius other than `rounded-control`, `rounded-panel`, `rounded-none` or `rounded-full`;
- a transition or animation other than the skeleton pulse;
- a hover effect that moves or scales an element (pressing a button may nudge it down by 1px);
- a coloured left stripe;
- pure white.

`test/contrast.test.ts` checks every text, button and border pairing against WCAG 2.1 AA, in both
colour schemes (NFR-RD-15).

### Checked in review

Code cannot catch these, so the reviewer of every UI pull request checks them:

- No row of three feature cards, bento grid, terminal-window mock-up, pricing tiers or testimonials.
- No invented numbers: no user counts, ratings or savings the project cannot back up. Example data
  is labelled as an example.
- No checkmark bullets or sparkle icons drawn as SVG or CSS, and no copy that contrasts what the
  product is not with what it is (the code check only catches the plain characters and phrasing).
- At most one small uppercase label above a heading for every three sections of a page.
- Pastel, neon, purple or rainbow colours stay out; coral is the only accent.
- The site has a terms of service page and a privacy policy, linked from the footer.
- Loading states use skeletons in the shape of the content.
- The landing page shows real components of the product, not mock-ups.
- Pages are checked in both the light and the dark colour scheme.

---

## Source 3 — Deliverables README (`Deliverables/README.md`)
# Deliverables

Each deliverable is submitted on Hello IITK **and** mirrored into this folder, as required by §17 of
the course handout.

| Folder | Deliverable | Due | Status |
|---|---|---|---|
| `D0/` | Project Proposal | 2026-08-29 | Submitted (`D0/Deliverable_0_Project_Proposal.pdf`) |
| `D1/` | Requirements, Architecture, Jira setup | 2026-09-26 | Submitted (`D1/CS455_Deliverable_1_Compiled.pdf`) |
| `D2/` | Implementation, Agentic AI, Sprint execution | 2026-10-15 | Implementation baseline complete; records and traceability are in this folder |
| `D3/` | Testing, Security, Performance, Cost, Deployment, Reliability | 2026-11-06 | Not started |

See `docs/BUILD_CHECKLIST.md` for the full contents required in each.
The D2 source-only implementation-to-requirement trace is in
[REQUIREMENTS_TRACEABILITY.md](./D2/REQUIREMENTS_TRACEABILITY.md).
The complete HTTP API reference is in
[API_DOCUMENTATION.md](./D2/API_DOCUMENTATION.md), and the reproducible core
transactional workflow is in
[CORE_WORKFLOW_DEMONSTRATION.md](./D2/CORE_WORKFLOW_DEMONSTRATION.md).
Both documents were regenerated after a complete source-only audit of the
implementation and executable configuration files.
The consolidated D2 landing README is
[D2/README.md](./D2/README.md).
