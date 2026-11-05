# Final project report

The project report half of the D3 deliverable "Final Jira dashboard and project report".
Jira: [CS455-164](https://cs455project.atlassian.net/browse/CS455-164) (report) and
[CS455-163](https://cs455project.atlassian.net/browse/CS455-163) (dashboard).

To build: `pdflatex main.tex` twice in this folder (TinyTeX or any TeX Live).

## Sections

Each section is its own file, so please edit only the files you own.

| File in `sections/` | Section | Owner | Jira |
|---|---|---|---|
| `overview.tex` | Overview and final scope | Mainak | CS455-167 |
| `jira-setup.tex` | Jira setup and dashboard | Khushi | CS455-174 |
| `sprint-execution.tex` | Sprint execution | Khushi | CS455-175 |
| `github-workflow.tex` | GitHub workflow | Mainak | CS455-166 |
| `traceability.tex` | Traceability | Mainak | CS455-168 |
| `quality-summary.tex` | Quality summary | Mainak | CS455-168 |
| `defect-tracking.tex` | Defect tracking | Khushi | CS455-176 |
| `deployment-timeline-cost.tex` | Deployment, timeline and cost | Mainak | CS455-169 |
| `contributions.tex` | Individual contributions | Mainak | CS455-170 |
| `gaps-and-lessons.tex` | Gaps and lessons | Mainak, with the Jira gaps from Khushi | CS455-170 |

Screenshots go in `figures/` (CS455-173). Include one with `\includegraphics[width=\linewidth]{name}`.

`main.tex` defines links for use in any section: `\pr{87}` for a pull request, `\jira{CS455-110}` for a Jira
issue, and `\repolink{Deliverables/D3/README.md}{text}` or `\repofile{path}` for a file on master.

## GitHub and Jira numbers

No GitHub or Jira number in the report is typed by hand. They come from the macros and table rows in
`generated/`, built from fixed snapshots in `data/`. To refresh them, from the repository root:

```bash
git fetch origin master
node Deliverables/D3/Project_Report/snapshot-github.mjs    # merged PRs, reviews and commits (GitHub CLI)
node Deliverables/D3/Project_Report/import-jira.mjs page1.json page2.json    # saved Jira search results
node Deliverables/D3/Project_Report/make-metrics.mjs       # generated/ from both snapshots
```

`import-jira.mjs` lists the Jira search and fields it expects. The snapshots store people by name only, with
no e-mail addresses or account IDs.

| Generated file | Contents |
|---|---|
| `metrics.tex` | One macro per number, such as `\PullsMerged` and `\JiraWithEstimate` |
| `github-phases.tex` | Merged pull requests per deliverable, with review and Jira-key counts |
| `contributions.tex` | GitHub and Jira activity per member |
| `jira-types.tex` | Jira issues by type and status |
| `sprints.tex` | Dates, issues and completed issues per sprint |
