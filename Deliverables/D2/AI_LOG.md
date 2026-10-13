# AI_LOG

This file records AI-assisted work performed on the repository, as required by the CS455 project workflow. Entries describe only work actually performed or decisions explicitly made in the conversation.

## 2026-10-04 — Create Ride database design review

### User request
Re-check the actual repository schema and conventions, then design—but do not implement—the database changes for Create Ride. The required tables are `locations`, `vehicle_types`, `rides`, and `riders`; existing users/authentication tables must be reused; `join_requests` must not be created. Determine keys, foreign keys, constraints, indexes, timestamp types, state representation, and initial seed data. Update this log with the prompt and resulting design decisions.

### Repository inspection performed
Reviewed the current repository's:
- `apps/web/db/schema.sql`
- `apps/web/scripts/migrate.mjs`
- `apps/web/src/lib/db.ts`
- `apps/web/src/lib/ride-options.ts`
- `apps/web/src/lib/ride-rules.ts`
- Ride Owner requirements and functional requirements under `Deliverables/D1/Requirements Engineering/users/ride_owner/`
- `Deliverables/D1/Class Diagrams/2.puml`

### Existing conventions found
- PostgreSQL is used through the `pg` package.
- Existing user/auth IDs are PostgreSQL `UUID` values using `gen_random_uuid()`.
- Existing timestamps use `TIMESTAMPTZ NOT NULL DEFAULT now()`.
- Existing schema uses inline `CHECK` constraints and `CREATE INDEX IF NOT EXISTS`.
- Existing schema does not define PostgreSQL enum types or custom database types.
- `schema.sql` is the migration source and is executed wholesale by `apps/web/scripts/migrate.mjs`; there is no numbered migration-history convention.
- Existing `ride-options.ts` uses stable text IDs such as `hall-1`, `main-gate`, `kanpur-central`, `car`, `auto`, and `vikram`, and explicitly says it should later read the seeded database tables.
- The current Ride Owner class diagram uses a `TripState` enum with `SCHEDULED`, `PICKUP_IN_PROGRESS`, `IN_TRANSIT`, `COMPLETED`, and `CANCELLED`, but the SQL schema has no enum convention.

### Database design decisions
1. `locations`
   - Primary key: `id TEXT`.
   - Rationale: the current UI/configuration already uses stable text codes and `ride-options.ts` documents those IDs as database seed IDs. This avoids an unnecessary translation layer between DB records and existing form values.
   - Columns: `id`, `name`, `detail` (nullable), `type`, `is_active`.
   - `type` is `TEXT NOT NULL CHECK (type IN ('campus', 'transport_hub'))`.
   - `is_active BOOLEAN NOT NULL DEFAULT TRUE`.
   - `name NOT NULL`.
   - `detail` is nullable because some current UI entries have a second descriptive line and some do not.

2. `vehicle_types`
   - Primary key: `id TEXT`.
   - Rationale: preserve current stable IDs (`car`, `auto`, `vikram`) used by the existing Create Ride form.
   - Columns: `id`, `name`, `capacity`, `is_active`.
   - `capacity INTEGER NOT NULL CHECK (capacity > 0)`.
   - `is_active BOOLEAN NOT NULL DEFAULT TRUE`.

