// Turns data/github.json and data/jira.json into the numbers and table rows the report includes
// from generated/, so no GitHub or Jira number in the report is typed by hand:
//
//   node Deliverables/D3/Project_Report/make-metrics.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(fs.readFileSync(path.join(here, 'data', name), 'utf8'));
const github = read('github.json');
const jira = read('jira.json');

const PEOPLE = ['Prithviraj Ghosh', 'Mainak Sarkar', 'Khushi Ranawat', 'Mahir Jain', 'Chaitanya Nitawe'];
// The last day before the deadline, when the final Jira cleanup took place.
const FINAL_DAY = '2026-11-05';
const TIME_ZONE = 'Asia/Kolkata';
const istDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date(iso));
const shortDay = (iso) =>
  iso ? new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' }).format(new Date(iso)) : '--';

// ---------- GitHub ----------
const { prs, commits } = github;
const byMerge = [...prs].sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));
// A stacked pull request also lists the commits below it: each commit counts for the first merged
// pull request that contains it, as in the traceability matrix.
const commitOwner = new Map();
for (const pr of byMerge) for (const { oid } of pr.commits) if (!commitOwner.has(oid)) commitOwner.set(oid, pr.number);

const JIRA = /\bCS455[-_ ](\d+)\b/i;
const names = (text) => JIRA.test(String(text ?? ''));
/** The same sources as jiraOf() in Traceability_Matrix/make-matrix.mjs. */
function namesJira(pr) {
  if (names(pr.title) || names(pr.branch)) return true;
  if (pr.commits.some((c) => commitOwner.get(c.oid) === pr.number && !/^Merge /.test(c.headline) && names(c.headline))) return true;
  let inJira = false;
  let seenHeading = false;
  for (const line of String(pr.body ?? '').replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    if (/^#{1,6}\s/.test(line)) {
      seenHeading = true;
      inJira = /jira/i.test(line);
    } else if (!/^\s*- \[[ x]\]/i.test(line) && (inJira || !seenHeading || /jira/i.test(line)) && names(line)) {
      return true;
    }
  }
  return false;
}
const reviewers = (pr) => new Set(pr.reviews.filter((r) => r.reviewer !== pr.author).map((r) => r.reviewer));
const reviewed = (pr) => reviewers(pr).size > 0;
const approved = (pr) => pr.reviews.some((r) => r.reviewer !== pr.author && r.state === 'APPROVED');

const PHASES = [
  { name: 'D0 and D1 (to 26 Sep)', test: (day) => day <= '2026-09-26' },
  { name: 'D2 (27 Sep to 15 Oct)', test: (day) => day > '2026-09-26' && day <= '2026-10-15' },
  { name: 'D3 (from 16 Oct)', test: (day) => day > '2026-10-15' },
];
const phaseRows = PHASES.map(({ name, test }) => {
  const inPhase = prs.filter((pr) => test(istDay(pr.mergedAt)));
  return [name, inPhase.length, inPhase.filter(reviewed).length, inPhase.filter(approved).length, inPhase.filter(namesJira).length];
});

// The longest stretch with no commit on master, after the first D2 commit.
const commitDays = [...new Set(commits.map((c) => istDay(c.date)))].filter((day) => day >= '2026-10-01').sort();
let gap = { days: 0, from: null, to: null };
for (let i = 1; i < commitDays.length; i += 1) {
  const days = (new Date(commitDays[i]) - new Date(commitDays[i - 1])) / 86400000 - 1;
  if (days > gap.days) gap = { days, from: commitDays[i - 1], to: commitDays[i] };
}

// ---------- Jira ----------
const { issues } = jira;
const count = (test) => issues.filter(test).length;
const TYPES = ['Epic', 'Story', 'Task', 'Subtask', 'Bug'];
const known = new Set(TYPES);
const stray = issues.filter((issue) => !known.has(issue.type));
if (stray.length > 0) throw new Error(`Issue type not in the table: ${stray[0].type}`);
const typeRows = TYPES.map((type) => {
  const ofType = issues.filter((issue) => issue.type === type);
  const status = (name) => ofType.filter((issue) => issue.status === name).length;
  return [type, ofType.length, status('Done'), status('In Progress'), status('In Review'), status('To Do')];
});

