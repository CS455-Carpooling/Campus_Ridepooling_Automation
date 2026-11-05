# Deliverable 3: Testing, Security, Performance, Cost, Deployment and Reliability

Due 6 November 2026. Each report has its own folder with its LaTeX source (`main.tex`) and the built
`main.pdf`; `common/d3report.sty` gives them the same look.

| Report | Folder | Owner | Status |
|---|---|---|---|
| Integration test report | [`Integration_Test_Report/`](./Integration_Test_Report/main.pdf) | Mainak | Draft |
| Adversarial test report | [`Adversarial_Test_Report/`](./Adversarial_Test_Report/main.pdf) | Mainak | Draft |
| Unit test and coverage report | | Khushi | |
| System test report | [`System_Test_Report/`](./System_Test_Report/README.md) | Khushi | Completed (48/48 pass) |
| Bug/defect history | [`Bug_Report/main.tex`](./Bug_Report/main.tex) | Khushi | Added |
| Concurrency report | [`Concurrency_Report/main.tex`](./Concurrency_Report/main.tex) | Mahir | Local PostgreSQL run passed: 100 rounds, 5,000 concurrent route-handler operations, zero capacity violations; full integration suite 112/112 passed |
| Performance/load test report | | Mahir | |
| Security/threat-model report | [`Security_and_Threat_Model_Report/`](./Security_and_Threat_Model_Report/main.tex) ([Markdown](./security-and-threat-model-report.md)) | Chaitanya, Prithviraj | Complete |
| Failure/recovery report | [`Failure_and_Recovery_Report/`](./Failure_and_Recovery_Report/main.tex) ([Markdown](./failure-and-recovery-test-report.md)) | Chaitanya, Prithviraj | Complete |
| Deployment documentation | [`Deployment_Documentation.md`](./Deployment_Documentation.md) | Mahir | Complete |
| Requirements traceability matrix (requirement, Jira, GitHub, tests) | [`Traceability_Matrix/`](./Traceability_Matrix/main.pdf) | Mainak | Draft |

The Bug/Defect History report records 26 resolved application defects (16 D3 audit defects and 10 product defects from the D1 review), with evidence, individual Jira Bug links, and traceability to the implementation pull requests. See the [LaTeX report source](./Bug_Report/main.tex), tracking issue [CS455-135](https://cs455project.atlassian.net/browse/CS455-135), D3 audit tracking story [CS455-121](https://cs455project.atlassian.net/browse/CS455-121), and D1 product-review task [CS455-86](https://cs455project.atlassian.net/browse/CS455-86). Each report entry links to its individual Jira Bug.

The recorded test run and the script that turns it into the report tables are in
[`test-run/`](./test-run/README.md).

To build a report: `pdflatex main.tex` twice in its folder (TinyTeX or any TeX Live).
