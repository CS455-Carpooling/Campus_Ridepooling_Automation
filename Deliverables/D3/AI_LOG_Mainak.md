# AI_LOG (Mainak Sarkar, D3)

This file records AI-assisted work by Mainak Sarkar for Deliverable 3, as required by section 8 of the
CS455 handout.

- **Areas:** integration and adversarial testing (CS455-110 to 114), the traceability matrix, reviews of
  teammates' pull requests, the final Jira cleanup, and the final project report (CS455-164 to 170).
- **Assistant:** Claude (Anthropic).
- **Prompts and decisions:** written as summaries from Mainak's instructions and the pull request records, not pasted
  verbatim.
- **Scope:** entries describe only work actually performed, in date order.

| Date | Entry | Jira | PRs |
| --- | --- | --- | --- |
| 28 to 29 Oct | Integration test harness on a real database | CS455-110 | #83 |
| 28 to 29 Oct | Workflow integration tests, and the seat request defect they found | CS455-111, 112 | #84, #85, #86 |
| 28 to 29 Oct | Adversarial suite, the idempotency weakness it found, and both reports | CS455-113, 114 | #87, #88, #89 |
| 2 to 5 Nov | Requirements traceability matrix | none | #93 |
| 29 Oct to 6 Nov | Reviews of teammates' pull requests | see entry | #90 to #92, #95 to #100, #103, #104 |
| 5 Nov | Final Jira cleanup and the report stories | CS455-163, 164 | none |
| 5 to 6 Nov | Final project report | CS455-164 to 171 | #101 |
| 6 Nov | Final rebuild, retrospective and development estimate | CS455-171, 178 | #101, #104 |

## 2026-10-28: Integration test harness (CS455-110, PR #83)

### Context
Every API test mocked the database and authentication, so no test touched real SQL, constraints or
triggers. The handout asks for rerunnable integration, system and adversarial test evidence.

### Prompt (summary)
Plan the integration and adversarial testing story, then build the harness first. Tests should drive the
real route handlers against a real PostgreSQL database, with nothing mocked beyond what running outside a
Next.js request requires, and should also run in CI.

### Output and changes
- **Harness:** tests call the exported route handlers in-process through `callRoute`. Only `next/headers`
  is replaced, by a small shim over `AsyncLocalStorage`, so authentication, the CSRF check, rate limits and
  all SQL run for real.
- **Isolation:** the test database is recreated for each run, and each test starts from the freshly
  migrated state.
- **Shared seed:** `test/seed/accounts.ts` creates accounts and sessions, for reuse by the system tests.
- **CI:** a new parallel job with a PostgreSQL 16 service.

### Errors identified
- **The first safety check was too weak.** A check on the database name alone still allowed a reset of an
  existing database with a matching name. After Khushi's review, the harness also requires a local host, an
  explicit opt-in setting and a marker it wrote itself, and it refuses anything else.

### Verification performed
Six smoke tests cover sign-in, the CSRF check, the administrator role and isolation between tests, and unit
tests cover every refusal of the database guard. The new CI job runs the suite on every pull request.

### Student evaluation and decision
**Decision:** Mainak set the order of work: plan the whole story first, then build the harness alone as its own pull request. He sent the bugs from Khushi's review back to be fixed, including the weak database safety check, and merged #83 after those fixes.

## 2026-10-28: Workflow integration tests and the seat request defect (CS455-111, 112, PRs #84 to #86)

### Context
With the harness in place, the core ride workflow and the trip, SOS, complaint, rating and admin workflows
needed tests that assert both the response and the database rows.

### Prompt (summary)
Write integration tests for the core ride workflow and for trips, SOS, complaints, ratings and enforcement,
each with a happy path and at least one refusal. Report any failure as a defect rather than adjusting the
test to pass.

### Output and changes
- Test files for ride offers, join requests, seats and locking, trips, SOS, complaints, ratings and
  enforcement, in `apps/web/test/integration/`.
- **PR #84:** a fix for the defect below, with regression tests.

### Errors identified
- **A real defect the mocks had hidden.** Every seat request and the payment reminder scheduler failed with
  a 500 on a real database, because a JavaScript `Date` in `$n - interval` reaches PostgreSQL untyped. The
  fix casts the parameter to `timestamptz`.
