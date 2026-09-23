# Rider — Requirements Specification

| | |
|---|---|
| **System** | Campus Ride-Pooling and Split-Fare System |
| **Section** | User class: Rider |
| **Author** | Mainak Sarkar (230619) |
| **Version** | 0.1 — draft for team review |
| **Deliverable** | D1 — Requirements, Architecture and Project Setup |

## 1. Introduction

### 1.1 Purpose

This section specifies the requirements of the **Rider** user class. It contains the user
requirements (for students, the instructor and the team) and the system requirements refined from
them (for designers, developers and testers), following the two-level structure of user and system
requirements.

### 1.2 Readers

| Reader | Uses |
|---|---|
| Instructor, TAs, team | User requirements (§6), scope (§3) |
| Architecture and design (member 2) | System requirements (`02`), AI requirements (`04`), use cases (`05`) |
| Developers and testers | System requirements, acceptance criteria (`06`), traceability (`07`) |

### 1.3 References

- CS455 Software Engineering Course Project handout (`docs/project-management/`)
- Deliverable 0 — Project Proposal (`Deliverables/D0/`)
- Team conventions (`Deliverables/D1/Requirements Engineering/README.md`)

## 2. The Rider

A **Rider** is a verified IIT Kanpur user who wants to travel from campus to a destination such as
the railway station or the airport, and who looks for an existing ride to join rather than creating
one. The same person may act as a Ride Owner for another trip; each role is specified separately.

**Goals.** Pay a fraction of the full fare; find a compatible ride quickly; know exactly when and
where pickup happens and what they will pay; travel safely with people they can trust.

**Interactions with other user classes.**

| User class | Interaction with the Rider |
|---|---|
| Ride Owner | Receives the rider's join request; accepts or rejects it; sets trip progress; confirms fare settlement |
| Operations Admin | Handles the rider's complaints and SOS alerts; issues warnings and suspensions; configures destinations, pickup points, tags and fare bands |

**Shared features.** Authentication, profile, pool chat, fare view, ratings, complaints,
notifications and SOS are shared with other user classes. They are specified here in full from the
rider's side and tagged *Shared: RO* and/or *Shared: AD* for later reconciliation.

## 3. Scope

**In scope (this release):** user requirements UR-RD-01 to UR-RD-16 (§6).

**Out of scope — Won't (this release):**

| Item | Reason |
|---|---|
| Booking more than one seat in a single request | Keeps the seat the unit of allocation; each traveller needs their own verified account |
| In-app payment processing | Fares are settled directly between riders and the owner; the platform records settlement status only |
| Continuous live GPS tracking of the vehicle | Not required by the workflow; SOS captures a one-time location with permission |
| Rider-created destinations or pickup points | Destinations and pickup points are administrator-configured |
| Users outside IIT Kanpur | The platform's trust model depends on institute membership |
| Native mobile applications | The web application is designed to be usable on phones |

## 4. Assumptions and dependencies

| ID | Assumption / dependency |
|---|---|
| A-01 | Every user has an active `@iitk.ac.in` mailbox that can receive the system's email |
| A-02 | Destinations and pickup points (halls, gates, academic area, …) are administrator-configured lists |
| A-03 | Travel times between pickup points and to destinations come from administrator-configured values or a mapping service chosen during design; times shown to riders are estimates |
| A-04 | Vehicles (cab or auto) are registered by administrators with a seat capacity; the ride owner occupies one seat |
| A-05 | A ride's total fare comes from administrator-configured fare bands (destination × vehicle type) |
| A-06 | Payment takes place outside the platform (UPI or cash) |
| A-07 | The AI features use a free-tier LLM API whose availability and latency are not guaranteed |
| A-08 | Riders use a current web browser on a phone or computer with internet access |
| A-09 | The ride owner starts pickup, marks no-shows and completes the trip (Ride Owner section) |
| D-01 | Ride Owner section: acceptance, lock time, trip state changes, settlement confirmation |
| D-02 | Admin section: suspensions, warnings, complaint handling, SOS handling, configuration data |

## 5. System parameters

Configurable values referenced by the requirements. Defaults are proposed values, open to team review.

