# AI Engineering Log — Rider Requirements (D1)

## Purpose

This log records how AI assistance was used to develop the Rider
section of the D1 requirements: what was asked, what the model
produced, which errors were found, and what was changed as a result. It
follows the AI Engineering Log fields of the course handout (§8).

**Author:** Mainak Sarkar (230619)

**Models used:**

| Model | Role |
|---|---|
| Claude (Anthropic) | Drafting assistant for the Rider requirements, diagrams and traceability |
| Claude Sonnet (Anthropic) | Independent reviewer, run in a separate session with read-only access to the drafts |
| Gemini 3.6 Flash (Google) | Planned independent reviewer; the service was unavailable (Entry 04) |



------------------------------------------------------------------------

## Entry 01 --- Scoping the deliverable and the required format

**Date:** 2026-09-23



**Prompt :** Explain the D1 components other than Jira and
GitHub. Before drafting anything, study the Lecture 3–4 (requirements
engineering) and Lecture 6 (system modelling) slides, the course handout
and the team-approved D0 proposal, and identify the format the Rider
requirements must follow.

**LLM output:** A breakdown of the D1 components and the conventions to
follow:

-   user requirements refined into numbered system requirements
    (1 → 1.1, 1.2, …), each with a rationale;
-   the structured specification form (Function, Description, Inputs,
    Source, Outputs, Destination, Action, Requires, Pre- and
    Postcondition, Side effects) and tabular specifications;
-   non-functional requirements classified as product, organizational or
    external, each with a measurable metric;
-   the validation checklist: validity, consistency, completeness,
    realism, verifiability;
-   UML use-case diagrams with a description table per use case, and
    activity and state diagrams.


------------------------------------------------------------------------

## Entry 02 --- Planning the Rider section

**Date:** 2026-09-23

**Prompt:** Plan the Rider section in detail, given the
following decisions  and propose the items left open.

**Decisions :**

-   Shared features (sign-in, profile, pool chat, fare view, ratings,
    complaints, notifications, SOS) are written in full from the Rider's
    side and reconciled with the other sections later.
-   Markdown for D1; conversion to LaTeX later.
-   Rides have more than one pickup point.
-   A signal derived from complaints may appear in AI suggestions only if
    it stays simple to build.
-   Jira issue keys are added after the backlog is imported.

**Make generic decisions on teh follwoing requirements:** the requirement ID scheme, the fare
settlement approach and the SOS behaviour.

**LLM output:** A plan covering the file layout, the content of each
file, the diagrams, the Jira import and a timeline, with these
proposals:

1.  ID scheme `UR-RD-nn` → `FR-RD-nn.m`, with `NFR-RD-nn`, `AI-RD-nn`,
    `UC-RD-nn` and `US-RD-nn` (acceptance criteria `US-RD-nn-ACk`), and
    role codes RD / RO / AD / CM so the three sections can merge.
2.  Settlement tracked, not processed: Due → Marked Paid → Confirmed, or
    Disputed and routed to a complaint. No payment gateway, because the
    D0 stack has no payment provider.
3.  SOS available to the rider during an active trip, creating a
    real-time incident for administrators, with emergency numbers shown
    and an explicit statement that the platform does not dispatch
    emergency services.
4.  One seat per join request; the fare split equally among occupants,
    to be reconciled with the Ride Owner section.

**Decision:** The plan was approved by the author before drafting began.

**Final artifact:** `Deliverables/D1/Requirements Engineering/README.md`
(proposed team conventions) and the Rider folder structure.

**Student evaluation:** *To be completed by the author.*

------------------------------------------------------------------------

## Entry 03 --- Drafting the Rider requirements

**Date:** 2026-09-23

**Prompt :** Draft the Rider section according to the approved
plan: specification, functional and non-functional requirements, AI-agent
requirements, use cases with diagrams, user stories with acceptance
criteria, the traceability matrix and a Jira import file.

**LLM output:** Files 01–06; use-case, activity and join-request state
diagrams (PlantUML); a Jira import file (1 epic, 34 stories, 21 NFR
tasks). The traceability matrix (file 07) was generated from files 02–06
by a consistency-check script, so that every requirement is linked to at
least one use case and user story. Size at this stage: 16 user
requirements, 95 functional, 21 non-functional and 15 AI-agent
requirements, 17 use cases, 34 user stories with 100 acceptance
criteria, 25 system parameters.

**Errors identified in the output:**

1.  **Notation.** The first use-case diagram used directed arrows
    between actors and use cases and dropped the guillemets around
    stereotypes, which does not follow Lecture 6 notation. Redrawn with
    plain associations and `<<extend>>`.
2.  **Arithmetic.** The user-story scenario gave a final share of ₹117
    with four occupants, which contradicts the rounding rule of Table T-2
    (₹350 over four occupants gives ₹88, ₹88, ₹87, ₹87). Corrected to
    "estimate at most ₹117, final share ₹87".
3.  **Scenario detail (author correction).** The scenario placed the
    rider in Hall 5. The author changed it to Hall 6, a girls' hostel,
    consistent with the rider persona; the meeting point and
    US-RD-15-AC1 were updated to match.

**Final artifact:** Files 01–07, `diagrams/`,
`jira/rider_backlog_import.csv`.

**Student evaluation:** *To be completed by the author* (evaluation,
further errors found, changes made, accept / modify / reject with
reason).

------------------------------------------------------------------------

## Entry 04 --- Independent LLM review of the requirements

**Date:** 2026-09-23

**Context:** The handout requires the requirements to be reviewed with
an LLM, documenting what was changed and what was rejected. A second
model, with no access to the drafting session, was used as the reviewer.

