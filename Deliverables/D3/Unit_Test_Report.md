# D3 Unit Test and Coverage Report

**Story:** Story B (Khushi) — Unit and system testing, defect history  
**Scope:** B1 — Unit tests and coverage report  
**Repository:** `CS455-Carpooling/Campus_Ridepooling_Automation`  
**Branch tested:** `master`  
**Commit tested:** `8f15a9a9b5689b6aab0113f28e5719b047b1dc77`  
**CI run:** [GitHub Actions run #229](https://github.com/CS455-Carpooling/Campus_Ridepooling_Automation/actions/runs/41085419528)  
**Run date:** 30 October 2026  
**Coverage provider:** Vitest with V8

> **Evidence note:** This report records the latest successful master CI run inspected for this report. The CI job ran the equivalent workspace test command (`vitest run --coverage`), not a fresh interactive execution in this session. GitHub Actions did not retain an artifact for this run (`total_count: 0`), so the HTML report is not attached here. Re-run `npm test -- --coverage` on the final master and preserve the generated HTML report before final submission.

## 1. Execution summary

| Metric | Result |
|---|---:|
| Test files | 200 passed / 200 |
| Individual tests | 1,530 passed / 1,530 |
| Test duration | 77.28 seconds (reported by Vitest) |
| Statements | 87.44% |
| Branches | 80.70% |
| Functions | 88.63% |
| Lines | 89.80% |

All 200 test files and all 1,530 tests passed in the inspected CI run. The aggregate statement, branch, function, and line coverage values are each at or above the 80% threshold. Branch coverage is the closest to the threshold, at 80.70%.

The repository CI run also completed its formatting, lint, type-check, build, and PostgreSQL integration-test jobs successfully. Those checks provide useful context but are not counted as unit-test coverage.

## 2. Coverage summary by area

The coverage output is a per-file Vitest table; it does not provide separately calculated weighted totals for the broad areas below. Therefore, this section reports the observed coverage profile and representative files rather than inventing area-level percentages.

| Area | Observations from the coverage output | Follow-up |
|---|---|---|
| Library / shared source (`src`, including `src/lib`) | Several shared modules are well covered, but `src/App.tsx` and `src/documentation.ts` appear at 0%. The `enrichment.ts` module is also at 0% across statements, branches, functions, and lines. | Review whether these modules are in the intended test scope. Add focused tests for runtime behavior; if a file is intentionally non-runtime or excluded by design, document that rationale and adjust coverage scope transparently rather than silently ignoring it. |
| API routes | Many authentication and admin routes in the visible report are at or near 100%. Some routes have lower coverage, including the admin AI-decision route (76% statements), external-fares route (75% statements), and vehicle-types/[id] route (71.42% statements). | Prioritize authorization, validation, error, and boundary branches for the lower-covered routes. |
| UI / page components | Coverage is uneven. Several pages are at 100%, while the rides landing page and new-ride page show 0%; rides/results is 76.92% statements and 25% functions. Some loading components also show 0%. | Add component/page tests for user-visible states and interactions where these files contain meaningful behavior. Confirm whether loading-only and framework entry files are intended to be measured. |

## 3. Weakest-covered files and recommended action

The following are concrete examples from the CI coverage table, ordered roughly from most urgent. Percentages are exactly as printed by Vitest.

| File (as shown in CI output) | Statements | Branches | Functions | Lines | Recommendation |
|---|---:|---:|---:|---:|---|
| `src/lib/enrichment.ts` | 0% | 0% | 0% | 0% | Highest priority: determine whether this is active application logic; if so, add tests for its main paths and failure cases. |
| `src/App.tsx` | 0% | 0% | 0% | 0% | Check whether this is an active entry point in the Next.js app or legacy/dead code; test or document/exclude with justification. |
| `src/app/(app)/rides/page.tsx` | 0% | 0% | 0% | 0% | Add page tests for ride-list loading, empty, populated, and error states if the page owns this behavior. |
| `src/app/(app)/rides/new/page.tsx` | 0% | 0% | 0% | 0% | Add tests for ride creation form validation, submission, and failure handling. |
| `src/documentation.ts` | 0% | 0% | 0% | 0% | Confirm whether this file is executable application code; test it or document why it should not contribute to runtime coverage. |
| `src/app/(app)/rides/results/page.tsx` | 76.92% | 58.33% | 25% | 72.72% | Add tests for untested branches and callback/function behavior, including result and empty/error states. |
| `src/app/api/admin/complaints/[id]/ai-decision/route.ts` | 76% | 70% | 100% | 76.19% | Cover remaining decision/error branches and invalid or unauthorized requests. |
| `src/app/api/admin/external-fares/route.ts` | 75% | 75% | 50% | 88.88% | Exercise the untested function and branch paths, including invalid input and upstream failure. |
| `src/app/api/admin/vehicle-types/[id]/route.ts` | 71.42% | 66.66% | 50% | 100% | Add tests for remaining branches and function paths, especially missing/invalid resource cases. |

**Interpretation caution:** A 0% result is a test-coverage observation, not by itself proof of a defect. In particular, framework entry points, loading components, or legacy files may not need conventional unit tests. Confirm that each file is in the intended coverage scope before deciding whether to add tests or exclude it with a documented rationale.

## 4. Acceptance-criteria status

| B1 requirement | Status | Evidence / remaining work |
|---|---|---|
| Run unit tests with coverage on master | **Passed in inspected CI** | 200 test files and 1,530 tests passed on master commit `8f15a9a`. |
| Overall 80% coverage gate | **Passed in inspected CI** | Statements 87.44%, branches 80.70%, functions 88.63%, lines 89.80%. Confirm the exact metric used by NFR-RD-17 with the project rubric/configuration. |
| Summary by area (library, API routes, components) | **Partially complete** | Qualitative area summary and representative weak files are listed. Separate weighted area totals need a fresh machine-readable coverage summary. |
| List weakest-covered files and explain why / add tests | **Partially complete** | Weak files and likely follow-up actions are identified. File-by-file intent must be checked before treating 0% as a missing-test defect. |
| Save HTML report | **Outstanding** | No HTML coverage artifact was retained by the inspected GitHub Actions run. Generate locally on final master and attach/commit the report as required by the team convention. |
| Refresh final numbers on 5 Nov | **Outstanding** | Re-run against final master on 5 November and update this report with the final commit SHA and results. |

## 5. Reproduction instructions

From the repository root, on the final `master`:

```bash
git switch master
git pull origin master
npm ci
npm test -- --coverage
```

The web workspace currently runs Vitest with coverage through its package test script. The CI log for the inspected run shows the underlying command as `vitest run --coverage`.

After the command completes:

1. Record the commit SHA tested and the test/coverage summary.
2. Preserve the generated HTML report from the configured coverage output directory (commonly `apps/web/coverage/`; verify the actual path in the Vitest configuration).
3. Export or retain the machine-readable coverage summary (for example, the V8/Istanbul JSON summary if configured) so weighted totals by library, API routes, and components can be calculated reproducibly.
4. Update the tables in this report; do not carry forward the 30 October numbers if master has changed.
5. Confirm the NFR-RD-17 threshold and report which coverage metric(s) it applies to.

## 6. Conclusion

The inspected master CI run is green: 200 test files and 1,530 tests passed. Aggregate coverage exceeds 80% for statements, branches, functions, and lines, although branch coverage has only a 0.70 percentage-point margin. Coverage is not uniform: several files show 0%, and a few API/UI files have materially lower branch or function coverage.

B1 is therefore **not fully complete yet**. The remaining work is to validate the weak-file scope, obtain a retained HTML and machine-readable coverage report, calculate genuine area-level summaries, and refresh all results on the final master on 5 November.
