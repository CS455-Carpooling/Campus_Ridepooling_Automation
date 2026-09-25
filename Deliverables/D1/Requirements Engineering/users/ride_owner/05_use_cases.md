# Ride Owner — Use Cases

## 1. Use Case Descriptions

### UC-RO-01: Create a Ride
**Primary Actor:** Ride Owner
**Precondition:** The Ride Owner is authenticated and has no conflicting active ride.
**Trigger:** The Ride Owner selects `Create Ride`.

**Main Success Scenario:**
1. The Ride Owner enters the destination, departure time, vehicle capacity, and expected total fare.
2. The system validates that the time is in the future, the capacity and fare are valid, and the ride does not conflict with another active ride.
3. The system creates the ride in the `Scheduled` state.
4. The system displays the ride to Riders searching for matching rides.

**Alternative Flows:**
- **A1 — Invalid details:** The system highlights invalid fields and does not create the ride.
- **A2 — Conflicting ride:** The system informs the Ride Owner that an overlapping active ride exists and does not create the new ride.

### UC-RO-02: Edit or Cancel an Open Ride
**Primary Actor:** Ride Owner
**Precondition:** The ride is scheduled, has not started, and is not locked.
**Trigger:** The Ride Owner selects `Edit Ride` or `Cancel Ride`.

**Main Success Scenario — Edit:**
1. The Ride Owner changes the destination, departure time, capacity, or expected total fare.
2. The system validates the revised details.
3. If accepted Riders may be affected, the system asks the Ride Owner to confirm the change.
4. The system saves the changes and notifies affected Riders.

**Alternative Flow — Cancel:**
1. The Ride Owner selects `Cancel Ride` and confirms the action.
2. The system marks the ride as cancelled.
3. The system notifies all accepted Riders.

### UC-RO-03: Review and Decide Join Requests
**Primary Actor:** Ride Owner
**Supporting Actor:** Rider
**Precondition:** The ride is scheduled, open for requests, and has available capacity.
**Trigger:** A Rider submits a request to join the ride.

**Main Success Scenario — Accept:**
1. The system records the Rider's request as pending and notifies the Ride Owner.
2. The Ride Owner opens the ride details and reviews pending requests and relevant Rider profile details.
3. The Ride Owner selects `Accept` for a pending Rider.
4. The system verifies that the ride still has capacity.
5. The system adds the Rider to the confirmed pool.
6. The system recalculates the estimated fare share for all occupants.
7. The system notifies the accepted Rider and updates the remaining seat count.

**Alternative Flows:**
- **A1 — Reject request:** The Ride Owner selects `Reject`; the system marks the request rejected, notifies the Rider, and leaves capacity and fare shares unchanged.
- **A2 — Capacity reached:** If no seats remain when the Ride Owner attempts acceptance, the system prevents acceptance and informs the Ride Owner.
- **A3 — Ride locked:** The system prevents a new acceptance after the ride has been locked.

### UC-RO-04: Manage Capacity, Fare Breakdown, and Pool Lock
**Primary Actor:** Ride Owner
**Precondition:** The Ride Owner has a scheduled ride.
**Trigger:** The Ride Owner views ride details or selects `Lock Ride`.

**Main Success Scenario:**
1. The system displays total capacity, occupied seats, available seats, expected total fare, and the current estimated share for each confirmed occupant.
2. The Ride Owner reviews the confirmed pool.
3. When the pool is final, the Ride Owner selects `Lock Ride`.
4. The system locks the ride and fixes membership according to the lock policy.
5. The system prevents new join requests and voluntary exits after the lock.

### UC-RO-05: Coordinate with Confirmed Riders
**Primary Actor:** Ride Owner
**Supporting Actors:** Confirmed Riders
**Precondition:** At least one Rider has been accepted into the ride.
**Trigger:** The Ride Owner opens the private ride chat.

**Main Success Scenario:**
1. The system opens a private chat for the confirmed pool.
2. The Ride Owner sends pickup instructions or other coordination messages.
3. Confirmed Riders receive the messages and can reply.
4. The system notifies occupants of new chat messages according to their notification settings.

**Alternative Flow:**
- **A1 — Unconfirmed Rider:** A pending or rejected Rider attempts to access the chat; the system denies access.

### UC-RO-06: Start Pickup and Track Arrivals
**Primary Actor:** Ride Owner
**Precondition:** The ride is locked, scheduled for departure, and has not been completed.
**Trigger:** The Ride Owner selects `Start Pickup`.

**Main Success Scenario:**
1. The system changes the ride state from `Scheduled` to `Pickup in Progress`.
2. The system notifies all confirmed Riders that pickup has started.
3. The system displays an arrival status for each confirmed Rider.
4. As Riders reach the pickup point, the Ride Owner marks them as `Arrived`.
5. The system stores and displays each Rider's current arrival status.

### UC-RO-07: Mark a No-Show and Complete the Ride
**Primary Actor:** Ride Owner
**Precondition:** The ride is in `Pickup in Progress`.
**Trigger:** A confirmed Rider has not arrived after the grace period, or the Ride Owner reaches the destination.

**Main Success Scenario — No-Show:**
1. The Ride Owner identifies a Rider who has not arrived after the grace period.
2. The Ride Owner selects `Mark No-Show` for that Rider.
3. The system records the Rider as a no-show and removes them from the active pool.
4. The system recalculates and displays the fare shares for remaining occupants.
5. The system records the no-show for the rating, penalty, and administrative-review workflow.

**Main Success Scenario — Complete Ride:**
1. After the trip ends, the Ride Owner selects `Complete Ride`.
2. The system changes the ride state to `Completed`.
3. The system stores the final active pool and final fare shares in the ride summary.
4. The system enables settlement and rating actions.

**Alternative Flow:**
- **A1 — Grace period not elapsed:** The system prevents the Ride Owner from marking the Rider as a no-show and displays the applicable grace-period information.

### UC-RO-08: Record Fare Settlement
**Primary Actor:** Ride Owner
**Precondition:** The ride is completed.
**Trigger:** The Ride Owner receives a Rider's payment outside the application.

**Main Success Scenario:**
1. The Ride Owner opens the completed ride summary.
2. The system displays each active Rider's final fare share and settlement status.
3. The Ride Owner selects a Rider and marks their payment as `Settled`.
4. The system records the settlement status as complete.
5. The system displays outstanding payments and may send reminders after the configured period.

**Alternative Flow:**
- **A1 — No-show Rider:** The system prevents the Ride Owner from marking a no-show Rider as settled for the standard ride share.

### UC-RO-09: Rate Riders or Report an Incident
**Primary Actor:** Ride Owner
**Supporting Actor:** Admin
**Precondition:** The ride is completed for ratings, or an incident has occurred for reporting.
**Trigger:** The Ride Owner opens the feedback or safety option.

**Main Success Scenario — Rate:**
1. The Ride Owner opens the feedback section within the rating window.
2. The system displays the active Riders from the completed ride.
3. The Ride Owner submits a rating and optional feedback for a Rider.
4. The system associates the feedback with the completed ride and Rider.

**Main Success Scenario — Report / SOS:**
1. The Ride Owner enters complaint details and submits a confidential report, or activates SOS during an active ride.
2. For SOS, the system requests location permission.
3. The system sends the complaint or urgent SOS alert to the Admin.
4. The system restricts complaint information and SOS location from other Riders unless the emergency policy permits access.
