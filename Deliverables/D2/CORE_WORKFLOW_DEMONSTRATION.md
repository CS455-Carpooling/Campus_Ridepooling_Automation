# Core Transactional Workflow Demonstration

This document provides a reproducible demonstration of the core transactional
workflow required for D2:

```text
authenticate -> create ride -> request seat -> accept request
-> lock ride -> pickup/check-in -> start trip -> complete
-> settle externally -> rate/report
```

It is based on the implementation in the ride, request, trip, settlement,
rating, complaint, notification, and SOS modules. It does not claim that the
application transfers money; payment is external and only its status is
recorded.

## Complete source audit provenance

This demonstration was regenerated after reading every included implementation
and executable-configuration file completely:

- **269 files read**
- **36,217 lines read**
- **0 unread included files**
- **204 test/specification files excluded**
- **1 lockfile and 177 documentation, diagram, binary, generated, or
  non-executable metadata files excluded**

The workflow below uses implementation behavior only; tests and documentation
were not used as evidence.

## Demonstration prerequisites

1. Start the application using the root [README](../../README.md) or
   [setup guide](../../apps/web/setup.md).
2. Confirm readiness:

   ```powershell
   Invoke-WebRequest http://localhost:3000/api/health
   ```

   Continue only when the response status is `200`.
3. Use two verified IITK accounts:
   - **Ride owner**: the account used to create the ride.
   - **Rider**: a different verified account with a completed profile and active
     campus pickup location.
4. Keep each account's session cookie separate. The examples below use
   `$owner` and `$rider` as conceptual cookie jars; do not share cookies
   between the two roles.
5. Never place real passwords, session cookies, API keys, or private database
   credentials in this document or in shell history.

## State transition overview

### Ride

```text
scheduled -> pickup_in_progress -> in_transit -> completed
scheduled -> cancelled
```

The owner can explicitly lock a scheduled ride. Starting pickup applies any due
lock transactionally. Trip transitions lock the ride row so concurrent actions
cannot produce an invalid sequence.

### Join request

```text
pending -> accepted -> completed
pending -> rejected
pending -> withdrawn
pending -> expired
pending -> needs_reconfirmation -> pending
accepted -> left
accepted -> no_show
accepted -> completed
```

### Payment settlement

```text
due -> paid -> confirmed
             \-> disputed
```

### SOS

```text
open -> acknowledged -> closed
open -> closed
```

## Phase 1: prepare accounts and sessions

Register and verify both accounts through the web UI, or use the implemented
authentication routes. The registration flow requires an `@iitk.ac.in` address
and email verification before login.

Owner login:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "<owner>@iitk.ac.in",
  "password": "<owner-password>"
}
```

Rider login uses the same endpoint with the rider credentials. Capture each
session cookie in its own client. A successful login returns `200` and sets the
session cookie; unverified accounts receive `403`.

After first login, complete `/profile` for each account. The implementation
requires a display name, active campus pickup location, and the AI-tag consent
choice before ordinary student workflows are allowed.

## Phase 2: owner creates a scheduled ride

The owner submits:

```http
POST /api/rides
Content-Type: application/json
Cookie: <owner-session>

{
  "direction": "to_hub",
  "hubId": "kanpur-central",
  "campusLocationId": "hall-5",
  "vehicleTypeId": "car",
  "departureStart": "<future ISO timestamp>",
  "departureEnd": "<later future ISO timestamp>",
  "expectedTotalFare": 400
}
```

Record the returned `ride.id` as `<rideId>`.

Expected result:

- Status `201`.
- The ride is in `scheduled` state.
- The owner has a `riders` seat for the ride.
- Capacity and fare values were validated against server-side rules.
- The database transaction committed the ride and owner seat together.
- The owner receives no partially-created ride if any validation or database
  step fails.

The server also checks overlapping offered rides and travel conflicts before
commit. A suspended owner receives `403`.

## Phase 3: rider submits an idempotent join request

The rider submits:

```http
POST /api/rides/<rideId>/requests
Content-Type: application/json
Cookie: <rider-session>

