# Operations Admin Initial Requirements Traceability Matrix

## Purpose

This is the initial traceability baseline for the validated Operations Admin requirements. It connects:

**Requirement → Scenario-Based User Story → Use Case → Verification**

Verification entries describe how the requirement can be tested or inspected later. They are not test results and do not imply that implementation already exists.

---

## 1. Functional Requirement Traceability

| Requirement | User story / scenario | Use case | Verification approach |
|---|---|---|---|
| OA-FR-01 | US-OA-01 — A New Vehicle Type Becomes Popular | UC-OA-01 | Functional acceptance test: add a vehicle type and verify it becomes active for future rides. |
| OA-FR-02 | US-OA-03 — A Vehicle Type Is No Longer Supported | UC-OA-02 | Functional test: deactivate a type and verify it is unavailable for new rides while historical records remain. |
| OA-FR-03 | US-OA-02 — A Popular Vehicle Type Needs a Capacity Change | UC-OA-03 | Functional test: configure capacity and verify the new value is accepted for future rides. |
| OA-FR-05 | US-OA-04 — A New Destination Needs to Be Supported | UC-OA-04 | Functional test: add a hub and verify it becomes an active configured destination. |
| OA-FR-06 | US-OA-05 — A Destination Changes or Stops Being Supported | UC-OA-05 | Functional test: modify a hub and verify existing ride references remain unchanged. |
| OA-FR-07 | US-OA-05 — A Destination Changes or Stops Being Supported | UC-OA-05 | Functional test: deactivate a hub and verify it is unavailable for new rides while historical references remain. |
| OA-FR-10 | US-OA-06 — Different Vehicle Types Need Different Campus Fares | UC-OA-06 | Functional test: configure fares for hub pair/vehicle type combinations and verify non-directionality. |
| OA-FR-11 | US-OA-07 — Riders Need an External Fare Estimate | UC-OA-07 | Functional test: configure an external fare range for a segment and vehicle type. |
| OA-FR-16 | US-OA-08 — An Admin Needs to Investigate a Ride Without Interfering With It | UC-OA-08 | Functional/access test: authorized Admin can view ride information. |
| OA-FR-18 | US-OA-09, US-OA-10 — Fare-share complaint / SOS complaint | UC-OA-09 | Functional/privacy test: authorized Admin can view rider complaints. |
| OA-FR-20 | US-OA-09, US-OA-10 — Complaint history scenarios | UC-OA-09 | Functional test: view current and retained previous complaints for reported rider. |
| OA-FR-21 | US-OA-11 — A Warning Is Issued After Reviewing Repeated Fare Complaints | UC-OA-10 | Acceptance test: warning requires reason and is recorded. |
| OA-FR-23 | US-OA-12, US-OA-13 — Three-month / indefinite suspension | UC-OA-11 | Functional test: create both finite and indefinite suspension states. |
| OA-FR-28 | US-OA-14 — An Indefinitely Suspended Rider Is Manually Reactivated | UC-OA-12 | Functional test: manually reactivate suspended rider and verify audit information. |
| OA-FR-34 | US-OA-15 — The AI Flags Repeated Fare-Share Complaints | UC-OA-13 | AI oversight test: verify warning/suspension is not executed without explicit Admin approval. |
| OA-FR-36 | US-OA-16 — The Admin Rejects an AI Recommendation | UC-OA-14 | AI oversight test: rejection requires a reason and prevents execution. |
| OA-FR-42 | US-OA-09, US-OA-10, US-OA-15, US-OA-19 | UC-OA-09, UC-OA-13, UC-OA-15 | Authorization/privacy test: authorized Admin can view the specified rider/account history. |

---

## 2. System Functional Requirement Traceability

