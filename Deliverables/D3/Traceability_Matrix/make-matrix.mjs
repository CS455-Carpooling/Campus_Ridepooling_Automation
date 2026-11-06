// Builds the D3 requirements-to-Jira-to-GitHub-to-testing traceability matrix. Every cell comes
// from a recorded source, so the matrix can be rebuilt and checked:
//
//   - requirement statements: the Deliverable 1 requirement documents;
//   - tests: the recorded unit run (data/unit-cases.json) and integration run
//     (../test-run/integration-results.json); a test verifies a requirement when its own title
//     cites the requirement ID (a describe() title around it does not count), or when
//     data/manual-links.json links it after reading the test;
//   - GitHub: the merged pull requests in data/prs.json (snapshot-prs.mjs) that cite the
//     requirement, or that introduced the code and the tests that verify it;
//   - Jira: the CS455 issue keys of those pull requests (title, branch, commits, Jira line).
//
// A requirement is listed when at least one passing automated test verifies it.
//
// Run from the repository root (see README.md for the commands that record the runs):
//
//   node Deliverables/D3/Traceability_Matrix/make-matrix.mjs [--unit <vitest json>] [--coverage <coverage-summary.json>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const data = (name) => path.join(here, 'data', name);
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
const generated = path.join(here, 'generated');
fs.mkdirSync(generated, { recursive: true });
// How much of each list the PDF shows; the CSV files have everything.
const MAX_PRS = 5;
const MAX_JIRA = 5;
const MAX_FILES = 3;

/** `D:\...\apps\web\src\x.ts` or `/.../apps/web/src/x.ts` as `apps/web/src/x.ts`. */
const fromRoot = (file) => {
  const unix = file.replace(/\\/g, '/');
  const at = unix.indexOf('apps/web/');
  return at >= 0 ? unix.slice(at) : unix;
};

