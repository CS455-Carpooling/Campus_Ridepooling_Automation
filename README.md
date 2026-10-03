# Campus Ride-Pooling and Split-Fare System

CS455 Software Engineering course project, IIT Kanpur, Fall 2026.

A web platform for IIT Kanpur students travelling between the campus and the railway station, bus
station or airport. A ride owner offers a ride and riders request a seat; the owner accepts or
rejects each request. The fare is split between the occupants and fixed when the ride locks, and
the group coordinates in a private chat. After the trip, riders settle their share, rate each other
and can report misconduct. An AI assistant helps riders find suitable rides, and AI complaint
analysis helps administrators, who make every decision themselves.

## Status

| Deliverable | Due | Status |
|---|---|---|
| D0: Project proposal | 2026-08-29 | Submitted |
| D1: Requirements, architecture, Jira setup | 2026-09-26 | Submitted |
| D2: Implementation, agentic AI, sprint execution | 2026-10-15 | In progress: web app scaffold in `apps/web` |
| D3: Testing, security, performance, cost, deployment | 2026-11-06 | Not started |

## Repository contents

| Path | What it is |
|---|---|
| `apps/web/` | Next.js web app; see its [README](apps/web/README.md), including the design rules |
| `.github/workflows/ci.yml` | CI: formatting, lint, type-check, tests with an 80 % coverage gate, build |
| `Deliverables/` | Submitted deliverables, mirrored here as the handout requires |
| `docs/project-management/` | The course handout. If anything here conflicts with it, the handout wins |
| `docs/BUILD_CHECKLIST.md` | The handout's requirements as a checklist per deliverable |
| `Phases.md` | Deliverable schedule and sprint plan |

## Getting started

Requirements: Node.js 24 (see `.nvmrc`; 20.9 or later works) and npm.

```sh
npm install          # installs every workspace
cp apps/web/.env.example apps/web/.env.local   # development sign-in, see apps/web/README.md
npm run dev          # web app at http://localhost:3000
npm run test         # tests with coverage
npm run lint
npm run typecheck
npm run format       # Prettier
```

## Hosting locally with Docker

Runs PostgreSQL and the production build of the web app on one machine. Requires Docker Desktop
(running).

```sh
cp .env.example .env              # then set POSTGRES_PASSWORD (letters and digits)
docker compose up -d --build      # first build takes a few minutes
```

Open http://localhost:3000. The database schema is applied each time the app starts, and the data
survives restarts (`docker compose down -v` deletes it).

- **Email:** without `MAIL_SCRIPT_URL` and `MAIL_SCRIPT_SECRET` in `.env` (see
  `apps/web/setup.md`) no email is sent, so verify a new account by hand:
  `docker compose exec db psql -U crp -d crp -c "UPDATE users SET email_verified_at = now() WHERE email = 'name@iitk.ac.in';"`
- **Other devices:** sign-in cookies are marked secure in production. Browsers keep them on
  `http://localhost`, but not on a plain-HTTP network address such as `http://192.168.x.x:3000`.
  To let others sign in from their own devices, serve the app over HTTPS (for example through a
  tunnel) and set `APP_URL` to that address.
- **Development against this database:** it listens on `127.0.0.1:5433`, so `npm run dev` can use
  `DATABASE_URL=postgres://crp:<password>@localhost:5433/crp` in `apps/web/.env.local`.
- CI builds and starts this setup whenever the Docker files change (`.github/workflows/docker.yml`).

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
