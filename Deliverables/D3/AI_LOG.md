# AI_LOG

This file records AI-assisted work performed for Deliverable 3. Entries describe only
work actually performed or decisions explicitly made during the performance and
optimization work.

- **Deliverable:** D3 — Performance/load test report and optimization results
- **Assistant:** GitHub Copilot using Copilot SDK in VS Code
- **Test date:** 2026-10-29
- **Primary workflow:** Authenticated ride search
- **Load-test tool:** k6 2.3.0 via `grafana/k6:latest`

## 2026-10-29 — Performance analysis and optimization

### User request

Analyze the complete application architecture and transactional workflows, identify and
fix realistic performance bottlenecks, create a reproducible load test for at least 100
DAU and 250 transactions, compare baseline and optimized results, and prepare the D3
performance report. The work was later expanded to include stepped ramp and deliberate
stress testing.

### Repository inspection performed

Reviewed the Next.js application, PostgreSQL schema, authentication/session handling,
ride search and creation, join-request transactions, payment settlement, notifications,
chat, scheduled jobs, and administrative queries. The primary experiment targeted the
authenticated `/rides/results` workflow because it is a frequent read path that exercises
session validation, PostgreSQL search, occupant lookup, and server rendering.

### Bottlenecks and fixes

1. **Ride-search query**
   - Repeated correlated active-rider `COUNT(*)` subqueries were recalculating the same
     value for each ride and each filter.
   - Replaced them with one `LEFT JOIN LATERAL` aggregate and reused the occupant count.
   - Added supporting partial/composite indexes for open rides and active riders.

2. **Session validation**
   - `last_activity_at` was being written on every authenticated request.
   - Changed activity refresh to occur only when the previous update is more than five
     minutes old.

3. **Payment reminders**
   - Reminder processing performed row-by-row updates and notification inserts.
   - Replaced it with a set-based SQL operation using CTEs, `UPDATE ... RETURNING`, and
     bulk notification insertion.

4. **Supporting indexes**
   - Added or improved indexes for notifications and complaint AI analysis lookups.

### Load-test implementation

Created `performance/k6/ride-search.js` with three reproducible modes:

- `rubric`: 100 VUs × 3 iterations, producing exactly 300 transactions.
- `ramp`: stepped load through 25, 50, 100, 150, 200, and 250 VUs.
- `stress`: deliberate overload through 100, 200, 300, and 400 VUs.

Temporary sessions and seed data were supplied externally and removed after testing; no
credentials or session tokens were retained in the repository.

### Measurements

#### Fixed rubric workload

- Baseline: 300 transactions, 106.72 transactions/second, p50 303.23 ms,
  p95 2.27 seconds, p99 2.57 seconds.
- Optimized: 300 transactions, 137.53 transactions/second, p50 289.84 ms,
  p95 1.76 seconds, p99 2.00 seconds.
- Improvement: 28.9% higher throughput, 4.4% lower p50, 22.5% lower p95,
  and 22.2% lower p99.
- Both runs completed with 0% HTTP failures and 100% successful checks.

#### Ramp workload

- 9,991 successful transactions.
- Throughput: 82.49 requests/second.
- p50: 205.34 ms.
- p95: 933.16 ms.
- HTTP failures: 0.00%.
- Successful checks: 100.00%.
- The strict 750 ms p95 target was exceeded; no request-failure point was reached.

#### Stress workload

- 15,263 successful transactions through 400 VUs.
- Throughput: 187.53 requests/second.
- p50: 985.86 ms.
- p95: 1.82 seconds.
- Maximum latency: 6.91 seconds.
- HTTP failures: 0.00%.
- Successful checks: 100.00%.
- Post-test `/api/health` check returned HTTP 200 with `{"status":"ok"}`.

### Verification performed

- Full test suite previously completed: 1,512 tests passed across 199 test files.
- Focused regression tests: 49 tests passed across auth, payment-settlement, and ride-search
  test files.
