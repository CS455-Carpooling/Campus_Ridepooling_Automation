# Ride Owner — Functional Requirements

This document refines the user requirements from `01_requirements_specification.md` into functional system requirements.

## 1. Registration, Profile, and Authentication (Shared)

*Note: These requirements mirror those of the Rider, adapted for the Ride Owner role.*

| ID | Statement | Parent |
|---|---|---|
| FR-RO-01.1 | The system shall allow a Ride Owner to register and sign in using Google OAuth restricted to the `iitk.ac.in` domain. | UR-RO-01 |
| FR-RO-02.1 | The system shall allow a Ride Owner to maintain a profile with travel preferences and optional interest tags. | UR-RO-02 |

## 2. Ride Creation and Pooling

| ID | Statement | Parent |
|---|---|---|
| FR-RO-03.1 | The system shall allow the Ride Owner to create a ride by providing: destination, departure time window, and fixed vehicle capacity (e.g., Auto - 3 seats). | UR-RO-03 |
| FR-RO-03.2 | The system shall validate that the departure time window is in the future and does not conflict with the Ride Owner's other active rides. | UR-RO-03 |
| FR-RO-04.1 | The system shall automatically add a Rider to the ride when the Rider confirms a join request, without requiring manual approval from the Ride Owner. | UR-RO-04 |
| FR-RO-04.2 | The system shall prevent further Riders from joining once the ride's fixed capacity is reached. | UR-RO-04 |
| FR-RO-04.3 | The system shall lock the ride at the configured lock time (P-02) or when the Ride Owner manually locks it, preventing further joins or voluntary exits without penalty. | UR-RO-04 |

## 3. Trip Management and No-Shows

| ID | Statement | Parent |
|---|---|---|
| FR-RO-05.1 | The system shall allow the Ride Owner to transition the ride state from 'Scheduled' to 'Pickup in Progress'. | UR-RO-05 |
| FR-RO-05.2 | The system shall allow the Ride Owner to transition the ride state from 'Pickup in Progress' to 'Completed'. | UR-RO-05 |
| FR-RO-06.1 | The system shall allow the Ride Owner to mark a specific joined Rider as a 'No-Show' during the 'Pickup in Progress' state if the grace period (P-03) has elapsed. | UR-RO-06 |
| FR-RO-06.2 | Upon marking a no-show, the system shall automatically recalculate the fare shares for the remaining occupants based on the new active pool size. | UR-RO-06 |

## 4. Fares and Settlement

| ID | Statement | Parent |
|---|---|---|
| FR-RO-07.1 | The system shall display the total estimated fare for the ride and the current calculated share for each occupant. | UR-RO-07 |
| FR-RO-07.2 | The system shall update the displayed fare shares dynamically as Riders join or are marked as no-shows. | UR-RO-07 |
| FR-RO-09.1 | The system shall allow the Ride Owner to mark each Rider's fare share as 'Settled' once payment is received outside the app. | UR-RO-09 |
| FR-RO-09.2 | The system shall display the settlement status of all riders in the completed ride's summary. | UR-RO-09 |

## 5. Communication and Ratings (Shared)

| ID | Statement | Parent |
|---|---|---|
| FR-RO-08.1 | The system shall provide a private, real-time text chat for all occupants of a confirmed pool. | UR-RO-08 |
| FR-RO-10.1 | The system shall prompt the Ride Owner to rate each co-Rider within the rating window (P-04) after trip completion. | UR-RO-10 |
| FR-RO-10.2 | The system shall automatically submit a negative rating for a Rider marked as a no-show by the Ride Owner. | UR-RO-10 |
| FR-RO-11.1 | The system shall allow the Ride Owner to submit a confidential complaint to the Operations Admin. | UR-RO-11 |
| FR-RO-11.2 | The system shall provide an SOS button during an active trip that immediately notifies the Operations Admin. | UR-RO-11 |
| FR-RO-12.1 | The system shall send real-time notifications to the Ride Owner when a Rider automatically joins the ride. | UR-RO-12 |
