import pg from 'pg';
import fs from 'node:fs';

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const rel of ['../.env.local', '../.env', '../../.env.local', '../../.env']) {
    try {
      const content = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
      const match = content.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {}
  }
  return '';
}

const rawUrl = resolveDatabaseUrl();
const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
if (!/^postgres(?:ql)?:\/\//i.test(url)) {
  console.error('DATABASE_URL is not set or is not a valid Postgres connection string');
  process.exit(1);
}
const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('.render.com') ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
await client.query(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
await client.end();
console.log('Database schema is up to date.');
