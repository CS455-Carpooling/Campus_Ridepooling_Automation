# Rider — Functional Requirements

System requirements refined from the user requirements in `01_requirements_specification.md` §6.
Requirement FR-RD-*nn.m* refines UR-RD-*nn*. Parameters `P-nn` are defined in `01` §5.

**Columns.** *Priority*: MoSCoW (Must = mandatory; Should, Could = optional). *Verification*: Test,
Demonstration (Demo), Inspection, or Analysis. *Flags*: **Critical** marks candidates for the
end-to-end traceability chain; *Shared* marks features reconciled with the Ride Owner (RO) or Admin
(AD) sections.

## UR-RD-01 — Registration, sign-in and account status

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-01.1 | When a user registers, the system shall accept only email addresses whose domain is exactly `iitk.ac.in` (P-01) and shall reject any other address with a message that only IIT Kanpur addresses are allowed.<br>*Rationale: institute membership is the platform's primary trust mechanism.* | Must | Test | Critical; Shared: RO, AD |
| FR-RD-01.2 | When a user registers or signs in, the system shall email a six-digit one-time code that is valid for 10 minutes (P-02) and for one use only, and shall invalidate the code after 5 incorrect entries (P-03).<br>*Rationale: passwordless sign-in proves mailbox ownership without storing passwords.* | Must | Test | Shared: RO, AD |
| FR-RD-01.3 | The system shall not allow an account whose email address is unverified to use any rider function other than verification. | Must | Test | Shared: RO |
| FR-RD-01.4 | The system shall end a rider's session after 7 days without activity (P-04) and immediately when the rider signs out. | Must | Test | Shared: RO, AD |
| FR-RD-01.5 | If an administrator suspends a rider's account, then the system shall from that moment reject the rider's new join requests, reconfirmations, pool chat messages and ratings, withdraw the rider's active requests, and show the rider the suspension's end date and reason category; SOS, ride history, complaint filing (FR-RD-13.1) and settlement of shares already due (FR-RD-11.2) shall remain available.<br>*Rationale: enforcement must take effect immediately, but never at the cost of the rider's safety, their means of recourse, or their existing obligations to others.* | Must | Test | Shared: AD |
| FR-RD-01.6 | When an administrator issues a warning to a rider, the system shall show the warning and its reason category at the rider's next sign-in and require the rider to acknowledge it. | Should | Test | Shared: AD |

## UR-RD-02 — Profile, interests and privacy

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-02.1 | When a rider signs in for the first time, the system shall require a display name of 2–40 characters and a default pickup point chosen from the configured list, and shall ask for consent to use interest tags in AI suggestions (FR-RD-16.2), before any other rider function is available. | Must | Test | Shared: RO |
| FR-RD-02.2 | The system shall allow the rider to select up to 10 (P-05) interest tags only from the administrator-maintained tag list, and shall not accept free-text tags.<br>*Rationale: a controlled vocabulary keeps AI matching consistent and prevents offensive content or instructions entering AI prompts through profiles.* | Must | Test | Shared: RO |
| FR-RD-02.3 | The system shall allow the rider to edit their display name, default pickup point, tags and preferences at any time; changes shall apply to later searches and suggestions only. | Must | Test | Shared: RO |
| FR-RD-02.4 | The system shall show other users only a rider's display name, the tags the rider has marked visible, the aggregate rating (subject to FR-RD-12.3) and the number of completed trips; a rider's email address and phone number shall never be shown to other riders or ride owners.<br>*Rationale: in-app chat removes the need to exchange contact details.* | Must | Test | Shared: RO |
| FR-RD-02.5 | The system shall allow the rider to save default preferences — preferred vehicle type and maximum acceptable fare share — which pre-fill search filters. | Should | Test | — |
| FR-RD-02.6 | The system shall allow the rider to block another user; rides owned by a blocked user shall not appear in the rider's search results or AI suggestions. | Could | Test | Shared: RO |
| FR-RD-02.7 | The system shall allow the rider to add an optional 10-digit Indian mobile number, visible only to administrators, included in any SOS incident the rider raises (FR-RD-15.2), and never sent to the AI service.<br>*Rationale: administrators responding to an SOS need a direct way to reach the rider.* | Should | Test | Shared: AD |

