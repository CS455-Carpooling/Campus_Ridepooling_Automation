/**
 * The integration tests' database (TEST_DATABASE_URL) is dropped and rebuilt on every run and
 * emptied before every test, so the tests fail closed: they connect to nothing unless every
 * check below passes.
 *
 * 1. Its name ends in _test, so the app's own database (crp) is never a candidate.
 * 2. It is on this machine (localhost, 127.0.0.1 or ::1), never a hosted server.
 * 3. ALLOW_TEST_DATABASE_RESET names it exactly: an explicit opt-in for this one database.
 * 4. Once connected, it carries TEST_DATABASE_MARKER, which global setup writes on every
 *    database it creates: an existing database the tests did not make is never dropped or
 *    emptied (checkTestDatabaseMarker).
 */
export function testDatabaseUrl(raw: string | undefined, allowReset: string | undefined): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!/^postgres(?:ql)?:\/\//i.test(value)) {
    throw new Error(
      'Set TEST_DATABASE_URL to a Postgres URL, for example in apps/web/.env.local (see setup.md).',
    );
  }
  const name = databaseName(value);
  if (!name.endsWith('_test')) {
    throw new Error(
      `TEST_DATABASE_URL names the database "${name}". The integration tests wipe their ` +
        'database, so its name must end in _test.',
    );
  }
  const host = new URL(value).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `TEST_DATABASE_URL points at the host "${host}". The integration tests only reset a ` +
        'database on this machine (localhost, 127.0.0.1 or ::1).',
    );
  }
  const allowed = typeof allowReset === 'string' ? allowReset.trim() : '';
  if (allowed !== name) {
    throw new Error(
      `The integration tests drop and rebuild "${name}". To allow that, set ` +
        `ALLOW_TEST_DATABASE_RESET=${name} next to TEST_DATABASE_URL (see setup.md)` +
        (allowed ? `; it now allows "${allowed}".` : '.'),
    );
  }
  return value;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The comment global setup writes on the database it creates. */
export const TEST_DATABASE_MARKER = 'Created by the CS455 integration tests; dropped on every run.';

/**
 * `marker` is the database's comment, or undefined when no such database exists yet. Anything
 * but the tests' own marker means the database was made by someone else, and is refused.
 */
export function checkTestDatabaseMarker(name: string, marker: string | null | undefined): void {
  if (marker === undefined || marker === TEST_DATABASE_MARKER) return;
  throw new Error(
    `The database "${name}" exists but was not created by the integration tests, so they will ` +
      'not drop or empty it. If it is a disposable copy, drop it once yourself (for example ' +
      `docker compose exec db dropdb -U crp ${name}) and run the tests again.`,
  );
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

/** The same server's maintenance database, from which the test database is dropped and made. */
export function maintenanceUrl(url: string): string {
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  return maintenance.toString();
}