| Requirement | User story / scenario | Use case | Verification approach |
|---|---|---|---|
| SYS-FR-04 | US-OA-02 | UC-OA-03 | State-transition test: capacity change affects only newly created rides. |
| SYS-FR-08 | US-OA-04, US-OA-05 | UC-OA-04, UC-OA-05 | Functional test: rider destination selection is restricted to active configured hubs. |
| SYS-FR-09 | US-OA-04 | UC-OA-04 | Configuration inspection / initialization test: required initial hubs are present. |
| SYS-FR-12 | US-OA-07 | UC-OA-07 | Functional test: external range is displayed as an estimate. |
| SYS-FR-13 | US-OA-07 | UC-OA-07 | Authorization/function test: Admin cannot set final exact external fare. |
| SYS-FR-14 | US-OA-06 | UC-OA-06 | Fare calculation test: common segment is divided equally among riders sharing it. |
| SYS-FR-15 | US-OA-06 | UC-OA-06 | Fare calculation test: rider-specific post-common-segment fare is added to that rider's total. |
| SYS-FR-17 | US-OA-08 | UC-OA-08 | Authorization test: Admin ride modification is rejected. |
| SYS-FR-19 | US-OA-10 | UC-OA-09 | Functional test: rider can submit SOS complaint against another rider. |
| SYS-FR-45 | US-OA-01, 02, 03, 04, 05, 06, 07, 09, 11, 12, 13, 14, 15, 16, 18, 20 | UC-OA-02, 03, 04, 06, 07, 08, 09, 11, 12, 13, 14 | Audit verification: each state-changing Admin action records authenticated Admin identity, timestamp, action, affected entity, and required reason where applicable. |
| SYS-FR-24 | US-OA-12, US-OA-13 | UC-OA-11 | Functional test: suspended rider cannot create or join rides. |
| SYS-FR-25 | US-OA-12 | UC-OA-11 | Time/state test: temporary suspension automatically reactivates at expiry. |
| SYS-FR-26 | US-OA-13, US-OA-14 | UC-OA-11, UC-OA-12 | State test: indefinite suspension persists until manual reactivation. |
| SYS-FR-27 | US-OA-12, US-OA-13, US-OA-14 | UC-OA-11, UC-OA-12 | Data-integrity test: historical records survive suspension/reactivation. |
| SYS-FR-30 | US-OA-15 | UC-OA-13 | AI output test: valid complaint summary is displayed. |
| SYS-FR-31 | US-OA-15, US-OA-17 | UC-OA-13, UC-OA-16 | Data-integrity test: original complaint is preserved independently of AI output. |
| SYS-FR-32 | US-OA-15 | UC-OA-13 | AI output test: severity and behavioral tags are displayed when valid output exists. |
| SYS-FR-33 | US-OA-15, US-OA-16 | UC-OA-13, UC-OA-14 | AI oversight test: valid enforcement recommendation is shown to Admin. |
| SYS-FR-35 | US-OA-16 | UC-OA-14 | Negative test: rejected AI recommendation does not execute. |
| SYS-FR-37 | US-OA-15, US-OA-16 | UC-OA-13, UC-OA-14 | Authorization/AI safety test: AI cannot directly change warning/suspension state. |
| SYS-FR-38 | US-OA-15, US-OA-16 | UC-OA-13, UC-OA-14 | Audit test: complaint ID, recommendation, decision, Admin, timestamp, and final action are recorded. |
| SYS-FR-39 | US-OA-19 | UC-OA-15 | Authentication test: unauthenticated user cannot obtain Admin access. |
| SYS-FR-40 | US-OA-19 | UC-OA-15 | Authorization test: all authorized Admins receive the same Admin permission set. |
| SYS-FR-41 | US-OA-19 | UC-OA-15 | Negative security test: Rider cannot self-assign Admin role. |
| SYS-FR-43 | US-OA-09, US-OA-10, US-OA-15, US-OA-19 | UC-OA-09, UC-OA-13, UC-OA-15 | Privacy/authorization test: sensitive records are inaccessible to unauthorized users. |
| SYS-FR-44 | US-OA-19 | UC-OA-15 | Authorization test: Admin cannot modify rider personal profile data through Admin account-management functions. |
| SYS-FR-46 | US-OA-17 | UC-OA-16 | Failure test: AI failure/timeout/invalid/low-confidence output routes complaint to manual review. |
| SYS-FR-47 | US-OA-17 | UC-OA-16 | Failure/data-integrity test: original complaint survives AI failure. |
| SYS-FR-48 | US-OA-20 and all state-changing Admin stories | Cross-cutting | Atomicity test: success is reported only after all relevant state changes persist. |

---

## 3. Non-Functional Requirement Traceability

