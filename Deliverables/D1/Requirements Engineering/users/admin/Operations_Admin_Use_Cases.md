# Operations Admin Use Cases

## Purpose

This document identifies the Operations Admin use cases derived **only from the validated Operations Admin and system requirements and the validated Operations Admin user stories**.

The use-case model describes actor goals and observable system behavior. It does not introduce implementation details, technologies, database mechanisms, or new functionality.

The non-functional requirements are treated as constraints on the relevant use cases rather than as independent use cases. Similarly, cross-cutting requirements such as auditability and successful persistence are attached to the state-changing use cases they constrain rather than being represented as separate actor goals.

---

## UC-OA-01 — Access Operations Admin Functions

**Actor:** Operations Admin

**Goal:** Access Operations Admin functionality and perform only actions permitted to the Operations Admin role.

**Preconditions:**
- The user has an account.
- The application is available.

**Trigger:** The user requests an Operations Admin function.

### Main success scenario

1. The user requests an Operations Admin function.
2. The system verifies that the user is authenticated.
3. The system verifies that the user has the Operations Admin role.
4. The system grants access to the requested Operations Admin functionality.

### Alternative / exception flows

- **A1 — Unauthenticated user:** Access to Operations Admin functionality is rejected until the user is authenticated.
- **A2 — Rider account:** A rider cannot access Operations Admin functionality.
- **A3 — Role self-assignment:** A rider cannot assign the Operations Admin role to themselves through the application.
- **A4 — Unauthorized operation:** An operation requiring Operations Admin authorization is rejected when the user is not authorized.

**Postconditions:**
- An authorized Operations Admin can access the requested administrative functionality.
- An unauthorized user cannot perform the protected operation.

**Related requirements:**`SYS-FR-39`, `SYS-FR-40`, `SYS-FR-41`, `SYS-NFR-03`, `SYS-NFR-08`, `SYS-NFR-12`

---

## UC-OA-02 — Manage Vehicle Types and Capacity

**Actor:** Operations Admin

**Goal:** Configure the active vehicle types and their maximum passenger capacities used for newly created rides.

**Preconditions:**
- The Admin is authenticated and authorized.
- Vehicle-type configuration is available.

**Trigger:** The Admin chooses to add, deactivate, or change the capacity of a vehicle type.

### Main success scenario

1. The Admin opens vehicle-type configuration.
2. The Admin adds a vehicle type or selects an existing active vehicle type.
3. The Admin enters or changes the maximum passenger capacity when applicable.
4. The Admin saves the configuration.
5. The system accepts the change.
6. The configured vehicle type and capacity apply to subsequently created rides.

### Alternative / exception flows

- **A1 — Deactivate vehicle type:** The Admin deactivates an active vehicle type. It is no longer available for newly created rides, while existing and historical rides retain their recorded vehicle type.
- **A2 — Capacity change for existing ride:** A capacity change does not alter the capacity applicable to a ride that already exists.
- **A3 — Stale configuration:** If another Admin has changed the same configuration since it was read, the requested change is rejected and the Admin is informed that the configuration is stale.
- **A4 — Failed change:** If the requested change cannot be successfully completed, the system does not report it as successful.

**Postconditions:**
- The requested vehicle-type configuration is changed, or the change is rejected.
- Existing rides retain their applicable vehicle-type capacity.
- The change is auditable where required.

**Related requirements:**`OA-FR-01`, `OA-FR-02`, `OA-FR-03`, `SYS-FR-04`, `SYS-FR-45`, `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-04`, `SYS-NFR-05`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

---

## UC-OA-03 — Manage Destination Hubs

**Actor:** Operations Admin

**Goal:** Configure the destination hubs available for new rides while preserving the meaning of existing ride records.

**Preconditions:**
- The Admin is authenticated and authorized.
- Destination-hub configuration is available.

**Trigger:** The Admin chooses to add, modify, or deactivate a destination hub.

### Main success scenario

