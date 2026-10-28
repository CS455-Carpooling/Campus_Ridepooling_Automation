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
| Concurrency report | | Mahir | |
| Performance/load test report | | Mahir | |
| Security/threat-model report | | Chaitanya, Prithviraj | |
| Failure/recovery report | | Chaitanya, Prithviraj | |

The recorded test run and the script that turns it into the report tables are in
[`test-run/`](./test-run/README.md).

To build a report: `pdflatex main.tex` twice in its folder (TinyTeX or any TeX Live).