| ID | Parameter | Default |
|---|---|---|
| P-01 | Permitted email domain | `iitk.ac.in` |
| P-02 | One-time code validity | 10 minutes |
| P-03 | Maximum incorrect one-time code entries | 5 |
| P-04 | Session inactivity timeout | 7 days |
| P-05 | Maximum interest tags per profile | 10 |
| P-06 | Lock time (fare split and membership fixed) | 60 minutes before departure, or earlier if the owner locks the ride (*Shared: RO*) |
| P-07 | Maximum active (Pending or Needs Reconfirmation) requests per rider | 3 |
| P-08 | Conflict window between departures of the same rider | 2 hours |
| P-09 | Drift threshold — time | 10 minutes |
| P-10 | Drift threshold — fare share | 20 % |
| P-11 | Maximum AI suggestions | 5 |
| P-12 | AI response timeout | 8 seconds |
| P-13 | Real-time update target | 2 seconds |
| P-14 | Pool chat message limits | 500 characters; 20 messages per minute per member |
| P-15 | Pool chat retention | read-only 24 hours after completion; deleted 30 days after completion |
| P-16 | Rating window | 72 hours after completion |
| P-17 | Complaint limits | within 7 days; 20–2000 characters; 5 per rider per 24 hours |
| P-18 | Settlement reminders; blocking | 24 h and 72 h after completion; block new requests after 7 days due |
| P-19 | No-show grace period | 5 minutes after the rider's pickup time |
| P-20 | Idempotency key validity | 24 hours |
| P-21 | Notification history | 30 days |
| P-22 | SOS visibility to administrators | 5 seconds |
| P-23 | AI tool-call budget per request | 5 calls |
| P-24 | Ratings needed before an average is shown | 3 |
| P-25 | Account deletion completion | 30 days |
| P-26 | AI token budget per request | 8,000 tokens (input and output combined) |
| P-27 | Trust-indicator lookback window | 90 days |
| P-28 | AI audit record retention | 90 days |

## 6. User requirements

Natural-language requirements for the rider. Each is refined into numbered system requirements in
`02_functional_requirements.md` (UR-RD-*nn* → FR-RD-*nn.m*).

| ID | User requirement | Shared |
|---|---|---|
| UR-RD-01 | Riders shall register and sign in with their IIT Kanpur email address, and shall be told when their account is warned or suspended. | RO, AD |
| UR-RD-02 | Riders shall maintain a profile with their interests and ride preferences, and control what other users can see about them. | RO |
| UR-RD-03 | Riders shall be able to find open rides that match their destination, time and pickup point, with up-to-date seat availability and an estimate of what they will pay. | — |
| UR-RD-04 | Riders shall be able to ask an AI assistant to suggest the rides that suit them best, with the reasons for each suggestion. | — |
| UR-RD-05 | Riders shall be able to search rides, learn about co-riders and update their preferences in natural language through an AI chatbot, without the chatbot acting on their behalf. | — |
| UR-RD-06 | Riders shall be able to request a seat on an existing ride, and shall never be committed to a ride whose seat, time or fare changed materially without their consent. | RO |
| UR-RD-07 | Riders shall be able to withdraw a request or leave a ride, with the seat and fare consequences applied fairly to everyone. | RO |
| UR-RD-08 | Riders shall always know what they are expected to pay and how the amount was calculated. | RO |
| UR-RD-09 | Riders in a confirmed pool shall be able to coordinate with their co-travellers through a private chat. | RO |
| UR-RD-10 | Riders shall be able to follow the progress of their trip and their own pickup time. | RO |
| UR-RD-11 | Riders shall be able to record settlement of their fare share with the ride owner. | RO |
| UR-RD-12 | Riders shall be able to rate the people they travelled with. | RO |
| UR-RD-13 | Riders shall be able to report misconduct confidentially and follow the outcome. | AD |
| UR-RD-14 | Riders shall be notified promptly of every event that affects their rides. | RO, AD |
| UR-RD-15 | Riders shall be able to raise an SOS alert during a trip. | AD |
| UR-RD-16 | Riders shall be able to see their ride history and control how their personal data is used. | AD |

## 7. Glossary

| Term | Meaning |
|---|---|
| Ride | A trip created by a ride owner: destination, departure time, vehicle, seats |
| Occupant | The owner or an accepted rider of a ride |
| Pool | The occupants of a locked ride |
| Pickup point | An administrator-configured campus location where an occupant is picked up |
| Join request | A rider's request for one seat on a ride, from a chosen pickup point |
| Snapshot | Departure time, pickup time and fare share recorded when a request is submitted or reconfirmed |
| Itinerary drift | A change in departure time, pickup time or fare share after a request was made |
| Lock time | The moment membership and fare shares become fixed (P-06) |
| Share | An occupant's part of the ride's total fare |
| Active request | A request in state Pending or Needs Reconfirmation |
| Trip start | The moment the ride owner sets the trip state to Pickup in Progress (FR-RD-10.1); "before the trip starts" means while the trip state is Scheduled |
| Chatbot conversation | The messages exchanged with the AI chatbot in one open browser tab; discarded when the tab is closed or reloaded, or the rider signs out (FR-RD-05.6) |
| Trust indicator | An aggregate signal derived from upheld complaints, never exposing complaint details |
