# AI Log

## Purpose

This document records prompts, elicitation decisions, reviews, and
requirement changes used while developing the Operations Admin
requirements for the CS455 project.

The log is maintained to support requirements-engineering traceability
and to document how AI assistance was used.

------------------------------------------------------------------------

## Entry 01 --- Operations Admin requirements elicitation

**User prompt:**

> first, start with for the Operations Admin role, identify the
> questions that need to be answered to determine the actual
> requirements. Organize the questions under: responsibilities of
> Operations Admin, permissions, vehicle management, destination hub
> management, fare configuration, SOS handling, complaints/incidents,
> AI-agent recommendations/actions, user management, security/access
> control, failure/exception cases and any other relevant aspect. For
> each question, explain what requirement or design decision it affects.
> Do not assume answers to ambiguous questions. Ask me for answers on
> questions you are unsure about.

**AI action:**

Generated an elicitation questionnaire covering Admin responsibilities,
permissions, vehicles, destination hubs, fares, SOS, complaints, AI
behavior, user management, security, failures, notifications, reporting,
configuration changes, and cross-cutting authority.

**Principle:** Ambiguous behavior was represented as questions rather
than silently converted into requirements.

------------------------------------------------------------------------

## Entry 02 --- Admin authority clarification

**User input:**

-   An Admin cannot directly intervene in an active ride.
-   There is one Admin role with a fixed set of permissions.
-   There can be multiple Admins, all with the same actions.
-   The user asked for suggested answers to remaining elicitation
    questions for confirmation.

**AI action:**

Proposed a permission model in which Admins can configure and review
administrative entities but cannot modify active rides, and proposed
identical permissions for all Admins with audit logging.

**Decision:** Confirmed by the user.

------------------------------------------------------------------------

## Entry 03 --- Vehicle, hub, fare, and SOS clarification

**User input:**

-   Vehicles represent vehicle types such as cab, auto, and Vikram
    rather than individual cabs or drivers.
-   There are no individual cab/auto driver accounts.
-   Registering a vehicle means adding another vehicle type/category,
    e.g. a Traveller.
-   Capacity is associated with vehicle type; a Vikram can seat up to
    eight people.
-   Admin can control vehicle-type capacity.
-   Destination hubs are predefined campus spots, including the 14 halls
    and Main Gate, plus required external/common travel points such as
    the metro station, Kanpur Central and Anwarganj railway stations,
    the bus station, and Kanpur/Lucknow airports.
-   Riders cannot select arbitrary destinations.
-   Fares between campus hubs are fixed by the system/Admin.
-   External destinations use an approximate fare range because exact
    fare depends on traffic/time.
-   The exact external fare is the ride owner's responsibility and is
    out of Operations Admin scope.
-   Fare cannot simply be split equally across the entire ride because
    riders may share only part of a route.
-   Example: four riders arriving from a railway station may share the
    fare to Main Gate, then each rider has an additional fare from Main
    Gate to their respective hall.
-   SOS is not an Admin responsibility in the sense of managing
    drivers/vehicles.
-   SOS is a complaint category that one rider can lodge against
    another, which the Admin reviews.
-   The user agreed with the remaining suggested answers.

**AI action:**

Converted the clarified scope into candidate Operations Admin
requirements and explicitly recorded unresolved decisions rather than
silently resolving them.

------------------------------------------------------------------------

## Entry 04 --- Initial candidate Operations Admin requirements

**User request:**

> based on these answers generate candidate Operations Admin
> requirements. Use numbered IDs such as OA-FR-01, OA-FR-02, etc. For
> every requirement provide: ID Requirement statement Type: Functional /
> Non-functional Rationale Assumptions Dependencies Acceptance criteria
> Potential ambiguities Unknowns Write requirements in precise
> shall-style language. Each requirement must express one requirement
> only. Do not introduce functionality that is not supported by the
> project context or my answers. Make a doc for this - we will continue
> to edit that doc for the remainder of the chat Also, make the ai log
> doc and continue to edit it

**AI action:**

Created the initial Operations Admin requirements document and AI log.

------------------------------------------------------------------------

## Entry 05 --- Critical requirements review

**User request:**

> Act as a critical requirements reviewer.
>
> Review the Operations Admin requirements above.
>
> Check each requirement for: 1. validity 2. consistency 3. completeness
> 4. realism/feasibility 5. verifiability 6. ambiguity 7. atomicity 8.
> missing assumptions 9. missing exception cases 10. missing
> security/access-control requirements 11. missing auditability
> requirements
>
> For every problem: - identify the requirement ID - explain the
> problem - propose a revised version
>
> Do not silently change requirements.
>
> also, remove the section of open questions and answer those concretely
> if required do not edit before confirming with me

