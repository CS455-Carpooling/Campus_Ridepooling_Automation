# D3 requirements traceability matrix

Requirement (Deliverable 1) → Jira issue → GitHub pull request → automated test → result.

| File | What it is |
|---|---|
| [`main.pdf`](./main.pdf) | The matrix, with how it is built and a summary by area (LaTeX source `main.tex`) |
| `traceability-matrix.csv` | One row per requirement: full statement, every Jira issue, pull request and test file |
| `traceability-links.csv` | One row per requirement-to-test link: test file, test name, result, how it was linked |
| `make-matrix.mjs` | Builds the tables in `generated/` and the two CSV files from the recorded sources below |
| `snapshot-prs.mjs` | Records the merged pull requests (title, branch, body, files, commits) in `data/prs.json` |
| `data/unit-cases.json` | The recorded unit run: every test case with its file and result |
| `data/unit-coverage.json` | The unit run's coverage totals (for NFR-RD-17) |
| `data/manual-links.json` | Links made by reading a test whose name does not cite the requirement ID |
| `data/prs.json` | The merged pull request snapshot |

The integration and adversarial run is the one the D3 test reports use:
[`../test-run/integration-results.json`](../test-run/README.md).

## How a requirement is linked

- **Tests.** A test verifies a requirement when its name cites the requirement ID, including
  ranges and lists such as `FR-RD-13.1 to 13.4` or `OA-FR-34, 36`. A bare group such as `FR-RD-06`
  cites nothing. Tests whose names do not cite the ID are linked in `data/manual-links.json`
  after reading them; the build stops if such a link matches no recorded test. A requirement is
  listed when at least one passing test verifies it.
- **GitHub.** The pull requests that introduced the code under test (the first merged one that
  changed the file), that cite the requirement in their title, body or own commits, and that
  introduced its tests. A commit belongs to the first merged pull request that contains it, since a
  stacked pull request also lists the commits below it.
- **Jira.** The CS455 keys of those pull requests: title, branch, own commit subjects, and the
  body's opening lines and Jira section.

## Rebuild

From the repository root, with the Compose database running and `apps/web/.env.local` set up for
the integration tests (see `apps/web/setup.md`):

```bash
node Deliverables/D3/Traceability_Matrix/snapshot-prs.mjs
cd apps/web
npx vitest run --reporter=json --outputFile.json=/tmp/unit-results.json
npx vitest run --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=/tmp/unit-coverage
npx vitest run --config vitest.integration.config.mts --reporter=json \
  --outputFile.json=../../Deliverables/D3/test-run/integration-results.json
cd ../..
node Deliverables/D3/test-run/make-tables.mjs
node Deliverables/D3/Traceability_Matrix/make-matrix.mjs \
  --unit /tmp/unit-results.json --coverage /tmp/unit-coverage/coverage-summary.json
cd Deliverables/D3/Traceability_Matrix && pdflatex main.tex && pdflatex main.tex
```

Without `--unit` and `--coverage`, `make-matrix.mjs` rebuilds from the runs already recorded in
`data/`.
