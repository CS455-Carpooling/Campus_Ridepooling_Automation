// Turns saved Jira search results into data/jira.json, so the report's Jira numbers come from a
// fixed snapshot. Each input file is one page of a Jira search for
//
//   project = CS455 ORDER BY key ASC
//
// with the fields summary, issuetype, status, assignee, reporter, created, resolutiondate,
// customfield_10016 (story points), customfield_10020 (sprints), labels, parent and priority.
//
//   node Deliverables/D3/Project_Report/import-jira.mjs page1.json page2.json
//
// Names only: account IDs and e-mail addresses are not copied into the snapshot.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pages = process.argv.slice(2);
if (pages.length === 0) throw new Error('Pass the saved search result files as arguments.');

const issues = pages
  .flatMap((file) => {
    const page = JSON.parse(fs.readFileSync(file, 'utf8'));
    return page.issues?.nodes ?? page.issues;
  })
  .map(({ key, fields }) => ({
    key,
    summary: fields.summary,
    type: fields.issuetype?.name,
    status: fields.status?.name,
    priority: fields.priority?.name ?? null,
    assignee: fields.assignee?.displayName ?? null,
    reporter: fields.reporter?.displayName ?? null,
    created: fields.created,
    resolved: fields.resolutiondate ?? null,
    points: fields.customfield_10016 ?? null,
    labels: fields.labels ?? [],
    parent: fields.parent?.key ?? null,
    sprints: (fields.customfield_10020 ?? []).map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      goal: sprint.goal ?? '',
      start: sprint.startDate ?? null,
      end: sprint.endDate ?? null,
      completed: sprint.completeDate ?? null,
    })),
  }))
  .sort((a, b) => Number(a.key.split('-')[1]) - Number(b.key.split('-')[1]));

const keys = new Set(issues.map((issue) => issue.key));
if (keys.size !== issues.length) throw new Error('The same issue appears on two pages.');
const out = { recordedAt: new Date().toISOString(), issues };
fs.mkdirSync(path.join(here, 'data'), { recursive: true });
fs.writeFileSync(path.join(here, 'data', 'jira.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(`${issues.length} issues recorded in data/jira.json`);