**AI action:**

Reviewed the candidate requirements without editing them. Identified
issues involving: - compound requirements and atomicity; - ambiguous
fare and hub behavior; - vehicle/capacity changes affecting existing
rides; - insufficient security/data-access requirements; - incomplete
audit records; - insufficient AI enforcement boundaries; - missing Admin
authentication and privilege-escalation requirements; - concurrent Admin
configuration changes; - AI failure/timeout/invalid-output handling; -
disciplinary action reasons and auditability.

The review proposed concrete resolutions, subject to user confirmation.

------------------------------------------------------------------------

## Entry 06 --- Confirmed fare and suspension decisions

**User input:**

-   Fare between campus hubs is **not directional**.
-   Fare **depends on vehicle type**.
-   Admin can specify a suspension time period, such as three months,
    after which the account automatically reactivates.
-   If no suspension time period is specified, the suspension is
    indefinite until an Admin manually reactivates the account.
-   A common segment is **always divided equally** among the riders
    sharing that segment.
-   User requested that the requirements document and AI log be updated
    and that the ID scheme be changed.

**Confirmed decisions incorporated:**

1.  Campus fare is non-directional.
2.  Campus fare is configured separately by vehicle type.
3.  Temporary suspension has an Admin-specified duration.
4.  Temporary suspension automatically reactivates the account at
    expiry.
5.  Indefinite suspension has no automatic expiry.
6.  Indefinite suspension ends only through manual Admin reactivation.
7.  Every common travel segment is divided equally among the riders
    sharing that segment.
8.  Requirements use separate ID namespaces:
    -   `OA-FR-xx` for Functional Requirements.
    -   `OA-NFR-xx` for Non-functional Requirements.

**Resulting document changes:**

-   Split compound requirements into atomic requirements where
    necessary.
-   Removed the previous Open Decisions section.
-   Replaced unresolved fare directionality with the confirmed
    non-directional rule.
-   Added vehicle-type dependency to campus fares.
-   Replaced indefinite-only suspension with configurable temporary or
    indefinite suspension.
-   Added automatic reactivation for temporary suspensions.
-   Added manual reactivation for indefinite suspensions.
-   Made equal common-segment splitting explicit.
-   Added server-side authorization, sensitive-data access control,
    privilege-escalation protection, audit-record protection,
    configuration-change history, concurrency conflict handling, and AI
    failure handling.
-   Kept Admin ride access view-only.
-   Kept SOS as a rider-to-rider complaint category rather than a
    driver/vehicle emergency workflow.

------------------------------------------------------------------------

## Entry 07 --- Operations Admin user stories

**User prompt:**

> Convert the validated Operations Admin functional requirements into
> user stories. create a third doc for this
> create situations/scenarios
> Use:
> As an Operations Admin,
> I want to ...
> so that ...
> Give each story:
> - User story ID
> - Related requirement IDs
> - Acceptance criteria
> - Preconditions
> - Main scenario
> - Alternative/exception scenarios
> Do not create stories for functionality that is not represented
> by the requirements.

**AI action:**

Created the Operations Admin user-story document from the validated
functional requirements, with traceability to requirement IDs and
scenario-based acceptance criteria. No unsupported Operations Admin
functionality was intentionally introduced.

------------------------------------------------------------------------

## Entry 08 --- Add non-functional requirements to user stories

**User prompt:**

> also include non functional requirements in these

**AI action:**

Updated the Operations Admin user-story document so that relevant
non-functional requirements are included in story traceability and
acceptance criteria. The update retained the existing functional
requirements and did not introduce new Operations Admin functionality.

------------------------------------------------------------------------

## Entry 09 --- Operations Admin use cases

**User prompt:**

> Using only the validated Operations Admin requirements and user stories,
> identify the Operations Admin use cases.
> For each use case provide:
> - use case ID
> - name
> - actor
> - goal
> - preconditions
> - trigger
> - main success scenario
> - alternative/exception flows
> - postconditions
> - related requirements
> Do not add implementation details to the use-case model.
> create a fourth doc for this

**AI action:**

Created the Operations Admin use-case document using only the validated
requirements and user stories. Use cases were expressed at the behavioral
level and excluded implementation details. Requirements were traced to the
resulting use cases.

