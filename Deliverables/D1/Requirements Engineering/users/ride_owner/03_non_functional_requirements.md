# Ride Owner — Non-Functional Requirements

This document defines measurable quality constraints for the functional behaviours in `02_functional_requirements.md`. These requirements specify how the system must perform and protect data, rather than which Ride Owner actions it provides.

## 1. Performance and Scale (PERF)

| ID | Requirement |
|---|---|
| NFR-RO-PERF-01 | The system shall create a valid new ride and make it visible to eligible Rider searches within 2 seconds of form submission. |
| NFR-RO-PERF-02 | The system shall show a newly submitted join request to the Ride Owner and deliver its notification within 2 seconds. |
| NFR-RO-PERF-03 | The system shall process an accept or reject decision and update the request status, capacity, and relevant notifications within 2 seconds. |
| NFR-RO-PERF-04 | Ride-state changes, including `Scheduled` to `Pickup in Progress` and `Pickup in Progress` to `Completed`, shall be reflected across all confirmed-occupant views within 1 second. |
| NFR-RO-PERF-05 | Fare recalculation after a Rider is accepted, leaves, or is marked as a no-show shall complete and update the Ride Owner interface within 500 milliseconds. |

## 2. Dependability and Reliability (DEP)

| ID | Requirement |
|---|---|
| NFR-RO-DEP-01 | The ride lifecycle and request-decision workflow shall be strongly consistent so that a Rider cannot become a confirmed occupant without an accepted request. |
| NFR-RO-DEP-02 | The system shall handle concurrent join requests and acceptance attempts without allowing confirmed occupants to exceed the fixed vehicle capacity. |
| NFR-RO-DEP-03 | The system shall persist each request decision, ride lock, arrival status, no-show event, and settlement-status change atomically, so a partial update cannot leave the ride in an inconsistent state. |
| NFR-RO-DEP-04 | Once a ride is locked, the system shall reliably reject normal joins, acceptances, voluntary exits, edits, and cancellations in accordance with the configured lock policy. |

## 3. Security and Privacy (SEC)

| ID | Requirement |
|---|---|
| NFR-RO-SEC-01 | Only the Ride Owner of a ride may accept or reject its join requests, edit or cancel it, lock it, record arrivals or no-shows, and mark settlements. |
| NFR-RO-SEC-02 | Rider profile details shown for a join request shall be limited to information necessary for the Ride Owner's acceptance decision. |
| NFR-RO-SEC-03 | The Ride Owner's SOS location shall be transmitted only to authorized Operations Admin personnel and shall not be visible to other Riders. |
| NFR-RO-SEC-04 | Private ride chat shall be accessible only to confirmed occupants, retained securely for 30 days after completion for audit purposes, and permanently deleted after that retention period. |
| NFR-RO-SEC-05 | Ride Owner phone numbers and external contact details shall be visible only to confirmed occupants of the locked pool, not to pending Riders or the general public. |
| NFR-RO-SEC-06 | Complaints, no-show records, and settlement-status data shall be visible only to authorized users whose role requires access. |

## 4. Usability and Accessibility (USE)

| ID | Requirement |
|---|---|
| NFR-RO-USE-01 | The Ride Owner dashboard shall be fully operable on mobile devices, with touch targets of at least 44 by 44 CSS pixels for critical actions such as `Accept`, `Reject`, `Start Pickup`, and `Mark No-Show`. |
| NFR-RO-USE-02 | Before an acceptance decision, the interface shall show the Rider's request status, available capacity, and the resulting estimated fare share clearly enough for the Ride Owner to make an informed decision. |
| NFR-RO-USE-03 | Before a no-show is confirmed, the interface shall show the affected Rider, grace-period status, and before-and-after fare split. |
| NFR-RO-USE-04 | Status indicators for pending, accepted, rejected, arrived, no-show, settled, and unpaid shall be visually distinct and accompanied by text labels. |
