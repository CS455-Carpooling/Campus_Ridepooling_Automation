# AI Log: Ride Owner Requirements Engineering

## Phase 1: Ride Owner User Stories

### Entry 01 — Understanding the Ride Owner Scope

**User Prompt:**
I want to work on the **Ride Owner** part of our campus ride-pooling system first. Go through all the Ride Owner requirement-related files and understand what the Ride Owner is supposed to do in the system. Then explain each file to me in simple terms and tell me what information we should extract from them for the requirements engineering work.

**AI Response:**
Reviewed the Ride Owner files and identified the main responsibilities of the Ride Owner, including creating and managing rides, handling Rider requests, managing capacity and fare information, dealing with arrivals/no-shows, and completing external fare settlement. It also identified the README as the high-level index for the detailed requirement documents.

**Action:**
Established the Ride Owner scope before beginning the requirements and user-story design.

---

### Entry 02 — Generating Initial User Stories

**User Prompt:**
Now based only on the Ride Owner files, generate the user stories for the Ride Owner. I want them in proper Agile format: **As a Ride Owner, I want ..., so that ...**. Cover all the major actions and edge cases, not just the basic create-ride flow.

**AI Response:**
Generated an initial set of Ride Owner user stories covering ride creation, specifying source/destination/time, setting capacity and fare, receiving Rider join requests, managing passengers, handling arrivals and no-shows, and completing fare settlement.

**Action:**
Created the first draft of the Ride Owner user stories.

---

### Entry 03 — Catching Incorrect Automatic Joining Behaviour

**User Prompt:**
There is an important issue in the stories. You have described the Rider being automatically added to the ride after requesting to join. **That is not how our system works.** The Ride Owner must manually review every request and either accept or reject it. Please go through all the stories again and make sure nowhere you imply automatic joining, automatic acceptance, or automatic seat allocation.

**AI Response:**
Acknowledged the inconsistency and revised the affected stories. The updated flow explicitly states that a Rider submits a join request, the Ride Owner reviews it, and the Ride Owner manually accepts or rejects the request. Seat occupancy and fare information are updated only after acceptance.

**Action:**
Corrected the core Ride Owner request-management workflow and removed the automatic-acceptance assumption.

---

### Entry 04 — Adding Edge Cases

**User Prompt:**
The revised stories are better, but add the cases where the Ride Owner has to deal with the ride becoming full, a Rider not showing up, or the ride being locked. Also include what happens when the actual number of passengers changes because of these events.

**AI Response:**
Expanded the user stories to include capacity reaching its limit, ride locking, Rider arrival/no-show handling, and updating passenger/fare information according to the resulting ride state.

**Action:**
Expanded the user-story set to cover the important Ride Owner lifecycle and edge cases.

---

### Entry 05 — Accepting the Final User Stories

**User Prompt:**
Go through the complete set one final time against the Ride Owner files. Make sure the wording is consistent and there are no assumptions that aren't in our requirements. Don't add unnecessary AI functionality here.

**AI Response:**
Performed a consistency check and produced the consolidated Ride Owner user stories with manual join-request acceptance/rejection and the required ride-management lifecycle.

**Action:**
**User accepted the final Ride Owner user stories.**

---

# Phase 2: Converting User Stories into User Requirements

### Entry 06 — Framing User Requirements

**User Prompt:**
Now convert these finalized user stories into formal **user requirements**. I don't want implementation details yet. Write them from the perspective of what the Ride Owner needs the system to allow them to accomplish.

**AI Response:**
Converted the stories into structured Ride Owner user requirements covering ride creation, ride information management, request review, capacity control, ride locking, arrival/no-show handling, and fare settlement.

**Action:**
Converted the Agile-style stories into formal requirements.

---

### Entry 07 — Correcting the Fare Requirement

**User Prompt:**
I noticed that the fare requirement is too vague. The Ride Owner should not just "manage fare". The requirement should explicitly mention that the owner can define the fare/cost information for the ride and that the amount has to be updated when the passenger composition changes. Add this properly without turning it into a technical implementation requirement.

