import { afterAll, beforeEach, inject } from 'vitest';
import { pool } from '@/lib/db';
import { resetDatabase } from './reset';
import { testDatabaseUrl } from './test-database';

// The app's pool is about to be emptied before every test: check again that it is a _test one.
testDatabaseUrl(process.env.DATABASE_URL);

// Every test starts from a freshly migrated database.
beforeEach(async () => {
  await resetDatabase(pool, inject('referenceRows'));
});

afterAll(async () => {
  await pool.end();
  delete (globalThis as { __pgPool?: unknown }).__pgPool;
});
