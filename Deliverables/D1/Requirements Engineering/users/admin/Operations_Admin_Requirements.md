# Operations Admin Requirements

**Status:** Candidate baseline --- reviewed and revised after
requirements review and clarification.

## Scope

The application has one Operations Admin role. Multiple people may hold
that role, and all Operations Admins have the same fixed permission set.

The application does not model individual cabs, autos, drivers, or
driver accounts. Vehicles are represented as configurable vehicle
types/categories such as cab, auto, and Vikram. Capacity is a property
of the vehicle type.

Riders may select only configured destination hubs. The configured hubs
include campus locations such as the fourteen halls and Main Gate, as
well as specified common external travel points.

The Operations Admin configures fixed campus fares and approximate
external fare ranges. The Admin does not set the final exact fare for an
external trip; the ride owner is responsible for the exact external
fare.

Fare sharing is segment-based. A common segment is divided equally among
the riders sharing that segment. Each rider's fare also includes any
rider-specific segment after the rider's last common point.

SOS is a rider-to-rider complaint category. The Operations Admin reviews
such complaints; the application does not provide an Admin workflow for
managing external drivers or vehicles.

The Operations Admin has view-only access to rides and cannot directly
modify a ride.

------------------------------------------------------------------------

# Functional Requirements

## Operations Admin Functional Requirements

### Vehicle Management

#### OA-FR-01

**Requirement:** The system shall allow an Operations Admin to add a
vehicle type to the set of vehicle types available for newly created
rides.

**Type:** Functional — Operations Admin

**Rationale:** The application manages vehicle types rather than
individual vehicles or drivers.

**Assumptions:** A vehicle type may be cab, auto, Vikram, or another
configured category.

**Dependencies:** Ride creation and ride matching consume the configured
vehicle-type set.

**Acceptance criteria:** - An authorized Operations Admin can add a
vehicle type. - A newly added active vehicle type can be selected where
the system requires a vehicle type. - Adding a vehicle type does not
create an individual vehicle or driver account.

**Potential ambiguities:** None currently identified.

**Unknowns:** Exact validation rules for vehicle-type names.

------------------------------------------------------------------------


#### OA-FR-02

**Requirement:** The system shall allow an Operations Admin to
deactivate a vehicle type so that it cannot be selected for newly
created rides.

**Type:** Functional — Operations Admin

**Rationale:** A vehicle type may become unavailable while its
historical use must remain meaningful.

**Assumptions:** Deactivation does not delete historical ride
information.

**Dependencies:** Ride creation and vehicle-type configuration.

**Acceptance criteria:** - An authorized Operations Admin can deactivate
an active vehicle type. - A deactivated vehicle type cannot be selected
for a newly created ride. - Existing and historical rides retain their
recorded vehicle type.

**Potential ambiguities:** None currently identified.

**Unknowns:** None.

------------------------------------------------------------------------


#### OA-FR-03

**Requirement:** The system shall allow an Operations Admin to configure
the maximum passenger capacity of each active vehicle type.

**Type:** Functional — Operations Admin

**Rationale:** Capacity is determined by vehicle type; for example, a
Vikram may seat up to eight people.

**Assumptions:** Capacity is not stored per individual vehicle.

**Dependencies:** Ride-capacity validation.

**Acceptance criteria:** - An authorized Operations Admin can view the
capacity of an active vehicle type. - An authorized Operations Admin can
change the capacity. - The configured capacity is used for rides created
after the change.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


### Destination Hub Management

#### OA-FR-05

**Requirement:** The system shall allow an Operations Admin to add a
destination hub.

**Type:** Functional — Operations Admin

**Rationale:** Riders may select only destinations configured by the
system.

**Assumptions:** A destination hub is a predefined travel point.

**Dependencies:** Destination selection.

**Acceptance criteria:** - An authorized Operations Admin can add a
destination hub. - An active added hub can be selected by riders. - The
hub receives a unique system identifier.

**Potential ambiguities:** Exact hub data fields.

**Unknowns:** Exact representation of geographic/location information.

------------------------------------------------------------------------


#### OA-FR-06

**Requirement:** The system shall allow an Operations Admin to modify
the configuration of an active destination hub without changing the
identity of the hub referenced by existing rides.

**Type:** Functional — Operations Admin

**Rationale:** Hub configuration may need correction without
invalidating historical rides.

**Assumptions:** A hub retains its identity after configuration changes.

**Dependencies:** Hub persistence and ride records.

**Acceptance criteria:** - An Admin can modify permitted hub
attributes. - Existing rides continue to reference the same hub
identity. - The modification does not change historical ride records.

**Potential ambiguities:** Which hub attributes may be modified.

**Unknowns:** None beyond the hub-field definition.

------------------------------------------------------------------------


#### OA-FR-07

**Requirement:** The system shall allow an Operations Admin to
deactivate a destination hub so that it cannot be selected for newly
created rides while preserving its use in existing ride records.

**Type:** Functional — Operations Admin

**Rationale:** Deactivation is safer than deletion because historical
rides must remain interpretable.