1. The Admin opens destination-hub configuration.
2. The Admin adds a destination hub or selects an existing hub.
3. The Admin modifies permitted hub information or deactivates the hub.
4. The Admin saves the configuration.
5. The system accepts the change.
6. Active hubs are available for new rider destination selection.

### Alternative / exception flows

- **A1 — Existing ride references the hub:** Modifying or deactivating a hub does not change the identity of the hub referenced by an existing ride.
- **A2 — Deactivated hub:** A deactivated hub is not available for selection in a newly created ride.
- **A3 — Stale configuration:** If another Admin has changed the same configuration since it was read, the requested change is rejected and the Admin is informed that the configuration is stale.
- **A4 — Failed change:** If the requested change cannot be successfully completed, the system does not report it as successful.

**Postconditions:**
- The hub is added, modified, or deactivated as requested, or the requested change is rejected.
- Existing ride references remain meaningful.
- The active hub set used for new rides reflects the accepted configuration.

**Related requirements:**`OA-FR-05`, `OA-FR-06`, `OA-FR-07`, `SYS-FR-08`, `SYS-FR-09`, `SYS-FR-45`, `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-04`, `SYS-NFR-05`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

---

## UC-OA-04 — Configure Fare Rules and Estimates

**Actor:** Operations Admin

**Goal:** Configure campus fares and approximate external fare ranges by vehicle type so that the system has the approved fare information for supported travel segments.

**Preconditions:**
- The Admin is authenticated and authorized.
- The relevant vehicle type and destination configuration exists.

**Trigger:** The Admin chooses to add or change fare configuration.

### Main success scenario

1. The Admin opens fare configuration.
2. The Admin selects a supported vehicle type and supported campus hub pair.
3. The Admin enters or changes the fixed campus fare.
4. The Admin may enter or change an approximate external fare range for a supported external travel segment and vehicle type.
5. The Admin saves the configuration.
6. The system accepts the configuration.
7. The configured fare information is available for the applicable travel segment and vehicle type.

### Alternative / exception flows

- **A1 — Direction reversal:** The configured campus fare remains the same in either travel direction for the supported hub pair.
- **A2 — External fare:** The configured external value is treated as an estimate; the Admin does not set the final exact external fare.
- **A3 — Existing ride:** Fare information established for an existing ride remains preserved even if the fare configuration is changed later.
- **A4 — Stale configuration:** If another Admin has changed the same fare configuration since it was read, the requested change is rejected and the Admin is informed that the configuration is stale.
- **A5 — Failed change:** If the requested fare configuration cannot be successfully completed, the system does not report it as successful.

**Postconditions:**
- The accepted fare configuration is available for subsequent applicable use.
- Existing ride fare information remains preserved.
- No final exact external fare is set by the Admin.

**Related requirements:**`OA-FR-10`, `OA-FR-11`, `SYS-FR-12`, `SYS-FR-13`, `SYS-FR-14`, `SYS-FR-15`, `SYS-FR-45`, `SYS-FR-48`, `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-04`, `SYS-NFR-05`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

**Note:** `SYS-FR-14` and `SYS-FR-15` describe the fare-sharing behavior that follows from the configured fare rules; they do not introduce a separate Admin interaction.

---

## UC-OA-05 — View Rides

**Actor:** Operations Admin

**Goal:** View ride information for operational oversight without modifying rides.

**Preconditions:**
- The Admin is authenticated and authorized.
- Ride information exists or is available for viewing.

**Trigger:** The Admin opens the ride information view.

### Main success scenario

1. The Admin requests ride information.
2. The system displays the permitted ride information.
3. The Admin reviews the ride information.

### Alternative / exception flows

- **A1 — Modification attempt:** The Admin attempts to modify a ride. The modification is rejected because Operations Admin access to rides is view-only.
- **A2 — Unauthorized access:** A user without the required authorization cannot access the protected ride information.

**Postconditions:**
- The Admin has viewed the permitted ride information.
- No ride has been modified by the Admin.

