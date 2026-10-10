# AI Engineering Log

## Initial prompt (reconstructed from conversation context; exact wording unavailable)

```text
Continue work on Ask AI to Suggest in the CS455 Campus Ridepooling repository. Work only on feat/ai-ride-recommendations and never touch master. First inspect the repository, current branch, files, Git status, existing AI types, ride-search and fare helpers, UI integration points, and tests. The AI types file may already exist, so inspect it rather than duplicating it. This first step is read-only: do not edit files or make GitHub changes, and do not commit or push unless explicitly authorized. Maintain apps/web/src/lib/ai/AI_ENGINEERING_LOG.md as a mandatory log of every prompt and implementation step, including files changed and why, decisions, accepted/rejected/modified AI suggestions, and planned versus completed work. Explain intended changes before each implementation step, inspect the diff afterwards, and update the log.
```

## Action taken

- Inspected the feature branch, current AI types, ride-search and fare helpers, relevant UI integration points, and tests using read-only repository access.
- Reported the existing branch and implementation structure. No application files were changed during the initial read-only inspection.

## Prompt 1

```text
I only want the prompts and whatever action was taken after the prompt in the ai log

create the log file

only work on the feature branch, do not touch master

Continue implementing Ask AI to Suggest in the CS455 Campus Ridepooling repository.

Inspect the existing `apps/web/src/lib/ai/types.ts` and relevant ride-search types before making changes.

Finalize the types for:

- The recommendation request.
- The model's ranking response.
- The final recommendation shown to the rider.
- Ranking factors, pros and cons, AI/fallback source, and feedback.

Use the project requirements: return at most five valid rides; support estimated fare share, departure-time suitability, pickup-order changes, shared interest tags, aggregate ratings, vehicle type and available seats where permitted. Do not expose private profile data or complaint details.

Keep model-generated claims separate from trusted application data. The server must remain authoritative for ride details, fares and availability.

Do not implement Gemini integration, the UI or the API endpoint in this step.

Run relevant tests or type checks if possible, inspect the diff, and report any unresolved decisions.

**clearly list to me what all you implemented and why**
```

## Action taken

- Read `apps/web/src/lib/ai/types.ts`, `apps/web/src/lib/ride-search.ts`, and `apps/web/src/lib/fare.ts` on `feat/ai-ride-recommendations`.
- Created shared types for the model-safe recommendation request, privacy-filtered candidate data, model ranking response, trusted rider-facing suggestions, AI/fallback source, and helpful/not-helpful feedback.
- Added ranking factors for fare, departure suitability, pickup-order changes, shared interests, aggregate ratings, vehicle, available seats, and the optional trust indicator. Added constants for the five-suggestion limit and the three-pros/three-cons limits.
- Kept model output limited to ride IDs, factors, pros, and cons. The final suggestion references the server-owned `SearchRideResult`; model output does not supply authoritative ride details, fare, or availability.
- Marked unavailable factor data as `null` so the model contract distinguishes missing data from a negative result. The candidate contract excludes names, contact details, raw profile data, and complaint details.
- Compared the feature branch with `master` and fetched the changed files to inspect the resulting contents. No files on `master` were changed.
- Automated tests/type checks were not run: this session has GitHub file-editing access but no checked-out project environment to execute the test commands.
- Unresolved: `SearchRideResult` currently lacks computed pickup-order impact, consent-filtered shared interest tags, aggregate ratings, and the optional trust indicator. Those fields need authoritative server-side sources before the factors can be populated. Validation must also enforce the result/pros/cons limits and re-check ride availability before display.
- No Gemini integration, UI, or API endpoint was added.

## Prompt 2

```text
you did not include my very first prompt in the ai log
so add that at the beginning of the log
suggest me a solution for the questions on pickup order impact and shared interests
how will ai get access to these?
```

## Action taken

- Added the initial repository instruction prompt at the beginning of this log. The available conversation context preserved its requirements but not its exact original wording, so the entry is explicitly marked as reconstructed rather than verbatim.
- Inspected the current database schema and confirmed that `riders.campus_location_id` stores each occupant's campus pickup/drop-off point; `user_profiles.ai_tag_consent` stores profile-tag AI consent; `user_profile_tags.is_visible` stores per-tag visibility; and `interest_tags` provides a fixed tag vocabulary.
- Recommended computing pickup-order impact server-side from a trusted campus travel-time/distance matrix or routing service, comparing the existing pickup sequence with the best feasible sequence after inserting the requesting rider's stop. Send the model only derived metrics such as additional minutes, whether the order changes, and affected stops; do not ask the model to calculate a route.
- Recommended computing shared interests server-side by intersecting the requesting rider's and candidate occupants' active, visible tags, only when the relevant users have consented to AI use of their tags. Send only the common permitted tag labels (or a minimal match summary), not per-person profiles or user identifiers. If consent or tag data is missing, omit the factor rather than infer it.
- Clarified that the AI should receive these as a small, structured candidate payload assembled by the server and supplied in the model request; it should not have direct database access. The server remains authoritative and validates model output against current ride data.
- No application code or database schema was changed for this prompt; the pickup-order and shared-interest approaches are recommendations for the implementation step.


