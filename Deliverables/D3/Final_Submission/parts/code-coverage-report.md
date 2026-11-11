# D3 Code Coverage Report

Coverage of the final code on `master` at `5c8411d`, measured on 6 November 2026 with Vitest and V8. The unit run enforces an 80% threshold on all four metrics (NFR-RD-17), and the run fails below it.

## Unit test coverage

| Metric | Covered | Total | Coverage |
|---|---:|---:|---:|
| Statements | 6,174 | 7,042 | 87.67% |
| Branches | 5,249 | 6,487 | 80.91% |
| Functions | 1,228 | 1,383 | 88.79% |
| Lines | 5,500 | 6,112 | 89.98% |

## Unit test coverage by area

| Area | Files | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|---:|
| Other (`src`) | 2 | 0.00% | 0.00% | 0.00% | 0.00% |
| Pages (`src/app`) | 43 | 90.41% | 81.48% | 89.66% | 90.94% |
| API routes (`src/app/api`) | 48 | 91.42% | 85.07% | 89.26% | 94.60% |
| Components (`src/components`) | 77 | 84.35% | 78.53% | 84.18% | 85.87% |
| Domain logic (`src/lib`) | 60 | 93.21% | 88.00% | 96.63% | 95.85% |
| AI features (`src/lib/ai`) | 17 | 78.29% | 69.68% | 85.82% | 82.05% |

## Lowest statement coverage

Files with at least 20 statements.

| File | Statements | Statement count |
|---|---:|---:|
| `src/lib/ai/gemini-ranking.ts` | 0.00% | 42 |
| `src/components/rides/JoinRequestControls.tsx` | 23.40% | 94 |
| `src/components/profile/ProfileEditor.tsx` | 53.70% | 108 |
| `src/components/chatbot/ChatbotInterface.tsx` | 60.71% | 112 |
| `src/lib/ai/recommendations.ts` | 64.81% | 54 |
| `src/app/api/rides/[id]/settlements/[occupantId]/route.ts` | 66.66% | 39 |
| `src/lib/payment-settlement.ts` | 70.73% | 41 |
| `src/components/rides/RideChat.tsx` | 71.53% | 130 |
| `src/components/home/StudentHome.tsx` | 73.68% | 38 |
| `src/lib/ai/chatbot-tools.ts` | 75.24% | 101 |

## Integration test coverage

The integration suite runs the real route handlers against PostgreSQL, so it measures what runs with no database mocks. It has no threshold, because the unit run enforces the gate.

| Metric | Covered | Total | Coverage |
|---|---:|---:|---:|
| Statements | 1,687 | 7,042 | 23.95% |
| Branches | 1,197 | 6,487 | 18.45% |
| Functions | 290 | 1,383 | 20.96% |
| Lines | 1,547 | 6,112 | 25.31% |

## Full report

The browsable per-file HTML report from the CI run of 4 November 2026 is `Deliverables/D3/unit-coverage-report.zip`, and the Unit Test Report describes that run.