// ---------- record a new unit run or coverage summary, when given ----------
const argValue = (flag) => {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
if (argValue('--unit')) {
  const raw = readJson(argValue('--unit'));
  writeJson(data('unit-cases.json'), {
    startTime: raw.startTime,
    cases: raw.testResults.flatMap((file) =>
      file.assertionResults.map((test) => ({
        file: fromRoot(file.name),
        name: test.fullName,
        title: test.title,
        suite: test.ancestorTitles,
        status: test.status,
      })),
    ),
  });
}
if (argValue('--coverage')) {
  const { total } = readJson(argValue('--coverage'));
  writeJson(data('unit-coverage.json'), {
    recorded: new Date().toISOString().slice(0, 10),
    statements: total.statements.pct,
    branches: total.branches.pct,
    functions: total.functions.pct,
    lines: total.lines.pct,
  });
}

// ---------- requirements (Deliverable 1) ----------
const ID =
  'FR-R[DO]-\\d{2}(?:\\.\\d+)?|NFR-RD-\\d{2}|NFR-RO-[A-Z]+-\\d{2}|AI-RD-\\d{2}|OA-FR-\\d{2}|SYS-FR-\\d{2}|SYS-NFR-\\d{2}';
const SECTIONS = [
  ['Rider FR', 'Rider functional requirements'],
  ['Rider AI', 'Rider AI agent requirements'],
  ['Rider NFR', 'Rider non-functional requirements'],
  ['Ride Owner FR', 'Ride Owner functional requirements'],
  ['Ride Owner NFR', 'Ride Owner non-functional requirements'],
  ['Admin FR', 'Operations Admin functional requirements'],
  ['System FR', 'System functional requirements (Operations Admin)'],
  ['System NFR', 'System non-functional requirements (Operations Admin)'],
];
const usersDir = path.join(root, 'Deliverables/D1/Requirements Engineering/users');
const clean = (text) =>
  text
    .replace(/<br>.*$/, '')
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const requirements = new Map();
function tableFile(file, section, statementColumn, measureColumn) {
  for (const line of fs.readFileSync(path.join(usersDir, file), 'utf8').split(/\r?\n/)) {
    const match = line.match(new RegExp(`^\\| *(${ID}) *\\|(.*)`));
    if (!match || requirements.has(match[1])) continue;
    const cells = match[2].split('|').map((cell) => cell.trim());
    let statement = clean(cells[statementColumn - 1]);
    if (measureColumn) statement += ` (${clean(cells[measureColumn - 1])})`;
    requirements.set(match[1], { id: match[1], section, statement, source: file });
  }
}
tableFile('rider/02_functional_requirements.md', 'Rider FR', 1);
tableFile('rider/03_non_functional_requirements.md', 'Rider NFR', 1, 2);
tableFile('rider/04_ai_agent_requirements.md', 'Rider AI', 2);
tableFile('ride_owner/02_functional_requirements.md', 'Ride Owner FR', 1);
tableFile('ride_owner/03_non_functional_requirements.md', 'Ride Owner NFR', 1);

{
  const adminFile = 'admin/Operations_Admin_Requirements.md';
  const lines = fs.readFileSync(path.join(usersDir, adminFile), 'utf8').split(/\r?\n/);
  let current = null;
  let buffer = [];
  let collecting = false;
  const flush = () => {
    if (!current || !buffer.length || requirements.has(current)) return;
    const section = current.startsWith('OA-FR')
      ? 'Admin FR'
      : current.startsWith('SYS-FR')
        ? 'System FR'
        : 'System NFR';
    requirements.set(current, {
      id: current,
      section,
      statement: clean(buffer.join(' ')),
      source: adminFile,
    });
  };
  for (const line of [...lines, '#### END']) {
    const heading = line.match(/^#{2,4} +(.*)/);
    if (heading) {
      flush();
      current = heading[1].match(/^(OA-FR-\d{2}|SYS-FR-\d{2}|SYS-NFR-\d{2})\b/)?.[1] ?? null;
      buffer = [];
      collecting = false;
      continue;
    }
    if (!current) continue;
    const start = line.match(/^\*\*Requirement:\*\* *(.*)/);
    if (start) {
      collecting = true;
      buffer = [start[1]];
    } else if (collecting && !line.trim()) {
      collecting = false;
    } else if (collecting) {
      buffer.push(line);
    }
  }
}

const natural = (a, b) => a.localeCompare(b, 'en', { numeric: true });
const allIds = [...requirements.keys()].sort(natural);

// ---------- citations: "FR-RD-13.1", "FR-RD-13.1 to 13.4", "OA-FR-34, 36", "SYS-FR-30 to 33" ----------
function resolve(token, end) {
  if (!end) return requirements.has(token) ? [token] : [];
  const start = token.match(/^(.*-)(\d{2})(?:\.(\d+))?$/);
  const finish = end.match(/^(?:.*-)?(\d{1,2})(?:\.(\d+))?$/);
  if (!start || !finish) return [];
  const [, prefix, major, minor] = start;
  const [, endMajor, endMinor] = finish;
  const key = (a, b) => Number(a) * 1000 + Number(b ?? 0);
  if ((minor === undefined) !== (endMinor === undefined)) return [];
  return allIds.filter((id) => {
    const parts = id.match(new RegExp(`^${prefix.replace(/[-.]/g, '\\$&')}(\\d{2})(?:\\.(\\d+))?$`));
    if (!parts) return false;
    if (minor === undefined) return parts[2] === undefined && Number(parts[1]) >= Number(major) && Number(parts[1]) <= Number(endMajor);
    return key(parts[1], parts[2]) >= key(major, minor) && key(parts[1], parts[2]) <= key(endMajor, endMinor);
  });
}

const TOKEN = new RegExp(
  `(${ID})(?: ?(?:to|through|–|—) ?((?:[A-Z]+-)*\\d{1,2}(?:\\.\\d+)?))?(?![\\d.])`,
  'g',
);
/** Requirement IDs a text cites exactly: a bare group such as "FR-RD-06" cites none. */
function cited(text) {
  const found = new Set();
  for (const match of text.matchAll(TOKEN)) {
    for (const id of resolve(match[1], match[2])) found.add(id);
    if (match[2]) continue;
    const prefix = match[1].match(/^(.*-)\d{2}(?:\.\d+)?$/)?.[1];
    const tail = text.slice(match.index + match[0].length).match(/^((?:, ?\d{1,2}(?:\.\d+)?(?![\d.-]))+)/);
    if (!prefix || !tail) continue;
    for (const short of tail[1].match(/\d{1,2}(?:\.\d+)?/g)) {
      const [major, minor] = short.split('.');
      for (const id of resolve(`${prefix}${major.padStart(2, '0')}${minor ? `.${minor}` : ''}`)) {
        found.add(id);
      }
    }
  }
  return found;
}

// ---------- tests ----------
const unit = readJson(data('unit-cases.json'));
const integrationRun = readJson(path.join(here, '../test-run/integration-results.json'));
const cases = [
  ...unit.cases.map((test) => ({ ...test, kind: 'unit' })),
  ...integrationRun.testResults.flatMap((file) =>
    file.assertionResults.map((test) => ({
      file: fromRoot(file.name),
      name: test.fullName,
      title: test.title,
      suite: test.ancestorTitles,
      status: test.status,
      kind: 'integration',
    })),
  ),
];
const caseKey = (test) => `${test.file}::${test.group ? '[group] ' : ''}${test.name}`;

// A describe() block, as one entry: it passes when every test inside it passed.
const groups = new Map();
for (const test of cases) {
  test.suite.forEach((title, depth) => {
    const name = test.suite.slice(0, depth + 1).join(' ');
    const key = `${test.file}::${name}`;
    if (!groups.has(key)) groups.set(key, { file: test.file, name, title, kind: test.kind, group: true, tests: [] });
    groups.get(key).tests.push(test);
  });
}
for (const group of groups.values()) {
  group.status = group.tests.every((test) => test.status === 'passed') ? 'passed' : 'failed';
}

const links = new Map(); // requirement -> Map(caseKey -> { test, how })
const link = (id, test, how) => {
  if (!links.has(id)) links.set(id, new Map());
  const existing = links.get(id).get(caseKey(test));
  if (!existing || (existing.how === 'reading' && how === 'cited')) links.get(id).set(caseKey(test), { test, how });
};
// An ID in a test's own title links that test. An ID in a describe() title is about the group as
// a whole, not about every test inside it, so it links the group as one entry.
for (const group of groups.values()) for (const id of cited(group.title)) link(id, group, 'group');
for (const test of cases) {
  const inGroup = new Set(test.suite.flatMap((title) => [...cited(title)]));
  for (const id of cited(test.title)) if (!inGroup.has(id)) link(id, test, 'cited');
}

const manual = readJson(data('manual-links.json'));
const broken = [];
for (const [id, entries] of Object.entries(manual.links)) {
  if (!requirements.has(id)) broken.push(`${id}: not a Deliverable 1 requirement`);
  for (const [file, text] of entries) {
    const matches = cases.filter((test) => test.file === file && test.name.includes(text));
    if (!matches.length) broken.push(`${id}: no test in ${file} contains "${text}"`);
    for (const test of matches) link(id, test, 'reading');
  }
}
if (broken.length) {
  console.error(`manual-links.json has links that match no recorded test:\n  ${broken.join('\n  ')}`);
  process.exit(1);
}

const coverage = fs.existsSync(data('unit-coverage.json')) ? readJson(data('unit-coverage.json')) : null;
const COVERAGE_GATE = 80;

// ---------- pull requests and Jira keys ----------
const prs = readJson(data('prs.json')).filter((pr) => pr.mergedAt);
const prByNumber = new Map(prs.map((pr) => [pr.number, pr]));
const byMerge = [...prs].sort((a, b) => a.mergedAt.localeCompare(b.mergedAt));
// A stacked pull request also lists the commits of the ones below it. Each commit belongs to the
// first merged pull request that contains it; merge commits only name other branches.
const commitOwner = new Map();
for (const pr of byMerge) for (const commit of pr.commits) if (!commitOwner.has(commit.oid)) commitOwner.set(commit.oid, pr.number);
const ownCommits = (pr) =>
  pr.commits.filter((commit) => commitOwner.get(commit.oid) === pr.number && !/^Merge /.test(commit.headline));
const JIRA = /\bCS455[-_ ](\d+)\b/gi;
// HTML comments in a body are the PR template's hints and examples, not what the author wrote.
const bodyOf = (pr) => String(pr.body ?? '').replace(/<!--[\s\S]*?-->/g, '');
const jiraOf = (pr) => {
  const keys = new Set();
  const take = (text) => {
    for (const match of String(text ?? '').matchAll(JIRA)) keys.add(Number(match[1]));
  };
  take(pr.title);
  take(pr.headRefName);
  for (const commit of ownCommits(pr)) take(commit.headline);
  // In the body: the opening lines before any heading, the "Jira issue" section of the PR
  // template, and any other line that names Jira. Checklist lines are template text.
  let inJira = false;
  let seenHeading = false;
  for (const line of bodyOf(pr).split('\n')) {
    if (/^#{1,6}\s/.test(line)) {
      seenHeading = true;
      inJira = /jira/i.test(line);
    } else if (!/^\s*- \[[ x]\]/i.test(line) && (inJira || !seenHeading || /jira/i.test(line))) {
      take(line);
    }
  }
  return [...keys].sort((a, b) => a - b).map((n) => `CS455-${n}`);
};
const prText = (pr) =>
  [pr.title, bodyOf(pr), ...ownCommits(pr).flatMap((commit) => [commit.headline, commit.body])].join('\n');
const prCites = new Map(prs.map((pr) => [pr.number, cited(prText(pr))]));
/** The earliest merged pull request that changed a file: the one that introduced it. */
const introducedBy = (file) => byMerge.find((pr) => pr.files.includes(file))?.number;

const exists = (file) => fs.existsSync(path.join(root, file));
/** The source modules a test file exercises: its namesake, or the app modules it imports. */
function modulesOf(testFile) {
  const found = new Set();
  const base = testFile.replace(/\.int\.test\.ts$|\.test\.(tsx?|mjs)$/, '');
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${path.posix.dirname(testFile)}/page.tsx`]) {
    if (exists(candidate) && candidate !== testFile) {
      found.add(candidate);
      break;
    }
  }
  if (testFile.includes('/test/integration/')) {
    // The routes and domain modules the test calls; the database pool every test imports is not
    // what any one requirement is about.
    const source = fs.readFileSync(path.join(root, testFile), 'utf8');
    for (const match of source.matchAll(/from '@\/((?:app|lib)\/[^']+)'/g)) {
      if (match[1] === 'lib/db') continue;
      for (const ext of ['.ts', '.tsx']) {
        const candidate = `apps/web/src/${match[1]}${ext}`;
        if (exists(candidate)) found.add(candidate);
      }
    }
  }
  return [...found];
}

// ---------- rows ----------
const rows = [];
for (const id of allIds) {
  const requirement = requirements.get(id);
  const verified = [...(links.get(id)?.values() ?? [])];
  const coverageNote = manual.coverage?.[id];
  if (!verified.length && !(coverageNote && coverage)) continue;

  const testFiles = [...new Set(verified.map(({ test }) => test.file))].sort();
  const modules = [...new Set(testFiles.flatMap(modulesOf))];
  // Shown first: the pull requests that introduced the code under test, then those that cite
  // the requirement, then those that introduced the tests. The CSV lists every one.
  const implementing = modules.map(introducedBy).filter(Boolean);
  const citing = prs.filter((pr) => prCites.get(pr.number).has(id)).map((pr) => pr.number);
  const testing = testFiles.map(introducedBy).filter(Boolean);
  const ranked = [...new Set([...implementing, ...citing, ...testing])];
  const pulls = [...ranked].sort((a, b) => a - b);
  const shownPulls = ranked.slice(0, MAX_PRS).sort((a, b) => a - b);
  const jiraOfAll = (numbers) => [...new Set(numbers.flatMap((n) => jiraOf(prByNumber.get(n))))].sort(natural);
  const jira = jiraOfAll(pulls);
  const shownJira = jiraOfAll(shownPulls);

  const passed = verified.filter(({ test }) => test.status === 'passed').length;
  const coverageOk = coverageNote && coverage ? coverage.statements >= COVERAGE_GATE : true;
  rows.push({
    ...requirement,
    tests: verified,
    testFiles,
    byReading: verified.length > 0 && verified.every(({ how }) => how === 'reading'),
    coverage: coverageNote && coverage ? coverage : null,
    pulls,
    shownPulls,
    citing,
    jira,
    shownJira,
    passed,
    total: verified.length,
    pass: passed === verified.length && coverageOk,
  });
}

// ---------- outputs ----------
const tex = (text) =>
  String(text)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}')
    .replace(/≤/g, '$\\leq$')
    .replace(/≥/g, '$\\geq$')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/–/g, '--')
    .replace(/—/g, '---')
    .replace(/×/g, '$\\times$')
    .replace(/→/g, '$\\rightarrow$')
    .replace(/-(?=-)/g, '-{}');
const shorten = (text, limit) => {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' '))} …`;
};
/** A test file's short name: `lib/auth`, `api/auth/login/route`, `integration/rides/join-requests`. */
const shortTest = (file) => {
  const trimmed = file
    .replace(/^apps\/web\/(src|test)\//, '')
    .replace(/\.int\.test\.ts$|\.test\.(tsx?|mjs)$/, '');
  const parts = trimmed.split('/');
  const keep = /^(route|routes|page|pages)$/.test(parts.at(-1)) ? 4 : 2;
  const short = parts.slice(-keep).join('/');
  // `app/api/...` reads as `api/...`; the landing page test stays `app/page`.
  return short.startsWith('app/') && short.split('/').length > 2 ? short.slice('app/'.length) : short;
};
const repo = 'https://github.com/CS455-Carpooling/Campus_Ridepooling_Automation';
const jiraUrl = 'https://cs455project.atlassian.net/browse/';

const write = (name, text) => fs.writeFileSync(path.join(generated, name), `${text}\n`);
const matrixRows = [];
for (const [section, title] of SECTIONS) {
  const inSection = rows.filter((row) => row.section === section);
  if (!inSection.length) continue;
  matrixRows.push(`\\multicolumn{5}{@{}l}{\\sectionrow{${tex(title)}}} \\\\*`);
  for (const row of inSection) {
    const statement = tex(shorten(row.statement, 165));
    const mark = row.byReading ? '\\textsuperscript{\\dag}' : '';
    const jira = row.shownJira.slice(0, MAX_JIRA).map((key) => `\\href{${jiraUrl}${key}}{${key}}`);
    if (row.jira.length > jira.length) jira.push(`+${row.jira.length - jira.length}`);
    const pulls = row.shownPulls.map((n) => `\\href{${repo}/pull/${n}}{\\#${n}}`);
    if (row.pulls.length > pulls.length) pulls.push(`+${row.pulls.length - pulls.length}`);
    const counts = new Map();
    for (const { test } of row.tests) counts.set(test.file, (counts.get(test.file) ?? 0) + 1);
    const files = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || natural(a[0], b[0]))
      .map(([file, n]) => `\\file{${shortTest(file)}} (${n})`);
    const shown = files.slice(0, MAX_FILES);
    if (files.length > MAX_FILES) shown.push(`+${files.length - MAX_FILES} files`);
    if (row.coverage) {
      shown.push(`unit coverage ${row.coverage.statements.toFixed(1)}\\,\\% statements (gate ${COVERAGE_GATE}\\,\\%)`);
    }
    const result = row.pass
      ? row.total
        ? `Pass ${row.passed}/${row.total}`
        : 'Pass'
      : `\\textbf{Fail} ${row.passed}/${row.total}`;
    matrixRows.push(
      `\\textbf{${row.id}}${mark} ${statement} & ${jira.join(', ') || '--'} & ${pulls.join(', ') || '--'} & ${shown.join(', ')} & ${result} \\\\`,
    );
  }
}
write('matrix-rows.tex', matrixRows.join('\n'));

const distinct = (values) => new Set(values).size;
const sectionRows = SECTIONS.map(([section, title]) => {
  const inSection = rows.filter((row) => row.section === section);
  return { title, rows: inSection };
}).filter((s) => s.rows.length);
write(
  'section-summary.tex',
  sectionRows
    .map(
      ({ title, rows: list }) =>
        `${tex(title)} & ${list.length} & ${distinct(list.flatMap((r) => r.jira))} & ${distinct(list.flatMap((r) => r.pulls))} & ${distinct(list.flatMap((r) => r.tests.map(({ test }) => caseKey(test))))} \\\\`,
    )
    .join('\n'),
);

const linked = rows.flatMap((row) => row.tests.map(({ test }) => test));
const allCases = new Set(linked.filter((test) => !test.group).map(caseKey));
const allGroups = new Set(linked.filter((test) => test.group).map(caseKey));
const runDate = (start) => new Date(start).toISOString().slice(0, 10);
write(
  'summary.tex',
  [
    `\\newcommand{\\TraceRequirements}{${rows.length}}`,
    `\\newcommand{\\TraceJira}{${distinct(rows.flatMap((r) => r.jira))}}`,
    `\\newcommand{\\TracePulls}{${distinct(rows.flatMap((r) => r.pulls))}}`,
    `\\newcommand{\\TraceCases}{${allCases.size}}`,
    `\\newcommand{\\TraceGroups}{${allGroups.size}}`,
    `\\newcommand{\\TraceEntries}{${allCases.size + allGroups.size}}`,
    `\\newcommand{\\TraceFiles}{${distinct(rows.flatMap((r) => r.testFiles))}}`,
    `\\newcommand{\\TraceByReading}{${rows.filter((r) => r.byReading).length}}`,
    `\\newcommand{\\TracePassing}{${rows.filter((r) => r.pass).length}}`,
    `\\newcommand{\\UnitRunDate}{${runDate(unit.startTime)}}`,
    `\\newcommand{\\UnitRunCases}{${unit.cases.length}}`,
    `\\newcommand{\\IntegrationRunDate}{${runDate(integrationRun.startTime)}}`,
    `\\newcommand{\\IntegrationRunCases}{${integrationRun.numTotalTests}}`,
    `\\newcommand{\\SnapshotPulls}{${prs.length}}`,
    `\\newcommand{\\CoverageStatements}{${coverage ? coverage.statements.toFixed(1) : '--'}}`,
  ].join('\n'),
);

// CSV: one row per requirement, and one row per requirement-test link.
const csv = (cells) => cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',');
fs.writeFileSync(
  path.join(here, 'traceability-matrix.csv'),
  `${[
    csv(['Section', 'Requirement', 'Statement (Deliverable 1)', 'Jira issues', 'Pull requests', 'Test files', 'Tests and test groups', 'Passed', 'Result', 'Linked by']),
    ...rows.map((row) =>
      csv([
        SECTIONS.find(([s]) => s === row.section)[1],
        row.id,
        row.statement,
        row.jira.join(' '),
        row.pulls.map((n) => `#${n}`).join(' '),
        row.testFiles.join(' ') + (row.coverage ? ` coverage:${row.coverage.statements}%` : ''),
        row.total,
        row.passed,
        row.pass ? 'Pass' : 'Fail',
        row.coverage && !row.total
          ? 'coverage gate'
          : row.byReading
            ? 'reading the tests'
            : 'requirement ID in a test or describe() title',
      ]),
    ),
  ].join('\n')}\n`,
);
fs.writeFileSync(
  path.join(here, 'traceability-links.csv'),
  `${[
    csv(['Requirement', 'Test file', 'Test', 'Status', 'Linked by']),
    ...rows.flatMap((row) =>
      row.tests
        .sort((a, b) => natural(caseKey(a.test), caseKey(b.test)))
        .map(({ test, how }) =>
          csv([
            row.id,
            test.file,
            test.group ? `${test.name} [describe() block of ${test.tests.length} tests]` : test.name,
            test.status,
            { cited: 'ID in test title', group: 'ID in describe() title', reading: 'reading the test' }[how],
          ]),
        ),
    ),
  ].join('\n')}\n`,
);

const failing = rows.filter((row) => !row.pass).map((row) => row.id);
console.log(
  `${rows.length} requirements traced (${rows.filter((r) => r.byReading).length} by reading the tests); ` +
    `${distinct(rows.flatMap((r) => r.jira))} Jira issues, ${distinct(rows.flatMap((r) => r.pulls))} pull requests, ${allCases.size} test cases and ${allGroups.size} test groups` +
    (failing.length ? `; FAILING: ${failing.join(', ')}` : '; all passing'),
);
const noJira = rows.filter((row) => !row.jira.length).map((row) => row.id);
const noPull = rows.filter((row) => !row.pulls.length).map((row) => row.id);
if (noJira.length) console.log(`no Jira key: ${noJira.join(', ')}`);
if (noPull.length) console.log(`no pull request: ${noPull.join(', ')}`);
