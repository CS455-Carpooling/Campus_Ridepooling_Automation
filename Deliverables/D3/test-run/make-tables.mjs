// Turns the integration test run into the tables the D3 test reports include, so every number
// in them comes from the recorded run. Run from the repository root after the two commands in
// README.md:
//
//   node Deliverables/D3/test-run/make-tables.mjs
//
// It also rewrites the machine-specific absolute paths in the two JSON files as paths from the
// repository root, so the committed results are the same on every machine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const resultsFile = path.join(here, 'integration-results.json');
const coverageFile = path.join(here, 'integration-coverage-summary.json');
const out = path.join(here, 'generated');
fs.mkdirSync(out, { recursive: true });

/** `.../apps/web/test/x.ts` or `...\\apps\\web\\src\\x.ts` as `apps/web/...`. */
const fromRoot = (file) => {
  const unix = file.replace(/\\/g, '/');
  const at = unix.indexOf('apps/web/');
  return at >= 0 ? unix.slice(at) : unix;
};

// ---------- normalise the recorded files ----------
const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
for (const file of results.testResults) file.name = fromRoot(file.name);
fs.writeFileSync(resultsFile, `${JSON.stringify(results, null, 2)}\n`);

const rawCoverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
const coverage = Object.fromEntries(
  Object.entries(rawCoverage).map(([file, value]) => [file === 'total' ? file : fromRoot(file), value]),
);
fs.writeFileSync(coverageFile, `${JSON.stringify(coverage, null, 2)}\n`);

// ---------- helpers ----------
const tex = (text) =>
  String(text)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}')
    .replace(/’/g, "'")
    .replace(/"/g, '\\textquotedbl{}')
    // Keep "--" as typed: LaTeX would turn it into a dash.
    .replace(/-(?=-)/g, '-{}');
const seconds = (ms) => (ms / 1000).toFixed(1);
const write = (name, text) => fs.writeFileSync(path.join(out, name), `${text}\n`);
const short = (file) => file.replace('apps/web/test/integration/', '');

const files = results.testResults.map((file) => ({
  file: short(file.name),
  tests: file.assertionResults,
  passed: file.assertionResults.filter((t) => t.status === 'passed').length,
  ms: file.endTime - file.startTime,
}));
const adversarial = files.filter((f) => f.file.startsWith('adversarial/'));
const bugs = files.filter((f) => f.file.startsWith('bugs/'));
const integration = files.filter((f) => !f.file.startsWith('adversarial/'));
const count = (list) => list.reduce((n, f) => n + f.tests.length, 0);
const passedIn = (list) => list.reduce((n, f) => n + f.passed, 0);
const totalMs = files.reduce((n, f) => n + f.ms, 0);

// ---------- summary macros ----------
const runDate = new Date(results.startTime).toISOString().slice(0, 10);
write(
  'summary.tex',
  [
    `\\newcommand{\\RunDate}{${runDate}}`,
    `\\newcommand{\\RunTotal}{${results.numTotalTests}}`,
    `\\newcommand{\\RunPassed}{${results.numPassedTests}}`,
    `\\newcommand{\\RunFailed}{${results.numFailedTests}}`,
    `\\newcommand{\\RunFiles}{${files.length}}`,
    `\\newcommand{\\RunSeconds}{${seconds(totalMs)}}`,
    `\\newcommand{\\IntFiles}{${integration.length}}`,
    `\\newcommand{\\IntTotal}{${count(integration)}}`,
    `\\newcommand{\\IntPassed}{${passedIn(integration)}}`,
    `\\newcommand{\\BugTotal}{${count(bugs)}}`,
    `\\newcommand{\\AdvFiles}{${adversarial.length}}`,
    `\\newcommand{\\AdvTotal}{${count(adversarial)}}`,
    `\\newcommand{\\AdvPassed}{${passedIn(adversarial)}}`,
  ].join('\n'),
);

// ---------- per file ----------
const fileRows = (list) =>
  list
    .map(
      (f) =>
        `\\file{${f.file}} & ${f.tests.length} & ${f.passed} & ${seconds(f.ms)} \\\\`,
    )
    .join('\n');
write('integration-files.tex', fileRows(integration));
write('adversarial-files.tex', fileRows(adversarial));

// ---------- every case, grouped by file and describe block ----------
const caseRows = (list) =>
  list
    .flatMap((f) =>
      f.tests.map(
        (t) =>
          `\\file{${f.file.replace(/^.*\//, '').replace('.int.test.ts', '')}} & ${tex(
            [...t.ancestorTitles.slice(-1), t.title].join(': '),
          )} & ${t.status === 'passed' ? 'Pass' : 'Fail'} \\\\`,
      ),
    )
    .join('\n');
write('integration-cases.tex', caseRows(integration));
write('adversarial-cases.tex', caseRows(adversarial));

// ---------- coverage by area ----------
const area = (label, prefix) => {
  const sum = { statements: [0, 0], branches: [0, 0], functions: [0, 0], lines: [0, 0] };
  for (const [file, value] of Object.entries(coverage)) {
    if (file === 'total' || !prefix.some((p) => file.startsWith(p))) continue;
    for (const key of Object.keys(sum)) {
      sum[key][0] += value[key].covered;
      sum[key][1] += value[key].total;
    }
  }
  const pct = ([covered, total]) => (total ? ((100 * covered) / total).toFixed(1) : '--');
  return `${label} & ${pct(sum.statements)} & ${pct(sum.branches)} & ${pct(sum.functions)} & ${pct(sum.lines)} \\\\`;
};
write(
  'coverage.tex',
  [
    area('API route handlers (\\texttt{src/app/api})', ['apps/web/src/app/api/']),
    area('Server library (\\texttt{src/lib})', ['apps/web/src/lib/']),
    area('All of \\texttt{src} (pages and components included)', ['apps/web/src/']),
  ].join('\n'),
);

console.log(
  `${results.numPassedTests}/${results.numTotalTests} tests in ${files.length} files; tables in ${path.relative(process.cwd(), out)}`,
);