{
  "pickupLocationId": "hall-5",
  "idempotencyKey": "<new-unique-key>"
}
```

Expected result:

- Status `201` with a request record.
- The request is `pending`.
- The request contains the server-created itinerary/fare snapshot.
- The owner receives a notification.

Repeat the exact request with the same idempotency key. The expected result is
`200` with the existing request rather than a duplicate request.

The transaction rejects a request when the rider is suspended, the ride is
locked/closed/full, the pickup is invalid, the rider already has an active
request or seat, a travel conflict exists, payment is overdue, or the rider has
exceeded the waiting-request limit.

## Phase 4: owner accepts the request

First retrieve requests as the owner:

```http
GET /api/rides/<rideId>/requests
Cookie: <owner-session>
```

Record the returned `<requestId>`, then accept it:

```http
PATCH /api/rides/<rideId>/requests/<requestId>
Content-Type: application/json
Cookie: <owner-session>

{ "action": "accept" }
```

Expected result:

- Status `200`.
- The request becomes `accepted`.
- A rider seat is inserted/restored.
- Capacity, current ride state, rider suspension, and conflict checks are
  re-evaluated inside the transaction.
- The rider receives an acceptance notification.

Owner rejection uses `{ "action": "reject" }`; the rider can withdraw a waiting
request with `{ "action": "withdraw" }`.

## Phase 5: lock the ride and fix fare shares

Before departure, the owner locks the ride:

```http
POST /api/rides/<rideId>/lock
Cookie: <owner-session>
```

Expected result:

```json
{ "rideId": "<rideId>", "locked": true }
```

The lock transaction:

1. Sets `rides.locked_at`.
2. Calculates owner-first/join-order shares.
3. Stores each active seat's `locked_share`.
4. Copies the locked share into accepted request records.
5. Expires pending and reconfirmation requests.
6. Notifies requesters whose requests expired.

After lock, editing, joining, and leaving are subject to stricter state and
confirmation rules. The owner can no longer silently change the share basis.

## Phase 6: pickup, check-in, and arrival

The owner starts pickup:

```http
POST /api/rides/<rideId>/trip
Content-Type: application/json
Cookie: <owner-session>

{ "to": "pickup_in_progress" }
```

Expected result:

- Status `200`.
- Ride state becomes `pickup_in_progress`.
- `pickup_started_at` is stored.
- Any due lock is applied first.
- Riders are notified.

The rider checks in:

```http
POST /api/rides/<rideId>/check-in
Cookie: <rider-session>
```

Expected result: `200 { "seat": ... }`. The check-in is available from lock
until the trip starts and is idempotent.

During pickup, the owner marks the rider arrived:

```http
POST /api/rides/<rideId>/arrivals
Content-Type: application/json
Cookie: <owner-session>

{
  "occupantId": "<rider-seat-id>",
  "status": "arrived"
}
```

The owner may use `not_arrived` or `no_show` instead. A no-show is available
only after the estimated pickup time plus the five-minute grace period. A
no-show removes the rider from active fare calculations, updates the request
state, and sends a notification.

## Phase 7: start the trip and complete it

Start the trip:

```http
POST /api/rides/<rideId>/trip
Content-Type: application/json
Cookie: <owner-session>

{ "to": "in_transit" }
```

Expected result:

- Status `200`.
- Ride state becomes `in_transit`.
- `trip_started_at` is recorded.
- Remaining active seats are treated as arrived when pickup ends.
- The transition is accepted only after pickup has started.

Complete the trip:

```http
POST /api/rides/<rideId>/complete
Cookie: <owner-session>
```

Alternatively, use `POST /api/rides/<rideId>/trip` with
`{ "to": "completed" }`.

Expected result:

- Status `200`.
- Ride state becomes `completed`.
- `completed_at` and `ratingClosesAt` are available.
- Immutable final-share rows are created.
- Accepted requests become `completed`.
- No-show seats are excluded and their share is redistributed among eligible
  active seats.
- Post-lock leavers retain their payable locked share.
- Riders receive completion notifications.
- The 72-hour rating window opens.

Invalid or concurrent transitions return `409` and do not partially commit.

## Phase 8: record external settlement

The rider records payment outside the application, then records the status:

```http
POST /api/rides/<rideId>/settlements/<riderSeatId>
Content-Type: application/json
Cookie: <rider-session>

