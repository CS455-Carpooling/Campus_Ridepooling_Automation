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