**Assumptions:** Deactivation does not delete historical data.

**Dependencies:** Ride creation and hub configuration.

**Acceptance criteria:** - An active hub can be deactivated by an
Admin. - A deactivated hub cannot be selected for a newly created
ride. - Existing rides referencing the hub remain unchanged.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


### Fare Configuration

#### OA-FR-10

**Requirement:** The system shall allow an Operations Admin to configure
one fixed fare for each supported pair of campus destination hubs for
each supported vehicle type.

**Type:** Functional — Operations Admin

**Rationale:** Campus fares are fixed but depend on vehicle type.

**Assumptions:** The fare is non-directional: the same configured fare
applies in either direction between the same pair of campus hubs.

**Dependencies:** Hub configuration, vehicle-type configuration, and
fare calculation.

**Acceptance criteria:** - An Admin can configure a fare for a
campus-hub pair and vehicle type. - The same configured fare is used for
both directions between the pair. - A different vehicle type may have a
different configured fare for the same hub pair. - The configured fare
is available to fare calculation.

**Potential ambiguities:** None for directionality or vehicle-type
dependency.

**Unknowns:** None.

------------------------------------------------------------------------


#### OA-FR-11

**Requirement:** The system shall allow an Operations Admin to configure
an approximate fare range for each supported travel segment involving an
external destination hub and vehicle type.

**Type:** Functional — Operations Admin

**Rationale:** External fares depend on traffic and time and therefore
are represented as approximations.

**Assumptions:** The range is an estimate and is not the final exact
fare.

**Dependencies:** Hub and vehicle-type configuration.

**Acceptance criteria:** - An Admin can configure a lower and upper
estimate for a supported external segment and vehicle type. - The system
stores the range as an approximation. - The configured range can be
presented to users as an estimate.

**Potential ambiguities:** None currently identified.

**Unknowns:** Exact update workflow.

------------------------------------------------------------------------


### Ride Visibility and Authority

#### OA-FR-16

**Requirement:** The system shall allow an Operations Admin to view ride
information for administrative monitoring and complaint investigation.

**Type:** Functional — Operations Admin

**Rationale:** Admins require operational visibility without having
ride-modification authority.

**Assumptions:** The exact visible ride fields are defined by the
application's access-control model.

**Dependencies:** Ride records and Admin authorization.

**Acceptance criteria:** - An authorized Admin can view permitted ride
information. - Ride information can be used during complaint
investigation. - Viewing a ride does not modify it.

**Potential ambiguities:** Exact fields visible to Admin.

**Unknowns:** None affecting the Admin authority boundary.

------------------------------------------------------------------------


### Complaint and Incident Management

#### OA-FR-18

**Requirement:** The system shall allow an authorized Operations Admin
to view complaints submitted by riders against other riders.

**Type:** Functional — Operations Admin

**Rationale:** Complaint review is an Operations Admin responsibility.

**Assumptions:** Complaint records contain the information required for
review.

**Dependencies:** Complaint submission and storage.

**Acceptance criteria:** - An authorized Admin can access submitted
complaints. - The Admin can view the stored complaint details. - An
unauthorized user cannot access Admin complaint-review data.

**Potential ambiguities:** Exact complaint fields.

**Unknowns:** Complaint retention period.

------------------------------------------------------------------------


#### OA-FR-20

**Requirement:** The system shall allow an authorized Operations Admin
to view a reported rider's retained previous complaints.

**Type:** Functional — Operations Admin

**Rationale:** Complaint history provides context for administrative
review and recurring-pattern analysis.

**Assumptions:** The system retains previous complaint records.

**Dependencies:** Complaint and rider-history storage.

**Acceptance criteria:** - Admin can view previous retained complaints
for the reported rider. - Complaint history is restricted to authorized
Admins. - Historical complaint records are not modified by viewing them.

**Potential ambiguities:** Retention duration.

**Unknowns:** Retention policy.

------------------------------------------------------------------------


#### OA-FR-21

**Requirement:** The system shall allow an authorized Operations Admin
to issue a warning to a rider and shall require a reason for the
warning.

**Type:** Functional — Operations Admin

**Rationale:** Warning is an Admin enforcement action supported by the
project context.

**Assumptions:** Warnings do not directly modify rides.

**Dependencies:** Rider account management.

**Acceptance criteria:** - Admin can issue a warning. - A warning cannot
be submitted without a reason. - The warning is associated with the
affected rider.

**Potential ambiguities:** Whether warnings expire.

**Unknowns:** None for V1; warnings have no automatic expiry unless
changed later.

------------------------------------------------------------------------


#### OA-FR-23

**Requirement:** The system shall allow an authorized Operations Admin
to suspend a rider account and shall require the Admin to specify a
suspension duration or explicitly select an indefinite suspension.

**Type:** Functional — Operations Admin

**Rationale:** Suspensions may be temporary or indefinite.

**Assumptions:** A temporary suspension automatically ends at its
specified expiry time.

**Dependencies:** Account state management and time-based scheduling.