**AI Response:**
Revised the fare-related requirement to explicitly cover fare definition and adjustment based on the final passenger composition while keeping the requirement at the user/system-behaviour level.

**Action:**
Clarified the financial responsibility of the Ride Owner in the requirements.

---

### Entry 08 — Adding Manual Request Decision

**User Prompt:**
Also add a separate requirement for the most important part of the Ride Owner workflow: when a Rider sends a request, the Ride Owner must be able to **view the request and manually accept or reject it**. This should be a distinct requirement, not buried inside ride management.

**AI Response:**
Added a dedicated requirement for viewing pending Rider requests and manually accepting or rejecting each request.

**Action:**
Made the manual approval workflow explicit as a standalone requirement.

---

### Entry 09 — Final User Requirement Review

**User Prompt:**
Now give me the complete Ride Owner user-requirement list after incorporating those corrections. Check that every requirement can be traced back to one or more user stories and that we haven't introduced anything outside the Ride Owner scope.

**AI Response:**
Produced the consolidated Ride Owner requirements and ensured that they corresponded to the previously finalized stories.

**Action:**
**User accepted the final Ride Owner user requirements.**

---

# Phase 3: Functional vs Non-Functional Requirements

### Entry 10 — Splitting the Requirements

**User Prompt:**
Take the finalized Ride Owner requirements and split them into **Functional Requirements and Non-Functional Requirements**. Keep the original requirement meaning intact and explain briefly why each belongs in that category.

**AI Response:**
Separated the requirements into functional behaviour and quality/system constraints.

**Action:**
Generated the first Functional/NFR classification.

---

### Entry 11 — Catching a Misclassified Non-Functional Requirement

**User Prompt:**
I think you have classified one requirement incorrectly. The requirement about the system responding quickly when the Ride Owner checks or acts on requests is **not a functional requirement** because it doesn't describe what the system does; it describes how well the system should perform. Move that to the non-functional requirements and adjust the classification accordingly.

**AI Response:**
Agreed and moved the response-time/performance constraint to the Non-Functional Requirements section. The remaining functional requirements were kept focused on actual Ride Owner capabilities and system actions.

**Action:**
Corrected the functional/NFR classification based on the nature of the requirement rather than its associated feature.

---

### Entry 12 — Final Functional/NFR Validation

**User Prompt:**
Give me the final split now. Check specifically that every functional requirement describes a capability or behaviour and every NFR describes a quality attribute such as performance, reliability, security, usability, or consistency.

**AI Response:**
Presented the corrected Functional Requirement and Non-Functional Requirement sets with the revised performance requirement under NFRs.

**Action:**
**User accepted the final Functional/NFR classification.**

---

# Phase 4: Requirements Traceability

### Entry 13 — Creating the Traceability Matrix

**User Prompt:**
Using the final Ride Owner user stories and the final functional/non-functional requirements, create a **requirements traceability matrix**. I want to be able to show that every requirement came from an actual user story. Include columns for User Story ID, Requirement ID, Requirement Description, and Traceability/Relationship.

**AI Response:**
Generated a traceability matrix mapping each Ride Owner user story to the corresponding functional and non-functional requirements.

**Action:**
Created the traceability chain from stakeholder need → user story → system requirement.

---

### Entry 14 — Checking for Missing Traceability

**User Prompt:**
Before I use it, check whether every user story has at least one requirement and whether any requirement is currently orphaned. Don't just assume the matrix is complete.

**AI Response:**
Verified the mappings and confirmed that the requirements were connected to the relevant Ride Owner user stories.

**Action:**
Traceability matrix validated and accepted.

---

# Phase 5: Ride Owner Use Case Diagram

### Entry 15 — Generating the Initial Use Case Diagram

**User Prompt:**
Now generate the **Ride Owner use-case diagram** from the finalized requirements. Keep it focused on the Ride Owner's functionality and show the actors, system boundary, use cases, and relevant relationships such as include/extend where necessary.

**AI Response:**
Generated an initial use-case diagram containing Ride Owner functionality, but also represented **Rider and Admin as major actors** in several interactions.

