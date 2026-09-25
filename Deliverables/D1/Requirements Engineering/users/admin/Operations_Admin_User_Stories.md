# Operations Admin User Stories — Scenario-Based

## Purpose

These are **scenario-based user stories**, not merely requirement headings. Each story describes a concrete situation that motivates an Operations Admin action. The scenarios do not introduce functionality beyond the validated Operations Admin and System requirements.

System requirements are represented as constraints on the story rather than as artificial Admin goals.

---

## US-OA-01 — A New Vehicle Type Becomes Popular

### User story

> **As an Operations Admin,**
> **I want to add a newly supported vehicle type,**
> **so that riders can select it for future rides.**

### Situation / story

Mini Travellers are suddenly becoming popular for campus travel, and the project decides that Mini Traveller should be a supported vehicle type. The Operations Admin adds **Mini Traveller** to the supported vehicle types so that it can be used for newly created rides.

**Related requirements:**`OA-FR-01`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The Admin has permission to manage vehicle-type configuration.

### Acceptance criteria
- Mini Traveller can be added as an active supported vehicle type.
- The change is persisted before success is reported.
- The action is auditable.
- A failed configuration attempt is not reported as successful.

### Main scenario
1. The Admin notices that Mini Travellers need to be supported.
2. The Admin adds **Mini Traveller** as a vehicle type.
3. The system persists the new configuration.
4. The system records the administrative change.
5. Mini Traveller becomes available as a supported active type for future rides.

### Alternative / exception scenarios
- **A1 — Persistence failure:** The system does not report the vehicle type as added if the change cannot be persisted.
- **A2 — Unauthorized access:** A non-authorized user cannot add the vehicle type.

---

## US-OA-02 — A Popular Vehicle Type Needs a Capacity Change

### User story

> **As an Operations Admin,**
> **I want to change the maximum passenger capacity of a vehicle type,**
> **so that newly created rides use the current capacity.**

### Situation / story

After Mini Travellers become popular, the Admin reviews their configured capacity and changes the maximum number of passengers they support. The change must affect **new rides**, while rides that already exist continue using the capacity that applied when they were created.

**Related requirements:**`OA-FR-03`, `SYS-FR-04`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-04`, `SYS-NFR-05`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The vehicle type is active.

### Acceptance criteria
- The Admin can change the maximum capacity.
- New rides use the new capacity.
- Existing rides retain their previously applicable capacity.
- A stale concurrent configuration update is rejected and identified as stale.
- The change is auditable.

### Main scenario
1. The Admin selects Mini Traveller.
2. The Admin changes its maximum capacity.
3. The system verifies that the configuration is current.
4. The system persists the new capacity.
5. New rides use the new capacity.
6. Existing rides continue using the capacity applicable when they were created.

### Alternative / exception scenarios
- **A1 — Another Admin changed the capacity first:** The stale update is rejected and the Admin is told that the configuration is stale.
- **A2 — Persistence failure:** The new capacity is not reported as active.

---

## US-OA-03 — A Vehicle Type Is No Longer Supported

### User story

> **As an Operations Admin,**
> **I want to deactivate a vehicle type that is no longer supported,**
> **so that riders cannot select it for new rides.**

### Situation / story

Suppose the campus stops supporting a previously available vehicle category. The Admin deactivates that category so it is no longer active for new ride creation, while historical rides referring to it remain meaningful.

**Related requirements:**`OA-FR-02`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The vehicle type exists and is active.

### Acceptance criteria
- The vehicle type becomes inactive.
- It is no longer available for new use.
- Existing historical records are preserved.
- The action is auditable.

### Main scenario
1. The Admin identifies the vehicle type that is no longer supported.
2. The Admin deactivates it.
3. The system persists the state change.
4. The type is no longer active for new rides.
5. Historical records remain intact.

### Alternative / exception scenarios
- **A1 — Persistence failure:** The type remains unchanged if the deactivation cannot be persisted.

---

## US-OA-04 — A New Destination Needs to Be Supported

### User story

> **As an Operations Admin,**
> **I want to add an approved destination hub,**
> **so that riders can select it for future rides.**

### Situation / story

Students begin regularly travelling to an approved destination that is not currently configured. The Admin adds the destination hub to the supported set so it can be selected in future rides.

**Related requirements:**`OA-FR-05`, `SYS-FR-08`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The Admin can manage destination configuration.

### Acceptance criteria
- The hub can be added as an active configured destination.
- Riders can select it once successfully configured.
- Riders cannot select destinations that are not active configured hubs.
- The change is auditable.

### Main scenario
1. The Admin identifies the approved destination that needs to be supported.
2. The Admin adds the hub.
3. The system persists the configuration.
4. The hub becomes an active destination available for new rides.

### Alternative / exception scenarios
- **A1 — Persistence failure:** The hub is not reported as available if the change fails to persist.
- **A2 — Unauthorized access:** An unauthorized user cannot add a destination.

---

## US-OA-05 — A Destination Changes or Stops Being Supported

### User story

> **As an Operations Admin,**
> **I want to modify or deactivate a destination hub,**
> **so that the active destination list stays current without destroying historical ride information.**

### Situation / story

A configured destination changes its details, or the campus stops accepting it for new rides. The Admin updates or deactivates the hub. A ride that already used that destination must still retain its historical destination reference.

**Related requirements:**`OA-FR-06`, `OA-FR-07`, `SYS-FR-08`, `SYS-FR-09`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-04`, `SYS-NFR-05`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The destination exists in the configured set.