- **A flaky test traced to its cause.** A reminder test failed intermittently because seeded rows took their
  time from the database and the code from Node.js, about 1 ms apart. The seed now dates those rows from the
  ride's completion time, rather than retrying the test.

### Verification performed
The suite passed locally and in CI, and the fix in #84 carries its own regression tests.

### Student evaluation and decision
**Decision:** Mainak had the remaining pull requests built one after another, sent Khushi's review points back to be fixed, and merged them in the stated order. The defect the tests found was fixed in #84, and the test was not changed to pass.

## 2026-10-28: Adversarial suite and test reports (CS455-113, 114, PRs #87 to #89)

### Context
The handout asks for adversarial testing designed to break the system, with defects found this way tracked
and fixed.

### Prompt (summary)
Write an adversarial suite of at least 25 cases covering time boundaries, malformed input, replays, state
machine violations and small races, then write the integration and adversarial test reports from the
recorded run.

### Output and changes
- **PR #88:** 41 adversarial cases in 4 files.
- **PR #87:** a fix for the weakness below, with regression tests.
- **PR #89:** both reports in LaTeX, with tables generated from the recorded run by
  `Deliverables/D3/test-run/make-tables.mjs`.

### Errors identified
- **An idempotency key replayed the wrong request.** A key reused for another ride or pickup point returned
  the first request instead of refusing. It now returns 409 `idempotency_key_reused`, and the interface drops
  the key on that answer.

### Verification performed
All cases passed on the final run, which is recorded in `Deliverables/D3/test-run/`. A concurrent same-key
test was added after Khushi's review, to check that the fix holds under a race.

### Student evaluation and decision
**Decision:** Mainak merged the suite and both reports in the stated order, after the concurrent same-key test was added in response to Khushi's review.

## 2026-11-02: Requirements traceability matrix (PR #93)

### Context
Deliverable 3 requires a final requirements-to-Jira-to-GitHub-to-testing matrix. A hand-maintained table
would be hard to check, so the matrix is generated from recorded sources.

### Prompt (summary)
Build the final traceability matrix from the D1 requirement documents, the recorded test runs and a snapshot
of the merged pull requests. A requirement is listed when a passing automated test verifies it. Then apply
the review points from Khushi.

### Output and changes
- `make-matrix.mjs`, `snapshot-prs.mjs`, the report in LaTeX and the CSV files, in
  `Deliverables/D3/Traceability_Matrix/`.
- `data/manual-links.json` for links made by reading a test, with a build failure if a link matches no test.
- Test titles relabelled with exact requirement identifiers where they were vague.

### Errors identified
- **Linking too strict.** Linking only on a test's own title, tried after Khushi's review, dropped 1,045 links
  and 35 requirements. Identifiers in a `describe()` title now link the block as one group, which passes only
  if every test inside it passed.
- **False citations.** The pull request template's hints, inside HTML comments, were being read as requirement
  identifiers, and a mention in a file-level comment is not evidence. Both are now excluded.
- **Double counting.** Stacked pull requests list the commits below them, so a commit now counts only for the
  first merged pull request that contains it.
- **An unreliable source.** `Deliverables/D2/REQUIREMENTS_TRACEABILITY.md` mislabels some rows, so the matrix
  parses the D1 documents instead.

### Verification performed
The build fails if a manual link matches no recorded test, and each manual link was made by reading the test.

### Student evaluation and decision
**Decision:** Mainak set the matrix's scope: a requirement is listed when a passing automated test verifies it. He chose to take Khushi's minor review points in the rebuild commit rather than hold the review for them.

## 2026-10-29 to 2026-11-06: Reviews of teammates' pull requests

### Context
Mainak was a requested reviewer on the performance, defect fix, unit, system, concurrency, bug history,
deployment and timeline pull requests, and reviewed the costing report at the end.

### Prompt (summary)
Review each pull request against the handout and the code, check its claims rather than reading them on
trust, and draft the review. Report must-fix points only where asked.

### Output and changes
- Draft reviews for #90 to #92, #95 to #100 and #103.
- **Fixes in #95, on Mainak's instruction:** four system test specs, the report's D1 identifiers and its summary.
- **Fixes in #103, on Mainak's instruction:** the Gantt chart's legend colours, removal of its LaTeX build files,
  and a note in the D3 AI log.
