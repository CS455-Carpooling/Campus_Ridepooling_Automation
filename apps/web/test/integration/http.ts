import crypto from 'node:crypto';
import { requestScope } from './request-context';

/** Someone the request is sent as: their session token goes in the cookie. */
export type Caller = { token: string };

// The cookie getCurrentUser() reads outside a production build (src/lib/auth.ts).
const SESSION_COOKIE = 'crp_session';

type RouteHandler<P> = (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;

export type RouteCall<P> = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Shown in the request URL only; the handler is chosen by the caller. */
  path?: string;
  /** Sent as JSON; a string is sent as it is, for malformed-body cases. */
  body?: unknown;
  params?: P;
  as?: Caller;
  /** 'cross' sends another site's Origin, as a cross-site form or script would. */
  origin?: 'same' | 'cross';
  /** The client address the per-IP rate limits key on; a new one per call by default. */
  ip?: string;
  headers?: Record<string, string>;
};

export type RouteResult = {
  status: number;
  // Each test checks the fields it needs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  response: Response;
};

/**
 * Calls a route handler as Next.js would for one request: next/headers sees this request's
 * headers and cookies, and nothing else about the app is replaced. The handler talks to the
 * real test database.
 */
export async function callRoute<P extends Record<string, string> = Record<string, never>>(
  handler: RouteHandler<P> | (() => Promise<Response>),
  call: RouteCall<P> = {},
): Promise<RouteResult> {
  const method = call.method ?? 'GET';
  const url = `http://localhost:3000${call.path ?? '/api/test'}`;
  const headers = new Headers(call.headers);
  if (call.origin === 'cross') {
    headers.set('origin', 'https://attacker.example');
    headers.set('host', 'localhost:3000');
    headers.set('sec-fetch-site', 'cross-site');
  } else {
    headers.set('origin', 'http://localhost:3000');
    headers.set('host', 'localhost:3000');
    headers.set('sec-fetch-site', 'same-origin');
  }
  headers.set(
    'x-forwarded-for',
    call.ip ?? `10.${crypto.randomInt(256)}.${crypto.randomInt(256)}.${crypto.randomInt(1, 255)}`,
  );

  const cookies = new Map<string, string>();
  if (call.as) {
    cookies.set(SESSION_COOKIE, call.as.token);
    headers.set('cookie', `${SESSION_COOKIE}=${call.as.token}`);
  }

  let body: string | undefined;
  if (call.body !== undefined && method !== 'GET') {
    body = typeof call.body === 'string' ? call.body : JSON.stringify(call.body);
    headers.set('content-type', 'application/json');
  }

  const request = new Request(url, { method, headers, body });
  const ctx = { params: Promise.resolve((call.params ?? {}) as P) };
  const scope = { headers, cookies, afterTasks: [] as Array<() => unknown> };
  const response = await requestScope.run(scope, () => (handler as RouteHandler<P>)(request, ctx));
  // Next.js runs after() work once the response is sent; the test sees its effects too.
  for (const task of scope.afterTasks) await requestScope.run(scope, task);
  const text = await response.clone().text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: keep the text.
  }
  return { status: response.status, body: parsed, response };
}