### Acceptance criteria
- The Admin can modify hub configuration.
- Existing ride references are not changed merely because the hub configuration changes.
- The Admin can deactivate the hub.
- A deactivated hub is unavailable for new destination selection.
- Historical ride references remain preserved.

### Main scenario
1. The Admin selects the destination.
2. The Admin modifies its configuration or deactivates it.
3. The system persists the change.
4. New destination selection reflects the current active state.
5. Existing rides retain their historical destination reference.

### Alternative / exception scenarios
- **A1 — Existing rides use the hub:** Their historical references remain unchanged.
- **A2 — Stale configuration:** A concurrent stale update is rejected and identified as stale.
- **A3 — Persistence failure:** The configuration change is not reported as successful.

---

## US-OA-06 — Different Vehicle Types Need Different Campus Fares

### User story

> **As an Operations Admin,**
> **I want to configure the campus fare for a hub pair separately for each vehicle type,**
> **so that the fare reflects the supported vehicle type.**

### Situation / story

Students travelling between two campus hubs can choose different vehicle types. The Admin needs to configure the fare for that hub pair for each supported vehicle type. The fare is the same in either direction.

**Related requirements:**`OA-FR-10`, `SYS-FR-14`, `SYS-FR-15`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-04`, `SYS-NFR-05`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The hubs and vehicle type are configured.

### Acceptance criteria
- A fixed fare can be configured for each supported hub pair and vehicle type.
- The fare is non-directional.
- Existing rides retain fare information already established for them.
- The configuration change is auditable.

### Main scenario
1. The Admin selects the hub pair and vehicle type.
2. The Admin enters the applicable campus fare.
3. The system persists the configuration.
4. The configured fare becomes applicable to that combination.
5. The same configured fare applies regardless of direction between the pair.

### Alternative / exception scenarios
- **A1 — Reverse direction:** The fare remains the same.
- **A2 — Fare later changes:** Existing ride fare information remains preserved.
- **A3 — Stale update:** A stale configuration update is rejected and identified.

---

## US-OA-07 — Riders Need an External Fare Estimate

### User story

> **As an Operations Admin,**
> **I want to configure an approximate external fare range for a travel segment and vehicle type,**
> **so that riders can be shown an indicative fare without treating it as the final fare.**

### Situation / story

Students are travelling beyond the campus hubs and need an indication of the expected external fare. The Admin configures an approximate range for the relevant travel segment and vehicle type. The range is only an estimate; the Admin does not determine the exact final external fare.

**Related requirements:**`OA-FR-11`, `SYS-FR-12`, `SYS-FR-13`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-04`, `SYS-NFR-05`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The travel segment and vehicle type are supported.

### Acceptance criteria
- An approximate range can be configured.
- The range is associated with the relevant segment and vehicle type.
- It is represented as an estimate.
- The Admin cannot use this configuration to set the final exact external fare.

### Main scenario
1. The Admin selects a supported external segment and vehicle type.
2. The Admin enters an approximate fare range.
3. The system persists it.
4. The configured range is available as an estimate.
5. The exact final external fare remains outside the Admin's configuration responsibility.

### Alternative / exception scenarios
- **A1 — Attempt to set exact fare:** The system does not permit the Admin to configure a final exact external fare.
- **A2 — Persistence failure:** The range is not reported as configured.

---

## US-OA-08 — An Admin Needs to Investigate a Ride Without Interfering With It

### User story

> **As an Operations Admin,**
> **I want to inspect a ride,**
> **so that I can oversee activity without changing the ride itself.**

