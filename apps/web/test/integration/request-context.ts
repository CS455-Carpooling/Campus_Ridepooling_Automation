import { AsyncLocalStorage } from 'node:async_hooks';

/** The request a route handler is answering, as next/headers and next/server see it. */
export type RequestScope = {
  headers: Headers;
  cookies: Map<string, string>;
  /** Work the handler passed to after(), run once it has answered. */
  afterTasks: Array<() => unknown>;
};

export const requestScope = new AsyncLocalStorage<RequestScope>();

export function currentScope(): RequestScope {
  const scope = requestScope.getStore();
  if (!scope) {
    throw new Error(
      'Next.js request APIs were used outside a request: call the route with callRoute().',
    );
  }
  return scope;
}
