# Rider — Requirements

**Status:** draft complete, under team review · **Author:** Mainak Sarkar (230619) · **Updated:** 2026-09-23

The Rider is a verified IIT Kanpur user who searches for an existing ride and requests to join it.
Features shared with the Ride Owner and Admin are specified here from the rider's side and tagged
for later reconciliation.

**At a glance:** 16 user requirements · 98 functional · 21 non-functional · 15 AI-agent
requirements · 17 use cases · 34 user stories with 108 acceptance criteria · 12 Critical
requirements. The drafts were revised after an independent LLM review (13 findings); the review
log is still pending (see below).

## Contents

| File | Contents | Status |
|---|---|---|
| `01_requirements_specification.md` | Scope, assumptions, parameters, user requirements, glossary | Draft complete |
| `02_functional_requirements.md` | System requirements, structured and tabular specifications, validation checklist | Draft complete |
| `03_non_functional_requirements.md` | Performance, dependability, security, usability, organizational, external | Draft complete |
| `04_ai_agent_requirements.md` | Recommendation agent and chatbot: tools, permitted / approval-required / prohibited behaviour, failure scenarios | Draft complete |
| `05_use_cases.md` | Rider use-case diagram, activity and state diagrams, use-case descriptions | Draft complete |
| `06_user_stories.md` | User stories with acceptance criteria | Draft complete |
| `07_traceability_matrix.md` | Requirement → use case → user story → Jira → verification | Draft complete; Jira column pending |
| `AI_Log.md` | AI Engineering Log: prompts, LLM output, errors found, LLM review and resulting changes | Published |
| `llm_review/` | Review prompt and raw reviewer output referenced by `AI_Log.md` | Published |
| `diagrams/` | PlantUML sources and rendered images | Draft complete |
| `jira/rider_backlog_import.csv` | Rider epic, stories and NFR tasks for Jira import | Ready for import |

## Pending

- [x] **AI log** (`AI_Log.md`, with the review prompt and raw reviewer output in `llm_review/`).
- [ ] **Jira keys:** issues to be imported from `jira/rider_backlog_import.csv`; the matrix's Jira
      column reads `pending` until then.
- [ ] **Reconciliation** of shared features with the Ride Owner and Admin sections; the open items
      are listed at the end of `02`.
- [ ] **Team confirmation** of the proposed conventions (`../../README.md`) and of the parameter
      defaults in `01` §5.
- [ ] **LaTeX conversion** for the final submission.

Conventions (IDs, priorities, statement style): see `../../README.md`.
