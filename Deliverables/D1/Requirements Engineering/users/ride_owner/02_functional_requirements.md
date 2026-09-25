# Ride Owner — Functional Requirements

This document refines the Ride Owner user requirements in `01_requirements_specification.md` into verifiable system behaviours. Each requirement is traced to its parent user requirement.

## 1. Registration and Profile (Shared)

| ID | Statement | Parent |
|---|---|---|
| FR-RO-01.1 | The system shall allow a Ride Owner to register and sign in using Google OAuth restricted to the `iitk.ac.in` domain. | UR-RO-01 |
| FR-RO-02.1 | The system shall allow a Ride Owner to create and update a profile containing travel preferences and optional interest tags. | UR-RO-02 |

## 2. Ride Creation, Modification, and Cancellation

| ID | Statement | Parent |
|---|---|---|
| FR-RO-03.1 | The system shall allow a Ride Owner to create a ride by providing a destination, departure time window, fixed vehicle capacity, and expected total fare. | UR-RO-03 |
| FR-RO-03.2 | The system shall validate that the departure time is in the future, the capacity and expected total fare are valid positive values, and the Ride Owner has no conflicting active ride. | UR-RO-03 |
| FR-RO-03.3 | The system shall create a valid new ride in the `Scheduled` state and make it available to Riders searching for matching rides. | UR-RO-03 |
| FR-RO-04.1 | The system shall allow a Ride Owner to edit the destination, departure time window, capacity, or expected total fare of an open, unlocked ride. | UR-RO-04 |
| FR-RO-04.2 | The system shall notify accepted Riders when an edit to their ride is saved. | UR-RO-04 |
| FR-RO-04.3 | The system shall require the Ride Owner to confirm an edit that may affect already accepted Riders. | UR-RO-04 |
| FR-RO-04.4 | The system shall allow a Ride Owner to cancel a ride that has not started and shall notify all accepted Riders of the cancellation. | UR-RO-04 |
| FR-RO-04.5 | The system shall prevent normal edit and cancellation actions after a ride is locked, in accordance with P-06. | UR-RO-04 |

## 3. Join-Request and Pool Management

| ID | Statement | Parent |
|---|---|---|
| FR-RO-05.1 | The system shall show the Ride Owner every pending request for their open ride, together with relevant Rider profile details. | UR-RO-05 |
| FR-RO-05.2 | The system shall allow the Ride Owner to accept a pending request only when the ride is open and has available capacity. | UR-RO-05 |
| FR-RO-05.3 | When a request is accepted, the system shall add the Rider to the confirmed pool, update the available-seat count, and notify the Rider. | UR-RO-05 |
| FR-RO-05.4 | The system shall allow the Ride Owner to reject a pending request without adding the Rider to the pool and shall notify the Rider of the decision. | UR-RO-05 |
| FR-RO-05.5 | The system shall notify the Ride Owner when a new join request is submitted. | UR-RO-05 |
| FR-RO-06.1 | The system shall display the fixed capacity, confirmed occupants, and remaining seats for a ride. | UR-RO-06 |
| FR-RO-06.2 | The system shall allow the Ride Owner to lock a scheduled ride before P-02. | UR-RO-06 |
| FR-RO-06.3 | The system shall automatically lock a ride at P-02 if it has not already been locked by the Ride Owner. | UR-RO-06 |
| FR-RO-06.4 | The system shall prevent new join requests, request acceptances, and voluntary exits after a ride is locked. | UR-RO-06 |

## 4. Fare, Trip, and Arrival Management

| ID | Statement | Parent |
|---|---|---|
| FR-RO-07.1 | The system shall display the expected total fare and the current calculated share for each confirmed occupant. | UR-RO-07 |
| FR-RO-07.2 | The system shall recalculate and display fare shares whenever a Rider is accepted, leaves before lock time, or is marked as a no-show. | UR-RO-07 |
| FR-RO-07.3 | The system shall ensure that the displayed occupant shares total the expected total fare, subject to the system rounding rule. | UR-RO-07 |
| FR-RO-09.1 | The system shall allow the Ride Owner to transition a locked ride from `Scheduled` to `Pickup in Progress`. | UR-RO-09 |
| FR-RO-09.2 | The system shall notify confirmed Riders when pickup starts. | UR-RO-09 |
| FR-RO-09.3 | During `Pickup in Progress`, the system shall display the arrival status of each confirmed Rider and allow the Ride Owner to mark a Rider as `Arrived`. | UR-RO-09 |
| FR-RO-09.4 | The system shall allow the Ride Owner to transition a ride from `Pickup in Progress` to `Completed` and store the final active pool and final fare shares. | UR-RO-09 |
| FR-RO-10.1 | The system shall allow the Ride Owner to mark a confirmed Rider as `No-Show` only during `Pickup in Progress` and only after P-03 has elapsed. | UR-RO-10 |
| FR-RO-10.2 | When a Rider is marked as a no-show, the system shall remove the Rider from the active pool and recalculate the fare shares for the remaining active occupants. | UR-RO-10 |
| FR-RO-10.3 | The system shall record a no-show outcome for administrative review and the applicable rating or penalty workflow. | UR-RO-10 |

## 5. Communication, Settlement, Feedback, and Safety (Shared)

| ID | Statement | Parent |
|---|---|---|
| FR-RO-08.1 | The system shall provide a private text chat for the Ride Owner and accepted Riders in a confirmed pool. | UR-RO-08 |
| FR-RO-08.2 | The system shall prevent pending and rejected Riders from accessing the private ride chat. | UR-RO-08 |
| FR-RO-11.1 | The system shall show the completed ride summary with every active Rider's final fare share and settlement status. | UR-RO-11 |
| FR-RO-11.2 | The system shall allow the Ride Owner to mark an active Rider's fare share as `Settled` after receiving payment outside the application. | UR-RO-11 |
| FR-RO-11.3 | The system shall prevent a no-show Rider from being marked as settled for the standard ride share. | UR-RO-11 |
| FR-RO-11.4 | The system shall send configured reminders for unsettled fare shares. | UR-RO-11 |
| FR-RO-12.1 | The system shall allow the Ride Owner to submit a rating and optional feedback for each active Rider within P-04 after completion. | UR-RO-12 |
| FR-RO-12.2 | The system shall distinguish a no-show outcome from ordinary trip feedback. | UR-RO-12 |
| FR-RO-13.1 | The system shall allow the Ride Owner to submit a confidential misconduct complaint to the Operations Admin. | UR-RO-13 |
| FR-RO-13.2 | The system shall provide an SOS action during an active ride that requests location permission and sends an urgent alert to the Operations Admin. | UR-RO-13 |
| FR-RO-14.1 | The system shall notify the Ride Owner of new join requests, request outcomes, saved ride changes, pool locking, and pickup start. | UR-RO-14 |
| FR-RO-14.2 | The system shall notify affected Riders of request decisions, ride changes, ride cancellation, pool locking, and pickup start. | UR-RO-14 |
