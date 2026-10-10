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

- Inspected the existing AI types, ride-search types, and authoritative fare helper on `feat/ai-ride-recommendations`.
- Finalized the shared TypeScript contracts for recommendation input, model ranking output, rider-facing suggestions, allowed ranking factors, AI/fallback source, and feedback.
- Kept the model's explanation text separate from the trusted `SearchRideResult` ride object; the model response carries ride IDs and explanations, not authoritative ride details.
- Did not implement Gemini integration, UI, or an API endpoint.
- Checked the resulting diff. Automated tests/type checks could not be run in this GitHub-only editing environment.
- Unresolved: current `SearchRideResult` does not provide pickup-order impact, shared interest tags, aggregate ratings, or a trust indicator. These need authoritative, privacy-filtered data sources before those factors can be used at runtime.
