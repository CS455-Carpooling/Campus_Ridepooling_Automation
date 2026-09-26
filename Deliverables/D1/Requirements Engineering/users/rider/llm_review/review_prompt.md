You are an experienced requirements engineer acting as an independent reviewer. You did not write
the requirements below. Your job is to find real defects, not to praise or restate them.

## Context

CS455 Software Engineering course project, IIT Kanpur: a campus ride-pooling and split-fare web
platform. Students travelling from campus to hubs such as the railway station or airport are matched
into shared cabs or autos. Three user classes: Rider (searches for and joins an existing ride),
Ride Owner (creates rides, accepts or rejects join requests), Operations Admin. The document under
review covers the **Rider** only; features shared with other user classes are tagged "Shared".

Team-approved proposal (D0), relevant points:
- Ride owners create rides; riders request to join; the owner accepts or rejects.
- Fare split is recomputed as riders join and "locks in"; a real-time pool chat then opens.
- Concurrency challenge 1 — stale availability: a rider joins on outdated seat availability while the
  owner accepts someone else for the last seat. Seat availability must be revalidated atomically.
- Concurrency challenge 2 — itinerary drift: adding riders at different pickup points shifts
  departure and pickup times for everyone; concurrent joins against an outdated time cause conflicts.
- AI: a Pool Car Recommendation agent ("Ask AI to Suggest": ranked rides with pros/cons) and an AI
  chatbot (filter rides, inspect co-rider details, manage preferences); a Complaint Management agent
  (admin side). Post-ride: settle fare, complaints, ratings. Admin handles SOS incidents.
- Stack: TypeScript, Node.js, React/Next.js, Socket.IO, Firestore/PostgreSQL, free-tier LLM API, GCP.

Course rules for requirements (must be satisfied):
- Requirements must be unambiguous, verifiable and testable; mandatory and optional clearly
  distinguished.
- AI-agent behaviour must be specified as requirements: what the agent may decide autonomously, what
  requires human approval, and what it must never do; at least three agent failure or risk scenarios
  with safeguards; an audit trail of agent decisions and tool calls.
- Requirements are validated for validity, consistency, completeness, realism and verifiability.
- Expected workload: at least 100 daily active users and 250 core transactions per day.

## Task

Review the Rider requirements (files 01–04 and 06, below). Report defects in these categories:

- `ambiguity` — a statement that two reasonable engineers could implement differently
- `testability` — a requirement that cannot be verified as written, or whose verification method is wrong
- `conflict` — two requirements, parameters or tables that contradict each other
- `missing` — behaviour a rider needs that is not specified (including error, timeout and edge cases)
- `agent` — gaps in the AI-agent governance requirements
- `nfr` — missing or unmeasurable non-functional requirements
- `validity` — a requirement not justified by the proposal or the course rules, or contradicting them
- `realism` — a requirement unlikely to be achievable by a 5-student team in one semester

Rules:
- Cite the exact IDs involved (e.g. FR-RD-06.3, P-09, T-2, US-RD-17-AC1).
- Report only genuine defects; do not report formatting or wording preferences.
- Prefer fewer, well-argued findings over many shallow ones. At most 25 findings, most severe first.
- For each finding, propose a concrete change.

## Output

Return only JSON matching this schema:

```json
{
  "summary": "two or three sentences on the overall quality",
  "findings": [
    {
      "id": "R-01",
      "category": "ambiguity | testability | conflict | missing | agent | nfr | validity | realism",
      "severity": "high | medium | low",
      "requirement_ids": ["FR-RD-06.3"],
      "finding": "what is wrong and why it matters",
      "suggested_change": "concrete replacement or addition"
    }
  ]
}
```

## Documents under review