**Acceptance criteria:** - Admin can suspend a rider for a specified
period, such as three months. - Admin can select an indefinite
suspension. - A suspension cannot be created without either a duration
or an explicit indefinite designation.

**Potential ambiguities:** Whether duration is entered as an exact date
or a time interval.

**Unknowns:** None; implementation may use either an interval or
calculated expiry date.

------------------------------------------------------------------------


#### OA-FR-28

**Requirement:** The system shall allow an authorized Operations Admin
to manually reactivate a suspended rider.

**Type:** Functional — Operations Admin

**Rationale:** Admin must be able to end an indefinite suspension and,
where necessary, end a temporary suspension early.

**Assumptions:** Reactivation does not erase suspension history.

**Dependencies:** Account state management.

**Acceptance criteria:** - Admin can reactivate a suspended rider. - The
rider becomes eligible for normal ride participation after
reactivation. - The suspension record remains available for audit.

**Potential ambiguities:** Whether Admin must provide a reason.

**Unknowns:** None.

------------------------------------------------------------------------


### AI-Assisted Complaint Management

#### OA-FR-34

**Requirement:** The system shall require explicit Operations Admin
approval before executing an AI-recommended warning or suspension.

**Type:** Functional — Operations Admin

**Rationale:** AI-generated enforcement requires human approval.

**Assumptions:** Only an authorized Admin can approve enforcement.

**Dependencies:** AI integration and account management.

**Acceptance criteria:** - AI output alone cannot execute a warning or
suspension. - An explicit Admin approval is required. - Approval results
in the corresponding authorized account action.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


#### OA-FR-36

**Requirement:** The system shall require an Operations Admin to provide
a reason when rejecting or overriding an AI enforcement recommendation.

**Type:** Functional — Operations Admin

**Rationale:** Human overrides need an auditable explanation.

**Assumptions:** The reason is retained with the AI decision record.

**Dependencies:** AI action logging.

**Acceptance criteria:** - Admin cannot submit a rejection/override
without a reason. - The reason is stored with the decision.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


### User and Access Management

#### OA-FR-42

**Requirement:** The system shall allow an authorized Operations Admin
to view a rider's identity, account status, ride history, complaint
history, warning history, and suspension history.

**Type:** Functional — Operations Admin

**Rationale:** These records are required for complaint investigation
and account administration.

**Assumptions:** This information is considered necessary administrative
data.

**Dependencies:** Rider, ride, complaint, and account records.

**Acceptance criteria:** - Admin can locate a rider. - Admin can view
the specified administrative information. - Non-Admin users cannot
access this Admin-only view.

**Potential ambiguities:** Exact rider search keys.

**Unknowns:** None affecting the permitted data categories.

------------------------------------------------------------------------

---

## System Functional Requirements

### Vehicle Management

#### SYS-FR-04

**Requirement:** The system shall apply a vehicle-type capacity change
only to rides created after the change and shall preserve the capacity
applicable to an existing ride.

**Type:** Functional — System

**Rationale:** A capacity change must not invalidate or silently alter
an existing ride.

**Assumptions:** Existing rides retain their established
vehicle-capacity constraint.

**Dependencies:** Ride persistence and vehicle-type configuration.

**Acceptance criteria:** - Changing a vehicle type from one capacity to
another does not change the capacity constraint of an existing ride. - A
newly created ride uses the new capacity. - Historical ride data remains
interpretable.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


### Destination Hub Management

#### SYS-FR-08

**Requirement:** The system shall restrict rider destination selection
to active configured destination hubs.

**Type:** Functional — System

**Rationale:** Riders cannot select arbitrary destinations.

**Assumptions:** Destination hubs are the authoritative set of
selectable destinations.

**Dependencies:** Hub configuration.

**Acceptance criteria:** - A rider can select an active configured
hub. - A rider cannot select an unconfigured destination. - A rider
cannot select a deactivated hub for a newly created ride.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-09

**Requirement:** The initial system configuration shall include
destination hubs for the fourteen campus halls, Main Gate, the metro
station, Kanpur Central railway station, Kanpur Anwarganj railway
station, the bus station, and Kanpur and Lucknow airports.

**Type:** Functional — System

**Rationale:** These are the specified campus and common external travel
points for the project.

**Assumptions:** The hub set can be extended later through Admin hub
management.

**Dependencies:** OA-FR-05 and SYS-FR-08.

**Acceptance criteria:** - Each specified location exists as a
configured destination hub in the initial system configuration. - Each
initially configured hub can be activated/deactivated through the Admin
configuration mechanism.

**Potential ambiguities:** None for the currently specified initial set.

**Unknowns:** None.

------------------------------------------------------------------------


### Fare Configuration

#### SYS-FR-12

**Requirement:** The system shall display an Operations Admin-configured
external fare range as an estimate rather than as the final exact fare.

**Type:** Functional — System

**Rationale:** The exact external fare is affected by traffic/time and
is the responsibility of the ride owner.

**Assumptions:** The ride owner provides the exact external fare.

