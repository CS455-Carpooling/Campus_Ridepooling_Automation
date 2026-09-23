# D1 — Requirements Engineering

Requirements for the Campus Ride-Pooling and Split-Fare System, split by user class. Each author
writes their user class in full detail; features shared between user classes (authentication,
profile, chat, fare view, ratings, complaints, notifications, SOS) are tagged and reconciled later.

| Folder | User class |
|---|---|
| `users/rider/` | Rider — searches for and joins an existing ride |
| `users/ride_owner/` | Ride Owner — creates rides, accepts/rejects join requests |
| `users/admin/` | Operations Admin |

## Proposed conventions

*Proposed so the three user-class sections merge cleanly — to be confirmed by the team.*

### Identifiers

| Artifact | Format | Example |
|---|---|---|
| User requirement | `UR-<role>-nn` | `UR-RD-06` |
| Functional (system) requirement | `FR-<role>-nn.m` — child of the user requirement it refines | `FR-RD-06.3` |
| Non-functional requirement | `NFR-<role>-nn` | `NFR-RD-04` |
| AI-agent behaviour requirement | `AI-<role>-nn` | `AI-RD-02` |
| Use case | `UC-<role>-nn` | `UC-RD-06` |
| User story / acceptance criterion | `US-<role>-nn` / `US-<role>-nn-ACk` | `US-RD-09-AC2` |
| Test case (reserved for D3) | `TC-<role>-nn` | `TC-RD-11` |
| Jira issue | project key `CS455` | `CS455-14` |

Role codes: `RD` Rider · `RO` Ride Owner · `AD` Admin · `CM` Common (used once shared features are merged).

The user-requirement → system-requirement numbering follows the lecture convention (a user
requirement *n* refined into system requirements *n.1, n.2, …*), so every system requirement traces
to its parent by ID alone.

### Priority — mandatory vs optional

MoSCoW. **Must** = mandatory for this release. **Should** / **Could** = optional, in priority order.
**Won't** = explicitly out of scope for this release (listed so the boundary is visible).

### Requirement statements

- One requirement per statement, using "shall", phrased in EARS form where a trigger or condition
  exists (*When …, the system shall …* / *If …, then the system shall …*).
- Each requirement carries a short *rationale*, a priority, and a verification method
  (Test, Demonstration, Inspection, or Analysis), so it is verifiable by construction.
- Critical requirements — candidates for the end-to-end Requirement → Jira → PR → Test chain — are
  flagged **Critical**.
- Complex functions use the structured specification form (Function, Description, Inputs, Source,
  Outputs, Destination, Action, Requires, Precondition, Postcondition, Side effects); condition-driven
  logic uses tables.
- Non-functional requirements follow the product / organizational / external classification, each
  with a measurable metric.

### Per-user-class file layout

```
01_requirements_specification.md   scope, assumptions, glossary, user requirements
02_functional_requirements.md      system requirements, structured and tabular specifications
03_non_functional_requirements.md
04_ai_agent_requirements.md        autonomous / approval-required / prohibited behaviour
05_use_cases.md                    use-case diagram and use-case descriptions
06_user_stories.md                 user stories with acceptance criteria
07_traceability_matrix.md
08_llm_review_log.md               AI Engineering Log entries for this section
diagrams/                          PlantUML sources (.puml) and rendered images
```

### Traceability matrix columns

Requirement ID · Priority · Critical · Use case · User story · Jira issue · Verification method ·
*(added in D2/D3)* Branch / PR · Test case · Test result
