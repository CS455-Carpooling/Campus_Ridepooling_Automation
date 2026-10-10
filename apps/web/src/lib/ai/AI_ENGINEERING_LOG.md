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


- Follow-up implementation detail: extracted the pure privacy-gating/deduplication function into `shared-interest-tags.ts` so its unit tests do not import the `server-only` database module. The server enrichment imports that helper; the model payload contract remains label-only.


## Prompt 7

```text
Build candidate enrichment and validation

- Reuse `searchRides()` and the existing fare calculations.
- Assemble the model-safe candidate data using the finalized types.
- Populate available factors such as fare share, departure suitability, vehicle, seats, pickup impact, shared interests and permitted aggregate ratings.
- Validate model output: accept only eligible ride IDs, allowlisted factors, bounded explanations and at most five results.
- Recheck ride availability before returning suggestions.

Deliverable: a reliable backend pipeline that separates trusted ride data from untrusted model output.
```

## Action taken

- Added `recommendation-pipeline.ts`, which calls the existing `searchRides()` for eligible rides and reuses its authoritative estimated fare shares, vehicle, departure window, and available-seat values.
- Enriched candidates with server-computed pickup-order impact from current occupant pickup-point labels and the requesting rider's selected campus location; privacy-filtered shared-interest tags from `enrichSharedInterests()`; and an aggregate average/count of ratings for current occupants. Rating comments and individual rating identities are not selected or returned.
- Kept `trustIndicator` as `null`: the current schema does not define a trustworthy trust-indicator source, so the pipeline does not invent one. Missing pickup, shared-interest, or rating data stays unavailable rather than being fabricated.
- Added `validate-ranking.ts`. It accepts only candidate ride IDs, removes factors outside the allowlist or unavailable for that candidate, rejects duplicate IDs and malformed or overlong explanations, enforces at most three pros and three cons per ride, and caps the ranking at five rides.
- Added `rankRideRecommendations()`, which passes only the typed model-safe filters/candidates to an injected ranking function, then reruns `searchRides()` before returning suggestions. Rider-facing ride details always come from this second trusted search, never from model output. If ranking throws or yields no valid eligible result, it falls back to current eligible rides in deterministic search order.
- Added `validate-ranking.test.ts` for unknown IDs, unavailable factors, duplicate IDs, the five-result cap, explanation bounds, and malformed model output.
- No Gemini provider, HTTP API endpoint, UI, or database schema change was added. The ranking runner is injected so a future model integration can be added separately.
- Tests/type checks were authored but not executed because this session has GitHub file-editing access without a checked-out project runtime. No changes were made to `master`.

- Kept the implementation in a single pipeline module and removed a duplicate candidate-enrichment file so there is one source of truth for candidate assembly and availability rechecks.


## Prompt 8

```text
### Integrate Gemini

- Add a server-side Gemini client and structured ranking prompt.
- Send only the enriched candidate payload—not direct database access, raw profiles or complaint data.
- Ask Gemini to rank candidate IDs and explain the ranking with concise pros and cons.
- Validate the response and use a deterministic fallback if the model fails or returns invalid output.
- Keep the API key in server-side environment configuration, never in client code or Git.

Deliverable: working AI ranking behind a stable service interface.
```

## Action taken

- Added `apps/web/src/lib/ai/gemini-ranking.ts`, a server-only Gemini REST client using `GEMINI_API_KEY` from the server environment, with optional `GEMINI_MODEL` configuration (default `gemini-2.5-flash`), a 20-second request timeout, and structured JSON response schema.
- Added a structured ranking prompt that asks Gemini to rank only supplied candidate IDs, use only supplied fields, avoid inferences for unavailable factors, and provide up to five recommendations with up to three concise pros and cons per ride. The request sends only the typed `RecommendationRequest` filters and enriched `RecommendationCandidate[]`; it has no database tools or direct database access.
- Parsed Gemini's JSON response as untrusted data and connected the client through `apps/web/src/lib/ai/recommendations.ts`, a stable server-side `getRideRecommendations(viewerId, filters)` interface.
- Reused the existing ranking pipeline's allowlist validation, trusted-data attachment, current availability recheck, and deterministic fallback when Gemini fails or returns unusable output. API keys and provider response bodies are not included in thrown error messages.
- Added `apps/web/.env.example` documenting `GEMINI_API_KEY` and optional `GEMINI_MODEL`. The real `.env*` files are ignored by Git; only the placeholder example is exempted. No real API key was added to the repository.
- Used Gemini structured-output schema enum types and inspected the edited files and feature-branch diff. No client-side Gemini code, UI, HTTP endpoint, database access for the model, or changes to `master` were added.
- Tests, type checks, and a live Gemini call were not run in this session, which has GitHub repository access but no checked-out runtime or configured API key. Live operation still requires setting `GEMINI_API_KEY` in the deployment/server environment and running the project checks.


