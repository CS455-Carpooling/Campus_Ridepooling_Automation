// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { databaseName, maintenanceUrl, testDatabaseUrl } from './integration/test-database';

// The integration tests drop and rebuild their database (CS455-110), so they must never be
// pointed at the app's own one.
describe('the integration test database guard', () => {
  it('accepts a database whose name ends in _test', () => {
    const url = 'postgres://crp:secret@127.0.0.1:5433/crp_test';
    expect(testDatabaseUrl(` ${url} `)).toBe(url);
    expect(testDatabaseUrl('postgresql://u:p@db/ride_pool_test')).toBe(
      'postgresql://u:p@db/ride_pool_test',
    );
  });

  it.each([
    ['the app database', 'postgres://crp:secret@127.0.0.1:5433/crp', /"crp"/],
    ['a name that only contains test', 'postgres://crp:secret@localhost/test_crp', /"test_crp"/],
    ['no database name', 'postgres://crp:secret@localhost', /""/],
    ['nothing', undefined, /Set TEST_DATABASE_URL/],
    ['an empty value', '  ', /Set TEST_DATABASE_URL/],
    ['another kind of URL', 'mysql://crp:secret@localhost/crp_test', /Set TEST_DATABASE_URL/],
  ])('refuses %s', (_case, url, message) => {
    expect(() => testDatabaseUrl(url)).toThrow(message);
  });

  it('drops and creates the database from the same server', () => {
    const url = 'postgres://crp:p%40ss@127.0.0.1:5433/crp_test?sslmode=disable';
    expect(databaseName(url)).toBe('crp_test');
    expect(maintenanceUrl(url)).toBe(
      'postgres://crp:p%40ss@127.0.0.1:5433/postgres?sslmode=disable',
    );
  });
});