## Prompt 3

```text
take the locations to be hall 1 to hall 14 and main gate
you can use google maps to get the info you need
build a hardcoded travel time matrix
```

## Action taken

- Added `apps/web/src/lib/ai/campus-travel-times.ts` on `feat/ai-ride-recommendations` with a 15-location matrix for Hall 1 through Hall 14 and Main Gate, in minutes.
- Added `getCampusTravelTimeMinutes(from, to)`, which accepts case-insensitive names and returns `null` for unknown locations, and `getCampusTravelTimeMatrix()` for read-only matrix access.
- Added `apps/web/src/lib/ai/campus-travel-times.test.ts` with checks for the location set, matrix symmetry, zero diagonal, non-negative entries, case-insensitive lookup, and unknown-location handling.
- Used the published IIT Kanpur campus map as a layout reference. The individual pairwise minute values are rough placeholder estimates; they were not verified one-by-one with Google Maps route directions or a routing API. The code comments state this limitation, and the values must not be used as navigation ETAs.
- Kept the matrix isolated in its own module so it can later be replaced with Google Routes/another routing provider or admin-configured values without changing callers.
- No changes were made to `master`. Tests were authored but not executed because no checked-out project environment is available in this session.


## Prompt 4

```text
validate them
```

## Action taken

- Reviewed what can be validated from public sources. IIT Kanpur's published tender lists a 1,492 m road segment from the Main Gate to the Hall I diversion (https://iitk.ac.in/iwd/file/2022/25-C-D1-2021-22/TenderDocumentMech.pdf), but that is not a verified driving duration and does not validate every pair in the matrix.
- Confirmed the current matrix is square (15 × 15), symmetric, non-negative, zero on the diagonal, and satisfies the triangle inequality. Added a test for the triangle inequality.
- Could not verify individual pairwise driving durations from Google Maps directions in this environment. The matrix values remain explicitly labelled as placeholders; structural consistency must not be confused with geographic accuracy.
- Tests were authored but not executed because this session has GitHub repository access without a checked-out runtime.

## Prompt 5

```text
Validate the travel time matrix
and implement the pickup order impact calculation
```

## Action taken

- Added `apps/web/src/lib/ai/pickup-order-impact.ts` on `feat/ai-ride-recommendations`. It computes a minimum-duration open stop order with Held–Karp dynamic programming, compares the best existing route with the best route including the proposed stop, and returns both orders, the estimated duration difference, whether existing stops change position, and the number of affected existing stops.
- The calculation deduplicates same-location stops, handles case-insensitive duplicate proposed stops, and returns `null` when required travel-time data is missing or invalid. It is a stop-order estimate only, not a navigation route, traffic-aware ETA, or direction-specific pickup/drop-off solver.
- Added `apps/web/src/lib/ai/pickup-order-impact.test.ts` covering an already-present stop, route-duration comparison, missing data, duplicate locations, and empty proposed locations. Corrected expectations to use metric test distances.
- Strengthened `campus-travel-times.test.ts` with a triangle-inequality check. The existing matrix passes the structural checks by direct programmatic inspection, but its pairwise times remain unverified estimates.
- No Gemini integration, API, UI, database changes, or changes to `master` were made. Automated tests/type checks were not run in this environment.


## Prompt 6

```text
the travel time matrix is a placeholder and can be left as such for now

Implement shared interest enrichment

- Intersect the requesting rider's and candidate occupants' interest tags on the server.
- Respect `ai_tag_consent` and `is_visible`.
- Send only permitted common tag labels or a minimal match summary to the model.
- Omit the factor when consent or usable data is missing.

Deliverable: privacy-filtered shared-interest data for each candidate ride.
```

## Action taken

- Added `apps/web/src/lib/ai/shared-interest-enrichment.ts`, a server-only helper that batch-enriches candidate ride IDs using the existing PostgreSQL schema. It intersects active, visible tags across the requesting rider and every current occupant of each candidate ride.
- Requires `ai_tag_consent = TRUE` for the requesting rider and every current occupant. It considers only `user_profile_tags.is_visible = TRUE` and active `interest_tags`; departed riders are excluded. No names, user IDs, per-person tags, contact details, or complaint data are returned in the enrichment result.
- Returns `sharedInterestTags: null` if any participant lacks consent or any participant lacks usable visible active tags. Returns an empty array when all participants consent and have usable tags but no label is common to everyone. Otherwise returns distinct, sorted common labels only.
- Added `resolveSharedInterestTags` and `shared-interest-enrichment.test.ts` to cover consent filtering, missing usable data, deduplication, and the no-common-tag case.
- Updated the model-safe candidate type comment to clarify the distinction between unavailable data (`null`) and a valid empty intersection (`[]`).
- Did not change the placeholder travel-time matrix, database schema, UI, API, Gemini integration, or `master`. Tests/type checks were authored but not run because this session does not have a checked-out project runtime.
