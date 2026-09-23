# Ride Owner — Use Cases

## 1. Use Case Descriptions

### UC-RO-01: Create a Ride
**Actor:** Ride Owner
**Precondition:** Ride Owner is authenticated and does not have a conflicting active ride.
**Main Success Scenario:**
1. Ride Owner selects "Create Ride".
2. Ride Owner enters the destination, departure time window, and fixed vehicle capacity.
3. System validates the inputs (e.g., time is in the future, no conflicts).
4. System creates the ride in 'Scheduled' state.
5. System makes the ride visible to potential Riders.

### UC-RO-02: Monitor Pool and Fare
**Actor:** Ride Owner, System
**Precondition:** Ride is in 'Scheduled' state.
**Main Success Scenario:**
1. System automatically adds a Rider to the pool when they confirm their intent to join.
2. System recalculates the expected fare split for all occupants.
3. System notifies the Ride Owner of the new occupant.
4. Ride Owner views the updated pool and fare breakdown.
**Alternative Flow (Capacity Reached):**
1. Rider attempts to join.
2. System detects vehicle capacity is reached.
3. System rejects the Rider's join attempt and does not modify the pool.

### UC-RO-03: Execute Trip and Mark No-Show
**Actor:** Ride Owner
**Precondition:** Ride is locked, and time is approaching departure.
**Main Success Scenario:**
1. Ride Owner transitions the ride state to 'Pickup in Progress'.
2. Ride Owner arrives at pickup location.
3. A confirmed Rider fails to appear after the grace period.
4. Ride Owner marks the Rider as a 'No-Show'.
5. System removes the Rider from the active pool.
6. System automatically recalculates the fare for the remaining occupants.
7. Ride Owner completes the pickups and transitions state to 'Completed'.

### UC-RO-04: Settle Fares
**Actor:** Ride Owner
**Precondition:** Ride is in 'Completed' state.
**Main Success Scenario:**
1. Ride Owner collects payment from a Rider externally (e.g., UPI).
2. Ride Owner selects the Rider in the app and marks their share as 'Settled'.
3. System updates the settlement status for that Rider.
4. (Optional) System sends a reminder to Riders with unsettled shares after 24h.
