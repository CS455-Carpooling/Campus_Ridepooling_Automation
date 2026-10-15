# Campus Ride-Pooling API Documentation

This document describes the implemented HTTP API for the Campus Ride-Pooling and
Split-Fare System. It was regenerated after a complete source-only audit of the
repository and covers the 48 non-test route-handler files and 53 implemented
HTTP route methods under
[`apps/web/src/app/api/`](../../apps/web/src/app/api/) and the shared
authentication, authorization, domain-rule, transaction, notification, and
database modules they call.

## Complete source audit provenance

Before regenerating this document, every included implementation and executable
configuration file was read completely:

| Scope | Files | Lines |
|---|---:|---:|
| Complete implementation/configuration source set | 269 | 36,217 |
| Unread included files | 0 | 0 |

The audit explicitly excluded 204 test/specification files, one lockfile, and
177 documentation, diagram, binary, generated, or non-executable metadata
files. No excluded file is used as API evidence.

The API is served by the Next.js application at the same origin as the web
application. Unless stated otherwise, JSON request and response bodies use
`Content-Type: application/json`.

## Running the API locally

Follow the root [README](../../README.md) or the detailed
[web setup guide](../../apps/web/setup.md). The development API base URL is:

```text
http://localhost:3000/api
```

For Docker Compose, use the same base URL after the `web` service becomes
healthy. Check readiness with `GET /api/health`.

## Cross-cutting behavior

### Authentication and sessions

- Browser authentication uses a server-managed, HTTP-only session cookie.
- Most authenticated routes return `401` when there is no valid session.
- State-changing browser requests require a same-origin request.
- Login refuses unverified accounts.
- Sessions expire after seven days without activity.
- A student with an unacknowledged warning is redirected/blocked until the
  warning is acknowledged, except for the warning-acknowledgement flow itself.
- Roles are `student` and `admin`. A student account can both offer and request
  rides; admin APIs require the `admin` role.

### Standard error shape

The implementation normally returns an object containing an `error` message and
often a stable `code`:

```json
{
  "error": "Human-readable explanation",
  "code": "stable_machine_code"
}
```

Some validation responses contain field-level details, and some deliberately
return a generic response to avoid account or ride existence disclosure. The
status code and route-specific `code` are authoritative.

### Ride identifiers and occupant identifiers

- `id` and `rideId` are ride UUIDs.
- `requestId` is a join-request UUID.
- `occupantId` is the ride-scoped seat UUID, not a user UUID.
- `messageId`, `incidentId`, `notificationId`, and similar values are UUIDs
  unless the route describes a different format.

### Authorization model

The server checks ownership and membership even when the UI hides an action:

- Ride-owner actions require `rides.owner_id` to match the current user.
- Rider actions require an active seat in `riders`.
- Admin mutations are audited.
- Non-members may receive `404` rather than a permission response where hiding
  ride existence is required.
- Suspended riders cannot offer rides, submit/accept join requests, or rate
  others, but can still file complaints and raise SOS alerts.

## Authentication API

### `POST /api/auth/register`

Creates or resumes an IITK account registration.

Request body:

```json
{
  "email": "student@iitk.ac.in",
  "name": "Student Name",
  "roll": "220000",
  "password": "a-password",
  "terms": true
}
```

The email domain must be exactly `iitk.ac.in`; the password, name, roll, terms,
and account state are validated by the authentication rules.

Responses:

- `200 { "ok": true }` for a valid registration request. The response is
  intentionally not an account-existence oracle.
- `400` for invalid input.
- `429` for registration rate limiting.

Implementation: [`register/route.ts`](../../apps/web/src/app/api/auth/register/route.ts).

### `POST /api/auth/login`

Signs in an account.

Request body:

```json
{
  "email": "student@iitk.ac.in",
  "password": "a-password",
  "remember": true
}
```

Responses:

- `200 { "ok": true }` and a session cookie.
- `401` for invalid credentials.
- `403` for an unverified account.
- `429` for rate limiting.

Implementation: [`login/route.ts`](../../apps/web/src/app/api/auth/login/route.ts).

### `POST /api/auth/forgot`

