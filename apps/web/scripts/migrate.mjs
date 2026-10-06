import pg from 'pg';
import fs from 'node:fs';

const rawUrl = process.env.DATABASE_URL;
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