- **Fixes in #104, on Mainak's instruction:** prices checked against the published pages and corrected, the PDF
  rebuilt to clear a parse error in its cost table, a comparison of estimated and actual usage added, and the D3
  README row added.
- **Checks by running the artifact:** for #99, rendering the Mermaid chart showed that 9 of its 15 task bars
  had zero width, and adding `inclusiveEndDates` fixed it. For #100, a diff confirmed the D1 files were restored
  exactly to their submitted text.

### Errors identified
These errors were in the assistant's own drafts:
- **Caught before the reviews were shared:** one defect's before and after behaviour was the wrong way round
  in the #96 draft, a draft named a route, `GET /api/rides/[id]`, that does not exist, and a count was stated as
  13 of 16 when it was 14.
- **#94 and #96:** the assistant advised citing #94 for two defects whose code fixes are in #91. This reached
  CS455-137, CS455-141 and the bug report, and its correction is tracked in CS455-176.
- **#104, a token estimate:** the assistant first put the chatbot's Gemini prompt at about 1,400 tokens, a count
  that included the response schema. The prompt builder alone is about 580 tokens, so the report keeps the
  author's 500-token assumption, marks it as unmeasured and states the effect of doubling it.
- **#104, a false build result:** the first PDF build script reported success while the old file was still in
  place, because Edge returns before it writes the file. The unchanged file size showed this, and the script now
  removes the old PDF and fails if no new one appears.

### Verification performed
For #104, a script recomputed every total from the unit prices, and each page of the rebuilt PDF was read as
rendered. For #103, the rebuilt PDF was read as rendered.

### Student evaluation and decision
**Decision:** Mainak decided what was posted: must-fix points only, with no overlap with other reviewers. A draft point questioned who should be named as the system test report's author, and he kept Khushi, because that part was assigned to her. He had #103's remaining points resolved with fix commits and approved it, and had #104 and Khushi's report sections corrected directly rather than sent back.

## 2026-11-05: Final Jira cleanup and the report stories (CS455-163, 164)

### Context
Before the deadline, many Jira issues still showed old statuses although their work was merged, and the D3
defect Bugs had no assignees. Mainak had created the two report stories by hand with no description.

### Prompt (summary)
Clean up Jira so it reflects the actual state of the work, without backfilling old estimates or sprints. Fill
in the two existing report stories with descriptions and sub-tasks, without creating duplicates.

### Output and changes
The assistant applied these through the Atlassian connector, on Mainak's account:
- 42 issues moved to Done.
- 26 Bugs assigned to the people who fixed them.
- Descriptions and estimates for CS455-163 and CS455-164, and sub-tasks CS455-165 to CS455-177.

### Errors identified
- **Sprint date.** The assistant first stated that Sprint 3 (D3) had ended on 4 November. Jira showed 6 November.
- **Issue count.** The assistant stated 177 issues from the highest key. The snapshot shows 172, because some
  keys were deleted.
- **A Done issue with work outstanding.** CS455-135 is Done, but its acceptance criteria require a committed
  PDF that did not yet exist. This was reported to Mainak, and the PDF is on the final rebuild list.

### Verification performed
Each change was checked with a follow-up Jira search. The report states this cleanup as a gap rather than
presenting the resolution dates as a record of when work finished.

### Student evaluation and decision
**Decision:** Mainak connected the team site and confirmed that the assistant could write to it before any change. He had the assistant fill in the two stories he had created by hand instead of creating duplicates.

## 2026-11-05 to 2026-11-06: Final project report (CS455-164 to 170, PR #101)

### Context
Deliverable 3 requires a final project report. The handout assesses GitHub and Jira activity together, so the
numbers needed to be reproducible rather than typed by hand.

### Prompt (summary)
Build the report's skeleton with one file per section, so Khushi can write her sections without conflicts.
Generate every GitHub and Jira number from recorded sources, write the remaining sections from the existing D3
reports, and state the project's gaps plainly.

### Output and changes
- `snapshot-github.mjs`, `import-jira.mjs` and `make-metrics.mjs`, which feed `generated/`. The snapshots store
  people by name only.
- Sections on the overview, GitHub workflow, traceability, quality summary, deployment, timeline, cost,
  contributions, gaps and lessons.
- The Gantt chart in the timeline section: first a render of the Mermaid source merged in #99, then replaced with
  the PDF chart merged in #103.
