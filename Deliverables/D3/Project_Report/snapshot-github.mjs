// Records the merged pull requests with their reviews, and the commits on master, in
// data/github.json, so the report's GitHub numbers come from a fixed snapshot. Needs the GitHub
// CLI signed in to the team repository and an up-to-date origin/master. Run from anywhere:
//
//   node Deliverables/D3/Project_Report/snapshot-github.mjs
//
// Each person is stored by name only: commit e-mail addresses are not copied into the snapshot.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const run = (cmd, args) => execFileSync(cmd, args, { cwd: here, encoding: 'utf8', maxBuffer: 1 << 28 });

// Every GitHub login and git author name a team member has used.
const PEOPLE = {
  mainak9093: 'Mainak Sarkar',
  Mainak: 'Mainak Sarkar',
  'khushi-2653': 'Khushi Ranawat',
  'Khushi Ranawat': 'Khushi Ranawat',
  'mahir2006-star': 'Mahir Jain',
  'Mahir Jain': 'Mahir Jain',
  Chaitanyanitawe: 'Chaitanya Nitawe',
  'Chaitanya Nitawe': 'Chaitanya Nitawe',
  Tocoung: 'Prithviraj Ghosh',
};
const person = (name) => {
  if (!PEOPLE[name]) throw new Error(`Unknown GitHub or git identity: ${name}. Add it to PEOPLE.`);
  return PEOPLE[name];
};

// One paginated query: `gh pr list` cannot ask for reviews and commits together on this many pull
// requests without going over GitHub's limit on query size.
const QUERY = `query($after: String) {
  repository(owner: "CS455-Carpooling", name: "Campus_Ridepooling_Automation") {
    pullRequests(states: MERGED, first: 40, after: $after, orderBy: { field: CREATED_AT, direction: ASC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title headRefName body createdAt mergedAt additions deletions
        author { login }
        reviews(first: 60) { nodes { author { login } state submittedAt } }
        commits(first: 100) { nodes { commit { oid messageHeadline } } }
      }
    }
  }
}`;
const merged = [];
for (let after = null, more = true; more; ) {
  const args = ['api', 'graphql', '-f', `query=${QUERY}`];
  if (after) args.push('-f', `after=${after}`);
  const page = JSON.parse(run('gh', args)).data.repository.pullRequests;
  merged.push(...page.nodes);
  ({ hasNextPage: more, endCursor: after } = page.pageInfo);
}
const prs = merged
  .sort((a, b) => a.number - b.number)
  .map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: person(pr.author.login),
    branch: pr.headRefName,
    body: pr.body,
    createdAt: pr.createdAt,
    mergedAt: pr.mergedAt,
    additions: pr.additions,
    deletions: pr.deletions,
    commits: pr.commits.nodes.map(({ commit }) => ({ oid: commit.oid, headline: commit.messageHeadline })),
    reviews: pr.reviews.nodes.map((review) => ({
      reviewer: person(review.author.login),
      state: review.state,
      submittedAt: review.submittedAt,
    })),
  }));

const commits = run('git', ['log', 'origin/master', '--no-merges', '--format=%h%x09%an%x09%cI'])
  .trim()
  .split('\n')
  .map((line) => {
    const [hash, author, date] = line.split('\t');
    return { hash, author: person(author), date };
  });

const head = run('git', ['rev-parse', '--short', 'origin/master']).trim();
const out = { recordedAt: new Date().toISOString(), masterHead: head, prs, commits };
fs.mkdirSync(path.join(here, 'data'), { recursive: true });
fs.writeFileSync(path.join(here, 'data', 'github.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(`${prs.length} merged pull requests and ${commits.length} commits on ${head} recorded in data/github.json`);