**Prompt:** `llm_review/review_prompt.md`. It asks the reviewer to act
as an independent requirements engineer, gives the D0 context and the
course rules, and asks for defects in eight categories (ambiguity,
testability, conflict, missing behaviour, agent governance,
non-functional, validity, realism), each citing requirement IDs and
proposing a concrete change, as structured JSON. Files 01–04 and 06 were
appended.


**LLM output:** 13 findings (3 high, 7 medium, 3 low). Raw output:
`llm_review/claude_sonnet_review_raw.json`; run details:
`llm_review/claude_sonnet_review_meta.json`. Every requirement ID and
quotation in the findings was checked against the drafts, and none was
mis-cited.

**Changes made in response:** Where a change departs from the reviewer's
suggestion, the difference is noted in italics.

| ID | Severity | Finding | Change made | Decision |
|---|---|---|---|---|
| R-01 | High | Owner cancelling a ride after lock is unspecified for accepted riders | Added **FR-RD-06.11**: the request becomes Ride Cancelled, no fare liability remains, the pool chat closes and the rider is notified within 2 s; chat retention (FR-RD-09.5) now runs from completion or cancellation | *To be completed by the author* |
| R-02 | High | Free-text display names could carry instructions into AI prompts (indirect prompt injection) | **AI-RD-09** now treats all free-text profile fields as data; failure scenario **F-8** added; adversarial display names added to the AI-RD-14 evaluation set; US-RD-10-AC5 | *To be completed by the author* |
| R-03 | High | Availability (NFR-RD-07) covered only 06:00–24:00, missing early-morning departures | NFR-RD-07 now requires ≥ 99 % availability 24 hours a day. *The reviewer's alternative was 04:00–24:00* | *To be completed by the author* |
| R-04 | Medium | The search filter hid full rides on which the rider already holds a request | **FR-RD-03.2** reworded to list such rides with the request's state; US-RD-07-AC5 | *To be completed by the author* |
| R-05 | Medium | No fallback when every AI suggestion fails validation | FR-RD-04.5 and AI-RD-13 fall back to the deterministic ranking in that case; F-1 test extended; US-RD-11-AC2 | *To be completed by the author* |
| R-06 | Medium | AI-RD-08's "fixed token budget" had no value, so it could not be tested | Added parameter **P-26 = 8,000 tokens**. *The reviewer suggested 2,000; 8,000 allows for the candidate rides' data in the prompt* | *To be completed by the author* |
| R-07 | Medium | A phone number was referenced but never collected | Added **FR-RD-02.7**: optional mobile number, visible only to administrators and included in SOS incidents. *The reviewer's alternative was to remove the reference* | *To be completed by the author* |
| R-08 | Medium | "The trip starts" was undefined | Glossary entry **Trip start** (owner sets Pickup in Progress); FR-RD-07.3–07.5 and S-4 now refer to the trip state | *To be completed by the author* |
| R-09 | Medium | Unclear whether a suspended rider can file complaints | FR-RD-01.5: complaints remain available during suspension. *Settling shares already due was also kept available* | *To be completed by the author* |
| R-10 | Medium | The chatbot "session" was undefined | FR-RD-05.6: conversation kept only while the browser tab is open; glossary entry | *To be completed by the author* |
| R-11 | Low | 90-day periods hard-coded in two requirements | Added parameters **P-27** (trust-indicator lookback) and **P-28** (AI audit retention) | *To be completed by the author* |
| R-12 | Low | A departure change could create a clash between two accepted rides | Added **FR-RD-07.6**: the rider is notified and may leave either ride without liability. *The reviewer suggested requiring the rider to leave one* | *To be completed by the author* |
| R-13 | Low | The AI-RD-14 evaluation suite is heavy for the team's capacity | Requirement kept; marked as a scope risk for the team risk register | *To be completed by the author* |

**Resulting changes:** functional requirements 95 → 98, acceptance
criteria 100 → 108, system parameters 25 → 28, AI failure scenarios 7 →
8. The consistency check passed after the changes.

**Final artifact:** Files 01–07 as revised, merged in PR #1.

**Student evaluation:** *To be completed by the author* (evaluation of
the review, errors in the reviewer's output, changes made, accept /
modify / reject per finding with reason).

------------------------------------------------------------------------

## Entry 05 --- Cross-section consistency review

**Dates:** 2026-09-24 and 2026-09-25

**Prompt (summary):** Once the Ride Owner and Operations Admin sections
were uploaded, compare them with the Rider section and the D0 proposal,
and report contradictions. The Admin section was reviewed only; it was
not to be edited.

**LLM output:**

-   **First Ride Owner draft:** riders joined automatically without the
    owner's approval, contradicting D0 ("co-riders join pending
    ride-owner approval") and the Rider join flow. The Ride Owner authors
    later revised their section to use owner acceptance and rejection.
-   **Ride Owner use-case diagram:** duplicate use cases, include/extend
    relations that did not match the use-case descriptions, the Rider
    linked to owner-only actions, and use cases without an actor. A
    corrected PlantUML version was proposed to the Ride Owner authors for
    their review (PR #7).
-   **Differences for team reconciliation:** the fare-split model (equal
    split vs. segment-based), SOS handling (real-time alert vs. complaint
    category), the sign-in method, the source of fare and vehicle
    capacity, fares after a no-show, leaving or cancelling after lock,
    trip states, AI support for ride owners (promised in D0), and admin
    functions the Rider section depends on (the interest-tag list and
    review of the rider AI's audit records).

**Decision:** The differences are recorded here for team
reconciliation; no other section was edited.