{
  "action": "paid",
  "method": "upi",
  "reference": "optional-reference"
}
```

Use `"method": "cash"` for external cash payment. The reference is optional
and limited to 50 characters. The expected transition is:

```text
due -> paid
```

The owner confirms:

```http
POST /api/rides/<rideId>/settlements/<riderSeatId>
Content-Type: application/json
Cookie: <owner-session>

{ "action": "confirm" }
```

Expected transition:

```text
paid -> confirmed
```

The rider can dispute instead:

```http
{ "action": "dispute" }
```

which changes the status to `disputed` and creates a payment complaint when
needed. The application does not collect, hold, or transfer funds.

## Phase 9: ratings and complaint path

Within 72 hours of completion, a participant rates another participant:

```http
POST /api/rides/<rideId>/ratings
Content-Type: application/json
Cookie: <rider-session>

{
  "ratings": [
    {
      "occupantId": "<owner-seat-id>",
      "score": 5,
      "comment": "Optional comment"
    }
  ]
}
```

Expected result: `201 { "rated": 1 }`. Self-ratings, duplicate targets,
non-members, scores outside 1-5, comments over 500 characters, suspended
raters, and expired windows are rejected.

To file a conduct complaint:

```http
POST /api/rides/<rideId>/complaints
Content-Type: application/json
Cookie: <rider-session>

{
  "occupantId": "<owner-seat-id>",
  "category": "conduct",
  "description": "Description of the incident"
}
```

Expected result: `201 { "reference": "..." }`. The complaint is committed
before optional Gemini analysis begins, so an AI timeout cannot erase the
complaint. Complaint analysis is advisory and an admin makes any enforcement
decision.

## Phase 10: demonstrate the agentic AI integration

The D2 demonstration should show that AI assists the workflow without bypassing
server authorization or human control. The implementation has three AI paths.

### A. AI-ranked ride recommendations

From the rider session, request recommendations:

```http
POST /api/rides/recommendations
Content-Type: application/json
Cookie: <rider-session>

{
  "direction": "to_hub",
  "hubId": "kanpur-central",
  "departureStart": "<future ISO timestamp>",
  "departureEnd": "<later future ISO timestamp>",
  "vehicleTypeId": "car",
  "maxFareShare": 500
}
```

Expected behavior:

- Deterministic eligibility rules retrieve the candidate rides first.
- The ranking pipeline validates the returned ordering and recommendation
  shape before the response is exposed.
- If Gemini is unavailable or returns unusable output, a deterministic
  fallback is used rather than an unvalidated ranking.
- The request and outcome are recorded in the recommendation audit trail.

Record `requestId` from the response. If a recommendation was useful, submit:

```http
POST /api/rides/recommendations/feedback
Content-Type: application/json
Cookie: <rider-session>

{
  "requestId": "<requestId>",
  "rideId": "<rideId>",
  "value": "helpful"
}
```

The rider can report a wrong or inappropriate result through the report route.
These operations record feedback/report data and do not mutate the ride.

### B. Natural-language chatbot and confirmed preference proposal

Ask the chatbot for ride assistance:

```http
POST /api/chatbot
Content-Type: application/json
Cookie: <rider-session>

{
  "message": "Find me a ride to Kanpur Central tomorrow morning"
}
```

Expected behavior:

- The message is length-limited and rate-limited.
- The chatbot can invoke only server-side allow-listed tools.
- Ride/profile data access remains subject to the rider's authorization scope.
- The response identifies whether it was AI-generated or deterministic fallback
  using fields such as `aiGenerated` and `aiFallback`.
- Chatbot requests and tool/audit metadata are recorded without giving the
  model direct database mutation authority.

If the chatbot proposes a profile preference, the proposal is not persisted
automatically. Confirm the proposal explicitly:

```http
POST /api/chatbot/confirm-preference
Content-Type: application/json
Cookie: <rider-session>