------------------------------------------------------------------------

## Entry 10 --- Attack and refine the non-functional requirements

**User prompt:**

> attack and refine the non functional requirements
> Consider:
> - security
> - authorization
> - auditability
> - availability
> - performance
> - reliability
> - usability
> - maintainability
> - privacy
> - AI safety/oversight where relevant
> group the requirements doc cleanly into functional and non functional
> update the ai log with all prompts so far

**AI action:**

Critically reviewed the existing non-functional baseline rather than
inventing arbitrary quantitative targets. The refined requirements now
explicitly cover:

- security and server-side authorization;
- administrative identity integrity;
- audit-record integrity and configuration-change history;
- failed administrative action auditability;
- privacy of complaint, disciplinary, and AI-enforcement records;
- historical fare and administrative-record integrity;
- concurrent configuration-update protection;
- atomicity of state-changing administrative actions;
- availability/reliability of complaint review when AI processing is
  unavailable or invalid;
- AI human-oversight boundaries; and
- clarity of administrative outcomes and stale-update failures.

Performance, general availability, maintainability, scalability, and
additional usability metrics were explicitly considered. No numerical
values or new requirements were invented for these attributes because no
validated project targets currently exist for them. The requirements
document records these as deliberate NFR gaps for future elicitation.

The requirements document was reorganized so that all functional
requirements appear in the Functional Requirements section and the
cross-cutting quality constraints appear in a dedicated Non-Functional
Requirements section. Existing requirement IDs used by the user stories
were preserved where possible to avoid unnecessary traceability breaks.

------------------------------------------------------------------------

## Entry 11 --- Refine user stories into actual scenario-based stories

**User prompt:**

> the user stories are not actual scenarios
> they should be actual stories

**AI action:**

Reworked the Operations Admin user-story document so that each story is
scenario-based rather than being a broad functional bundle. The revised
stories:

- describe a concrete situation in which the Operations Admin has a goal;
- keep the required `As an Operations Admin, I want to ..., so that ...`
  form;
- include a short Situation / story narrative;
- retain preconditions, acceptance criteria, main scenario, and
  alternative/exception scenarios;
- split previously bundled capabilities where a separate concrete
  administrative situation exists;
- represent system requirements as constraints and expected system behavior
  within the stories rather than inventing system-as-user goals; and
- preserve the validated scope without adding drivers, individual vehicle
  management, ride modification by Admins, arbitrary destinations, appeals,
  or other unsupported functionality.

The traceability matrix was also updated so requirement-to-user-story links
continue to point to the revised story IDs. The AI log records this
requirements-engineering refinement step.

## Prompt 11 — Request for genuinely scenario-based user stories

**User prompt:**
> no
> scenarios
> come up with scenarios
> for example - mini travellers are suddenly gaining popularity on campus
> also, create specific complain scenarios, for example people complaining this particular user does not pay their share of the fare so we issue a warning - but make it explicit
> include scenarios like this

**AI action:**
Reworked the Operations Admin user stories to use concrete contextual situations rather than requirement-shaped headings. Examples now include a sudden increase in Mini Traveller popularity leading to vehicle-type configuration, specific complaints about a rider repeatedly failing to pay their fare share leading to an explicit warning scenario, three-month suspension, indefinite suspension, manual reactivation, safety/SOS complaints, AI recommendations and rejection, AI failure, and concurrent Admin configuration changes. The scenarios were constrained to the validated requirements and did not introduce driver roles, individual vehicle management, Admin ride modification, exact external fare setting, or automatic AI disciplinary action.


## Requirements Deduplication and Consolidation

**User prompt:**
> remove redundant/duplicate requirements

**AI action:**
Reviewed the validated Operations Admin requirements for semantic duplication across Operations Admin requirements, System functional requirements, and System non-functional requirements. Consolidated duplicate audit requirements into `SYS-FR-45`, which now records Admin identity, timestamp, action, affected entity, and required reason for state-changing Admin actions. Removed the separate `SYS-FR-22` and `SYS-FR-29` requirements. Removed redundant `SYS-NFR-04` (historical fare integrity) and `SYS-NFR-10` (atomic administrative state changes), because their content is already covered by broader validated requirements (`SYS-NFR-11` after renumbering for historical-record integrity and `SYS-FR-48` for atomic success reporting). Renumbered the remaining NFRs to keep the NFR sequence clean and updated the User Stories, Use Cases, and Traceability Matrix references accordingly. No new functionality was introduced.