Starts password recovery.

Request body:

```json
{ "email": "student@iitk.ac.in" }
```

The route returns `200 { "ok": true }` for validly shaped requests whether or
not the account exists, preventing account enumeration. It returns `429` only
when rate limiting applies.

Implementation: [`forgot/route.ts`](../../apps/web/src/app/api/auth/forgot/route.ts).

### `POST /api/auth/reset`

Consumes a single-use reset token.

Request body:

```json
{
  "token": "reset-token",
  "password": "a-new-password"
}
```

Returns `200 { "ok": true }` on success and invalidates existing sessions.
Invalid or expired tokens and invalid passwords return `400`.

Implementation: [`reset/route.ts`](../../apps/web/src/app/api/auth/reset/route.ts).

### `GET /api/auth/verify?token=<token>`

Consumes a single-use email-verification token. On success it returns a `303`
redirect to `/login?notice=verified`; failure redirects to
`/login?notice=verify_failed`.

Implementation: [`verify/route.ts`](../../apps/web/src/app/api/auth/verify/route.ts).

### `POST /api/auth/logout`

Destroys the current session and returns a `303` redirect to the login page.
Invalid same-origin requests return `403`.

Implementation: [`logout/route.ts`](../../apps/web/src/app/api/auth/logout/route.ts).

## Profile, warnings, and account data

### `GET /api/profile`

Returns the authenticated user's profile:

```json
{ "profile": { "...": "profile fields" } }
```

Returns `401` without a session and `404` when the profile cannot be found.

### `PUT /api/profile`

Updates profile and preference fields, including display name, mobile number,
campus pickup location, interest tags, preferred vehicle, fare limit, and AI-tag
consent. The route validates referenced active configuration records and returns:

```json
{ "ok": true }
```

Invalid values return `400`; unauthenticated requests return `401`.

### `GET /api/profile/export`

Returns a downloadable JSON export containing the authenticated account,
profile, and ride data. It never exports another user's data.

### `POST /api/profile/delete`

Request body:

```json
{ "confirmation": "DELETE" }
```

The route anonymizes the account, removes sessions/tokens, and returns
`{ "ok": true }`. It returns `400` for the wrong confirmation, `401` without
authentication, and `409` while active rides or waiting requests prevent safe
deletion.

### `POST /api/warnings/[id]/acknowledge`

Acknowledge the caller's warning. The operation is idempotent:

```json
{ "acknowledged": true }
```

It returns `404` for a warning that is not owned by the caller, `409` for an
invalid state, and `401` without authentication.

### `GET /api/me/ride-requests`

Returns the authenticated rider's current and historical join requests:

```json
{ "requests": [ "...request records and history..." ] }
```

Failures return `401` or `500` with `code: "ride_requests_fetch_failed"`.

## Ride discovery and ride-owner API

### `POST /api/rides`

Creates a scheduled ride and the owner's ride-scoped seat.

Request body:

```json
{
  "direction": "to_hub",
  "hubId": "kanpur-central",
  "campusLocationId": "hall-5",
  "vehicleTypeId": "car",
  "departureStart": "2026-10-16T08:00:00.000Z",
  "departureEnd": "2026-10-16T08:30:00.000Z",
  "expectedTotalFare": 400
}
```

The exact accepted direction and identifiers come from the active database
configuration. The server re-reads and validates the hub, campus location, and
vehicle type; it does not trust client capacity values.

Success:

```json
{ "ride": { "id": "ride-uuid", "state": "scheduled" } }
```

Status codes include `201` success, `400` validation, `403` suspension,
`409` overlapping/conflicting ride, and `500` database failure.

### `GET /api/rides/[id]`

The ride page uses server-side data loading for ride details. Visibility is
limited to the owner, active members, or eligible students before lock; hidden
rides are represented as not found.

### `PATCH /api/rides/[id]`

Request body selects an owner action:

```json
{
  "action": "edit",
  "departureStart": "2026-10-16T08:15:00.000Z",
  "departureEnd": "2026-10-16T08:45:00.000Z",
  "expectedTotalFare": 450,
  "confirmAffectedRiders": true
}
```