{ "proposalId": "<proposalId>" }
```

Expected result: the proposal is checked for ownership and expiry, then the
preference is persisted only after explicit confirmation.

### C. Advisory complaint analysis and human enforcement

After the complaint in Phase 9 is committed:

1. The server schedules complaint analysis asynchronously.
2. Complaint text is redacted for email addresses and contiguous 10-digit
   numbers before it is sent to Gemini.
3. The response is validated for category, recommendation, confidence, and
   required fields.
4. Invalid, unavailable, timed-out, or low-confidence analysis is routed to
   manual review.
5. An Operations Admin reviews the recommendation through the admin complaint
   workflow.
6. The admin approves, rejects, or overrides the recommendation.
7. Only the admin action can create a warning, suspension, or no-action result.

The evidence should show the complaint reference, the AI recommendation/audit
record, and the final human decision. A resolved complaint cannot receive a
new enforcement decision.

## Phase 11: optional SOS demonstration

During `pickup_in_progress` or `in_transit`, an occupant can raise an SOS:

```http
POST /api/rides/<rideId>/sos
Cookie: <rider-session>
```

Expected result:

- `201` with a new incident, or `200` with the already-active incident.
- The stored incident contains an immutable trip/context snapshot.
- The incident is not broadcast to the rest of the ride pool.

The raiser can add location or mark a false alarm:

```http
PATCH /api/sos/<incidentId>
Content-Type: application/json
Cookie: <rider-session>

{
  "latitude": 26.5123,
  "longitude": 80.2321,
  "accuracy": 20
}
```

An admin monitors and updates the incident:

```http
GET /api/admin/incidents/open
Cookie: <admin-session>

PATCH /api/admin/incidents/<incidentId>
Content-Type: application/json
Cookie: <admin-session>

{ "action": "acknowledge" }
```

Then close it:

```http
{
  "action": "close",
  "note": "Incident reviewed and resolved."
}
```

Admin incident actions are audited, and closed incidents cannot be changed.

## Source-audit implementation notes

- The ride lifecycle is transaction-oriented, but not every read route uses a
  single explicit transaction.
- Chat has a stricter server-facing 500-character limit than the database's
  1000-character storage constraint.
- The database schema is migration-compatible and must be applied in full.
- The current active-SOS partial-index predicate appears ineffective, so the
  application/domain checks remain important for duplicate active-incident
  behavior.
- Realtime session and membership checks are repeated during room use; a stale
  socket can remain until a subsequent validation/emission detects it.

## Demonstration evidence checklist

Capture the following for the D2 demonstration:

- Application readiness response from `/api/health`.
- Owner and rider dashboard/profile screens.
- Created ride in `scheduled`.
- Pending request and owner acceptance.
- Locked ride and visible fixed shares.
- Pickup/trip state changes and rider check-in.
- Completed ride with final shares.
- Settlement transition (`due` to `paid` to `confirmed` or `disputed`).
- Rating result and complaint reference.
- Optional SOS incident and admin acknowledgement/closure.
- Notifications generated at each relevant transition.

Do not capture passwords, session cookies, Gemini keys, mail secrets, or
database credentials in screenshots or submitted evidence.

## Implementation references

- API route handlers: [`apps/web/src/app/api/`](../../apps/web/src/app/api/)
- Ride request transactions: [`join-requests.ts`](../../apps/web/src/lib/join-requests.ts)
- Trip transactions: [`trip.ts`](../../apps/web/src/lib/trip.ts) and
  [`trip-api.ts`](../../apps/web/src/lib/trip-api.ts)
- Payment settlement: [`payment-settlement.ts`](../../apps/web/src/lib/payment-settlement.ts)
- Ride rules: [`ride-rules.ts`](../../apps/web/src/lib/ride-rules.ts)
- Trip rules: [`trip-rules.ts`](../../apps/web/src/lib/trip-rules.ts)
- Database invariants: [`schema.sql`](../../apps/web/db/schema.sql)