## Prompt 9

```text
### Implement the “Ask AI to Suggest” UI

- Add the entry point to the existing ride-search experience.
- Display up to five recommendations, each with pros, cons and relevant ranking factors.
- Show loading, empty, error and fallback states.
- Make sure displayed fares, seats, departure times and ride details come from trusted application data.

Deliverable: the complete rider-facing feature.

### Run tests and review the feature branch

- Unit-test the matrix, pickup-order calculation, shared-interest filtering, response validation and fallback.
- Add API integration tests and UI tests.
- Run the project's lint, typecheck, test and build commands.
- Inspect the complete diff against `master`, verify the engineering log, and check that no secrets or unrelated changes were introduced.

Deliverable: a tested feature branch ready for review.
```

## Action taken

- Added authenticated `POST /api/rides/recommendations`. It applies the existing same-origin/CSRF guard and per-IP rate limit, requires a current session, validates the search filter payload, and calls the stable server-side `getRideRecommendations()` service. It returns a generic server error rather than exposing provider internals.
- Added `AskAiRecommendations.tsx` to the existing `/rides/results` experience. Riders can request or refresh suggestions. The UI shows loading, retryable error, empty, AI-ranked and deterministic-fallback states; renders at most five results; and displays each suggestion's pros, cons and ranking-factor labels.
- Reuses `RideCard` with the trusted `SearchRideResult` returned by the server pipeline. Fare share, total fare, seats, departure window, hub, vehicle and ride link are rendered from trusted ride data, not model output. Only explanations and the validated ranking factors come from the model.
- Added `AskAiRecommendations.test.tsx` for loading/success, trusted ride fields, empty/fallback and retryable error states; added `src/app/api/rides/recommendations/route.test.ts` for authentication, invalid filters, service delegation, and safe error handling; and added `recommendation-pipeline.test.ts` for model failure, ineligible model IDs, trusted ride data, availability recheck, and the no-candidate fallback.
- Existing tests cover the travel-time matrix's structural invariants, pickup-order calculation, shared-interest privacy filtering, and ranking response validation. The travel matrix is still explicitly a placeholder; structural tests do not validate its real-world accuracy.
- Reviewed the API route, UI integration, candidate pipeline, and the files in the feature-branch comparison. No real API key was added; `apps/web/.env.example` contains only an empty placeholder and `GEMINI_API_KEY` is read only by server-side code. No changes were made to `master`.
- Could not run `npm run lint`, `npm run typecheck`, `npm test`, or `npm run build`: repository access in this session permits GitHub file edits and reads but does not provide a checked-out Node project runtime or configured Gemini API key. Tests are authored, not confirmed passing; no CI run was triggered or verified. Therefore this branch is not yet confirmed ready to merge.
- Remaining review caveats: candidate enrichment uses the existing ratings schema and the placeholder campus travel-time matrix; local typecheck/build must verify those queries and all new UI/API tests. Live Gemini operation requires configuring `GEMINI_API_KEY` as a server-side secret.

- Final review follow-up: added test cleanup for stubbed global `fetch` in the recommendation UI tests. Compared the feature branch against `master`: the diff is limited to the AI feature, its search-results integration, the authenticated recommendation endpoint, tests, the engineering log, and the environment example. The repository search for `GEMINI_API_KEY` found no committed key values; only the server-side environment lookup and empty example placeholder are present.
- Attempted to obtain a local checkout to execute the required commands, but the environment could not resolve `github.com`. Consequently lint, typecheck, tests, and build remain unrun; no passing CI result was verified. This is an explicit verification blocker, not a successful test result.
