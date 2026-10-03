/**
 * Test doubles for the account backend (src/lib/auth.ts and src/app/api/auth):
 * a fake pg pool and fake request headers and cookies. Use them from a test file:
 *
 *   vi.mock('@/lib/db', async () => (await import('../test/auth-mocks')).dbModule);
 *   vi.mock('next/headers', async () => (await import('../test/auth-mocks')).headersModule);
 *
 * and call resetAuthMocks() in beforeEach.
 */
import { vi } from 'vitest';

type Row = Record<string, unknown>;
type Handler = (sql: string, params: unknown[]) => { rows: Row[] } | undefined;

export const db = {
  handlers: [] as Handler[],
  /** Every query goes to the most recently added handler that matches it. */
  query: vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const handler of db.handlers) {
      const result = handler(sql, params);
      if (result) return result;
    }
    return { rows: [] as Row[] };
  }),
  /** Answers queries containing `fragment` with these rows. */
  on(fragment: string, rows: Row[] | ((params: unknown[]) => Row[])) {
    db.handlers.unshift((sql, params) =>
      sql.includes(fragment)
        ? { rows: typeof rows === 'function' ? rows(params) : rows }
        : undefined,
    );
  },
  /** The parameters of every query containing `fragment`, in order. */
  calls(fragment: string): unknown[][] {
    return db.query.mock.calls
      .filter(([sql]) => sql.includes(fragment))
      .map(([, params]) => params ?? []);
  },
};

export const request = { headers: new Headers() };

export const cookieJar = {
  store: new Map<string, string>(),
  get: vi.fn((name: string) => {
    const value = cookieJar.store.get(name);
    return value === undefined ? undefined : { name, value };
  }),
  set: vi.fn((name: string, value: string, options?: Record<string, unknown>) => {
    void options;
    cookieJar.store.set(name, value);
  }),
  delete: vi.fn((name: string) => {
    cookieJar.store.delete(name);
  }),
};

/** Headers of a form posted from this site. */
export function sameOriginRequest(extra: Record<string, string> = {}) {
  request.headers = new Headers({
    origin: 'http://localhost:3000',
    host: 'localhost:3000',
    'x-forwarded-for': '203.0.113.7, 10.0.0.1',
    ...extra,
  });
}

export function resetAuthMocks() {
  db.handlers = [];
  db.query.mockClear();
  // By default nobody has hit a rate limit yet.
  db.on('rate_limits', [{ count: 1 }]);
  cookieJar.store.clear();
  cookieJar.get.mockClear();
  cookieJar.set.mockClear();
  cookieJar.delete.mockClear();
  sameOriginRequest();
}

/** A JSON POST request, as the account forms send it. */
export function jsonPost(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export const dbModule = {
  pool: { query: (sql: string, params?: unknown[]) => db.query(sql, params) },
};

export const headersModule = {
  headers: async () => request.headers,
  cookies: async () => cookieJar,
};
