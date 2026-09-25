# Ride Owner — User Stories

This document contains user stories for the Ride Owner, organized by epic. A Ride Owner creates a ride, reviews Rider requests, manages the trip, and records fare settlement after the trip.

## Epic: RO-EPIC-01 Ride Creation and Management

### RO-US-01: Create Ride
**As a** Ride Owner,
**I want** to create a ride with a destination, departure time, vehicle capacity, and expected total fare,
**So that** eligible campus residents can request to share my ride and split its cost.

**Acceptance Criteria:**
- Given I am authenticated, when I submit a ride with a valid destination, future departure time, capacity, and expected total fare, then the system creates the ride in the `Scheduled` state.
- Given I have an active ride, when I try to create another ride with an overlapping time window, then the system prevents it.
- Given I enter an invalid capacity, time, or fare, when I submit the form, then the system shows the relevant validation error and does not create the ride.

### RO-US-02: Edit or Cancel an Open Ride
**As a** Ride Owner,
**I want** to edit or cancel my ride before it is locked,
**So that** I can respond to changes in my travel plan.

**Acceptance Criteria:**
- Given my ride is open for requests, when I change its departure time, capacity, expected fare, or destination, then the system saves the valid changes and notifies affected Riders.
- Given Riders have already been accepted, when my edit would make the ride unsuitable for them, then the system asks me to confirm before applying the change.
- Given my ride has not started, when I cancel it, then the system marks it as cancelled and notifies all accepted Riders.

### RO-US-03: View Ride Requests
**As a** Ride Owner,
**I want** to view pending requests to join my ride,
**So that** I can decide who should be included in my pool.

**Acceptance Criteria:**
- Given Riders have requested to join my open ride, when I open the ride details, then I see their pending requests and relevant profile details.
- The system shows the remaining seats and the current estimated fare split.
- The system notifies me when a new join request is received.

### RO-US-04: Accept a Join Request
**As a** Ride Owner,
**I want** to accept a Rider's join request,
**So that** I can build the ride pool up to the vehicle capacity.

**Acceptance Criteria:**
- Given a request is pending and seats are available, when I select `Accept`, then the system adds the Rider to the pool.
- When a Rider is accepted, then the system recalculates the estimated fare share for every occupant.
- The system notifies the accepted Rider and updates the remaining seat count.

### RO-US-05: Reject a Join Request
**As a** Ride Owner,
**I want** to reject a Rider's join request,
**So that** I retain control over who joins my ride.

**Acceptance Criteria:**
- Given a request is pending, when I select `Reject`, then the system marks the request as rejected and does not add the Rider to the pool.
- The system notifies the Rider that their request was not accepted.
- Rejecting a request does not affect the ride capacity or current fare split.

### RO-US-06: Manage Ride Capacity and Lock the Pool
**As a** Ride Owner,
**I want** to see available seats and lock the ride when the pool is final,
**So that** no further membership changes disrupt the trip.

**Acceptance Criteria:**
- Given Riders are accepted into my ride, when I view the ride, then I see the total capacity, occupied seats, and available seats.
- Given the pool is ready, when I lock the ride, then the system prevents new join requests and voluntary exits according to the lock policy.
- Given capacity is reached, when another Rider requests to join, then the system prevents the request from being accepted.

## Epic: RO-EPIC-02 Trip Coordination and Execution

### RO-US-07: View Pool and Fare Breakdown
**As a** Ride Owner,
**I want** to view all confirmed occupants and their estimated fare shares,
**So that** I know how the expected total fare is divided.

**Acceptance Criteria:**
- Given I have an active ride, when I view its details, then I see the expected total fare and each occupant's current share.
- When an occupant is accepted, leaves before the lock time, or is marked as a no-show, then the system updates the displayed shares.
- The total of the displayed shares equals the expected total fare, subject to the platform's rounding rule.

### RO-US-08: Coordinate with Confirmed Riders
**As a** Ride Owner,
**I want** to communicate with confirmed Riders in a private ride chat,
**So that** we can coordinate pickup details and changes quickly.

