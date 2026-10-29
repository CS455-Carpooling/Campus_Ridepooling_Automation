import { AsyncLocalStorage } from 'node:async_hooks';

/** The request a route handler is answering, as next/headers would see it. */
export type RequestScope = {
  headers: Headers;
  cookies: Map<string, string>;
};

export const requestScope = new AsyncLocalStorage<RequestScope>();

export function currentScope(): RequestScope {
  const scope = requestScope.getStore();
  if (!scope) {
    throw new Error('next/headers was used outside a request: call the route with callRoute().');
  }
  return scope;
}
