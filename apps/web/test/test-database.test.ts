// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  checkTestDatabaseMarker,
  databaseName,
  maintenanceUrl,
  TEST_DATABASE_MARKER,
  testDatabaseUrl,
} from './integration/test-database';

// The integration tests drop and rebuild their database (CS455-110), so they must never be
// pointed at the app's own one, or at any database nobody opted in to resetting.
describe('the integration test database guard', () => {
  it('accepts a local database whose name ends in _test, when its reset is allowed by name', () => {
    const url = 'postgres://crp:secret@127.0.0.1:5433/crp_test';
    expect(testDatabaseUrl(` ${url} `, 'crp_test')).toBe(url);
    expect(testDatabaseUrl('postgresql://u:p@localhost/ride_pool_test', ' ride_pool_test ')).toBe(
      'postgresql://u:p@localhost/ride_pool_test',
    );
    expect(testDatabaseUrl('postgres://u:p@[::1]:5432/crp_test', 'crp_test')).toBe(
      'postgres://u:p@[::1]:5432/crp_test',
    );
  });

  it.each([
    ['the app database', 'postgres://crp:secret@127.0.0.1:5433/crp', /"crp"/],
    ['a name that only contains test', 'postgres://crp:secret@localhost/test_crp', /"test_crp"/],
    ['no database name', 'postgres://crp:secret@localhost', /""/],
    ['nothing', undefined, /Set TEST_DATABASE_URL/],
    ['an empty value', '  ', /Set TEST_DATABASE_URL/],
    ['another kind of URL', 'mysql://crp:secret@localhost/crp_test', /Set TEST_DATABASE_URL/],
    [
      'a hosted server',
      'postgres://crp:secret@dpg-abc.render.com/crp_test',
      /"dpg-abc.render.com"/,
    ],
    ['another machine', 'postgres://crp:secret@db/crp_test', /host "db"/],
  ])('refuses %s', (_case, url, message) => {
    expect(() => testDatabaseUrl(url, 'crp_test')).toThrow(message);
  });

  it.each([
    ['no opt-in', undefined, /set ALLOW_TEST_DATABASE_RESET=crp_test/],
    ['an empty opt-in', ' ', /set ALLOW_TEST_DATABASE_RESET=crp_test/],
    ['an opt-in for another database', 'other_test', /it now allows "other_test"/],
    ['a generic yes', 'true', /it now allows "true"/],
  ])('refuses a reset with %s', (_case, allowReset, message) => {
    expect(() =>
      testDatabaseUrl('postgres://crp:secret@127.0.0.1:5433/crp_test', allowReset),
    ).toThrow(message);
  });

  it('drops only a database it created, or one that does not exist yet', () => {
    expect(() => checkTestDatabaseMarker('crp_test', undefined)).not.toThrow();
    expect(() => checkTestDatabaseMarker('crp_test', TEST_DATABASE_MARKER)).not.toThrow();
    expect(() => checkTestDatabaseMarker('crp_test', null)).toThrow(
      /"crp_test" exists but was not created by the integration tests/,
    );
    expect(() => checkTestDatabaseMarker('crp_test', 'Production copy')).toThrow(/dropdb/);
  });

  it('drops and creates the database from the same server', () => {
    const url = 'postgres://crp:p%40ss@127.0.0.1:5433/crp_test?sslmode=disable';
    expect(databaseName(url)).toBe('crp_test');
    expect(maintenanceUrl(url)).toBe(
      'postgres://crp:p%40ss@127.0.0.1:5433/postgres?sslmode=disable',
    );
  });
});