**Related requirements:**`OA-FR-16`, `SYS-FR-17`, `SYS-NFR-03`

---

## UC-OA-06 — Review Rider Complaints and SOS Complaints

**Actor:** Operations Admin

**Goal:** Review complaints associated with a rider, including SOS complaints and retained previous complaints.

**Preconditions:**
- The Admin is authenticated and authorized.
- A complaint exists for the relevant rider.

**Trigger:** A complaint is available for Admin review and the Admin opens the rider's complaint information.

### Main success scenario

1. A rider complaint is retained by the system.
2. The Admin opens the complaint information for the reported rider.
3. The system displays the complaint.
4. The system displays retained previous complaints for the reported rider when available.
5. The Admin reviews the available complaint information.

### Alternative / exception flows

- **A1 — SOS complaint:** The complaint is an SOS complaint submitted by one rider against another rider; it is reviewed through the same Admin complaint-review capability.
- **A2 — No previous complaints:** The current complaint is available even when there are no previous retained complaints.
- **A3 — Unauthorized access:** A user without Operations Admin authorization cannot access the complaint information.

**Postconditions:**
- The Admin has reviewed the available complaint information.
- The complaint and retained history remain available for subsequent administrative review.

**Related requirements:**`OA-FR-18`, `SYS-FR-19`, `OA-FR-20`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-12`

---

## UC-OA-07 — Issue a Rider Warning

**Actor:** Operations Admin

**Goal:** Issue a documented warning to a rider.

**Preconditions:**
- The Admin is authenticated and authorized.
- The target rider account exists.

**Trigger:** The Admin decides to issue a warning to the rider.

### Main success scenario

1. The Admin selects the rider.
2. The Admin chooses to issue a warning.
3. The Admin provides the reason for the warning.
4. The system validates that a reason has been provided.
5. The warning is accepted.
6. The system records the required warning information.
7. The Admin is informed that the warning was successfully issued.

### Alternative / exception flows

- **A1 — Missing reason:** The warning cannot be issued until the Admin provides a reason.
- **A2 — Failed completion:** If the warning cannot be successfully completed, the system does not report it as successful.
- **A3 — Unauthorized action:** A user without the required Admin authorization cannot issue the warning.

**Postconditions:**
- The rider has a warning if the use case succeeds.
- The warning contains the required reason and audit information.
- If the use case fails, the warning is not reported as successfully issued.

**Related requirements:**`OA-FR-21`, `SYS-FR-45`, `SYS-FR-48`, `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-12`

---

## UC-OA-08 — Suspend a Rider Account

**Actor:** Operations Admin

**Goal:** Suspend a rider for a specified duration or indefinitely.

**Preconditions:**
- The Admin is authenticated and authorized.
- The target rider account exists.

**Trigger:** The Admin chooses to suspend the rider account.

### Main success scenario

1. The Admin selects the rider.
2. The Admin chooses to suspend the account.
3. The Admin specifies a suspension duration or explicitly selects indefinite suspension.
4. The system accepts the suspension configuration.
5. The rider becomes suspended.
6. The rider cannot create or join rides while the suspension is active.
7. If the suspension is temporary, the account automatically reactivates when the configured period expires.
8. If the suspension is indefinite, it remains active until manual reactivation.

### Alternative / exception flows

- **A1 — Temporary suspension:** The Admin specifies a duration. The account is automatically reactivated at the end of that period.
- **A2 — Indefinite suspension:** The Admin explicitly selects indefinite suspension. The account remains suspended until manual reactivation.
- **A3 — Missing suspension choice:** The Admin provides neither a duration nor an explicit indefinite choice. The suspension cannot be completed.
- **A4 — Suspended rider attempts to ride:** A suspended rider attempts to create or join a ride; the operation is blocked.
- **A5 — Failed completion:** If the suspension cannot be successfully completed, the system does not report it as successful.

**Postconditions:**
- The rider is suspended according to the selected duration, or the suspension request is rejected.
- Historical ride, complaint, warning, and suspension information is preserved.
- Temporary suspension will end automatically at its configured expiry; indefinite suspension requires manual reactivation.

**Related requirements:**`OA-FR-23`, `SYS-FR-24`, `SYS-FR-25`, `SYS-FR-26`, `SYS-FR-27`, `SYS-FR-45`, `SYS-FR-48`, `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

