# Deliverable 3: Testing, Security, Performance, Cost, Deployment and Reliability

Due 6 November 2026. Each report has its own folder with its LaTeX source (`main.tex`) and the built
`main.pdf`; `common/d3report.sty` gives them the same look.

**The single PDF for submission is
[`Final_Submission/CS455_D3_Final_Submission.pdf`](./Final_Submission/CS455_D3_Final_Submission.pdf).** It holds every
item on the handout's Deliverable 3 list, in the handout's order, with a contents page and bookmarks. The
[engineering retrospective](./Engineering_Retrospective/main.pdf) is separate, because it is not on that list.

| Report | Folder | Owner | Status |
|---|---|---|---|
| Integration test report | [`Integration_Test_Report/`](./Integration_Test_Report/main.pdf) | Mainak | Complete |
| Adversarial test report | [`Adversarial_Test_Report/`](./Adversarial_Test_Report/main.pdf) | Mainak | Complete |
| Unit test and coverage report | [`Unit_Test_Report.md`](./Unit_Test_Report.md) ([coverage](./unit-coverage-report.zip)) | Khushi | Complete |
| System test report | [`System_Test_Report/`](./System_Test_Report/main.pdf) | Khushi | Complete (48/48 pass) |
| Bug/defect history | [`Bug_Report/`](./Bug_Report/main.pdf) | Khushi | Complete |
| Concurrency report | [`Concurrency_Report/`](./Concurrency_Report/main.pdf) | Khushi | Complete: 100 rounds, 5,000 concurrent route-handler operations, zero capacity violations |
| Performance/load test report | [`performance-load-test-report.md`](./performance-load-test-report.md) | Mahir | Complete |
| Security/threat-model report | [`Security_and_Threat_Model_Report/`](./Security_and_Threat_Model_Report/main.pdf) ([Markdown](./security-and-threat-model-report.md)) | Chaitanya, Prithviraj | Complete |
| Failure/recovery report | [`Failure_and_Recovery_Report/`](./Failure_and_Recovery_Report/main.pdf) ([Markdown](./failure-and-recovery-test-report.md)) | Chaitanya, Prithviraj | Complete |
| Deployment documentation | [`Deployment_Documentation.md`](./Deployment_Documentation.md) | Mahir | Complete |
| Requirements traceability matrix (requirement, Jira, GitHub, tests) | [`Traceability_Matrix/`](./Traceability_Matrix/main.pdf) | Mainak | Complete |
| Timeline/Gantt chart | [`project-timeline-gantt.md`](./project-timeline-gantt.md) ([PDF](./project-timeline-gantt.pdf)) | Mahir | Complete |
| Project costing report | [`Costing_Documentation/`](./Costing_Documentation/project_costing_report.pdf) ([Markdown](./Costing_Documentation/project_costing_report.md)) | Chaitanya | Complete |
| Final project report | [`Project_Report/`](./Project_Report/main.pdf) | Mainak, Khushi | Complete |
| Final Jira dashboard | [Jira project](https://cs455project.atlassian.net/jira/software/projects/CS455/summary) | Khushi | In Jira |
| Engineering retrospective | [`Engineering_Retrospective/`](./Engineering_Retrospective/main.pdf) | Team | Complete |
| AI Engineering Log | [`AI_LOG.md`](./AI_LOG.md), [`AI_LOG_Mainak.md`](./AI_LOG_Mainak.md) | Mahir, Mainak | Complete |

The Bug/Defect History report records 26 resolved application defects (16 D3 audit defects and 10 product defects from the D1 review), with evidence, individual Jira Bug links, and traceability to the implementation pull requests. See the [report](./Bug_Report/main.pdf), tracking issue [CS455-135](https://cs455project.atlassian.net/browse/CS455-135), D3 audit tracking story [CS455-121](https://cs455project.atlassian.net/browse/CS455-121), and D1 product-review task [CS455-86](https://cs455project.atlassian.net/browse/CS455-86). Each report entry links to its individual Jira Bug.

The recorded test run and the script that turns it into the report tables are in
[`test-run/`](./test-run/README.md).

To build a report: `pdflatex main.tex` twice in its folder (TinyTeX or any TeX Live).
