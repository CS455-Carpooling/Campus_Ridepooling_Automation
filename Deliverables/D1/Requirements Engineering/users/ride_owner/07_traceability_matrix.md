# Ride Owner — Traceability Matrix

## 1. Purpose and Traceability Rules

This matrix establishes forward traceability from Ride Owner user requirements to functional requirements, use cases, user stories, planned backlog work, and verification. It also supports backward traceability: every functional requirement identifies its parent user requirement in `02_functional_requirements.md`.

The matrix follows these software-engineering principles:

- Every in-scope user requirement has a unique ID, priority, verification approach, and at least one downstream implementation or validation link.
- `Critical` requirements are candidates for the D2/D3 end-to-end chain: requirement → Jira issue → implementation branch/PR → test case → test result.
- A dash (`—`) identifies an intentional gap or a shared feature that still needs a dedicated Ride Owner user story; it is not evidence that the requirement is complete.
- Jira IDs, branch/PR links, test cases, and results are placeholders until the backlog, implementation, and test deliverables are created. They must be updated rather than replaced with untracked prose.

## 2. Functional Requirement Traceability

| User requirement | Priority | Critical | Functional requirements | Use case(s) | User story/stories | Jira issue | Verification method |
|---|---|---:|---|---|---|---|---|
| UR-RO-01 — Authentication | Must | No | FR-RO-01.1 | — (shared flow) | — (shared feature) | pending | Test, Inspection |
| UR-RO-02 — Profile | Should | No | FR-RO-02.1 | — (shared flow) | — (shared feature) | pending | Test, Demonstration |
| UR-RO-03 — Create ride | Must | Yes | FR-RO-03.1 to FR-RO-03.3 | UC-RO-01 | RO-US-01 | pending | Test, Demonstration |
| UR-RO-04 — Edit or cancel open ride | Should | No | FR-RO-04.1 to FR-RO-04.5 | UC-RO-02 | RO-US-02 | pending | Test, Demonstration |
| UR-RO-05 — Review and decide join requests | Must | Yes | FR-RO-05.1 to FR-RO-05.5 | UC-RO-03 | RO-US-03 to RO-US-05 | pending | Test, Demonstration |
| UR-RO-06 — Manage capacity and lock pool | Must | Yes | FR-RO-06.1 to FR-RO-06.4 | UC-RO-04 | RO-US-06 | pending | Test, Analysis |
| UR-RO-07 — Display fare and shares | Must | Yes | FR-RO-07.1 to FR-RO-07.3 | UC-RO-04 | RO-US-07 | pending | Test, Analysis |
| UR-RO-08 — Private pool chat | Should | No | FR-RO-08.1 to FR-RO-08.2 | UC-RO-05 | RO-US-08 | pending | Test, Demonstration |
| UR-RO-09 — Trip state and arrivals | Must | Yes | FR-RO-09.1 to FR-RO-09.4 | UC-RO-06, UC-RO-07 | RO-US-09, RO-US-10, RO-US-12 | pending | Test, Demonstration |
| UR-RO-10 — No-show handling | Must | Yes | FR-RO-10.1 to FR-RO-10.3 | UC-RO-07 | RO-US-11 | pending | Test, Analysis |
| UR-RO-11 — Fare settlement | Must | Yes | FR-RO-11.1 to FR-RO-11.4 | UC-RO-08 | RO-US-13 | pending | Test, Demonstration |
| UR-RO-12 — Ratings and no-show outcome | Should | No | FR-RO-12.1 to FR-RO-12.2 | UC-RO-09 | RO-US-14 | pending | Test, Demonstration |
| UR-RO-13 — Complaint and SOS | Must | Yes | FR-RO-13.1 to FR-RO-13.2 | UC-RO-09 | RO-US-15 | pending | Test, Inspection |
| UR-RO-14 — Event notifications | Should | No | FR-RO-14.1 to FR-RO-14.2 | UC-RO-02 to UC-RO-07 | RO-US-02 to RO-US-05, RO-US-09 | pending | Test, Demonstration |

## 3. Non-Functional Requirement Traceability

Non-functional requirements are traced to the functional flows they constrain. They are verified through measurable tests, security review, or usability inspection rather than being treated as user stories.

