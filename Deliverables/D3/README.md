# Deliverable 3: Testing, Security, Performance, Cost, Deployment and Reliability

Due 6 November 2026. Each report has its own folder with its LaTeX source (`main.tex`) and the built
`main.pdf`; `common/d3report.sty` gives them the same look.

| Report | Folder | Owner | Status |
|---|---|---|---|
| Integration test report | [`Integration_Test_Report/`](./Integration_Test_Report/main.pdf) | Mainak | Draft |
| Adversarial test report | [`Adversarial_Test_Report/`](./Adversarial_Test_Report/main.pdf) | Mainak | Draft |
| Unit test and coverage report | | Khushi | |
| System test report | | Khushi | |
| Bug/defect history | [`Bug_Report/main.tex`](./Bug_Report/main.tex) | Khushi | Added |
| Concurrency report | | Mahir | |
| Performance/load test report | | Mahir | |
| Security/threat-model report | | Chaitanya, Prithviraj | |
| Failure/recovery report | | Chaitanya, Prithviraj | |

The Bug/Defect History report records 16 resolved application defects, with regression evidence and traceability to the implementation pull requests. See the [LaTeX report source](./Bug_Report/main.tex) and tracking issue [CS455-135](https://cs455project.atlassian.net/browse/CS455-135).

The recorded test run and the script that turns it into the report tables are in
[`test-run/`](./test-run/README.md).

To build a report: `pdflatex main.tex` twice in its folder (TinyTeX or any TeX Live).