or:

```json
{ "action": "cancel" }
```

Edits can change the departure window, capacity, fare, direction, or hub,
subject to lock, state, conflict, and affected-rider confirmation rules.
Success returns `{ "ride": ... }`; invalid input, ownership, not-found,
locked/closed state, conflicts, or missing confirmation return `400`, `403`,
`404`, or `409` as applicable.

### `POST /api/rides/[id]/requests`

Creates a rider join request:

```json
{
  "pickupLocationId": "hall-5",
  "idempotencyKey": "client-generated-unique-key"
}
```

The transaction locks the rider and ride, validates active configuration,
checks suspension, payment overdue state, capacity, lock time, travel conflict,
request limits, and duplicate active requests. A new request returns `201
{ "request": ... }`; replaying the same idempotency key returns the existing
request with `200`. Rejections use `400`, `403`, `404`, `409`, `429`, or `500`.

### `GET /api/rides/[id]/requests`

Returns role-specific request data:

- The owner receives pending/reconfirmation requests and permitted rider
  details.
- A rider receives their own current request and history.

Success:

```json
{ "role": "owner", "requests": [ "...request records..." ] }
```

Unauthorized or hidden rides return `401` or `404`.

### `PATCH /api/rides/[id]/requests/[requestId]`

Request body:

```json
{ "action": "accept" }
```

Supported actions are `accept`, `reject`, `reconfirm`, `decline`, `withdraw`,
and `leave`; `confirmLate: true` may be required for a late leave.

- `accept` is owner-only and rechecks capacity, state, suspension, conflict,
  and request status in a transaction.
- `reject` is owner-only.
- `reconfirm`, `withdraw`, and `leave` are request-rider actions.
- `leave` after lock can require confirmation and preserves the payable locked
  share.

Success returns `{ "result": ... }`; invalid transitions return `409`.

### `POST /api/rides/[id]/lock`

Owner-only explicit lock. It fixes fare shares for active seats, copies the
shares to accepted requests, expires pending/reconfirmation requests, and
notifies affected riders.

Success:

```json
{ "rideId": "ride-uuid", "locked": true }
```

### `POST /api/rides/recommendations`

This endpoint returns AI-ranked eligible rides. The request includes search
filters such as direction, hub or campus identifiers, ISO departure range,
optional vehicle, and maximum fare share (`maxFareShare`). It returns recommendation metadata and
results. Invalid input is `400`, unauthenticated requests are `401`, and the
rolling rider quota returns `429`.

### `POST /api/rides/recommendations/feedback`

Request body:

```json
{
  "requestId": "recommendation-request-uuid",
  "rideId": "ride-uuid",
  "value": "helpful"
}
```

`value` is `helpful` or `not_helpful`. Success returns
`{ "success": true }` with `201`; malformed, unavailable, or duplicate
feedback returns `400` or `409`.

### `POST /api/rides/recommendations/report`

Request body:

```json
{
  "requestId": "recommendation-request-uuid",
  "rideId": "ride-uuid",
  "reason": "wrong"
}
```

`reason` is `wrong` or `inappropriate`. Success returns
`{ "success": true }` with `201`.

## Ride lifecycle, trip, chat, settlement, ratings, complaints, and SOS

### `POST /api/rides/[id]/check-in`

A seated rider checks in from lock until the trip starts. The owner cannot use
the rider check-in path.

Success:

```json
{ "seat": { "...seat fields..." } }
```

Invalid timing returns `409` with codes such as `not_open`, `owner_seat`, or
`no_show`.

### `POST /api/rides/[id]/arrivals`

Owner-only pickup update:

```json
{
  "occupantId": "seat-uuid",
  "status": "arrived"
}
```

`status` is `arrived`, `not_arrived`, or `no_show`. A no-show requires the
estimated pickup time plus the five-minute grace period; an early request
returns `409` and may include `availableAt`.

### `GET /api/rides/[id]/trip`

Authenticated ride members receive:

```json
{ "state": "pickup_in_progress", "stamp": "timestamp-or-version" }
```

Non-members receive `404`.

### `POST /api/rides/[id]/trip`