| Non-functional requirement | Constrained function / use case | Jira issue | Verification method |
|---|---|---|---|
| NFR-RO-PERF-01 | FR-RO-03.3 / UC-RO-01 | pending | Performance test |
| NFR-RO-PERF-02 | FR-RO-05.1, FR-RO-05.5 / UC-RO-03 | pending | Performance test |
| NFR-RO-PERF-03 | FR-RO-05.2 to FR-RO-05.4 / UC-RO-03 | pending | Performance test |
| NFR-RO-PERF-04 | FR-RO-09.1, FR-RO-09.4 / UC-RO-06, UC-RO-07 | pending | Performance test |
| NFR-RO-PERF-05 | FR-RO-07.2, FR-RO-10.2 / UC-RO-03, UC-RO-07 | pending | Performance test |
| NFR-RO-DEP-01 | FR-RO-05.2 to FR-RO-05.4 / UC-RO-03 | pending | Integration test, Analysis |
| NFR-RO-DEP-02 | FR-RO-05.2, FR-RO-06.1 / UC-RO-03, UC-RO-04 | pending | Concurrency test |
| NFR-RO-DEP-03 | FR-RO-05, FR-RO-06, FR-RO-09 to FR-RO-11 / UC-RO-03 to UC-RO-08 | pending | Integration test, Inspection |
| NFR-RO-DEP-04 | FR-RO-04.5, FR-RO-06.3 to FR-RO-06.4 / UC-RO-02, UC-RO-04 | pending | Integration test |
| NFR-RO-SEC-01 | Owner-only actions in FR-RO-04 to FR-RO-11 / UC-RO-02 to UC-RO-08 | pending | Authorization test, Security inspection |
| NFR-RO-SEC-02 | FR-RO-05.1 / UC-RO-03 | pending | Privacy inspection |
| NFR-RO-SEC-03 | FR-RO-13.2 / UC-RO-09 | pending | Authorization test, Security inspection |
| NFR-RO-SEC-04 | FR-RO-08.1 to FR-RO-08.2 / UC-RO-05 | pending | Authorization test, Retention inspection |
| NFR-RO-SEC-05 | FR-RO-05, FR-RO-08 / UC-RO-03, UC-RO-05 | pending | Authorization test, Security inspection |
| NFR-RO-SEC-06 | FR-RO-10.3, FR-RO-11, FR-RO-13 / UC-RO-07 to UC-RO-09 | pending | Authorization test, Security inspection |
| NFR-RO-USE-01 | FR-RO-05, FR-RO-09 to FR-RO-10 / UC-RO-03, UC-RO-06, UC-RO-07 | pending | Usability test, Inspection |
| NFR-RO-USE-02 | FR-RO-05.1 to FR-RO-05.4 / UC-RO-03 | pending | Usability test |
| NFR-RO-USE-03 | FR-RO-10.1 to FR-RO-10.2 / UC-RO-07 | pending | Usability test |
| NFR-RO-USE-04 | FR-RO-05, FR-RO-09 to FR-RO-11 / UC-RO-03, UC-RO-06 to UC-RO-08 | pending | Usability test, Inspection |

## 4. Coverage and Maintenance Status

| Artifact | Current coverage | Follow-up needed |
|---|---|---|
| User requirements | All 14 UR-RO requirements appear in the functional traceability matrix. | Add a dedicated shared-feature user story if the team requires story-level coverage for authentication and profile management. |
| Functional requirements | All 41 FR-RO requirements identify a parent UR and are represented through their UR row. | Add Jira IDs, implementation links, and D3 test-case IDs when available. |
| Non-functional requirements | All 19 NFR-RO requirements are linked to the function or use case they constrain. | Define measured test thresholds and record results in D3. |
| Use cases | UC-RO-01 to UC-RO-09 are linked to at least one user requirement. | Add diagram references if diagrams are produced. |
| User stories | RO-US-01 to RO-US-15 are linked to functional behaviour, except shared authentication/profile stories not yet authored. | Maintain links when stories or acceptance criteria change. |

*Baseline status: D1 draft. Jira IDs are `pending` until backlog import; branch/PR, test-case, and test-result columns are intentionally deferred to D2/D3 as specified by the team conventions.*