### Situation / story

A ride needs administrative review. The Admin opens the ride and examines its information. The Admin is not allowed to change the ride, even while reviewing it.

**Related requirements:**`OA-FR-16`, `SYS-FR-17`

**Relevant NFRs:**`SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The ride exists.

### Acceptance criteria
- The Admin can view ride information.
- The Admin cannot modify the ride.
- An attempted modification is rejected.

### Main scenario
1. The Admin selects the ride.
2. The system displays the permitted ride information.
3. The Admin investigates the ride.
4. The ride remains unchanged.

### Alternative / exception scenarios
- **A1 — Modification attempt:** The system rejects the Admin's attempt to modify the ride.

---

## US-OA-09 — Several Riders Report That One Rider Does Not Pay Their Share

### User story

> **As an Operations Admin,**
> **I want to review a complaint about a rider repeatedly failing to pay their fare share,**
> **so that I can decide whether an administrative warning is appropriate.**

### Situation / story

Several riders report that **Rider A repeatedly does not pay their required share of the fare** after pooled rides. A complaint is submitted against Rider A. The Admin reviews the complaint and the retained complaint history for Rider A before deciding what administrative action, if any, is appropriate.

**Related requirements:**`OA-FR-18`, `SYS-FR-19`, `OA-FR-20`

**Relevant NFRs:**`SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- A complaint concerning Rider A exists.

### Acceptance criteria
- The Admin can view the complaint.
- The Admin can view retained previous complaints for Rider A.
- Complaint information is restricted to authorized Admins.
- Reviewing the complaint does not itself issue a warning or suspension.

### Main scenario
1. One or more riders submit complaints concerning Rider A's failure to pay their fare share.
2. The complaint is retained.
3. The Admin opens Rider A's complaint history.
4. The Admin reviews the current complaint and retained previous complaints.
5. The Admin uses this information to decide whether a warning should be issued.

### Alternative / exception scenarios
- **A1 — No prior complaints:** The Admin sees the current complaint even if Rider A has no previous complaint history.
- **A2 — Unauthorized access:** A user without Admin authorization cannot view the complaint history.

---

## US-OA-10 — A Rider Reports a Safety-Related Incident

### User story

> **As an Operations Admin,**
> **I want to review an SOS complaint submitted against a rider,**
> **so that the reported incident can be considered as part of administrative review.**

### Situation / story

During a pooled ride, a rider reports a safety-related incident involving another rider through an SOS complaint. The complaint is retained and becomes available to an authorized Admin for review.

**Related requirements:**`OA-FR-18`, `SYS-FR-19`, `OA-FR-20`