**Dependencies:** Ride-owner fare handling.

**Acceptance criteria:** - An external fare range is visibly
distinguished from a final fare. - The configured range alone cannot
become the final exact fare of an external trip.

**Potential ambiguities:** Exact UI presentation is an implementation
decision.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-13

**Requirement:** The system shall prevent an Operations Admin from
setting or modifying the final exact fare of an external trip.

**Type:** Functional — System

**Rationale:** Exact external fares are the responsibility of the ride
owner and are outside Operations Admin scope.

**Assumptions:** Ride-owner fare entry is defined in the Rider/Ride
Owner requirements.

**Dependencies:** Ride-owner fare handling.

**Acceptance criteria:** - No Admin operation can set the final exact
external fare. - No Admin operation can modify a ride owner's final
external fare.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-14

**Requirement:** The system shall divide the fare of a common travel
segment equally among all riders sharing that segment.

**Type:** Functional — System

**Rationale:** Riders may share only part of a journey.

**Assumptions:** A common segment has an identifiable total fare.

**Dependencies:** Ride segmentation and fare calculation.

**Acceptance criteria:** - The system identifies the riders sharing a
common segment. - The common-segment fare is divided into equal shares
among those riders. - Each rider receives exactly one equal share for
that common segment.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-15

**Requirement:** The system shall add each rider's fare for travel after
the rider's last common travel point to that rider's total fare.

**Type:** Functional — System

**Rationale:** Riders may diverge to different campus halls or other
destinations after sharing a common segment.

**Assumptions:** Rider-specific segment fares are available.

**Dependencies:** Ride segmentation and fare calculation.

**Acceptance criteria:** - The system identifies each rider's last
common travel point. - The fare for the rider-specific segment is added
to that rider's total. - The rider-specific fare is not allocated to
riders who do not travel on that segment.

**Potential ambiguities:** None at the requirement level.

**Unknowns:** Exact route/segment representation belongs to the broader
ride requirements.

------------------------------------------------------------------------


### Ride Visibility and Authority

#### SYS-FR-17

**Requirement:** The system shall prevent an Operations Admin from
modifying any ride through the Admin interface.

**Type:** Functional — System

**Rationale:** The Admin cannot directly intervene in active rides, and
the agreed scope is view-only for rides generally.

**Assumptions:** Ride modification remains under Rider/Ride Owner
functionality.

**Dependencies:** Server-side authorization.

**Acceptance criteria:** - Admin cannot add or remove riders from a
ride. - Admin cannot change a ride's destination, departure time,
vehicle type, or fare. - Admin cannot cancel or otherwise modify a ride.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


### Complaint and Incident Management

#### SYS-FR-19

**Requirement:** The system shall allow a rider to submit a complaint
against another rider using the SOS complaint category.

**Type:** Functional — System

**Rationale:** SOS is a rider-to-rider complaint category rather than a
driver/vehicle emergency-management workflow.

**Assumptions:** SOS complaints enter the normal complaint-review
workflow.

**Dependencies:** Rider complaint submission.

**Acceptance criteria:** - A rider can select SOS as a complaint
category. - The rider can identify the reported rider. - The resulting
complaint is available to authorized Admins.

**Potential ambiguities:** Whether SOS requires additional fields.

**Unknowns:** None affecting the basic workflow.

------------------------------------------------------------------------


------------------------------------------------------------------------


#### SYS-FR-24

**Requirement:** The system shall prevent a suspended rider from
creating or joining rides while the suspension is active.

**Type:** Functional — System

**Rationale:** Suspension must have a concrete effect on rider
participation.

**Assumptions:** Suspension does not delete historical data.

**Dependencies:** Authentication/authorization and ride participation.

**Acceptance criteria:** - An actively suspended rider cannot create a
ride. - An actively suspended rider cannot join a ride. - The system
permits normal ride participation after the suspension expires or is
manually removed.

**Potential ambiguities:** Whether the suspended rider may view existing
rides; this does not affect the prohibition on creating/joining.

**Unknowns:** None for the participation restriction.

------------------------------------------------------------------------


#### SYS-FR-25

**Requirement:** The system shall automatically reactivate a rider
account when its temporary suspension reaches its configured expiry
time.

**Type:** Functional — System

**Rationale:** Temporary suspensions should not require manual Admin
intervention after expiry.

**Assumptions:** The system maintains suspension expiry information.

**Dependencies:** Reliable time-based account-state processing.

**Acceptance criteria:** - A three-month suspension automatically ends
at its configured expiry. - The rider becomes eligible for normal ride
participation after expiry, subject to other account rules. - The
automatic reactivation is recorded.

**Potential ambiguities:** Exact definition of "three months" is an
implementation/time-calculation detail.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-26

**Requirement:** The system shall keep an indefinitely suspended rider
suspended until an authorized Operations Admin manually reactivates the
account.

**Type:** Functional — System

**Rationale:** An indefinite suspension has no automatic expiry.

**Assumptions:** Manual reactivation is an Admin action.

**Dependencies:** Account state management.

