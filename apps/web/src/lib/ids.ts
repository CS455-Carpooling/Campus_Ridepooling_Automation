const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True for a UUID, the form of every user and ride ID in the database. Check
 * IDs from URLs or the development session with this before a query:
 * PostgreSQL rejects anything else with an error instead of finding nothing.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