- **Khushi's three sections, reviewed against Jira and corrected on Mainak's instruction:** the Sprint 3 (D2) goal,
  which the text said did not exist; the defect count, given as two where Jira and the rest of the report have 26;
  sentences addressed to the team rather than the reader; and the scope of Sprint 3 (D3). The bug report's entries
  for CS455-137 and CS455-141 now cite #91 for the code fix, which corrects the earlier error noted under the
  reviews entry.
- **Jira, on Mainak's instruction:** report and timeline issues moved to match the work, through the Atlassian
  connector on his account.

### Errors identified
- **Query size.** The first GitHub snapshot went over GitHub's query limit and was rewritten as a paginated query.
- **Facts checked against the source reports.** The security report has six threats where the first draft said
  five, and the overview's wording on who can raise an SOS went beyond the source. Both were corrected.
- **AI fallback too broad.** The overview said the application falls back to deterministic behaviour, and Khushi's
  review pointed out that this does not hold for every AI feature. Checking her suggested wording against the code
  showed the chatbot also interprets requests with deterministic rules before it links to manual search, so the
  overview now states each feature's fallback as the code behaves.

### Verification performed
The report builds without LaTeX errors, and its pages were read as rendered. The production health endpoint
returned 200. For the worked traceability example, the implementation commit was checked to contain the rule
that the requirement describes. The Gantt chart's work windows were compared with the pull request records; two
early rows end one day before their last merge. The cost table was checked against the corrected costing report.

### Student evaluation and decision
**Decision:** Mainak checked the contributions table against `git shortlog -sn`. When the difference turned out to be merge commits, he decided the table stays without them, because they do not reflect work done. He had Mahir's chart checked first, then used it in place of the Mermaid render once its fixes were merged. He decided the Lessons section should state the general lesson rather than a dated failure, and left #97's D1 edits as they are, because they are Khushi's and the difference is small. He accepted Khushi's review of the AI fallback sentence.

## 2026-11-06: Final rebuild, retrospective and development estimate (CS455-171, 178, PRs #101, #104)

### Context
Mainak was away on the day of the deadline, as was the rest of the team, and asked for the remaining Deliverable 3 work to
be finished from what could be checked, so that Khushi could compile the group submission.

### Prompt (summary)
Check Chaitanya's and Mahir's open items from what is reachable, complete everything left of Deliverable 3, and leave out
the AI logs that do not exist. Compile every report the handout lists into
one PDF for the group submission.

### Output and changes
- **Costing report:** input tokens set from the requests the code really builds; actual usage added where it could be
  checked; a development time estimate added and labelled as retrospective.
- **Final rebuild:** unit and integration suites rerun, the matrix, metrics and test tables regenerated, the missing
  report PDFs built, and the D3 README completed.
- **`Engineering_Retrospective/`:** the handout section 19 retrospective, compiled from the project's records.
- **`Final_Submission/`:** every item on the handout's Deliverable 3 list merged into one PDF, in the handout's order, with
  a contents page and bookmarks, plus a new code coverage report and Jira Bug list from the final run and snapshot.

### Errors identified
- **Token estimate:** the assistant's first size for the chatbot's prompt, about 1,400 tokens, counted other strings in the
  file. Capturing the real request gave about 930 tokens including its response schema.
- **Two reports did not build.** The failure and security reports were listed as complete, but neither had a PDF because
  their LaTeX stopped on an unclosed brace and on bare ampersands in headings. Both now build.
- **Limits of the check:** the assistant has no access to the Render dashboard, the Google billing console, the production
  database or the Jira dashboard. Those figures are marked "Not read" in the costing report rather than estimated.

### Verification performed
A script recomputed every costing total from the unit prices, and the rebuilt PDFs were read as rendered. The final run passed
1,544 unit tests and 112 integration tests. The assembly script checks that each part starts on the page the contents
page gives. The real Gemini
requests were captured with the network call replaced, so nothing was sent to Gemini. The estimate's rates were set before
the comparison with the commit record and were not adjusted after it.

### Student evaluation and decision
**Decision:** Mainak asked for the remaining work to be finished without him, because he and the team were away. He asked for missing AI logs to be left out rather than reconstructed, and for the final
pull request to be merged directly, without waiting for review, so that Khushi could compile the submission in time.
