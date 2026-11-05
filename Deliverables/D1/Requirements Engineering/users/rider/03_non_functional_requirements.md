# Rider — Non-Functional Requirements

Non-functional requirements that constrain the rider's use of the system, classified as product,
organizational or external requirements. Each has a measurable target and a verification method.

**Design workload.** The course baseline of at least 100 daily active users and 250 core
transactions per day, with a peak of 20 riders using the system concurrently (for example before a
holiday weekend). Performance targets apply at this load.

## Product requirements

### Efficiency — performance

| ID | Requirement | Metric / target | Priority | Verification | Use cases | Flags |
|---|---|---|---|---|---|---|
| NFR-RD-01 | Ride search shall respond quickly at design load. | p95 ≤ 1.5 s, p99 ≤ 3 s, server-side, at 20 concurrent riders | Must | Test | UC-RD-03 | — |
| NFR-RD-02 | Submitting, withdrawing or reconfirming a join request shall respond quickly at design load. | p95 ≤ 1 s at 20 concurrent riders | Must | Test | UC-RD-06, UC-RD-07, UC-RD-17 | — |
| NFR-RD-03 | Changes to seats, times, request states and chat messages shall reach connected riders promptly. | Seat, time and state changes delivered p95 ≤ 2 s (P-13); chat messages p95 ≤ 1 s | Must | Test | UC-RD-03, UC-RD-06, UC-RD-09, UC-RD-14 | — |
| NFR-RD-04 | AI features shall respond within a bounded time. | AI suggestions and chatbot replies p95 ≤ 8 s (P-12); fallback shown ≤ 1 s after timeout | Must | Test | UC-RD-04, UC-RD-05 | — |

### Dependability

| ID | Requirement | Metric / target | Priority | Verification | Use cases | Flags |
|---|---|---|---|---|---|---|
| NFR-RD-05 | Seat allocation shall remain correct under concurrent access. | With ≥ 50 concurrent acceptance and leave operations on a ride with one available seat, repeated 100 times: 0 over-allocations, and seat count always equals capacity minus occupants | Must | Test | UC-RD-06, UC-RD-07 | Critical |
| NFR-RD-06 | A join request acknowledged to the rider shall not be lost. | 0 acknowledged requests lost across a forced server restart during a load run (request persisted before acknowledgement) | Must | Test | UC-RD-06 | — |
| NFR-RD-07 | Rider-facing functions shall be available at all hours, since early trains and flights put many departures between 00:00 and 06:00. | ≥ 99 % availability, 24 hours a day, per month, measured by external uptime checks | Should | Analysis | All | — |
| NFR-RD-08 | Failure of an external service shall not stop core rider functions. | With the AI service or email service unavailable: search, join, withdraw, pool chat and SOS all remain usable (demonstrated in a failure test) | Must | Test | UC-RD-03, UC-RD-06, UC-RD-07, UC-RD-09, UC-RD-15 | — |

### Security

| ID | Requirement | Metric / target | Priority | Verification | Use cases | Flags |
|---|---|---|---|---|---|---|
| NFR-RD-09 | A rider shall be able to read or modify only their own requests, settlements, complaints and notifications, and only the chats of pools they belong to, enforced on the server. | 0 successful accesses in authorization-abuse tests that substitute other users' or pools' identifiers on every rider endpoint | Must | Test | All | Critical |
| NFR-RD-10 | All rider input shall be validated on the server. | Every endpoint validates types, lengths and enumerations against a schema; injection test cases (SQL/NoSQL, script, oversized input) all rejected | Must | Test | All | — |
| NFR-RD-11 | Abuse-prone operations shall be rate-limited. | One-time codes ≤ 3 per email per 15 min; join submissions ≤ 10 per rider per min; AI requests ≤ 20 per rider per hour | Must | Test | UC-RD-01, UC-RD-04, UC-RD-05, UC-RD-06 | — |
| NFR-RD-12 | Personal data shall be protected in transit and in logs. | All traffic over HTTPS/WSS; application logs contain no email addresses, phone numbers, chat content or complaint text (log inspection); AI traces use pseudonymous rider IDs | Must | Inspection | All | — |

### Usability

| ID | Requirement | Metric / target | Priority | Verification | Use cases | Flags |
|---|---|---|---|---|---|---|
| NFR-RD-13 | A new rider shall be able to join a ride without help. | ≥ 80 % of first-time test users (n ≥ 5) submit a join request within 5 minutes of first sign-in, unaided | Should | Test | UC-RD-02, UC-RD-03, UC-RD-06 | — |
| NFR-RD-14 | Joining a ride from search results shall take few interactions. | ≤ 3 interactions from a search result to a submitted request | Must | Inspection | UC-RD-03, UC-RD-06 | — |
| NFR-RD-15 | Rider screens shall work on phones and meet basic accessibility. | Usable without horizontal scrolling at 360 px width; text contrast meets WCAG 2.1 AA | Should | Inspection | All | — |

## Organizational requirements

| ID | Requirement | Metric / target | Priority | Verification | Use cases | Flags |
|---|---|---|---|---|---|---|
| NFR-RD-16 | *Environmental.* The rider interface shall support current browsers. | Latest two versions of Chrome, Firefox, Edge and Safari (iOS) | Should | Test | All | — |
| NFR-RD-17 | *Development.* Rider modules shall be developed in TypeScript and covered by automated tests. | ≥ 80 % statement coverage of rider modules; continuous integration rejects changes below this | Must | Analysis | All | — |
| NFR-RD-18 | *Operational.* Rider-facing services shall be deployed on the chosen cloud platform within free-tier limits and expose health checks. | Deployed on GCP; health endpoint per service; no free-tier limit exceeded during the load test | Must | Inspection | All | — |

## External requirements

| ID | Requirement | Metric / target | Priority | Verification | Use cases | Flags |
|---|---|---|---|---|---|---|
| NFR-RD-19 | *Legislative.* Rider data handling shall follow the principles of India's Digital Personal Data Protection Act, 2023: purpose limitation, data minimisation and consent. | Only data listed in `01` and `02` is collected; consent recorded for AI use of tags (FR-RD-16.2); deletion within 30 days (FR-RD-16.3) | Must | Inspection | UC-RD-02, UC-RD-16 | — |
| NFR-RD-20 | *Ethical.* AI suggestions shall be explainable and shall not rank on sensitive personal attributes. | Every suggestion shows its factors; no gender, religion, caste, region or other sensitive attribute is collected or used in ranking | Must | Inspection | UC-RD-04, UC-RD-05 | — |
| NFR-RD-21 | *Ethical.* Safety features shall not overstate what they do. | SOS text states that the platform does not dispatch emergency services (FR-RD-15.3) | Must | Inspection | UC-RD-15 | — |

## Metric definitions

| Metric | Definition |
|---|---|
| p95 / p99 | 95th / 99th percentile of server-side response time over a measurement run of at least 10 minutes at design load |
| Availability | Proportion of 1-minute uptime checks in the month that succeed |
| Over-allocation | Any moment at which accepted occupants of a ride exceed its vehicle capacity |