## UR-RD-03 — Finding rides

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-03.1 | The system shall allow the rider to search rides by destination and date (both required), a departure time window, a pickup point (default: the profile's default) and a vehicle type. | Must | Test | — |
| FR-RD-03.2 | The system shall return only rides that are open, have a lock time (P-06) in the future, whose owner is not suspended, and that either have at least one available seat or carry an active or accepted request of the rider; rides on which the rider has such a request shall show that request's state instead of a join action. | Must | Test | — |
| FR-RD-03.3 | For each result the system shall display the destination, departure time, vehicle type, available seats, total fare, the rider's estimated share (FR-RD-08.1), the rider's estimated pickup time at the selected pickup point, the owner's display name and aggregate rating, the number of the rider's interest tags shared with current occupants, and the time the availability was read. | Must | Test | — |
| FR-RD-03.4 | The system shall allow results to be sorted by departure time (default), estimated share or number of shared interests, and shall show 20 results per page. | Should | Test | — |
| FR-RD-03.5 | While search results or a ride's details are displayed, when the ride's available seats, departure time or state change, the system shall update the display within 2 seconds (P-13); if the ride becomes full, locked or cancelled, the system shall disable its join action.<br>*Rationale: prevents riders acting on stale availability — the first concurrency challenge in the proposal.* | Must | Test | Critical |
| FR-RD-03.6 | The ride details view shall also show the public profiles (FR-RD-02.4) of the owner and accepted riders, the pickup order with each occupant's pickup point, and the fare breakdown (FR-RD-08.5). | Must | Test | — |
| FR-RD-03.7 | If a search returns no rides, the system shall show the nearest open rides to the same destination on the same date outside the requested time window, ordered by time difference. | Should | Test | — |

## UR-RD-04 — AI ride suggestions ("Ask AI to Suggest")

Agent permissions, guardrails and failure handling are specified in `04_ai_agent_requirements.md`.

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-04.1 | When the rider selects "Ask AI to Suggest" for a search, the system shall return at most 5 (P-11) open rides ranked by suitability for that search, each with up to three pros and three cons in plain language. | Must | Test | — |
| FR-RD-04.2 | The system shall base rankings and pros/cons only on: estimated share, estimated pickup time relative to the rider's time window, the change the rider would cause to the pickup order, shared interest tags, aggregate ratings, vehicle type, available seats, and — if implemented — the trust indicator of FR-RD-04.6. | Must | Inspection | — |
| FR-RD-04.3 | Before displaying AI suggestions, the system shall verify that every suggested ride exists, is open and has at least one available seat, and that every fare, time and count stated in an explanation equals the value the system computes; suggestions failing the first check shall be removed and explanations failing the second shall be replaced by a system-generated factual summary.<br>*Rationale: AI output is not evidence of correctness; hallucinated rides or figures must never reach the rider.* | Must | Test | Critical |
| FR-RD-04.4 | Selecting a suggestion shall open the ride details view; a join request shall be created only by the rider's own submission (FR-RD-06.1). | Must | Test | — |
| FR-RD-04.5 | If the AI service returns an error or no valid response within 8 seconds (P-12), or none of its suggestions passes the checks of FR-RD-04.3, the system shall display a deterministic ranking — by closeness of departure to the rider's time window, then by estimated share — labelled as a non-AI fallback. | Must | Test | — |
| FR-RD-04.6 | The system may show, for an owner or co-rider, an aggregate trust indicator derived from upheld complaints in the previous 90 days (P-27) (for example, "no upheld safety complaints"). | Could | Test | Shared: AD |
| FR-RD-04.7 | The system shall never display complaint text, complaint counts by category or complainant identity to riders, whether through AI suggestions or any other view. | Must | Test | Shared: AD |
| FR-RD-04.8 | The system shall label each AI suggestion as AI-generated and let the rider mark it helpful or not helpful; the marks shall be stored for evaluation (AI-RD-14). | Should | Test | — |

## UR-RD-05 — AI chatbot

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-05.1 | When the rider sends a natural-language query about rides, the system shall convert it into search filters, show the interpreted filters as editable values, and return matching rides under the rules of FR-RD-03.2. | Must | Test | — |
| FR-RD-05.2 | When asked about an owner or co-rider, the chatbot shall disclose only the public profile fields of FR-RD-02.4. | Must | Test | — |
| FR-RD-05.3 | When the rider asks the chatbot to change a preference or tag, the system shall show the proposed change and apply it only if the rider confirms it; an unconfirmed proposal shall lapse after 10 minutes. | Must | Test | — |
| FR-RD-05.4 | The chatbot shall not submit, withdraw or reconfirm join requests, record payments, submit ratings or complaints, post pool chat messages, or raise or cancel SOS alerts; when asked to, it shall reply with a link to the screen where the rider can do so. | Must | Test | — |
| FR-RD-05.5 | The chatbot shall decline requests unrelated to ride pooling on the platform with a short scope message. | Should | Test | — |
| FR-RD-05.6 | The system shall keep chatbot conversation content only in the browser tab where it takes place, discarding it when the tab is closed or reloaded or the rider signs out; it shall never use one rider's conversation in another rider's session, and shall let the rider clear it. | Must | Test | — |
| FR-RD-05.7 | If the AI service is unavailable, the chatbot shall say so and link to manual search. | Must | Test | — |

## UR-RD-06 — Requesting to join a ride

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-06.1 | When a rider submits a join request for a ride and a pickup point, the system shall create the request in state Pending, store a snapshot of the ride's departure time, the rider's estimated pickup time and the rider's estimated share, and notify the ride owner. | Must | Test | Shared: RO |
| FR-RD-06.2 | If, at submission, the ride is not open, has no available seat or is past its lock time; the rider already has an active or accepted request on it; the ride departs within 2 hours (P-08) of a ride on which the rider holds an accepted seat; the rider already has 3 (P-07) active requests; or the rider is suspended, then the system shall reject the submission and state the reason. | Must | Test | — |
| FR-RD-06.3 | When the ride owner accepts a request, the system shall, as one atomic operation, re-check that the ride is open with at least one available seat, that the request is still Pending, and that the rider holds no conflicting accepted seat, and only then mark the request Accepted and reduce the available seats by one; if any check fails, the acceptance shall have no effect and the outcome in Table T-1 shall apply.<br>*Rationale: concurrent acceptances must never allocate more seats than exist, however stale the owner's or rider's view is.* | Must | Test | Critical; Shared: RO |
| FR-RD-06.4 | When a request is accepted or rejected, the system shall notify the rider within 2 seconds (P-13), and an accepted ride shall appear in the rider's upcoming rides. | Must | Test | Shared: RO |
| FR-RD-06.5 | If, while a request is Pending, the ride's departure time or the rider's estimated pickup time moves by more than 10 minutes (P-09), or the rider's estimated share rises by more than 20 % (P-10), relative to the stored snapshot, then the system shall change the request to Needs Reconfirmation, show the rider the old and new values, and prevent the owner from accepting it until the rider reconfirms.<br>*Rationale: addresses itinerary drift — the second concurrency challenge in the proposal.* | Must | Test | Critical; Shared: RO |
| FR-RD-06.6 | When the rider reconfirms a request, the system shall replace its snapshot with current values and return it to Pending, keeping its original submission time for ordering; when the rider declines, the request shall become Withdrawn. | Must | Test | — |
| FR-RD-06.7 | The system shall mark an active request Expired when the ride reaches its lock time, and Ride Cancelled when the owner cancels the ride, notifying the rider in both cases. | Must | Test | Shared: RO |
| FR-RD-06.8 | When a request is accepted, the system shall withdraw the rider's other active requests for rides departing within 2 hours (P-08) of the accepted ride and notify the affected owners. | Must | Test | Shared: RO |
| FR-RD-06.9 | The system shall treat repeated submissions carrying the same idempotency key within 24 hours (P-20) as one request.<br>*Rationale: retries and double taps on a slow network must not create duplicate requests.* | Must | Test | — |
| FR-RD-06.10 | The system shall show the rider the current state, state history and reason codes of each of their requests. | Must | Test | — |
| FR-RD-06.11 | When the owner cancels a ride on which the rider holds an accepted seat, before or after lock time, the system shall set the request to Ride Cancelled, release the rider from any share of that ride's fare, close its pool chat to new messages, and notify the rider within 2 seconds (P-13); pool chat retention (FR-RD-09.5) runs from the cancellation time.<br>*Rationale: no fare liability may outlive the ride it pays for.* | Must | Test | Shared: RO |

## UR-RD-07 — Withdrawing and leaving

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-07.1 | The system shall allow the rider to withdraw an active request at any time; the request becomes Withdrawn and the owner is notified. | Must | Test | Shared: RO |
| FR-RD-07.2 | When an accepted rider leaves a ride before its lock time, the system shall, as one atomic operation, mark the request Left and increase the available seats by one; the freed seat shall be visible to searching riders within 2 seconds (P-13) and the remaining occupants' shares shall be recomputed (FR-RD-08.2). | Must | Test | Critical; Shared: RO |
| FR-RD-07.3 | When an accepted rider leaves after the lock time and before the trip starts (trip state Scheduled; glossary: trip start), the system shall require explicit confirmation, record a late cancellation in the rider's history and keep the rider's locked share payable (FR-RD-11.1).<br>*Rationale: the other occupants committed on the basis of the locked split.* | Should | Test | Shared: RO |
| FR-RD-07.4 | If, after acceptance, the ride's departure time or the rider's pickup time changes by more than 10 minutes (P-09), then the rider may leave until the trip starts (trip state Scheduled) without a late-cancellation record or fare liability. | Must | Test | Shared: RO |
| FR-RD-07.5 | The system shall not allow a rider to leave a trip whose state is Pickup in Progress or later (FR-RD-10.1); SOS shall remain available (UR-RD-15). | Must | Test | — |
| FR-RD-07.6 | If a change to a ride's departure time makes it depart within 2 hours (P-08) of another ride on which the rider holds an accepted seat, the system shall notify the rider of the conflict and allow them to leave either ride, until its trip starts, without a late-cancellation record or fare liability. | Should | Test | Shared: RO |

## UR-RD-08 — Fare share

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-08.1 | Before a request is submitted, the system shall show the rider's estimated share as the ride's total fare divided by (current occupants + 1), rounded up to the next rupee, labelled as an estimate. | Must | Test | — |
| FR-RD-08.2 | When the number of occupants changes before lock time, the system shall recompute every occupant's share and notify each rider whose share changed, showing old and new amounts. | Must | Test | Shared: RO |
| FR-RD-08.3 | At lock time the system shall fix each occupant's share and shall not change it afterwards, except as FR-RD-07.3 provides. | Must | Test | Shared: RO |
| FR-RD-08.4 | The system shall compute shares in whole rupees such that they sum exactly to the ride's total fare, using the rule in Table T-2. | Must | Test | Critical; Shared: RO |
| FR-RD-08.5 | The system shall show a fare breakdown: total fare, the fare band it comes from (destination and vehicle type), number of occupants, and each occupant's share including any rounding remainder. | Must | Test | Shared: RO |
| FR-RD-08.6 | When a recomputation raises an accepted rider's share by more than 20 % (P-10) of their share at acceptance, the system shall highlight the increase in the notification. | Should | Test | — |

## UR-RD-09 — Pool chat

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-09.1 | When a ride locks, the system shall open a pool chat for the owner and accepted riders and notify each member. | Must | Test | Shared: RO |
| FR-RD-09.2 | The system shall deliver each chat message to all connected members within 1 second (NFR-RD-03) and persist it, so that members who were offline see it when they return. | Must | Test | Shared: RO |
| FR-RD-09.3 | Only current members of a pool shall be able to read or post in its chat; a rider who leaves loses access immediately. | Must | Test | Shared: RO |
| FR-RD-09.4 | The system shall accept only text messages of at most 500 characters, and at most 20 messages per minute per member (P-14). | Must | Test | Shared: RO |
| FR-RD-09.5 | The system shall make a pool chat read-only 24 hours after trip completion or ride cancellation and delete it 30 days after that time (P-15), unless an unresolved complaint references it, in which case it is kept until the complaint is resolved. | Must | Test | Shared: RO, AD |
| FR-RD-09.6 | The system shall allow a member to report a chat message, which opens a complaint (FR-RD-13.1) pre-filled with a reference to the message. | Should | Test | Shared: AD |
| FR-RD-09.7 | The system shall offer a one-tap "I am at the pickup point" message. | Could | Demo | — |

## UR-RD-10 — Following the trip

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-10.1 | The system shall show the rider the trip state — Scheduled, Pickup in Progress, In Transit, Completed or Cancelled — as set by the ride owner. | Must | Test | Shared: RO |
| FR-RD-10.2 | The system shall show the rider the pickup order, each occupant's pickup point and the rider's own estimated pickup time, updated whenever the itinerary changes. | Must | Test | Shared: RO |
| FR-RD-10.3 | When the owner marks the rider as a no-show — permitted only after the grace period of P-19 — the system shall notify the rider and record the no-show; the rider may dispute it through a complaint (FR-RD-13.1). | Must | Test | Shared: RO |
| FR-RD-10.4 | The system shall allow the rider to check in at their pickup point, visible to the pool. | Should | Test | Shared: RO |

## UR-RD-11 — Fare settlement

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-11.1 | When a trip is completed, the system shall set each rider's locked share to Due and show the amount payable to the owner. | Must | Test | Shared: RO |
| FR-RD-11.2 | The system shall allow the rider to mark a Due share as paid, with the method (UPI or cash) and an optional reference of up to 50 characters; the share becomes Marked Paid and the owner is notified. | Must | Test | Shared: RO |
| FR-RD-11.3 | When the owner confirms receipt, the share shall become Confirmed; when the owner disputes it, the share shall become Disputed, the rider shall be notified and a Payment complaint shall be opened for administrator review. | Must | Test | Shared: RO, AD |
| FR-RD-11.4 | The system shall remind the rider of a Due share 24 and 72 hours after trip completion (P-18). | Should | Test | — |
| FR-RD-11.5 | The system shall block new join requests from a rider with a share Due for more than 7 days after trip completion (P-18), stating the reason. | Should | Test | — |
| FR-RD-11.6 | If the owner has registered a UPI ID, the system shall offer a UPI payment link pre-filled with the rider's share. | Could | Demo | Shared: RO |

## UR-RD-12 — Ratings

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-12.1 | Within 72 hours (P-16) of trip completion, the system shall allow the rider to rate the owner and each co-rider of that trip from 1 to 5. | Must | Test | Shared: RO |
| FR-RD-12.2 | The system shall accept at most one rating per rater, trip and ratee, shall not allow rating oneself or anyone who was not an occupant of the same completed trip, and shall not allow a submitted rating to be changed. | Must | Test | Shared: RO |
| FR-RD-12.3 | The system shall show others only a person's average rating and number of ratings, and only once at least 3 ratings exist (P-24); individual ratings and raters shall never be disclosed.<br>*Rationale: prevents identifying who gave a low rating.* | Must | Test | Shared: RO |
| FR-RD-12.4 | When the rider gives a rating of 1 or 2, the system shall offer to open a complaint. | Should | Test | — |

## UR-RD-13 — Complaints

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-13.1 | Within 7 days (P-17) of a trip's completion or of a no-show, the system shall allow the rider to file a complaint against the owner or a co-rider of that trip, with a category (Safety, Harassment, Tardiness, Payment, No-show, Other) and a description of 20–2000 characters. | Must | Test | Shared: AD |
| FR-RD-13.2 | When a complaint is submitted, the system shall give the rider a complaint reference and forward the complaint to complaint management. | Must | Test | Shared: AD |
| FR-RD-13.3 | The system shall never reveal a complainant's identity or complaint text to the person complained about or to other riders.<br>*Rationale: confidentiality is a precondition for honest reporting.* | Must | Test | Critical; Shared: AD |
| FR-RD-13.4 | The system shall accept at most one complaint per complainant, trip and accused person, and at most 5 complaints per rider in any 24 hours (P-17). | Must | Test | Shared: AD |
| FR-RD-13.5 | The system shall show the rider their complaint's status — Submitted, Under Review or Resolved — and, once resolved, whether action was taken, without disclosing the sanction applied. | Must | Test | Shared: AD |
| FR-RD-13.6 | When the category Safety is selected, the system shall display the emergency contacts of FR-RD-15.3 and, if the rider's trip is in progress, offer the SOS action. | Must | Test | Shared: AD |

## UR-RD-14 — Notifications

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-14.1 | The system shall notify the rider in real time of: a request accepted, rejected, expired, automatically withdrawn or needing reconfirmation; a ride cancelled; a departure or pickup time changed; a share changed; a ride locked and its chat opened; a trip state change; a no-show recorded; a settlement status change or reminder; a complaint status change; and a warning or suspension. | Must | Test | Shared: RO, AD |
| FR-RD-14.2 | The system shall keep a notification centre listing notifications from the last 30 days (P-21), with an unread count and a mark-as-read action. | Must | Test | Shared: RO, AD |
| FR-RD-14.3 | When the rider is not connected, the system shall also email notifications of request acceptance, ride cancellation and departure changes of more than 10 minutes. | Should | Demo | Shared: RO |
| FR-RD-14.4 | The system shall support browser push notifications where the rider permits them. | Could | Demo | Shared: RO, AD |

## UR-RD-15 — SOS

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-15.1 | While the rider's trip is Pickup in Progress or In Transit, the system shall show an SOS action that requires a confirmation step before raising an alert. | Must | Test | Shared: AD |
| FR-RD-15.2 | When the rider raises an SOS, the system shall create an incident visible to administrators within 5 seconds (P-22), containing the rider, the ride and trip, all occupants, the vehicle, the pickup points and the time, plus the rider's mobile number if provided (FR-RD-02.7) and current coordinates if the rider has granted location permission. | Must | Test | Critical; Shared: AD |
| FR-RD-15.3 | The SOS screen shall display the IIT Kanpur security emergency number and the national emergency number 112, and shall state that the platform does not dispatch emergency services. | Must | Inspection | Shared: AD |
| FR-RD-15.4 | The system shall not show an SOS alert to the other members of the pool.<br>*Rationale: the source of danger may be a co-traveller.* | Must | Test | Shared: AD |
| FR-RD-15.5 | The system shall allow the rider to mark their SOS as a false alarm; the incident shall be kept for administrator review. | Must | Test | Shared: AD |

## UR-RD-16 — History and personal data

| ID | Requirement | Priority | Verification | Flags |
|---|---|---|---|---|
| FR-RD-16.1 | The system shall show the rider their past rides with date, destination, share, settlement status and ratings given. | Must | Test | — |
| FR-RD-16.2 | The system shall ask for the rider's consent to use their interest tags in AI suggestions and allow the consent to be withdrawn at any time; without consent, the rider's tags shall not be sent to the AI service or used in ranking. | Must | Test | Shared: AD |
| FR-RD-16.3 | When a rider requests account deletion, the system shall delete or anonymise their personal data within 30 days (P-25), keeping only the records needed for unresolved complaints or settlements until those are closed. | Should | Test | Shared: AD |
| FR-RD-16.4 | The system shall allow the rider to download their own data in a machine-readable format. | Could | Demo | Shared: AD |

---

## Structured specifications

### S-1 — Submit join request (FR-RD-06.1, 06.2, 06.9)

| Field | Specification |
|---|---|
| Function | Submit a join request |
| Description | Creates a request for one seat on an open ride from a chosen pickup point |
| Inputs | Ride ID, pickup point ID, idempotency key |
| Source | Rider, from the ride details view or an AI suggestion |
| Outputs | Request ID and state, or a rejection reason |
| Destination | Rider's request list; ride owner's pending requests |
| Action | Validate the conditions of FR-RD-06.2 in order and reject with the first failing reason. Otherwise compute the rider's pickup time and estimated share, store the request as Pending with that snapshot, and notify the owner. A repeated key within 24 hours returns the existing request unchanged |
| Requires | A verified, unsuspended rider; an open ride; configured pickup points |
| Precondition | The rider has fewer than 3 active requests and no active or accepted request on this ride |
| Postcondition | Exactly one Pending request exists for this rider and ride, with a snapshot |
| Side effects | Owner notified; the ride's pending-request count increases |

### S-2 — Reconfirm after drift (FR-RD-06.5, 06.6)

| Field | Specification |
|---|---|
| Function | Reconfirm a join request after itinerary drift |
| Description | Obtains the rider's consent to a changed departure time, pickup time or share before the owner may accept |
| Inputs | Request ID, rider decision (reconfirm or decline) |
| Source | Rider, from the Needs Reconfirmation notification or request list |
| Outputs | Request in state Pending (reconfirmed) or Withdrawn (declined) |
| Destination | Rider's request list; owner's pending requests |
| Action | On reconfirm, replace the snapshot with current values, set Pending and keep the original submission time. On decline, set Withdrawn and notify the owner |
| Requires | The ride is open and before lock time |
| Precondition | The request is in Needs Reconfirmation |
| Postcondition | The request is Pending with a current snapshot, or Withdrawn |
| Side effects | Owner notified of the outcome |

### S-3 — Ask AI to Suggest (FR-RD-04.1–04.5)

| Field | Specification |
|---|---|
| Function | Produce ranked, explained ride suggestions |
| Description | Ranks candidate open rides for the rider's search with pros and cons |
| Inputs | Destination, date, time window, pickup point; the rider's tags if consent is given (FR-RD-16.2) |
| Source | Rider, from the search view |
| Outputs | Up to 5 ranked rides, each with up to 3 pros and 3 cons; or the fallback ranking |
| Destination | Rider's search view |
| Action | Gather candidate rides under FR-RD-03.2 and compute each one's share, pickup time and shared tags. Send only permitted fields (AI-RD-10) to the AI service. Validate the response (FR-RD-04.3), remove invalid rides, replace unverifiable explanations, and log the trace (AI-RD-12). On error, on timeout, or if no suggestion survives validation, use the deterministic ranking (FR-RD-04.5) |
| Requires | A reachable AI service for the AI path; none for the fallback |
| Precondition | A valid search with at least one candidate ride |
| Postcondition | Every displayed suggestion refers to an open ride with an available seat, and every stated figure matches a computed value |
| Side effects | AI trace record written; AI quota consumed |

### S-4 — Leave a ride (FR-RD-07.2–07.4)

| Field | Specification |
|---|---|
| Function | Leave an accepted ride |
| Description | Releases the rider's seat and applies fare consequences according to timing |
| Inputs | Request ID, confirmation where required |
| Source | Rider, from upcoming rides |
| Outputs | Request in state Left; updated shares; any liability record |
| Destination | Rider's history; owner and occupants; searching riders |
| Action | Before lock time: atomically set Left and increase available seats by one, then recompute shares and notify occupants. After lock time and before the trip starts: require confirmation and set Left, keeping the locked share payable and recording a late cancellation unless FR-RD-07.4 applies |
| Requires | Trip state Scheduled (the trip has not started; see glossary) |
| Precondition | The request is Accepted |
| Postcondition | The seat count is consistent with the number of occupants; shares still sum to the total fare (Table T-2) |
| Side effects | Freed seat visible to searchers within 2 seconds; notifications sent |

## Tabular specifications

### T-1 — Outcome of an acceptance attempt (FR-RD-06.3)

All conditions are evaluated together, inside the atomic operation.

| Condition at acceptance | Outcome |
|---|---|
| Request Pending, ride open, ≥ 1 available seat, no conflicting accepted seat | Request Accepted; available seats − 1; conflicting active requests withdrawn (FR-RD-06.8); rider notified |
| Ride open but no available seat | No effect; request stays Pending; owner told the ride is full |
| Request Needs Reconfirmation | No effect; owner told the rider must reconfirm |
| Request Withdrawn, Expired or Ride Cancelled | No effect; owner told the request is no longer active |
| Rider already holds a conflicting accepted seat (e.g. accepted concurrently elsewhere) | Request Rejected, reason "conflicting ride"; rider and owner notified |
| Ride locked or cancelled | No effect; request handled by FR-RD-06.7 |

### T-2 — Fare shares in whole rupees (FR-RD-08.4)

Let **F** be the ride's total fare in rupees and **n** the number of occupants (owner first, then
accepted riders in order of acceptance). Let **q** = ⌊F / n⌋ and **r** = F − n·q.