---

## UC-OA-09 — Manually Reactivate a Suspended Rider

**Actor:** Operations Admin

**Goal:** Manually reactivate a suspended rider.

**Preconditions:**
- The Admin is authenticated and authorized.
- The target rider is suspended.

**Trigger:** The Admin chooses to manually reactivate the rider.

### Main success scenario

1. The Admin selects the suspended rider.
2. The Admin chooses manual reactivation.
3. The Admin provides the required reason.
4. The system accepts the reactivation.
5. The rider's account becomes active.
6. The system records the Admin identity, timestamp, and reason.

### Alternative / exception flows

- **A1 — Temporary suspension already expired:** If the temporary suspension has already expired and the account has automatically reactivated, no manual reactivation is required.
- **A2 — Failed completion:** If the reactivation cannot be successfully completed, the system does not report it as successful.
- **A3 — Unauthorized action:** A user without the required Admin authorization cannot reactivate the account.

**Postconditions:**
- The rider is active if the use case succeeds.
- Historical records remain preserved.
- The reactivation is documented with the required information.

**Related requirements:**`SYS-FR-27`, `OA-FR-28`, `SYS-FR-45`, `SYS-FR-48`, `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-08`, `SYS-NFR-11`, `SYS-NFR-12`

---

## UC-OA-10 — Review Rider Account and Disciplinary History

**Actor:** Operations Admin

**Goal:** Review the rider information relevant to administrative decisions.

**Preconditions:**
- The Admin is authenticated and authorized.
- The target rider account exists.

**Trigger:** The Admin selects a rider for administrative review.

### Main success scenario

1. The Admin selects a rider.
2. The system verifies the Admin's authorization.
3. The system displays the permitted rider identity and account status.
4. The system displays the rider's ride, complaint, warning, and suspension histories.
5. The Admin reviews the information.

### Alternative / exception flows

- **A1 — Unauthorized access:** A user without the required authorization cannot access the protected rider and disciplinary information.
- **A2 — Profile modification attempt:** The Admin attempts to modify the rider's personal profile information. The modification is rejected.

**Postconditions:**
- The Admin has reviewed the permitted rider information.
- The rider's personal profile information has not been changed by the Admin through this use case.

**Related requirements:**`OA-FR-42`, `SYS-FR-43`, `SYS-FR-44`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-11`

---

## UC-OA-11 — Review AI Complaint Analysis

**Actor:** Operations Admin

**Goal:** Review the AI-generated summary, severity, and behavioral tags associated with a complaint.

**Preconditions:**
- The Admin is authenticated and authorized.
- A complaint exists.
- Valid AI analysis is available for the complaint.

**Trigger:** The Admin opens the complaint for AI-assisted review.

### Main success scenario

1. The Admin opens the complaint review.
2. The system displays the original complaint.
3. The system displays the valid AI-generated summary.
4. The system displays the AI-assigned severity.
5. The system displays the AI-generated behavioral tags.
6. The Admin reviews the information.

### Alternative / exception flows

- **A1 — No valid AI analysis:** If valid AI analysis is unavailable, the complaint follows the manual-review flow in UC-OA-14.
- **A2 — Original complaint:** The original complaint remains available independently of the AI-generated summary.

**Postconditions:**
- The Admin has reviewed the available valid AI analysis.
- The original complaint remains preserved.

**Related requirements:**`SYS-FR-30`, `SYS-FR-31`, `SYS-FR-32`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-10`, `SYS-NFR-12`

---

## UC-OA-12 — Review and Decide on an AI Enforcement Recommendation

**Actor:** Operations Admin

**Goal:** Review an AI-generated enforcement recommendation and explicitly approve, reject, or override it.