3. `rides`
   - Primary key: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` to match the existing `users` UUID convention.
   - `owner_id UUID NOT NULL REFERENCES users(id)`.
   - `direction TEXT NOT NULL CHECK (direction IN ('to_hub', 'from_hub'))`, matching `ride-rules.ts` exactly.
   - `hub_id TEXT NOT NULL REFERENCES locations(id)`; backend validation must additionally ensure the referenced location has `type = 'transport_hub'` and is active.
   - `vehicle_type_id TEXT NOT NULL REFERENCES vehicle_types(id)`; backend validation must additionally ensure the referenced vehicle type is active.
   - `capacity_snapshot INTEGER NOT NULL CHECK (capacity_snapshot > 0)`; this is copied from `vehicle_types.capacity` by the backend and is never trusted from the client.
   - `departure_start TIMESTAMPTZ NOT NULL`.
   - `departure_end TIMESTAMPTZ NOT NULL`.
   - `expected_total_fare INTEGER NOT NULL CHECK (expected_total_fare > 0)`; whole-rupee integer matches the existing `ride-rules.ts` contract. The existing application rule also caps this at ₹50,000, but that application-level limit is not embedded in the DB design because the current schema does not establish application business limits as database checks.
   - `state TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'pickup_in_progress', 'in_transit', 'completed', 'cancelled'))`.
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
   - Add `CHECK (departure_start < departure_end)`.
   - No separate vehicle table is introduced; current Create Ride requirements specify vehicle type + capacity, and the user explicitly requested `vehicle_types` rather than individual vehicles.

4. `riders`
   - Primary key: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (`rider_id` in the requested model).
   - `ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE`.
   - `user_id UUID NOT NULL REFERENCES users(id)`.
   - `campus_location_id TEXT NOT NULL REFERENCES locations(id)`; backend validation must additionally ensure this location has `type = 'campus'` and is active.
   - `UNIQUE (ride_id, user_id)` prevents the same user from being added to the same ride more than once.
   - The owner should be represented as a row in `riders` for the newly created ride so that the owner's ride-scoped campus location is stored in exactly the same model as every other participant. This follows directly from the requested schema because `rides` has no owner campus-location column.

### Foreign-key deletion policy
- User references are intentionally not `ON DELETE CASCADE` because ride history should not disappear merely because a user record is removed. Existing auth tables use cascade for session/token data, but ride records are domain/history data.
- `riders.ride_id -> rides.id` uses `ON DELETE CASCADE` because riders are ride-scoped records and have no meaning without their ride.
- Location and vehicle-type references should use the default restrictive/no-action behavior rather than cascade. Records are deactivated with `is_active`; referenced configuration should not be physically deleted while historical rides depend on it.

### Indexes proposed
- `rides_owner_departure_idx` on `(owner_id, departure_start)` to support the owner's active/scheduled ride conflict lookup.
- `rides_hub_departure_idx` on `(hub_id, departure_start)` to support future ride search by destination and departure window.
- `rides_state_departure_idx` on `(state, departure_start)` to support filtering active/scheduled rides by time.
- `riders_ride_idx` on `(ride_id)` to efficiently retrieve participants for a ride. The `(ride_id, user_id)` unique constraint already provides a useful composite index for duplicate checks.
- No index is required solely for `locations.type` or `vehicle_types.is_active` at the current scale; these are small configuration tables and will normally be read in full or by primary key.

### State representation decision
Use `TEXT + CHECK`, not a PostgreSQL enum. The repository has no SQL enum/custom-type convention, while the existing class diagram uses a conceptual enum. A text check preserves the repository's current SQL style and keeps future state changes manageable without `ALTER TYPE` operations.

Initial state for a newly created ride is `scheduled`, corresponding to the existing D1 requirement that a valid new ride is created in the `Scheduled` state.

### Initial seed data
Seed the following records as active:

Campus locations:
- `hall-1` through `hall-14`
- `main-gate`

Transport hubs:
- `kanpur-central` — Kanpur Central — Railway station
- `kanpur-anwarganj` — Kanpur Anwarganj — Railway station
- `bus-stand` — Bus stand — Kanpur
- `metro-station` — Metro station — Kanpur Metro
- `kanpur-airport` — Kanpur airport — Airport
- `lucknow-airport` — Lucknow airport — Airport

Vehicle types:
- `car` — Car — capacity 4
- `auto` — Auto — capacity 3
- `vikram` — Vikram — capacity 7

These values are taken from the existing `ride-options.ts` rather than invented. Capacities are marked there as tentative; therefore they should remain easy to change through seed/configuration data.

### Important unresolved/explicitly bounded points
- The repository requirements still describe a generic fixed vehicle capacity, while the newer Create Ride design requires capacity to come from `vehicle_types`. This design follows the newer explicit project decision and stores a `capacity_snapshot` on each ride.
- The D1 class diagram includes `IN_TRANSIT` in the lifecycle and the current `ride-rules.ts` only concerns creation; the state list above follows the class-diagram lifecycle for now. No additional state beyond those documented values was invented.
- The database alone cannot enforce that `rides.hub_id` points only to a `transport_hub` or that `riders.campus_location_id` points only to a `campus` row with ordinary foreign keys. The Create Ride backend must validate the location category and active status before insertion. The same applies to active vehicle types.
- The owner-overlap rule is a business/concurrency rule, not fully captured by the basic indexes above. Its transactional enforcement will be designed with the Create Ride API implementation; no `join_requests` table is part of this design.

### Work actually performed
- Re-inspected the repository schema and relevant conventions.
- Designed the four requested tables and their constraints/indexes conceptually.
- Updated this `AI_LOG.md` with the prompt and design decisions.
- No application/database implementation code was changed in this step.

## 2026-10-04 — Create Ride database implementation

### User request
Implement the agreed Create Ride database design, including `locations`, `vehicle_types`, `rides`, and `riders`, constraints, indexes, and initial seed/configuration data. Do not add `join_requests` or modify unrelated database parts. Inspect and verify the resulting schema, run the repository's available migration/database checks and relevant tests, fix introduced errors, and update this log. Also move the Create Ride-specific AI log from the repository root to a more suitable location.

### Files changed
- `apps/web/db/schema.sql` — **edited**. Added the four agreed Create Ride tables, their constraints and indexes, and initial configuration seed data. Existing `users`, `sessions`, `auth_tokens`, and `rate_limits` definitions were preserved.
- `apps/web/db/create-ride/AI_LOG.md` — **moved from repository root `AI_LOG.md`** and updated with this implementation entry. This is now the ongoing AI log location for the Create Ride backend/database work.

No new database schema/migration file was created. `apps/web/scripts/migrate.mjs` was inspected and left unchanged because it already executes `apps/web/db/schema.sql` wholesale.

### Database implementation
Implemented:
- `locations` with text IDs, name, optional detail, location type (`campus` or `transport_hub`), and active flag.
- `vehicle_types` with text IDs, name, positive capacity, and active flag.
- `rides` with UUID ID, owner FK to `users`, direction check, hub FK, vehicle type FK, capacity snapshot, departure window, positive integer total fare, documented lifecycle state check, created timestamp, and departure-window validity check.
- `riders` with UUID ID, ride FK with `ON DELETE CASCADE`, user FK, campus-location FK, and a unique `(ride_id, user_id)` constraint preventing duplicate participation in one ride.
- Ride indexes for owner/departure, hub/departure, and state/departure lookups.
- Rider index for `ride_id`.
- Initial active campus locations (`hall-1` through `hall-14`, `main-gate`), transport hubs, and vehicle types (`car`, `auto`, `vikram`) using the stable IDs already used by the Create Ride UI.
- Seed statements are idempotent through `ON CONFLICT (id) DO NOTHING`.

### Seed detail handling
Transport-hub `detail` values are populated to match the existing Create Ride options (`Railway station`, `Kanpur`, `Kanpur Metro`, `Airport`). This keeps the DB-backed options aligned with the current UI data while retaining the agreed configurable location model.

### Verification performed
- Re-read the resulting `apps/web/db/schema.sql` after writing it.
- Ran a static schema verification script that passed: all four requested tables, the agreed constraints, all four agreed indexes, and all initial seed categories/values were present, and `join_requests` was absent.
- Ran `node --check apps/web/scripts/migrate.mjs`; the existing migration runner has valid JavaScript syntax.
- Verified the existing auth/rate-limit definitions remain in `schema.sql`; no unrelated application database tables were added.
- Attempted `npm test`. It could not start because the repository's installed dependencies do not contain the `vitest` executable (`vitest: not found`).
- Attempted `npm ci --offline` to restore the test dependencies, but the local npm cache does not contain the required `zod-validation-error` package archive, so dependency installation could not be completed in this environment. A previous normal `npm ci` attempt also timed out while trying to install dependencies.
- Attempted the repository migration command with `npm run db:migrate --workspace @ridepool/web`. It could not start because the partial dependency state did not provide the `pg` package to the migration runner. There is also no configured `DATABASE_URL`/running PostgreSQL instance available in this environment. Therefore the SQL could not be executed against a real PostgreSQL database here; no claim of a successful live migration is being made.
- No test or migration failure was caused by the SQL itself during execution; the available environment prevented the test runner and migration runner from starting. The static schema checks passed after the implementation was corrected.

### UI follow-up
The database seed IDs intentionally match the current hardcoded Create Ride options. The UI is **not** changed in this database-only task. The intended subsequent change is for `getRideFormOptions()` to query active `locations` and `vehicle_types` instead of using the current hardcoded arrays.


## 2026-10-04 — Create Ride backend/API design (no implementation)

### User request
Inspect the actual repository after the database changes, especially existing API/backend and authentication conventions, and design the Create Ride backend contract and implementation plan. The intended endpoint is `POST /api/rides`. The backend must authenticate the current owner, validate all fields server-side, validate active/appropriate locations and vehicle type, enforce the existing departure/fare rules, derive capacity from `vehicle_types`, prevent overlapping active/scheduled rides, create a `scheduled` ride, snapshot capacity, and return clear success/error responses. Do not implement rider joining or fare splitting. Update this AI log, but do not implement the API yet.

### Repository inspection performed
Inspected:
- `apps/web/src/app/api/auth/*/route.ts` for API response and request parsing conventions.
- `apps/web/src/lib/auth.ts` for `json`, `readJson`, same-origin/rate-limit `guard`, and the actual cookie-backed `getCurrentUser()` session lookup.
- `apps/web/src/lib/session.ts` for the separate page-session/development-session convention.
- `apps/web/src/lib/db.ts` for the shared PostgreSQL pool.
- `apps/web/src/lib/ride-rules.ts` and its tests for the existing Create Ride request shape and validation rules.
- `apps/web/src/lib/ride-options.ts` and Create Ride picker components for the current UI fields and stable IDs.
- `Deliverables/D1/Sequence Diagrams/ride_owner/1.puml` and Ride Owner requirements/use cases for the intended authorization, validation, conflict-check, and Scheduled-state flow.
- `apps/web/db/schema.sql` for the implemented `locations`, `vehicle_types`, `rides`, and `riders` schema.

### Proposed API contract
Endpoint: `POST /api/rides`

Request JSON body:
```json
{
  "direction": "to_hub",
  "hubId": "kanpur-central",
  "campusLocationId": "hall-6",
  "vehicleTypeId": "car",
  "departureStart": "2026-10-10T06:30:00+05:30",
  "departureEnd": "2026-10-10T07:30:00+05:30",
  "expectedTotalFare": 460
}
```

The request does **not** include owner ID or capacity. Owner identity comes from the authenticated session, and capacity is read from `vehicle_types`.

Success: HTTP `201 Created`, using the repository's `json()` helper and returning the created ride's persisted values, including its generated ID, owner ID, direction, hub ID, vehicle type ID, capacity snapshot, departure window, expected total fare, `scheduled` state, and created timestamp. The owner rider row can be represented by its generated rider ID if the response needs to expose the created participant; otherwise it remains an internal persistence detail.

Suggested success shape:
```json
{
  "ride": {
    "id": "<uuid>",
    "ownerId": "<uuid>",
    "direction": "to_hub",
    "hubId": "kanpur-central",
    "vehicleTypeId": "car",
    "capacity": 4,
    "departureStart": "2026-10-10T06:30:00+05:30",
    "departureEnd": "2026-10-10T07:30:00+05:30",
    "expectedTotalFare": 460,
    "state": "scheduled",
    "createdAt": "<timestamp>"
  }
}
```

Validation error: HTTP `400`, with a field-error map compatible with the existing `RideErrors` shape.
```json
{
  "error": "Validation failed.",
  "errors": {
    "departureStart": "The ride locks an hour before it leaves, so start at least 1 hour from now."
  }
}
```

The server should return all independently detectable field errors together, using the existing `validateRideRequest()` messages where applicable. Database-backed option checks should distinguish invalid/inactive/wrong-category references where useful, while avoiding disclosure of unnecessary internal database details.

Authentication failure: HTTP `401` with the repository's existing simple error shape:
```json
{ "error": "Authentication required." }
```

Conflict with another non-terminal overlapping owner ride: HTTP `409`:
```json
{ "error": "You already have a scheduled or active ride that overlaps this departure window." }
```

Unexpected database/server failure: HTTP `500` with a generic error message; detailed database errors must not be returned to the client.

### Authentication design
Use the actual cookie-backed `getCurrentUser()` from `apps/web/src/lib/auth.ts` for the API, rather than trusting an owner ID supplied by the client. The existing `sessions` table stores a hash of the httpOnly session cookie and `getCurrentUser()` resolves that cookie to the `users` row. The API should reject a missing/invalid session with `401`.

For a state-changing browser POST, use the repository's existing same-origin/rate-limit guard convention (`guard`) before processing the request, subject to the final rate-limit values chosen during implementation.

Important repository inconsistency discovered: `apps/web/src/lib/session.ts` currently exposes only a development session (`DEV_SESSION_ROLE` / `DEV_SESSION_EMAIL`) and does not call `auth.ts`'s cookie-backed `getCurrentUser()`. The actual auth API creates real cookie-backed sessions. Therefore the Create Ride API should use `getCurrentUser()` and should **not** accept a client-supplied owner ID. The development-session/API integration needs to be reconciled when the UI is wired to the endpoint; it should not be silently worked around by trusting request data.

### Server-side validation flow
1. Authenticate current user.
2. Parse JSON with existing `readJson()`.
3. Load active database options for the submitted hub, campus location, and vehicle type.
4. Use `validateRideRequest()` from `ride-rules.ts` for direction, ISO-with-offset timestamps, minimum one-hour lead time, end-after-start, maximum three-hour window, and positive/whole-rupee fare limits. The validator can be fed the IDs returned from the active DB rows rather than the current hardcoded UI options.
5. Independently verify semantic DB types: `hubId` must reference an active `locations` row with `type = 'transport_hub'`; `campusLocationId` must reference an active `locations` row with `type = 'campus'`; `vehicleTypeId` must reference an active `vehicle_types` row.
6. Read `capacity` from the selected `vehicle_types` row. Never accept a frontend capacity value.
7. Start a PostgreSQL transaction. Lock the authenticated owner's `users` row with `SELECT id FROM users WHERE id=$1 FOR UPDATE` to serialize concurrent Create Ride requests for the same owner.
8. Inside that transaction, re-check for an overlapping non-terminal ride belonging to the owner using interval overlap logic: existing `departure_start < new_end` AND existing `departure_end > new_start`, with `state NOT IN ('completed','cancelled')`. This covers `scheduled`, `pickup_in_progress`, and `in_transit`.
9. If a conflict exists, roll back and return `409`.
10. Insert the ride with `state = 'scheduled'` and `capacity_snapshot = vehicle_types.capacity`.
11. Insert the owner into `riders` using the submitted `campusLocationId`. This is required by the agreed database model because the owner's ride-specific campus location is stored in the ride-scoped `riders` row.
12. Commit only after both inserts succeed.
13. Return the persisted ride as HTTP `201`.

The transaction is important: a simple pre-insert conflict query is insufficient because two simultaneous Create Ride requests from the same owner could otherwise both pass the check. Locking the owner's user row provides a per-owner serialization point without adding another database table.

### Relevant existing helpers/modules
- `apps/web/src/lib/auth.ts`: `getCurrentUser`, `readJson`, `json`, and `guard`.
- `apps/web/src/lib/db.ts`: shared `pg.Pool`.
- `apps/web/src/lib/ride-rules.ts`: `validateRideRequest`, `knownRideIds`, `RIDE_RULES`, and `RideErrors`.
- `apps/web/src/lib/ride-options.ts`: current UI option shape; should eventually be DB-backed as previously agreed, but the API should not trust this module as its source of truth.

### Files proposed for implementation (not changed in this step)
Likely new files:
- `apps/web/src/app/api/rides/route.ts` — `POST /api/rides`.
- `apps/web/src/app/api/rides/route.test.ts` — API route tests covering authentication, validation, DB option checks, conflicts, transaction/rollback, successful ride + owner-rider creation, and database failures.

Likely existing file to modify only if needed during implementation:
- `apps/web/src/lib/ride-rules.ts` — only if the current validator needs a small server-safe adjustment to cleanly consume DB-backed IDs; avoid changing its established validation semantics.

No rider-joining, join-request, or fare-splitting backend will be implemented as part of Create Ride.

### Requirements mapping / design decisions
- Authenticated owner: use session-derived `userId`; never accept `ownerId` from the body.
- Destination/location: database lookup + active/type validation.
- Direction: `to_hub | from_hub`, matching the existing UI and validator.
- Departure: preserve existing one-hour minimum lead and three-hour maximum window.
- Fare: positive whole rupees, preserving the existing `₹1`–`₹50,000` application rule.
- Vehicle capacity: authoritative DB value from `vehicle_types`; snapshot into `rides.capacity_snapshot`.
- State: always `scheduled` on successful creation.
- Owner campus location: stored as the owner's `riders.campus_location_id`.
- Overlap: block overlapping non-terminal rides for the same owner; enforce atomically with a transaction and owner-row lock.
- No `join_requests`.

### Unresolved point to preserve for implementation
The D1 sequence diagram describes an authorization service and an `OwnerID` parameter, while the current repository has no separate authorization service and has a concrete cookie-backed session lookup in `auth.ts`. The implementation should follow the actual repository authentication mechanism while preserving the requirement that only an authenticated Ride Owner can create a ride. Role-specific authorization is currently represented in `session.ts`, but the API's current `getCurrentUser()` result does not include a role. This should be resolved explicitly before implementation rather than inventing a new role column or authorization mechanism.

### Work actually performed
- Inspected the actual post-database-change repository and existing backend/auth/API conventions.
- Designed the `POST /api/rides` request/response/error contract and transactional backend flow.
- Updated this AI log with the design and identified the current authentication/session inconsistency.
- **No Create Ride API/backend implementation was performed in this step.**

## 2026-10-04 — Create Ride backend implementation

### User request
Implement the approved Create Ride backend/business logic using the repository's existing architecture. Implement `POST /api/rides`, server-side validation, authenticated owner identification, DB-backed location/vehicle validation, vehicle-capacity lookup, overlap detection, transactional ride creation, error handling, and verification. Do not implement rider joining, `join_requests`, or fare splitting.

### Files changed
- **Created:** `apps/web/src/app/api/rides/route.ts`
  - Implements `POST /api/rides`.
  - Uses the existing `getCurrentUser()`, `guard()`, `readJson()`, `json()`, `pool`, and `validateRideRequest()` conventions.
  - Authenticates the owner from the session; no client-supplied owner ID is accepted.
  - Loads only active submitted locations/vehicle types from the database.
  - Validates transport-hub vs campus-location categories.
  - Preserves the existing one-hour minimum lead time, maximum three-hour window, ISO-with-offset time format, and fare rules through `validateRideRequest()`.
  - Reads vehicle capacity exclusively from `vehicle_types.capacity`.
  - Starts a PostgreSQL transaction and locks the owner's `users` row with `FOR UPDATE` to serialize concurrent Create Ride requests from that owner.
  - Detects interval overlap against `scheduled`, `pickup_in_progress`, and `in_transit` rides.
  - Creates the ride with `scheduled` state and the DB-derived capacity snapshot.
  - Inserts the owner into `riders` with the submitted campus location so the owner's ride-specific campus location is persisted.
  - Commits only after both ride and owner-rider inserts succeed.
  - Returns `201` with the persisted ride, `400` for validation errors, `401` for missing authentication, `409` for an overlapping ride, `403/429` through the existing request guard, and a generic `500` for database/server failures.
  - Rolls back transactions on conflicts and unexpected persistence failures.

- **Created:** `apps/web/src/app/api/rides/route.test.ts`
  - Tests authentication failure.
  - Tests validation against active DB-backed options.
  - Tests wrong location category rejection.
  - Tests successful creation and use of database-derived vehicle capacity.
  - Tests owner insertion into `riders` and transaction commit.
  - Tests overlapping active/scheduled ride conflict and rollback.
  - Tests persistence failure rollback and generic `500` response.

- **Modified:** `apps/web/db/create-ride/AI_LOG.md`
  - Recorded this implementation and verification status.

No database schema files were changed in this step. No UI files were changed. No `join_requests`, joining, or fare-splitting logic was added.

### Verification performed
- Inspected the resulting backend source and test files after implementation.
- Confirmed the API uses the existing cookie-backed authentication mechanism from `apps/web/src/lib/auth.ts` rather than trusting request ownership data.
- Confirmed the request body has no capacity field and the insert uses `vehicle_types.capacity`.
- Confirmed overlap detection is transactional and serialized per owner through the `users` row lock.
- Confirmed the owner is persisted in `riders` in the same transaction as the ride.
- Attempted the repository type check with `npm run typecheck` from `apps/web`. **Could not execute because the repository dependencies are not installed; the `next` executable is unavailable.**
- Attempted to restore dependencies with `npm ci` from the repository root. **The command exceeded the available execution timeout and was terminated; dependencies therefore remained unavailable.**
- Because the required Node dependencies could not be installed, the repository's ESLint and Vitest commands could not be executed successfully in this environment. No test result has been represented as passing when it could not actually run.
- No PostgreSQL server is available in the execution environment, so the new transaction/SQL path could not be exercised against a live database here.

### Important implementation note
The existing repository has both the real cookie-backed authentication in `auth.ts` and a separate development-only page session helper in `session.ts`. The API deliberately follows the actual authentication implementation used by the login API (`getCurrentUser()`), as agreed in the design step. It does not invent a new role system or trust a client-provided owner ID.

## 2026-10-04 — Create Ride UI/database integration

### User request
Integrate the existing Create Ride UI with the database-backed Create Ride backend. Replace hardcoded locations, transport hubs, vehicle types, and capacities with backend/database data; preserve the existing picker components; connect submission to `POST /api/rides`; handle loading, success, validation errors, and server errors; keep client-side validation while treating the backend as authoritative; do not implement joining or fare splitting.

### Repository inspection
- Inspected the existing Create Ride components:
  - `apps/web/src/components/rides/RoutePicker.tsx`
  - `apps/web/src/components/rides/VehiclePicker.tsx`
  - `apps/web/src/components/rides/DepartureWindowPicker.tsx`
  - `apps/web/src/components/rides/FareInput.tsx`
- The repository had reusable Create Ride picker components and shared pure validation helpers, but no implemented `/rides/new` page/form wiring.
- `apps/web/src/lib/ride-options.ts` was still returning hardcoded campus places, hubs, vehicle types, and capacities.
- The backend already had `POST /api/rides`, with DB-backed validation and authoritative vehicle-capacity lookup.

### Files changed
- **Modified:** `apps/web/src/lib/ride-options.ts`
  - Removed the hardcoded campus, hub, and vehicle arrays as the runtime source of configuration.
  - `getRideFormOptions()` now queries active `locations` and active `vehicle_types` from PostgreSQL.
  - Splits `locations` by their DB `type` into campus places and transport hubs.
  - Returns vehicle capacities directly from `vehicle_types.capacity`.
  - This helper remains server-only and is now a DB-backed source used by the options API.

- **Modified:** `apps/web/src/lib/ride-options.test.ts`
  - Replaced fixed-list tests with tests that verify DB-backed option loading and the `is_active=true` filtering.

- **Modified:** `apps/web/src/lib/ride-rules.test.ts`
  - Removed its dependency on the runtime option loader from the validator test suite.
  - `knownRideIds` is now tested directly with a representative database-backed option shape.

- **Created:** `apps/web/src/app/api/rides/options/route.ts`
  - Implements `GET /api/rides/options`.
  - Uses the existing `guard()` and cookie-backed `getCurrentUser()` authentication conventions.
  - Returns the active campus locations, active transport hubs, active vehicle types, and DB-derived capacities.
  - Returns `401` when unauthenticated and a generic `500` on option-loading failure.

- **Created:** `apps/web/src/app/api/rides/options/route.test.ts`
  - Tests request guarding, authentication, successful option retrieval, and generic server failure handling.

- **Created:** `apps/web/src/app/(app)/rides/new/page.tsx`
  - Adds the `/rides/new` page that hosts the existing Create Ride UI.
  - Uses existing Next.js metadata conventions.

- **Created:** `apps/web/src/components/rides/CreateRideForm.tsx`
  - Preserves and composes the existing `RoutePicker`, `VehiclePicker`, `DepartureWindowPicker`, and `FareInput` components rather than rewriting them.
  - Fetches form configuration from `GET /api/rides/options`.
  - Uses the returned vehicle capacity only for display/fare-share estimation; it does not send capacity to the create endpoint.
  - Keeps the existing client-side `validateRideRequest()` validation for immediate feedback.
  - Sends the validated request to `POST /api/rides`.
  - Handles loading state, submission state, `400` field errors from the backend, authentication redirects, generic server/network errors, and successful creation.
  - Does not implement rider joining, join requests, or fare splitting.

- **Created:** `apps/web/src/components/rides/CreateRideForm.test.tsx`
  - Tests API-backed option loading and capacity display.
  - Tests presentation of backend validation errors.
  - Tests successful creation handling.

### Architecture after integration

```text
PostgreSQL
   ↓
GET /api/rides/options
   ↓
CreateRideForm
   ↓
POST /api/rides
   ↓
PostgreSQL
```

The authoritative vehicle capacity now has a single source of truth in `vehicle_types.capacity`. The client receives it through the backend for display, but does not submit it and cannot override the capacity persisted by `POST /api/rides`.

### Verification performed
- Inspected all modified/new source and test files after implementation.
- Confirmed there are no longer runtime hardcoded location/vehicle configuration arrays in `ride-options.ts`.
- Confirmed the new options endpoint is authenticated and uses active DB configuration.
- Confirmed the Create Ride submission body is generated by the existing shared request helper and contains no vehicle-capacity field.
- Confirmed the backend remains authoritative for validation and persisted capacity.
- Attempted `npm run typecheck`: **blocked because the local `node_modules` installation does not contain the `next` executable** (`next: not found`).
- Attempted `npm run lint`: **blocked because the local `node_modules` installation does not contain the `eslint` executable** (`eslint: not found`).
- Attempted `npm test --workspace @ridepool/web -- --run`: **blocked because the local `node_modules` installation does not contain `vitest`** (`vitest: not found`).
- Attempted `npm run build`: **blocked because the local `node_modules` installation does not contain the `next` executable** (`next: not found`).
- A previous dependency restoration attempt with `npm ci` in this environment timed out, so these commands could not be converted into genuine passing verification results.
- No PostgreSQL-backed browser integration test was run because the environment does not provide the project's configured live database.

No `join_requests`, rider joining, or rider fare-splitting code was added.


## 2026-10-04 — Address Mainak's Create Ride review

### User request
Address Mainak's requested Create Ride review changes on PR #24, make one additional commit on the existing branch, reply to the reviewer, and explicitly skip the separate date/offset validation bug.

### Changes made
- Added explicit `sort_order` values for locations and vehicle types and changed the server-side option queries to use those values.
- Changed the Create Ride page to authenticate and load `getRideFormOptions()` on the server, then pass options into the client form.
- Removed the client-side Ride Options API dependency and its tests because no remaining consumer needs it.
- Moved active location and vehicle lookups into the Create Ride transaction and used transaction-scoped shared locks for the selected configuration rows.
- Moved `pool.connect()` inside protected error handling and release handling.
- Changed the owner-row lock from `FOR UPDATE` to `FOR NO KEY UPDATE`.
- Reused `knownRideIds()`, `CreateRideRequest`, `rideMessages`, and `routes.login` where applicable.
- Removed the redundant `riders_ride_idx` index.
- Simplified Create Ride form tests so they receive server-provided options directly and clean up the fetch stub.
- Updated the stale web README description of ride options.
- Moved this AI log to `Deliverables/D2/AI_LOG.md`.

### Intentionally not changed
- The invalid-calendar-date / invalid-offset validation issue called out in review was intentionally skipped.
- The broader IP-based rate-limit design was not changed.
- Future joined-ride clash checking was not added; Create Ride only checks rides owned by the creator.

### Verification
- The user ran `npm run format` locally; formatting commit `63dcee9` is the parent of this implementation commit.
- No local test result is claimed from this environment.


## 2026-10-04 — CI failure investigation and correctness review

### User request
Investigate why the PR CI check was failing and review the updated Create Ride code for correctness.

### Findings
- CI run 26 failed during `format:check` because `CreateRideForm.tsx` still contained a stale JSX loading block after the client-side options-loading effect had been removed.
- The Docker workflow failed for the same underlying parse error during the Next.js build; it was not an independent Docker problem.
- The Create Ride API tests also needed their transaction-scoped option-query mocks updated after moving the lookups into the transaction.

### Changes made
- Removed the stale loading JSX block from `CreateRideForm.tsx`.
- Corrected Create Ride API test mocks so overlapping-ride and persistence-failure cases still provide the location and vehicle rows required by the refactored transaction flow.
- Corrected the authentication test to assert that no DB connection is acquired when authentication fails.
- Triggered a fresh CI run on commit `ceca80c` and confirmed both CI and Docker workflows started successfully.

### Correctness review
- Rechecked the Create Ride page/server option-loading flow, database-backed capacity, transaction ordering, owner locking, overlap check, owner-rider insertion, rollback/release behavior, and schema changes.
- The separate invalid-calendar-date / invalid-offset issue remains intentionally deferred as requested.

### Verification
- Previous CI run `37214971024` and Docker run `37214970956` were inspected through their job logs.
- Fresh CI run `37215256934` and Docker run `37215256879` were started from `ceca80c`; final results were still pending when this log entry was written.


## 2026-10-12 — Notification Centre backend foundation (CS455-67)

### User prompt
Implement the first small, reviewable pull request for the Notification Centre backend on branch `CS455-59-notification-api`. Audit repository state, branch convention, schema, routes, authentication, database patterns, notification creation, realtime infrastructure, tests, and `docs/BUILD_CHECKLIST.md` before changing code. Add authenticated notification listing and mark-as-read operations using the existing `notifications` table and `read_at` field; derive identity from trusted server auth; enforce ownership; add tests; avoid UI, ride lifecycle, and SOS changes. Preserve pre-existing work and do not commit or push without explicit authorization. Record AI prompts in the project AI log. Jira reference: https://cs455project.atlassian.net/browse/CS455-67.

### Repository audit
- Audited remote `master` at `8301fc3384d522c11d69f68490739f6788f13acf` and confirmed branch naming convention `CS455-<issue>-<description>`.
- Created `CS455-59-notification-api` from that commit; work stayed on the feature branch.
- Confirmed `apps/web/db/schema.sql` already defines `notifications` with UUID `id`, `user_id`, the three types `pool_chat_opened`, `pool_chat_message`, `ride_update`, title/body, related ride/chat/message IDs, nullable `read_at`, and `created_at`. Existing index is `notifications_user_created_idx(user_id, created_at DESC)`.
- Existing backend patterns use `getCurrentUser()`, `guard()`, `json()`, `pool.query`, and Vitest. No existing notification API route or Notification Centre page was found at the expected route paths.
- GitHub remote APIs cannot reveal a developer's local uncommitted working-tree changes. The work was therefore made as new files on the named remote branch, without resetting or modifying `master`.

### Changes added
- `apps/web/src/app/api/notifications/route.ts`: authenticated GET with newest-first order, deterministic ID tie-break, bounded limit/offset pagination, extra row for `hasMore`, owner-scoped SQL, and generic database error response.
- `apps/web/src/app/api/notifications/route.test.ts`: authentication, ordering and owner scope, serialization, pagination, invalid limit, and database error tests.
- `apps/web/src/app/api/notifications/[id]/route.ts`: authenticated, guarded PATCH; UUID validation; update scoped by notification ID and authenticated user ID; preserves existing `read_at` via `COALESCE`; does not reveal whether a non-owned ID exists.
- `apps/web/src/app/api/notifications/[id]/route.test.ts`: authentication, guard, UUID validation, owner scoping, idempotent update expression, not-found handling, and generic database error tests.

### Verification and limitations
- Remote branch files were created through GitHub API operations, which each create a commit; these changes are committed on `CS455-59-notification-api`, not `master`.
- Earlier local patch validation reported `git apply --check` and `git diff --check` passed in a synthetic checkout, but project Vitest, ESLint, and TypeScript checks were not run against a real checkout because GitHub could not be resolved from the local runtime.
- A PR must explicitly reference CS455-67. No UI, ride lifecycle, schema, notification creation, or realtime architecture changes were intended.


## 2026-10-12 — Notification Centre UI (PR 2, CS455-59-notification-ui)

### User prompt
Implement PR 2, the Notification Centre UI, assuming PR 1 is merged into master. Inspect current repository/branch/worktree/history and PR 1 status, fetch latest changes, create and work only on `CS455-59-notification-ui`, preserve unrelated work, and inspect the existing page, navigation, design system, API client patterns, authentication, and merged API. Build the existing `/notifications` route to fetch signed-in-user notifications, display title/body/timestamp/read state, support loading/empty/error states, persist mark-as-read, navigate only to existing valid destinations using related IDs, gracefully handle malformed resources, and follow responsive/accessibility conventions. Do not implement real-time delivery or ride/chat/complaint/SOS workflows. Add UI tests, run available checks, report results and integration needs, do not open a PR without authorization, and update this AI log with the prompt and commit on this branch.

### Audit
- Confirmed PR #53 (Notification API) is merged into `master`; current master head is merge commit `6fd4632e17e5d892087c3511c2f19b64a3cfb893`.
- Created branch `CS455-59-notification-ui` from the latest master. The remote GitHub API does not expose a local working tree, so local uncommitted status cannot be independently verified.
- Confirmed `routes.notifications` and the student navigation entry already exist, but `apps/web/src/app/notifications/page.tsx` did not exist before this change.
- Reused Next.js server page authentication via `verifySession()`, the existing `DesignSystem`, shared `Button`/`ButtonLink`, `Skeleton`/`LoadingRegion`, route constants, and existing Vitest/React Testing Library setup.
- Confirmed the merged API contract: `GET /api/notifications?limit=100&offset=0` returns `notifications` and pagination metadata; `PATCH /api/notifications/{id}` returns `notification.id` and persisted `readAt`.
- Existing ride detail route is `routes.ride(id)`. Related chat/message IDs alone do not establish a distinct supported navigation route, so this UI only links to a syntactically valid related ride UUID; otherwise it displays the notification without a link.

### Changes
- Added `apps/web/src/app/notifications/page.tsx`, protected by `verifySession()`.
- Added `apps/web/src/components/notifications/NotificationsCentre.tsx` with persisted fetch, input shape validation, loading skeletons, empty/error states and retry, read/unread display, timestamp formatting in IST, API-confirmed mark-as-read, and valid related ride links.
- Added `apps/web/src/components/notifications/NotificationsCentre.test.tsx` covering loading, empty, populated content/timestamp/read state/link, successful mark-read, list failure/retry, failed mark-read, and malformed related IDs.

### Verification status
- Remote source changes were prepared as Git objects for a single commit on `CS455-59-notification-ui`; no PR is opened as requested.
- UI tests, ESLint, typecheck, and build have not been run in a real local checkout in this environment. They remain required before review.
- No Socket.IO work, database/schema changes, ride lifecycle changes, or ride/chat/complaint/SOS workflows were added.


## 2026-10-12 — Accept all supported notification types in the UI

### User prompt
“The UI currently rejects four valid notification types supported by the database and API. The component recognizes only `'pool_chat_opened' | 'pool_chat_message' | 'ride_update'`. But the database schema also allows `account_warning`, `account_suspended`, `account_reactivated`, and `complaint_update`. The validation function `isNotification()` rejects any item with one of those types. Because the page validates the entire response with `data.notifications.every(isNotification)`, one such notification causes the entire list to be treated as an invalid response, hiding otherwise valid notifications too. Fix this. Update the AI log with this prompt.”

### Changes
- Expanded the UI notification type union and runtime allow-list to include `account_warning`, `account_suspended`, `account_reactivated`, and `complaint_update` alongside the existing three types.
- Added a UI test that returns all four additional types together with an existing ride notification and asserts every item renders without an invalid-response error. This specifically guards against one unsupported type hiding the whole list.

### Repository consistency note
During verification, the checked-in `apps/web/db/schema.sql` constraint and API `NotificationRow.type` annotation on both this branch and `master` still list only the original three types. The UI now accepts all seven as requested, but the repository's SQL constraint/API compile-time annotation should be reconciled separately before claiming the database/API already persist and emit the four additional types. No database migration or API behavior was changed in this UI-focused fix.

### Verification status
- Added regression coverage; automated tests, lint, typecheck, and build have not been run in a local checkout in this environment.


## 2026-10-12 — Align notification API type with supported types

### User prompt
“I have run all checks and fixed formatting, lint and type check errors locally and opened a PR https://github.com/CS455-Carpooling/Campus_Ridepooling_Automation/pull/54. The UI accepts seven types: `pool_chat_opened`, `pool_chat_message`, `ride_update`, `account_warning`, `account_suspended`, `account_reactivated`, and `complaint_update`. However, the API’s `NotificationRow` TypeScript declaration still lists only the first three. The database schema contains a later constraint extension allowing all seven, so the API declaration is inconsistent with the schema. Fix this, make sure to stay consistent with formatting, commit this and update the AI log with this prompt.”

### Change made
- Updated `NotificationRow.type` in `apps/web/src/app/api/notifications/route.ts` to match the seven types accepted by the UI and specified by the user.
- No API runtime logic or database schema changes were made.

### Verification
- Inspected open PR #54 and its source branch `CS455-59-notification-ui` before editing.
- Confirmed the current source declaration was limited to the original three types.
- Formatting, lint, typecheck, and tests were not run in this environment; the user reports having run checks locally for PR #54.


## 2026-10-12 — Fix notification API type formatting after PR lint check

### User prompt
“ I made the correction to the PR but the lint check is now failing; fix that, commit directly to the PR, and make it so the check passes.”

### Changes
- Reformatted the seven-value `NotificationRow.type` union in `apps/web/src/app/api/notifications/route.ts` into the repository's Prettier-compatible multiline layout.
- No API behavior or database schema was changed.

### Verification
- Inspected PR #54 CI run and found the failing step was **Check formatting**; lint and type-check had not failed in that run.
- A new CI run is required to confirm the formatting fix passes.


## 2026-10-12 — Address PR #54 Notification Centre review

### User prompt
“make these edits to PR 54 and also ensure lint checks are all correct”

### Changes
- Changed notification response validation to accept any string notification type, so a newly introduced type such as `trip_update` no longer invalidates and hides the entire list.
- Added `apps/web/src/lib/notification-types.ts` as the shared notification type definition and reused it in the notifications GET API route; the UI intentionally tolerates unknown string values.
- Removed the conflicting `block` class from notification timestamps by wrapping `time` in a paragraph.
- Hid the unread count when the initial list cannot be loaded, reused `isUuid()` and `formatDeparture()`, improved the empty-state copy, and gave each mark-as-read button a notification-specific accessible name.
- Added regression coverage for unknown notification types, the error-state unread count, timestamp formatting, accessible button names, and the notifications page session guard.

### Scope decisions
- “Mark all as read” is a separate feature and was not added because the current API only supports marking one notification at a time.
- Header live updates and the 30-day retention limit remain follow-up work, as the review permits.

### Verification
- Changes were committed to `CS455-59-notification-ui`, the head branch of PR #54.
- The repository's CI workflow is the authoritative place to verify lint, formatting, type-check, tests, and build. These checks have not yet been confirmed for the updated head; check the latest workflow run before merging.


## 2026-10-13 — Ride join-request PR follow-up (PR #62; lifecycle context from PR #55)

### User prompts

- “I am getting this error while doing npm run dev for my project, wanted to resolve this for the project to run in local server” — followed by PostgreSQL reporting that `ride_join_requests.locked_share` did not exist.
- “got this error this time” — followed by PostgreSQL reporting that `ride_join_requests.pickup_location_id` did not exist and the user's Docker/database migration steps.
- Reported the dashboard runtime error `column h.changed_at does not exist`.
- Reported that both the search-card Join action and the ride-detail request form failed, with the search-card action saying to choose a valid pickup point even though a valid campus pickup point had been selected.
- “create a ai engineering log for this PR”

### Context reviewed

- Reviewed the PR #62 description and PR #55 description to understand the initial submission work and the broader join-request lifecycle.
- Inspected the current join-request UI, request API validation and persistence code, dashboard history query, schema migration, tests, and the configured local database's request/location columns.
- PR #62 and PR #55 are treated as feature context; this entry records the AI-assisted follow-up work performed in this workspace, not a claim that the earlier PR implementation was generated in this interaction.

### AI output and evaluation

- The first database error indicated that `CREATE TABLE IF NOT EXISTS` had not upgraded an existing request table. Inspection confirmed the local table had an older schema, including legacy pickup/snapshot column names. A one-column-only repair would have left later request queries and inserts incompatible.
- The pickup validation message initially appeared to indicate a bad database location. Inspection instead found a request-contract mismatch: the search card sent `pickupPointId`, while the API parser reads `pickupLocationId`. The selected campus location itself was valid.
- The dashboard query selected `h.created_at AS changed_at` but ordered by `h.changed_at`, which PostgreSQL cannot resolve as a table column. The correct ordering column is `h.created_at`.
- No model-generated business rules or user-facing claims were accepted without checking the repository code or database schema. No unresolved AI-generated factual claim was intentionally included in the final changes.

### Changes made and accepted

- Updated `apps/web/db/schema.sql` with idempotent compatibility changes that add the request columns expected by the current implementation, copy legacy pickup/snapshot data where available, retain the old columns and their data, and make obsolete legacy insert columns nullable. This allows the current request insert to coexist with older databases without dropping request data.
- Updated `apps/web/src/components/rides/RequestToJoinButton.tsx` to send `pickupLocationId` and updated its test to assert the API's expected request body.
- Updated `apps/web/src/lib/home-data.ts` to order history by `h.created_at`; added a regression assertion in `apps/web/src/lib/home-data.test.ts`.
- Updated the root `README.md` to include the database migration in local setup.
- These changes were accepted because they address the inspected schema/API mismatches directly and preserve existing request records.

### Verification and remaining limits

- Applied the schema migration successfully to the database configured in `apps/web/.env.local`; repeated it to check idempotency.
- Verified the migrated request table contains the expected columns and its existing requests have non-null required snapshot/pickup values.
- Ran focused tests for the join-request rules and lifecycle, dashboard data, request button, and both request APIs: **6 test files and 48 tests passed**.
- Ran `git diff --check`; no whitespace errors were reported. Editor diagnostics reported no errors in the edited TypeScript files.
- A live browser/manual submission was not verified in this interaction. The development-server launch request had been denied earlier, so do not treat this log entry as evidence of an end-to-end browser check or full CI pass.
