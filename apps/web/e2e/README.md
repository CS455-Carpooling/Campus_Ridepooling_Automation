# End-to-End System Testing (Playwright)

## 1. Overview and Scope

This directory contains the Playwright-based system (End-to-End) test suite for the Campus Ride-Pooling and Split-Fare System.

System testing exercises the complete integrated application as a black box from the perspective of real browser users:
- **Presentation Layer:** Next.js 16 App Router UI (React 19, Tailwind CSS v4)
- **Application Server:** Custom Node.js HTTP server (`server.mjs`) hosting Next.js and Socket.IO
- **Database Layer:** Real PostgreSQL 16 database executing SQL queries, constraints, and atomic transactions
- **Real-Time Communication:** Live Socket.IO WebSocket streams for trip updates, arrival tracking, and private pool chat
- **Governance & Policy:** Role-based access control (Student/Rider, Ride Owner, Operations Admin) and AI policy guardrails with deterministic fallbacks

System tests validate the end-to-end user journeys and business rules specified in **Deliverable 1** without mocking the database, session handlers, or backend route logic.

---

## 2. Environment Requirements & Configuration

System tests run against a running application instance and a dedicated PostgreSQL test database.

### Required Environment Variables

Configure in `apps/web/.env.local` or pass via shell environment:

| Variable | Description | Example / Recommended Value |
|---|---|---|
| `TEST_DATABASE_URL` | Dedicated PostgreSQL connection string for tests | `postgres://crp:pass@127.0.0.1:5433/crp_test` |
| `ALLOW_TEST_DATABASE_RESET` | Safety guardrail confirming the test database name | `crp_test` |
| `APP_URL` | Base URL of the running web application server | `http://localhost:3000` |
| `PORT` | HTTP server port | `3000` |
| `NODE_ENV` | Application environment | `test` or `development` |
| `MAIL_SCRIPT_URL` | Optional mail relay URL (leave blank in tests) | `""` |
| `GEMINI_API_KEY` | Optional server-side Gemini API key (leave blank to test fallback) | `""` |

> [!CAUTION]
> The test runner checks that `ALLOW_TEST_DATABASE_RESET` matches the database name in `TEST_DATABASE_URL` and that the database name ends with `_test`. Tests will abort before executing any query if pointed at production or general development databases.

---

## 3. Test Database Setup & Cleanup Strategy

1. **Database Container:**
   Run PostgreSQL 16 locally via Docker:
   ```bash
   # From the repository root:
   docker compose up -d db
   ```
   Or run a standalone test database container:
   ```bash
   docker run -d --name crp-test-pg -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=crp_test -p 5433:5432 postgres:16
   ```

2. **Schema Migration:**
   Apply `apps/web/db/schema.sql` to initialize all tables, default campus places, destination hubs, and vehicle types.

3. **Deterministic Accounts & Session Seeding:**
   To avoid triggering real external verification emails, system tests use the deterministic database seeder in `apps/web/test/seed/accounts.ts`. Sessions are injected directly as browser cookies (`crp_session`).

4. **Cleanup Strategy:**
   - Pre-run: Schema verification and reference table caching.
   - Between tests: Truncation of transactional tables (`rides`, `ride_requests`, `ride_chats`, `complaints`, `incidents`, `sessions`, `user_warnings`, `user_suspensions`, `user_profiles`, `users`) while preserving system reference data (campus locations, vehicle types, interest tags).

---

## 4. Browser Setup & Execution

### Prerequisites
- Node.js >= 20.9 (recommended Node 24 matching `.nvmrc`)
- Chromium browser installed via Playwright

### Installation
```bash
# In apps/web:
npx playwright install chromium
```

### Running Tests
```bash
# Run all E2E system tests
npm run test:e2e

# Run tests in headed browser mode (visual debugging)
npm run test:e2e -- --headed

# Run a specific test suite
npm run test:e2e e2e/tests/rider/search-and-join.spec.ts

# Open interactive Playwright UI
npm run test:e2e -- --ui
```

---

## 5. Directory Structure

```text
apps/web/e2e/
├── fixtures/
│   ├── auth.fixture.ts        # Browser context & session cookie helpers
│   ├── database.fixture.ts    # Test database reset & seeding lifecycle
│   └── test-accounts.ts       # Role-specific test credentials
├── helpers/
│   ├── ride.helper.ts         # Page object helpers for ride creation & search
│   ├── request.helper.ts      # Helpers for join requests & state transitions
│   └── notification.helper.ts # WebSocket & notification verification helpers
├── tests/
│   ├── authentication/        # Login, logout, session expiry, role checks
│   ├── rider/                 # Ride search, filters, request seat, leave ride
│   ├── owner/                 # Ride creation, request approval, lock, trip flow
│   ├── admin/                 # Hub & vehicle config, complaints, suspensions
│   ├── realtime/              # Multi-user WebSocket pool chat & notifications
│   ├── ai/                    # AI suggestions & deterministic fallback
│   └── cross-role/            # Full multi-user transactional flows
└── README.md
```

---

## 6. Known Limitations & Test Boundaries

1. **Email Delivery:** Registration in the UI sends a verification email via an external Apps Script relay. System tests bypass email delivery by seeding verified accounts directly into PostgreSQL.
2. **Third-Party AI Services:** Free-tier Gemini APIs are rate-limited and external. System tests verify AI features under two modes: live when keys are provided, and deterministic fallback (FR-RD-04.5, AI-RD-13) when keys are omitted or stubbed.
3. **External Payment:** Fare settlement occurs outside the platform (cash or UPI). System tests verify the application's internal state machine (`Due -> Marked Paid -> Confirmed / Disputed`) per FR-RD-11.