**Preconditions:**
- The Admin is authenticated and authorized.
- A complaint has a valid AI enforcement recommendation.

**Trigger:** The Admin opens an AI enforcement recommendation for review.

### Main success scenario

1. The Admin opens the recommendation.
2. The system displays the recommended enforcement action.
3. The Admin reviews the recommendation.
4. The Admin explicitly approves the recommendation.
5. If the recommendation is a warning or suspension, the corresponding administrative action is carried out.
6. The decision is recorded as required.

### Alternative / exception flows

- **A1 — Reject:** The Admin rejects the recommendation. The recommended enforcement action is not carried out.
- **A2 — Override:** The Admin chooses an action different from the recommendation and provides the required reason. The final Admin action is used.
- **A3 — No explicit approval:** AI output alone does not change the rider's warning or suspension state.
- **A4 — Missing rejection/override reason:** The rejection or override cannot be completed until the required reason is supplied.
- **A5 — Failed completion:** If the resulting administrative action cannot be successfully completed, it is not reported as successful.

**Postconditions:**
- The recommendation has been explicitly approved, rejected, or overridden.
- No disciplinary state is changed solely by AI output.
- The final decision is recorded as required.

**Related requirements:**`SYS-FR-33`, `OA-FR-34`, `SYS-FR-35`, `OA-FR-36`, `SYS-FR-37`, `SYS-FR-38`, `SYS-FR-45`, `SYS-FR-48`, `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-07`, `SYS-NFR-08`, `SYS-NFR-10`, `SYS-NFR-12`

---

## UC-OA-13 — Review AI Enforcement Decision History

**Actor:** Operations Admin

**Goal:** Review the recorded information associated with AI-assisted enforcement decisions.

**Preconditions:**
- The Admin is authenticated and authorized.
- An AI enforcement recommendation has been reviewed by an Admin.

**Trigger:** The Admin opens AI enforcement decision history.

### Main success scenario

1. The Admin opens the AI enforcement decision history.
2. The system displays the relevant enforcement record.
3. The record identifies the complaint, AI recommendation, Admin decision, Admin identity, timestamp, and final action.
4. The Admin reviews the record.

### Alternative / exception flows

- **A1 — Rejected recommendation:** The record shows that the recommendation was rejected and was not executed.
- **A2 — Overridden recommendation:** The record shows the original recommendation and the final Admin action.
- **A3 — Unauthorized access:** A user without Operations Admin authorization cannot access the protected enforcement history.

**Postconditions:**
- The Admin has reviewed the recorded AI enforcement decision information.
- The decision record remains available for administrative review.

