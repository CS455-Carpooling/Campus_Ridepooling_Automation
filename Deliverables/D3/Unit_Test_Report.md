# D3 Unit Test and Coverage Report

**Story:** Story B (Khushi) — Unit and system testing, defect history  
**Scope:** B1 — Unit tests and coverage report  
**Repository:** `CS455-Carpooling/Campus_Ridepooling_Automation`  
**Run date:** 2 November 2026 (local run; terminal output supplied)  
**Coverage provider:** Vitest with V8

> **Execution evidence:** The coverage figures below come from `npm test -- --coverage` on 2 November 2026. The user confirmed that the working copy had been pulled from the latest `master` before the run. The exact tested commit SHA was not captured. The HTML report is included at `Deliverables/D3/unit-coverage-report.zip`.

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

All test files and individual tests passed in the supplied run. Each aggregate coverage metric was above 80%.

The run also reported 57.82 seconds spent creating jsdom environments. Vitest suggested considering a shared environment per worker (`pool: 'vmThreads'`) or `isolate: false` as a possible runtime optimization. No test-environment configuration change is included in this PR.

## 2. Tests added in this update

Added database-backed unit tests for `enrichSharedInterests` in:

`apps/web/src/lib/ai/shared-interest-enrichment.test.ts`

The new tests cover these behaviors:

1. An empty candidate list returns an empty map and does not query the database.
2. Duplicate candidate ride IDs are deduplicated for the query and map, and candidates without returned rows retain an unavailable (`null`) value.
3. Approved shared labels are returned in normalized, deduplicated order; candidates without returned rows remain unavailable.
4. Shared labels are withheld when participant consent is incomplete.
5. An empty shared-interest intersection is represented as an empty list, while missing visible-tag data is represented as unavailable (`null`).

These cases exercise the database-backed enrichment flow and its privacy-related output handling. The existing `shared-interest-tags.test.ts` continues to cover the tag-resolution helper independently.

## 3. Execution status

The baseline coverage figures in Section 1 are from the local run on 2 November 2026, before the test addition in this update. The newly added tests have not yet been included in a verified coverage run in this report.

To verify the updated suite and obtain the revised totals, run from the repository root:

```bash
cd apps/web
npm test -- --coverage
```

Record the resulting test counts, coverage figures, and exact commit SHA after that run. The HTML coverage report should then be refreshed from the generated coverage directory and the ZIP in this deliverable updated if the final report is intended to contain the post-change HTML output.

## 4. Reproduction instructions

From the repository root:

```bash
git switch master
git pull origin master
npm ci
cd apps/web
npm test -- --coverage
```

The report's baseline numbers should not be treated as the final post-change numbers until the updated suite has been run and the results recorded.
