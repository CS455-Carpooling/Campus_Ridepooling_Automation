/**
 * The integration tests' database (TEST_DATABASE_URL) is dropped and rebuilt on every run, so
 * its name must end in _test: the app's own database (crp) is refused before anything
 * connects to it.
 */
export function testDatabaseUrl(raw: string | undefined): string {
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
  return value;
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
