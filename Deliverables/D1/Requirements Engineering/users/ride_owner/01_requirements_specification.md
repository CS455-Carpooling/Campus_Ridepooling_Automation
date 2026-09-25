# Ride Owner — Requirements Specification

| | |
|---|---|
| **System** | Campus Ride-Pooling and Split-Fare System |
| **Section** | User class: Ride Owner |
| **Author** | Prithviraj Ghosh |
| **Version** | 0.1 — draft for team review |
| **Deliverable** | D1 — Requirements, Architecture and Project Setup |

## 1. Introduction

### 1.1 Purpose

This section specifies the requirements of the **Ride Owner** user class. It contains the user requirements (for students, the instructor and the team) and the system requirements refined from them (for designers, developers and testers), following the two-level structure of user and system requirements.

### 1.2 Readers

| Reader | Uses |
|---|---|
| Instructor, TAs, team | User requirements (§6), scope (§3) |
| Architecture and design | System requirements (`02`), use cases (`05`) |
| Developers and testers | System requirements, acceptance criteria (`06`), traceability (`07`) |

### 1.3 References

- CS455 Software Engineering Course Project handout (`docs/project-management/`)
- Deliverable 0 — Project Proposal (`Deliverables/D0/`)
- Team conventions (`Deliverables/D1/Requirements Engineering/README.md`)

## 2. The Ride Owner

A **Ride Owner** is a verified IIT Kanpur user who initiates a ride to a shared destination (like Kanpur Central or CCS Airport). They secure the vehicle independently (outside the app) and use the platform to pool with other Riders to split the fare.

**Goals.** Pay a fraction of the full fare; easily coordinate the pickup of co-riders; ensure no-shows are penalized and fare is adjusted automatically; log the settlement of fares.

**Interactions with other user classes.**

| User class | Interaction with the Ride Owner |
|---|---|
| Rider | Searches for rides and submits a join request; joins the pool only after the Ride Owner accepts it; pays their share to the Ride Owner outside the app. |
| Operations Admin | Reviews complaints, SOS alerts, no-shows, and outstanding-payment cases; approves or rejects platform-suggested actions based on past records. |

**Shared features.** Authentication, profile, pool chat, fare view, ratings, complaints, notifications, and SOS are shared with other user classes.

## 3. Scope

**In scope (this release):** user requirements UR-RO-01 to UR-RO-14 (§6).

**Out of scope — Won't (this release):**

| Item | Reason |
|---|---|
| In-app vehicle booking / Driver matching | The Ride Owner contacts the driver directly (e.g., via a separate knowledge base of phone numbers). |
| AI Agent for Ride Owner | The AI features are currently focused on assisting Riders, not Ride Owners. |
| In-app payment processing | Fares are settled directly between riders and the owner; the platform records settlement status only. |
| Continuous live GPS tracking of the vehicle | Not required by the workflow; SOS captures a one-time location with permission. |

## 4. Assumptions and dependencies

| ID | Assumption / dependency |
|---|---|
| A-01 | Every user has an active `@iitk.ac.in` mailbox that can receive the system's email. |
| A-02 | The Ride Owner has access to driver contact information outside the application. |
| A-03 | Vehicles (cab or auto) are selected by the Ride Owner with a fixed seat capacity at the time of ride creation. |
| A-04 | The Ride Owner enters the expected total fare when creating a ride. Administrator-configured fare guidance may be shown but does not replace the owner-entered fare. |
| A-05 | Payment takes place outside the platform (UPI or cash). |
| A-06 | A Rider's join request remains pending until the Ride Owner accepts or rejects it, or the ride is locked, cancelled, or filled. |
| D-01 | Rider section: ride search, budget filtering, join-request submission, request withdrawal, and overlapping-departure constraints. |
| D-02 | Admin section: history-based action suggestions, admin approval or rejection, suspensions, warnings, complaint handling, SOS handling, and configuration data. |

## 5. System parameters

Configurable values referenced by the requirements.

| ID | Parameter | Default |
|---|---|---|
| P-01 | Permitted email domain | `iitk.ac.in` |
| P-02 | Lock time (fare split and membership fixed) | 60 minutes before departure, or earlier if the owner locks the ride |
| P-03 | No-show grace period | 5 minutes after the rider's pickup time |
| P-04 | Rating window | 72 hours after completion |
| P-05 | Settlement reminders; blocking | 24 h and 72 h after completion; block new requests after 7 days due |
| P-06 | Ride modification policy | Changes to an open ride notify accepted Riders; locked rides cannot be edited or cancelled through the normal flow |

## 6. User requirements

Natural-language requirements for the Ride Owner. Each is refined into numbered system requirements in `02_functional_requirements.md` (UR-RO-*nn* → FR-RO-*nn.m*).

| ID | User requirement | Shared |
|---|---|---|
| UR-RO-01 | Ride Owners shall register and sign in with their IIT Kanpur email address. | RD, AD |
| UR-RO-02 | Ride Owners shall maintain a profile with their interests and ride preferences. | RD |
| UR-RO-03 | Ride Owners shall be able to create a new ride by specifying its destination, departure time window, fixed vehicle capacity, and expected total fare. | — |
| UR-RO-04 | Ride Owners shall be able to edit or cancel an open ride before it is locked, with affected accepted Riders notified of the change. | RD |
| UR-RO-05 | Ride Owners shall be able to view pending Rider requests and accept or reject each request before the Rider joins the pool. | RD |
| UR-RO-06 | Ride Owners shall be able to view the ride capacity and lock the confirmed pool, preventing further joins and voluntary exits according to the lock policy. | RD |
| UR-RO-07 | Ride Owners shall always know the expected total fare and the current split amount for each confirmed occupant. | RD |
| UR-RO-08 | Ride Owners in a confirmed pool shall be able to coordinate with their co-travellers through a private chat. | RD |
| UR-RO-09 | Ride Owners shall be able to manage the trip state (e.g., Scheduled, Pickup in Progress, Completed) and record the arrival status of each confirmed Rider during pickup. | RD |
| UR-RO-10 | Ride Owners shall be able to mark a confirmed Rider as a no-show after the grace period, triggering an automatic fare recalculation for the remaining pool. | RD, AD |
| UR-RO-11 | Ride Owners shall be able to record settlement of fare shares collected from active Riders after the ride. | RD |
| UR-RO-12 | Ride Owners shall be able to rate the people they travelled with, while no-show outcomes are recorded for administrative review. | RD, AD |
| UR-RO-13 | Ride Owners shall be able to report misconduct confidentially and raise SOS alerts during an active ride. | RD, AD |
| UR-RO-14 | Ride Owners shall receive notifications for important ride events, including new join requests, acceptance or rejection outcomes, ride changes, pool locking, and pickup start. | RD, AD |

## 7. Glossary

| Term | Meaning |
|---|---|
| Ride | A trip created by a Ride Owner: destination, departure time, vehicle capacity, and expected total fare |
| Join request | A Rider's request to join an open ride; it is pending until accepted or rejected by the Ride Owner |
| Confirmed occupant | The Ride Owner or a Rider whose join request has been accepted |
| Pool | The occupants of a ride |
| Lock time | The moment membership and fare shares become fixed |
| Share | An occupant's part of the ride's total fare |
| No-Show | A Rider who fails to appear at the pickup point within the grace period |
| Arrival status | The recorded pickup status of a confirmed Rider, such as Awaiting, Arrived, or No-Show |
| Trip start | The moment the Ride Owner sets the trip state to Pickup in Progress |