**Acceptance criteria:** - An indefinite suspension has no automatic
expiry. - The rider remains unable to create or join rides. - An
authorized Admin can manually reactivate the rider.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-27

**Requirement:** The system shall preserve historical ride, complaint,
warning, and suspension records when a rider is suspended or
reactivated.

**Type:** Functional — System

**Rationale:** Account-state changes must not destroy administrative
history.

**Assumptions:** Historical records are retained according to the
system's retention policy.

**Dependencies:** Persistent storage.

**Acceptance criteria:** - Suspending a rider does not delete historical
records. - Automatic or manual reactivation does not delete historical
records. - Historical records remain associated with the rider.

**Potential ambiguities:** Retention period is a general data-policy
decision.

**Unknowns:** Retention period.

------------------------------------------------------------------------


------------------------------------------------------------------------


### AI-Assisted Complaint Management

#### SYS-FR-30

**Requirement:** The system shall display a valid AI-generated summary
of a complaint to an authorized Operations Admin.

**Type:** Functional — System

**Rationale:** The Complaint Management AI summarizes complaints for
Admin review.

**Assumptions:** The AI summary is advisory and does not replace the
original complaint.

**Dependencies:** Complaint Management AI.

**Acceptance criteria:** - A successfully generated valid summary is
displayed to Admin. - The original complaint remains accessible. -
Displaying the summary does not modify the complaint or account.

**Potential ambiguities:** Summary format.

**Unknowns:** None affecting the Admin workflow.

------------------------------------------------------------------------


#### SYS-FR-31

**Requirement:** The system shall preserve the original rider-submitted
complaint independently of the AI-generated summary.

**Type:** Functional — System

**Rationale:** AI output must not overwrite the source complaint.

**Assumptions:** The original complaint is persisted before or
independently of AI processing.

**Dependencies:** Complaint persistence.

**Acceptance criteria:** - The original complaint remains unchanged
after AI processing. - AI output can be unavailable without making the
original complaint unavailable.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-32

**Requirement:** The system shall display the AI-generated severity
classification and behavioral tags for a complaint to an authorized
Operations Admin when valid output is available.

**Type:** Functional — System

**Rationale:** The project specifies severity scoring and behavioral
categorization by the Complaint Management AI.

**Assumptions:** Initial severity levels are Low, Medium, High, and
Critical.

**Dependencies:** Complaint Management AI.

**Acceptance criteria:** - Admin can view the AI severity
classification. - Admin can view the AI behavioral tags. - The AI result
alone does not change account state.

**Potential ambiguities:** Final behavioral-tag vocabulary may expand.

**Unknowns:** None for the initial severity levels.

------------------------------------------------------------------------


#### SYS-FR-33

**Requirement:** The system shall display an AI-generated enforcement
recommendation to an authorized Operations Admin when a valid
recommendation is available.

**Type:** Functional — System

**Rationale:** The AI may recommend warnings or suspensions but does not
have final enforcement authority.

**Assumptions:** The recommendation is advisory.

**Dependencies:** Complaint Management AI and account management.

**Acceptance criteria:** - Admin can view the recommended enforcement
action. - The recommendation is associated with the relevant
complaint. - Displaying the recommendation does not itself change
account state.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-35

**Requirement:** The system shall not execute an AI-recommended warning
or suspension when an Operations Admin rejects the recommendation.

**Type:** Functional — System

**Rationale:** Rejection must prevent the proposed enforcement action.

**Assumptions:** Rejection is an explicit Admin decision.

**Dependencies:** AI recommendation workflow.

**Acceptance criteria:** - A rejected recommendation does not change
warning or suspension state. - The rejection is recorded.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-37

**Requirement:** The system shall prevent the Complaint Management AI
from creating, modifying, or removing a rider warning or suspension
without an explicit authorized Operations Admin action.

**Type:** Functional — System

**Rationale:** AI must not autonomously execute disciplinary actions.

**Assumptions:** AI is advisory for enforcement.

**Dependencies:** Server-side authorization and AI integration.

**Acceptance criteria:** - An AI output alone cannot change warning
state. - An AI output alone cannot change suspension state. - Only an
authorized Admin action can perform those changes.

**Potential ambiguities:** None for the currently specified AI
enforcement actions.

**Unknowns:** Future AI actions outside warnings and suspensions are not
yet defined.

------------------------------------------------------------------------


#### SYS-FR-38

**Requirement:** The system shall record the complaint ID, AI
recommendation, Operations Admin decision, Admin identity, timestamp,
and final enforcement action for each AI enforcement recommendation.

**Type:** Functional — System

**Rationale:** AI-assisted enforcement requires traceability.

**Assumptions:** The action log is retained for administrative audit.

**Dependencies:** Authentication and persistent audit storage.

**Acceptance criteria:** - Each AI enforcement recommendation has an
associated log record. - The record identifies the complaint. - The
record identifies the recommendation and Admin decision. - The record
identifies the Admin and timestamp. - The final enforcement action is
recorded.

**Potential ambiguities:** None.