**Related requirements:**`SYS-FR-38`, `SYS-NFR-01`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-06`, `SYS-NFR-07`, `SYS-NFR-08`, `SYS-NFR-12`

---

## UC-OA-14 — Handle AI Analysis Failure Through Manual Review

**Actor:** Operations Admin

**Goal:** Review a complaint manually when valid AI analysis is unavailable.

**Preconditions:**
- The Admin is authenticated and authorized.
- A complaint has been submitted and retained.
- AI analysis has failed, timed out, produced invalid output, or fallen below the required confidence threshold.

**Trigger:** The complaint is routed to manual review because valid AI analysis is unavailable.

### Main success scenario

1. The Admin opens the complaint routed for manual review.
2. The system displays the original complaint.
3. The Admin reviews the complaint without treating invalid AI output as valid analysis.
4. The Admin continues the applicable administrative review using the available complaint information.

### Alternative / exception flows

- **A1 — Successful AI analysis:** If valid AI analysis becomes available, the complaint can follow the normal AI-assisted review flow.
- **A2 — AI unavailable:** The complaint remains available for manual review rather than being discarded.

**Postconditions:**
- The complaint remains available for administrative review.
- The original complaint is preserved.
- Invalid or unavailable AI output is not treated as valid analysis.

**Related requirements:**`SYS-FR-46`, `SYS-FR-47`, `SYS-NFR-02`, `SYS-NFR-03`, `SYS-NFR-07`, `SYS-NFR-09`, `SYS-NFR-12`

---

# Cross-Cutting Requirements in the Use-Case Model

The following validated system requirements do not represent independent Operations Admin actor goals. They therefore appear as constraints or outcomes in the relevant use cases:

- `SYS-FR-45` — state-changing administrative actions are auditable, including the authenticated Admin identity, timestamp, action, affected entity, and required reason where applicable.
- `SYS-FR-48` — state-changing administrative actions are reported as successful only after the required state changes are persisted atomically.
- `SYS-NFR-01` — configuration changes record previous and new values.
- `SYS-NFR-02` — audit records cannot be modified or deleted through the application.
- `SYS-NFR-03` — server-side authorization applies to protected Operations Admin functions and information.
- `SYS-NFR-04` — stale concurrent configuration updates are rejected.
- `SYS-NFR-05` — stale configuration conflicts are clearly communicated to the Admin.
- `SYS-NFR-06` — failed sensitive administrative attempts are auditable.
- `SYS-NFR-07` — complaint, disciplinary, and AI enforcement records are restricted to authorized users.
- `SYS-NFR-08` — administrative actions are attributable to the authenticated Admin identity.
- `SYS-NFR-09` — complaint review remains available for manual Admin review when AI processing is unavailable or invalid.
- `SYS-NFR-10` — AI output remains advisory and cannot independently change disciplinary state.
- `SYS-NFR-11` — required historical records, including established fare information, are preserved across later administrative changes.
- `SYS-NFR-12` — successful, rejected, pending-AI-approval, and manual-review states are distinguishable.

These constraints do not introduce additional use cases or functionality.

---

# Use Case Traceability

| Use case | Related functional requirements |
|---|---|
| UC-OA-01 | SYS-FR-39, SYS-FR-40, SYS-FR-41 |
|UC-OA-02|OA-FR-01, OA-FR-02, OA-FR-03, SYS-FR-04, SYS-FR-45|
|UC-OA-03|OA-FR-05, OA-FR-06, OA-FR-07, SYS-FR-08, SYS-FR-09, SYS-FR-45|
|UC-OA-04|OA-FR-10, OA-FR-11, SYS-FR-12, SYS-FR-13, SYS-FR-14, SYS-FR-15, SYS-FR-45, SYS-FR-48|
| UC-OA-05 | OA-FR-16, SYS-FR-17 |
| UC-OA-06 | OA-FR-18, SYS-FR-19, OA-FR-20 |
|UC-OA-07|OA-FR-21, SYS-FR-45, SYS-FR-48|
|UC-OA-08|OA-FR-23, SYS-FR-24, SYS-FR-25, SYS-FR-26, SYS-FR-27, SYS-FR-45, SYS-FR-48|
|UC-OA-09|SYS-FR-27, OA-FR-28, SYS-FR-45, SYS-FR-48|
| UC-OA-10 | OA-FR-42, SYS-FR-43, SYS-FR-44 |
| UC-OA-11 | SYS-FR-30, SYS-FR-31, SYS-FR-32 |
|UC-OA-12|SYS-FR-33, OA-FR-34, SYS-FR-35, OA-FR-36, SYS-FR-37, SYS-FR-38, SYS-FR-45, SYS-FR-48|
| UC-OA-13 | SYS-FR-38 |
| UC-OA-14 | SYS-FR-46, SYS-FR-47 |

## Notes on model boundaries

- No use case is created for individual vehicles or drivers because those entities are explicitly outside the validated Operations Admin scope.
- No use case allows the Admin to modify rides because ride access is explicitly view-only.
- No use case allows the Admin to set a final exact external fare.
- No use case allows arbitrary rider-selected destinations outside the configured hub set.
- No use case allows AI to independently impose warnings or suspensions; explicit Admin action is required.
- No separate use case is created solely for audit or persistence because those are constraints on administrative actions rather than independent Operations Admin goals.
