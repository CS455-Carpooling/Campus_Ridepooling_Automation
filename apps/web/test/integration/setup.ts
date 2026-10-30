import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import { pool } from '@/lib/db';
import { resetDatabase } from './reset';
import { checkTestDatabaseMarker, databaseName, testDatabaseUrl } from './test-database';

// The app's pool is about to be emptied before every test: check again that it is a _test one,
// opted in to resets, on this machine.
const name = databaseName(
  testDatabaseUrl(process.env.DATABASE_URL, process.env.ALLOW_TEST_DATABASE_RESET),
);

// ... and that the database it reaches is the one global setup created, before the first reset.
beforeAll(async () => {
  const { rows } = await pool.query<{ name: string; marker: string | null }>(
    `SELECT datname AS name, shobj_description(oid, 'pg_database') AS marker
     FROM pg_database WHERE datname = current_database()`,
  );
  if (rows[0]?.name !== name) {
    throw new Error(`The test pool reached "${rows[0]?.name}", not "${name}".`);
  }
  checkTestDatabaseMarker(name, rows[0].marker);
});

// Every test starts from a freshly migrated database.
beforeEach(async () => {
  await resetDatabase(pool, inject('referenceRows'));
});

afterAll(async () => {
  await pool.end();
  delete (globalThis as { __pgPool?: unknown }).__pgPool;
});