**Unknowns:** Retention policy.

------------------------------------------------------------------------


### User and Access Management

#### SYS-FR-39

**Requirement:** The system shall authenticate a user before granting
Operations Admin access.

**Type:** Functional — System

**Rationale:** Admin functions require authenticated access.

**Assumptions:** The project uses IITK email-based authentication with
separate role-based authorization.

**Dependencies:** Authentication service.

**Acceptance criteria:** - An unauthenticated user cannot access Admin
functionality. - An authenticated user can proceed to authorization
evaluation.

**Potential ambiguities:** Exact authentication mechanism is an
implementation detail.

**Unknowns:** None at the requirements level.

------------------------------------------------------------------------


#### SYS-FR-40

**Requirement:** The system shall enforce exactly one Operations Admin
permission set for all users assigned the Operations Admin role.

**Type:** Functional — System

**Rationale:** Multiple Admins exist, but all Admins have the same fixed
actions.

**Assumptions:** There are no Admin sub-roles.

**Dependencies:** Role-based authorization.

**Acceptance criteria:** - Every Admin receives the same permission
set. - No Admin can obtain additional permissions through the
application. - There is no second Admin permission tier.

**Potential ambiguities:** None.

**Unknowns:** Admin provisioning mechanism.

------------------------------------------------------------------------


#### SYS-FR-41

**Requirement:** The system shall prevent a Rider from assigning the
Operations Admin role to themselves or to another user through the
application.

**Type:** Functional — System

**Rationale:** Admin authorization must not be self-granted through the
normal application.

**Assumptions:** Admin provisioning occurs through a separate controlled
mechanism.

**Dependencies:** Role management and server-side authorization.

**Acceptance criteria:** - A Rider cannot invoke an application
operation that grants Admin privileges. - A Rider cannot modify another
user's Admin role. - Unauthorized role-assignment requests are rejected.

**Potential ambiguities:** Exact external provisioning mechanism is
outside the application.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-43

**Requirement:** The system shall restrict complaint, disciplinary, and
AI enforcement records to authorized Operations Admins.

**Type:** Functional — System

**Rationale:** These records contain sensitive administrative
information.

**Assumptions:** Riders do not require access to internal Admin
investigation records.

**Dependencies:** Server-side authorization.

**Acceptance criteria:** - A Rider cannot retrieve another rider's
complaint or disciplinary records through protected endpoints. - Only
authorized Admins can access AI enforcement records. - Unauthorized
access attempts are rejected.

**Potential ambiguities:** Whether a rider receives a separate
notification about the outcome is outside this requirement.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-44

**Requirement:** The system shall prevent an Operations Admin from
modifying a rider's personal profile information through Admin
account-management functions.

**Type:** Functional — System

**Rationale:** Admin responsibilities concern account status and
administrative records, not arbitrary profile editing.

**Assumptions:** Riders manage their own permitted profile information.

**Dependencies:** Account management and authorization.

**Acceptance criteria:** - Admin cannot edit a rider's profile through
Admin functions. - Admin can still perform permitted warning/suspension
actions.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


### Auditability and Configuration History

#### SYS-FR-45

**Requirement:** The system shall record the authenticated Operations Admin identity, timestamp, action type, affected entity, and, when the action requires a reason, that reason for each state-changing Operations Admin action.

**Type:** Functional — System

**Rationale:** Multiple Admins have identical permissions, so actions
must remain attributable.

**Assumptions:** Admin identity is available through authentication.

**Dependencies:** Authentication and audit logging.

**Acceptance criteria:** - Every state-changing Admin action creates an
audit record. - The record identifies the Admin. - The record contains a
timestamp. - The record identifies the affected entity and action.

**Potential ambiguities:** None.

**Unknowns:** Audit retention policy.

------------------------------------------------------------------------


### Failure Handling

#### SYS-FR-46

**Requirement:** The system shall route a complaint to manual Operations
Admin review when Complaint Management AI processing fails, times out,
produces invalid output, or produces output below the configured
confidence threshold.

**Type:** Functional — System

**Rationale:** AI must not become a single point of failure for
complaint handling.

**Assumptions:** Manual complaint review is available independently of
AI.

**Dependencies:** Complaint persistence and AI integration.

**Acceptance criteria:** - A failed AI request does not make the
complaint unavailable. - A timed-out request does not create an
enforcement action. - Invalid AI output is not used as an enforcement
decision. - Below-threshold output is routed to manual review.

**Potential ambiguities:** Exact confidence threshold.

**Unknowns:** Initial numerical threshold and retry count.

------------------------------------------------------------------------


#### SYS-FR-47

**Requirement:** The system shall preserve the original complaint when
AI processing fails.

**Type:** Functional — System

**Rationale:** AI failure must not corrupt or remove the source
complaint.

**Assumptions:** Complaint data is persisted independently of AI output.

**Dependencies:** Complaint persistence.

**Acceptance criteria:** - The original complaint remains retrievable
after AI failure. - AI failure does not alter the original complaint. -
Admin can manually review the complaint.