| Requirement | User story / scenario | Verification approach |
|---|---|---|
| SYS-NFR-01 | US-OA-01–07, 11–14, 18, 20 | Audit-record inspection and automated audit assertions for previous/new configuration values. |
| SYS-NFR-02 | US-OA-01, 03, 05, 09–20 | Security/integrity tests attempting audit modification and unauthorized access. |
| SYS-NFR-03 | US-OA-01–20 | Server-side authorization tests for every Admin-protected operation and data access. |
| SYS-NFR-04 | US-OA-02, US-OA-05, US-OA-06, US-OA-18 | Concurrent configuration tests with competing Admin updates. |
| SYS-NFR-05 | US-OA-02, US-OA-05, US-OA-06, US-OA-18 | Negative/concurrency tests verifying actionable stale-update feedback. |
| SYS-NFR-06 | US-OA-01–07, US-OA-11–14, US-OA-18, US-OA-20 | Failed-operation audit tests and audit-log inspection. |
| SYS-NFR-07 | US-OA-09, US-OA-10, US-OA-15, US-OA-19 | Privacy/access-control tests over complaints, disciplinary records, and AI enforcement data. |
| SYS-NFR-08 | US-OA-01–07, US-OA-11–14, US-OA-18–20 | Identity/audit tests verifying the acting Admin cannot be spoofed. |
| SYS-NFR-09 | US-OA-17 | AI outage/failure test demonstrating manual complaint handling remains available. |
| SYS-NFR-10 | US-OA-15, US-OA-16, US-OA-17 | AI oversight tests covering advisory output, approval, rejection, and failure paths. |
| SYS-NFR-11 | US-OA-03, US-OA-05, US-OA-06, US-OA-11–14 | Historical-record integrity tests after deactivation, fare changes, suspension, and reactivation. |
| SYS-NFR-12 | US-OA-01–20 | Acceptance/usability tests confirming successful, rejected, pending-approval, and manual-review outcomes are distinguishable. |

---

## 4. User Story → Use Case Mapping

| User story | Use case(s) |
|---|---|
| US-OA-01 | UC-OA-02 — Manage Vehicle Types and Capacity |
| US-OA-02 | UC-OA-02 — Manage Vehicle Types and Capacity |
| US-OA-03 | UC-OA-02 — Manage Vehicle Types and Capacity |
| US-OA-04 | UC-OA-03 — Manage Destination Hubs |
| US-OA-05 | UC-OA-03 — Manage Destination Hubs |
| US-OA-06 | UC-OA-04 — Configure Fare Rules and Estimates |
| US-OA-07 | UC-OA-04 — Configure Fare Rules and Estimates |
| US-OA-08 | UC-OA-05 — View Rides |
| US-OA-09 | UC-OA-06 — Review Rider Complaints and SOS Complaints; UC-OA-10 — Review Rider Account and Disciplinary History |
| US-OA-10 | UC-OA-06 — Review Rider Complaints and SOS Complaints; UC-OA-10 — Review Rider Account and Disciplinary History |
| US-OA-11 | UC-OA-07 — Issue a Rider Warning |
| US-OA-12 | UC-OA-08 — Suspend a Rider Account |
| US-OA-13 | UC-OA-08 — Suspend a Rider Account |
| US-OA-14 | UC-OA-09 — Manually Reactivate a Suspended Rider |
| US-OA-15 | UC-OA-11 — Review AI Complaint Analysis; UC-OA-12 — Review and Decide on an AI Enforcement Recommendation |
| US-OA-16 | UC-OA-12 — Review and Decide on an AI Enforcement Recommendation |
| US-OA-17 | UC-OA-14 — Handle AI Analysis Failure Through Manual Review |
| US-OA-18 | UC-OA-02 / UC-OA-03 / UC-OA-04 — Configuration management use cases |
| US-OA-19 | UC-OA-01 — Access Operations Admin Functions |
| US-OA-20 | UC-OA-13 — Review AI Enforcement Decision History; cross-cutting audit behavior |

## 5. Verification Categories

The initial verification plan uses the following categories:

- **Functional acceptance testing:** verifies that an Admin goal can be completed and produces the specified result.
- **Negative testing:** verifies prohibited actions are rejected.
- **Authorization/security testing:** verifies role boundaries and server-side enforcement.
- **Privacy testing:** verifies sensitive complaint, disciplinary, and AI records are protected.
- **Audit verification:** verifies required identity, timestamp, action, entity, reason, and configuration values are recorded.
- **Data-integrity testing:** verifies historical records survive configuration and account-state changes.
- **Concurrency testing:** verifies stale configuration updates are rejected rather than silently overwriting newer changes.
- **Failure-injection testing:** verifies persistence and AI failures do not create false success or corrupt source data.
- **AI oversight testing:** verifies approval/rejection boundaries and manual fallback behavior.
- **Usability/clarity inspection:** verifies Admin-facing outcomes clearly indicate whether an operation succeeded, failed, or was rejected.

---

## 6. Initial Traceability Status

This matrix is an **initial baseline**, not evidence of implementation or test completion.

The intended future chain is:

**Requirement → User Story → Use Case → Jira Issue → GitHub branch/commit/PR → Test Case → Test Result**

No Jira issue IDs, commits, branches, or test results are invented in this document.