**Action:**
Initial diagram reviewed for scope correctness.

---

### Entry 16 — Correcting the Diagram Scope

**User Prompt:**
The diagram is becoming a general system use-case diagram. This deliverable is specifically for the **Ride Owner**. Rider and Admin should not appear as key actors dominating the diagram. Their interactions can be implicit where necessary, but the diagram should primarily show what the Ride Owner does. Rework the diagram around the Ride Owner actor.

**AI Response:**
Revised the diagram so that **Ride Owner is the primary actor** and the use cases are centred around Ride Owner responsibilities such as:

* Create/manage ride
* Define ride details
* View Rider requests
* Accept/reject requests
* Manage ride capacity
* Lock ride
* Handle arrivals/no-shows
* Manage fare/settlement information

Other actors were removed or reduced to avoid diluting the scope.

**Action:**
Corrected the use-case diagram to match the Ride Owner-specific deliverable.

---

### Entry 17 — Use Case Diagram Final Check

**User Prompt:**
Check the final diagram against the user stories and requirements. Every major Ride Owner requirement should have a corresponding use case, and there shouldn't be unrelated system functionality in the diagram.

**AI Response:**
Verified the diagram against the finalized Ride Owner requirements and confirmed that the represented use cases correspond to the Ride Owner workflow.

**Action:**
**User accepted the final Ride Owner use-case diagram.**

---

# Phase 6: AI Integration Check

### Entry 18 — Verifying Whether Ride Owner Needs AI

**User Prompt:**
One more thing: our overall project has AI/LLM components, but do we actually need AI integration in the **Ride Owner module**? Check the Ride Owner requirements specifically rather than assuming that every module needs AI.

**AI Response:**
Reviewed the Ride Owner functionality and concluded that the core Ride Owner requirements do not require an AI/LLM component. The required actions—creating rides, reviewing requests, accepting/rejecting Riders, managing capacity, handling arrivals/no-shows, and fare/settlement operations—can be implemented through deterministic business logic.

**Action:**
Established that AI integration belongs to other project components and is not a required part of the Ride Owner functionality.

---

### Entry 19 — Confirming the Architectural Boundary

**User Prompt:**
So for the architecture and requirements document, should we explicitly state that the Ride Owner functionality is **non-AI**, while AI is used only where the project requirements actually demand it? I don't want AI artificially added just because the overall project uses AI.

**AI Response:**
Confirmed that the Ride Owner requirements should remain independent of AI integration and that AI should only be introduced in the project components where it provides a requirement-driven function.

**Action:**
Finalized the Ride Owner module as a deterministic, non-AI subsystem.

---

# Phase 7: Formal Ride Owner Requirements Document

### Entry 20 — Preparing the Formal Document

**User Prompt:**
Now take everything we finalized for the Ride Owner—user stories, user requirements, functional and non-functional requirements, traceability, use-case scope, and the AI integration decision—and prepare it as one formal requirements document suitable for our CS455 submission. Keep the terminology consistent across all sections and don't introduce anything new at this stage.

**AI Response:**
Prepared a consolidated formal Ride Owner requirements document containing the finalized user stories, requirements, Functional/NFR classification, traceability mapping, and Ride Owner use-case scope. It also explicitly maintained the distinction that the Ride Owner workflow does not require AI integration.

**Action:**
Generated the final formal Ride Owner requirements artifact.

---

### Entry 21 — Final Acceptance

**User Prompt:**
Do one last consistency check across the entire Ride Owner document. The user stories, requirements, functional/NFR split, traceability matrix, and use-case diagram description should all describe the same workflow, especially the **manual accept/reject of Rider requests**. If everything is consistent, keep it as the final version.

**AI Response:**
Completed the consistency check and confirmed that the final document consistently represents manual Rider-request acceptance/rejection, Ride Owner-controlled capacity and fare management, ride lifecycle handling, and the non-AI nature of the Ride Owner module.

**Action:**
**Final Ride Owner requirements package accepted for use in the project.**