| Occupants | Share |
|---|---|
| The first r occupants | q + 1 |
| The remaining n − r occupants | q |

Example: F = ₹350, n = 3 → q = 116, r = 2 → shares ₹117, ₹117, ₹116 (sum ₹350).
The pre-request estimate of FR-RD-08.1 is ⌈F / (n + 1)⌉, which is never lower than the share actually
assigned on joining.

### T-3 — Itinerary drift (FR-RD-06.5, 07.4, 07.6, 08.2, 08.6)

| Request state | Change (relative to snapshot or acceptance) | Effect |
|---|---|---|
| Pending | Departure or pickup time moves > 10 min, or share rises > 20 % | Needs Reconfirmation; owner cannot accept |
| Pending | Changes within those thresholds | Stays Pending; rider sees updated values |
| Accepted, before lock | Share changes | Recomputed and notified; rises > 20 % highlighted |
| Accepted | Departure or pickup time moves > 10 min | Rider notified; may leave without liability until the trip starts |
| Accepted | Departure moves to within 2 h (P-08) of another of the rider's accepted rides | Rider notified of the conflict; may leave either ride without liability until its trip starts |
| Accepted, after lock | Occupancy changes | Shares stay fixed |

---

## Validation checklist

| Check | How this section addresses it |
|---|---|
| Validity | Every user requirement traces to the D0 proposal's rider role, workflow, concurrency challenges or AI features, or to a settled team decision |
| Consistency | Every threshold is defined once (`01` §5) and referenced by ID; request states are used identically in FRs, T-1, T-3 and the state diagram |
| Completeness | Each user requirement is refined into system requirements covering the normal path, rejections, timeouts and failure behaviour |
| Realism | Scope excludes payment processing, live tracking and group booking; targets are sized to the course workload baseline |
| Verifiability | Each requirement names a verification method; quantities are explicit rather than "fast" or "secure" |

**Open items for reconciliation with the Ride Owner and Admin sections:** lock-time rule (P-06);
trip state transitions; no-show procedure; liability when leaving after lock (FR-RD-07.3); owner
cancellation after lock (FR-RD-06.11); drift-induced conflicts between accepted rides (FR-RD-07.6);
dispute handling for settlements; complaint outcomes shown to riders; SOS handling, including
administrator access to the rider's mobile number (FR-RD-02.7).
