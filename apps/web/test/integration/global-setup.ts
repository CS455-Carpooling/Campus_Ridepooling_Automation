import fs from 'node:fs';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { captureReferenceRows, type ReferenceRows } from './reset';
import { databaseName, maintenanceUrl, testDatabaseUrl } from './test-database';

declare module 'vitest' {
  export interface ProvidedContext {
    referenceRows: ReferenceRows;
  }
}

/**
 * Once per run: a new, empty test database with db/schema.sql applied, as
 * scripts/migrate.mjs applies it to a real one.
 */
export default async function setup(project: TestProject) {
  const url = testDatabaseUrl(process.env.TEST_DATABASE_URL);
  const name = databaseName(url);

  const server = new pg.Client({ connectionString: maintenanceUrl(url) });
  await server.connect();
  try {
    const quoted = `"${name.replace(/"/g, '""')}"`;
    await server.query(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
    await server.query(`CREATE DATABASE ${quoted}`);
  } finally {
    await server.end();
  }

  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    await db.query(fs.readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8'));
    project.provide('referenceRows', await captureReferenceRows(db));
  } finally {
    await db.end();
  }
}
