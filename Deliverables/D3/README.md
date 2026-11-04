# Deliverable 3: Testing, Security, Performance, Cost, Deployment and Reliability

Due 6 November 2026. Each report has its own folder with its LaTeX source (`main.tex`) and the built
`main.pdf`; `common/d3report.sty` gives them the same look.

| Report | Folder | Owner | Status |
|---|---|---|---|
| Integration test report | [`Integration_Test_Report/`](./Integration_Test_Report/main.pdf) | Mainak | Draft |
| Adversarial test report | [`Adversarial_Test_Report/`](./Adversarial_Test_Report/main.pdf) | Mainak | Draft |
| Unit test and coverage report | | Khushi | |
| System test report | | Khushi | |
| Bug/defect history | | Khushi | |
| Concurrency report | [`Concurrency_Report/main.tex`](./Concurrency_Report/main.tex) | Mahir | Local PostgreSQL run passed: 100 rounds, 5,000 concurrent route-handler operations, zero capacity violations; full integration suite 112/112 passed |
| Performance/load test report | | Mahir | |
| Security/threat-model report | [`Security_and_Threat_Model_Report/`](./Security_and_Threat_Model_Report/main.tex) ([Markdown](./security-and-threat-model-report.md)) | Chaitanya, Prithviraj | Complete |
| Failure/recovery report | [`Failure_and_Recovery_Report/`](./Failure_and_Recovery_Report/main.tex) ([Markdown](./failure-and-recovery-test-report.md)) | Chaitanya, Prithviraj | Complete |

The recorded test run and the script that turns it into the report tables are in
[`test-run/`](./test-run/README.md).

To build a report: `pdflatex main.tex` twice in its folder (TinyTeX or any TeX Live).