Owner-only state transition:

```json
{ "to": "pickup_in_progress" }
```

Allowed targets are `pickup_in_progress`, `in_transit`, and `completed`.
Transitions are serialized by locking the ride row. Invalid transitions,
unlocked pickup, cancellation, and completion conflicts return `409`.

### `POST /api/rides/[id]/complete`

Equivalent to the completed trip transition. It stores completion time,
immutable final shares, accepted-request completion, notifications, and the
72-hour rating window. Success returns a ride summary including `id`, `state`,
`completedAt`, and `ratingClosesAt`.

### `GET /api/rides/[id]/chat`

Ride members receive the private ride thread. A ride that is not open, has
expired retention, or is cancelled can return a successful response with
`thread: null` and an explanatory message. Non-members receive `404`.

### `POST /api/rides/[id]/chat`

The HTTP route supports the implemented chat action, including reporting a chat
message:

```json
{
  "action": "report",
  "messageId": "message-uuid",
  "reason": "inappropriate"
}
```

The route enforces authenticated ride membership, message length/rate rules, and
the current chat lifecycle. A report returns
`{ "reference": "chat-xxxxxxxx" }`. The custom Socket.IO server also exposes
authenticated realtime delivery and persistence; clients should use the
documented application chat flow rather than bypassing its membership checks.

### `POST /api/rides/[id]/settlements/[occupantId]`

Before a rider can pay, the ride must be completed and a final share must
exist.

Rider payment:

```json
{
  "action": "paid",
  "method": "upi",
  "reference": "optional-reference"
}
```

`method` is `upi` or `cash`; references are limited to 50 characters.

Owner confirmation or rider dispute:

```json
{ "action": "confirm" }
```

or:

```json
{ "action": "dispute" }
```

Success returns `{ "status": ... }`. Actor, state, share, and validation
failures return `400`, `403`, `404`, or `409`.

### `POST /api/rides/[id]/ratings`

Request body:

```json
{
  "ratings": [
    { "occupantId": "seat-uuid", "score": 5, "comment": "Optional comment" }
  ]
}
```

The ride must be completed and inside the 72-hour rating window. Targets must
be other occupants, scores are integers from 1 to 5, comments are optional and
limited to 500 characters, and duplicate targets are rejected. Success returns
`201 { "rated": 1 }` (with the actual count).

### `POST /api/rides/[id]/complaints`

Request body:

```json
{
  "occupantId": "seat-uuid",
  "category": "conduct",
  "description": "Description of the incident",
  "messageId": "optional-chat-message-uuid"
}
```

The accused and complainant must be occupants; self-complaints and invalid
message references are rejected. Ride complaints require a completed ride and
are accepted for seven days. The daily limit is five and duplicate conduct
complaints are rejected. Success returns an opaque `{ "reference": "..." }`
with `201`. The complaint is committed before asynchronous AI analysis starts.

### `POST /api/rides/[id]/sos`

An owner or seated rider can raise SOS during `pickup_in_progress` or
`in_transit`. No body is required. A newly created incident returns `201
{ "incident": ... }`; an already-active incident returns `200` with the
existing incident. Suspensions do not block SOS.

### `PATCH /api/sos/[id]`

Only the incident raiser can update an open incident:

```json
{ "latitude": 26.5123, "longitude": 80.2321, "accuracy": 20 }
```

or:

```json
{ "falseAlarm": true }
```

Closed incidents return `409`; hidden/not-owned incidents return `404`.

## Chatbot and AI APIs

The application includes three distinct AI-assisted workflows:

1. **Ride recommendations** rank eligible rides after deterministic candidate
   retrieval and rule validation.
2. **The rider chatbot** uses Gemini-backed natural-language interaction with
   server-side allow-listed tools for ride/profile assistance.
3. **Complaint analysis** produces an advisory enforcement recommendation for
   Operations Admin review.

AI is not granted direct authority to change rides, payments, complaints, or
enforcement records. Model output is validated, audited, and subject to
deterministic fallback/manual-review behavior. Gemini credentials remain
server-side; the relevant configuration is documented in
[`apps/web/setup.md`](../../apps/web/setup.md).