**Potential ambiguities:** None.

**Unknowns:** None.

------------------------------------------------------------------------


#### SYS-FR-48

**Requirement:** The system shall report a state-changing Operations
Admin action as successful only after all state changes belonging to
that operation have been persisted atomically.

**Type:** Functional — System

**Rationale:** Admin must not receive false confirmation after a
persistence or service failure.

**Assumptions:** Each state-changing operation has a defined atomic
persistence boundary.

**Dependencies:** Database/service layer.

**Acceptance criteria:** - A failed operation does not produce a success
confirmation. - A success confirmation corresponds to persisted state. -
A partially completed operation is not reported as successfully
completed.

**Potential ambiguities:** Exact transaction boundaries are an
architecture decision.

**Unknowns:** Infrastructure-level recovery behavior.

------------------------------------------------------------------------

## Non-Functional Requirements

All non-functional requirements in this document are **system requirements**. They constrain the system as a whole rather than defining a new Operations Admin goal.

The following requirements constrain the quality, safety, security, integrity,
and operational behavior of the functional capabilities above. No
quantitative performance or availability target is introduced here unless it
has been validated as a project requirement.

### SYS-NFR-01 — Configuration Change Audit Detail

**Requirement:** The system shall record the previous and new values for each
Operations Admin configuration change.

**Category:** Auditability

**Rationale:** Configuration changes to capacities, hubs, vehicle types, and
fares must be attributable and reconstructable.

**Acceptance criteria:**
- A configuration modification records its previous value.
- The same audit record records its new value.
- The record identifies the Admin and timestamp.

**Unknowns:** Exact representation of complex configuration values is an
implementation decision.

---

### SYS-NFR-02 — Audit Record Integrity

**Requirement:** The system shall prevent Operations Admins from modifying or
deleting audit records through the application.

**Category:** Security / Auditability

**Rationale:** The actor being audited must not be able to alter the
application audit trail.

**Acceptance criteria:**
- An Admin cannot edit an audit record through the application.
- An Admin cannot delete an audit record through the application.
- Unauthorized attempts are rejected.

**Scope note:** Infrastructure-level database administration is outside the
application requirements.

---

### SYS-NFR-03 — Server-Side Authorization

**Requirement:** The system shall enforce Operations Admin authorization on
the server side for every Admin-protected operation and Admin-protected data
access.

**Category:** Security / Authorization

**Rationale:** Client-side access controls alone must not determine whether an
Admin operation is permitted.

**Acceptance criteria:**
- An unauthorised request to an Admin-protected operation is rejected.
- An unauthorised request to Admin-protected data is rejected.
- An authorized Admin request is still subject to the relevant functional
  validation.

---

---

### SYS-NFR-04 — Concurrent Configuration Integrity

**Requirement:** The system shall reject an Operations Admin configuration
update when the configuration has changed since the Admin last retrieved it.

**Category:** Reliability / Concurrency

**Rationale:** Multiple Admins may concurrently edit the same configuration.
The system must not silently overwrite a more recent change.

**Acceptance criteria:**
- Admin A retrieves configuration state X.
- Admin B changes the same configuration.
- Admin A attempts to save the previously retrieved state X.
- The system rejects Admin A's stale update rather than overwriting Admin B's
  change.

**Unknowns:** The concurrency-control mechanism is an implementation
decision.

---

### SYS-NFR-05 — Actionable Configuration Conflict Feedback

**Requirement:** The system shall clearly inform an Operations Admin when a
configuration update is rejected because the configuration is stale.

**Category:** Usability / Reliability

**Rationale:** The Admin must be able to distinguish a stale-update conflict
from a successful configuration change.

**Acceptance criteria:**
- A stale update produces an explicit failure outcome.
- The outcome indicates that the configuration has changed since it was
  retrieved.
- The stale update is not presented as successful.

**Unknowns:** Exact wording and presentation are design decisions.

---

### SYS-NFR-06 — Failed Administrative Action Auditability

**Requirement:** The system shall record failed Operations Admin attempts to
perform suspension, reactivation, fare configuration, vehicle configuration,
and destination-hub configuration actions.

**Category:** Auditability / Security

**Rationale:** Failed sensitive administrative actions may be relevant to
security and audit investigation.

**Acceptance criteria:**
- A failed protected Admin action in the specified categories generates an
  audit record.
- The record contains the Admin identity, attempted action, affected entity
  where known, and timestamp.
- A failed attempt is not recorded as a successful state change.

**Unknowns:** Audit retention duration is not yet validated.

---

### SYS-NFR-07 — Sensitive Administrative Data Privacy

**Requirement:** The system shall not disclose complaint, disciplinary, or AI
enforcement records to a user who does not have Operations Admin
authorization.

**Category:** Privacy / Security

**Rationale:** These records may contain sensitive information about riders
and administrative decisions.

**Acceptance criteria:**
- An authorized Operations Admin can access the records permitted by the
  functional requirements.
- A Rider cannot access complaint, disciplinary, or AI enforcement records
  through the application.
