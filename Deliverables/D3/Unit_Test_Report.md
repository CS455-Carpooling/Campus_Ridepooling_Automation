# D3 Unit Test and Coverage Report

**Story:** Story B (Khushi) — Unit and system testing, defect history  
**Scope:** B1 — Unit tests and coverage report  
**Repository:** `CS455-Carpooling/Campus_Ridepooling_Automation`  
**Run date:** 2 November 2026 (local run; terminal output supplied)  
**Coverage provider:** Vitest with V8

> **Execution evidence:** The figures below come from `npm test -- --coverage` on 2 November 2026. The user confirmed that the working copy had been pulled from the latest `master` before the run. The exact tested commit SHA was not captured. The HTML report is included at `Deliverables/D3/unit-coverage-report.zip`.

## 1. Execution summary

| Metric | Result |
|---|---:|
| Test files | 200 passed / 200 |
| Individual tests | 1,530 passed / 1,530 |
| Test duration | 141.71 seconds |
| Statements | 87.44% |
| Branches | 80.70% |
| Functions | 88.63% |
| Lines | 89.80% |

All test files and individual tests passed. Each aggregate coverage metric is above 80%. Branch coverage is the closest to the threshold.

The run also reported 57.82 seconds spent creating jsdom environments. If runtime becomes a concern, the team can benchmark Vitest's suggested shared-environment options (`pool: 'vmThreads'` or `isolate: false`) before changing configuration. The workspace test script already invokes `vitest run --coverage`.

## 2. Focused test improvements

The following additions are recommended because they exercise meaningful application behavior and boundary conditions. They are prioritized by user impact and the value of the behavior being verified.

| Area | Suggested test additions |
|---|---|
| Shared-interest enrichment | Exercise the database-backed enrichment function with no candidate rides, duplicate candidate IDs, missing result rows, mixed consent, absent visible tags, and a valid shared-tag intersection. Verify that private labels are never returned when consent requirements are not met. |
| Ride search results page | Extend the page tests to cover a populated result list, a single result versus multiple results, invalid repeated query parameters, and profile-setup redirection. Verify that malformed URL filters never reach the search query. |
| Ride search and offer pages | Add server-page tests around authentication, incomplete profile setup, option/default loading, and errors from the data-loading functions. Keep form validation and interaction assertions in the existing form-component tests. |
| Admin AI decision endpoint | Extend route tests across invalid complaint IDs, malformed request bodies, invalid analysis IDs, every decision refusal kind, and successful audited decisions. Assert that rejected requests do not start an admin action. |
| Admin external-fare endpoint | Add route-level tests for unauthenticated/non-admin access, malformed ranges, stale-version conflicts, successful persistence, and database/configuration refusals. |
| Admin vehicle-type update endpoint | Add cases for invalid IDs, invalid update payloads, successful rename/capacity/activation changes, stale-version conflicts, not-found responses, and authorization refusals. |
| Test runtime | Measure the current suite before and after any Vitest environment change; retain the current isolation behavior unless the benchmark shows a reliable improvement without cross-test state leakage. |

## 3. Test work added in this review

Added database-backed unit tests for `enrichSharedInterests` in `apps/web/src/lib/ai/shared-interest-enrichment.test.ts`. The tests cover:

- Empty candidate input without a database call.
- Candidate ID deduplication and default results when the query returns no rows.
- Mapping and normalization of approved shared labels.
- Withholding labels when participant consent is incomplete.
- Distinguishing an empty shared-interest intersection from unavailable participant data.

The repository already has focused tests for the ride-results page, admin AI-decision route, and admin configuration routes. The recommendations above are intended as targeted extensions to those suites, not duplicate test files.

## 4. Reproduction instructions

From the repository root, on the final `master`:

```bash
git switch master
git pull origin master
npm ci
npm test -- --coverage
```

After the command completes:

1. Record the exact commit SHA tested and the test/coverage summary.
2. Preserve the generated HTML report from the configured coverage output directory.
3. Retain a machine-readable coverage summary if area-level weighted totals are required.
4. Update this report with the final run; do not carry forward older figures after master changes.
5. Confirm the exact metric(s) and threshold specified by NFR-RD-17.

## 5. Conclusion

The supplied run passed all 200 test files and 1,530 individual tests. Statement, branch, function, and line coverage were all above 80%. The HTML report is preserved in this PR. The review adds focused tests around privacy-sensitive shared-interest enrichment and identifies concrete follow-up cases for ride-search pages and administrative endpoints.