### `POST /api/chatbot`

Request body:

```json
{ "message": "Find me a ride to Kanpur Central tomorrow morning" }
```

Messages are limited to 500 characters. The response contains the assistant
message plus request and provenance fields such as `requestId`, `aiGenerated`,
and `aiFallback`. Invalid input returns `400`, unauthenticated requests return
`401`, quota exhaustion returns `429`, and provider timeout/failure can return
`503` or `504`.

The chatbot can invoke only server-side allow-listed operations. Preference
changes are proposals and are not persisted until confirmed.

The response and audit pipeline records provenance such as whether the response
was model-generated or deterministic fallback, request identifiers, validation
outcome, latency, and model usage metadata. A provider timeout, unavailable
key, invalid model output, or rate limit does not authorize an unvalidated
action.

### `POST /api/chatbot/confirm-preference`

Request body:

```json
{ "proposalId": "proposal-uuid" }
```

Returns `{ "success": true, "message": "..." }` after validating ownership,
expiry, and the proposal. Invalid or failed proposals return `400`.

## Notifications

### `GET /api/notifications`

Query parameters:

- `limit`: integer from 1 to 100.
- `offset`: integer from 0 to 1,000,000.

Success:

```json
{
  "notifications": [ "...caller-owned notifications..." ],
  "pagination": { "...pagination metadata..." }
}
```

Invalid pagination returns `400`; unauthenticated and database failures return
`401` and `500`.

### `PATCH /api/notifications/[id]`

Marks a notification owned by the caller as read:

```json
{ "notification": { "id": "notification-uuid", "readAt": "timestamp" } }
```

Invalid or non-owned notifications return `404`.

## Operations administration APIs

Every admin mutation is role-protected, same-origin/rate-limited, transactional
where applicable, and written to the admin audit log.

### Incidents and chat reports

| Method and path | Request | Success |
|---|---|---|
| `GET /api/admin/incidents/open` | No body | Open incident summaries; `200` |
| `PATCH /api/admin/incidents/[id]` | `{ "action": "acknowledge" }` | Incident; `200` |
| `PATCH /api/admin/incidents/[id]` | `{ "action": "close", "note": "..." }` | Incident; `200` |
| `GET /api/admin/chat-reports` | No body | Open chat reports; `200` |
| `PATCH /api/admin/chat-reports` | `{ "reference": "chat-xxxxxxxx" }` | `{ "reference": "...", "status": "resolved" }`; `200` |

Incident close notes are validated. Closed incidents and already-resolved
reports return `409`; non-admin callers receive `401` or `403`.

### Complaints, AI decisions, and enforcement

| Method and path | Request | Success |
|---|---|---|
| `PATCH /api/admin/complaints/[id]` | `{ "status": "...", "actionTaken": "...", "note": "...", "version": 1 }` | Complaint; `200` |
| `POST /api/admin/complaints/[id]/ai-decision` | `{ "analysisId": "...", "decision fields..." }` | Decision; `201` |
| `POST /api/admin/riders/[id]/warnings` | `{ "reason": "...", "complaintId": "optional" }` | Warning; `201` |
| `POST /api/admin/riders/[id]/suspensions` | `{ "reasonCategory": "...", "reason": "...", "days": 7 }` | Suspension; `201` |
| `POST /api/admin/riders/[id]/suspensions` | `{ "reasonCategory": "...", "reason": "...", "indefinite": true }` | Suspension; `201` |
| `POST /api/admin/riders/[id]/reactivation` | `{ "reason": "..." }` | Reactivation; `200` |

Complaint updates use optimistic `version` checking. AI decisions are advisory
and cannot apply enforcement to an already resolved complaint; invalid,
already-decided, resolved, or manual-review states return `400`, `404`, or
`409`.

#### Complaint-analysis lifecycle

```text
complaint committed
    -> asynchronous Gemini analysis (when configured)
    -> validated analysis stored with recommendation/audit metadata
    -> admin reviews recommendation
    -> admin approves, rejects, or overrides
    -> warning/suspension/no-action is applied transactionally
```