- TypeScript typecheck passed.
- ESLint passed.
- Prettier formatting check passed.
- Production build passed.
- `git diff --check` passed.
- Docker PostgreSQL and web services were healthy during the experiments.
- Temporary performance user, sessions, rides, seed SQL, and session JSON were removed.

### Final artifacts

- [performance-load-test-report.md](performance-load-test-report.md)
- [ride-search.js](../../performance/k6/ride-search.js)
- Optimized implementation in `apps/web/src/lib/ride-search.ts`,
  `apps/web/src/lib/auth.ts`, `apps/web/src/lib/payment-settlement.ts`, and
  `apps/web/db/schema.sql`.

### Student evaluation

*To be completed by the author.*

## Prompt and response log

### Prompt 1

> Act as a Senior Security Engineer and QA Auditor. Exhaustively analyze this entire codebase to understand the architecture, state management, database interactions, and real-time workflows on your own. Completely automate Deliverable 3 by discovering and fixing at least five meaningful defects or weaknesses, including at least two found through adversarial, concurrency, security, or failure-oriented testing. Make the changes in the codebase and do not commit or push anything.

### Response 1

> Audited the repository, fixed six security and reliability defects, added the submission-ready D3 defect report, and validated focused tests, typecheck, lint, build, and diff checks without committing or pushing.

### Prompt 2

> Do not restrict yourself. Go through all files internally and fix any bugs, update the generated documentation, run the tests, and ensure all tests pass.

### Response 2

> Reproduced the UI test timeouts, stabilized Vitest with one worker, updated the report, and verified 199 test files and 1,512 tests passed, with typecheck, lint, and production build passing.

### Prompt 3

> One final time check if any other issue still exists in the codebase. Loop onto yourself until you are sure and have fixed all.

### Response 3

> Completed a final repository-wide scan, found no additional issues in the initial pass, and confirmed the full test suite, typecheck, lint, build, and diff checks passed.

### Prompt 4

> Read all code files internally before claiming the codebase was fully reviewed.

### Response 4

> Performed a literal file-by-file audit of the tracked source and configuration scope. Found and fixed six additional issues involving migration compatibility, password-reset atomicity, realtime session activity, realtime eligibility gates, production Socket.IO origin configuration, and production cookie naming.

### Prompt 5

> Confirm that every required report and file has been updated according to the instructions across the prompts.

### Response 5

> Verified the D3 reports and implementation files, corrected the report’s defect count from six to twelve, and confirmed the final validation evidence.

### Prompt 6

> Give short and precise Jira ticket content along with subtasks.

### Response 6

> Provided a concise Jira story covering the twelve defect fixes, acceptance criteria, validation results, and eight implementation subtasks.

### Prompt 7

> Update D3’s AI log as well.

### Response 7

> Updated the AI log with the expanded audit scope, twelve findings, remediation actions, and final validation results.

### Prompt 8

> Revert the AI log.

### Response 8

> Reverted only the AI log changes and left all code fixes and the D3 defect report unchanged.

### Prompt 9

> In the AI log of D3, add the prompts I gave you and their responses, nothing else.

### Decision

*To be completed by the author.*

## Additional prompt and response log

### Prompt 10

> Review the comments on the CS455-115 performance-testing branch, verify the findings, fix the required issues, then commit and push.

### Response 10

> Verified and fixed the real-database timestamp and session-refresh regressions, migration ordering, index upgrades, reminder-test mocks, k6 redirect handling, and unsupported performance-report placeholders. The branch was validated and pushed as commit `952c9b8`.

### Prompt 11

> Review the new conflicts on CS455-121, fix and update them, and update the AI log to contain my new prompts as well.

### Response 11

> Refreshed `master` and PR #91, merged the latest base without textual conflicts, preserved the security and performance fixes, removed a duplicate `locked_at` migration statement, and updated this AI log with the new prompt and response entries.

### Prompt 12

> Fix the new conflicts on CS455-121, update the branch, and update the AI log to contain my new prompts as well.

### Response 12

> The latest `master` changes were merged into CS455-121, the duplicate migration statement was removed, the existing hardening and performance fixes were preserved, and the new prompt/response entries were added to the D3 AI log.