const sprints = new Map();
for (const issue of issues) {
  for (const sprint of issue.sprints) {
    if (!sprints.has(sprint.id)) sprints.set(sprint.id, { ...sprint, issues: [] });
    sprints.get(sprint.id).issues.push(issue);
  }
}
const sprintRows = [...sprints.values()]
  .sort((a, b) => a.id - b.id)
  .map((sprint) => {
    const doneBy = sprint.issues.filter((issue) => {
      if (issue.status !== 'Done') return false;
      return !sprint.completed || (issue.resolved && new Date(issue.resolved) <= new Date(sprint.completed));
    });
    const closed = sprint.completed ? shortDay(sprint.completed) : sprint.state;
    return [sprint.name, shortDay(sprint.start), shortDay(sprint.end), closed, sprint.issues.length, doneBy.length];
  });

// ---------- Per person ----------
for (const pr of prs) if (!PEOPLE.includes(pr.author)) throw new Error(`Pull request author not in the table: ${pr.author}`);
const personRows = PEOPLE.map((person) => {
  const assigned = issues.filter((issue) => issue.assignee === person);
  return [
    person,
    prs.filter((pr) => pr.author === person).length,
    commits.filter((c) => c.author === person).length,
    prs.filter((pr) => reviewers(pr).has(person)).length,
    assigned.length,
    assigned.filter((issue) => issue.status === 'Done').length,
    issues.filter((issue) => issue.reporter === person).length,
  ];
});

// ---------- Output ----------
const macros = {
  GithubSnapshotDate: shortDay(github.recordedAt),
  GithubSnapshotHead: github.masterHead,
  JiraSnapshotDate: shortDay(jira.recordedAt),
  PullsMerged: prs.length,
  PullsReviewed: prs.filter(reviewed).length,
  PullsApproved: prs.filter(approved).length,
  PullsNoReview: prs.filter((pr) => !reviewed(pr)).length,
  PullsWithJira: prs.filter(namesJira).length,
  PullsNoJira: prs.filter((pr) => !namesJira(pr)).length,
  CommitsOnMaster: commits.length,
  CommitGapDays: gap.days,
  CommitGapFrom: shortDay(gap.from),
  CommitGapTo: shortDay(gap.to),
  ReviewsSubmitted: prs.reduce((sum, pr) => sum + pr.reviews.filter((r) => r.reviewer !== pr.author).length, 0),
  ReviewsChangesRequested: prs.reduce((sum, pr) => sum + pr.reviews.filter((r) => r.state === 'CHANGES_REQUESTED').length, 0),
  JiraIssues: issues.length,
  JiraDone: count((i) => i.status === 'Done'),
  JiraWithEstimate: count((i) => i.points !== null),
  JiraNoSprint: count((i) => i.sprints.length === 0),
  JiraNoLabels: count((i) => i.labels.length === 0),
  JiraUnassigned: count((i) => i.assignee === null),
  JiraCarriedOver: count((i) => i.sprints.length > 1),
  JiraCreatedFinalDay: count((i) => istDay(i.created) === FINAL_DAY),
  JiraResolvedFinalDay: count((i) => i.resolved && istDay(i.resolved) === FINAL_DAY),
  JiraResolvedDeadline: count((i) => i.resolved && istDay(i.resolved) === '2026-11-06'),
  JiraBugs: count((i) => i.type === 'Bug'),
  JiraDefectBugs: count((i) => i.type === 'Bug' && i.labels.includes('d3')),
  JiraDefectBugsFinalDay: count((i) => i.type === 'Bug' && i.labels.includes('d3') && istDay(i.created) === FINAL_DAY),
};
const tableRow = (cells) => `${cells.join(' & ')} \\\\`;
const out = (name, text) => fs.writeFileSync(path.join(here, 'generated', name), `${text}\n`);
fs.mkdirSync(path.join(here, 'generated'), { recursive: true });
out('metrics.tex', Object.entries(macros).map(([name, value]) => `\\newcommand{\\${name}}{${value}}`).join('\n'));
out('github-phases.tex', phaseRows.map(tableRow).join('\n'));
out('contributions.tex', personRows.map(tableRow).join('\n'));
out('jira-types.tex', typeRows.map(tableRow).join('\n'));
out('sprints.tex', sprintRows.map(tableRow).join('\n'));
console.log(macros);
for (const rows of [phaseRows, personRows, typeRows, sprintRows]) console.log(`${rows.map(tableRow).join('\n')}\n`);
