# AI Engineering Log

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
