// Records every merged pull request (title, branch, body, changed files, commit messages) in
// data/prs.json, so the matrix is built from a fixed snapshot rather than from GitHub at build
// time. Needs the GitHub CLI signed in to the team repository. Run from the repository root:
//
//   node Deliverables/D3/Traceability_Matrix/snapshot-prs.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gh = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 1 << 26 }));

const merged = gh([
  'pr', 'list', '--state', 'merged', '--limit', '500',
  '--json', 'number,title,headRefName,baseRefName,body,mergedAt,url',
]);
const prs = [];
for (const pr of merged.sort((a, b) => a.number - b.number)) {
  const detail = gh(['pr', 'view', String(pr.number), '--json', 'files,commits']);
  prs.push({
    ...pr,
    files: detail.files.map((file) => file.path),
    commits: detail.commits.map((commit) => ({
      oid: commit.oid,
      headline: commit.messageHeadline,
      body: commit.messageBody,
    })),
  });
  process.stdout.write(`#${pr.number} `);
}
fs.mkdirSync(path.join(here, 'data'), { recursive: true });
fs.writeFileSync(path.join(here, 'data', 'prs.json'), `${JSON.stringify(prs, null, 1)}\n`);
console.log(`\n${prs.length} merged pull requests recorded in data/prs.json`);
