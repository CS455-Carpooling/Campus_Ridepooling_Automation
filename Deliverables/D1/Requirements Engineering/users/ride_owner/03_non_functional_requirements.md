# Ride Owner — Non-Functional Requirements

## 1. Performance and Scale (PERF)

| ID | Requirement |
|---|---|
| NFR-RO-PERF-01 | The system shall create a new ride and make it visible in the pool within 2 seconds of the Ride Owner submitting the form. |
| NFR-RO-PERF-02 | State transitions (e.g., from Scheduled to Pickup in Progress) must be reflected across all occupant views within 1 second. |
| NFR-RO-PERF-03 | Recalculation of fare shares upon a no-show event must complete and update the UI in under 500 milliseconds. |

## 2. Dependability and Reliability (DEP)

| ID | Requirement |
|---|---|
| NFR-RO-DEP-01 | The ride state machine (creation -> scheduled -> pickup -> completed) must be strongly consistent to prevent double-booking or incorrect fare calculations. |
| NFR-RO-DEP-02 | The system must handle concurrent join requests gracefully, ensuring that a ride's fixed capacity is never exceeded even under high load. |

## 3. Security and Privacy (SEC)

| ID | Requirement |
|---|---|
| NFR-RO-SEC-01 | The Ride Owner's exact location (via SOS) shall only be transmitted to the Operations Admin, never to other Riders. |
| NFR-RO-SEC-02 | Ride chat history shall be immutable and securely retained for 30 days after completion for audit purposes, after which it is permanently deleted. |
| NFR-RO-SEC-03 | The Ride Owner's phone number or external contact details shall only be visible to confirmed occupants of the locked pool, not to the general public. |

## 4. Usability and Experience (USE)

| ID | Requirement |
|---|---|
| NFR-RO-USE-01 | The Ride Owner dashboard must be fully operable on mobile devices, with large tap targets for critical actions like "Start Pickup" and "Mark No-Show". |
| NFR-RO-USE-02 | The fare recalculation interface must clearly show the "before" and "after" split to the Ride Owner to prevent confusion when a no-show is marked. |