**Acceptance Criteria:**
- Given a Rider is accepted into my ride, when I open the ride chat, then I can send and receive messages with all confirmed occupants.
- Pending or rejected Riders cannot access the private ride chat.
- The system notifies confirmed occupants of new messages according to their notification settings.

### RO-US-09: Start Pickup
**As a** Ride Owner,
**I want** to mark that pickup has started,
**So that** the pool knows the ride is actively being executed and arrival tracking can begin.

**Acceptance Criteria:**
- Given my ride is locked and scheduled for departure, when I select `Start Pickup`, then the system changes its state from `Scheduled` to `Pickup in Progress`.
- The system notifies all confirmed Riders that pickup has started.
- Once pickup starts, the system displays the arrival status controls for each confirmed Rider.

### RO-US-10: Track Rider Arrivals
**As a** Ride Owner,
**I want** to record whether each confirmed Rider has arrived at pickup,
**So that** I can identify missing riders and begin the trip fairly.

**Acceptance Criteria:**
- Given the ride is in `Pickup in Progress`, when a Rider arrives, then I can mark them as `Arrived`.
- The system displays the current arrival status of every confirmed Rider.
- A Rider marked as arrived cannot subsequently be marked as a no-show without an explicit correction flow.

### RO-US-11: Manage No-Shows
**As a** Ride Owner,
**I want** to mark a confirmed Rider as a no-show if they do not arrive after the grace period,
**So that** the remaining passengers' fare split is recalculated fairly.

**Acceptance Criteria:**
- Given the ride is in `Pickup in Progress` and the grace period has elapsed for a Rider, when I select `Mark No-Show`, then the system records them as a no-show and removes them from the active pool.
- The system automatically recalculates and displays the new fare shares for the remaining occupants.
- The system records the no-show for later administrative review and applies the defined rating or penalty workflow.

### RO-US-12: Complete the Ride
**As a** Ride Owner,
**I want** to mark the ride as completed after reaching the destination,
**So that** final settlement and ratings can begin.

**Acceptance Criteria:**
- Given the ride is in `Pickup in Progress`, when I select `Complete Ride`, then the system changes the ride state to `Completed`.
- The system stores the final active pool and final fare shares in the ride summary.
- The system makes settlement and rating actions available after completion.

## Epic: RO-EPIC-03 Fare Settlement, Feedback, and Safety

### RO-US-13: Record Fare Settlement
**As a** Ride Owner,
**I want** to mark individual Riders as `Settled` after receiving their payment outside the app,
**So that** I can keep track of who has paid their fare share.

**Acceptance Criteria:**
- Given the ride is in `Completed` state, when I view the ride summary, then I see each active occupant's final fare share and settlement status.
- When I mark a Rider as `Settled`, then the system records their payment status as complete.
- The system prevents me from marking a no-show Rider as settled for the standard ride share.
- The system may send reminders to Riders whose shares remain unsettled after the configured period.

### RO-US-14: Rate Riders
**As a** Ride Owner,
**I want** to rate Riders after the trip,
**So that** future Ride Owners can make better decisions about join requests.

**Acceptance Criteria:**
- Given a completed ride, when I open the feedback section within the rating window, then I can submit a rating and optional feedback for each active Rider.
- The system records a no-show outcome separately from ordinary trip feedback.
- Once submitted, a rating is associated with the completed ride and the rated Rider.

### RO-US-15: Report Misconduct or Raise an SOS Alert
**As a** Ride Owner,
**I want** to confidentially report misconduct and raise an SOS alert during an emergency,
**So that** the platform administrator can review or respond appropriately.

**Acceptance Criteria:**
- Given I need to report an incident, when I submit a complaint with relevant details, then the system sends it confidentially to the admin team.
- Given an emergency during an active ride, when I activate SOS and grant permission, then the system sends an urgent alert and my current location to the admin team.
- Other Riders cannot view the confidential complaint or SOS location unless the platform's emergency policy explicitly permits it.