**Relevant NFRs:**`SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- An SOS complaint has been submitted against a rider.

### Acceptance criteria
- An SOS complaint can be submitted against another rider.
- An authorized Admin can review the complaint.
- The Admin can view retained previous complaints for the reported rider.
- The complaint remains protected from unauthorized access.

### Main scenario
1. A rider submits an SOS complaint against another rider.
2. The complaint is retained.
3. The Admin opens the complaint.
4. The Admin reviews the complaint and relevant retained complaint history.

### Alternative / exception scenarios
- **A1 — No prior history:** The current SOS complaint remains available for review.
- **A2 — Unauthorized access:** Unauthorized users cannot access the complaint.

---

## US-OA-11 — A Warning Is Issued After Reviewing Repeated Fare Complaints

### User story

> **As an Operations Admin,**
> **I want to issue Rider A a warning with an explicit reason after reviewing repeated fare-share complaints,**
> **so that the disciplinary action is clear and traceable.**

### Situation / story

The Admin has reviewed repeated complaints that **Rider A does not pay their fare share**. The Admin decides that a warning is appropriate. The Admin issues the warning and records the reason explicitly, for example: **“Repeated failure to pay the rider's agreed fare share in pooled rides.”**

**Related requirements:**`OA-FR-21`, `SYS-FR-45`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- Rider A exists.
- The Admin has reviewed information supporting the warning.

### Acceptance criteria
- A warning requires a reason.
- The warning records the Admin, timestamp, affected rider, and reason.
- The warning is persisted before success is reported.
- The warning does not alter suspension state unless a separate suspension action is taken.

### Main scenario
1. The Admin reviews Rider A's repeated fare-share complaints.
2. The Admin selects **Issue Warning**.
3. The Admin enters the reason: “Repeated failure to pay the rider's agreed fare share in pooled rides.”
4. The system persists the warning.
5. The system records the administrative action.
6. The warning becomes part of Rider A's retained history.

### Alternative / exception scenarios
- **A1 — No reason supplied:** The warning cannot be issued.
- **A2 — Persistence failure:** The warning is not reported as successfully issued.

---

## US-OA-12 — A Rider Needs a Three-Month Suspension

### User story

> **As an Operations Admin,**
> **I want to suspend Rider A for a specified period,**
> **so that Rider A cannot create or join rides during that period and is automatically reactivated afterward.**

### Situation / story

Suppose repeated administrative incidents lead the Admin to suspend Rider A for **three months**. The Admin specifies the three-month duration. Rider A is prevented from creating or joining rides during the suspension, and the account automatically reactivates when the three months expire.

**Related requirements:**`OA-FR-23`, `SYS-FR-24`, `SYS-FR-25`, `SYS-FR-27`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- Rider A's account exists.
- The Admin has decided on a finite suspension period.

### Acceptance criteria
- The Admin can specify three months as the suspension period.
- Rider A cannot create or join rides during the suspension.
- The account automatically reactivates when the period expires.
- Historical ride, complaint, warning, and suspension records remain preserved.

### Main scenario
1. The Admin selects Rider A.
2. The Admin selects suspension.
3. The Admin specifies a three-month duration.
4. The system persists the suspension.
5. Rider A is prevented from creating or joining rides.
6. After three months, the system automatically reactivates Rider A.
7. The suspension history remains preserved.

### Alternative / exception scenarios
- **A1 — Rider tries to create a ride while suspended:** The system blocks the action.
- **A2 — Rider tries to join a ride while suspended:** The system blocks the action.
- **A3 — Persistence failure:** The suspension is not reported as successful.

---

## US-OA-13 — A Rider Needs an Indefinite Suspension

### User story

> **As an Operations Admin,**
> **I want to suspend a rider indefinitely when no expiry is appropriate,**
> **so that the rider remains suspended until an Admin explicitly reactivates the account.**

### Situation / story

After a serious or repeated pattern of incidents, the Admin decides that Rider A should remain suspended without a fixed expiry. The Admin explicitly selects **indefinite suspension**. Rider A remains unable to create or join rides until an Admin later reactivates the account.

**Related requirements:**`OA-FR-23`, `SYS-FR-24`, `SYS-FR-26`, `SYS-FR-27`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The rider account exists.
- The Admin explicitly chooses indefinite suspension.

### Acceptance criteria
- The suspension is recorded as indefinite.
- The rider cannot create or join rides while suspended.
- The suspension does not automatically expire.
- Historical records remain preserved.

### Main scenario
1. The Admin selects Rider A.
2. The Admin chooses suspension.
3. The Admin explicitly selects indefinite suspension.
4. The system persists the suspension.
5. Rider A remains suspended.
6. No automatic expiry reactivates the account.

### Alternative / exception scenarios
- **A1 — Neither duration nor indefinite option selected:** The suspension cannot be completed.
- **A2 — Persistence failure:** The suspension is not reported as successful.

---

## US-OA-14 — An Indefinitely Suspended Rider Is Manually Reactivated

### User story

> **As an Operations Admin,**
> **I want to manually reactivate an indefinitely suspended rider with a recorded reason,**
> **so that the suspension can be explicitly lifted while preserving its history.**

### Situation / story

Rider A has an indefinite suspension. Later, an Admin decides to reactivate the account. The Admin explicitly performs the reactivation and records the reason for the decision.

**Related requirements:**`OA-FR-28`, `SYS-FR-45`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- The rider is currently suspended.

### Acceptance criteria
- The Admin can manually reactivate the rider.
- The reactivation records Admin identity, timestamp, and reason.
- Historical suspension records remain preserved.
- Reactivation is persisted before success is reported.

### Main scenario
1. The Admin opens Rider A's suspended account.
2. The Admin chooses manual reactivation.
3. The Admin records the reason.
4. The system persists the reactivation.
5. The system records the Admin, timestamp, and reason.
6. Rider A is no longer suspended.

### Alternative / exception scenarios
- **A1 — Temporary suspension already expired:** The account may already have been automatically reactivated.
- **A2 — Persistence failure:** The reactivation is not reported as successful.

---

## US-OA-15 — The AI Flags Repeated Fare-Share Complaints

### User story

> **As an Operations Admin,**
> **I want to review the AI's summary, severity, tags, and enforcement recommendation for a complaint,**
> **so that I can make the final disciplinary decision myself.**

### Situation / story

Several complaints have been submitted about Rider A not paying their fare share. The AI complaint-management system summarizes the complaints, assigns a severity level and behavioral tags, and recommends a possible warning. The Admin reviews the AI output together with the original complaint before deciding what to do.

**Related requirements:**`SYS-FR-30`, `SYS-FR-31`, `SYS-FR-32`, `SYS-FR-33`, `OA-FR-34`, `SYS-FR-37`, `SYS-FR-38`

**Relevant NFRs:**`SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-10`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- A complaint exists.
- Valid AI analysis is available.

### Acceptance criteria
- The original complaint remains available.
- The Admin can see the AI summary, severity, behavioral tags, and enforcement recommendation.
- AI output does not itself change the rider's disciplinary state.
- The Admin must explicitly approve a warning or suspension before it is executed.
- The decision and resulting action are logged.

### Main scenario
1. Complaints concerning Rider A are submitted.
2. The AI analyzes the complaint information.
3. The Admin opens the complaint review.
4. The system displays the original complaint and AI analysis.
5. The Admin reviews the recommendation.
6. The Admin makes the disciplinary decision explicitly.
7. The system records the Admin decision and final action.

### Alternative / exception scenarios
- **A1 — AI recommends a warning:** The recommendation is advisory; the Admin must explicitly approve it.
- **A2 — AI recommends a suspension:** The Admin must explicitly approve the suspension before it occurs.
- **A3 — AI recommends no action:** No disciplinary state is changed merely because the analysis exists.

---

## US-OA-16 — The Admin Rejects an AI Recommendation

### User story

> **As an Operations Admin,**
> **I want to reject an AI enforcement recommendation and record why,**
> **so that an AI suggestion does not become disciplinary action without my approval.**

### Situation / story

The AI recommends a warning for Rider A after analyzing complaints about failure to pay fare shares. The Admin reviews the evidence and decides **not** to issue the warning. The Admin rejects the recommendation and records the reason.

**Related requirements:**`SYS-FR-33`, `OA-FR-34`, `SYS-FR-35`, `OA-FR-36`, `SYS-FR-37`, `SYS-FR-38`

**Relevant NFRs:**`SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-10`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- An AI enforcement recommendation is available.

### Acceptance criteria
- The Admin can reject the recommendation.
- A rejection reason is required.
- Rejecting the recommendation does not execute the recommended disciplinary action.
- The rejection and reason are recorded.

### Main scenario
1. The AI recommends a warning.
2. The Admin reviews the recommendation and original complaint.
3. The Admin rejects the recommendation.
4. The Admin enters the rejection reason.
5. The system records the decision.
6. No warning is created as a result of the rejected recommendation.

### Alternative / exception scenarios
- **A1 — No rejection reason:** The rejection cannot be completed.
- **A2 — AI recommendation changes:** The Admin's explicit decision still determines whether disciplinary action occurs.

---

## US-OA-17 — AI Complaint Analysis Is Unavailable

### User story

> **As an Operations Admin,**
> **I want a complaint to be routed to manual review when AI analysis fails,**
> **so that an AI outage does not prevent the complaint from being handled.**

### Situation / story

A rider submits a complaint, but the AI service times out or returns invalid/insufficient analysis. The original complaint must remain available, and the Admin must be able to review it manually instead of the system treating the AI failure as a disciplinary decision.

**Related requirements:**`SYS-FR-46`, `SYS-FR-47`

**Relevant NFRs:**`SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-07`, `SYS-NFR-10`, `SYS-NFR-11`, `SYS-NFR-12`

### Preconditions
- The complaint exists.
- AI analysis is attempted.
- The Admin is authenticated and authorized for manual review.

### Acceptance criteria
- AI timeout, failure, invalid output, or output below the required confidence condition results in manual review.
- The original complaint is preserved.
- The system does not invent a disciplinary decision from the failed AI result.
- The Admin can review the complaint manually.

### Main scenario
1. A complaint is submitted.
2. AI analysis is attempted.
3. The AI service fails, times out, or returns invalid/insufficient output.
4. The system preserves the original complaint.
5. The complaint is routed to manual Admin review.
6. The Admin reviews the complaint without relying on a failed AI result.

### Alternative / exception scenarios
- **A1 — AI unavailable:** Manual review remains possible.
- **A2 — Invalid AI output:** The invalid output is not treated as a valid disciplinary recommendation.
- **A3 — Low-confidence result:** The complaint is routed to manual review.

---

## US-OA-18 — Two Admins Try to Change the Same Configuration

### User story

> **As an Operations Admin,**
> **I want the system to reject my configuration change when another Admin has already changed the same configuration,**
> **so that I do not unknowingly overwrite a newer administrative decision.**

### Situation / story

Two Admins are reviewing the capacity of Mini Traveller at nearly the same time. Admin A changes the capacity first. Admin B submits an update based on the older value. The system rejects Admin B's stale update and tells Admin B that the configuration has changed.

**Related requirements:**`SYS-FR-48`, `SYS-NFR-04`, `SYS-NFR-05`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-04`, `SYS-NFR-05`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-12`

### Preconditions
- Two authorized Admins can access the same configuration.
- Both have read the configuration before one of them changes it.

### Acceptance criteria
- A stale configuration update is rejected.
- The Admin attempting the stale update is told that the configuration is stale.
- The earlier successful configuration remains intact.
- The failed attempt is recorded.

### Main scenario
1. Admin A and Admin B both view the current configuration.
2. Admin A changes it and the system persists the change.
3. Admin B submits an update based on the older configuration.
4. The system detects the stale state.
5. The system rejects Admin B's update.
6. The system informs Admin B that the configuration is stale.
7. The failed attempt is recorded.

### Alternative / exception scenarios
- **A1 — No concurrent change:** A current configuration update proceeds normally.
- **A2 — Persistence failure:** A configuration change is not reported as successful unless it is persisted.

---

## US-OA-19 — A Non-Admin Attempts to Access Administrative Functions

### User story

> **As an Operations Admin,**
> **I want administrative functions and sensitive rider information to be protected from unauthorized users,**
> **so that only authorized Admins can perform or view administrative operations.**

### Situation / story

A normal rider attempts to access an Admin function, such as viewing complaint history or changing vehicle configuration. The system must not grant Admin privileges merely because the user is authenticated as a rider.

**Related requirements:**`SYS-FR-39`, `SYS-FR-40`, `SYS-FR-41`, `OA-FR-42`, `SYS-FR-43`, `SYS-FR-44`

**Relevant NFRs:**`SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-12`

### Preconditions
- A user is authenticated.
- The user does not have the Operations Admin role.

### Acceptance criteria
- Authentication alone does not grant Admin privileges.
- Rider users cannot assign themselves the Admin role.
- Admin-only operations are denied to unauthorized users.
- Complaint, disciplinary, and AI enforcement records are restricted to authorized Admins.
- Admins cannot modify rider personal profile information through the Admin functions.

### Main scenario
1. A rider attempts to access an Admin-protected function.
2. The system checks the user's authorization.
3. The system denies the operation.
4. Sensitive administrative information remains protected.

### Alternative / exception scenarios
- **A1 — Authorized Admin:** An authorized Admin can perform the relevant Admin operation.
- **A2 — Attempted privilege escalation:** A rider's attempt to assign themselves Admin privileges is rejected.

---

## US-OA-20 — An Admin's Disciplinary Action Must Be Traceable

### User story

> **As an Operations Admin,**
> **I want my state-changing administrative actions to be recorded with their context,**
> **so that later review can establish who did what and when.**

### Situation / story

An Admin issues a warning, suspends a rider, reactivates an account, or changes a fare/hub/vehicle configuration. The system records the Admin identity, timestamp, affected entity, and the relevant previous/new configuration values where applicable.

**Related requirements:**`SYS-FR-45`, `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-06`

**Relevant NFRs:**`SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-12`

### Preconditions
- The Admin is authenticated and authorized.
- A state-changing Admin action is being attempted.

### Acceptance criteria
- The action records the Admin identity and timestamp.
- The affected entity is recorded.
- Configuration changes record previous and new values.
- Failed attempts for specified administrative actions are recorded.
- Admins cannot modify or delete audit records through the application.

### Main scenario
1. The Admin performs a state-changing action.
2. The system persists the action.
3. The system records the required audit information.
4. The action can subsequently be distinguished by Admin, timestamp, affected entity, and relevant values.

### Alternative / exception scenarios
- **A1 — Failed action:** The failed attempt is recorded where required.
- **A2 — Audit modification attempt:** An Admin cannot modify or delete audit records through the application.

---

# Story Coverage

The stories above cover the validated Operations Admin functional requirements and place system requirements such as authorization, persistence, auditability, concurrency, privacy, reliability, and AI oversight as constraints on the relevant scenarios.

No story introduces an Admin driver role, individual vehicle management, Admin ride modification, exact external fare setting, arbitrary destinations, or automatic AI disciplinary action.
