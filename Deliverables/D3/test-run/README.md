# D3 integration and adversarial test results

The recorded run behind the
[Integration Test Report](../Integration_Test_Report/main.pdf) and the
[Adversarial Test Report](../Adversarial_Test_Report/main.pdf). Every number in those reports comes
from the files here, which come from the commands below.

| File | What it is |
|---|---|
| `integration-results.json` | Vitest JSON report of `npm run test:integration` (every case, its result and time) |
| `integration-coverage-summary.json` | Coverage of the same suite, per file (`json-summary`) |
| `make-tables.mjs` | Turns the two files into the LaTeX tables in `generated/` and makes their paths repo-relative |
| `generated/` | The tables and numbers the reports include (do not edit by hand) |

## Rerun

Needs the Compose database and `TEST_DATABASE_URL` in `apps/web/.env.local` (see `apps/web/setup.md`,
"Integration tests").

```bash
cd apps/web
npx vitest run --config vitest.integration.config.mts --reporter=json \
  --outputFile.json=../../Deliverables/D3/test-run/integration-results.json
npx vitest run --config vitest.integration.config.mts --coverage --coverage.reporter=json-summary
cp coverage/integration/coverage-summary.json ../../Deliverables/D3/test-run/integration-coverage-summary.json
cd ../..
node Deliverables/D3/test-run/make-tables.mjs
cd Deliverables/D3/Integration_Test_Report && pdflatex main.tex && pdflatex main.tex
cd ../Adversarial_Test_Report && pdflatex main.tex && pdflatex main.tex
```

The coverage run is separate because Vitest's JSON report would otherwise embed the whole coverage
map.
