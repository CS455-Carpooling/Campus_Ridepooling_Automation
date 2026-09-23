# Ride Owner — User Stories

This document contains the user stories for the Ride Owner, organized by Epic.

## Epic: RO-EPIC-01 Ride Management

### RO-US-01: Create Ride
**As a** Ride Owner,
**I want** to create a ride with a specific destination, time, and vehicle capacity,
**So that** other riders can automatically join my pool and split the fare.

**Acceptance Criteria:**
- Given I am authenticated, when I submit a ride with valid destination, future time window, and capacity, then the ride is created in the 'Scheduled' state.
- Given I have an active ride, when I try to create another ride with an overlapping time window, the system prevents it.

### RO-US-02: Auto-Join Notification
**As a** Ride Owner,
**I want** to be notified when a Rider automatically joins my ride,
**So that** I know my pool is filling up.

**Acceptance Criteria:**
- Given my ride has remaining capacity, when a Rider confirms their join request, the system automatically adds them to the pool without my intervention.
- The system immediately sends me a push notification/in-app alert about the new Rider.
- The UI dynamically updates to show the newly joined Rider and the recalculated fare share.

### RO-US-03: Manage No-Shows
**As a** Ride Owner,
**I want** to mark a joined rider as a no-show if they don't arrive,
**So that** the system can recalculate the fare split fairly for the remaining passengers.

**Acceptance Criteria:**
- Given the ride is in 'Pickup in Progress' state and the 5-minute grace period has elapsed for a Rider's pickup, when I tap "Mark No-Show", the Rider is removed from the active pool.
- The system automatically triggers a negative rating for the no-show Rider.
- The system instantly recalculates and displays the new fare shares for the remaining occupants based on the reduced pool size.

### RO-US-04: Settle Fares
**As a** Ride Owner,
**I want** to mark individual riders as 'Settled' after the trip,
**So that** I can keep track of who has paid me their share of the fare.

**Acceptance Criteria:**
- Given the ride is in 'Completed' state, when I view the ride summary, I see a checklist of all occupants and their final fare shares.
- When I tap 'Settled' next to a Rider, the system logs their payment status as complete.
- The system prevents me from marking a no-show Rider as 'Settled' for the standard share.