The complaint is committed before analysis starts, so Gemini latency or failure
cannot erase the report. Complaint text sent for analysis is redacted for email
addresses and contiguous 10-digit numbers. Analysis is advisory: only an
authenticated administrator can apply enforcement, and a resolved complaint
cannot receive a new enforcement decision.

### Configuration

| Method and path | Request | Success |
|---|---|---|
| `POST /api/admin/locations` | `{ "type": "campus", "name": "...", "detail": "..." }` | Location; `201` |
| `PATCH /api/admin/locations/[id]` | `{ "name": "...", "detail": "...", "isActive": true, "version": 1 }` | Location; `200` |
| `POST /api/admin/vehicle-types` | `{ "name": "Car", "capacity": 4 }` | Vehicle type; `201` |
| `PATCH /api/admin/vehicle-types/[id]` | `{ "name": "...", "capacity": 4, "isActive": true, "version": 1 }` | Vehicle type; `200` |
| `PUT /api/admin/external-fares` | `{ "hubId": "...", "vehicleTypeId": "...", "minFare": 100, "maxFare": 300, "version": 1 }` | Fare range; `200` |

Configuration writes validate identifiers, values, active-state changes, and
optimistic versions. Conflicts return `409`; only admins can mutate these
records.

## Health and scheduled operations

### `GET /api/health`

Unauthenticated readiness probe:

```json
{ "status": "ok" }
```

returns `200` when PostgreSQL is reachable, or:

```json
{ "status": "unavailable" }
```

with `503` when it is not.

### `POST /api/cron/payment-reminders`

Scheduled endpoint for due settlement reminders. It requires the configured
cron authorization secret and processes at most 500 rows per run using row
locking. Success:

```json
{ "processed": 12 }
```

Unauthorized, unconfigured, or database failures return `401`, `503`, or `500`.

## Realtime API boundary

Ride chat message delivery and notification delivery use the authenticated
Socket.IO server hosted by [`apps/web/server.mjs`](../../apps/web/server.mjs).
The HTTP chat route retrieves the thread and handles its supported action
payloads. The realtime layer additionally handles live chat delivery and
notification delivery, revalidates the session periodically, and applies
server-side identity and ride-membership checks.

## Implementation caveats

These are source-audit observations, not hidden behavior:

- The database permits stored chat messages up to 1000 trimmed characters,
  while the server-facing chat path applies a stricter 500-character limit.
- The schema is migration-compatible and includes conditional alterations, so
  `schema.sql` must be run to completion rather than treated as a small initial
  schema.
- The active-SOS partial-index predicate in the current schema appears
  ineffective (`... AND false`), so callers must not treat the database index
  alone as proof of active-incident uniqueness.
- Realtime room membership is checked when joining and when emitting; stale
  sockets are removed when the server detects invalid membership.

## AI implementation and audit trail

The source-backed AI implementation is distributed across:

- `apps/web/src/lib/ai/chatbot.ts` and `chatbot-gemini.ts` for chatbot
  orchestration and Gemini integration.
- `apps/web/src/lib/ai/chatbot-tools.ts` for the server-side tool allowlist.
- `apps/web/src/lib/ai/preference-proposals.ts` for explicit confirmation
  before profile-preference persistence.
- `apps/web/src/lib/ai/recommendation-pipeline.ts`,
  `gemini-ranking.ts`, and `validate-ranking.ts` for candidate ranking and
  output validation.
- `apps/web/src/lib/ai/chatbot-audit.ts` and
  `recommendation-audit.ts` for provenance and usage/audit records.
- `apps/web/src/lib/complaint-ai.ts` and `ai-enforcement.ts` for complaint
  analysis and human-controlled enforcement decisions.

AI audit records retain operational metadata such as request identity,
pseudonymous rider context where applicable, prompt/model versions, validation
and fallback outcomes, latency, and token usage. They do not turn model output
into an unsupervised database mutation.

## Source coverage

The route inventory covers all 48 non-test route-handler files. Tests and
documentation were not used as API evidence. Detailed end-to-end execution is
documented in [Core Workflow Demonstration](./CORE_WORKFLOW_DEMONSTRATION.md).