- An unauthorised access attempt is rejected.

**Boundary:** This requirement does not introduce any new data collection
or new Admin permissions.

---

### SYS-NFR-08 — Administrative Identity Integrity

**Requirement:** The system shall associate each Operations Admin action with
the authenticated Admin identity under which the action was performed.

**Category:** Security / Auditability

**Rationale:** Multiple Admins have the same permission set, so administrative
actions must remain attributable to the actual authenticated actor.

**Acceptance criteria:**
- A state-changing Admin action is associated with the authenticated Admin.
- The recorded Admin identity cannot be supplied by the Rider or by an
  unauthorised application request.

**Related functional requirement:** SYS-FR-39 and SYS-FR-45.

---

---

### SYS-NFR-09 — AI Failure Independence

**Requirement:** The complaint-management workflow shall remain available for
manual Operations Admin review when AI processing fails, times out, produces
invalid output, or produces output below the configured confidence
threshold.

**Category:** Availability / Reliability / AI Safety

**Rationale:** AI must not become a single point of failure for complaint
handling.

**Acceptance criteria:**
- A complaint remains available for manual review when AI processing fails.
- An AI timeout does not prevent manual review.
- Invalid or below-threshold AI output does not prevent manual review.

**Related functional requirements:** SYS-FR-46 and SYS-FR-47.

---

### SYS-NFR-10 — AI Human Oversight Boundary

**Requirement:** AI-generated complaint summaries, severity assessments,
behavioral tags, and enforcement recommendations shall not by themselves
change a rider's disciplinary state.

**Category:** AI Safety / Oversight

**Rationale:** Disciplinary action requires explicit human approval under the
validated requirements.

**Acceptance criteria:**
- AI output can be displayed as advisory information.
- An AI recommendation alone does not issue a warning or suspension.
- A warning or suspension resulting from an AI recommendation requires the
  explicit Admin action specified by the functional requirements.

**Related functional requirements:** SYS-FR-30 through SYS-FR-38.

---

### SYS-NFR-11 — Historical Record Integrity

**Requirement:** Deactivation, suspension, reactivation, and configuration changes shall not remove or rewrite the historical records that the functional requirements require to be preserved, including fare information already established for existing rides.

**Category:** Reliability / Data Integrity

**Rationale:** Historical rides, complaints, warnings, suspensions, and hub or
vehicle references must remain interpretable after later administrative
changes.

**Acceptance criteria:**
- Deactivating a vehicle type does not rewrite historical ride references.
- Deactivating a hub does not rewrite historical ride references.
- Suspending or reactivating a rider does not remove required historical
  records.
- Fare configuration changes do not rewrite established historical fare
  information.

**Related functional requirements:** SYS-FR-04, OA-FR-07, SYS-FR-27, SYS-FR-31;
SYS-NFR-04.

---

### SYS-NFR-12 — Administrative Outcome Clarity

**Requirement:** The system shall clearly distinguish among a successful
Administrative action, a rejected action, an AI recommendation awaiting human
approval, and an action requiring manual review.

**Category:** Usability / AI Safety

**Rationale:** Admins must not confuse an AI recommendation, a failed action,
or a pending manual-review state with an executed administrative action.

**Acceptance criteria:**
- A rejected stale configuration update is not displayed as successful.
- An AI recommendation awaiting approval is not displayed as an executed
  disciplinary action.
- A complaint routed to manual review is identifiable as requiring Admin
  review.

**Related requirements:** OA-FR-34, SYS-FR-35, SYS-FR-46, SYS-NFR-05.

---

## NFR Review: Deliberately Unspecified Areas

The following quality attributes were explicitly considered but are **not
assigned invented numerical targets** because no validated project value for
them exists in the current requirements baseline:

- **Performance:** No response-time, throughput, or concurrency-capacity
  target has been validated. A numeric target should be added only after the
  team establishes one.
- **General availability:** No uptime/SLA target has been validated. The
  currently supported availability requirement is specifically the ability to
  continue complaint review manually when AI is unavailable (SYS-NFR-09).
- **Maintainability:** No validated maintainability metric, deployment
  constraint, or change-impact target exists yet. The requirements therefore
  do not invent one.
- **Scalability:** No validated user/admin/data-volume target exists yet.
- **Usability beyond outcome clarity:** No validated usability metric or
  accessibility target exists yet.

This is intentional: adding arbitrary targets such as “99.9% uptime” or “page
loads within 2 seconds” would create new requirements rather than refine the
validated baseline.

# Explicit Scope Boundaries

The following are outside the Operations Admin requirements unless later
added through elicitation:

-   individual cab/auto/vehicle records;
-   driver accounts or driver management;
-   Admin modification of rides;
-   Admin setting the final exact fare for an external trip;
-   arbitrary rider-selected destinations;
-   Admin-managed emergency response for external drivers or vehicles;
-   equal splitting of an entire trip when riders share only part of the
    route;
-   rider appeal workflow;
-   Admin editing of rider profile information;
-   Admin sub-roles or differentiated Admin permissions.
